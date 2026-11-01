import { InvitationsService } from './invitations.service';

describe('InvitationsService', () => {
  it('accepts an event invitation by adding the user as attendee and notifying both sides', async () => {
    const prisma = {
      event: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'evt-1',
          title: 'Meetup de prueba',
          creatorId: 'lucas',
          currentAttendees: 2,
          attendees: [{ id: 'ana' }],
        }),
        update: jest.fn().mockResolvedValue({
          id: 'evt-1',
          title: 'Meetup de prueba',
          attendees: [{ id: 'ana' }, { id: 'clau' }],
        }),
      },
      user: {
        findUnique: jest.fn().mockImplementation(({ where }: any) => {
          if (where.id === 'lucas') {
            return Promise.resolve({ firstName: 'Lucas', lastName: 'Pérez', nickname: 'lucas' });
          }
          return Promise.resolve({ firstName: 'Clau', lastName: 'García', nickname: 'clau' });
        }),
      },
    };

    const notificationsService = {
      create: jest.fn(),
    };

    const service = new InvitationsService(prisma as any, notificationsService as any);
    const invitation = {
      id: 'inv-1',
      userId: 'lucas',
      targetUserId: 'clau',
      type: 'event' as const,
      entityId: 'evt-1',
      message: 'Te invitamos',
      status: 'pending' as const,
      createdAt: new Date().toISOString(),
    };

    const privateInvitations = (service as any).invitations;
    privateInvitations.push(invitation);

    const result = await service.respond('inv-1', 'clau', 'accepted');

    expect(prisma.event.findUnique).toHaveBeenCalledWith({
      where: { id: 'evt-1' },
      include: { attendees: true, creator: true },
    });
    expect(prisma.event.update).toHaveBeenCalledWith({
      where: { id: 'evt-1' },
      data: {
        attendees: { connect: { id: 'clau' } },
        currentAttendees: { increment: 1 },
      },
      include: { attendees: true, creator: true },
    });
    expect(notificationsService.create).toHaveBeenCalledTimes(2);
    expect(result.status).toBe('accepted');
  });
});
