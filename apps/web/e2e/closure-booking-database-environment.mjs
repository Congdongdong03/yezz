import { buildClosureEnvironment } from "./closure-environment.mjs";

/**
 * Build the child environment for the PostgreSQL booking test suite. The
 * runner owns the supplied URL and creates the matching Docker database, so
 * neither ambient database configuration nor external service credentials can
 * affect this test run.
 *
 * @param {Record<string, string | undefined>} ambient
 * @param {string} testDatabaseUrl
 * @returns {Record<string, string | undefined>}
 */
export function buildClosureBookingDatabaseEnvironment(
  ambient,
  testDatabaseUrl,
) {
  return buildClosureDatabaseEnvironment(ambient, testDatabaseUrl);
}

/**
 * Build the child environment for PostgreSQL migration, catalogue seed, and
 * production bootstrap integration tests. It uses the same runner-owned test
 * URL as the booking suite and explicitly enables their otherwise fail-closed
 * test guard.
 *
 * @param {Record<string, string | undefined>} ambient
 * @param {string} testDatabaseUrl
 * @returns {Record<string, string | undefined>}
 */
export function buildClosureMigrationDatabaseEnvironment(
  ambient,
  testDatabaseUrl,
) {
  return buildClosureDatabaseEnvironment(ambient, testDatabaseUrl, {
    YEZYY_RUN_DB_MIGRATION_TESTS: "1",
  });
}

/**
 * Build the child environment for the real live-catalogue seed and production
 * bootstrap commands. The runner owns the supplied URL and gives the commands
 * only the explicit, test-only confirmations they require.
 *
 * @param {Record<string, string | undefined>} ambient
 * @param {string} testDatabaseUrl
 * @returns {Record<string, string | undefined>}
 */
export function buildClosureLiveInitializationEnvironment(
  ambient,
  testDatabaseUrl,
) {
  return buildClosureDatabaseEnvironment(ambient, testDatabaseUrl, {
    ALLOW_PRODUCTION_BOOTSTRAP: "YezYY",
    CONFIRM_LIVE_CATALOGUE_SEED: "YezYY",
    PASSWORD_SETUP_TOKEN_SECRET:
      "closure-booking-db-password-setup-token-secret-local-only",
  });
}

/**
 * @param {Record<string, string | undefined>} ambient
 * @param {string} testDatabaseUrl
 * @param {Record<string, string | undefined>} overrides
 * @returns {Record<string, string | undefined>}
 */
function buildClosureDatabaseEnvironment(
  ambient,
  testDatabaseUrl,
  overrides = {},
) {
  const guardDatabaseUrl = new URL(testDatabaseUrl);
  guardDatabaseUrl.searchParams.set(
    "application_name",
    "yezyy-closure-booking-db-guard",
  );

  return buildClosureEnvironment(ambient, {
    DATABASE_URL: guardDatabaseUrl.toString(),
    TEST_DATABASE_URL: testDatabaseUrl,
    YEZZY_CLOSURE_E2E: "1",
    ...overrides,
  });
}
