import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { GroupsService } from './groups.service';
import { PrismaService } from '../prisma/prisma.service';

describe('GroupsService', () => {
  it('allows owners and admins to remove members, but blocks regular members', async () => {
    const prisma = {
      group: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'group-1',
          ownerId: 'owner-1',
          isPrivate: false,
          isBanned: false,
          institutionId: null,
          members: [{ id: 'owner-1' }, { id: 'member-1' }],
          admins: [{ id: 'owner-1' }, { id: 'admin-1' }],
          pendingRequests: [],
        }),
        update: jest.fn().mockResolvedValue({ id: 'group-1' }),
      },
    } as unknown as PrismaService;

    const service = new GroupsService(prisma);

    await expect(service.removeMember('group-1', 'member-1', { id: 'admin-1', role: UserRole.NORMAL_USER, institutionId: null })).resolves.toBeTruthy();
    await expect(service.removeMember('group-1', 'member-1', { id: 'member-2', role: UserRole.NORMAL_USER, institutionId: null })).rejects.toThrow(ForbiddenException);
    await expect(service.removeMember('group-1', 'owner-1', { id: 'admin-1', role: UserRole.NORMAL_USER, institutionId: null })).rejects.toThrow('The group owner cannot be removed');
  });

  it('throws a not found error when trying to remove a non-member', async () => {
    const prisma = {
      group: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'group-2',
          ownerId: 'owner-2',
          isPrivate: false,
          isBanned: false,
          institutionId: null,
          members: [{ id: 'owner-2' }],
          admins: [{ id: 'owner-2' }],
          pendingRequests: [],
        }),
      },
    } as unknown as PrismaService;

    const service = new GroupsService(prisma);

    await expect(service.removeMember('group-2', 'ghost-1', { id: 'owner-2', role: UserRole.NORMAL_USER, institutionId: null })).rejects.toThrow(NotFoundException);
  });
});
