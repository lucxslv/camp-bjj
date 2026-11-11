import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { User, Role } from '@prisma/client';

export interface JwtPayload {
  sub: string; // Supabase auth user ID
  email: string;
  role?: string;
  [key: string]: unknown;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async validateToken(token: string): Promise<JwtPayload> {
    try {
      const secret = this.configService.get<string>('SUPABASE_JWT_SECRET') || this.configService.get<string>('JWT_SECRET');
      const payload = this.jwtService.verify(token, { secret });
      return payload as JwtPayload;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Token validation failed: ${message}`);
      throw new UnauthorizedException({
        statusCode: 401,
        code: 'UNAUTHENTICATED',
        message: 'Invalid or expired token',
      });
    }
  }

  async syncUserProfile(payload: JwtPayload): Promise<User> {
    // Find or create user profile linked to Supabase auth
    let user = await this.prisma.user.findUnique({
      where: { authUserId: payload.sub },
    });

    if (!user) {
      const userMetadata = (payload as Record<string, unknown>)['user_metadata'] as Record<string, unknown> | undefined;
      const fullName = (userMetadata?.['full_name'] as string) || payload.email.split('@')[0] || 'User';
      user = await this.prisma.user.create({
        data: {
          authUserId: payload.sub,
          email: payload.email,
          fullName,
          role: (payload.role as Role) || 'ATHLETE',
        },
      });
      this.logger.log(`Created new user profile for ${payload.email}`);
    }

    return user;
  }

  async getUserProfile(authUserId: string): Promise<(User & { athleteProfile: any; professorAssignments: any[] }) | null> {
    return this.prisma.user.findUnique({
      where: { authUserId },
      include: {
        athleteProfile: true,
        professorAssignments: {
          where: { isActive: true },
          include: { competition: true },
        },
      },
    });
  }

  async completeProfile(authUserId: string, data: { fullName?: string; birthDate?: string | Date; beltRank?: string; weightKg?: number }): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { authUserId } });
    if (!user) {
      throw new UnauthorizedException({
        statusCode: 401,
        code: 'UNAUTHENTICATED',
        message: 'User profile not found',
      });
    }

    // Update user
    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        fullName: data.fullName || user.fullName,
      },
    });

    // Create or update athlete profile
    if (data.birthDate || data.beltRank || data.weightKg) {
      await this.prisma.athleteProfile.upsert({
        where: { userId: user.id },
        update: {
          birthDate: data.birthDate ? new Date(data.birthDate) : undefined,
          beltRank: data.beltRank as any,
          weightKg: data.weightKg,
        },
        create: {
          userId: user.id,
          birthDate: data.birthDate ? new Date(data.birthDate) : new Date(),
          beltRank: (data.beltRank as any) || 'WHITE',
          weightKg: data.weightKg,
        },
      });
    }

    return updatedUser;
  }

  async updateProfile(userId: string, data: { fullName?: string }): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { fullName: data.fullName },
    });
  }

  getAssignedCompetitionIds(user: User & { professorAssignments?: any[] }): string[] {
    return (user.professorAssignments || [])
      .filter((a: any) => a.isActive)
      .map((a: any) => a.competitionId);
  }

  isOrganizerOrAdmin(user: User): boolean {
    return user.role === 'ORGANIZER' || user.role === 'ADMIN';
  }

  isProfessor(user: User): boolean {
    return user.role === 'PROFESSOR';
  }
}