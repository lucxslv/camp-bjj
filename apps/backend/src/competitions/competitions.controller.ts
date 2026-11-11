import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { CompetitionsService } from './competitions.service';
import { SupabaseJwtGuard } from '../common/guards/supabase-jwt.guard';
import { OrganizerGuard } from '../common/guards/organizer.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateCompetitionDto, UpdateCompetitionDto, CreateEventDivisionDto, UpdateEventDivisionDto, CreateCategoryDto, UpdateCategoryDto } from './dto/competition.dto';

@ApiTags('competitions')
@ApiBearerAuth('access-token')
@Controller('competitions')
export class CompetitionsController {
  constructor(private readonly competitionsService: CompetitionsService) {}

  @Post()
  @UseGuards(SupabaseJwtGuard, OrganizerGuard)
  @ApiOperation({ summary: 'Create a new competition (organizer/admin only)' })
  @ApiResponse({ status: 201, description: 'Competition created' })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 403, description: 'Forbidden - organizer/admin required' })
  async create(@Body() data: CreateCompetitionDto) {
    const competition = await this.competitionsService.create(data);
    return { competition };
  }

  @Get()
  @ApiOperation({ summary: 'List public competitions' })
  @ApiQuery({ name: 'status', required: false, enum: ['DRAFT', 'PUBLISHED', 'ONGOING', 'FINISHED', 'CANCELLED'] })
  @ApiQuery({ name: 'upcoming', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'List of competitions' })
  async findAll(@Query('status') status?: string, @Query('upcoming') upcoming?: string) {
    const competitions = await this.competitionsService.findAll({
      status: status as any,
      upcoming: upcoming === 'true',
    });
    return { competitions };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get competition details' })
  @ApiParam({ name: 'id', description: 'Competition ID' })
  @ApiResponse({ status: 200, description: 'Competition details' })
  @ApiResponse({ status: 404, description: 'Competition not found' })
  async findById(@Param('id') id: string) {
    const competition = await this.competitionsService.findById(id);
    if (!competition) {
      return { competition: null };
    }
    return { competition };
  }

  @Get('slug/:slug')
  @ApiOperation({ summary: 'Get competition by slug' })
  @ApiParam({ name: 'slug', description: 'Competition slug' })
  @ApiResponse({ status: 200, description: 'Competition details' })
  @ApiResponse({ status: 404, description: 'Competition not found' })
  async findBySlug(@Param('slug') slug: string) {
    const competition = await this.competitionsService.findBySlug(slug);
    return { competition };
  }

  @Patch(':id')
  @UseGuards(SupabaseJwtGuard, OrganizerGuard)
  @ApiOperation({ summary: 'Update competition (organizer/admin only)' })
  @ApiParam({ name: 'id', description: 'Competition ID' })
  @ApiResponse({ status: 200, description: 'Competition updated' })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Competition not found' })
  async update(@Param('id') id: string, @Body() data: UpdateCompetitionDto, @CurrentUser() user: any) {
    const competition = await this.competitionsService.update(id, data, user.role);
    return { competition };
  }

  @Get('division-types')
  @ApiOperation({ summary: 'Get standard division types catalog' })
  @ApiResponse({ status: 200, description: 'List of division types' })
  async getDivisionTypes() {
    const divisionTypes = await this.competitionsService.getDivisionTypes();
    return { divisionTypes };
  }

  @Post(':competitionId/divisions')
  @UseGuards(SupabaseJwtGuard, OrganizerGuard)
  @ApiOperation({ summary: 'Enable/configure a division in a competition (organizer/admin only)' })
  @ApiParam({ name: 'competitionId', description: 'Competition ID' })
  @ApiResponse({ status: 201, description: 'Division enabled' })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Competition or division type not found' })
  async createEventDivision(@Param('competitionId') competitionId: string, @Body() data: CreateEventDivisionDto, @CurrentUser() user: any) {
    const eventDivision = await this.competitionsService.createEventDivision(competitionId, data, user.role);
    return { eventDivision };
  }

  @Patch(':competitionId/divisions/:eventDivisionId')
  @UseGuards(SupabaseJwtGuard, OrganizerGuard)
  @ApiOperation({ summary: 'Update division configuration (organizer/admin only)' })
  @ApiParam({ name: 'competitionId', description: 'Competition ID' })
  @ApiParam({ name: 'eventDivisionId', description: 'Event Division ID' })
  @ApiResponse({ status: 200, description: 'Division updated' })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Division not found' })
  async updateEventDivision(@Param('competitionId') competitionId: string, @Param('eventDivisionId') eventDivisionId: string, @Body() data: UpdateEventDivisionDto, @CurrentUser() user: any) {
    const eventDivision = await this.competitionsService.updateEventDivision(competitionId, eventDivisionId, data, user.role);
    return { eventDivision };
  }

  @Get(':competitionId/divisions')
  @ApiOperation({ summary: 'Get enabled divisions for a competition' })
  @ApiParam({ name: 'competitionId', description: 'Competition ID' })
  @ApiResponse({ status: 200, description: 'List of event divisions' })
  async getEventDivisions(@Param('competitionId') competitionId: string) {
    const eventDivisions = await this.competitionsService.getEventDivisions(competitionId);
    return { eventDivisions };
  }

  @Post(':competitionId/categories')
  @UseGuards(SupabaseJwtGuard, OrganizerGuard)
  @ApiOperation({ summary: 'Create a category in a competition division (organizer/admin only)' })
  @ApiParam({ name: 'competitionId', description: 'Competition ID' })
  @ApiResponse({ status: 201, description: 'Category created' })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Competition or event division not found' })
  async createCategory(@Param('competitionId') competitionId: string, @Body() data: CreateCategoryDto, @CurrentUser() user: any) {
    const category = await this.competitionsService.createCategory(competitionId, data, user.role);
    return { category };
  }

  @Patch(':competitionId/categories/:categoryId')
  @UseGuards(SupabaseJwtGuard, OrganizerGuard)
  @ApiOperation({ summary: 'Update a category (organizer/admin only)' })
  @ApiParam({ name: 'competitionId', description: 'Competition ID' })
  @ApiParam({ name: 'categoryId', description: 'Category ID' })
  @ApiResponse({ status: 200, description: 'Category updated' })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async updateCategory(@Param('competitionId') competitionId: string, @Param('categoryId') categoryId: string, @Body() data: UpdateCategoryDto, @CurrentUser() user: any) {
    const category = await this.competitionsService.updateCategory(competitionId, categoryId, data, user.role);
    return { category };
  }

  @Get(':competitionId/categories')
  @ApiOperation({ summary: 'Get published/eligible categories for a competition' })
  @ApiParam({ name: 'competitionId', description: 'Competition ID' })
  @ApiQuery({ name: 'eventDivisionId', required: false, description: 'Filter by event division' })
  @ApiResponse({ status: 200, description: 'List of categories' })
  async getCategories(@Param('competitionId') competitionId: string, @Query('eventDivisionId') eventDivisionId?: string) {
    const categories = eventDivisionId
      ? await this.competitionsService.getCategoriesByEventDivision(eventDivisionId)
      : await this.competitionsService.getCategories(competitionId, eventDivisionId);
    return { categories };
  }
}