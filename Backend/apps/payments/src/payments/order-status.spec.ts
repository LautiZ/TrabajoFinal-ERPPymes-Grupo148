import { canTransition, toPaymentState } from './order-status';

describe('toPaymentState', () => {
  it.each([
    ['processed', 'Paid'],
    ['refunded', 'Refunded'],
    ['failed', 'Rejected'],
    ['canceled', 'Rejected'],
    ['expired', 'Rejected'],
  ])('maps a %s order to %s', (status, state) => {
    expect(toPaymentState(status)).toBe(state);
  });

  it.each(['created', 'processing', 'action_required', 'unknown'])(
    'leaves a %s order without a final state',
    (status) => {
      expect(toPaymentState(status)).toBeNull();
    },
  );
});

describe('canTransition', () => {
  it.each([
    ['Pending', 'Paid'],
    ['Pending', 'Rejected'],
    ['Pending', 'Refunded'],
    // A rejected card can be retried in the same checkout and then approved
    ['Rejected', 'Paid'],
    ['Paid', 'Refunded'],
  ] as const)('allows %s -> %s', (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });

  it.each([
    ['Paid', 'Paid'],
    ['Paid', 'Rejected'],
    ['Paid', 'Pending'],
    ['Refunded', 'Paid'],
    ['Rejected', 'Rejected'],
  ] as const)(
    'never moves %s -> %s (late or repeated notification)',
    (from, to) => {
      expect(canTransition(from, to)).toBe(false);
    },
  );
});
