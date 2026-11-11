import { IsString, IsOptional, IsUUID, IsEnum, IsDateString, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { RegistrationStatus, WeighInResult } from '@prisma/client';

export class CreateRegistrationDto {
  @IsString()
  @IsUUID()
  competitionId!: string;

  @IsString()
  @IsUUID()
  eventDivisionId!: string;

  @IsOptional()
  @IsString()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(30)
  @Max(150)
  declaredWeightKg?: number;
}

export class RegistrationFiltersDto {
  @IsOptional()
  @IsEnum(RegistrationStatus)
  status?: RegistrationStatus;

  @IsOptional()
  @IsString()
  @IsUUID()
  competitionId?: string;

  @IsOptional()
  @IsString()
  @IsUUID()
  eventDivisionId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class ApproveRegistrationDto {
  @IsOptional()
  @IsString()
  justification?: string;
}

export class RejectRegistrationDto {
  @IsString()
  justification!: string;
}

export class ReopenRegistrationDto {
  @IsString()
  justification!: string;
}

export class CancelRegistrationDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ResolveExceptionDto {
  @IsString()
  justification!: string;

  @IsString()
  exceptionScope!: string;

  @IsOptional()
  @IsString()
  correlationId?: string;
}

export class RecordWeighInDto {
  @Type(() => Number)
  @IsNumber()
  @Min(30)
  @Max(150)
  weightKg!: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsString()
  idempotencyKey!: string;
}

export class WeighInFiltersDto {
  @IsOptional()
  @IsEnum(WeighInResult)
  result?: WeighInResult;

  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;
}