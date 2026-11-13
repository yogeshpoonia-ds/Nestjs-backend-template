import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue, type ConnectionOptions, type JobsOptions } from 'bullmq';

export function queueConnection(): ConnectionOptions {
  const url = process.env.REDIS_URL;

  if (!url) {
    throw new Error('REDIS_URL is not set');
  }

  return {
    url,
    maxRetriesPerRequest: null,
  };
}

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly queues = new Map<string, Queue>();
  readonly connection = queueConnection();

  queue(name: string): Queue {
    const existing = this.queues.get(name);

    if (existing) {
      return existing;
    }

    const queue = new Queue(name, { connection: this.connection });
    this.queues.set(name, queue);
    return queue;
  }

  add<Data>(
    name: string,
    jobName: string,
    data: Data,
    options?: JobsOptions,
  ): Promise<unknown> {
    return this.queue(name).add(jobName, data, options);
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all(
      [...this.queues.values()].map((queue) => queue.close()),
    );
  }
}
