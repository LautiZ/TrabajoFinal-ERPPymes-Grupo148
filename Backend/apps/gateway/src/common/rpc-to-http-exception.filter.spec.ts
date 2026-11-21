import {
  ArgumentsHost,
  BadRequestException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { TimeoutError } from 'rxjs';
import { RpcToHttpExceptionFilter } from './rpc-to-http-exception.filter';

describe('RpcToHttpExceptionFilter', () => {
  const reply = jest.fn();
  const response = {};
  const filter = new RpcToHttpExceptionFilter({
    reply,
    isHeadersSent: () => false,
  } as never);
  const host = { getArgByIndex: () => response } as unknown as ArgumentsHost;

  // The last reply as [body, status]
  const replied = () => {
    const [, body, status] = reply.mock.calls.at(-1) as [
      unknown,
      unknown,
      number,
    ];
    return { body, status };
  };

  beforeEach(() => {
    reply.mockReset();
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('should keep an HttpException as it is', () => {
    filter.catch(new BadRequestException('bad'), host);
    expect(replied().status).toBe(HttpStatus.BAD_REQUEST);
    expect(replied().body).toEqual({
      statusCode: 400,
      message: 'bad',
      error: 'Bad Request',
    });
  });

  it.each([400, 401, 404, 409, 502, 503])(
    'should map an RPC rejection with status %i to the same HTTP status',
    (status) => {
      filter.catch({ status, message: 'boom' }, host);
      expect(replied()).toEqual({
        status,
        body: { statusCode: status, message: 'boom' },
      });
    },
  );

  it('should keep the message list of a validation rejection', () => {
    filter.catch({ status: 400, message: ['a must be a string', 'b'] }, host);
    expect(replied().body).toEqual({
      statusCode: 400,
      message: ['a must be a string', 'b'],
    });
  });

  it('should forward extra fields but never let them override statusCode or message', () => {
    filter.catch(
      {
        status: 409,
        message: 'Insufficient stock',
        code: 'INSUFFICIENT_STOCK',
        items: [{ productId: 'p-1' }],
        statusCode: 200,
      },
      host,
    );
    expect(replied()).toEqual({
      status: 409,
      body: {
        statusCode: 409,
        message: 'Insufficient stock',
        code: 'INSUFFICIENT_STOCK',
        items: [{ productId: 'p-1' }],
      },
    });
  });

  it('should map a TimeoutError to 504', () => {
    filter.catch(new TimeoutError(), host);
    expect(replied().status).toBe(HttpStatus.GATEWAY_TIMEOUT);
  });

  it('should map ECONNREFUSED to 503', () => {
    filter.catch(
      Object.assign(new Error('connect ECONNREFUSED'), {
        code: 'ECONNREFUSED',
      }),
      host,
    );
    expect(replied().status).toBe(HttpStatus.SERVICE_UNAVAILABLE);
  });

  it.each([
    ['a status below 400', { status: 302, message: 'x' }],
    ['a status above 599', { status: 700, message: 'x' }],
    ['a non-numeric status', { status: '404', message: 'x' }],
    ['a payload without message', { status: 404 }],
    ['a plain Error', new Error('unexpected')],
    ['a string', 'oops'],
    ['null', null],
  ])('should answer 500 for %s', (_case, exception) => {
    filter.catch(exception, host);
    expect(replied().status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
  });

  it('should not leak the internal error message on a 500', () => {
    filter.catch(new Error('db password is hunter2'), host);
    expect(JSON.stringify(replied().body)).not.toContain('hunter2');
  });
});
