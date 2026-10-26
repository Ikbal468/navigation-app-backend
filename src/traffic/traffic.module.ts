import { Module } from '@nestjs/common';
import { TelemetryModule } from '../telemetry/telemetry.module';
import { TrafficGateway } from './traffic.gateway';

@Module({
  imports: [TelemetryModule],
  providers: [TrafficGateway],
  exports: [TrafficGateway],
})
export class TrafficModule {}
