import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { UsersService } from '../../users/users.service';

@Injectable()
export class CompetitionScopeGuard implements CanActivate {
  constructor(private readonly usersService: UsersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.userId) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'User not authenticated',
      });
    }

    if (user.role !== 'PROFESSOR') {
      return true; // Non-professors don't need competition scope check
    }

    const competitionId = request.params.competitionId || request.body.competitionId || request.query.competitionId;

    if (!competitionId) {
      return true; // No competition context to check
    }

    const isAssigned = await this.usersService.isProfessorAssignedToCompetition(user.userId, competitionId);

    if (!isAssigned) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'Professor not assigned to this competition',
      });
    }

    return true;
  }
}