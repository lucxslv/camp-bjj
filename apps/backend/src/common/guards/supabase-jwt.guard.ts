import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class SupabaseJwtGuard extends AuthGuard('supabase-jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      throw err || new UnauthorizedException({
        statusCode: 401,
        code: 'UNAUTHENTICATED',
        message: info?.message || 'Invalid or expired token',
      });
    }
    return user;
  }
}