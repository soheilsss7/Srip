import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { EventBusService, DomainEvent } from '../event-bus/event-bus.service';
import { DOMAIN_EVENT_TYPES } from '../event-bus/event-bus.constants';
import { WorkflowsService } from './workflows.service';
import { RequestContext } from '../common/request-context';

/** Bridges the canonical Domain Event Bus to Workflow triggers. */
@Injectable()
export class WorkflowEventListener implements OnModuleInit {
  private readonly logger = new Logger(WorkflowEventListener.name);
  private unsubscribe?: () => void;
  constructor(private readonly bus: EventBusService, private readonly workflows: WorkflowsService, private readonly requestContext: RequestContext) {}

  onModuleInit() {
    this.unsubscribe = this.bus.subscribe((event) => void this.handle(event));
  }

  private async handle(event: DomainEvent) {
    try {
      await this.requestContext.run({ requestId: event.requestId, correlationId: event.correlationId, userId: event.actorId }, () => this.workflows.triggerFromDomainEvent(event));
    } catch (error: any) {
      this.logger.error(`workflow event handling failed for ${event.id}: ${error?.message ?? error}`);
    }
  }
}
