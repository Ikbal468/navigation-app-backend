import { Injectable } from '@nestjs/common';
import { OnGatewayConnection, WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody, ConnectedSocket } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import * as ngeohash from 'ngeohash';
import { SpeedService } from '../telemetry/speed.service';

export const GEOHASH_PRECISION = 5;

@Injectable()
@WebSocketGateway({ namespace: 'traffic', cors: { origin: '*' } })
export class TrafficGateway implements OnGatewayConnection {
  @WebSocketServer() server: Server;

  constructor(private readonly speeds: SpeedService) {}

  handleConnection(client: Socket) {
    client.data.cell = null;
  }

  @SubscribeMessage('position')
  onPosition(
    @MessageBody() p: { lat: number; lng: number; speed?: number; heading?: number },
    @ConnectedSocket() client: Socket,
  ) {
    if (typeof p?.lat !== 'number' || typeof p?.lng !== 'number') return;
    const cell = ngeohash.encode(p.lat, p.lng, GEOHASH_PRECISION);
    if (client.data.cell !== cell) {
      if (client.data.cell) void client.leave(client.data.cell);
      void client.join(cell);
      client.data.cell = cell;
      client.emit('joined', { cell });
    }
    if (typeof p.speed === 'number') {
      this.speeds.enqueue({
        latitude: p.lat,
        longitude: p.lng,
        speed: p.speed,
        heading: p.heading ?? null,
        timestamp: Date.now(),
      });
    }
  }

  emitToCell(geohash: string, event: string, payload: unknown) {
    this.server?.to(geohash.slice(0, GEOHASH_PRECISION)).emit(event, payload);
  }
}
