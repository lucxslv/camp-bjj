import { Controller, Get, Patch, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiBody, ApiPropertyOptional } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { SupabaseJwtGuard } from '../common/guards/supabase-jwt.guard';
import { CurrentUser, CurrentUser as CurrentUserDecorator } from '../common/decorators/current-user.decorator';

class CompleteProfileDto {
  @ApiPropertyOptional({ description: 'Full name', example: 'João Silva' })
  fullName?: string;

  @ApiPropertyOptional({ description: 'Birth date (ISO)', example: '2000-01-15' })
  birthDate?: Date;

  @ApiPropertyOptional({ description: 'Belt rank', example: 'BLUE', enum: ['WHITE', 'BLUE', 'PURPLE', 'BROWN', 'BLACK'] })
  beltRank?: string;

  @ApiPropertyOptional({ description: 'Weight in kg', example: 75.5 })
  weightKg?: number;
}

class UpdateProfileDto {
  @ApiPropertyOptional({ description: 'Full name', example: 'João Silva Santos' })
  fullName?: string;
}

@ApiTags('auth')
@ApiBearerAuth('access-token')
@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('me')
  @UseGuards(SupabaseJwtGuard)
  @ApiOperation({ summary: 'Get current user profile and effective permissions' })
  @ApiResponse({ status: 200, description: 'User profile with permissions' })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  async getProfile(@CurrentUser() user: any) {
    const profile = await this.authService.getUserProfile(user.sub);
    if (!profile) {
      return { user: null, permissions: {} };
    }

    const assignedCompetitions = this.authService.getAssignedCompetitionIds(profile);
    const isOrganizerOrAdmin = this.authService.isOrganizerOrAdmin(profile);
    const isProfessor = this.authService.isProfessor(profile);

    return {
      user: {
        id: profile.id,
        authUserId: profile.authUserId,
        email: profile.email,
        fullName: profile.fullName,
        role: profile.role,
        athleteProfile: profile.athleteProfile,
      },
      permissions: {
        isOrganizerOrAdmin,
        isProfessor,
        assignedCompetitions,
        canManageCompetitions: isOrganizerOrAdmin,
        canReviewRegistrations: isProfessor && assignedCompetitions.length > 0,
      },
    };
  }

  @Patch('me/profile')
  @UseGuards(SupabaseJwtGuard)
  @ApiOperation({ summary: 'Update editable profile fields' })
  @ApiBody({ type: UpdateProfileDto })
  @ApiResponse({ status: 200, description: 'Profile updated' })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  async updateProfile(@CurrentUserDecorator('userId') userId: string, @Body() data: UpdateProfileDto) {
    const user = await this.authService.updateProfile(userId, data);
    return { user };
  }

  @Post('me/complete-profile')
  @UseGuards(SupabaseJwtGuard)
  @ApiOperation({ summary: 'Complete profile with athlete data' })
  @ApiBody({ type: CompleteProfileDto })
  @ApiResponse({ status: 200, description: 'Profile completed' })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  async completeProfile(@CurrentUser() user: any, @Body() data: CompleteProfileDto) {
    const updatedUser = await this.authService.completeProfile(user.sub, data);
    return { user: updatedUser };
  }
}