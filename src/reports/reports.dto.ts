import { IsEnum, IsNumber, IsOptional, IsString, Max, Min, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ReportType } from './report.entity';

export class CreateReportDto {
  @IsEnum(ReportType)
  type: ReportType;

  @IsNumber() @Min(-90) @Max(90)
  latitude: number;

  @IsNumber() @Min(-180) @Max(180)
  longitude: number;

  @IsOptional() @IsString() @MaxLength(280)
  description?: string;
}

export class VerifyReportDto {
  @IsString()
  deviceId: string;

  @IsEnum(['up', 'down'])
  vote: 'up' | 'down';
}

export class NearbyQueryDto {
  @Type(() => Number) @IsNumber()
  lat: number;

  @Type(() => Number) @IsNumber()
  lng: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(10) @Max(50000)
  radiusInMeters?: number = 5000;
}
