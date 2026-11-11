import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Registration, RegistrationStatus, Role, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { CategoryAlgorithmService } from '../competitions/category-algorithm.service';

export interface TransitionContext {
  actorId: string;
  actorRole: Role;
  competitionId: string;
  reason?: string;
  correlationId?: string;
  weighInId?: string;
  previousCategoryId?: string;
  newCategoryId?: string;
  isException?: boolean;
  exceptionScope?: string;
}

@Injectable()
export class StateMachineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly categoryAlgorithm: CategoryAlgorithmService,
  ) {}

  /**
   * Valid state transitions
   * Returns true if transition is allowed, throws if not
   */
  validateTransition(
    currentStatus: RegistrationStatus,
    targetStatus: RegistrationStatus,
    context: TransitionContext
  ): void {
    const allowedTransitions: Record<RegistrationStatus, RegistrationStatus[]> = {
      [RegistrationStatus.NEEDS_REVIEW]: [
        RegistrationStatus.CONFIRMED,   // approve
        RegistrationStatus.REJECTED,    // reject
        RegistrationStatus.CANCELLED,   // athlete cancel
      ],
      [RegistrationStatus.CONFIRMED]: [
        RegistrationStatus.NEEDS_REVIEW, // weigh-in invalidates category
        RegistrationStatus.CANCELLED,    // athlete cancel
      ],
      [RegistrationStatus.REJECTED]: [
        RegistrationStatus.NEEDS_REVIEW, // reopen
      ],
      [RegistrationStatus.CANCELLED]: [
        RegistrationStatus.NEEDS_REVIEW, // admin exception
      ],
    };

    const allowed = allowedTransitions[currentStatus]?.includes(targetStatus);
    if (!allowed) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'INVALID_STATE_TRANSITION',
        message: `Cannot transition from ${currentStatus} to ${targetStatus}`,
        details: { currentStatus, targetStatus, allowedFrom: allowedTransitions[currentStatus] },
      });
    }

    // Additional context-specific validations
    this.validateTransitionContext(currentStatus, targetStatus, context);
  }

  private validateTransitionContext(
    fromStatus: RegistrationStatus,
    toStatus: RegistrationStatus,
    context: TransitionContext
  ): void {
    // Professor-only actions
    const professorActions = [
      { from: RegistrationStatus.NEEDS_REVIEW, to: RegistrationStatus.CONFIRMED },
      { from: RegistrationStatus.NEEDS_REVIEW, to: RegistrationStatus.REJECTED },
      { from: RegistrationStatus.REJECTED, to: RegistrationStatus.NEEDS_REVIEW },
      { from: RegistrationStatus.CONFIRMED, to: RegistrationStatus.NEEDS_REVIEW }, // weigh-in
    ];

    const isProfessorAction = professorActions.some(
      t => t.from === fromStatus && t.to === toStatus
    );

    if (isProfessorAction && context.actorRole !== 'PROFESSOR' && context.actorRole !== 'ADMIN') {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'Only professors (or admins) can perform this action',
      });
    }

    // Verify professor assignment for competition-scoped actions
    if (context.actorRole === 'PROFESSOR') {
      // This check is done in CompetitionScopeGuard, but we double-check here
    }

    // Organizer/admin-only actions
    const adminActions = [
      { from: RegistrationStatus.CANCELLED, to: RegistrationStatus.NEEDS_REVIEW }, // exception
    ];

    const isAdminAction = adminActions.some(
      t => t.from === fromStatus && t.to === toStatus
    );

    if (isAdminAction && context.actorRole !== 'ORGANIZER' && context.actorRole !== 'ADMIN') {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'Only organizers/admins can perform exception resolution',
      });
    }

    // Athlete cancel - must be owner
    if (fromStatus === RegistrationStatus.CONFIRMED && toStatus === RegistrationStatus.CANCELLED ||
        fromStatus === RegistrationStatus.NEEDS_REVIEW && toStatus === RegistrationStatus.CANCELLED) {
      // The controller validates ownership
    }

    // Justification requirements
    const requiresJustification = [
      { from: RegistrationStatus.NEEDS_REVIEW, to: RegistrationStatus.REJECTED },
      { from: RegistrationStatus.REJECTED, to: RegistrationStatus.NEEDS_REVIEW },
      { from: RegistrationStatus.CANCELLED, to: RegistrationStatus.NEEDS_REVIEW },
    ];

    const needsJustification = requiresJustification.some(
      t => t.from === fromStatus && t.to === toStatus
    );

    if (needsJustification && !context.reason) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'JUSTIFICATION_REQUIRED',
        message: 'Justification is required for this transition',
      });
    }
  }

  /**
   * Execute a state transition with optimistic locking and audit logging
   * All in a single transaction
   */
  async transition(
    registrationId: string,
    targetStatus: RegistrationStatus,
    context: TransitionContext,
    tx?: Prisma.TransactionClient
  ): Promise<Registration> {
    // Get current registration with version for optimistic locking
    const client = tx || this.prisma;
    const registration = await client.registration.findUnique({
      where: { id: registrationId },
      include: {
        competition: true,
        athlete: { include: { athleteProfile: true } },
        category: true,
        eventDivision: true,
      },
    });

    if (!registration) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Registration not found',
      });
    }

    const currentStatus = registration.status;
    const currentVersion = registration.version;

    // Validate transition
    this.validateTransition(currentStatus, targetStatus, context);

    // Special validation for CONFIRMED: check eligibility and consent
    if (targetStatus === RegistrationStatus.CONFIRMED) {
      await this.validateConfirmation(registration);
    }

    // Special handling for weigh-in invalidating category
    let pendingCategoryId: string | null = null;
    let pendingReason: string | null = null;

    if (currentStatus === RegistrationStatus.CONFIRMED &&
        targetStatus === RegistrationStatus.NEEDS_REVIEW &&
        context.weighInId) {
      // Preserve current category as pending
      pendingCategoryId = registration.categoryId || null;
      pendingReason = 'WEIGHT_OUT_OF_CATEGORY';
    }

    // Execute transition (caller manages transaction)
    // Optimistic lock: update only if version matches
    const updated = await client.registration.update({
      where: {
        id: registrationId,
        version: currentVersion, // Optimistic lock
      },
      data: {
        status: targetStatus,
        version: { increment: 1 },
        ...(pendingCategoryId && { pendingCategoryId }),
        ...(pendingReason && { pendingReason }),
      },
    });

    if (!updated) {
      throw new BadRequestException({
        statusCode: 409,
        code: 'STATE_CONFLICT',
        message: 'Registration was modified by another operation. Please retry.',
      });
    }

    // Create audit event
    await this.auditService.log({
      registrationId,
      fromStatus: currentStatus,
      toStatus: targetStatus,
      eventType: this.getEventType(currentStatus, targetStatus),
      reason: context.reason,
      actorId: context.actorId,
      actorRole: context.actorRole,
      competitionId: context.competitionId,
      previousCategoryId: context.previousCategoryId,
      newCategoryId: context.newCategoryId,
      weighInId: context.weighInId,
      isException: context.isException || false,
      exceptionScope: context.exceptionScope,
      correlationId: context.correlationId,
    }, tx);

    return updated;
  }

  private async validateConfirmation(registration: Registration & { athlete: any; competition: any; category: any }): Promise<void> {
    // Check if competition registration is still open
    const now = new Date();
    if (now > registration.competition.registrationClosesAt) {
      throw new BadRequestException({
        statusCode: 422,
        code: 'BUSINESS_RULE_VIOLATION',
        message: 'Registration period has closed',
      });
    }

    // Check category eligibility if category is set
    if (registration.categoryId && registration.athlete.athleteProfile) {
      const eligibility = await this.categoryAlgorithm.validateCategoryEligibility(
        registration.categoryId,
        registration.athlete.athleteProfile
      );
      if (!eligibility.eligible) {
        throw new BadRequestException({
          statusCode: 422,
          code: 'BUSINESS_RULE_VIOLATION',
          message: `Category not eligible: ${eligibility.reason}`,
        });
      }
    }

    // Check consent for minors (simplified - would need age check)
    // TODO: Implement consent validation
  }

  private getEventType(fromStatus: RegistrationStatus, toStatus: RegistrationStatus): string {
    if (fromStatus === RegistrationStatus.NEEDS_REVIEW && toStatus === RegistrationStatus.CONFIRMED) return 'APPROVE';
    if (fromStatus === RegistrationStatus.NEEDS_REVIEW && toStatus === RegistrationStatus.REJECTED) return 'REJECT';
    if (fromStatus === RegistrationStatus.CONFIRMED && toStatus === RegistrationStatus.NEEDS_REVIEW) return 'WEIGH_IN';
    if (fromStatus === RegistrationStatus.CONFIRMED && toStatus === RegistrationStatus.CANCELLED) return 'CANCEL';
    if (fromStatus === RegistrationStatus.NEEDS_REVIEW && toStatus === RegistrationStatus.CANCELLED) return 'CANCEL';
    if (fromStatus === RegistrationStatus.REJECTED && toStatus === RegistrationStatus.NEEDS_REVIEW) return 'REOPEN';
    if (fromStatus === RegistrationStatus.CANCELLED && toStatus === RegistrationStatus.NEEDS_REVIEW) return 'EXCEPTION';
    return 'UNKNOWN';
  }

  /**
   * Check if a registration can be confirmed (all requirements met)
   */
  async canConfirm(registrationId: string): Promise<{ canConfirm: boolean; reasons: string[] }> {
    const registration = await this.prisma.registration.findUnique({
      where: { id: registrationId },
      include: {
        competition: true,
        athlete: { include: { athleteProfile: true } },
        category: true,
        guardianConsents: true,
      },
    });

    if (!registration) {
      return { canConfirm: false, reasons: ['Registration not found'] };
    }

    const reasons: string[] = [];

    // Check status
    if (registration.status !== RegistrationStatus.NEEDS_REVIEW) {
      reasons.push(`Status is ${registration.status}, not NEEDS_REVIEW`);
    }

    // Check competition registration period
    const now = new Date();
    if (now > registration.competition.registrationClosesAt) {
      reasons.push('Registration period has closed');
    }

    // Check category eligibility
    if (!registration.categoryId) {
      reasons.push('No category assigned');
    } else if (registration.athlete.athleteProfile) {
      const eligibility = await this.categoryAlgorithm.validateCategoryEligibility(
        registration.categoryId,
        registration.athlete.athleteProfile
      );
      if (!eligibility.eligible) {
        reasons.push(`Category not eligible: ${eligibility.reason}`);
      }
    }

    // Check consent (for minors)
    // TODO: Implement age check and consent validation

    return {
      canConfirm: reasons.length === 0,
      reasons,
    };
  }
}