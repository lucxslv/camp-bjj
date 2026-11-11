import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface CurrentUser {
  sub: string;
  email: string;
  role: string;
  userId: string;
  [key: string]: unknown;
}

export const CurrentUser = createParamDecorator(
  (data: keyof CurrentUser | undefined, ctx: ExecutionContext): CurrentUser | CurrentUser[keyof CurrentUser] => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as CurrentUser;

    if (!user) {
      return undefined;
    }

    return data ? user[data] : user;
  },
);