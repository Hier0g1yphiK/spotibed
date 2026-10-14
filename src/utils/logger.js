/**
 * Structured logging utility for Spotibed.
 * Logs command, input, errorType, errorMessage fields.
 * Never includes secrets (DISCORD_TOKEN).
 */

const SECRETS = new Set(['DISCORD_TOKEN']);

/**
 * Strips any secret values from a string.
 */
function redactSecrets(value) {
  if (typeof value !== 'string') return value;
  let redacted = value;
  for (const key of SECRETS) {
    const secretValue = process.env[key];
    if (secretValue && secretValue.trim() !== '') {
      redacted = redacted.replaceAll(secretValue, '[REDACTED]');
    }
  }
  return redacted;
}

/**
 * Sanitizes a log entry to remove secret values from all string fields.
 */
function sanitize(entry) {
  const clean = {};
  for (const [key, value] of Object.entries(entry)) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'string') {
      clean[key] = redactSecrets(value);
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      clean[key] = sanitize(value);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

/**
 * Builds a structured log entry from an error context.
 */
function buildLogEntry({ command, input, error, ...rest }) {
  return {
    timestamp: new Date().toISOString(),
    command,
    input,
    errorType: error?.constructor?.name || error?.name || 'Unknown',
    errorMessage: error?.message || 'Unknown error',
    ...rest,
  };
}

function buildInfoEntry(context) {
  return typeof context === 'string'
    ? { timestamp: new Date().toISOString(), message: context }
    : { timestamp: new Date().toISOString(), ...context };
}

export const logger = {
  error(context) {
    console.error(JSON.stringify(sanitize(buildLogEntry(context))));
  },

  warn(context) {
    console.warn(JSON.stringify(sanitize(buildInfoEntry(context))));
  },

  info(context) {
    console.info(JSON.stringify(sanitize(buildInfoEntry(context))));
  },
};
