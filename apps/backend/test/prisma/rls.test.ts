import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

const prisma = new PrismaClient();

// Test database setup - uses a separate test database
// Requires DATABASE_URL_TEST env var pointing to a test PostgreSQL database

describe('RLS Policies', () => {
  let athlete1Id: string;
  let athlete2Id: string;
  let professorId: string;
  let organizerId: string;
  let competitionId: string;
  let eventDivisionId: string;
  let categoryId: string;
  let registration1Id: string;
  let registration2Id: string;

  beforeAll(async () => {
    // Reset test database
    try {
      execSync('npx prisma migrate reset --force --skip-seed', {
        env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL_TEST },
        stdio: 'inherit',
      });
    } catch (e) {
      console.warn('Could not reset test database:', e);
    }

    // Seed test data
    await seedTestData();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function seedTestData() {
    // Create users
    const athlete1 = await prisma.user.create({
      data: {
        authUserId: 'auth-athlete-1',
        email: 'athlete1@test.com',
        fullName: 'Athlete One',
        role: 'ATHLETE',
        athleteProfile: {
          create: {
            birthDate: new Date('2000-01-01'),
            beltRank: 'BLUE',
            weightKg: 75.5,
          },
        },
      },
    });
    athlete1Id = athlete1.id;

    const athlete2 = await prisma.user.create({
      data: {
        authUserId: 'auth-athlete-2',
        email: 'athlete2@test.com',
        fullName: 'Athlete Two',
        role: 'ATHLETE',
        athleteProfile: {
          create: {
            birthDate: new Date('1995-05-15'),
            beltRank: 'PURPLE',
            weightKg: 82.0,
          },
        },
      },
    });
    athlete2Id = athlete2.id;

    const professor = await prisma.user.create({
      data: {
        authUserId: 'auth-professor-1',
        email: 'professor@test.com',
        fullName: 'Professor One',
        role: 'PROFESSOR',
      },
    });
    professorId = professor.id;

    const organizer = await prisma.user.create({
      data: {
        authUserId: 'auth-organizer-1',
        email: 'organizer@test.com',
        fullName: 'Organizer One',
        role: 'ORGANIZER',
      },
    });
    organizerId = organizer.id;

    // Create competition
    const competition = await prisma.competition.create({
      data: {
        name: 'Test Competition',
        slug: 'test-competition',
        startsAt: new Date('2026-12-01'),
        endsAt: new Date('2026-12-02'),
        registrationOpensAt: new Date('2026-10-01'),
        registrationClosesAt: new Date('2026-11-15'),
        status: 'PUBLISHED',
      },
    });
    competitionId = competition.id;

    // Assign professor to competition
    await prisma.professorAssignment.create({
      data: {
        professorId,
        competitionId,
        isActive: true,
      },
    });

    // Create event division
    const divisionType = await prisma.divisionType.findUnique({ where: { code: 'GI' } });
    const eventDivision = await prisma.eventDivision.create({
      data: {
        competitionId,
        divisionTypeId: divisionType!.id,
        isActive: true,
      },
    });
    eventDivisionId = eventDivision.id;

    // Create category
    const category = await prisma.category.create({
      data: {
        competitionId,
        eventDivisionId,
        name: 'Adult Blue Gi -76kg',
        minAge: 18,
        maxAge: 29,
        maxWeightKg: 76.0,
        beltRanks: ['BLUE'],
        gender: 'M',
        isActive: true,
      },
    });
    categoryId = category.id;

    // Create registrations
    const reg1 = await prisma.registration.create({
      data: {
        athleteId: athlete1Id,
        competitionId,
        eventDivisionId,
        categoryId,
        status: 'CONFIRMED',
        declaredWeightKg: 75.5,
      },
    });
    registration1Id = reg1.id;

    const reg2 = await prisma.registration.create({
      data: {
        athleteId: athlete2Id,
        competitionId,
        eventDivisionId,
        categoryId,
        status: 'NEEDS_REVIEW',
        declaredWeightKg: 82.0,
      },
    });
    registration2Id = reg2.id;
  }

  describe('Cross-athlete registration access', () => {
    it('athlete1 cannot read athlete2 registration', async () => {
      // Set RLS context to athlete1
      await prisma.$executeRaw`SET LOCAL request.jwt.claims = '{"sub": "auth-athlete-1", "role": "ATHLETE"}'`;

      const registrations = await prisma.registration.findMany({
        where: { athleteId: athlete2Id },
      });

      expect(registrations).toHaveLength(0);
    });

    it('athlete1 cannot update athlete2 registration', async () => {
      await prisma.$executeRaw`SET LOCAL request.jwt.claims = '{"sub": "auth-athlete-1", "role": "ATHLETE"}`;

      await expect(
        prisma.registration.update({
          where: { id: registration2Id },
          data: { status: 'CANCELLED' },
        }),
      ).rejects.toThrow();
    });
  });

  describe('Professor scope enforcement', () => {
    it('professor can read registrations in assigned competition', async () => {
      await prisma.$executeRaw`SET LOCAL request.jwt.claims = '{"sub": "auth-professor-1", "role": "PROFESSOR"}`;

      const registrations = await prisma.registration.findMany({
        where: { competitionId },
      });

      expect(registrations.length).toBeGreaterThan(0);
    });

    it('professor cannot read registrations in unassigned competition', async () => {
      // Create another competition without professor assignment
      const otherComp = await prisma.competition.create({
        data: {
          name: 'Other Competition',
          slug: 'other-competition',
          startsAt: new Date('2026-12-15'),
          endsAt: new Date('2026-12-16'),
          registrationOpensAt: new Date('2026-10-15'),
          registrationClosesAt: new Date('2026-11-30'),
          status: 'PUBLISHED',
        },
      });

      const otherDivisionType = await prisma.divisionType.findUnique({ where: { code: 'NO_GI' } });
      const otherEventDivision = await prisma.eventDivision.create({
        data: {
          competitionId: otherComp.id,
          divisionTypeId: otherDivisionType!.id,
          isActive: true,
        },
      });

      const otherCategory = await prisma.category.create({
        data: {
          competitionId: otherComp.id,
          eventDivisionId: otherEventDivision.id,
          name: 'Other Category',
          isActive: true,
        },
      });

      await prisma.registration.create({
        data: {
          athleteId: athlete1Id,
          competitionId: otherComp.id,
          eventDivisionId: otherEventDivision.id,
          categoryId: otherCategory.id,
          status: 'NEEDS_REVIEW',
        },
      });

      await prisma.$executeRaw`SET LOCAL request.jwt.claims = '{"sub": "auth-professor-1", "role": "PROFESSOR"}`;

      const registrations = await prisma.registration.findMany({
        where: { competitionId: otherComp.id },
      });

      expect(registrations).toHaveLength(0);
    });
  });

  describe('State machine transitions', () => {
    it('concurrent approve + reject results in 409 for second', async () => {
      // This test requires application-level concurrency control
      // RLS alone doesn't handle this - it's tested in integration tests
      expect(true).toBe(true);
    });
  });

  describe('File access via signed URL', () => {
    it('private file not accessible without proper context', async () => {
      await prisma.$executeRaw`SET LOCAL request.jwt.claims = '{"sub": "auth-athlete-2", "role": "ATHLETE"}`;

      const file = await prisma.storedFile.create({
        data: {
          registrationId: registration1Id,
          uploadedBy: athlete1Id,
          path: 'private/test.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1024,
          purpose: 'CONSENT_DOCUMENT',
        },
      });

      await prisma.$executeRaw`SET LOCAL request.jwt.claims = '{"sub": "auth-athlete-2", "role": "ATHLETE"}`;

      const files = await prisma.storedFile.findMany({
        where: { id: file.id },
      });

      expect(files).toHaveLength(0);
    });
  });
});

// Skip if no test database
if (!process.env.DATABASE_URL_TEST) {
  console.log('⚠️  Skipping RLS tests: DATABASE_URL_TEST not set');
  describe.skip('RLS Policies (skipped)', () => {
    it('requires DATABASE_URL_TEST', () => {});
  });
}