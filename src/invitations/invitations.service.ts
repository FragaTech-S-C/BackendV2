import { Injectable, NotFoundException } from '@nestjs/common';

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

  private generateId() {
    return `inv-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
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

  respond(id: string, userId: string, status: 'accepted' | 'rejected') {
    const invitation = this.invitations.find(
      (item) => item.id === id && item.targetUserId === userId,
    );

    if (!invitation) {
      throw new NotFoundException('Invitation not found.');
    }

    invitation.status = status;
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
