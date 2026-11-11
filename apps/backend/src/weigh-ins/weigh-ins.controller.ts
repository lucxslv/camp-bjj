import { Controller, Post, Get, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { WeighInsService } from './weigh-ins.service';
import { SupabaseJwtGuard } from '../common/guards/supabase-jwt.guard';
import { CompetitionScopeGuard } from '../common/guards/competition-scope.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RecordWeighInDto, WeighInFiltersDto } from '../registrations/dto/registration.dto';

@ApiTags('weigh-ins')
@ApiBearerAuth('access-token')
@Controller('registrations')
export class WeighInsController {
  constructor(private readonly weighInsService: WeighInsService) {}

  @Post(':id/weigh-ins')
  @UseGuards(SupabaseJwtGuard, CompetitionScopeGuard)
  @ApiOperation({ summary: 'Record a weigh-in (professor only)' })
  @ApiParam({ name: 'id', description: 'Registration ID' })
  @ApiResponse({ status: 201, description: 'Weigh-in recorded' })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 403, description: 'Forbidden - not assigned professor' })
  @ApiResponse({ status: 409, description: 'Idempotency conflict - weigh-in already recorded' })
  @ApiResponse({ status: 422, description: 'Invalid state for weigh-in' })
  async record(@Param('id') id: string, @CurrentUser('userId') professorId: string, @Body() data: RecordWeighInDto) {
    const weighIn = await this.weighInsService.record(id, professorId, data);
    return { weighIn };
  }

  @Get(':id/weigh-ins')
  @UseGuards(SupabaseJwtGuard)
  @ApiOperation({ summary: 'Get weigh-in history for a registration' })
  @ApiParam({ name: 'id', description: 'Registration ID' })
  @ApiQuery({ name: 'result', required: false, enum: ['VALID', 'INVALID_CATEGORY', 'PENDING_REVIEW'] })
  @ApiQuery({ name: 'fromDate', required: false, type: String })
  @ApiQuery({ name: 'toDate', required: false, type: String })
  @ApiResponse({ status: 200, description: 'List of weigh-ins' })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Registration not found' })
  async findByRegistration(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Query() filters: WeighInFiltersDto,
  ) {
    const weighIns = await this.weighInsService.findByRegistration(id, user.userId, user.role, filters);
    return { weighIns };
  }

  @Get(':registrationId/weigh-ins/:weighInId')
  @UseGuards(SupabaseJwtGuard)
  @ApiOperation({ summary: 'Get a specific weigh-in' })
  @ApiParam({ name: 'registrationId', description: 'Registration ID' })
  @ApiParam({ name: 'weighInId', description: 'Weigh-in ID' })
  @ApiResponse({ status: 200, description: 'Weigh-in details' })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Weigh-in not found' })
  async findById(@Param('registrationId') _registrationId: string, @Param('weighInId') weighInId: string, @CurrentUser() user: any) {
    const weighIn = await this.weighInsService.findById(weighInId, user.userId, user.role);
    if (!weighIn) {
      return { weighIn: null };
    }
    return { weighIn };
  }
}