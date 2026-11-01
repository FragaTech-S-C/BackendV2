import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventStatus, EventVisibility, UserRole, ResourceType, TaskStatus } from '@prisma/client';
import { userMinimalSelect } from '../common/prisma/selects';

export interface SearchResult {
  type: 'event' | 'user' | 'board' | 'institution' | 'group' | 'resource' | 'task';
  id: string;
  title: string;
  description?: string;
  metadata?: Record<string, any>;
  relevanceScore: number;
}

@Injectable()
export class SearchService {
  constructor(private prisma: PrismaService) {}

  async search(query: string, user: { id: string; role: UserRole; institutionId?: string | null }, options?: { types?: string[]; limit?: number }): Promise<SearchResult[]> {
    const { types = ['event', 'user', 'board', 'institution', 'group', 'resource', 'task'], limit = 20 } = options || {};
    const results: SearchResult[] = [];
    const searchTerm = query.toLowerCase();
    const perTypeLimit = Math.ceil(limit / types.length);

    // Search events
    if (types.includes('event')) {
      const events = await this.searchEvents(searchTerm, user, perTypeLimit);
      results.push(...events);
    }

    // Search users
    if (types.includes('user') && user.role === UserRole.ADMIN) {
      const users = await this.searchUsers(searchTerm, perTypeLimit);
      results.push(...users);
    }

    // Search boards
    if (types.includes('board')) {
      const boards = await this.searchBoards(searchTerm, user, perTypeLimit);
      results.push(...boards);
    }

    // Search institutions
    if (types.includes('institution')) {
      const institutions = await this.searchInstitutions(searchTerm, user, perTypeLimit);
      results.push(...institutions);
    }

    // Search groups
    if (types.includes('group')) {
      const groups = await this.searchGroups(searchTerm, user, perTypeLimit);
      results.push(...groups);
    }

    // Search resources
    if (types.includes('resource')) {
      const resources = await this.searchResources(searchTerm, user, perTypeLimit);
      results.push(...resources);
    }

    // Search tasks
    if (types.includes('task')) {
      const tasks = await this.searchTasks(searchTerm, user, perTypeLimit);
      results.push(...tasks);
    }

    // Sort by relevance and limit
    return results
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit);
  }

  private async searchEvents(searchTerm: string, user: { id: string; role: UserRole; institutionId?: string | null }, limit: number): Promise<SearchResult[]> {
    const and: any[] = [];

    if (searchTerm) {
      and.push({
        OR: [
          { title: { contains: searchTerm, mode: 'insensitive' } },
          { description: { contains: searchTerm, mode: 'insensitive' } },
          { shortDescription: { contains: searchTerm, mode: 'insensitive' } },
          { tags: { hasSome: [searchTerm] } },
        ],
      });
    }

    if (user.role !== UserRole.ADMIN) {
      const visible: any[] = [
        { visibility: EventVisibility.PUBLIC },
        { creatorId: user.id },
      ];
      if (user.institutionId) visible.push({ institutionId: user.institutionId });
      and.push({ OR: visible });
    }

    const where: any = {
      status: EventStatus.PUBLISHED,
      ...(and.length ? { AND: and } : {}),
    };

    const events = await this.prisma.event.findMany({
      where,
      include: {
        creator: { select: userMinimalSelect },
        institution: true,
      },
      orderBy: { startDate: 'asc' },
      take: limit,
    });

    return events.map((event) => ({
      type: 'event' as const,
      id: event.id,
      title: event.title,
      description: event.shortDescription || event.description?.substring(0, 200),
      metadata: {
        category: event.category,
        startDate: event.startDate,
        endDate: event.endDate,
        location: event.location,
        city: event.city,
        country: event.country,
        institutionId: event.institutionId,
        coverImage: event.coverImage,
        bannerImage: event.bannerImage,
      },
      relevanceScore: this.calculateEventRelevance(event, searchTerm),
    }));
  }

  private async searchUsers(searchTerm: string, limit: number): Promise<SearchResult[]> {
    const users = await this.prisma.user.findMany({
      where: {
        OR: [
          { firstName: { contains: searchTerm, mode: 'insensitive' } },
          { lastName: { contains: searchTerm, mode: 'insensitive' } },
          { email: { contains: searchTerm, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        avatar: true,
        role: true,
        institutionId: true,
      },
      take: limit,
    });

    return users.map((user) => ({
      type: 'user' as const,
      id: user.id,
      title: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
      description: user.email,
      metadata: {
        role: user.role,
        avatar: user.avatar,
        institutionId: user.institutionId,
      },
      relevanceScore: 10,
    }));
  }

  private async searchBoards(searchTerm: string, user: { id: string; role: UserRole; institutionId?: string | null }, limit: number): Promise<SearchResult[]> {
    const where: any = {
      OR: [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { description: { contains: searchTerm, mode: 'insensitive' } },
      ],
    };

    if (user.role === UserRole.NORMAL_USER) {
      where.OR = [
        { isPublic: true },
        { ownerId: user.id },
        { members: { some: { id: user.id } } },
      ];
    } else if (user.role === UserRole.INSTITUTIONAL_USER) {
      where.OR = [
        { isPublic: true },
        { ownerId: user.id },
        { institutionId: user.institutionId },
        { members: { some: { id: user.id } } },
      ];
    }

    const boards = await this.prisma.board.findMany({
      where,
      include: {
        owner: { select: userMinimalSelect },
        institution: true,
        events: true,
      },
      take: limit,
    });

    return boards.map((board) => ({
      type: 'board' as const,
      id: board.id,
      title: board.name,
      description: board.description?.substring(0, 200),
      metadata: {
        color: board.color,
        icon: board.icon,
        isPublic: board.isPublic,
        institutionId: board.institutionId,
        eventCount: board.events?.length || 0,
      },
      relevanceScore: 10,
    }));
  }

  private async searchInstitutions(searchTerm: string, user: { id: string; role: UserRole; institutionId?: string | null }, limit: number): Promise<SearchResult[]> {
    const where: any = {
      isActive: true,
      OR: [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { description: { contains: searchTerm, mode: 'insensitive' } },
        { city: { contains: searchTerm, mode: 'insensitive' } },
      ],
    };

    if (user.role === UserRole.NORMAL_USER) {
      where.OR = [
        { ownerId: user.id },
        { admins: { some: { id: user.id } } },
      ];
    } else if (user.role === UserRole.INSTITUTIONAL_USER) {
      where.OR = [
        { id: user.institutionId },
        { ownerId: user.id },
        { admins: { some: { id: user.id } } },
      ];
    }

    const institutions = await this.prisma.institution.findMany({
      where,
      include: {
        owner: { select: userMinimalSelect },
      },
      take: limit,
    });

    return institutions.map((inst) => ({
      type: 'institution' as const,
      id: inst.id,
      title: inst.name,
      description: inst.description?.substring(0, 200),
      metadata: {
        logo: inst.logo,
        website: inst.website,
        city: inst.city,
        country: inst.country,
      },
      relevanceScore: 10,
    }));
  }

  private async searchGroups(searchTerm: string, user: { id: string; role: UserRole; institutionId?: string | null }, limit: number): Promise<SearchResult[]> {
    const where: any = {
      OR: [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { description: { contains: searchTerm, mode: 'insensitive' } },
      ],
    };

    if (user.role === UserRole.NORMAL_USER) {
      where.OR = [
        { isPrivate: false },
        { ownerId: user.id },
        { members: { some: { id: user.id } } },
      ];
    } else if (user.role === UserRole.INSTITUTIONAL_USER) {
      where.OR = [
        { isPrivate: false },
        { ownerId: user.id },
        { institutionId: user.institutionId },
        { members: { some: { id: user.id } } },
      ];
    }

    const groups = await this.prisma.group.findMany({
      where,
      include: {
        owner: { select: userMinimalSelect },
        institution: true,
        _count: { select: { members: true } },
      },
      take: limit,
    });

    return groups.map((group) => ({
      type: 'group' as const,
      id: group.id,
      title: group.name,
      description: group.description?.substring(0, 200),
      metadata: {
        avatar: group.avatar,
        isPrivate: group.isPrivate,
        institutionId: group.institutionId,
        memberCount: group._count?.members || 0,
      },
      relevanceScore: 10,
    }));
  }

  private async searchResources(searchTerm: string, user: { id: string; role: UserRole; institutionId?: string | null }, limit: number): Promise<SearchResult[]> {
    const where: any = {
      OR: [
        { title: { contains: searchTerm, mode: 'insensitive' } },
        { description: { contains: searchTerm, mode: 'insensitive' } },
        { tags: { hasSome: [searchTerm] } },
      ],
    };

    if (user.role === UserRole.NORMAL_USER) {
      where.OR = [
        { isPublic: true },
        { uploaderId: user.id },
        { institutionId: user.institutionId },
        { group: { members: { some: { id: user.id } } } },
      ];
    } else if (user.role === UserRole.INSTITUTIONAL_USER) {
      where.OR = [
        { isPublic: true },
        { uploaderId: user.id },
        { institutionId: user.institutionId },
        { group: { members: { some: { id: user.id } } } },
      ];
    }

    const resources = await this.prisma.resource.findMany({
      where,
      include: {
        uploader: { select: userMinimalSelect },
        event: true,
        group: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return resources.map((resource) => ({
      type: 'resource' as const,
      id: resource.id,
      title: resource.title,
      description: resource.description?.substring(0, 200),
      metadata: {
        type: resource.type,
        fileName: resource.fileName,
        fileUrl: resource.fileUrl,
        mimeType: resource.mimeType,
        fileSize: resource.fileSize,
        eventId: resource.eventId,
        boardId: resource.boardId,
      },
      relevanceScore: 10,
    }));
  }

  private async searchTasks(searchTerm: string, user: { id: string; role: UserRole; institutionId?: string | null }, limit: number): Promise<SearchResult[]> {
    const where: any = {
      OR: [
        { title: { contains: searchTerm, mode: 'insensitive' } },
        { description: { contains: searchTerm, mode: 'insensitive' } },
        { tags: { hasSome: [searchTerm] } },
      ],
    };

    if (user.role === UserRole.NORMAL_USER) {
      where.OR = [
        { assigneeId: user.id },
        { creatorId: user.id },
      ];
    } else if (user.role === UserRole.INSTITUTIONAL_USER) {
      where.OR = [
        { assigneeId: user.id },
        { creatorId: user.id },
        { event: { institutionId: user.institutionId } },
      ];
    }

    const tasks = await this.prisma.task.findMany({
      where,
      include: {
        assignee: { select: userMinimalSelect },
        creator: { select: userMinimalSelect },
        event: true,
      },
      orderBy: { dueDate: 'asc' },
      take: limit,
    });

    return tasks.map((task) => ({
      type: 'task' as const,
      id: task.id,
      title: task.title,
      description: task.description?.substring(0, 200),
      metadata: {
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate,
        eventId: task.eventId,
        boardId: task.boardId,
      },
      relevanceScore: 10,
    }));
  }

  private calculateEventRelevance(event: any, searchTerm: string): number {
    let score = 0;
    const term = searchTerm.toLowerCase();

    if (event.title.toLowerCase().includes(term)) score += 20;
    if (event.shortDescription?.toLowerCase().includes(term)) score += 10;
    if (event.description?.toLowerCase().includes(term)) score += 5;
    if (event.tags?.some((tag: string) => tag.toLowerCase().includes(term))) score += 15;
    if (event.category.toLowerCase().includes(term)) score += 10;
    if (event.location?.toLowerCase().includes(term)) score += 10;
    if (event.city?.toLowerCase().includes(term)) score += 8;
    if (event.country?.toLowerCase().includes(term)) score += 5;

    return score;
  }
}