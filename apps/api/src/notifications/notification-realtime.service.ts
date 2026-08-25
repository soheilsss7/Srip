import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';
import { EntityResponseDto } from '../common/dto/entity-response.dto';

export type NotificationRealtimeEvent = {
  userId: string;
  event: 'notification.created' | 'notification.read' | 'notification.read-all' | 'notification.delivery';
  data: Record<string, unknown>;
};

@Injectable()
export class NotificationRealtimeService {
  private readonly events$ = new Subject<NotificationRealtimeEvent>();

  publish(event: NotificationRealtimeEvent) {
    this.events$.next(event);
  }

  subscribe(listener: (event: NotificationRealtimeEvent) => void) {
    const subscription = this.events$.subscribe(listener);
    return () => subscription.unsubscribe();
  }
}
