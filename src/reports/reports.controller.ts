import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  @ApiOperation({ summary: 'List reports' })
  @ApiResponse({ status: 200, description: 'Reports returned' })
  list() {
    return this.reportsService.findAll();
  }

  @Post()
  @ApiOperation({ summary: 'Create a report' })
  @ApiResponse({ status: 201, description: 'Report created' })
  create(
    @Body()
    body: {
      reporterId: string;
      targetType: 'event' | 'group' | 'user' | 'comment';
      targetId: string;
      subject: string;
      message: string;
    },
  ) {
    return this.reportsService.create(body);
  }
}
