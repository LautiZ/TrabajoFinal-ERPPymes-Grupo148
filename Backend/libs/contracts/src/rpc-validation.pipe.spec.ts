import { RpcException } from '@nestjs/microservices';
import { LoginDto } from './dtos/login.dto';
import { createRpcValidationPipe } from './rpc-validation.pipe';

describe('createRpcValidationPipe', () => {
  const pipe = createRpcValidationPipe();
  const meta = { type: 'body' as const, metatype: LoginDto };

  it('normalizes the email to lowercase', async () => {
    const dto = await pipe.transform(
      { email: '  Owner@Pyme.TEST ', password: 'secret' },
      meta,
    );
    expect(dto).toBeInstanceOf(LoginDto);
    expect(dto.email).toBe('owner@pyme.test');
  });

  it('rejects unknown fields with an RPC 400', async () => {
    const result = pipe.transform(
      { email: 'owner@pyme.test', password: 'secret', role: 'Owner' },
      meta,
    );
    await expect(result).rejects.toBeInstanceOf(RpcException);
    await expect(result).rejects.toMatchObject({
      error: expect.objectContaining({ status: 400 }),
    });
  });
});
