import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Interval } from '@nestjs/schedule';
import { Repository } from 'typeorm';
import * as ngeohash from 'ngeohash';
import { SpeedLog } from './speed-log.entity';

type Sample = {
  latitude: number;
  longitude: number;
  speed: number;
  heading: number | null;
  timestamp: number;
};

/** In-memory queue flushed in batches to avoid per-sample DB writes. */
@Injectable()
export class SpeedService {
  private queue: Sample[] = [];

  constructor(@InjectRepository(SpeedLog) private readonly repo: Repository<SpeedLog>) {}

  enqueue(s: Sample) {
    if (this.queue.length < 5000) this.queue.push(s);
  }

  @Interval(10_000)
  async flush() {
    if (!this.queue.length) return;
    const batch = this.queue.splice(0);
    await this.repo.insert(
      batch.map((s) => ({ ...s, geohash: ngeohash.encode(s.latitude, s.longitude, 6) })),
    );
  }

  /** Average speed (m/s) in the last 15 minutes for a geohash-5 cell. */
  async cellAverage(cell: string) {
    const since = Date.now() - 15 * 60_000;
    const r = await this.repo
      .createQueryBuilder('s')
      .select('AVG(s.speed)', 'avg')
      .addSelect('COUNT(*)', 'n')
      .where('s.geohash LIKE :c AND s.timestamp > :since', { c: `${cell}%`, since })
      .getRawOne<{ avg: number | null; n: number }>();
    return { avgSpeed: r?.avg ?? null, samples: Number(r?.n ?? 0) };
  }

  @Interval(3_600_000)
  async prune() {
    await this.repo
      .createQueryBuilder()
      .delete()
      .where('timestamp < :t', { t: Date.now() - 24 * 3_600_000 })
      .execute();
  }
}
