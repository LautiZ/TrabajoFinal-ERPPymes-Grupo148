import { Injectable } from '@nestjs/common';

@Injectable()
export class ErpService {
  getHello(): string {
    return 'Hello World!';
  }
}
