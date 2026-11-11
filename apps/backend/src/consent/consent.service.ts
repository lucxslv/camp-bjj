import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GuardianConsent, ConsentStatus, Role } from '@prisma/client';
import { CreateConsentDto, ConsentFiltersDto } from '../files/dto/files.dto';

@Injectable()
export class ConsentService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a guardian consent record
   */
  async create(athleteId: string, data: CreateConsentDto): Promise<GuardianConsent> {
    // Verify competition exists
    const competition = await this.prisma.competition.findUnique({
      where: { id: data.competitionId },
    });
    if (!competition) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Competition not found',
      });
    }

    // If registrationId provided, verify it belongs to athlete and competition
    if (data.registrationId) {
      const registration = await this.prisma.registration.findUnique({
        where: { id: data.registrationId },
        select: { athleteId: true, competitionId: true },
      });
      if (!registration || registration.athleteId !== athleteId || registration.competitionId !== data.competitionId) {
        throw new ForbiddenException({
          statusCode: 403,
          code: 'FORBIDDEN',
          message: 'Registration not found or access denied',
        });
      }
    }

    // Check if consent already exists for this athlete/competition
    const existing = await this.prisma.guardianConsent.findUnique({
      where: { athleteId_competitionId: { athleteId, competitionId: data.competitionId } },
    });

    if (existing) {
      // Update existing consent
      return this.prisma.guardianConsent.update({
        where: { id: existing.id },
        data: {
          guardianName: data.guardianName,
          guardianDocument: data.guardianDocument,
          documentUrl: data.documentUrl,
          expiresAt: new Date(data.expiresAt),
          status: ConsentStatus.PENDING,
          registrationId: data.registrationId,
        },
      });
    }

    return this.prisma.guardianConsent.create({
      data: {
        athleteId,
        competitionId: data.competitionId,
        registrationId: data.registrationId,
        guardianName: data.guardianName,
        guardianDocument: data.guardianDocument,
        documentUrl: data.documentUrl,
        expiresAt: new Date(data.expiresAt),
        status: ConsentStatus.PENDING,
      },
    });
  }

  /**
   * Get consent by ID with access control
   */
  async findById(consentId: string, userId: string, userRole: Role): Promise<GuardianConsent | null> {
    const consent = await this.prisma.guardianConsent.findUnique({
      where: { id: consentId },
      include: {
        athlete: { select: { id: true, fullName: true, email: true } },
        competition: { select: { id: true, name: true } },
        registration: { select: { id: true, status: true } },
      },
    });

    if (!consent) return null;

    // Access control
    if (userRole === 'ATHLETE' && consent.athleteId !== userId) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'Access denied',
      });
    }

    if (userRole === 'PROFESSOR') {
      const assigned = await this.prisma.professorAssignment.findUnique({
        where: { professorId_competitionId: { professorId: userId, competitionId: consent.competitionId } },
      });
      if (!assigned?.isActive) {
        throw new ForbiddenException({
          statusCode: 403,
          code: 'FORBIDDEN',
          message: 'Professor not assigned to this competition',
        });
      }
    }

    return consent;
  }

  /**
   * Get consent for athlete in competition
   */
  async findByAthleteAndCompetition(athleteId: string, competitionId: string): Promise<GuardianConsent | null> {
    return this.prisma.guardianConsent.findUnique({
      where: { athleteId_competitionId: { athleteId, competitionId } },
      include: {
        competition: { select: { id: true, name: true } },
        registration: { select: { id: true, status: true } },
      },
    });
  }

  /**
   * List consents with filters (for professors/organizers/admins)
   */
  async list(userId: string, userRole: Role, filters: ConsentFiltersDto): Promise<GuardianConsent[]> {
    const where: any = {};

    if (filters.status) where.status = filters.status;
    if (filters.competitionId) where.competitionId = filters.competitionId;
    if (filters.registrationId) where.registrationId = filters.registrationId;
    if (filters.fromDate || filters.toDate) {
      where.expiresAt = {};
      if (filters.fromDate) where.expiresAt.gte = new Date(filters.fromDate);
      if (filters.toDate) where.expiresAt.lte = new Date(filters.toDate);
    }

    // Apply access control
    if (userRole === 'ATHLETE') {
      where.athleteId = userId;
    } else if (userRole === 'PROFESSOR') {
      const assignedCompetitions = await this.prisma.professorAssignment.findMany({
        where: { professorId: userId, isActive: true },
        select: { competitionId: true },
      });
      where.competitionId = { in: assignedCompetitions.map(a => a.competitionId) };
    }
    // ORGANIZER and ADMIN see all

    return this.prisma.guardianConsent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        athlete: { select: { id: true, fullName: true, email: true } },
        competition: { select: { id: true, name: true } },
        registration: { select: { id: true, status: true } },
      },
    });
  }

  /**
   * Update consent status (for admin/organizer review)
   */
  async updateStatus(consentId: string, status: ConsentStatus, reviewerId: string): Promise<GuardianConsent> {
    const consent = await this.prisma.guardianConsent.findUnique({
      where: { id: consentId },
    });

    if (!consent) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Consent not found',
      });
    }

    // Check reviewer has access (organizer/admin or assigned professor)
    const reviewer = await this.prisma.user.findUnique({
      where: { id: reviewerId },
      select: { role: true },
    });

    if (reviewer?.role !== 'ORGANIZER' && reviewer?.role !== 'ADMIN') {
      if (reviewer?.role === 'PROFESSOR') {
        const assigned = await this.prisma.professorAssignment.findUnique({
          where: { professorId_competitionId: { professorId: reviewerId, competitionId: consent.competitionId } },
        });
        if (!assigned?.isActive) {
          throw new ForbiddenException({
            statusCode: 403,
            code: 'FORBIDDEN',
            message: 'Not authorized to review this consent',
          });
        }
      } else {
        throw new ForbiddenException({
          statusCode: 403,
          code: 'FORBIDDEN',
          message: 'Not authorized to review consents',
        });
      }
    }

    return this.prisma.guardianConsent.update({
      where: { id: consentId },
      data: { status },
    });
  }

  /**
   * Check if athlete has valid consent for competition (for registration confirmation)
   */
  async hasValidConsent(athleteId: string, competitionId: string): Promise<{ hasConsent: boolean; consent?: GuardianConsent; reason?: string }> {
    const consent = await this.findByAthleteAndCompetition(athleteId, competitionId);

    if (!consent) {
      return { hasConsent: false, reason: 'No consent record found' };
    }

    if (consent.status !== ConsentStatus.APPROVED) {
      return { hasConsent: false, consent, reason: `Consent status: ${consent.status}` };
    }

    if (new Date() > consent.expiresAt) {
      // Auto-expire
      await this.prisma.guardianConsent.update({
        where: { id: consent.id },
        data: { status: ConsentStatus.EXPIRED },
      });
      return { hasConsent: false, consent, reason: 'Consent expired' };
    }

    return { hasConsent: true, consent };
  }

  /**
   * Auto-expire old consents (can be called by cron)
   */
  async expireOldConsents(): Promise<number> {
    const result = await this.prisma.guardianConsent.updateMany({
      where: {
        status: ConsentStatus.PENDING,
        expiresAt: { lt: new Date() },
      },
      data: { status: ConsentStatus.EXPIRED },
    });
    return result.count;
  }
}