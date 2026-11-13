import { Injectable } from '@nestjs/common';
import { CacheService } from '../../infra/cache/cache.service.js';
import { DatabaseService } from '../../infra/database/database.service.js';
import { QueueService } from '../../infra/queue/queue.service.js';

type DependencyState = 'running' | 'error';

export type ApplicationStatus = {
  app: DependencyState;
  db: DependencyState;
  redis: DependencyState;
  queue: DependencyState;
  db_error?: string;
  redis_error?: string;
  queue_error?: string;
  other_error?: string;
};

type Check = {
  state: DependencyState;
  error?: string;
};

@Injectable()
export class StatusService {
  constructor(
    private readonly database: DatabaseService,
    private readonly cache: CacheService,
    private readonly queue: QueueService,
  ) {}

  async getStatus(): Promise<ApplicationStatus> {
    try {
      const [db, redis, queue] = await Promise.all([
        this.check(() => this.database.ping()),
        this.check(async () => {
          const ok = await this.cache.ping();

          if (!ok) {
            throw new Error('Redis did not respond to PING');
          }
        }),
        this.check(() => this.queue.ping()),
      ]);

      return {
        app: 'running',
        db: db.state,
        redis: redis.state,
        queue: queue.state,
        ...(db.error ? { db_error: db.error } : {}),
        ...(redis.error ? { redis_error: redis.error } : {}),
        ...(queue.error ? { queue_error: queue.error } : {}),
      };
    } catch (error) {
      return {
        app: 'error',
        db: 'error',
        redis: 'error',
        queue: 'error',
        other_error: errorMessage(error),
      };
    }
  }

  private async check(run: () => Promise<unknown>): Promise<Check> {
    try {
      await run();
      return { state: 'running' };
    } catch (error) {
      return { state: 'error', error: errorMessage(error) };
    }
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
