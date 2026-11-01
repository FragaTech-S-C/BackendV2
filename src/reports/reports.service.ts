import { Injectable } from '@nestjs/common';

export type ReportRecord = {
  id: string;
  reporterId: string;
  targetType: 'event' | 'group' | 'user' | 'comment';
  targetId: string;
  subject: string;
  message: string;
  status: 'open' | 'reviewing' | 'resolved';
  createdAt: string;
};

@Injectable()
export class ReportsService {
  private readonly reports: ReportRecord[] = [];

  private generateId() {
    return `report-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  }

  findAll() {
    return this.reports;
  }

  create(input: {
    reporterId: string;
    targetType: 'event' | 'group' | 'user' | 'comment';
    targetId: string;
    subject: string;
    message: string;
  }) {
    const record: ReportRecord = {
      id: this.generateId(),
      reporterId: input.reporterId,
      targetType: input.targetType,
      targetId: input.targetId,
      subject: input.subject,
      message: input.message,
      status: 'open',
      createdAt: new Date().toISOString(),
    };

    this.reports.push(record);
    return record;
  }
}
