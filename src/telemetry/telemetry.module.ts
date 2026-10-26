import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SpeedLog } from './speed-log.entity';
import { SpeedService } from './speed.service';
import { TelemetryController } from './telemetry.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SpeedLog])],
  providers: [SpeedService],
  controllers: [TelemetryController],
  exports: [SpeedService],
})
export class TelemetryModule {}
