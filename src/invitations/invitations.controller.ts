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
import { InvitationsService } from './invitations.service';

@ApiTags('invitations')
@Controller('invitations')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Get()
  @ApiOperation({ summary: 'List pending invitations for a user' })
  @ApiResponse({ status: 200, description: 'Invitations list returned' })
  list(@Query('userId') userId: string) {
    return this.invitationsService.findForUser(userId);
  }

  @Post()
  @ApiOperation({ summary: 'Create an invitation' })
  @ApiResponse({ status: 201, description: 'Invitation created' })
  create(
    @Body()
    body: {
      userId: string;
      targetUserId: string;
      type: 'group' | 'event' | 'friend';
      entityId?: string;
      message?: string;
    },
  ) {
    return this.invitationsService.create(body);
  }

  @Post(':id/accept')
  @ApiOperation({ summary: 'Accept an invitation' })
  @ApiResponse({ status: 200, description: 'Invitation accepted' })
  accept(@Param('id') id: string, @Query('userId') userId: string) {
    return this.invitationsService.respond(id, userId, 'accepted');
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Reject an invitation' })
  @ApiResponse({ status: 200, description: 'Invitation rejected' })
  reject(@Param('id') id: string, @Query('userId') userId: string) {
    return this.invitationsService.respond(id, userId, 'rejected');
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an invitation' })
  @ApiResponse({ status: 200, description: 'Invitation deleted' })
  remove(@Param('id') id: string, @Query('userId') userId: string) {
    return this.invitationsService.remove(id, userId);
  }
}
