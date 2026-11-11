import { Controller, Get, Post, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { RegistrationsService } from './registrations.service';
import { SupabaseJwtGuard } from '../common/guards/supabase-jwt.guard';
import { OrganizerGuard } from '../common/guards/organizer.guard';
import { CompetitionScopeGuard } from '../common/guards/competition-scope.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateRegistrationDto, RegistrationFiltersDto, ApproveRegistrationDto, RejectRegistrationDto, ReopenRegistrationDto, CancelRegistrationDto, ResolveExceptionDto } from './dto/registration.dto';

@ApiTags('registrations')
@ApiBearerAuth('access-token')
@Controller('registrations')
export class RegistrationsController {
  constructor(private readonly registrationsService: RegistrationsService) {}

  @Post()
  @UseGuards(SupabaseJwtGuard)
  @ApiOperation({ summary: 'Create a registration in a division' })
  @ApiResponse({ status: 201, description: 'Registration created' })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 409, description: 'Duplicate registration in same division' })
  @ApiResponse({ status: 422, description: 'Registration period not open or profile incomplete' })
  async create(@Body() data: CreateRegistrationDto, @CurrentUser('userId') athleteId: string) {
    const registration = await this.registrationsService.create(athleteId, data);
    return { registration };
  }

  @Get()
  @UseGuards(SupabaseJwtGuard)
  @ApiOperation({ summary: 'List authenticated user\'s registrations' })
  @ApiQuery({ name: 'status', required: false, enum: ['NEEDS_REVIEW', 'CONFIRMED', 'REJECTED', 'CANCELLED'] })
  @ApiQuery({ name: 'competitionId', required: false })
  @ApiQuery({ name: 'eventDivisionId', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'List of registrations' })
  async findAll(@CurrentUser('userId') athleteId: string, @Query() filters: RegistrationFiltersDto) {
    const result = await this.registrationsService.findAll(athleteId, filters);
    return result;
  }

  @Get(':id')
  @UseGuards(SupabaseJwtGuard)
  @ApiOperation({ summary: 'Get registration details (authorized)' })
  @ApiParam({ name: 'id', description: 'Registration ID' })
  @ApiResponse({ status: 200, description: 'Registration details' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Registration not found' })
  async findById(@Param('id') id: string, @CurrentUser() user: any) {
    const registration = await this.registrationsService.findById(id, user.userId, user.role);
    return { registration };
  }

  @Post(':id/cancel')
  @UseGuards(SupabaseJwtGuard)
  @ApiOperation({ summary: 'Request cancellation (athlete only)' })
  @ApiParam({ name: 'id', description: 'Registration ID' })
  @ApiResponse({ status: 200, description: 'Registration cancelled' })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 403, description: 'Forbidden - not own registration' })
  @ApiResponse({ status: 409, description: 'Already cancelled' })
  @ApiResponse({ status: 422, description: 'Past deadline or invalid state' })
  async cancel(@Param('id') id: string, @CurrentUser('userId') athleteId: string, @Body() data: CancelRegistrationDto) {
    const registration = await this.registrationsService.cancel(id, athleteId, data);
    return { registration };
  }

  @Post(':id/approve')
  @UseGuards(SupabaseJwtGuard, CompetitionScopeGuard)
  @ApiOperation({ summary: 'Approve registration review (professor only)' })
  @ApiParam({ name: 'id', description: 'Registration ID' })
  @ApiResponse({ status: 200, description: 'Registration approved' })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 403, description: 'Forbidden - not assigned professor' })
  @ApiResponse({ status: 409, description: 'Invalid state transition' })
  @ApiResponse({ status: 422, description: 'Eligibility requirements not met' })
  async approve(@Param('id') id: string, @CurrentUser('userId') professorId: string, @Body() data: ApproveRegistrationDto) {
    const registration = await this.registrationsService.approve(id, professorId, data);
    return { registration };
  }

  @Post(':id/reject')
  @UseGuards(SupabaseJwtGuard, CompetitionScopeGuard)
  @ApiOperation({ summary: 'Reject registration with justification (professor only)' })
  @ApiParam({ name: 'id', description: 'Registration ID' })
  @ApiResponse({ status: 200, description: 'Registration rejected' })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 403, description: 'Forbidden - not assigned professor' })
  @ApiResponse({ status: 409, description: 'Invalid state transition' })
  async reject(@Param('id') id: string, @CurrentUser('userId') professorId: string, @Body() data: RejectRegistrationDto) {
    const registration = await this.registrationsService.reject(id, professorId, data);
    return { registration };
  }

  @Post(':id/reopen')
  @UseGuards(SupabaseJwtGuard, CompetitionScopeGuard)
  @ApiOperation({ summary: 'Reopen rejected registration (professor only)' })
  @ApiParam({ name: 'id', description: 'Registration ID' })
  @ApiResponse({ status: 200, description: 'Registration reopened to needs_review' })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 403, description: 'Forbidden - not assigned professor' })
  @ApiResponse({ status: 409, description: 'Invalid state transition' })
  async reopen(@Param('id') id: string, @CurrentUser('userId') professorId: string, @Body() data: ReopenRegistrationDto) {
    const registration = await this.registrationsService.reopen(id, professorId, data);
    return { registration };
  }

  @Post(':id/resolve-exception')
  @UseGuards(SupabaseJwtGuard, OrganizerGuard)
  @ApiOperation({ summary: 'Resolve exception for cancelled registration (organizer/admin only)' })
  @ApiParam({ name: 'id', description: 'Registration ID' })
  @ApiResponse({ status: 200, description: 'Exception resolved, registration back to needs_review' })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 403, description: 'Forbidden - organizer/admin required' })
  @ApiResponse({ status: 409, description: 'Invalid state transition' })
  async resolveException(@Param('id') id: string, @CurrentUser('userId') organizerId: string, @Body() data: ResolveExceptionDto) {
    const registration = await this.registrationsService.resolveException(id, organizerId, data);
    return { registration };
  }

  @Get(':id/snapshot')
  @UseGuards(SupabaseJwtGuard)
  @ApiOperation({ summary: 'Get registration rule snapshot' })
  @ApiParam({ name: 'id', description: 'Registration ID' })
  @ApiResponse({ status: 200, description: 'Snapshot of rules at registration time' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getSnapshot(@Param('id') id: string) {
    const snapshot = await this.registrationsService.getSnapshot(id);
    return { snapshot };
  }

  @Get(':id/snapshot/status')
  @UseGuards(SupabaseJwtGuard)
  @ApiOperation({ summary: 'Check if registration snapshot is current' })
  @ApiParam({ name: 'id', description: 'Registration ID' })
  @ApiResponse({ status: 200, description: 'Snapshot currency status' })
  async isSnapshotCurrent(@Param('id') id: string) {
    const result = await this.registrationsService.isSnapshotCurrent(id);
    return result;
  }
}