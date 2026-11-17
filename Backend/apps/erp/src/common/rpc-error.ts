import { RpcException } from '@nestjs/microservices';

// The gateway maps { status, message } to the same HTTP status
export const rpcError = (status: number, message: string) =>
  new RpcException({ status, message });
