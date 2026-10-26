import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Report } from './report.entity';
import { ReportVote } from './vote.entity';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { TrafficModule } from '../traffic/traffic.module';

@Module({
  imports: [TypeOrmModule.forFeature([Report, ReportVote]), TrafficModule],
  providers: [ReportsService],
  controllers: [ReportsController],
})
export class ReportsModule {}
