import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException({
        statusCode: 401,
        code: 'UNAUTHENTICATED',
        message: 'Missing or invalid authorization header',
      });
    }

    const token = authHeader.substring(7);

    try {
      const secret = this.configService.get<string>('JWT_SECRET') || this.configService.get<string>('SUPABASE_JWT_SECRET');
      const payload = this.jwtService.verify(token, { secret });
      request.user = payload;
      return true;
    } catch (error) {
      throw new UnauthorizedException({
        statusCode: 401,
        code: 'UNAUTHENTICATED',
        message: 'Invalid or expired token',
      });
    }
  }
}