export type RequestAttempt = {
  current(): string;
  failed(): void;
  succeeded(): void;
};

export function createRequestAttempt(
  generate: () => string = () => globalThis.crypto.randomUUID(),
): RequestAttempt {
  let idempotencyKey = generate();

  return {
    current() {
      return idempotencyKey;
    },
    failed() {},
    succeeded() {
      idempotencyKey = generate();
    },
  };
}
