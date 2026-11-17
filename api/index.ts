import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';

let app: any;

async function bootstrap() {
  if (app) return app;

  const nestApp = await NestFactory.create(AppModule, {
    logger: ['error', 'warn'],
  });

  const configService = nestApp.get('ConfigService');
  const corsOrigin = process.env.CORS_ORIGIN || '*';
  nestApp.enableCors({
    origin: corsOrigin,
    credentials: true,
  });

  nestApp.setGlobalPrefix('api');

  await nestApp.init();
  app = nestApp.getHttpAdapter().getInstance();
  return app;
}

export default async function handler(req: any, res: any) {
  const expressApp = await bootstrap();
  return expressApp(req, res);
}
