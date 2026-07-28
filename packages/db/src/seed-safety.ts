export function assertDemoSeedAllowed(nodeEnv: string | undefined) {
  if (nodeEnv === "production") {
    throw new Error(
      "The demo seed is disabled in production. Use bootstrap:production instead.",
    );
  }
}
