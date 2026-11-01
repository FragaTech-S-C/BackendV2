import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

export type InvitationStatus = 'pending' | 'accepted' | 'rejected';

export type InvitationRecord = {
  id: string;
  userId: string;
  targetUserId: string;
  type: 'group' | 'event' | 'friend';
  entityId?: string;
  message?: string;
  status: InvitationStatus;
  createdAt: string;
};

@Injectable()
export class InvitationsService {
  private readonly invitations: InvitationRecord[] = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private generateId() {
    return `inv-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  }

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

  findForUser(userId: string) {
    return this.invitations.filter((invite) => invite.targetUserId === userId);
  }

  create(input: {
    userId: string;
    targetUserId: string;
    type: 'group' | 'event' | 'friend';
    entityId?: string;
    message?: string;
  }) {
    const record: InvitationRecord = {
      id: this.generateId(),
      userId: input.userId,
      targetUserId: input.targetUserId,
      type: input.type,
      entityId: input.entityId,
      message: input.message,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    this.invitations.push(record);
    return record;
  }

  async respond(id: string, userId: string, status: 'accepted' | 'rejected') {
    const invitation = this.invitations.find(
      (item) => item.id === id && item.targetUserId === userId,
    );

    if (!invitation) {
      throw new NotFoundException('Invitation not found.');
    }

    invitation.status = status;

    if (status === 'accepted' && invitation.type === 'event' && invitation.entityId) {
      const event = await this.prisma.event.findUnique({
        where: { id: invitation.entityId },
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
        link: `/events/${this.slugify(event?.title ?? 'evento')}?id=${encodeURIComponent(invitation.entityId)}`,
      });

      await this.notificationsService.create({
        userId,
        title: 'Invitación confirmada',
        text: `Aceptaste la invitación de ${hostName} para el evento "${event?.title ?? 'Evento'}".`,
        type: 'event',
        link: `/events/${this.slugify(event?.title ?? 'evento')}?id=${encodeURIComponent(invitation.entityId)}`,
      });
    }

    return invitation;
  }

  remove(id: string, userId: string) {
    const index = this.invitations.findIndex(
      (invite) => invite.id === id && invite.targetUserId === userId,
    );

    if (index < 0) {
      throw new NotFoundException('Invitation not found.');
    }

    const [removed] = this.invitations.splice(index, 1);
    return removed;
  }
}
