import { Injectable } from '@nestjs/common';
import { RedisService } from './redis.service.js';

@Injectable()
export class CacheService {
  constructor(private readonly redis: RedisService) {}

  get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    return this.redis.set(key, value, ttlSeconds);
  }

  del(key: string): Promise<void> {
    return this.redis.del(key);
  }

  async ping(): Promise<boolean> {
    return (await this.redis.ping()) === 'PONG';
  }
}
