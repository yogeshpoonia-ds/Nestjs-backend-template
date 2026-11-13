import { Injectable } from '@nestjs/common';

export type ApplicationStatus = {
  status: 'running';
};

@Injectable()
export class StatusService {
  getStatus(): ApplicationStatus {
    return { status: 'running' };
  }
}
