import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Res,
  BadGatewayException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventQueryDto } from './dto/event-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { EventStatus, UserRole } from '@prisma/client';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { type Response } from 'express';

interface CurrentUserInfo {
  id: string;
  role: UserRole;
  institutionId?: string | null;
}

@ApiTags('events')
@Controller('events')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post('/create')
  @ApiOperation({ summary: 'Create a new event' })
  @ApiResponse({ status: 201, description: 'Event created successfully' })
  async create(
    @Body() createEventDto: CreateEventDto, 
    @CurrentUser() user: CurrentUserInfo,
    @Res() res: Response
    ) {
    try {
        console.log(createEventDto);
        const evCreation = await this.eventsService.create(createEventDto, user.id);
        if(!evCreation) throw new BadGatewayException()
        console.log(evCreation);
        return res.status(HttpStatus.ACCEPTED).send(evCreation);
    } catch (error) {
        console.log(error)
        return res.status(HttpStatus.BAD_REQUEST).send(error);
    }

  }

  @Get('/find')
  @ApiOperation({ summary: 'Get all events with filters' })
  @ApiResponse({ status: 200, description: 'List of events' })
  async findAll(@Query() query: EventQueryDto, @CurrentUser() user: CurrentUserInfo) {
    return this.eventsService.findAll(query, user);
  }

  @Get('upcoming')
  @ApiOperation({ summary: 'Get upcoming events' })
  @ApiResponse({ status: 200, description: 'Upcoming events' })
  async getUpcoming(@Query('limit') limit: number = 10, @CurrentUser() user: CurrentUserInfo) {
    return this.eventsService.getUpcomingEvents(user, limit);
  }

  @Get('recommended')
  @ApiOperation({ summary: 'Get recommended events based on interests' })
  @ApiResponse({ status: 200, description: 'Recommended events' })
  async getRecommended(@Query('interests') interests: string[], @CurrentUser() user: CurrentUserInfo) {
    return this.eventsService.getEventsByInterest(interests);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get event by ID' })
  @ApiResponse({ status: 200, description: 'Event found' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async findById(@Param('id') id: string, @CurrentUser() user: CurrentUserInfo) {
    const result = await this.eventsService.findById(id, user);
    console.log(result);
    return result;
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update event' })
  @ApiResponse({ status: 200, description: 'Event updated' })
  async update(@Param('id') id: string, @Body() updateEventDto: UpdateEventDto, @CurrentUser() user: CurrentUserInfo) {
    return this.eventsService.update(id, updateEventDto, user);
  }

  @Put(':id/ban')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Ban an event (Admin only)' })
  @ApiResponse({ status: 200, description: 'Event banned' })
  async banEvent(@Param('id') id: string, @Body('reason') reason?: string) {
    return this.eventsService.update(id, { status: EventStatus.CANCELLED, cancellationReason: reason ?? 'Banned by administrator' }, { id: 'admin', role: UserRole.ADMIN, institutionId: null });
  }

  @Put(':id/unban')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Restore an event (Admin only)' })
  @ApiResponse({ status: 200, description: 'Event restored' })
  async unbanEvent(@Param('id') id: string) {
    return this.eventsService.update(id, { status: EventStatus.PUBLISHED }, { id: 'admin', role: UserRole.ADMIN, institutionId: null });
  }

  @Post(':id/invite')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Invite a user or an entire group to an event' })
  @ApiResponse({ status: 200, description: 'User or group invited successfully' })
  async inviteUser(
    @Param('id') id: string,
    @Body() body: { userId?: string; groupId?: string },
    @CurrentUser() user: CurrentUserInfo,
  ) {
    return this.eventsService.inviteUserToEvent(id, user, body);
  }

  @Post(':id/attend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Attend an event' })
  @ApiResponse({ status: 200, description: 'Successfully attending event' })
  async attend(@Param('id') id: string, @CurrentUser() user: CurrentUserInfo) {
    return this.eventsService.attendEvent(id, user.id);
  }

  @Post(':id/confirm-assistance')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm assistance to an event' })
  @ApiResponse({ status: 200, description: 'Assistance confirmed successfully' })
  async confirmAssistance(@Param('id') id: string, @CurrentUser() user: CurrentUserInfo) {
    return this.eventsService.confirmAssistance(id, user.id);
  }

  @Post(':id/leave')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Leave an event' })
  @ApiResponse({ status: 200, description: 'Left event successfully' })
  async leaveEvent(@Param('id') id: string, @CurrentUser() user: CurrentUserInfo) {
    return this.eventsService.leaveEvent(id, user.id);
  }

  @Post(':id/unattend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unattend an event' })
  @ApiResponse({ status: 200, description: 'Successfully unattended event' })
  async unattend(@Param('id') id: string, @CurrentUser() user: CurrentUserInfo) {
    return this.eventsService.unattendEvent(id, user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete event' })
  @ApiResponse({ status: 200, description: 'Event deleted' })
  async remove(@Param('id') id: string, @CurrentUser() user: CurrentUserInfo) {
    await this.eventsService.remove(id, user);
    return { message: 'Event deleted successfully' };
  }
}