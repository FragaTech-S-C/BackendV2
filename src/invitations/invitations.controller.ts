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
import { CreateInvitationDto } from './dto/create-invitation.dto';
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

  @Get('requests')
  @ApiOperation({ summary: 'List pending invitation requests for a user' })
  @ApiResponse({ status: 200, description: 'Invitation requests returned' })
  async listPendingRequests(@Query('userId') userId: string) {
    return await this.invitationsService.findPendingRequests(userId);
  }

  @Post()
  @ApiOperation({ summary: 'Create an invitation' })
  @ApiResponse({ status: 201, description: 'Invitation created' })
  create(@Body() body: CreateInvitationDto) {
    return this.invitationsService.create(body);
  }

  @Post('request')
  @ApiOperation({ summary: 'Create an invitation request' })
  @ApiResponse({ status: 201, description: 'Invitation request created' })
  createInvitationRequest(@Body() body: CreateInvitationDto) {
    return this.invitationsService.create(body);
  }

  @Post(':id/accept')
  @ApiOperation({ summary: 'Accept an invitation' })
  @ApiResponse({ status: 200, description: 'Invitation accepted' })
  accept(@Param('id') id: string, @Query('userId') userId: string) {
    return this.invitationsService.acceptRequest(id, userId);
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Reject an invitation' })
  @ApiResponse({ status: 200, description: 'Invitation rejected' })
  reject(@Param('id') id: string, @Query('userId') userId: string) {
    return this.invitationsService.rejectRequest(id, userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an invitation' })
  @ApiResponse({ status: 200, description: 'Invitation deleted' })
  remove(@Param('id') id: string, @Query('userId') userId: string) {
    return this.invitationsService.remove(id, userId);
  }
}
