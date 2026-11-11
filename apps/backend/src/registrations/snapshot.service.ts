import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CategoryAlgorithmService } from '../competitions/category-algorithm.service';
import { AthleteProfile } from '@prisma/client';

export interface RegistrationSnapshot {
  competitionId: string;
  eventDivisionId: string;
  categories: Array<{
    id: string;
    name: string;
    minAge: number | null;
    maxAge: number | null;
    minWeightKg: number | null;
    maxWeightKg: number | null;
    beltRanks: string[];
    gender: string | null;
    snapshotVersion: number;
  }>;
  registrationOpensAt: Date;
  registrationClosesAt: Date;
  cancellationDeadline: Date | null;
  algorithmVersion: string;
  capturedAt: Date;
}

@Injectable()
export class RegistrationSnapshotService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly categoryAlgorithm: CategoryAlgorithmService,
  ) {}

  /**
   * Capture a snapshot of the current competition rules for registration
   * Called at registration creation time
   */
  async capture(
    competitionId: string,
    eventDivisionId: string,
    _athleteProfile: AthleteProfile
  ): Promise<RegistrationSnapshot> {
    const competition = await this.prisma.competition.findUnique({
      where: { id: competitionId },
    });

    if (!competition) {
      throw new Error('Competition not found');
    }

    const categories = await this.prisma.category.findMany({
      where: {
        competitionId,
        eventDivisionId,
        isActive: true,
      },
    });

    return {
      competitionId,
      eventDivisionId,
      categories: categories.map(c => ({
        id: c.id,
        name: c.name,
        minAge: c.minAge,
        maxAge: c.maxAge,
        minWeightKg: c.minWeightKg ? Number(c.minWeightKg) : null,
        maxWeightKg: c.maxWeightKg ? Number(c.maxWeightKg) : null,
        beltRanks: c.beltRanks,
        gender: c.gender,
        snapshotVersion: c.snapshotVersion,
      })),
      registrationOpensAt: competition.registrationOpensAt,
      registrationClosesAt: competition.registrationClosesAt,
      cancellationDeadline: competition.cancellationDeadline,
      algorithmVersion: 'v1.0.0', // Track algorithm version for audit
      capturedAt: new Date(),
    };
  }

  /**
   * Get the snapshot stored in a registration
   */
  async getSnapshot(registrationId: string): Promise<RegistrationSnapshot | null> {
    const registration = await this.prisma.registration.findUnique({
      where: { id: registrationId },
      select: { registrationSnapshot: true },
    });
    return registration?.registrationSnapshot as unknown as RegistrationSnapshot | null;
  }

  /**
   * Validate if a registration's snapshot is still current
   * Used for audit/review purposes
   */
  async isSnapshotCurrent(registrationId: string): Promise<{ current: boolean; differences: string[] }> {
    const registration = await this.prisma.registration.findUnique({
      where: { id: registrationId },
      select: {
        registrationSnapshot: true,
        competitionId: true,
        eventDivisionId: true,
        athlete: { select: { athleteProfile: true } },
      },
    });

    if (!registration?.registrationSnapshot) {
      return { current: false, differences: ['No snapshot found'] };
    }

    const stored = registration.registrationSnapshot as unknown as RegistrationSnapshot;
    const currentSnapshot = await this.capture(
      registration.competitionId,
      registration.eventDivisionId,
      registration.athlete.athleteProfile!
    );

    const differences: string[] = [];

    // Compare categories count
    if (stored.categories.length !== currentSnapshot.categories.length) {
      differences.push(`Category count changed: ${stored.categories.length} -> ${currentSnapshot.categories.length}`);
    }

    // Compare deadlines
    if (stored.registrationClosesAt.getTime() !== currentSnapshot.registrationClosesAt.getTime()) {
      differences.push('Registration deadline changed');
    }
    if (stored.cancellationDeadline?.getTime() !== currentSnapshot.cancellationDeadline?.getTime()) {
      differences.push('Cancellation deadline changed');
    }

    // Compare algorithm version
    if (stored.algorithmVersion !== currentSnapshot.algorithmVersion) {
      differences.push(`Algorithm version changed: ${stored.algorithmVersion} -> ${currentSnapshot.algorithmVersion}`);
    }

    return {
      current: differences.length === 0,
      differences,
    };
  }
}