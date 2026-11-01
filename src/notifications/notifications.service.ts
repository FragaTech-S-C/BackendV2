import { Injectable } from '@nestjs/common';

export type NotificationRecord = {
  id: string;
  userId: string;
  title: string;
  text: string;
  type?: string;
  link?: string;
  read: boolean;
  createdAt: string;
};

@Injectable()
export class NotificationsService {
  private readonly notifications: NotificationRecord[] = [];

  private generateId() {
    return `ntf-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  }

  findAll(userId?: string) {
    const filtered = userId
      ? this.notifications.filter((notification) => notification.userId === userId)
      : this.notifications;

    return [...filtered].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  create(input: {
    userId?: string;
    title: string;
    text: string;
    type?: string;
    link?: string;
    read?: boolean;
  }) {
    const record: NotificationRecord = {
      id: this.generateId(),
      userId: input.userId ?? 'local-user',
      title: input.title,
      text: input.text,
      type: input.type ?? 'info',
      link: input.link,
      read: Boolean(input.read),
      createdAt: new Date().toISOString(),
    };

    this.notifications.unshift(record);
    return record;
  }

  markRead(id: string, userId?: string) {
    const notification = this.notifications.find(
      (item) => item.id === id && (!userId || item.userId === userId),
    );

    if (!notification) {
      return null;
    }

    notification.read = true;
    return notification;
  }

  remove(id: string, userId?: string) {
    const index = this.notifications.findIndex(
      (item) => item.id === id && (!userId || item.userId === userId),
    );

    if (index < 0) {
      return null;
    }

    const [removed] = this.notifications.splice(index, 1);
    return removed;
  }
}
