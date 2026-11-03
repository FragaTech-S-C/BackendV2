import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { GroupsService } from './groups.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

interface CurrentUserInfo {
  id: string;
  role: UserRole;
  institutionId?: string | null;
}

@ApiTags('groups')
@Controller('groups')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new group' })
  @ApiResponse({ status: 201, description: 'Group created successfully' })
  async create(@Body() createGroupDto: CreateGroupDto, @CurrentUser() user: CurrentUserInfo) {
    return this.groupsService.create(createGroupDto, user.id, user.role, user.institutionId ?? undefined);
  }

  @Get()
  @ApiOperation({ summary: 'Get all groups' })
  @ApiResponse({ status: 200, description: 'List of groups' })
  async findAll(@CurrentUser() user: CurrentUserInfo) {
    return this.groupsService.findAll(user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get group by ID' })
  @ApiResponse({ status: 200, description: 'Group found' })
  @ApiResponse({ status: 404, description: 'Group not found' })
  async findById(@Param('id') id: string, @CurrentUser() user: CurrentUserInfo) {
    return this.groupsService.findById(id, user);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update group' })
  @ApiResponse({ status: 200, description: 'Group updated' })
  async update(@Param('id') id: string, @Body() updateGroupDto: UpdateGroupDto, @CurrentUser() user: CurrentUserInfo) {
    return this.groupsService.update(id, updateGroupDto, user);
  }

  @Post(':id/join')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Join a group' })
  @ApiResponse({ status: 200, description: 'Joined group or request sent' })
  async join(@Param('id') id: string, @CurrentUser() user: CurrentUserInfo) {
    return this.groupsService.joinGroup(id, user.id);
  }

  @Post(':id/leave')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Leave a group' })
  @ApiResponse({ status: 200, description: 'Left group' })
  async leave(@Param('id') id: string, @CurrentUser() user: CurrentUserInfo) {
    return this.groupsService.leaveGroup(id, user.id);
  }

  @Delete(':id/members/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a member from a group' })
  @ApiResponse({ status: 200, description: 'Member removed successfully' })
  async removeMember(@Param('id') groupId: string, @Param('userId') userId: string, @CurrentUser() user: CurrentUserInfo) {
    return this.groupsService.removeMember(groupId, userId, user);
  }

  @Post(':id/approve/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve join request' })
  @ApiResponse({ status: 200, description: 'Request approved' })
  async approve(@Param('id') groupId: string, @Param('userId') userId: string, @CurrentUser() user: CurrentUserInfo) {
    return this.groupsService.approveRequest(groupId, userId, user);
  }

  @Post(':id/reject/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject join request' })
  @ApiResponse({ status: 200, description: 'Request rejected' })
  async reject(@Param('id') groupId: string, @Param('userId') userId: string, @CurrentUser() user: CurrentUserInfo) {
    return this.groupsService.rejectRequest(groupId, userId, user);
  }

  @Post(':id/admins/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Add admin to group' })
  @ApiResponse({ status: 200, description: 'Admin added' })
  async addAdmin(@Param('id') groupId: string, @Param('userId') userId: string, @CurrentUser() user: CurrentUserInfo) {
    return this.groupsService.addAdmin(groupId, userId, user);
  }

  @Delete(':id/admins/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove admin from group' })
  @ApiResponse({ status: 200, description: 'Admin removed' })
  async removeAdmin(@Param('id') groupId: string, @Param('userId') userId: string, @CurrentUser() user: CurrentUserInfo) {
    return this.groupsService.removeAdmin(groupId, userId, user);
  }

  @Post(':id/ban')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ban a group (Admin only)' })
  @ApiResponse({ status: 200, description: 'Group banned' })
  async banGroup(@Param('id') id: string, @CurrentUser() user: CurrentUserInfo) {
    return this.groupsService.banGroup(id, user);
  }

  @Post(':id/unban')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unban a group (Admin only)' })
  @ApiResponse({ status: 200, description: 'Group unbanned' })
  async unbanGroup(@Param('id') id: string, @CurrentUser() user: CurrentUserInfo) {
    return this.groupsService.unbanGroup(id, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete group' })
  @ApiResponse({ status: 200, description: 'Group deleted' })
  async remove(@Param('id') id: string, @CurrentUser() user: CurrentUserInfo) {
    await this.groupsService.remove(id, user);
    return { message: 'Group deleted successfully' };
  }
}