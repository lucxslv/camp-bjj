import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegistrationEvent, RegistrationStatus, Role, Prisma } from '@prisma/client';

export interface AuditLogParams {
  registrationId: string;
  fromStatus: RegistrationStatus | null;
  toStatus: RegistrationStatus;
  eventType: string;
  reason?: string;
  actorId: string;
  actorRole: Role;
  competitionId: string;
  previousCategoryId?: string;
  newCategoryId?: string;
  weighInId?: string;
  isException?: boolean;
  exceptionScope?: string;
  correlationId?: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Log an audit event (append-only)
   * Must be called within a transaction
   */
  async log(params: AuditLogParams, tx?: Prisma.TransactionClient): Promise<RegistrationEvent> {
    const client = tx || this.prisma;
    return client.registrationEvent.create({
      data: {
        registrationId: params.registrationId,
        fromStatus: params.fromStatus,
        toStatus: params.toStatus,
        eventType: params.eventType,
        reason: params.reason,
        actorId: params.actorId,
        actorRole: params.actorRole,
        competitionId: params.competitionId,
        previousCategoryId: params.previousCategoryId,
        newCategoryId: params.newCategoryId,
        weighInId: params.weighInId,
        isException: params.isException || false,
        exceptionScope: params.exceptionScope,
        correlationId: params.correlationId,
      },
    });
  }

  /**
   * Get audit trail for a registration
   */
  async getRegistrationAudit(registrationId: string): Promise<RegistrationEvent[]> {
    return this.prisma.registrationEvent.findMany({
      where: { registrationId },
      orderBy: { createdAt: 'asc' },
      include: {
        actor: { select: { id: true, fullName: true, email: true, role: true } },
        previousCategory: { select: { id: true, name: true } },
        newCategory: { select: { id: true, name: true } },
        weighIn: { select: { id: true, weightKg: true, result: true, measuredAt: true } },
      },
    });
  }

  /**
   * Get audit trail for a competition (organizer/admin)
   */
  async getCompetitionAudit(competitionId: string, filters?: {
    fromDate?: Date;
    toDate?: Date;
    actorId?: string;
    eventType?: string;
  }): Promise<RegistrationEvent[]> {
    const where: any = { competitionId };

    if (filters?.fromDate || filters?.toDate) {
      where.createdAt = {};
      if (filters.fromDate) where.createdAt.gte = filters.fromDate;
      if (filters.toDate) where.createdAt.lte = filters.toDate;
    }
    if (filters?.actorId) where.actorId = filters.actorId;
    if (filters?.eventType) where.eventType = filters.eventType;

    return this.prisma.registrationEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        registration: {
          select: {
            id: true,
            athlete: { select: { id: true, fullName: true, email: true } },
            eventDivision: { select: { divisionType: { select: { name: true } } } },
            category: { select: { name: true } },
          },
        },
        actor: { select: { id: true, fullName: true, email: true, role: true } },
      },
      take: 500, // Limit for performance
    });
  }

  /**
   * Get professor review queue (registrations needing attention)
   */
  async getProfessorReviewQueue(professorId: string, competitionId?: string): Promise<Array<{
    registration: any;
    lastEvent: any;
  }>> {
    // Get competitions this professor is assigned to
    const assignments = await this.prisma.professorAssignment.findMany({
      where: { professorId, isActive: true },
      select: { competitionId: true },
    });

    const competitionIds = competitionId
      ? [competitionId]
      : assignments.map(a => a.competitionId);

    if (competitionIds.length === 0) return [];

    // Get registrations in NEEDS_REVIEW status in assigned competitions
    const registrations = await this.prisma.registration.findMany({
      where: {
        competitionId: { in: competitionIds },
        status: RegistrationStatus.NEEDS_REVIEW,
      },
      include: {
        athlete: { select: { id: true, fullName: true, email: true } },
        eventDivision: { select: { divisionType: { select: { name: true } } } },
        category: { select: { name: true } },
        pendingCategory: { select: { name: true } },
        competition: { select: { id: true, name: true } },
        registrationEvents: {
          where: { eventType: { in: ['REJECT', 'REOPEN', 'WEIGH_IN'] } },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            actor: { select: { id: true, fullName: true } },
            weighIn: { select: { weightKg: true, result: true, measuredAt: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Transform to include latest event info
    return registrations.map(r => ({
      registration: r,
      lastEvent: r.registrationEvents[0] || null,
    }));
  }
}