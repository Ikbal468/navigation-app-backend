import { Module } from '@nestjs/common';
import { PlacesModule } from './places/places.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { Report } from './reports/report.entity';
import { ReportVote } from './reports/vote.entity';
import { SpeedLog } from './telemetry/speed-log.entity';
import { SavedPlace } from './places/saved-place.entity';
import { ReportsModule } from './reports/reports.module';
import { TelemetryModule } from './telemetry/telemetry.module';
import { TrafficModule } from './traffic/traffic.module';
import { RoutesController } from './routes/routes.controller';

@Module({
  imports: [
    TypeOrmModule.forRoot(
      process.env.DATABASE_URL
        ? {
            // PostgreSQL (docker compose up -d db); set DATABASE_URL=postgres://...
            type: 'postgres',
            url: process.env.DATABASE_URL,
            entities: [Report, ReportVote, SpeedLog, SavedPlace],
            synchronize: true,
          }
        : {
            type: 'better-sqlite3',
            database: process.env.DB_PATH ?? 'routely.sqlite',
            entities: [Report, ReportVote, SpeedLog, SavedPlace],
            synchronize: true,
          },
    ),
    ScheduleModule.forRoot(),
    PlacesModule,
    ReportsModule,
    TelemetryModule,
    TrafficModule,
  ],
  controllers: [AppController, RoutesController],
  providers: [AppService],
})
export class AppModule {}
