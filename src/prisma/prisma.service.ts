import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async cleanDatabase() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Cannot clean database in production');
    }
    const modelNames = [
      'user', 'institution', 'board', 'group', 'event', 'eventDateData',
      'eventDate', 'location', 'task', 'resource', 'comment', 'message',
      'file', 'report', 'invitation'
    ];
    for (const model of modelNames) {
      if (typeof (this as any)[model]?.deleteMany === 'function') {
        await (this as any)[model].deleteMany();
      }
    }
  }
}