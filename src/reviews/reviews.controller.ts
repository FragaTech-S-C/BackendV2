import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';

@ApiTags('reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  @ApiOperation({ summary: 'List reviews for an event' })
  @ApiResponse({ status: 200, description: 'Reviews returned' })
  list(@Query('eventId') eventId: string) {
    return this.reviewsService.findByEvent(eventId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a review' })
  @ApiResponse({ status: 201, description: 'Review created' })
  create(
    @Body()
    body: {
      eventId: string;
      userId: string;
      rating: number;
      comment: string;
    },
  ) {
    return this.reviewsService.create(body);
  }
}
