import { IsString, IsOptional, IsDateString, IsEnum, IsBoolean, IsInt, Min, ValidateNested, IsArray, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { CompetitionStatus } from '@prisma/client';

export class CompetitionConfigDto {
  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  regulation?: string;

  @IsOptional()
  @IsString()
  timezone?: string;
}

export class CreateCompetitionDto {
  @IsString()
  name!: string;

  @IsString()
  slug!: string;

  @IsDateString()
  startsAt!: string;

  @IsDateString()
  endsAt!: string;

  @IsDateString()
  registrationOpensAt!: string;

  @IsDateString()
  registrationClosesAt!: string;

  @IsOptional()
  @IsDateString()
  cancellationDeadline?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CompetitionConfigDto)
  config?: CompetitionConfigDto;
}

export class UpdateCompetitionDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  regulation?: string;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @IsOptional()
  @IsDateString()
  registrationOpensAt?: string;

  @IsOptional()
  @IsDateString()
  registrationClosesAt?: string;

  @IsOptional()
  @IsDateString()
  cancellationDeadline?: string;

  @IsOptional()
  @IsEnum(CompetitionStatus)
  status?: CompetitionStatus;

  @IsOptional()
  @IsString()
  timezone?: string;
}

export class CreateEventDivisionDto {
  @IsString()
  @IsUUID()
  divisionTypeId!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  config?: Record<string, any>; // Absoluto rules, weight limits, etc.
}

export class UpdateEventDivisionDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  config?: Record<string, any>;
}

export class CreateCategoryDto {
  @IsString()
  @IsUUID()
  eventDivisionId!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  minAge?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxAge?: number;

  @IsOptional()
  @Type(() => Number)
  minWeightKg?: number;

  @IsOptional()
  @Type(() => Number)
  maxWeightKg?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  beltRanks?: string[];

  @IsOptional()
  @IsString()
  gender?: string; // M, F, MIXED

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  minAge?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxAge?: number;

  @IsOptional()
  @Type(() => Number)
  minWeightKg?: number;

  @IsOptional()
  @Type(() => Number)
  maxWeightKg?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  beltRanks?: string[];

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CategoryEligibilityQueryDto {
  @IsString()
  @IsUUID()
  eventDivisionId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  age?: number;

  @IsOptional()
  @Type(() => Number)
  weightKg?: number;

  @IsOptional()
  @IsString()
  beltRank?: string;

  @IsOptional()
  @IsString()
  gender?: string;
}