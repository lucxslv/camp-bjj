import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WeighIn, WeighInResult, RegistrationStatus, Role } from '@prisma/client';
import { StateMachineService } from '../registrations/state-machine.service';
import { CategoryAlgorithmService } from '../competitions/category-algorithm.service';
import { RecordWeighInDto, WeighInFiltersDto } from '../registrations/dto/registration.dto';

@Injectable()
export class WeighInsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stateMachine: StateMachineService,
    private readonly categoryAlgorithm: CategoryAlgorithmService,
  ) {}

  /**
   * Record a weigh-in (idempotent via idempotencyKey)
   * Professor only, must be assigned to competition
   */
  async record(registrationId: string, professorId: string, data: RecordWeighInDto): Promise<WeighIn> {
    // Check registration exists and get context
    const registration = await this.prisma.registration.findUnique({
      where: { id: registrationId },
      include: {
        competition: true,
        eventDivision: true,
        category: true,
        athlete: { include: { athleteProfile: true } },
      },
    });

    if (!registration) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Registration not found',
      });
    }

    // Check professor assignment
    const assigned = await this.prisma.professorAssignment.findUnique({
      where: { professorId_competitionId: { professorId, competitionId: registration.competitionId } },
    });
    if (!assigned?.isActive) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'Professor not assigned to this competition',
      });
    }

    // Check registration status - can only weigh-in confirmed or needs_review registrations
    if (registration.status === RegistrationStatus.CANCELLED || registration.status === RegistrationStatus.REJECTED) {
      throw new BadRequestException({
        statusCode: 422,
        code: 'BUSINESS_RULE_VIOLATION',
        message: `Cannot record weigh-in for registration with status ${registration.status}`,
      });
    }

    // Check idempotency
    const existing = await this.prisma.weighIn.findUnique({
      where: { idempotencyKey: data.idempotencyKey },
    });
    if (existing) {
      return existing;
    }

    // Determine weigh-in result
    let result: WeighInResult = WeighInResult.VALID;
    let newCategoryId: string | undefined;

    if (registration.athlete.athleteProfile && registration.categoryId) {
      // For weigh-in, we check against the measured weight from the weigh-in itself
      // The athlete's profile weight is the declared weight; weigh-in is the measured weight
      // We need to check if the MEASURED weight fits the category
      const measuredWeight = data.weightKg;

      if (registration.category) {
        const minWeight = registration.category.minWeightKg ? Number(registration.category.minWeightKg) : null;
        const maxWeight = registration.category.maxWeightKg ? Number(registration.category.maxWeightKg) : null;

        if (minWeight !== null && measuredWeight < minWeight) {
          result = WeighInResult.INVALID_CATEGORY;
        }
        if (maxWeight !== null && measuredWeight > maxWeight) {
          result = WeighInResult.INVALID_CATEGORY;
        }
      }
    }

    // If invalid category, find suggested category
    if (result === WeighInResult.INVALID_CATEGORY && registration.athlete.athleteProfile) {
      const eligibility = await this.categoryAlgorithm.findEligibleCategories(
        registration.athlete.athleteProfile,
        registration.eventDivisionId
      );
      if (eligibility.suggestedCategory) {
        newCategoryId = eligibility.suggestedCategory.category.id;
      }
    }

    // Create weigh-in and potentially transition registration state in transaction
    const weighIn = await this.prisma.$transaction(async (tx) => {
      const wi = await tx.weighIn.create({
        data: {
          registrationId,
          weightKg: data.weightKg,
          unit: data.unit || 'kg',
          measuredBy: professorId,
          result,
          notes: data.notes,
          idempotencyKey: data.idempotencyKey,
        },
      });

      // If category invalidated, transition to NEEDS_REVIEW
      if (result === WeighInResult.INVALID_CATEGORY) {
        await this.stateMachine.transition(registrationId, RegistrationStatus.NEEDS_REVIEW, {
          actorId: professorId,
          actorRole: 'PROFESSOR',
          competitionId: registration.competitionId,
          reason: 'Weigh-in invalidated category',
          weighInId: wi.id,
          previousCategoryId: registration.categoryId || undefined,
          newCategoryId,
        }, tx);
      }

      return wi;
    });

    return weighIn;
  }

  async findByRegistration(registrationId: string, actorId: string, actorRole: Role, filters?: WeighInFiltersDto): Promise<WeighIn[]> {
    // Authorization check
    const registration = await this.prisma.registration.findUnique({
      where: { id: registrationId },
      select: { athleteId: true, competitionId: true },
    });

    if (!registration) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Registration not found',
      });
    }

    if (actorRole === 'ATHLETE' && registration.athleteId !== actorId) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'Access denied',
      });
    }

    if (actorRole === 'PROFESSOR') {
      const assigned = await this.prisma.professorAssignment.findUnique({
        where: { professorId_competitionId: { professorId: actorId, competitionId: registration.competitionId } },
      });
      if (!assigned?.isActive) {
        throw new ForbiddenException({
          statusCode: 403,
          code: 'FORBIDDEN',
          message: 'Professor not assigned to this competition',
        });
      }
    }

    const where: any = { registrationId };
    if (filters?.result) where.result = filters.result;
    if (filters?.fromDate || filters?.toDate) {
      where.measuredAt = {};
      if (filters.fromDate) where.measuredAt.gte = new Date(filters.fromDate);
      if (filters.toDate) where.measuredAt.lte = new Date(filters.toDate);
    }

    return this.prisma.weighIn.findMany({
      where,
      orderBy: { measuredAt: 'desc' },
      include: {
        measuredByUser: { select: { id: true, fullName: true, role: true } },
      },
    });
  }

  async findById(weighInId: string, actorId: string, actorRole: Role): Promise<WeighIn | null> {
    const weighIn = await this.prisma.weighIn.findUnique({
      where: { id: weighInId },
      include: {
        registration: { select: { athleteId: true, competitionId: true } },
        measuredByUser: { select: { id: true, fullName: true, role: true } },
      },
    });

    if (!weighIn) return null;

    if (actorRole === 'ATHLETE' && weighIn.registration.athleteId !== actorId) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'Access denied',
      });
    }

    if (actorRole === 'PROFESSOR') {
      const assigned = await this.prisma.professorAssignment.findUnique({
        where: { professorId_competitionId: { professorId: actorId, competitionId: weighIn.registration.competitionId } },
      });
      if (!assigned?.isActive) {
        throw new ForbiddenException({
          statusCode: 403,
          code: 'FORBIDDEN',
          message: 'Professor not assigned to this competition',
        });
      }
    }

    return weighIn;
  }
}