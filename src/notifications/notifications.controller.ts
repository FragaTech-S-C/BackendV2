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
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'List notifications for a user' })
  @ApiResponse({ status: 200, description: 'Notifications fetched' })
  list(@Query('userId') userId?: string) {
    return this.notificationsService.findAll(userId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a notification' })
  @ApiResponse({ status: 201, description: 'Notification created' })
  create(
    @Body()
    body: {
      userId?: string;
      title: string;
      text: string;
      type?: string;
      link?: string;
      read?: boolean;
    },
  ) {
    return this.notificationsService.create(body);
  }

  @Post(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  @ApiResponse({ status: 200, description: 'Notification marked as read' })
  markRead(@Param('id') id: string, @Query('userId') userId?: string) {
    return this.notificationsService.markRead(id, userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a notification' })
  @ApiResponse({ status: 200, description: 'Notification deleted' })
  remove(@Param('id') id: string, @Query('userId') userId?: string) {
    return this.notificationsService.remove(id, userId);
  }
}
