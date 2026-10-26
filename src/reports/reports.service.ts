import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Repository } from 'typeorm';
import * as ngeohash from 'ngeohash';
import { Report } from './report.entity';
import { ReportVote } from './vote.entity';
import { CreateReportDto } from './reports.dto';
import { TrafficGateway } from '../traffic/traffic.gateway';

const MAX_AGE_MS = 2 * 60 * 60 * 1000;

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Report) private readonly reports: Repository<Report>,
    @InjectRepository(ReportVote) private readonly votes: Repository<ReportVote>,
    private readonly gateway: TrafficGateway,
  ) {}

  async create(dto: CreateReportDto) {
    const report = await this.reports.save(
      this.reports.create({
        ...dto,
        description: dto.description ?? null,
        geohash: ngeohash.encode(dto.latitude, dto.longitude, 7),
      }),
    );
    this.gateway.emitToCell(report.geohash, 'report:new', report);
    return report;
  }

  /** Bounding-box prefilter in SQL + Haversine refinement (SQLite has no PostGIS). */
  async nearby(lat: number, lng: number, radius: number) {
    const dLat = radius / 111_320;
    const dLng = radius / (111_320 * Math.max(Math.cos((lat * Math.PI) / 180), 0.01));
    const cutoff = new Date(Date.now() - MAX_AGE_MS);
    const rows = await this.reports
      .createQueryBuilder('r')
      .where('r.isActive = :active', { active: true })
      .andWhere('r.createdAt > :cutoff', { cutoff })
      .andWhere('r.latitude BETWEEN :a AND :b', { a: lat - dLat, b: lat + dLat })
      .andWhere('r.longitude BETWEEN :c AND :d', { c: lng - dLng, d: lng + dLng })
      .getMany();
    return rows
      .map((r) => ({ ...r, distance: haversine(lat, lng, r.latitude, r.longitude) }))
      .filter((r) => r.distance <= radius)
      .sort((x, y) => x.distance - y.distance);
  }

  async verify(id: string, deviceId: string, vote: 'up' | 'down') {
    const report = await this.reports.findOne({ where: { id } });
    if (!report) throw new NotFoundException('Report not found');
    const up = vote === 'up';
    const existing = await this.votes.findOne({ where: { reportId: id, deviceId } });
    if (existing) {
      if (existing.up === up) return report;
      if (existing.up) report.upvotes--; else report.downvotes--;
      existing.up = up;
      await this.votes.save(existing);
    } else {
      await this.votes.save(this.votes.create({ reportId: id, deviceId, up }));
    }
    if (up) report.upvotes++; else report.downvotes++;
    if (report.downvotes > report.upvotes + 3) report.isActive = false;
    const saved = await this.reports.save(report);
    this.gateway.emitToCell(
      saved.geohash,
      saved.isActive ? 'report:updated' : 'report:expired',
      saved,
    );
    return saved;
  }

  async remove(id: string) {
    const report = await this.reports.findOne({ where: { id } });
    if (report) {
      report.isActive = false;
      await this.reports.save(report);
      this.gateway.emitToCell(report.geohash, 'report:expired', report);
    }
    return { success: true };
  }

  async clearAll() {
    const active = await this.reports.find({ where: { isActive: true } });
    for (const r of active) {
      r.isActive = false;
      await this.reports.save(r);
      this.gateway.emitToCell(r.geohash, 'report:expired', r);
    }
    return { cleared: active.length };
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async expire() {
    const old = await this.reports
      .createQueryBuilder('r')
      .where('r.isActive = :active', { active: true })
      .andWhere('(r.createdAt < :cutoff OR r.downvotes > r.upvotes + 3)', {
        cutoff: new Date(Date.now() - MAX_AGE_MS),
      })
      .getMany();
    for (const r of old) {
      r.isActive = false;
      await this.reports.save(r);
      this.gateway.emitToCell(r.geohash, 'report:expired', r);
    }
  }
}

export function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const rad = (x: number) => (x * Math.PI) / 180;
  const a =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
