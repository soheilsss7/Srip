import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { Response } from 'express';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  status() {
    return this.health.status();
  }

  @Get('liveness')
  liveness() {
    return this.health.liveness();
  }

  @Get('live')
  live() {
    return this.health.liveness();
  }

  @Get('readiness')
  async readiness(@Res({ passthrough: true }) response: Response) {
    const result = await this.health.readiness();
    response.status(result.status === 'ready' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);
    return result;
  }

  @Get('ready')
  async ready(@Res({ passthrough: true }) response: Response) {
    return this.readiness(response);
  }
}
