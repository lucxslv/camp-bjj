import { Injectable, NotFoundException, ForbiddenException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Registration, RegistrationStatus, Role, Prisma } from '@prisma/client';
import { StateMachineService } from './state-machine.service';
import { RegistrationSnapshotService } from './snapshot.service';
import { CreateRegistrationDto, RegistrationFiltersDto, ApproveRegistrationDto, RejectRegistrationDto, ReopenRegistrationDto, CancelRegistrationDto, ResolveExceptionDto } from './dto/registration.dto';

@Injectable()
export class RegistrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stateMachine: StateMachineService,
    private readonly snapshotService: RegistrationSnapshotService,
  ) {}

  async create(athleteId: string, data: CreateRegistrationDto): Promise<Registration> {
    // Check if competition exists and registration is open
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

    const now = new Date();
    if (now < competition.registrationOpensAt || now > competition.registrationClosesAt) {
      throw new BadRequestException({
        statusCode: 422,
        code: 'BUSINESS_RULE_VIOLATION',
        message: 'Registration period is not open',
      });
    }

    // Check event division exists and is active
    const eventDivision = await this.prisma.eventDivision.findUnique({
      where: { id: data.eventDivisionId },
    });

    if (!eventDivision || eventDivision.competitionId !== data.competitionId || !eventDivision.isActive) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Event division not found or not active',
      });
    }

    // Check if athlete already has an active registration in this division
    const existing = await this.prisma.registration.findUnique({
      where: {
        athleteId_eventDivisionId: {
          athleteId,
          eventDivisionId: data.eventDivisionId,
        },
      },
    });

    if (existing && existing.status !== RegistrationStatus.CANCELLED && existing.status !== RegistrationStatus.REJECTED) {
      throw new ConflictException({
        statusCode: 409,
        code: 'DUPLICATE_REGISTRATION',
        message: 'Athlete already has an active registration in this division',
      });
    }

    // If category provided, validate it belongs to the event division
    if (data.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: data.categoryId },
      });

      if (!category || category.eventDivisionId !== data.eventDivisionId) {
        throw new BadRequestException({
          statusCode: 400,
          code: 'INVALID_CATEGORY',
          message: 'Category does not belong to this event division',
        });
      }
    }

    // Get athlete profile for snapshot
    const athleteProfile = await this.prisma.athleteProfile.findUnique({
      where: { userId: athleteId },
    });

    if (!athleteProfile) {
      throw new BadRequestException({
        statusCode: 422,
        code: 'INCOMPLETE_PROFILE',
        message: 'Athlete profile must be completed before registering',
      });
    }

    // Capture snapshot of rules at registration time
    const snapshot = await this.snapshotService.capture(
      data.competitionId,
      data.eventDivisionId,
      athleteProfile
    );

    // Determine suggested category if not provided
    let categoryId = data.categoryId;
    if (!categoryId) {
      const eligibility = await this.snapshotService['categoryAlgorithm'].findEligibleCategories(
        athleteProfile,
        data.eventDivisionId
      );
      if (eligibility.suggestedCategory) {
        categoryId = eligibility.suggestedCategory.category.id;
      }
    }

    // Create registration
    return this.prisma.registration.create({
      data: {
        athleteId,
        competitionId: data.competitionId,
        eventDivisionId: data.eventDivisionId,
        categoryId,
        declaredWeightKg: data.declaredWeightKg,
        status: RegistrationStatus.NEEDS_REVIEW,
        registrationSnapshot: snapshot as any,
      },
    });
  }

  async findAll(athleteId: string, filters: RegistrationFiltersDto): Promise<{ registrations: Registration[]; total: number }> {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.RegistrationWhereInput = {
      athleteId,
      ...(filters.status && { status: filters.status }),
      ...(filters.competitionId && { competitionId: filters.competitionId }),
      ...(filters.eventDivisionId && { eventDivisionId: filters.eventDivisionId }),
    };

    const [registrations, total] = await Promise.all([
      this.prisma.registration.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          competition: { select: { id: true, name: true, slug: true, startsAt: true, status: true } },
          eventDivision: { select: { id: true, divisionType: { select: { name: true, code: true } } } },
          category: { select: { id: true, name: true } },
          pendingCategory: { select: { id: true, name: true } },
        },
      }),
      this.prisma.registration.count({ where }),
    ]);

    return { registrations, total };
  }

  async findById(registrationId: string, actorId: string, actorRole: Role): Promise<Registration | null> {
    const registration = await this.prisma.registration.findUnique({
      where: { id: registrationId },
      include: {
        competition: true,
        eventDivision: { include: { divisionType: true } },
        category: true,
        pendingCategory: true,
        athlete: { select: { id: true, fullName: true, email: true, athleteProfile: true } },
        weighIns: { orderBy: { measuredAt: 'desc' } },
        registrationEvents: {
          orderBy: { createdAt: 'desc' },
          include: {
            actor: { select: { id: true, fullName: true, role: true } },
            previousCategory: { select: { name: true } },
            newCategory: { select: { name: true } },
            weighIn: { select: { weightKg: true, result: true, measuredAt: true } },
          },
        },
        guardianConsents: true,
      },
    });

    if (!registration) return null;

    // Authorization: athlete can only see own, professor sees assigned competitions, organizer/admin sees all
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

    return registration;
  }

  async cancel(registrationId: string, athleteId: string, data: CancelRegistrationDto): Promise<Registration> {
    const registration = await this.prisma.registration.findUnique({
      where: { id: registrationId },
      include: { competition: true },
    });

    if (!registration) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Registration not found',
      });
    }

    if (registration.athleteId !== athleteId) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'Can only cancel own registration',
      });
    }

    if (registration.status === RegistrationStatus.CANCELLED) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'ALREADY_CANCELLED',
        message: 'Registration is already cancelled',
      });
    }

    if (registration.status === RegistrationStatus.REJECTED) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'INVALID_STATE_TRANSITION',
        message: 'Cannot cancel a rejected registration',
      });
    }

    // Check cancellation deadline
    const deadline = registration.competition.cancellationDeadline || registration.competition.registrationClosesAt;
    if (new Date() > deadline) {
      throw new BadRequestException({
        statusCode: 422,
        code: 'PAST_DEADLINE',
        message: 'Cancellation deadline has passed',
      });
    }

    return this.stateMachine.transition(registrationId, RegistrationStatus.CANCELLED, {
      actorId: athleteId,
      actorRole: 'ATHLETE',
      competitionId: registration.competitionId,
      reason: data.reason || 'Cancelled by athlete',
    });
  }

  async approve(registrationId: string, professorId: string, data: ApproveRegistrationDto): Promise<Registration> {
    const registration = await this.prisma.registration.findUnique({
      where: { id: registrationId },
      include: { competition: true },
    });

    if (!registration) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Registration not found',
      });
    }

    // Check if registration is in NEEDS_REVIEW
    if (registration.status !== RegistrationStatus.NEEDS_REVIEW) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'INVALID_STATE_TRANSITION',
        message: `Cannot approve registration with status ${registration.status}`,
      });
    }

    // Check professor assignment (guard does this, but double-check)
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

    // Validate can confirm
    const canConfirm = await this.stateMachine.canConfirm(registrationId);
    if (!canConfirm.canConfirm) {
      throw new BadRequestException({
        statusCode: 422,
        code: 'BUSINESS_RULE_VIOLATION',
        message: 'Registration cannot be confirmed',
        details: canConfirm.reasons,
      });
    }

    return this.stateMachine.transition(registrationId, RegistrationStatus.CONFIRMED, {
      actorId: professorId,
      actorRole: 'PROFESSOR',
      competitionId: registration.competitionId,
      reason: data.justification,
    });
  }

  async reject(registrationId: string, professorId: string, data: RejectRegistrationDto): Promise<Registration> {
    const registration = await this.prisma.registration.findUnique({
      where: { id: registrationId },
      include: { competition: true },
    });

    if (!registration) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Registration not found',
      });
    }

    if (registration.status !== RegistrationStatus.NEEDS_REVIEW) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'INVALID_STATE_TRANSITION',
        message: `Cannot reject registration with status ${registration.status}`,
      });
    }

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

    return this.stateMachine.transition(registrationId, RegistrationStatus.REJECTED, {
      actorId: professorId,
      actorRole: 'PROFESSOR',
      competitionId: registration.competitionId,
      reason: data.justification,
    });
  }

  async reopen(registrationId: string, professorId: string, data: ReopenRegistrationDto): Promise<Registration> {
    const registration = await this.prisma.registration.findUnique({
      where: { id: registrationId },
      include: { competition: true },
    });

    if (!registration) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Registration not found',
      });
    }

    if (registration.status !== RegistrationStatus.REJECTED) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'INVALID_STATE_TRANSITION',
        message: `Can only reopen rejected registrations, current status: ${registration.status}`,
      });
    }

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

    return this.stateMachine.transition(registrationId, RegistrationStatus.NEEDS_REVIEW, {
      actorId: professorId,
      actorRole: 'PROFESSOR',
      competitionId: registration.competitionId,
      reason: data.justification,
    });
  }

  async resolveException(registrationId: string, organizerId: string, data: ResolveExceptionDto): Promise<Registration> {
    const registration = await this.prisma.registration.findUnique({
      where: { id: registrationId },
      include: { competition: true },
    });

    if (!registration) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Registration not found',
      });
    }

    if (registration.status !== RegistrationStatus.CANCELLED) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'INVALID_STATE_TRANSITION',
        message: `Exception resolution only for cancelled registrations, current: ${registration.status}`,
      });
    }

    // Check organizer/admin role
    const organizer = await this.prisma.user.findUnique({ where: { id: organizerId } });
    if (!organizer || (organizer.role !== 'ORGANIZER' && organizer.role !== 'ADMIN')) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'Only organizers/admins can resolve exceptions',
      });
    }

    // If organizer (not admin), verify they own this competition
    if (organizer.role === 'ORGANIZER') {
      // Check if organizer is assigned to this competition
      // In a real app, there would be an organizer-competition relationship
    }

    return this.stateMachine.transition(registrationId, RegistrationStatus.NEEDS_REVIEW, {
      actorId: organizerId,
      actorRole: organizer.role,
      competitionId: registration.competitionId,
      reason: data.justification,
      isException: true,
      exceptionScope: data.exceptionScope,
      correlationId: data.correlationId,
    });
  }

  async getSnapshot(registrationId: string) {
    return this.snapshotService.getSnapshot(registrationId);
  }

  async isSnapshotCurrent(registrationId: string) {
    return this.snapshotService.isSnapshotCurrent(registrationId);
  }
}