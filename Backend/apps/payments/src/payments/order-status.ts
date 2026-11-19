import type { PaymentState } from '@app/contracts';

// Orders API status -> our payment state. Statuses that are still in progress
// (created, processing, action_required) map to null: nothing to record yet.
// failed and canceled are terminal: MP documents that such an order "will not
// be completed", so a rejected order never becomes paid (expiry comes as
// canceled/expired or failed/expired).
const FINAL_STATES: Record<string, PaymentState> = {
  processed: 'Paid',
  refunded: 'Refunded',
  failed: 'Rejected',
  canceled: 'Rejected',
  expired: 'Rejected',
};

export const toPaymentState = (orderStatus: string): PaymentState | null =>
  FINAL_STATES[orderStatus] ?? null;

// Which states each one may move to. Notifications can arrive late, repeated or
// out of order, so a state never goes back (e.g. Paid never becomes Rejected).
const ALLOWED: Record<PaymentState, readonly PaymentState[]> = {
  Pending: ['Paid', 'Rejected', 'Refunded'],
  // Defensive only: MP documents failed orders as terminal. If a paid
  // notification ever followed, the money is recorded (and the sale, already
  // cancelled by TES-75, is logged as needing a refund) instead of ignored.
  Rejected: ['Paid'],
  Paid: ['Refunded'],
  Refunded: [],
};

export const canTransition = (from: PaymentState, to: PaymentState) =>
  ALLOWED[from].includes(to);

// States that may move to `to`: used as the condition of the update, so two
// concurrent notifications cannot both apply a change
export const sourcesOf = (to: PaymentState): PaymentState[] =>
  (Object.keys(ALLOWED) as PaymentState[]).filter((from) =>
    canTransition(from, to),
  );
