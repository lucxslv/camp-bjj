import { Controller, Post, Get, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { FilesService } from './files.service';
import { SupabaseJwtGuard } from '../common/guards/supabase-jwt.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { GenerateSignedUploadUrlDto, RegisterFileMetadataDto } from './dto/files.dto';

@ApiTags('files')
@ApiBearerAuth('access-token')
@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('signed-upload-url')
  @UseGuards(SupabaseJwtGuard)
  @ApiOperation({ summary: 'Generate signed upload URL for private file' })
  @ApiResponse({ status: 200, description: 'Signed upload URL generated' })
  @ApiResponse({ status: 400, description: 'Invalid file type or size' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Registration not found' })
  async generateSignedUploadUrl(@CurrentUser('userId') userId: string, @Body() data: GenerateSignedUploadUrlDto) {
    const result = await this.filesService.generateSignedUploadUrl(userId, data);
    return result;
  }

  @Post('signed-download-url')
  @UseGuards(SupabaseJwtGuard)
  @ApiOperation({ summary: 'Generate signed download URL for private file' })
  @ApiResponse({ status: 200, description: 'Signed download URL generated' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'File not found' })
  async generateSignedDownloadUrl(@CurrentUser('userId') userId: string, @Body() data: { fileId: string }) {
    const result = await this.filesService.generateSignedDownloadUrl(userId, data.fileId);
    return result;
  }

  @Post('metadata')
  @UseGuards(SupabaseJwtGuard)
  @ApiOperation({ summary: 'Register file metadata after upload' })
  @ApiResponse({ status: 201, description: 'File metadata registered' })
  @ApiResponse({ status: 400, description: 'File not found in storage or invalid' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async registerMetadata(@CurrentUser('userId') userId: string, @Body() data: RegisterFileMetadataDto) {
    const file = await this.filesService.registerMetadata(userId, data);
    return { file };
  }

  @Get(':fileId')
  @UseGuards(SupabaseJwtGuard)
  @ApiOperation({ summary: 'Get file metadata' })
  @ApiParam({ name: 'fileId', description: 'File ID' })
  @ApiResponse({ status: 200, description: 'File metadata' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'File not found' })
  async getFile(@Param('fileId') fileId: string, @CurrentUser() user: any) {
    const file = await this.filesService['getFileMetadata'](fileId, user.userId, user.role);
    return { file };
  }

  @Get('registration/:registrationId')
  @UseGuards(SupabaseJwtGuard)
  @ApiOperation({ summary: 'Get files for a registration' })
  @ApiParam({ name: 'registrationId', description: 'Registration ID' })
  @ApiResponse({ status: 200, description: 'List of files' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Registration not found' })
  async findByRegistration(@Param('registrationId') registrationId: string, @CurrentUser() user: any) {
    const files = await this.filesService.findByRegistration(registrationId, user.userId, user.role);
    return { files };
  }

  @Get('competition/:competitionId')
  @UseGuards(SupabaseJwtGuard)
  @ApiOperation({ summary: 'Get files for a competition (professor/organizer/admin)' })
  @ApiParam({ name: 'competitionId', description: 'Competition ID' })
  @ApiResponse({ status: 200, description: 'List of files' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async findByCompetition(@Param('competitionId') competitionId: string, @CurrentUser() user: any) {
    const files = await this.filesService.findByCompetition(competitionId, user.userId, user.role);
    return { files };
  }
}