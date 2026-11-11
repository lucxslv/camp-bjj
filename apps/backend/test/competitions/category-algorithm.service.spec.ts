import { Test, TestingModule } from '@nestjs/testing';
import { CategoryAlgorithmService } from '../../src/competitions/category-algorithm.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { AthleteProfile, BeltRank, Category, Gender, Prisma } from '@prisma/client';

describe('CategoryAlgorithmService', () => {
  let service: CategoryAlgorithmService;

  const mockPrisma = {
    category: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoryAlgorithmService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<CategoryAlgorithmService>(CategoryAlgorithmService);
    jest.clearAllMocks();
  });

  const createMockCategory = (overrides: Partial<Category> = {}): Category => ({
    id: 'cat-1',
    competitionId: 'comp-1',
    eventDivisionId: 'event-div-1',
    name: 'Adult Blue Gi -76kg',
    minAge: 18,
    maxAge: 29,
    minWeightKg: new Prisma.Decimal(70),
    maxWeightKg: new Prisma.Decimal(76),
    beltRanks: [BeltRank.BLUE],
    gender: Gender.M,
    snapshotVersion: 1,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const createMockProfile = (overrides: Partial<AthleteProfile> = {}): AthleteProfile => ({
    id: 'profile-1',
    userId: 'user-1',
    birthDate: new Date('2000-01-01'),
    beltRank: BeltRank.BLUE,
    weightKg: new Prisma.Decimal(75),
    heightCm: null,
    academy: null,
    federationId: null,
    medicalCertUrl: null,
    medicalCertExpiry: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  describe('computeScore', () => {
    it('should return lower score for more specific category', () => {
      const category = createMockCategory({
        minAge: 18,
        maxAge: 29,
        minWeightKg: new Prisma.Decimal(70),
        maxWeightKg: new Prisma.Decimal(76),
        beltRanks: [BeltRank.BLUE],
      });

      const profile = createMockProfile({
        birthDate: new Date('2000-01-01'),
        beltRank: BeltRank.BLUE,
        weightKg: new Prisma.Decimal(75),
      });

      const result = service.computeScore(category, profile);

      expect(result.score).toBeLessThan(1);
      expect(result.ageScore).toBeGreaterThanOrEqual(0);
      expect(result.weightScore).toBeGreaterThanOrEqual(0);
      expect(result.beltScore).toBeGreaterThanOrEqual(0);
    });

    it('should return score 1 for unrestricted category', () => {
      const category = createMockCategory({
        minAge: null,
        maxAge: null,
        minWeightKg: null,
        maxWeightKg: null,
        beltRanks: [],
      });

      const profile = createMockProfile();

      const result = service.computeScore(category, profile);

      expect(result.ageScore).toBe(1);
      expect(result.weightScore).toBe(1);
      expect(result.beltScore).toBe(1);
      expect(result.score).toBe(1);
    });

    it('should calculate belt score based on rank range', () => {
      const category = createMockCategory({
        beltRanks: [BeltRank.BLUE, BeltRank.PURPLE],
      });

      const profile = createMockProfile({
        beltRank: BeltRank.BLUE,
      });

      const result = service.computeScore(category, profile);

      // BLUE=1, PURPLE=2 -> range = 1, normalized = 1/4 = 0.25
      expect(result.beltScore).toBe(0.25);
    });
  });

  describe('findEligibleCategories', () => {
    it('should return empty array when no categories match', async () => {
      mockPrisma.category.findMany.mockResolvedValue([]);

      const profile = createMockProfile();
      const result = await service.findEligibleCategories(profile, 'event-div-1');

      expect(result.eligibleCategories).toHaveLength(0);
      expect(result.needsReview).toBe(true);
      expect(result.reviewReason).toContain('No eligible category');
    });

    it('should return suggested category when one eligible category', async () => {
      const category = createMockCategory();
      mockPrisma.category.findMany.mockResolvedValue([category]);

      const profile = createMockProfile();
      const result = await service.findEligibleCategories(profile, 'event-div-1');

      expect(result.eligibleCategories).toHaveLength(1);
      expect(result.suggestedCategory).not.toBeNull();
      expect(result.needsReview).toBe(false);
    });

    it('should detect tie and require review', async () => {
      const cat1 = createMockCategory({ id: 'cat-1', name: 'Cat 1', minWeightKg: new Prisma.Decimal(70), maxWeightKg: new Prisma.Decimal(76) });
      const cat2 = createMockCategory({ id: 'cat-2', name: 'Cat 2', minWeightKg: new Prisma.Decimal(70), maxWeightKg: new Prisma.Decimal(76) });
      mockPrisma.category.findMany.mockResolvedValue([cat1, cat2]);

      const profile = createMockProfile({ weightKg: new Prisma.Decimal(75) });
      const result = await service.findEligibleCategories(profile, 'event-div-1');

      expect(result.needsReview).toBe(true);
      expect(result.reviewReason).toContain('tied');
      // Should pick lower ID as tiebreaker
      expect(result.suggestedCategory?.category.id).toBe('cat-1');
    });

    it('should filter by belt rank', async () => {
      const category = createMockCategory({
        beltRanks: [BeltRank.PURPLE, BeltRank.BROWN],
      });
      mockPrisma.category.findMany.mockResolvedValue([category]);

      const profile = createMockProfile({ beltRank: BeltRank.BLUE });
      const result = await service.findEligibleCategories(profile, 'event-div-1');

      expect(result.eligibleCategories).toHaveLength(0);
      expect(result.needsReview).toBe(true);
    });

    it('should filter by age', async () => {
      const category = createMockCategory({
        minAge: 18,
        maxAge: 29,
      });
      mockPrisma.category.findMany.mockResolvedValue([category]);

      const profile = createMockProfile({ birthDate: new Date('1990-01-01') }); // 36 years old
      const result = await service.findEligibleCategories(profile, 'event-div-1');

      expect(result.eligibleCategories).toHaveLength(0);
    });

    it('should filter by weight', async () => {
      const category = createMockCategory({
        minWeightKg: new Prisma.Decimal(70),
        maxWeightKg: new Prisma.Decimal(76),
      });
      mockPrisma.category.findMany.mockResolvedValue([category]);

      const profile = createMockProfile({ weightKg: new Prisma.Decimal(85) });
      const result = await service.findEligibleCategories(profile, 'event-div-1');

      expect(result.eligibleCategories).toHaveLength(0);
    });
  });
});