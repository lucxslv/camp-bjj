import { IsString, IsOptional, IsUUID, IsEnum, IsNumber, Min, Max, IsDateString, Type } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FilePurpose, ConsentStatus } from '@prisma/client';

export class GenerateSignedUploadUrlDto {
  @ApiProperty({ description: 'Competition ID', example: 'abc123' })
  @IsString()
  @IsUUID()
  competitionId!: string;

  @ApiPropertyOptional({ description: 'Registration ID (optional)', example: 'def456' })
  @IsOptional()
  @IsString()
  @IsUUID()
  registrationId?: string;

  @ApiProperty({ description: 'File purpose', enum: FilePurpose, example: 'CONSENT_DOCUMENT' })
  @IsEnum(FilePurpose)
  purpose!: FilePurpose;

  @ApiProperty({ description: 'Original file name', example: 'document.pdf' })
  @IsString()
  fileName!: string;

  @ApiProperty({ description: 'MIME type', example: 'application/pdf' })
  @IsString()
  mimeType!: string;

  @ApiProperty({ description: 'File size in bytes', example: 1024000 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(10485760)
  sizeBytes!: number;
}

export class GenerateSignedDownloadUrlDto {
  @ApiProperty({ description: 'File ID', example: 'file123' })
  @IsString()
  @IsUUID()
  fileId!: string;
}

export class RegisterFileMetadataDto {
  @ApiProperty({ description: 'Competition ID', example: 'abc123' })
  @IsString()
  @IsUUID()
  competitionId!: string;

  @ApiPropertyOptional({ description: 'Registration ID (optional)', example: 'def456' })
  @IsOptional()
  @IsString()
  @IsUUID()
  registrationId?: string;

  @ApiProperty({ description: 'Storage path', example: 'private/abc123/def456/CONSENT_DOCUMENT/12345_document.pdf' })
  @IsString()
  path!: string;

  @ApiProperty({ description: 'MIME type', example: 'application/pdf' })
  @IsString()
  mimeType!: string;

  @ApiProperty({ description: 'File size in bytes', example: 1024000 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  sizeBytes!: number;

  @ApiProperty({ description: 'File purpose', enum: FilePurpose, example: 'CONSENT_DOCUMENT' })
  @IsEnum(FilePurpose)
  purpose!: FilePurpose;
}

export class CreateConsentDto {
  @ApiProperty({ description: 'Competition ID', example: 'abc123' })
  @IsString()
  @IsUUID()
  competitionId!: string;

  @ApiPropertyOptional({ description: 'Registration ID (optional)', example: 'def456' })
  @IsOptional()
  @IsString()
  @IsUUID()
  registrationId?: string;

  @ApiProperty({ description: 'Guardian full name', example: 'João Silva' })
  @IsString()
  guardianName!: string;

  @ApiProperty({ description: 'Guardian document (CPF/RG)', example: '123.456.789-00' })
  @IsString()
  guardianDocument!: string;

  @ApiProperty({ description: 'Signed URL of uploaded document', example: 'https://storage.supabase.co/...' })
  @IsString()
  documentUrl!: string;

  @ApiProperty({ description: 'Expiration date (ISO)', example: '2026-12-31T23:59:59.000Z' })
  @IsDateString()
  expiresAt!: string;
}

export class ConsentFiltersDto {
  @ApiPropertyOptional({ description: 'Filter by status', enum: ConsentStatus })
  @IsOptional()
  @IsEnum(ConsentStatus)
  status?: ConsentStatus;

  @ApiPropertyOptional({ description: 'Filter by competition ID' })
  @IsOptional()
  @IsString()
  @IsUUID()
  competitionId?: string;

  @ApiPropertyOptional({ description: 'Filter by registration ID' })
  @IsOptional()
  @IsString()
  @IsUUID()
  registrationId?: string;

  @ApiPropertyOptional({ description: 'Filter from date (ISO)' })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({ description: 'Filter to date (ISO)' })
  @IsOptional()
  @IsDateString()
  toDate?: string;
}

export class FileFiltersDto {
  @ApiPropertyOptional({ description: 'Filter by registration ID' })
  @IsOptional()
  @IsString()
  @IsUUID()
  registrationId?: string;

  @ApiPropertyOptional({ description: 'Filter by competition ID' })
  @IsOptional()
  @IsString()
  @IsUUID()
  competitionId?: string;

  @ApiPropertyOptional({ description: 'Filter by purpose', enum: FilePurpose })
  @IsOptional()
  @IsEnum(FilePurpose)
  purpose?: FilePurpose;
}