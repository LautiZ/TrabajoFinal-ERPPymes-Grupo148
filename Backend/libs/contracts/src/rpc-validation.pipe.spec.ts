import { RpcException } from '@nestjs/microservices';
import { LoginDto } from './dtos/login.dto';
import { createRpcValidationPipe } from './rpc-validation.pipe';
import { CreateUserMessage } from './dtos/create-user.dto';

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

describe('createRpcValidationPipe with CreateUserMessage', () => {
  const pipe = createRpcValidationPipe();
  const meta = { type: 'body' as const, metatype: CreateUserMessage };
  const user = {
    email: 'ana@pyme.test',
    password: 'long-enough-pass',
    name: 'Ana',
    role: 'Employee',
  };

  it('rejects creating an Owner before reaching the service', async () => {
    await expect(
      pipe.transform(
        { actorRole: 'Owner', user: { ...user, role: 'Owner' } },
        meta,
      ),
    ).rejects.toMatchObject({
      error: expect.objectContaining({ status: 400 }),
    });
  });

  it('reports errors found inside the nested user', async () => {
    await expect(
      pipe.transform(
        { actorRole: 'Owner', user: { ...user, email: 'not-an-email' } },
        meta,
      ),
    ).rejects.toMatchObject({
      error: { status: 400, message: ['email must be an email'] },
    });
  });

  it('rejects unknown fields inside the nested user', async () => {
    await expect(
      pipe.transform(
        { actorRole: 'Owner', user: { ...user, passwordHash: 'x' } },
        meta,
      ),
    ).rejects.toMatchObject({
      error: expect.objectContaining({ status: 400 }),
    });
  });
});
