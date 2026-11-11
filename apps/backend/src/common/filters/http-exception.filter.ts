import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

export interface ErrorResponse {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let errorResponse: ErrorResponse;

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const responseObj = exceptionResponse as Record<string, unknown>;
        errorResponse = {
          statusCode: status,
          code: (responseObj['code'] as string) || this.getDefaultCode(status),
          message: (responseObj['message'] as string) || exception.message,
          details: responseObj['details'] || responseObj['errors'],
        };
      } else {
        errorResponse = {
          statusCode: status,
          code: this.getDefaultCode(status),
          message: exception.message,
        };
      }
    } else if (exception instanceof Error) {
      this.logger.error(`Unhandled error: ${exception.message}`, exception.stack);
      errorResponse = {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
      };
    } else {
      this.logger.error('Unknown exception', exception);
      errorResponse = {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
      };
    }

    // Add request path for debugging
    errorResponse.details = {
      ...(errorResponse.details as object),
      path: request.url,
      method: request.method,
    };

    response.status(errorResponse.statusCode).json(errorResponse);
  }

  private getDefaultCode(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'VALIDATION_ERROR';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHENTICATED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'STATE_CONFLICT';
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return 'BUSINESS_RULE_VIOLATION';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'RATE_LIMITED';
      case HttpStatus.INTERNAL_SERVER_ERROR:
        return 'INTERNAL_ERROR';
      default:
        return 'INTERNAL_ERROR';
    }
  }
}