import { Injectable, NotFoundException } from '@nestjs/common';
import { InvitationStatus, InvitationType, type Invitation } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';

export type InvitationRecord = Invitation;

@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private slugify(value: string) {
    return String(value || 'evento')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'evento';
  }

  private displayName(user?: { firstName?: string | null; lastName?: string | null; nickname?: string | null } | null) {
    if (!user) return 'Alguien';
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ');
    return fullName || user.nickname || 'Alguien';
  }

  async findForUser(userId: string) {
    return this.prisma.invitation.findMany({
      where: { targetUserId: userId, status: InvitationStatus.PENDING },
      include: {
        sender: {
          select: { id: true, firstName: true, lastName: true, nickname: true, email: true, avatar: true },
        },
        target: {
          select: { id: true, firstName: true, lastName: true, nickname: true, email: true, avatar: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findPendingRequests(userId: string) {
    return this.prisma.invitation.findMany({
      where: { targetUserId: userId, status: InvitationStatus.PENDING },
      include: {
        sender: {
          select: { id: true, firstName: true, lastName: true, nickname: true, email: true, avatar: true },
        },
        target: {
          select: { id: true, firstName: true, lastName: true, nickname: true, email: true, avatar: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(input: CreateInvitationDto) {
    const sender = await this.prisma.user.findUnique({
      where: { id: input.userId },
      select: { firstName: true, lastName: true, nickname: true },
    });

    const invite = await this.prisma.invitation.create({
      data: {
        userId: input.userId,
        targetUserId: input.targetUserId,
        type: String(input.type).toUpperCase() as InvitationType,
        entityId: input.entityId,
        message: input.message,
        status: InvitationStatus.PENDING,
      },
    });

    const senderName = this.displayName(sender);
    const invitationTypeLabel = String(input.type).toLowerCase();
    const targetLink = input.entityId
      ? `/${invitationTypeLabel === 'event' ? 'events' : invitationTypeLabel === 'group' ? 'groups' : 'invitations'}/${encodeURIComponent(input.entityId)}`
      : undefined;

    await this.notificationsService.create({
      userId: input.targetUserId,
      title: `Invitación de ${senderName}`,
      text: `${senderName} te ha enviado una invitación${input.message ? `: ${input.message}` : ' para unirte.'}`,
      type: invitationTypeLabel,
      link: targetLink,
    });

    return invite;
  }

  async acceptRequest(id: string, userId: string) {
    return this.respond(id, userId, InvitationStatus.ACCEPTED);
  }

  async rejectRequest(id: string, userId: string) {
    return this.respond(id, userId, InvitationStatus.REJECTED);
  }

  async respond(id: string, userId: string, status: InvitationStatus | 'accepted' | 'rejected') {
    const invitation = await this.prisma.invitation.findFirst({
      where: { id, targetUserId: userId },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found.');
    }

    const normalizedStatus = String(status).toUpperCase() as InvitationStatus;

    const updatedInvitation = await this.prisma.invitation.update({
      where: { id },
      data: { status: normalizedStatus },
    });

    if (normalizedStatus === InvitationStatus.ACCEPTED && updatedInvitation.entityId) {
      if (updatedInvitation.type === InvitationType.EVENT) {
        const event = await this.prisma.event.findUnique({
          where: { id: updatedInvitation.entityId },
          include: { attendees: true, creator: true },
        });

        if (event && !event.attendees.some((attendee) => attendee.id === userId)) {
          await this.prisma.event.update({
            where: { id: event.id },
            data: {
              attendees: { connect: { id: userId } },
              currentAttendees: { increment: 1 },
            },
            include: { attendees: true, creator: true },
          });
        }

        const guestUser = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { firstName: true, lastName: true, nickname: true },
        });

        const hostUser = await this.prisma.user.findUnique({
          where: { id: invitation.userId },
          select: { firstName: true, lastName: true, nickname: true },
        });

        const guestName = this.displayName(guestUser);
        const hostName = this.displayName(hostUser);

        await this.notificationsService.create({
          userId: invitation.userId,
          title: 'Invitación aceptada',
          text: `${guestName} aceptó tu invitación al evento "${event?.title ?? 'Evento'}".`,
          type: 'event',
          link: `/events/${this.slugify(event?.title ?? 'evento')}?id=${encodeURIComponent(updatedInvitation.entityId)}`,
        });

        await this.notificationsService.create({
          userId,
          title: 'Invitación confirmada',
          text: `Aceptaste la invitación de ${hostName} para el evento "${event?.title ?? 'Evento'}".`,
          type: 'event',
          link: `/events/${this.slugify(event?.title ?? 'evento')}?id=${encodeURIComponent(updatedInvitation.entityId)}`,
        });
      }

      if (updatedInvitation.type === InvitationType.GROUP) {
        const group = await this.prisma.group.findUnique({
          where: { id: updatedInvitation.entityId },
          include: { members: true, pendingRequests: true },
        });

        if (group && !group.members.some((member) => member.id === userId)) {
          await this.prisma.group.update({
            where: { id: group.id },
            data: { members: { connect: { id: userId } } },
            include: { members: true, pendingRequests: true },
          });
        }

        const inviter = await this.prisma.user.findUnique({
          where: { id: invitation.userId },
          select: { firstName: true, lastName: true, nickname: true },
        });

        const invitee = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { firstName: true, lastName: true, nickname: true },
        });

        const inviterName = this.displayName(inviter);
        const inviteeName = this.displayName(invitee);

        await this.notificationsService.create({
          userId: invitation.userId,
          title: 'Invitación aceptada',
          text: `${inviteeName} aceptó tu invitación para unirse al grupo "${group?.name ?? 'Grupo'}".`,
          type: 'group',
          link: group ? `/groups/${encodeURIComponent(group.id)}` : undefined,
        });

        await this.notificationsService.create({
          userId,
          title: 'Invitación confirmada',
          text: `Aceptaste la invitación de ${inviterName} para unirte al grupo "${group?.name ?? 'Grupo'}".`,
          type: 'group',
          link: group ? `/groups/${encodeURIComponent(group.id)}` : undefined,
        });
      }
    }

    if (normalizedStatus === InvitationStatus.REJECTED) {
      const sender = await this.prisma.user.findUnique({
        where: { id: invitation.userId },
        select: { firstName: true, lastName: true, nickname: true },
      });

      const target = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { firstName: true, lastName: true, nickname: true },
      });

      await this.notificationsService.create({
        userId: invitation.userId,
        title: 'Invitación rechazada',
        text: `${this.displayName(target)} rechazó tu invitación.`,
        type: updatedInvitation.type.toLowerCase(),
      });

      await this.notificationsService.create({
        userId,
        title: 'Invitación rechazada',
        text: `Rechazaste la invitación de ${this.displayName(sender)}.`,
        type: updatedInvitation.type.toLowerCase(),
      });
    }

    return updatedInvitation;
  }

  async remove(id: string, userId: string) {
    const invitation = await this.prisma.invitation.findFirst({
      where: { id, targetUserId: userId },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found.');
    }

    return this.prisma.invitation.delete({ where: { id } });
  }
}
