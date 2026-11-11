import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StoredFile, FilePurpose, Role } from '@prisma/client';
import { SupabaseClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';
import { GenerateSignedUploadUrlDto, RegisterFileMetadataDto } from './dto/files.dto';

const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

@Injectable()
export class FilesService {
  private supabase: SupabaseClient | null = null;
  private bucketName: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseServiceKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    this.bucketName = this.configService.get<string>('SUPABASE_PRIVATE_BUCKET', 'camp-bjj-private');
    
    if (supabaseUrl && supabaseServiceKey) {
      this.supabase = new SupabaseClient(supabaseUrl, supabaseServiceKey);
    }
  }

  private getSupabase(): SupabaseClient {
    if (!this.supabase) {
      throw new BadRequestException({
        statusCode: 503,
        code: 'STORAGE_NOT_CONFIGURED',
        message: 'Storage service not configured',
      });
    }
    return this.supabase;
  }

  private validateFile(mimeType: string, sizeBytes: number): void {
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'INVALID_MIME_TYPE',
        message: `MIME type not allowed. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`,
      });
    }
    if (sizeBytes > MAX_FILE_SIZE) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'FILE_TOO_LARGE',
        message: `File size exceeds maximum of ${MAX_FILE_SIZE} bytes`,
      });
    }
  }

  private buildStoragePath(data: GenerateSignedUploadUrlDto): string {
    const timestamp = Date.now();
    const sanitizedFileName = data.fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    return `private/${data.registrationId}/${data.purpose}/${timestamp}_${sanitizedFileName}`;
  }

  async generateSignedUploadUrl(userId: string, data: GenerateSignedUploadUrlDto): Promise<{ uploadUrl: string; path: string; expiresAt: string }> {
    this.validateFile(data.mimeType, data.sizeBytes);

    // Verify registration exists and user has access
    const registration = await this.prisma.registration.findUnique({
      where: { id: data.registrationId },
      select: { athleteId: true, competitionId: true },
    });

    if (!registration) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Registration not found',
      });
    }

    // Check authorization
    if (registration.athleteId !== userId) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'Can only upload files for own registration',
      });
    }

    const path = this.buildStoragePath(data);
    const expiresIn = 15 * 60; // 15 minutes

    const supabase = this.getSupabase();

    const { data: signedUrlData, error } = await supabase.storage
      .from(this.bucketName)
      .createSignedUploadUrl(path, {
        expiresIn,
      });

    if (error || !signedUrlData?.signedUrl) {
      throw new BadRequestException({
        statusCode: 500,
        code: 'SIGNED_URL_FAILED',
        message: 'Failed to generate signed upload URL',
      });
    }

    return {
      uploadUrl: signedUrlData.signedUrl,
      path,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    };
  }

  async generateSignedDownloadUrl(userId: string, fileId: string): Promise<{ downloadUrl: string; expiresAt: string }> {
    const file = await this.prisma.storedFile.findUnique({
      where: { id: fileId },
      select: { path: true, registrationId: true, competitionId: true, uploadedBy: true },
    });

    if (!file) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'File not found',
      });
    }

    // Check authorization
    const registration = file.registrationId ? await this.prisma.registration.findUnique({
      where: { id: file.registrationId },
      select: { athleteId: true, competitionId: true },
    }) : null;

    const canAccess = 
      file.uploadedBy === userId ||
      (registration && registration.athleteId === userId) ||
      (file.competitionId && await this.hasCompetitionAccess(userId, file.competitionId));

    if (!canAccess) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'Access denied to this file',
      });
    }

    if (!this.supabase) {
      throw new BadRequestException({
        statusCode: 503,
        code: 'STORAGE_NOT_CONFIGURED',
        message: 'Storage service not configured',
      });
    }

    const expiresIn = 5 * 60; // 5 minutes
    const { data: signedUrlData, error } = await this.supabase.storage
      .from(this.bucketName)
      .createSignedUrl(file.path, expiresIn);

    if (error || !signedUrlData?.signedUrl) {
      throw new BadRequestException({
        statusCode: 500,
        code: 'SIGNED_URL_FAILED',
        message: 'Failed to generate signed download URL',
      });
    }

    return {
      downloadUrl: signedUrlData.signedUrl,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    };
  }

  async registerMetadata(userId: string, data: RegisterFileMetadataDto): Promise<StoredFile> {
    this.validateFile(data.mimeType, data.sizeBytes);

    // Verify registration and authorization
    const registration = await this.prisma.registration.findUnique({
      where: { id: data.registrationId },
      select: { athleteId: true, competitionId: true },
    });

    if (!registration) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Registration not found',
      });
    }

    if (registration.athleteId !== userId) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'Can only register files for own registration',
      });
    }

    // Verify file exists in storage
    if (this.supabase) {
      const { error } = await this.supabase.storage
        .from(this.bucketName)
        .list(data.path.split('/').slice(0, -1).join('/'), {
          search: data.path.split('/').pop(),
        });
      
      if (error) {
        throw new BadRequestException({
          statusCode: 400,
          code: 'FILE_NOT_IN_STORAGE',
          message: 'File not found in storage',
        });
      }
    }

    return this.prisma.storedFile.create({
      data: {
        registrationId: data.registrationId,
        competitionId: registration.competitionId,
        uploadedBy: userId,
        path: data.path,
        mimeType: data.mimeType,
        sizeBytes: data.sizeBytes,
        purpose: data.purpose,
      },
    });
  }

  async findByRegistration(registrationId: string, userId: string, userRole: Role): Promise<StoredFile[]> {
    const registration = await this.prisma.registration.findUnique({
      where: { id: registrationId },
      select: { athleteId: true, competitionId: true },
    });

    if (!registration) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Registration not found',
      });
    }

    if (userRole === 'ATHLETE' && registration.athleteId !== userId) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'Access denied',
      });
    }

    if (userRole === 'PROFESSOR') {
      const assigned = await this.prisma.professorAssignment.findUnique({
        where: { professorId_competitionId: { professorId: userId, competitionId: registration.competitionId } },
      });
      if (!assigned?.isActive) {
        throw new ForbiddenException({
          statusCode: 403,
          code: 'FORBIDDEN',
          message: 'Professor not assigned to this competition',
        });
      }
    }

    return this.prisma.storedFile.findMany({
      where: { registrationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByCompetition(competitionId: string, userId: string, userRole: Role): Promise<StoredFile[]> {
    if (userRole === 'ATHLETE') {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'Athletes cannot list competition files',
      });
    }

    if (userRole === 'PROFESSOR') {
      const assigned = await this.prisma.professorAssignment.findUnique({
        where: { professorId_competitionId: { professorId: userId, competitionId } },
      });
      if (!assigned?.isActive) {
        throw new ForbiddenException({
          statusCode: 403,
          code: 'FORBIDDEN',
          message: 'Professor not assigned to this competition',
        });
      }
    }

    return this.prisma.storedFile.findMany({
      where: { competitionId },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async hasCompetitionAccess(userId: string, competitionId: string): Promise<boolean> {
    const assignment = await this.prisma.professorAssignment.findUnique({
      where: { professorId_competitionId: { professorId: userId, competitionId } },
    });
    if (assignment?.isActive) return true;

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    return user?.role === 'ORGANIZER' || user?.role === 'ADMIN';
  }
}