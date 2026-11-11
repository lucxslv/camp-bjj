import { IsString, IsOptional, IsUUID, IsEnum, IsNumber, Min, Max, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { FilePurpose, ConsentStatus } from '@prisma/client';

export class GenerateSignedUploadUrlDto {
  @IsString()
  @IsUUID()
  competitionId!: string;

  @IsOptional()
  @IsString()
  @IsUUID()
  registrationId?: string;

  @IsEnum(FilePurpose)
  purpose!: FilePurpose;

  @IsString()
  fileName!: string;

  @IsString()
  mimeType!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(10485760) // 10MB
  sizeBytes!: number;
}

export class GenerateSignedDownloadUrlDto {
  @IsString()
  @IsUUID()
  fileId!: string;
}

export class RegisterFileMetadataDto {
  @IsString()
  @IsUUID()
  competitionId!: string;

  @IsOptional()
  @IsString()
  @IsUUID()
  registrationId?: string;

  @IsString()
  path!: string;

  @IsString()
  mimeType!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  sizeBytes!: number;

  @IsEnum(FilePurpose)
  purpose!: FilePurpose;
}

export class FileFiltersDto {
  @IsOptional()
  @IsString()
  @IsUUID()
  registrationId?: string;

  @IsOptional()
  @IsString()
  @IsUUID()
  competitionId?: string;

  @IsOptional()
  @IsEnum(FilePurpose)
  purpose?: FilePurpose;
}

export class CreateConsentDto {
  @IsString()
  @IsUUID()
  competitionId!: string;

  @IsOptional()
  @IsString()
  @IsUUID()
  registrationId?: string;

  @IsString()
  guardianName!: string;

  @IsString()
  guardianDocument!: string;

  @IsString()
  documentUrl!: string;

  @IsDateString()
  expiresAt!: string;
}

export class ConsentFiltersDto {
  @IsOptional()
  @IsEnum(ConsentStatus)
  status?: ConsentStatus;

  @IsOptional()
  @IsString()
  @IsUUID()
  competitionId?: string;

  @IsOptional()
  @IsString()
  @IsUUID()
  registrationId?: string;

  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;
}