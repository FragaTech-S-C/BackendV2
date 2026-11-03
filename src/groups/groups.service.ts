import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { UserRole } from '@prisma/client';
import { userMinimalSelect } from '../common/prisma/selects';

@Injectable()
export class GroupsService {
  constructor(private prisma: PrismaService) {}

  async create(createGroupDto: CreateGroupDto, userId: string, userRole: UserRole, userInstitutionId?: string) {
    const { type, leader, members: selectedMembers, ...groupData } = Object.fromEntries(
      Object.entries(createGroupDto ?? {}).filter(([, value]) => value !== undefined && value !== null),
    ) as Record<string, any>;

    const institutionId = userRole === UserRole.INSTITUTIONAL_USER ? userInstitutionId : createGroupDto.institutionId;
    if (institutionId) {
      const institution = await this.prisma.institution.findUnique({
        where: { id: institutionId },
        select: { id: true },
      });

      if (!institution) {
        throw new BadRequestException('Selected institution does not exist');
      }
    }

    const groupPayload: any = {
      ...groupData,
      ownerId: userId,
      institutionId: userRole === UserRole.INSTITUTIONAL_USER ? userInstitutionId : createGroupDto.institutionId,
      members: { connect: [{ id: userId }] },
      admins: { connect: [{ id: userId }] },
    };

    return this.prisma.group.create({
      data: groupPayload,
      include: {
        owner: { select: userMinimalSelect },
        institution: true,
        members: { select: userMinimalSelect },
        admins: { select: userMinimalSelect },
        pendingRequests: { select: userMinimalSelect },
        events: true,
        messages: { include: { sender: { select: userMinimalSelect } } },
        image: true,
      },
    });
  }

  async findAll(user: { id: string; role: UserRole; institutionId?: string | null }) {
    const where: any = { isBanned: false };

    if (user.role === UserRole.NORMAL_USER) {
      where.OR = [
        { isPrivate: false },
        { ownerId: user.id },
        { members: { some: { id: user.id } } },
        { admins: { some: { id: user.id } } },
      ];
    } else if (user.role === UserRole.INSTITUTIONAL_USER) {
      where.OR = [
        { isPrivate: false },
        { ownerId: user.id },
        { institutionId: user.institutionId },
        { members: { some: { id: user.id } } },
        { admins: { some: { id: user.id } } },
      ];
    }

    return this.prisma.group.findMany({
      where,
      include: {
        owner: { select: userMinimalSelect },
        institution: true,
        members: { select: userMinimalSelect },
        admins: { select: userMinimalSelect },
        pendingRequests: { select: userMinimalSelect },
        _count: { select: { members: true, events: true, messages: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string, user: { id: string; role: UserRole; institutionId?: string | null }) {
    const group = await this.prisma.group.findUnique({
      where: { id },
      include: {
        owner: { select: userMinimalSelect },
        institution: true,
        members: { select: userMinimalSelect },
        admins: { select: userMinimalSelect },
        pendingRequests: { select: userMinimalSelect },
        events: true,
        messages: { include: { sender: { select: userMinimalSelect } } },
        image: true,
      },
    });

    if (!group) {
      throw new NotFoundException(`Group with ID ${id} not found`);
    }

    if (!this.canViewGroup(group, user)) {
      throw new ForbiddenException('You do not have permission to view this group');
    }

    return group;
  }

  async update(id: string, updateGroupDto: UpdateGroupDto, user: { id: string; role: UserRole; institutionId?: string | null }) {
    const group = await this.findById(id, user);

    if (!this.canModifyGroup(group, user)) {
      throw new ForbiddenException('You do not have permission to modify this group');
    }

    const { type, leader, members: selectedMembers, ...groupData } = Object.fromEntries(
      Object.entries(updateGroupDto ?? {}).filter(([, value]) => value !== undefined && value !== null),
    ) as Record<string, any>;

    const updatePayload: any = { ...groupData };

    return this.prisma.group.update({
      where: { id },
      data: updatePayload,
      include: { owner: true, institution: true, members: true, admins: true },
    });
  }

  async remove(id: string, user: { id: string; role: UserRole; institutionId?: string | null }) {
    const group = await this.findById(id, user);

    if (!this.canModifyGroup(group, user)) {
      throw new ForbiddenException('You do not have permission to delete this group');
    }

    return this.prisma.group.delete({ where: { id } });
  }

  async banGroup(id: string, user: { id: string; role: UserRole; institutionId?: string | null }) {
    const group = await this.prisma.group.findUnique({ where: { id } });
    if (!group) {
      throw new NotFoundException(`Group with ID ${id} not found`);
    }
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only administrators can ban groups');
    }

    return this.prisma.group.update({
      where: { id },
      data: { isBanned: true },
      include: { owner: { select: userMinimalSelect } },
    });
  }

  async unbanGroup(id: string, user: { id: string; role: UserRole; institutionId?: string | null }) {
    const group = await this.prisma.group.findUnique({ where: { id } });
    if (!group) {
      throw new NotFoundException(`Group with ID ${id} not found`);
    }
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only administrators can unban groups');
    }

    return this.prisma.group.update({
      where: { id },
      data: { isBanned: false },
      include: { owner: { select: userMinimalSelect } },
    });
  }

  async joinGroup(groupId: string, userId: string) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: { members: true, pendingRequests: true },
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    if (group.members.some((m) => m.id === userId)) {
      throw new ForbiddenException('You are already a member of this group');
    }

    if (group.pendingRequests.some((r) => r.id === userId)) {
      throw new ForbiddenException('You already have a pending request');
    }

    if (group.isPrivate && group.requiresApproval) {
      return this.prisma.group.update({
        where: { id: groupId },
        data: { pendingRequests: { connect: { id: userId } } },
        include: { pendingRequests: true },
      });
    } else {
      return this.prisma.group.update({
        where: { id: groupId },
        data: { members: { connect: { id: userId } } },
        include: { members: true },
      });
    }
  }

  async leaveGroup(groupId: string, userId: string) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: { members: true, admins: true, pendingRequests: true },
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    if (!group.members.some((m) => m.id === userId)) {
      throw new ForbiddenException('You are not a member of this group');
    }

    if (group.ownerId === userId) {
      throw new ForbiddenException('Owner cannot leave the group. Transfer ownership first.');
    }

    return this.prisma.group.update({
      where: { id: groupId },
      data: {
        members: { disconnect: { id: userId } },
        admins: { disconnect: { id: userId } },
        pendingRequests: { disconnect: { id: userId } },
      },
      include: { members: true, admins: true },
    });
  }

  async approveRequest(groupId: string, userId: string, user: { id: string; role: UserRole; institutionId?: string | null }) {
    const group = await this.findById(groupId, user);

    if (!this.canManageMembers(group, user)) {
      throw new ForbiddenException('You do not have permission to approve requests');
    }

    if (!group.pendingRequests.some((r) => r.id === userId)) {
      throw new NotFoundException('No pending request from this user');
    }

    return this.prisma.group.update({
      where: { id: groupId },
      data: {
        pendingRequests: { disconnect: { id: userId } },
        members: { connect: { id: userId } },
      },
      include: { members: true, pendingRequests: true },
    });
  }

  async rejectRequest(groupId: string, userId: string, user: { id: string; role: UserRole; institutionId?: string | null }) {
    const group = await this.findById(groupId, user);

    if (!this.canManageMembers(group, user)) {
      throw new ForbiddenException('You do not have permission to reject requests');
    }

    return this.prisma.group.update({
      where: { id: groupId },
      data: { pendingRequests: { disconnect: { id: userId } } },
      include: { pendingRequests: true },
    });
  }

  async addAdmin(groupId: string, userId: string, user: { id: string; role: UserRole; institutionId?: string | null }) {
    const group = await this.findById(groupId, user);

    if (!this.canModifyGroup(group, user)) {
      throw new ForbiddenException('You do not have permission to add admins');
    }

    if (!group.members.some((m) => m.id === userId)) {
      throw new ForbiddenException('User must be a member to become admin');
    }

    if (group.admins.some((a) => a.id === userId)) {
      return group;
    }

    return this.prisma.group.update({
      where: { id: groupId },
      data: { admins: { connect: { id: userId } } },
      include: { admins: true },
    });
  }

  async removeAdmin(groupId: string, userId: string, user: { id: string; role: UserRole; institutionId?: string | null }) {
    const group = await this.findById(groupId, user);

    if (!this.canModifyGroup(group, user)) {
      throw new ForbiddenException('You do not have permission to remove admins');
    }

    if (group.ownerId === userId) {
      throw new ForbiddenException('Cannot remove group owner');
    }

    return this.prisma.group.update({
      where: { id: groupId },
      data: { admins: { disconnect: { id: userId } } },
      include: { admins: true },
    });
  }

  async addMember(groupId: string, userId: string, user: { id: string; role: UserRole; institutionId?: string | null }) {
    const group = await this.findById(groupId, user);

    if (!this.canManageMembers(group, user)) {
      throw new ForbiddenException('Only the group owner or admins can add members.');
    }

    if (group.members.some((member: any) => member.id === userId)) {
      return group;
    }

    return this.prisma.group.update({
      where: { id: groupId },
      data: { members: { connect: { id: userId } } },
      include: {
        owner: { select: userMinimalSelect },
        members: { select: userMinimalSelect },
        admins: { select: userMinimalSelect },
      },
    });
  }

  async removeMember(groupId: string, userId: string, user: { id: string; role: UserRole; institutionId?: string | null }) {
    const group = await this.findById(groupId, user);

    if (!this.canManageMembers(group, user)) {
      throw new ForbiddenException('Only the group owner or admins can remove members.');
    }

    if (group.ownerId === userId) {
      throw new ForbiddenException('The group owner cannot be removed from the group. Transfer ownership first.');
    }

    if (!group.members.some((member: any) => member.id === userId)) {
      throw new NotFoundException('User is not a member of this group');
    }

    return this.prisma.group.update({
      where: { id: groupId },
      data: {
        members: { disconnect: { id: userId } },
        admins: { disconnect: { id: userId } },
        pendingRequests: { disconnect: { id: userId } },
      },
      include: {
        owner: { select: userMinimalSelect },
        members: { select: userMinimalSelect },
        admins: { select: userMinimalSelect },
      },
    });
  }

  private canViewGroup(group: any, user: { id: string; role: UserRole; institutionId?: string | null }): boolean {
    if (user.role === UserRole.ADMIN) return true;
    if (group.ownerId === user.id) return true;
    if (!group.isPrivate) return true;
    if (group.members.some((m: any) => m.id === user.id)) return true;
    if (group.admins.some((a: any) => a.id === user.id)) return true;
    if (user.role === UserRole.INSTITUTIONAL_USER && group.institutionId === user.institutionId) return true;
    return false;
  }

  private canModifyGroup(group: any, user: { id: string; role: UserRole; institutionId?: string | null }): boolean {
    if (user.role === UserRole.ADMIN) return true;
    if (group.ownerId === user.id) return true;
    if (user.role === UserRole.INSTITUTIONAL_USER && group.institutionId === user.institutionId) return true;
    return false;
  }

  private canManageMembers(group: any, user: { id: string; role: UserRole; institutionId?: string | null }): boolean {
    if (user.role === UserRole.ADMIN) return true;
    if (group.ownerId === user.id) return true;
    if (group.admins.some((a: any) => a.id === user.id)) return true;
    return false;
  }
}