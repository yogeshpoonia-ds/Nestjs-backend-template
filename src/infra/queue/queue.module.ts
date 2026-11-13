import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QueueService, queueConnection } from './queue.service.js';

@Global()
@Module({
  imports: [
    BullModule.forRoot({
      connection: queueConnection(),
    }),
  ],
  providers: [QueueService],
  exports: [BullModule, QueueService],
})
export class QueueModule {}
