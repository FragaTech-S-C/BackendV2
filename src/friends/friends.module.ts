import { Module } from '@nestjs/common';
import { FriendsController } from './friends.controller';
import { FriendsService } from './friends.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  controllers: [FriendsController],
  providers: [FriendsService],
  exports: [FriendsService],
  imports: [NotificationsModule]
})
export class FriendsModule {}
