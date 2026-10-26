import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  process.env.QUEUE_WORKER_ENABLED = 'true';
  await NestFactory.createApplicationContext(AppModule, { logger: ['log', 'warn', 'error'] });
}

void bootstrap();
