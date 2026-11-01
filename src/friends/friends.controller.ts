import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FriendsService } from './friends.service';

@ApiTags('friends')
@Controller('friends')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FriendsController {
  constructor(private readonly friendsService: FriendsService) {}

  @Get()
  @ApiOperation({ summary: 'List accepted friends for a user' })
  @ApiResponse({ status: 200, description: 'Friends list returned' })
  async listAcceptedConnections(@Query('userId') userId: string) {
    return await this.friendsService.findAcceptedConnections(userId);
  }

  @Get('requests')
  @ApiOperation({ summary: 'List pending friend requests for a user' })
  @ApiResponse({ status: 200, description: 'Requests returned' })
  async listPendingRequests(@Query('userId') userId: string) {
    return await this.friendsService.findPendingRequests(userId);
  }

  @Post('request')
  @ApiOperation({ summary: 'Send a friend request' })
  @ApiResponse({ status: 201, description: 'Friend request created' })
  async createFriendRequest(@Body() body: { userId: string; friendEmail: string }) {
    console.log(body);
    return await this.friendsService.createRequest(body);
  }

  @Post(':id/accept')
  @ApiOperation({ summary: 'Accept a friend request' })
  @ApiResponse({ status: 200, description: 'Friend request accepted' })
  async acceptFriendRequest(@Param('id') id: string, @Query('userId') userId: string) {
    return await this.friendsService.acceptRequest(id, userId);
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Reject a friend request' })
  @ApiResponse({ status: 200, description: 'Friend request rejected' })
  async rejectFriendRequest(@Param('id') id: string, @Query('userId') userId: string) {
    return await this.friendsService.rejectRequest(id, userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove a friend relationship' })
  @ApiResponse({ status: 200, description: 'Friend deleted' })
  async removeFriendRelationship(@Param('id') id: string, @Query('userId') userId: string) {
    return await this.friendsService.removeRelationship(id, userId);
  }
}
