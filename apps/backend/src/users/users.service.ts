import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User, Role, BeltRank } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByAuthUserId(authUserId: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { authUserId } });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async getProfileWithRelations(userId: string): Promise<(User & { athleteProfile: any; professorAssignments: any[] }) | null> {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        athleteProfile: true,
        professorAssignments: {
          where: { isActive: true },
          include: { competition: true },
        },
      },
    });
  }

  async createProfile(authUserId: string, email: string, fullName: string, role: Role = 'ATHLETE'): Promise<User> {
    return this.prisma.user.create({
      data: { authUserId, email, fullName, role },
    });
  }

  async updateProfile(userId: string, data: { fullName?: string }): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data,
    });
  }

  async completeAthleteProfile(userId: string, data: { birthDate: Date; beltRank: BeltRank; weightKg?: number; heightCm?: number; academy?: string }): Promise<any> {
    return this.prisma.athleteProfile.upsert({
      where: { userId },
      update: {
        birthDate: data.birthDate,
        beltRank: data.beltRank,
        weightKg: data.weightKg,
        heightCm: data.heightCm,
        academy: data.academy,
      },
      create: {
        userId,
        birthDate: data.birthDate,
        beltRank: data.beltRank,
        weightKg: data.weightKg,
        heightCm: data.heightCm,
        academy: data.academy,
      },
    });
  }

  async assignProfessorToCompetition(professorId: string, competitionId: string): Promise<any> {
    return this.prisma.professorAssignment.upsert({
      where: { professorId_competitionId: { professorId, competitionId } },
      update: { isActive: true },
      create: { professorId, competitionId, isActive: true },
    });
  }

  async removeProfessorFromCompetition(professorId: string, competitionId: string): Promise<any> {
    return this.prisma.professorAssignment.update({
      where: { professorId_competitionId: { professorId, competitionId } },
      data: { isActive: false },
    });
  }

  async getAssignedCompetitions(professorId: string): Promise<string[]> {
    const assignments = await this.prisma.professorAssignment.findMany({
      where: { professorId, isActive: true },
      select: { competitionId: true },
    });
    return assignments.map((a) => a.competitionId);
  }

  async isProfessorAssignedToCompetition(professorId: string, competitionId: string): Promise<boolean> {
    const assignment = await this.prisma.professorAssignment.findUnique({
      where: { professorId_competitionId: { professorId, competitionId } },
    });
    return assignment?.isActive === true;
  }
}