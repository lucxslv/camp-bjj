import { IsString, IsOptional, IsDateString, IsEnum, IsBoolean, IsInt, Min, ValidateNested, IsArray, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CompetitionStatus } from '@prisma/client';

export class CompetitionConfigDto {
  @ApiPropertyOptional({ description: 'Competition description', example: 'Campeonato de BJJ 2026' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Regulation text', example: 'Regras oficiais da IBJJF...' })
  @IsOptional()
  @IsString()
  regulation?: string;

  @ApiPropertyOptional({ description: 'Timezone', example: 'America/Sao_Paulo' })
  @IsOptional()
  @IsString()
  timezone?: string;
}

export class CreateCompetitionDto {
  @ApiProperty({ description: 'Competition name', example: 'Copa São Paulo 2026' })
  @IsString()
  name!: string;

  @ApiProperty({ description: 'URL-friendly slug', example: 'copa-sao-paulo-2026' })
  @IsString()
  slug!: string;

  @ApiProperty({ description: 'Start date (ISO)', example: '2026-12-01T08:00:00.000Z' })
  @IsDateString()
  startsAt!: string;

  @ApiProperty({ description: 'End date (ISO)', example: '2026-12-02T18:00:00.000Z' })
  @IsDateString()
  endsAt!: string;

  @ApiProperty({ description: 'Registration opens (ISO)', example: '2026-10-01T00:00:00.000Z' })
  @IsDateString()
  registrationOpensAt!: string;

  @ApiProperty({ description: 'Registration closes (ISO)', example: '2026-11-15T23:59:59.000Z' })
  @IsDateString()
  registrationClosesAt!: string;

  @ApiPropertyOptional({ description: 'Cancellation deadline (ISO)', example: '2026-11-20T23:59:59.000Z' })
  @IsOptional()
  @IsDateString()
  cancellationDeadline?: string;

  @ApiPropertyOptional({ description: 'Additional configuration' })
  @IsOptional()
  @ValidateNested()
  @Type(() => CompetitionConfigDto)
  config?: CompetitionConfigDto;
}

export class UpdateCompetitionDto {
  @ApiPropertyOptional({ description: 'Competition name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Regulation text' })
  @IsOptional()
  @IsString()
  regulation?: string;

  @ApiPropertyOptional({ description: 'Start date (ISO)' })
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiPropertyOptional({ description: 'End date (ISO)' })
  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @ApiPropertyOptional({ description: 'Registration opens (ISO)' })
  @IsOptional()
  @IsDateString()
  registrationOpensAt?: string;

  @ApiPropertyOptional({ description: 'Registration closes (ISO)' })
  @IsOptional()
  @IsDateString()
  registrationClosesAt?: string;

  @ApiPropertyOptional({ description: 'Cancellation deadline (ISO)' })
  @IsOptional()
  @IsDateString()
  cancellationDeadline?: string;

  @ApiPropertyOptional({ description: 'Competition status', enum: CompetitionStatus })
  @IsOptional()
  @IsEnum(CompetitionStatus)
  status?: CompetitionStatus;

  @ApiPropertyOptional({ description: 'Timezone', example: 'America/Sao_Paulo' })
  @IsOptional()
  @IsString()
  timezone?: string;
}

export class CreateEventDivisionDto {
  @ApiProperty({ description: 'Division type ID', example: 'div-type-123' })
  @IsString()
  @IsUUID()
  divisionTypeId!: string;

  @ApiPropertyOptional({ description: 'Whether division is active', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Division configuration (Absoluto rules, weight limits, etc.)' })
  @IsOptional()
  config?: Record<string, any>;
}

export class UpdateEventDivisionDto {
  @ApiPropertyOptional({ description: 'Whether division is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Division configuration' })
  @IsOptional()
  config?: Record<string, any>;
}

export class CreateCategoryDto {
  @ApiProperty({ description: 'Event division ID', example: 'event-div-123' })
  @IsString()
  @IsUUID()
  eventDivisionId!: string;

  @ApiProperty({ description: 'Category name', example: 'Adult Blue Gi -76kg' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ description: 'Minimum age', example: 18 })
  @IsOptional()
  @IsInt()
  @Min(0)
  minAge?: number;

  @ApiPropertyOptional({ description: 'Maximum age', example: 29 })
  @IsOptional()
  @IsInt()
  @Min(0)
  maxAge?: number;

  @ApiPropertyOptional({ description: 'Minimum weight (kg)', example: 70 })
  @IsOptional()
  @Type(() => Number)
  minWeightKg?: number;

  @ApiPropertyOptional({ description: 'Maximum weight (kg)', example: 76 })
  @IsOptional()
  @Type(() => Number)
  maxWeightKg?: number;

  @ApiPropertyOptional({ description: 'Allowed belt ranks', example: ['BLUE'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  beltRanks?: string[];

  @ApiPropertyOptional({ description: 'Gender (M, F, MIXED)', example: 'M' })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional({ description: 'Whether category is active', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateCategoryDto {
  @ApiPropertyOptional({ description: 'Category name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Minimum age' })
  @IsOptional()
  @IsInt()
  @Min(0)
  minAge?: number;

  @ApiPropertyOptional({ description: 'Maximum age' })
  @IsOptional()
  @IsInt()
  @Min(0)
  maxAge?: number;

  @ApiPropertyOptional({ description: 'Minimum weight (kg)' })
  @IsOptional()
  @Type(() => Number)
  minWeightKg?: number;

  @ApiPropertyOptional({ description: 'Maximum weight (kg)' })
  @IsOptional()
  @Type(() => Number)
  maxWeightKg?: number;

  @ApiPropertyOptional({ description: 'Allowed belt ranks' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  beltRanks?: string[];

  @ApiPropertyOptional({ description: 'Gender (M, F, MIXED)' })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional({ description: 'Whether category is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CategoryEligibilityQueryDto {
  @ApiProperty({ description: 'Event division ID', example: 'event-div-123' })
  @IsString()
  @IsUUID()
  eventDivisionId!: string;

  @ApiPropertyOptional({ description: 'Athlete age', example: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  age?: number;

  @ApiPropertyOptional({ description: 'Athlete weight (kg)', example: 75.5 })
  @IsOptional()
  @Type(() => Number)
  weightKg?: number;

  @ApiPropertyOptional({ description: 'Athlete belt rank', example: 'BLUE' })
  @IsOptional()
  @IsString()
  beltRank?: string;

  @ApiPropertyOptional({ description: 'Gender (M, F, MIXED)', example: 'M' })
  @IsOptional()
  @IsString()
  gender?: string;
}