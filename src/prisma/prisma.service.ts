import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Conexión exitosa a la base de datos');
    } catch (error) {
      this.logger.error('Servidor no responde', error);
    }
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
      'file', 'report'
    ];
    for (const model of modelNames) {
      if (typeof (this as any)[model]?.deleteMany === 'function') {
        await (this as any)[model].deleteMany();
      }
    }
  }
}