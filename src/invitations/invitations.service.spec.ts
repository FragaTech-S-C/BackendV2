import { InvitationsService } from './invitations.service';

describe('InvitationsService', () => {
  it('sends the invitation notification to the invited user and accepts a group invite by adding them to the group', async () => {
    const prisma = {
      invitation: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({
          id: 'inv-group-1',
          userId: 'host-1',
          targetUserId: 'marco',
          type: 'GROUP',
          entityId: 'group-1',
          message: 'Queres unirte al grupo?',
          status: 'PENDING',
          createdAt: new Date(),
        }),
        findFirst: jest.fn().mockResolvedValue({
          id: 'inv-group-1',
          userId: 'host-1',
          targetUserId: 'marco',
          type: 'GROUP',
          entityId: 'group-1',
          message: 'Queres unirte al grupo?',
          status: 'PENDING',
          createdAt: new Date(),
        }),
        update: jest.fn().mockResolvedValue({
          id: 'inv-group-1',
          userId: 'host-1',
          targetUserId: 'marco',
          type: 'GROUP',
          entityId: 'group-1',
          message: 'Queres unirte al grupo?',
          status: 'ACCEPTED',
          createdAt: new Date(),
        }),
      },
      user: {
        findFirst: jest.fn().mockResolvedValue({ nickname: 'Host' }),
        findUnique: jest.fn().mockImplementation(({ where }: any) => {
          if (where.id === 'host-1') return Promise.resolve({ firstName: 'Host', lastName: 'User', nickname: 'Host' });
          return Promise.resolve({ firstName: 'Marco', lastName: 'Pérez', nickname: 'marco' });
        }),
      },
      group: {
        findUnique: jest.fn().mockResolvedValue({ id: 'group-1', name: 'Equipo', members: [], pendingRequests: [] }),
        update: jest.fn().mockResolvedValue({ id: 'group-1', members: [{ id: 'marco' }] }),
      },
    };

    const notificationsService = { create: jest.fn() };
    const service = new InvitationsService(prisma as any, notificationsService as any);

    await service.create({
      userId: 'host-1',
      targetUserId: 'marco',
      type: 'group',
      entityId: 'group-1',
      message: 'Queres unirte al grupo?',
    });

    expect(notificationsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'marco',
        title: expect.stringContaining('Invitación'),
      }),
    );

    const result = await service.respond('inv-group-1', 'marco', 'accepted');

    expect(prisma.group.findUnique).toHaveBeenCalledWith({
      where: { id: 'group-1' },
      include: { members: true, pendingRequests: true },
    });
    expect(prisma.group.update).toHaveBeenCalledWith({
      where: { id: 'group-1' },
      data: { members: { connect: { id: 'marco' } } },
      include: { members: true, pendingRequests: true },
    });
    expect(result.status).toBe('ACCEPTED');
  });

  it('stores invitations in the database and accepts an event invite by updating the attendee list', async () => {
    const prisma = {
      invitation: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({
          id: 'inv-1',
          userId: 'lucas',
          targetUserId: 'clau',
          type: 'EVENT',
          entityId: 'evt-1',
          message: 'Te invitamos',
          status: 'PENDING',
          createdAt: new Date(),
        }),
        findFirst: jest.fn().mockResolvedValue({
          id: 'inv-1',
          userId: 'lucas',
          targetUserId: 'clau',
          type: 'EVENT',
          entityId: 'evt-1',
          message: 'Te invitamos',
          status: 'PENDING',
          createdAt: new Date(),
        }),
        update: jest.fn().mockResolvedValue({
          id: 'inv-1',
          userId: 'lucas',
          targetUserId: 'clau',
          type: 'EVENT',
          entityId: 'evt-1',
          message: 'Te invitamos',
          status: 'ACCEPTED',
          createdAt: new Date(),
        }),
      },
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

    const created = await service.create({
      userId: 'lucas',
      targetUserId: 'clau',
      type: 'event',
      entityId: 'evt-1',
      message: 'Te invitamos',
    });

    expect(prisma.invitation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'lucas',
        targetUserId: 'clau',
        type: 'EVENT',
        entityId: 'evt-1',
        status: 'PENDING',
      }),
    });

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
    expect(prisma.invitation.update).toHaveBeenCalledWith({
      where: { id: 'inv-1' },
      data: { status: 'ACCEPTED' },
    });
    expect(notificationsService.create).toHaveBeenCalledTimes(3);
    expect(created).toBeTruthy();
    expect(result.status).toBe('ACCEPTED');
  });
});
