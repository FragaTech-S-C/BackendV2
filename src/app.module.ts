import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as path from 'node:path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import configuration from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { EventsModule } from './events/events.module';
import { BoardsModule } from './boards/boards.module';
import { InstitutionsModule } from './institutions/institutions.module';
import { GroupsModule } from './groups/groups.module';
import { RecommendationsModule } from './recommendations/recommendations.module';
import { SearchModule } from './search/search.module';
import { MapsModule } from './maps/maps.module';
import { ResourcesModule } from './resources/resources.module';
import { TasksModule } from './tasks/tasks.module';
import { NotificationsModule } from './notifications/notifications.module';
import { FriendsModule } from './friends/friends.module';
import { InvitationsModule } from './invitations/invitations.module';
import { ReviewsModule } from './reviews/reviews.module';
import { ReportsModule } from './reports/reports.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: [
        path.resolve(process.cwd(), '.env'),
        path.resolve(process.cwd(), 'backend/.env'),
        path.resolve(__dirname, '../.env'),
      ],
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    EventsModule,
    BoardsModule,
    InstitutionsModule,
    GroupsModule,
    RecommendationsModule,
    SearchModule,
    MapsModule,
    ResourcesModule,
    TasksModule,
    NotificationsModule,
    FriendsModule,
    InvitationsModule,
    ReviewsModule,
    ReportsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}