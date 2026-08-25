import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationRealtimeService } from './notification-realtime.service';

@WebSocketGateway({ namespace: '/notifications', cors: { origin: process.env.WEB_ORIGIN ?? '*', credentials: true } })
export class NotificationsGateway {
  @WebSocketServer() server!: Server;
  private unsubscribe?: () => void;

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly realtime: NotificationRealtimeService,
  ) {
    this.unsubscribe = this.realtime.subscribe((event) => {
      this.server?.to(this.room(event.userId)).emit(event.event, {
        ...event.data,
        event: event.event,
        deliveredAt: new Date().toISOString(),
      });
    });
  }

  afterInit(server: Server) { this.server = server; }

  async handleConnection(client: Socket) {
    try {
      const token = this.extractToken(client);
      if (!token) throw new UnauthorizedException('WebSocket authentication required');
      const payload = await this.jwt.verifyAsync<{ sub?: string }>(token);
      if (!payload.sub) throw new UnauthorizedException('Invalid WebSocket token');
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, isActive: true, deletedAt: true } });
      if (!user?.isActive || user.deletedAt) throw new UnauthorizedException('User is inactive');
      client.data.userId = user.id;
      await client.join(this.room(user.id));
      client.emit('notifications.ready', { userId: user.id, event: 'notifications.ready', realtime: true, deliveredAt: new Date().toISOString() });
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) { client.removeAllListeners(); }

  @SubscribeMessage('notifications.ping')
  ping(@ConnectedSocket() client: Socket, @MessageBody() body?: { nonce?: string }) {
    if (!client.data.userId) return { ok: false };
    return { ok: true, event: 'notifications.pong', nonce: body?.nonce, serverTime: new Date().toISOString() };
  }

  private extractToken(client: Socket) {
    const auth = client.handshake.auth?.token;
    const header = client.handshake.headers.authorization;
    const token = typeof auth === 'string' ? auth : typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7) : undefined;
    return token;
  }

  private room(userId: string) { return `notification-user:${userId}`; }
}
