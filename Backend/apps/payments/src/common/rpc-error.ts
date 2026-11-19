import { RpcException } from '@nestjs/microservices';

// The gateway maps { status, message } to the same HTTP status and forwards
// any extra fields in the response body (same contract as the ERP MS)
export const rpcError = (
  status: number,
  message: string,
  extra: Record<string, unknown> = {},
) => new RpcException({ ...extra, status, message });
