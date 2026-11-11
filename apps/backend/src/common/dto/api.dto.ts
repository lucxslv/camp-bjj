import { IsString, IsOptional, IsUUID, IsEnum, IsNumber, Min, Max, IsDateString, IsBoolean, ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CompetitionStatus, BeltRank, Gender, RegistrationStatus, WeighInResult, ConsentStatus, FilePurpose } from '@prisma/client';

export class CompetitionConfigDto {
  @ApiPropertyOptional({ description: 'Descrição da competição' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Regulamento (texto ou JSON)' })
  @IsOptional()
  @IsString()
  regulation?: string;

  @ApiPropertyOptional({ description: 'Timezone', default: 'America/Sao_Paulo' })
  @IsOptional()
  @IsString()
  timezone?: string;
}

export class CreateCompetitionDto {
  @ApiProperty({ description: 'Nome da competição' })
  @IsString()
  name!: string;

  @ApiProperty({ description: 'Slug único para URL' })
  @IsString()
  slug!: string;

  @ApiProperty({ description: 'Data/hora de início', example: '2026-12-01T08:00:00Z' })
  @IsDateString()
  startsAt!: string;

  @ApiProperty({ description: 'Data/hora de fim', example: '2026-12-02T18:00:00Z' })
  @IsDateString()
  endsAt!: string;

  @ApiProperty({ description: 'Abertura das inscrições', example: '2026-10-01T00:00:00Z' })
  @IsDateString()
  registrationOpensAt!: string;

  @ApiProperty({ description: 'Fechamento das inscrições', example: '2026-11-15T23:59:59Z' })
  @IsDateString()
  registrationClosesAt!: string;

  @ApiPropertyOptional({ description: 'Prazo para cancelamento', example: '2026-11-20T23:59:59Z' })
  @IsOptional()
  @IsDateString()
  cancellationDeadline?: string;

  @ApiPropertyOptional({ type: CompetitionConfigDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CompetitionConfigDto)
  config?: CompetitionConfigDto;
}

export class UpdateCompetitionDto {
  @ApiPropertyOptional({ description: 'Nome da competição' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Descrição' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Regulamento' })
  @IsOptional()
  @IsString()
  regulation?: string;

  @ApiPropertyOptional({ description: 'Data/hora de início' })
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiPropertyOptional({ description: 'Data/hora de fim' })
  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @ApiPropertyOptional({ description: 'Abertura das inscrições' })
  @IsOptional()
  @IsDateString()
  registrationOpensAt?: string;

  @ApiPropertyOptional({ description: 'Fechamento das inscrições' })
  @IsOptional()
  @IsDateString()
  registrationClosesAt?: string;

  @ApiPropertyOptional({ description: 'Prazo para cancelamento' })
  @IsOptional()
  @IsDateString()
  cancellationDeadline?: string;

  @ApiPropertyOptional({ description: 'Status', enum: CompetitionStatus })
  @IsOptional()
  @IsEnum(CompetitionStatus)
  status?: CompetitionStatus;

  @ApiPropertyOptional({ description: 'Timezone' })
  @IsOptional()
  @IsString()
  timezone?: string;
}

export class CreateEventDivisionDto {
  @ApiProperty({ description: 'ID do tipo de divisão (GI, NO_GI, ABSOLUTO)' })
  @IsString()
  @IsUUID()
  divisionTypeId!: string;

  @ApiPropertyOptional({ description: 'Se a divisão está ativa', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Configuração específica (ex: regras do Absoluto)' })
  @IsOptional()
  config?: Record<string, any>;
}

export class UpdateEventDivisionDto {
  @ApiPropertyOptional({ description: 'Se a divisão está ativa' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Configuração específica' })
  @IsOptional()
  config?: Record<string, any>;
}

export class CreateCategoryDto {
  @ApiProperty({ description: 'ID da divisão do evento' })
  @IsString()
  @IsUUID()
  eventDivisionId!: string;

  @ApiProperty({ description: 'Nome da categoria' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ description: 'Idade mínima' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  minAge?: number;

  @ApiPropertyOptional({ description: 'Idade máxima' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  maxAge?: number;

  @ApiPropertyOptional({ description: 'Peso mínimo (kg)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minWeightKg?: number;

  @ApiPropertyOptional({ description: 'Peso máximo (kg)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxWeightKg?: number;

  @ApiPropertyOptional({ description: 'Faixas permitidas', enum: BeltRank, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(BeltRank, { each: true })
  beltRanks?: BeltRank[];

  @ApiPropertyOptional({ description: 'Gênero', enum: Gender })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional({ description: 'Se a categoria está ativa', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateCategoryDto {
  @ApiPropertyOptional({ description: 'Nome da categoria' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Idade mínima' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  minAge?: number;

  @ApiPropertyOptional({ description: 'Idade máxima' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  maxAge?: number;

  @ApiPropertyOptional({ description: 'Peso mínimo (kg)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minWeightKg?: number;

  @ApiPropertyOptional({ description: 'Peso máximo (kg)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxWeightKg?: number;

  @ApiPropertyOptional({ description: 'Faixas permitidas', enum: BeltRank, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(BeltRank, { each: true })
  beltRanks?: BeltRank[];

  @ApiPropertyOptional({ description: 'Gênero', enum: Gender })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional({ description: 'Se a categoria está ativa' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateRegistrationDto {
  @ApiProperty({ description: 'ID da competição' })
  @IsString()
  @IsUUID()
  competitionId!: string;

  @ApiProperty({ description: 'ID da divisão do evento' })
  @IsString()
  @IsUUID()
  eventDivisionId!: string;

  @ApiPropertyOptional({ description: 'ID da categoria (opcional - backend sugere)' })
  @IsOptional()
  @IsString()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Peso declarado (kg)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(30)
  @Max(150)
  declaredWeightKg?: number;
}

export class RegistrationFiltersDto {
  @ApiPropertyOptional({ description: 'Filtrar por status', enum: RegistrationStatus })
  @IsOptional()
  @IsEnum(RegistrationStatus)
  status?: RegistrationStatus;

  @ApiPropertyOptional({ description: 'Filtrar por competição' })
  @IsOptional()
  @IsString()
  @IsUUID()
  competitionId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por divisão do evento' })
  @IsOptional()
  @IsString()
  @IsUUID()
  eventDivisionId?: string;

  @ApiPropertyOptional({ description: 'Página', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: 'Itens por página', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class ApproveRegistrationDto {
  @ApiPropertyOptional({ description: 'Justificativa da aprovação' })
  @IsOptional()
  @IsString()
  justification?: string;
}

export class RejectRegistrationDto {
  @ApiProperty({ description: 'Justificativa obrigatória para rejeição' })
  @IsString()
  justification!: string;
}

export class ReopenRegistrationDto {
  @ApiProperty({ description: 'Justificativa obrigatória para reabertura' })
  @IsString()
  justification!: string;
}

export class CancelRegistrationDto {
  @ApiPropertyOptional({ description: 'Motivo do cancelamento' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ResolveExceptionDto {
  @ApiProperty({ description: 'Justificativa obrigatória para exceção' })
  @IsString()
  justification!: string;

  @ApiProperty({ description: 'Escopo da exceção (ex: inscriptionId:competitionId)' })
  @IsString()
  exceptionScope!: string;

  @ApiPropertyOptional({ description: 'ID de correlação para auditoria' })
  @IsOptional()
  @IsString()
  correlationId?: string;
}

export class RecordWeighInDto {
  @ApiProperty({ description: 'Peso aferido (kg)' })
  @Type(() => Number)
  @IsNumber()
  @Min(30)
  @Max(150)
  weightKg!: number;

  @ApiPropertyOptional({ description: 'Unidade', default: 'kg' })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional({ description: 'Observações' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ description: 'Chave de idempotência (única)' })
  @IsString()
  idempotencyKey!: string;
}

export class WeighInFiltersDto {
  @ApiPropertyOptional({ description: 'Filtrar por resultado', enum: WeighInResult })
  @IsOptional()
  @IsEnum(WeighInResult)
  result?: WeighInResult;

  @ApiPropertyOptional({ description: 'Data inicial', example: '2026-11-01' })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({ description: 'Data final', example: '2026-11-30' })
  @IsOptional()
  @IsDateString()
  toDate?: string;
}

export class GenerateSignedUploadUrlDto {
  @ApiProperty({ description: 'ID da competição' })
  @IsString()
  @IsUUID()
  competitionId!: string;

  @ApiPropertyOptional({ description: 'ID da inscrição (opcional)' })
  @IsOptional()
  @IsString()
  @IsUUID()
  registrationId?: string;

  @ApiProperty({ description: 'Finalidade do arquivo', enum: FilePurpose })
  @IsEnum(FilePurpose)
  purpose!: FilePurpose;

  @ApiProperty({ description: 'Nome do arquivo original' })
  @IsString()
  fileName!: string;

  @ApiProperty({ description: 'MIME type', enum: ['application/pdf', 'image/jpeg', 'image/png'] })
  @IsString()
  mimeType!: string;

  @ApiProperty({ description: 'Tamanho em bytes', maximum: 10485760 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(10485760)
  sizeBytes!: number;
}

export class RegisterFileMetadataDto {
  @ApiProperty({ description: 'ID da competição' })
  @IsString()
  @IsUUID()
  competitionId!: string;

  @ApiPropertyOptional({ description: 'ID da inscrição (opcional)' })
  @IsOptional()
  @IsString()
  @IsUUID()
  registrationId?: string;

  @ApiProperty({ description: 'Caminho no Storage' })
  @IsString()
  path!: string;

  @ApiProperty({ description: 'MIME type' })
  @IsString()
  mimeType!: string;

  @ApiProperty({ description: 'Tamanho em bytes' })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  sizeBytes!: number;

  @ApiProperty({ description: 'Finalidade', enum: FilePurpose })
  @IsEnum(FilePurpose)
  purpose!: FilePurpose;
}

export class CreateConsentDto {
  @ApiProperty({ description: 'ID da competição' })
  @IsString()
  @IsUUID()
  competitionId!: string;

  @ApiPropertyOptional({ description: 'ID da inscrição (opcional)' })
  @IsOptional()
  @IsString()
  @IsUUID()
  registrationId?: string;

  @ApiProperty({ description: 'Nome do responsável legal' })
  @IsString()
  guardianName!: string;

  @ApiProperty({ description: 'Documento do responsável (CPF/RG)' })
  @IsString()
  guardianDocument!: string;

  @ApiProperty({ description: 'URL assinada do documento no Storage' })
  @IsString()
  documentUrl!: string;

  @ApiProperty({ description: 'Data de expiração', example: '2026-12-31T23:59:59Z' })
  @IsDateString()
  expiresAt!: string;
}

export class ConsentFiltersDto {
  @ApiPropertyOptional({ description: 'Filtrar por status', enum: ConsentStatus })
  @IsOptional()
  @IsEnum(ConsentStatus)
  status?: ConsentStatus;

  @ApiPropertyOptional({ description: 'Filtrar por competição' })
  @IsOptional()
  @IsString()
  @IsUUID()
  competitionId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por inscrição' })
  @IsOptional()
  @IsString()
  @IsUUID()
  registrationId?: string;

  @ApiPropertyOptional({ description: 'Data inicial de expiração' })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({ description: 'Data final de expiração' })
  @IsOptional()
  @IsDateString()
  toDate?: string;
}

export class CompleteProfileDto {
  @ApiPropertyOptional({ description: 'Full name', example: 'João Silva' })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional({ description: 'Birth date (ISO)', example: '2000-01-15' })
  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @ApiPropertyOptional({ description: 'Belt rank', example: 'BLUE', enum: ['WHITE', 'BLUE', 'PURPLE', 'BROWN', 'BLACK'] })
  @IsOptional()
  @IsString()
  beltRank?: string;

  @ApiPropertyOptional({ description: 'Weight in kg', example: 75.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  weightKg?: number;
}

export class UpdateProfileDto {
  @ApiPropertyOptional({ description: 'Full name', example: 'João Silva Santos' })
  @IsOptional()
  @IsString()
  fullName?: string;
}