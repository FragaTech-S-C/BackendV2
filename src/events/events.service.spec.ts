import { ForbiddenException } from '@nestjs/common';
import { EventStatus, EventVisibility, UserRole } from '@prisma/client';
import { EventsService } from './events.service';
import { PrismaService } from '../prisma/prisma.service';

describe('EventsService', () => {
  it('publishes new events by default so they appear in the frontend panels', async () => {
    const prisma = {
      event: {
        create: jest.fn().mockResolvedValue({ id: 'evt_123' }),
      },
    } as unknown as PrismaService;

    const service = new EventsService(prisma);

    await service.create(
      {
        title: 'Demo event',
        startDate: '2026-10-08T18:00:00.000Z',
        endDate: '2026-10-08T20:00:00.000Z',
        tags: ['tech'],
      } as any,
      'user_123',
    );

    expect(prisma.event.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: 'Demo event',
          creatorId: 'user_123',
          status: EventStatus.PUBLISHED,
          tags: ['tech'],
          currentAttendees: 1,
          attendees: { connect: [{ id: 'user_123' }] },
        }),
      }),
    );
  });

  it('geocodes a textual event address into OSM coordinates when creating an event', async () => {
    const prisma = {
      event: {
        create: jest.fn().mockResolvedValue({ id: 'evt_geo' }),
      },
    } as unknown as PrismaService;

    const fetchMock = jest.spyOn(globalThis, 'fetch' as any).mockResolvedValue({
      ok: true,
      json: async () => [{ lat: '-34.6037', lon: '-58.3816' }],
    } as any);

    const service = new EventsService(prisma);

    await service.create({
      title: 'Geocoding test',
      startDate: '2026-10-08T18:00:00.000Z',
      endDate: '2026-10-08T20:00:00.000Z',
      location: 'Roque Sáenz Peña & Int. Arricau - Prov. Buenos Aires',
      city: 'Buenos Aires',
      country: 'Argentina',
    } as any, 'user_123');

    expect(prisma.event.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          latitude: -34.6037,
          longitude: -58.3816,
        }),
      }),
    );

    fetchMock.mockRestore();
  });

  it('filters private events from non-members in the dashboard event list', async () => {
    const prisma = {
      event: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    } as unknown as PrismaService;

    const service = new EventsService(prisma);

    await service.findAll({}, { id: 'viewer-1', role: UserRole.NORMAL_USER, institutionId: null });

    expect(prisma.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { visibility: EventVisibility.PUBLIC },
            { creatorId: 'viewer-1' },
            { attendees: { some: { id: 'viewer-1' } } },
          ]),
        }),
      }),
    );
  });

  it('allows invited attendees to view a private event detail', async () => {
    const prisma = {
      event: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'evt-2',
          creatorId: 'host-1',
          visibility: EventVisibility.PRIVATE,
          institutionId: null,
          groupId: null,
          attendees: [{ id: 'viewer-1' }],
          group: null,
        }),
      },
    } as unknown as PrismaService;

    const service = new EventsService(prisma);

    await expect(service.findById('evt-2', { id: 'viewer-1', role: UserRole.NORMAL_USER, institutionId: null })).resolves.toMatchObject({
      id: 'evt-2',
      visibility: EventVisibility.PRIVATE,
    });
  });

  it('invites every member in a selected group to the event in one action', async () => {
    const prisma = {
      event: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'evt-group',
          creatorId: 'host-1',
          groupId: 'group-1',
          currentAttendees: 1,
          maxAttendees: 0,
          attendees: [{ id: 'host-1' }],
          group: { members: [{ id: 'host-1' }, { id: 'claudio' }, { id: 'maria' }] },
        }),
        update: jest.fn().mockResolvedValue({ id: 'evt-group' }),
      },
      group: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'group-1',
          members: [{ id: 'claudio' }, { id: 'maria' }],
        }),
      },
    } as unknown as PrismaService;

    const service = new EventsService(prisma);

    await service.inviteUserToEvent('evt-group', { id: 'host-1', role: UserRole.NORMAL_USER, institutionId: null }, { groupId: 'group-1' });

    expect(prisma.event.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'evt-group' },
        data: expect.objectContaining({
          currentAttendees: { increment: 2 },
        }),
      }),
    );
  });

  it('prevents a regular group member from inviting the event host when the host is already part of the event', async () => {
    const prisma = {
      event: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'evt-host',
          creatorId: 'claudio',
          groupId: 'group-1',
          currentAttendees: 1,
          maxAttendees: 0,
          attendees: [{ id: 'claudio' }],
          group: {
            ownerId: 'owner-1',
            members: [{ id: 'lucas' }, { id: 'claudio' }],
            admins: [{ id: 'owner-1' }],
          },
        }),
      },
    } as unknown as PrismaService;

    const service = new EventsService(prisma);

    await expect(
      service.inviteUserToEvent('evt-host', { id: 'lucas', role: UserRole.NORMAL_USER, institutionId: null }, { userId: 'claudio' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('loads creator and attendees when fetching an event detail for the host', async () => {
    const prisma = {
      event: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'evt-1',
          creatorId: 'host-1',
          visibility: EventVisibility.PRIVATE,
          attendees: [{ id: 'guest-1' }],
          group: { members: [{ id: 'host-1' }] },
        }),
      },
    } as unknown as PrismaService;

    const service = new EventsService(prisma);

    await service.findById('evt-1', { id: 'host-1', role: UserRole.NORMAL_USER, institutionId: null });

    expect(prisma.event.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'evt-1' },
        include: expect.objectContaining({
          creator: expect.any(Object),
          attendees: expect.any(Object),
          group: expect.any(Object),
        }),
      }),
    );
  });
});
