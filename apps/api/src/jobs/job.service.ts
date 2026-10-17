import { Injectable } from '@nestjs/common';
import { JobsOptions } from 'bullmq';
import { JobName, QueueName, QUEUE_NAMES } from './queue.constants';
import { QueueService } from './queue.service';
import { EntityResponseDto } from '../common/dto/entity-response.dto';

@Injectable()
export class JobService {
  constructor(private readonly queues: QueueService) {}

  enqueue<T extends Record<string, unknown>>(name: JobName, payload: T, options?: JobsOptions) {
    return this.queues.enqueue(name, payload, options);
  }

  get(name: JobName, id: string) { return this.queues.get(name, id); }
  list(queue: QueueName = QUEUE_NAMES.default) { return this.queues.list(queue); }
  counts(queue: QueueName) { return this.queues.counts(queue); }
  pause(queue: QueueName) { return this.queues.pause(queue); }
  resume(queue: QueueName) { return this.queues.resume(queue); }
}
