import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { CreateReportDto, NearbyQueryDto, VerifyReportDto } from './reports.dto';

@Controller('api/v1/reports')
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Post()
  create(@Body() dto: CreateReportDto) {
    return this.service.create(dto);
  }

  @Get('nearby')
  nearby(@Query() q: NearbyQueryDto) {
    return this.service.nearby(q.lat, q.lng, q.radiusInMeters ?? 5000);
  }

  @Post(':id/verify')
  verify(@Param('id') id: string, @Body() dto: VerifyReportDto) {
    return this.service.verify(id, dto.deviceId, dto.vote);
  }

  @Delete('clear')
  clearAll() {
    return this.service.clearAll();
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
