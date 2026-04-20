/**
 * Centralized branding assets for CrabPal.
 * The legacy export names remain temporarily to avoid touching every call site
 * during the first rebrand pass.
 */

export const CRABPAL_WORDMARK = ['CrabPal'] as const;
export const CRABPAL_WORDMARK_HTML = CRABPAL_WORDMARK.join('\n');

export const CRAB_PAL_LOGO = CRABPAL_WORDMARK;
export const CRAB_PAL_LOGO_HTML = CRABPAL_WORDMARK_HTML;

/** Session viewer base URL */
export const VIEWER_URL = 'https://crabpal.app';
