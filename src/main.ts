import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express'
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'fs';
async function bootstrap() {
//    const httpsOptions = {
//        key: readFileSync('./certs/localhost-key.pem'),
//        cert: readFileSync('./certs/localhost.pem'),
//    };

  const app = await NestFactory.create<NestExpressApplication>(AppModule,
    {
        bodyParser: false,
        // httpsOptions: httpsOptions
    }
  );
  app.useBodyParser('json', { limit: '15mb'})
  const configService = app.get(ConfigService);

  app.enableCors(configService.get('cors'));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.setGlobalPrefix('api');
  
  const config = new DocumentBuilder()
    .setTitle('Meetia API')
    .setDescription('Meetia - Event Management and Coordination Platform')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', 'Authentication endpoints')
    .addTag('users', 'User management')
    .addTag('events', 'Event management')
    .addTag('boards', 'Event boards/groups')
    .addTag('institutions', 'Institution management')
    .addTag('groups', 'Group management')
    .addTag('recommendations', 'Recommendation system')
    .addTag('search', 'Metasearch functionality')
    .addTag('maps', 'Maps and routing')
    .addTag('resources', 'Centralized resources')
    .addTag('tasks', 'Task and time management')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = configService.get('port');
  await app.listen(port);
  console.log(`Application running on port ${port}`);
  console.log(`Swagger docs available at http://localhost:${port}/api/docs`);
}

bootstrap();