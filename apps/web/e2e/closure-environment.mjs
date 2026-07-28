const PASSTHROUGH_ENVIRONMENT = [
  "PATH",
  "HOME",
  "TMPDIR",
  "TMP",
  "TEMP",
  "SHELL",
  "USER",
  "LOGNAME",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "TERM",
  "COLORTERM",
  "NO_COLOR",
  "FORCE_COLOR",
  "CI",
  "COREPACK_HOME",
  "PNPM_HOME",
  "XDG_CACHE_HOME",
  "DOCKER_HOST",
  "DOCKER_CONTEXT",
  "DOCKER_CONFIG",
];

const FORBIDDEN_EXTERNAL_CREDENTIALS = [
  "RESEND_API_KEY",
  "SMTP_USER",
  "SMTP_USERNAME",
  "SMTP_PASS",
  "SMTP_PASSWORD",
  "SENDGRID_API_KEY",
  "POSTMARK_SERVER_TOKEN",
  "MAILGUN_API_KEY",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "S3_ACCESS_KEY",
  "S3_SECRET_KEY",
];

/**
 * Build an allowlisted child environment. Production service configuration is
 * never inherited; closure-specific local values must be supplied explicitly.
 *
 * @param {Record<string, string | undefined>} ambient
 * @param {Record<string, string | undefined>} overrides
 * @returns {Record<string, string | undefined>}
 */
export function buildClosureEnvironment(ambient, overrides = {}) {
  /** @type {Record<string, string | undefined>} */
  const environment = {};
  for (const name of PASSTHROUGH_ENVIRONMENT) {
    if (ambient[name] !== undefined) environment[name] = ambient[name];
  }
  Object.assign(environment, overrides);
  for (const name of FORBIDDEN_EXTERNAL_CREDENTIALS) {
    delete environment[name];
  }
  return environment;
}
