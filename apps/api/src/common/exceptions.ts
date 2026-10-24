import { HttpException } from '@nestjs/common';

export class TooManyRequestsException extends HttpException {
  constructor(response: string | Record<string, unknown>) {
    super(response, 429);
  }
}
