import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Category, BeltRank, AthleteProfile } from '@prisma/client';

export interface CategoryScore {
  category: Category;
  score: number;
  ageScore: number;
  weightScore: number;
  beltScore: number;
}

export interface EligibilityResult {
  eligibleCategories: CategoryScore[];
  suggestedCategory: CategoryScore | null;
  needsReview: boolean;
  reviewReason?: string;
}

@Injectable()
export class CategoryAlgorithmService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calculate normalized interval width for a criterion
   * Lower = more specific = better match
   */
  private calculateIntervalWidth(min: number | null, max: number | null, _value: number, maxPossibleRange: number): number {
    if (min === null && max === null) return 1; // No restriction = widest
    if (min !== null && max !== null) {
      const width = max - min;
      return Math.max(0, width / maxPossibleRange);
    }
    if (min !== null) {
      // Only minimum: range from min to maxPossibleRange
      return Math.max(0, (maxPossibleRange - min) / maxPossibleRange);
    }
    // Only maximum: range from 0 to max
    return Math.max(0, (max ?? 0) / maxPossibleRange);
  }

  /**
   * Check if athlete meets basic eligibility for a category
   */
  private checkBasicEligibility(category: Category, profile: AthleteProfile): boolean {
    // Age check
    if (category.minAge !== null && profile.birthDate) {
      const age = this.calculateAge(profile.birthDate);
      if (age < category.minAge) return false;
    }
    if (category.maxAge !== null && profile.birthDate) {
      const age = this.calculateAge(profile.birthDate);
      if (age > category.maxAge) return false;
    }

    // Weight check (uses declared weight from profile)
    if (category.minWeightKg !== null && profile.weightKg !== null) {
      if (Number(profile.weightKg) < Number(category.minWeightKg)) return false;
    }
    if (category.maxWeightKg !== null && profile.weightKg !== null) {
      if (Number(profile.weightKg) > Number(category.maxWeightKg)) return false;
    }

    // Belt rank check
    if (category.beltRanks && category.beltRanks.length > 0) {
      if (!category.beltRanks.includes(profile.beltRank)) return false;
    }

    // Gender check
    // Note: AthleteProfile doesn't have gender yet, would need to be added
    // For now, skip gender check or assume mixed

    return true;
  }

  private calculateAge(birthDate: Date): number {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  }

  /**
   * Score a category for a specific athlete profile
   * S = (A + W + G) / 3 where A, W, G are normalized interval widths
   * Lower score = more specific category
   */
  computeScore(category: Category, profile: AthleteProfile): CategoryScore {
    const age = profile.birthDate ? this.calculateAge(profile.birthDate) : 0;
    const weight = profile.weightKg ? Number(profile.weightKg) : 0;

    // Normalized interval widths (0 = exact match, 1 = no restriction)
    // Age range: 0-100 years
    const ageWidth = this.calculateIntervalWidth(
      category.minAge,
      category.maxAge,
      age,
      100
    );

    // Weight range: 0-200 kg
    const weightWidth = this.calculateIntervalWidth(
      category.minWeightKg ? Number(category.minWeightKg) : null,
      category.maxWeightKg ? Number(category.maxWeightKg) : null,
      weight,
      200
    );

    // Belt range: 0-4 (WHITE=0 to BLACK=4)
    const beltOrder: Record<BeltRank, number> = {
      WHITE: 0,
      BLUE: 1,
      PURPLE: 2,
      BROWN: 3,
      BLACK: 4,
    };
    const categoryBeltValues = category.beltRanks.map(b => beltOrder[b] ?? 0);
    const minBelt = categoryBeltValues.length > 0 ? Math.min(...categoryBeltValues) : 0;
    const maxBelt = categoryBeltValues.length > 0 ? Math.max(...categoryBeltValues) : 4;
    const beltWidth = (maxBelt - minBelt) / 4;

    const score = (ageWidth + weightWidth + beltWidth) / 3;

    return {
      category,
      score,
      ageScore: ageWidth,
      weightScore: weightWidth,
      beltScore: beltWidth,
    };
  }

  /**
   * Find all eligible categories for an athlete in an event division
   * Returns sorted by score (most specific first)
   */
  async findEligibleCategories(
    athleteProfile: AthleteProfile,
    eventDivisionId: string
  ): Promise<EligibilityResult> {
    const categories = await this.prisma.category.findMany({
      where: {
        eventDivisionId,
        isActive: true,
      },
    });

    const scoredCategories: CategoryScore[] = categories
      .filter(cat => this.checkBasicEligibility(cat, athleteProfile))
      .map(cat => this.computeScore(cat, athleteProfile))
      .sort((a, b) => a.score - b.score); // Lower score = more specific

    // Check for ties in score (within small epsilon)
    const EPSILON = 0.001;
    let needsReview = false;
    let reviewReason: string | undefined;
    let suggestedCategory: CategoryScore | null = null;

    if (scoredCategories.length === 0) {
      needsReview = true;
      reviewReason = 'No eligible category found for athlete profile';
    } else if (scoredCategories.length === 1) {
      suggestedCategory = scoredCategories[0]!;
    } else {
      // Check if top categories are tied
      const topScore = scoredCategories[0]!.score;
      const tiedCategories = scoredCategories.filter(c => Math.abs(c.score - topScore) < EPSILON);

      if (tiedCategories.length > 1) {
        needsReview = true;
        reviewReason = `Multiple categories with equal specificity (${tiedCategories.length} tied). Manual review required.`;
        // Deterministic tie-break: lowest category ID
        tiedCategories.sort((a, b) => a.category.id.localeCompare(b.category.id));
        suggestedCategory = tiedCategories[0]!;
      } else {
        suggestedCategory = scoredCategories[0]!;
      }
    }

    return {
      eligibleCategories: scoredCategories,
      suggestedCategory: suggestedCategory ?? null,
      needsReview,
      reviewReason,
    };
  }

  /**
   * Get category by ID with eligibility check
   */
  async getCategoryWithEligibility(categoryId: string, profile: AthleteProfile): Promise<CategoryScore | null> {
    const category = await this.prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) return null;

    if (!this.checkBasicEligibility(category, profile)) {
      return null;
    }

    return this.computeScore(category, profile);
  }

  /**
   * Validate if a specific category is eligible for an athlete
   */
  async validateCategoryEligibility(categoryId: string, profile: AthleteProfile): Promise<{ eligible: boolean; reason?: string }> {
    const category = await this.prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) {
      return { eligible: false, reason: 'Category not found' };
    }

    if (!category.isActive) {
      return { eligible: false, reason: 'Category is not active' };
    }

    if (!this.checkBasicEligibility(category, profile)) {
      const reasons: string[] = [];
      const age = profile.birthDate ? this.calculateAge(profile.birthDate) : 0;
      const weight = profile.weightKg ? Number(profile.weightKg) : 0;

      if (category.minAge !== null && age < category.minAge) {
        reasons.push(`Age ${age} below minimum ${category.minAge}`);
      }
      if (category.maxAge !== null && age > category.maxAge) {
        reasons.push(`Age ${age} above maximum ${category.maxAge}`);
      }
      if (category.minWeightKg !== null && weight < Number(category.minWeightKg)) {
        reasons.push(`Weight ${weight}kg below minimum ${category.minWeightKg}kg`);
      }
      if (category.maxWeightKg !== null && weight > Number(category.maxWeightKg)) {
        reasons.push(`Weight ${weight}kg above maximum ${category.maxWeightKg}kg`);
      }
      if (category.beltRanks && category.beltRanks.length > 0 && !category.beltRanks.includes(profile.beltRank)) {
        reasons.push(`Belt ${profile.beltRank} not in allowed ranks: ${category.beltRanks.join(', ')}`);
      }

      return { eligible: false, reason: reasons.join('; ') };
    }

    return { eligible: true };
  }
}