/**
 * Backward-compat shim for the CRAFT_* -> CRAB_PAL_* env var rename.
 *
 * For every CRAFT_FOO in process.env, if CRAB_PAL_FOO is unset, copy the value
 * over and emit a one-shot deprecation warning. Safe to call multiple times —
 * subsequent calls are no-ops.
 *
 * Call once at the top of each binary entry point, before any env reads.
 */

let applied = false;

export function applyLegacyCraftEnv(): void {
  if (applied) return;
  applied = true;
  if (typeof process === 'undefined' || !process.env) return;

  const migrated: string[] = [];
  for (const key of Object.keys(process.env)) {
    if (!key.startsWith('CRAFT_')) continue;
    const newKey = 'CRAB_PAL_' + key.slice('CRAFT_'.length);
    if (process.env[newKey] === undefined) {
      process.env[newKey] = process.env[key];
      migrated.push(`${key} -> ${newKey}`);
    }
  }

  if (migrated.length > 0 && process.env.CRAB_PAL_SUPPRESS_LEGACY_ENV_WARNING !== '1') {
    // eslint-disable-next-line no-console
    console.warn(
      `[crabpal] Deprecated CRAFT_* env vars detected; mapped to CRAB_PAL_*. ` +
        `Rename to silence this warning (set CRAB_PAL_SUPPRESS_LEGACY_ENV_WARNING=1 to hide). ` +
        `Mapped: ${migrated.join(', ')}`
    );
  }
}
