import { Injectable } from '@nestjs/common';

export type ReviewRecord = {
  id: string;
  eventId: string;
  userId: string;
  rating: number;
  comment: string;
  createdAt: string;
};

@Injectable()
export class ReviewsService {
  private readonly reviews: ReviewRecord[] = [];

  private generateId() {
    return `review-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  }

  findByEvent(eventId: string) {
    return this.reviews.filter((review) => review.eventId === eventId);
  }

  create(input: { eventId: string; userId: string; rating: number; comment: string }) {
    const rating = Number(input.rating);

    if (Number.isNaN(rating) || rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5.');
    }

    const record: ReviewRecord = {
      id: this.generateId(),
      eventId: input.eventId,
      userId: input.userId,
      rating,
      comment: input.comment,
      createdAt: new Date().toISOString(),
    };

    this.reviews.push(record);
    return record;
  }
}
