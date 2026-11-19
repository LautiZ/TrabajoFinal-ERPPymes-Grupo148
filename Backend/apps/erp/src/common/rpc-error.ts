import { RpcException } from '@nestjs/microservices';

// The gateway maps { status, message } to the same HTTP status and forwards
// any extra fields (e.g. code and items) in the response body
export const rpcError = (
  status: number,
  message: string,
  extra: Record<string, unknown> = {},
) => new RpcException({ ...extra, status, message });
