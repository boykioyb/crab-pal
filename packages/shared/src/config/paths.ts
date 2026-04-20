/**
 * Centralized path configuration for CrabPal.
 *
 * Supports multi-instance development via CRABPAL_CONFIG_DIR environment variable.
 * When running from a numbered folder (e.g., crabpal-1), the detect-instance.sh
 * script sets CRABPAL_CONFIG_DIR to ~/.crabpal-1, allowing multiple instances to run
 * simultaneously with separate configurations.
 *
 * Default (non-numbered folders): ~/.crabpal/
 * Instance 1 (-1 suffix): ~/.crabpal-1/
 * Instance 2 (-2 suffix): ~/.crabpal-2/
 */

import { homedir } from 'os';
import { join } from 'path';

// Prefer the new CrabPal env var but keep the old one as a compatibility fallback.
export const CONFIG_DIR =
  process.env.CRABPAL_CONFIG_DIR ||
  process.env.CRAB_PAL_CONFIG_DIR ||
  join(homedir(), '.crabpal');
