import { IsString, IsOptional, IsUUID, IsEnum, IsDateString, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RegistrationStatus, WeighInResult } from '@prisma/client';

export class CreateRegistrationDto {
  @ApiProperty({ description: 'Competition ID', example: 'comp-123' })
  @IsString()
  @IsUUID()
  competitionId!: string;

  @ApiProperty({ description: 'Event division ID', example: 'event-div-123' })
  @IsString()
  @IsUUID()
  eventDivisionId!: string;

  @ApiPropertyOptional({ description: 'Category ID (optional, will be suggested by backend)', example: 'cat-123' })
  @IsOptional()
  @IsString()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Declared weight (kg)', example: 75.5, minimum: 30, maximum: 150 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(30)
  @Max(150)
  declaredWeightKg?: number;
}

export class RegistrationFiltersDto {
  @ApiPropertyOptional({ description: 'Filter by status', enum: RegistrationStatus })
  @IsOptional()
  @IsEnum(RegistrationStatus)
  status?: RegistrationStatus;

  @ApiPropertyOptional({ description: 'Filter by competition ID' })
  @IsOptional()
  @IsString()
  @IsUUID()
  competitionId?: string;

  @ApiPropertyOptional({ description: 'Filter by event division ID' })
  @IsOptional()
  @IsString()
  @IsUUID()
  eventDivisionId?: string;

  @ApiPropertyOptional({ description: 'Page number', minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page', minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class ApproveRegistrationDto {
  @ApiPropertyOptional({ description: 'Justification for approval', example: 'Elegibilidade verificada, consentimento válido' })
  @IsOptional()
  @IsString()
  justification?: string;
}

export class RejectRegistrationDto {
  @ApiProperty({ description: 'Justification for rejection (required)', example: 'Peso fora da categoria, atleta não possui graduação mínima' })
  @IsString()
  justification!: string;
}

export class ReopenRegistrationDto {
  @ApiProperty({ description: 'Justification for reopening (required)', example: 'Erro na avaliação anterior, nova documentação apresentada' })
  @IsString()
  justification!: string;
}

export class CancelRegistrationDto {
  @ApiPropertyOptional({ description: 'Reason for cancellation', example: 'Lesão impedindo participação' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ResolveExceptionDto {
  @ApiProperty({ description: 'Justification for exception (required)', example: 'Caso excepcional autorizado pela organização' })
  @IsString()
  justification!: string;

  @ApiProperty({ description: 'Scope of exception (required)', example: 'registration-id-123' })
  @IsString()
  exceptionScope!: string;

  @ApiPropertyOptional({ description: 'Correlation ID for audit trail' })
  @IsOptional()
  @IsString()
  correlationId?: string;
}

export class RecordWeighInDto {
  @ApiProperty({ description: 'Measured weight (kg)', example: 75.5, minimum: 30, maximum: 150 })
  @Type(() => Number)
  @IsNumber()
  @Min(30)
  @Max(150)
  weightKg!: number;

  @ApiPropertyOptional({ description: 'Weight unit', default: 'kg', example: 'kg' })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional({ description: 'Additional notes', example: 'Pesagem oficial realizada pelo professor João' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ description: 'Idempotency key (unique per weigh-in)', example: 'weighin-registration123-2026-11-15' })
  @IsString()
  idempotencyKey!: string;
}

export class WeighInFiltersDto {
  @ApiPropertyOptional({ description: 'Filter by result', enum: WeighInResult })
  @IsOptional()
  @IsEnum(WeighInResult)
  result?: WeighInResult;

  @ApiPropertyOptional({ description: 'Filter from date (ISO)' })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({ description: 'Filter to date (ISO)' })
  @IsOptional()
  @IsDateString()
  toDate?: string;
}