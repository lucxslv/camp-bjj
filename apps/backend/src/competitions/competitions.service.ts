import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Competition, CompetitionStatus, DivisionType, EventDivision, Category, BeltRank, Gender } from '@prisma/client';
import { CreateCompetitionDto, UpdateCompetitionDto, CreateEventDivisionDto, UpdateEventDivisionDto, CreateCategoryDto, UpdateCategoryDto } from './dto/competition.dto';

@Injectable()
export class CompetitionsService {
  constructor(private readonly prisma: PrismaService) {}

  // Competition CRUD
  async create(data: CreateCompetitionDto): Promise<Competition> {
    return this.prisma.competition.create({
      data: {
        name: data.name,
        slug: data.slug,
        description: data.config?.description,
        regulation: data.config?.regulation,
        startsAt: new Date(data.startsAt),
        endsAt: new Date(data.endsAt),
        registrationOpensAt: new Date(data.registrationOpensAt),
        registrationClosesAt: new Date(data.registrationClosesAt),
        cancellationDeadline: data.cancellationDeadline ? new Date(data.cancellationDeadline) : null,
        timezone: data.config?.timezone || 'America/Sao_Paulo',
        status: 'DRAFT',
      },
    });
  }

  async findAll(filters?: { status?: CompetitionStatus; upcoming?: boolean }): Promise<Competition[]> {
    const where: any = {};

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.upcoming) {
      where.startsAt = { gte: new Date() };
      where.status = { in: ['PUBLISHED', 'ONGOING'] };
    }

    return this.prisma.competition.findMany({
      where,
      orderBy: { startsAt: 'asc' },
      include: {
        eventDivisions: {
          where: { isActive: true },
          include: { divisionType: true },
        },
      },
    });
  }

  async findById(id: string): Promise<Competition | null> {
    return this.prisma.competition.findUnique({
      where: { id },
      include: {
        eventDivisions: {
          where: { isActive: true },
          include: { divisionType: true, categories: { where: { isActive: true } } },
        },
        categories: { where: { isActive: true } },
        professorAssignments: { where: { isActive: true }, include: { professor: true } },
      },
    });
  }

  async findBySlug(slug: string): Promise<Competition | null> {
    return this.prisma.competition.findUnique({
      where: { slug },
      include: {
        eventDivisions: {
          where: { isActive: true },
          include: { divisionType: true, categories: { where: { isActive: true } } },
        },
      },
    });
  }

  async update(id: string, data: UpdateCompetitionDto, userRole: string): Promise<Competition> {
    const competition = await this.prisma.competition.findUnique({ where: { id } });
    if (!competition) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Competition not found',
      });
    }

    // Check permissions
    if (userRole !== 'ADMIN' && userRole !== 'ORGANIZER') {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'Only organizers and admins can update competitions',
      });
    }

    return this.prisma.competition.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        regulation: data.regulation,
        startsAt: data.startsAt ? new Date(data.startsAt) : undefined,
        endsAt: data.endsAt ? new Date(data.endsAt) : undefined,
        registrationOpensAt: data.registrationOpensAt ? new Date(data.registrationOpensAt) : undefined,
        registrationClosesAt: data.registrationClosesAt ? new Date(data.registrationClosesAt) : undefined,
        cancellationDeadline: data.cancellationDeadline ? new Date(data.cancellationDeadline) : undefined,
        status: data.status,
        timezone: data.timezone,
      },
    });
  }

  async publish(id: string, userRole: string): Promise<Competition> {
    return this.update(id, { status: 'PUBLISHED' }, userRole);
  }

  // Division Types (catalog)
  async getDivisionTypes(): Promise<DivisionType[]> {
    return this.prisma.divisionType.findMany({
      where: { isStandard: true },
      orderBy: { code: 'asc' },
    });
  }

  // Event Divisions
  async createEventDivision(competitionId: string, data: CreateEventDivisionDto, userRole: string): Promise<EventDivision> {
    const competition = await this.prisma.competition.findUnique({ where: { id: competitionId } });
    if (!competition) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Competition not found',
      });
    }

    if (userRole !== 'ADMIN' && userRole !== 'ORGANIZER') {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'Only organizers and admins can manage divisions',
      });
    }

    const divisionType = await this.prisma.divisionType.findUnique({ where: { id: data.divisionTypeId } });
    if (!divisionType) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Division type not found',
      });
    }

    return this.prisma.eventDivision.create({
      data: {
        competitionId,
        divisionTypeId: data.divisionTypeId,
        config: data.config,
        isActive: data.isActive ?? true,
      },
      include: { divisionType: true },
    });
  }

  async updateEventDivision(competitionId: string, eventDivisionId: string, data: UpdateEventDivisionDto, userRole: string): Promise<EventDivision> {
    const eventDivision = await this.prisma.eventDivision.findUnique({
      where: { id: eventDivisionId },
    });

    if (!eventDivision || eventDivision.competitionId !== competitionId) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Event division not found',
      });
    }

    if (userRole !== 'ADMIN' && userRole !== 'ORGANIZER') {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'Only organizers and admins can manage divisions',
      });
    }

    return this.prisma.eventDivision.update({
      where: { id: eventDivisionId },
      data: {
        isActive: data.isActive,
        config: data.config,
      },
      include: { divisionType: true },
    });
  }

  async getEventDivisions(competitionId: string): Promise<EventDivision[]> {
    return this.prisma.eventDivision.findMany({
      where: { competitionId, isActive: true },
      include: { divisionType: true, categories: { where: { isActive: true } } },
      orderBy: { divisionType: { code: 'asc' } },
    });
  }

  // Categories
  async createCategory(competitionId: string, data: CreateCategoryDto, userRole: string): Promise<Category> {
    const eventDivision = await this.prisma.eventDivision.findUnique({
      where: { id: data.eventDivisionId },
    });

    if (!eventDivision || eventDivision.competitionId !== competitionId) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Event division not found in this competition',
      });
    }

    if (userRole !== 'ADMIN' && userRole !== 'ORGANIZER') {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'Only organizers and admins can manage categories',
      });
    }

    return this.prisma.category.create({
      data: {
        competitionId,
        eventDivisionId: data.eventDivisionId,
        name: data.name,
        minAge: data.minAge,
        maxAge: data.maxAge,
        minWeightKg: data.minWeightKg,
        maxWeightKg: data.maxWeightKg,
        beltRanks: (data.beltRanks as BeltRank[]) || [],
        gender: data.gender as Gender,
        isActive: data.isActive ?? true,
      },
    });
  }

  async updateCategory(competitionId: string, categoryId: string, data: UpdateCategoryDto, userRole: string): Promise<Category> {
    const category = await this.prisma.category.findUnique({ where: { id: categoryId } });

    if (!category || category.competitionId !== competitionId) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Category not found in this competition',
      });
    }

    if (userRole !== 'ADMIN' && userRole !== 'ORGANIZER') {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'Only organizers and admins can manage categories',
      });
    }

    // Increment snapshot version for audit trail
    return this.prisma.category.update({
      where: { id: categoryId },
      data: {
        name: data.name,
        minAge: data.minAge,
        maxAge: data.maxAge,
        minWeightKg: data.minWeightKg,
        maxWeightKg: data.maxWeightKg,
        beltRanks: data.beltRanks as BeltRank[],
        gender: data.gender as Gender,
        isActive: data.isActive,
        snapshotVersion: { increment: 1 },
      },
    });
  }

  async getCategories(competitionId: string, eventDivisionId?: string): Promise<Category[]> {
    return this.prisma.category.findMany({
      where: {
        competitionId,
        isActive: true,
        ...(eventDivisionId && { eventDivisionId }),
      },
      orderBy: [{ minWeightKg: 'asc' }, { minAge: 'asc' }],
    });
  }

  async getCategoriesByEventDivision(eventDivisionId: string): Promise<Category[]> {
    return this.prisma.category.findMany({
      where: { eventDivisionId, isActive: true },
      orderBy: [{ minWeightKg: 'asc' }, { minAge: 'asc' }],
    });
  }

  // Snapshot versioning
  async incrementCategorySnapshot(competitionId: string): Promise<void> {
    await this.prisma.category.updateMany({
      where: { competitionId },
      data: { snapshotVersion: { increment: 1 } },
    });
  }
}