import { Controller, Get, Param } from '@nestjs/common';
import { SpeedService } from './speed.service';

@Controller('api/v1/traffic')
export class TelemetryController {
  constructor(private readonly speeds: SpeedService) {}

  @Get('cell/:geohash')
  cell(@Param('geohash') geohash: string) {
    return this.speeds.cellAverage(geohash.slice(0, 5));
  }
}
