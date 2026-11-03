import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventQueryDto } from './dto/event-query.dto';
import { UserRole, UserStatus, EventStatus, EventVisibility, EventCategory } from '@prisma/client';
import { userMinimalSelect } from '../common/prisma/selects';


@Injectable()
export class EventsService {
  constructor(private prisma: PrismaService) {}

  private async resolveCoordinatesFromAddress(
    address?: string,
    city?: string,
    country?: string,
  ): Promise<{ latitude: number; longitude: number } | null> {
    const query = [address, city, country].filter(Boolean).join(', ').trim();
    if (!query) {
      return null;
    }

    try {
      const url = new URL('https://nominatim.openstreetmap.org/search');
      url.search = new URLSearchParams({
        q: query,
        format: 'jsonv2',
        limit: '1',
        addressdetails: '1',
      }).toString();

      const response = await fetch(url.toString(), {
        headers: {
          'Accept-Language': 'es',
          'User-Agent': 'MeetiaApp/1.0',
        },
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      const match = Array.isArray(data) ? data[0] : null;
      if (!match) {
        return null;
      }

      const latitude = Number(match.lat);
      const longitude = Number(match.lon);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return null;
      }

      return { latitude, longitude };
    } catch (error) {
      return null;
    }
  }

  async create(createEventDto: CreateEventDto, userId: string) {
    const status = createEventDto.status ?? EventStatus.PUBLISHED;
    const visibility = createEventDto.visibility ?? EventVisibility.PUBLIC;
    const geocoded = createEventDto.latitude == null || createEventDto.longitude == null
      ? await this.resolveCoordinatesFromAddress(createEventDto.location || createEventDto.address, createEventDto.city, createEventDto.country)
      : null;

    const creation = this.prisma.event.create({
      data: {
        ...createEventDto,
        latitude: createEventDto.latitude ?? geocoded?.latitude ?? null,
        longitude: createEventDto.longitude ?? geocoded?.longitude ?? null,
        creatorId: userId,
        status,
        visibility,
        tags: createEventDto.tags || [],
        currentAttendees: 1,
        attendees: { connect: [{ id: userId }] },
        publishedAt: status === EventStatus.PUBLISHED ? new Date() : null,
      },
    });
    return creation;
  }

  async findAll(query: EventQueryDto = {}, user: { id: string; role: UserRole; institutionId?: string | null }) {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      category,
      visibility,
      startDateFrom,
      startDateTo,
      endDateFrom,
      endDateTo,
      city,
      country,
      institutionId,
      boardId,
      groupId,
      creatorId,
      assigneeId,
      tags,
      sortBy = 'startDate',
      sortOrder = 'asc',
    } = query;

    const where: any = {
      status: EventStatus.PUBLISHED,
    };

    const accessFilters: any[] = user.role === UserRole.ADMIN ? [] : [
      { visibility: EventVisibility.PUBLIC },
      { creatorId: user.id },
      { attendees: { some: { id: user.id } } },
      ...(user.institutionId ? [{ institutionId: user.institutionId, visibility: EventVisibility.INSTITUTION }] : []),
      { group: { members: { some: { id: user.id } } }, visibility: EventVisibility.GROUP },
    ];

    if (search) {
      const searchFilters = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { tags: { hasSome: [search] } },
      ];
      where.OR = accessFilters.length > 0 ? [...accessFilters, ...searchFilters] : searchFilters;
    } else if (accessFilters.length > 0) {
      where.OR = accessFilters;
    }

    if (status) where.status = status;
    if (category) where.category = category;
    if (visibility) where.visibility = visibility;
    if (institutionId) where.institutionId = institutionId;
    if (boardId) where.boardId = boardId;
    if (groupId) where.groupId = groupId;
    if (creatorId) where.creatorId = creatorId;
    if (assigneeId) where.assigneeId = assigneeId;

    if (startDateFrom || startDateTo) {
      where.startDate = {};
      if (startDateFrom) where.startDate.gte = new Date(startDateFrom);
      if (startDateTo) where.startDate.lte = new Date(startDateTo);
    }

    if (endDateFrom || endDateTo) {
      where.endDate = {};
      if (endDateFrom) where.endDate.gte = new Date(endDateFrom);
      if (endDateTo) where.endDate.lte = new Date(endDateTo);
    }

    if (city) where.city = { contains: city, mode: 'insensitive' };
    if (country) where.country = { contains: country, mode: 'insensitive' };
    if (tags && tags.length > 0) where.tags = { hasSome: tags };

    const [events, total] = await Promise.all([
      this.prisma.event.findMany({
        where,
        include: {
          creator: { select: userMinimalSelect },
          institution: true,
          board: true,
          group: true,
          assignee: { select: userMinimalSelect },
          attendees: { select: userMinimalSelect },
          _count: { select: { attendees: true, resources: true, tasks: true } },
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.event.count({ where }),
    ]);

    return { events, total, page, limit };
  }

  async findById(id: string, user: { id: string; role: UserRole; institutionId?: string | null }) {
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: {
        creator: { select: userMinimalSelect },
        institution: true,
        board: true,
        group: { include: { members: { select: userMinimalSelect } } },
        assignee: { select: userMinimalSelect },
        resources: true,
        tasks: true,
        attendees: { select: userMinimalSelect },
        eventDates: { include: { location: true, participants: { select: userMinimalSelect } } },
        pendingEventDates: true,
      },
    });

    if (!event) {
      throw new NotFoundException(`Event with ID ${id} not found`);
    }

    if (!this.canViewEvent(event, user)) {
      throw new ForbiddenException('You do not have permission to view this event');
    }

    return event;
  }

  async update(id: string, updateEventDto: UpdateEventDto, user: { id: string; role: UserRole; institutionId?: string | null }) {
    const event = await this.findById(id, user);

    if (!this.canModifyEvent(event, user)) {
      throw new ForbiddenException('You do not have permission to modify this event');
    }

    const data: any = { ...updateEventDto };

    if (updateEventDto.status && updateEventDto.status !== event.status) {
      if (updateEventDto.status === EventStatus.PUBLISHED && event.status !== EventStatus.PUBLISHED) {
        data.publishedAt = new Date();
      } else if (updateEventDto.status === EventStatus.CANCELLED && event.status !== EventStatus.CANCELLED) {
        data.cancelledAt = new Date();
        data.cancellationReason = updateEventDto.cancellationReason;
      }
    }

    return this.prisma.event.update({
      where: { id },
      data,
      include: {
        creator: { select: userMinimalSelect },
        institution: true,
        board: true,
        group: true,
      },
    });
  }

  async remove(id: string, user: { id: string; role: UserRole; institutionId?: string | null }) {
    const event = await this.findById(id, user);

    if (!this.canModifyEvent(event, user)) {
      throw new ForbiddenException('You do not have permission to delete this event');
    }

    await Promise.all([
      this.prisma.eventDateData.deleteMany({ where: { eventId: id } }),
      this.prisma.eventDate.deleteMany({ where: { eventId: id } }),
      this.prisma.resource.deleteMany({ where: { eventId: id } }),
      this.prisma.task.deleteMany({ where: { eventId: id } }),
      this.prisma.file.deleteMany({ where: { eventId: id } }),
    ]);

    return this.prisma.event.delete({ where: { id } });
  }

  async inviteUserToEvent(
    id: string,
    user: { id: string; role: UserRole; institutionId?: string | null },
    invited: { userId?: string; groupId?: string },
  ) {
    if (!invited.userId && !invited.groupId) {
      throw new BadRequestException('Either userId or groupId must be provided');
    }

    if (invited.userId && invited.groupId) {
      throw new BadRequestException('Provide either a userId or a groupId, not both');
    }

    const event = await this.prisma.event.findUnique({
      where: { id },
      include: { attendees: true },
    });

    if (!event) {
      throw new NotFoundException(`Event with ID ${id} not found`);
    }

    if (!this.canModifyEvent(event, user)) {
      throw new ForbiddenException('You do not have permission to invite people to this event');
    }

    if (invited.userId) {
      if (event.creatorId === invited.userId) {
        throw new ForbiddenException('The event creator is already part of the event');
      }

      if (event.attendees.some((a) => a.id === invited.userId)) {
        throw new ForbiddenException('This user is already invited or attending this event');
      }

      if (event.maxAttendees > 0 && event.currentAttendees >= event.maxAttendees) {
        throw new ForbiddenException('Event is full');
      }

      return this.prisma.event.update({
        where: { id },
        data: {
          attendees: { connect: { id: invited.userId } },
          currentAttendees: { increment: 1 },
        },
        include: {
          attendees: { select: userMinimalSelect },
        },
      });
    }

    const group = await this.prisma.group.findUnique({
      where: { id: invited.groupId },
      include: { members: true },
    });

    if (!group) {
      throw new NotFoundException(`Group with ID ${invited.groupId} not found`);
    }

    const memberIds = group.members
      .map((member) => member.id)
      .filter((memberId) => memberId !== event.creatorId && !event.attendees.some((attendee) => attendee.id === memberId));

    if (!memberIds.length) {
      throw new ForbiddenException('All members of this group are already invited or attending the event');
    }

    if (event.maxAttendees > 0 && event.currentAttendees + memberIds.length > event.maxAttendees) {
      throw new ForbiddenException('Adding this group would exceed the event attendee limit');
    }

    return this.prisma.event.update({
      where: { id },
      data: {
        attendees: { connect: memberIds.map((memberId) => ({ id: memberId })) },
        currentAttendees: { increment: memberIds.length },
      },
      include: {
        attendees: { select: userMinimalSelect },
      },
    });
  }

  async attendEvent(id: string, userId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: { attendees: true },
    });

    if (!event) {
      throw new NotFoundException(`Event with ID ${id} not found`);
    }

    if (event.attendees.some((a) => a.id === userId)) {
      throw new ForbiddenException('You are already attending this event');
    }

    if (event.maxAttendees > 0 && event.currentAttendees >= event.maxAttendees) {
      throw new ForbiddenException('Event is full');
    }

    return this.prisma.event.update({
      where: { id },
      data: {
        attendees: { connect: { id: userId } },
        currentAttendees: { increment: 1 },
      },
    });
  }

  async confirmAssistance(id: string, userId: string) {
    return this.attendEvent(id, userId);
  }

  async confirmAttendance(id: string, userId: string) {
    return this.attendEvent(id, userId);
  }

  async unattendEvent(id: string, userId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: { attendees: true },
    });

    if (!event) {
      throw new NotFoundException(`Event with ID ${id} not found`);
    }

    if (!event.attendees.some((a) => a.id === userId)) {
      throw new ForbiddenException('You are not attending this event');
    }

    return this.prisma.event.update({
      where: { id },
      data: {
        attendees: { disconnect: { id: userId } },
        currentAttendees: { decrement: 1 },
      },
    });
  }

  async leaveEvent(id: string, userId: string) {
    return this.unattendEvent(id, userId);
  }

  async getUpcomingEvents(user: { id: string; role: UserRole; institutionId?: string | null }, limit = 10) {
    const where: any = {
      startDate: { gt: new Date() },
      status: EventStatus.PUBLISHED,
    };

    if (user.role !== UserRole.ADMIN) {
      where.OR = [
        { visibility: EventVisibility.PUBLIC },
        { creatorId: user.id },
        { attendees: { some: { id: user.id } } },
        ...(user.institutionId ? [{ institutionId: user.institutionId, visibility: EventVisibility.INSTITUTION }] : []),
        { group: { members: { some: { id: user.id } } }, visibility: EventVisibility.GROUP },
      ];
    }

    return this.prisma.event.findMany({
      where,
      include: {
        creator: { select: userMinimalSelect },
        institution: true,
      },
      orderBy: { startDate: 'asc' },
      take: limit,
    });
  }

  async getEventsById(eventId: string) {
    if (!eventId) {
      throw new Error('EventId is missing');
    }

    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        creator: { select: userMinimalSelect },
        institution: true,
        board: true,
        group: { include: { members: { select: userMinimalSelect } } },
        assignee: { select: userMinimalSelect },
        resources: true,
        tasks: true,
        attendees: { select: userMinimalSelect },
        eventDates: { include: { location: true, participants: { select: userMinimalSelect } } },
        pendingEventDates: true,
      },
    });

    if (!event) {
      return undefined;
    }

    return event;
  }

  async getEventsByInterest(interests: string[], limit = 10) {
    if (!interests.length) return [];

    return this.prisma.event.findMany({
      where: {
        startDate: { gt: new Date() },
        status: EventStatus.PUBLISHED,
        tags: { hasSome: interests },
        OR: [
          { visibility: EventVisibility.PUBLIC },
        ],
      },
      include: {
        creator: { select: userMinimalSelect },
        institution: true,
      },
      orderBy: { startDate: 'asc' },
      take: limit,
    });
  }

  async getSimilarEvents(eventId: string, limit = 5) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { tags: true, category: true, institutionId: true, groupId: true },
    });

    if (!event) return [];

    return this.prisma.event.findMany({
      where: {
        id: { not: eventId },
        status: EventStatus.PUBLISHED,
        OR: [
          { tags: { hasSome: event.tags } },
          { category: event.category },
          { institutionId: event.institutionId },
          { groupId: event.groupId },
        ],
      },
      include: {
        creator: { select: userMinimalSelect },
        institution: true,
      },
      orderBy: { startDate: 'asc' },
      take: limit,
    });
  }

  private canViewEvent(event: any, user: { id: string; role: UserRole; institutionId?: string | null }): boolean {
    if (user.role === UserRole.ADMIN) return true;
    if (event.creatorId === user.id) return true;
    if (event.attendees?.some((attendee: any) => attendee.id === user.id)) return true;
    if (event.visibility === EventVisibility.PUBLIC) return true;
    if (event.visibility === EventVisibility.INSTITUTION && event.institutionId && event.institutionId === user.institutionId) return true;
    if (event.visibility === EventVisibility.GROUP && event.groupId && event.group?.members?.some((m: any) => m.id === user.id)) return true;
    return false;
  }

  private canModifyEvent(event: any, user: { id: string; role: UserRole; institutionId?: string | null }): boolean {
    if (user.role === UserRole.ADMIN) return true;
    if (event.creatorId === user.id) return true;
    if (user.role === UserRole.INSTITUTIONAL_USER && event.institutionId === user.institutionId) return true;
    return false;
  }
}