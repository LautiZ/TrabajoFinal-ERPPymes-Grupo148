// No retries on purpose: resending a non-idempotent message could duplicate data
export const TCP_TIMEOUT_MS = 5000;
