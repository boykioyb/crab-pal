import { describe, it, expect, afterEach } from 'bun:test';
import { isDevRuntime, isDeveloperFeedbackEnabled, isCraftAgentsCliEnabled, isEmbeddedServerEnabled } from '../feature-flags.ts';

const ORIGINAL_ENV = {
  NODE_ENV: process.env.NODE_ENV,
  CRAB_PAL_DEBUG: process.env.CRAB_PAL_DEBUG,
  CRAB_PAL_FEATURE_DEVELOPER_FEEDBACK: process.env.CRAB_PAL_FEATURE_DEVELOPER_FEEDBACK,
  CRAB_PAL_FEATURE_CRABPAL_CLI: process.env.CRAB_PAL_FEATURE_CRABPAL_CLI,
  CRAB_PAL_FEATURE_EMBEDDED_SERVER: process.env.CRAB_PAL_FEATURE_EMBEDDED_SERVER,
};

afterEach(() => {
  if (ORIGINAL_ENV.NODE_ENV === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = ORIGINAL_ENV.NODE_ENV;

  if (ORIGINAL_ENV.CRAB_PAL_DEBUG === undefined) delete process.env.CRAB_PAL_DEBUG;
  else process.env.CRAB_PAL_DEBUG = ORIGINAL_ENV.CRAB_PAL_DEBUG;

  if (ORIGINAL_ENV.CRAB_PAL_FEATURE_DEVELOPER_FEEDBACK === undefined) delete process.env.CRAB_PAL_FEATURE_DEVELOPER_FEEDBACK;
  else process.env.CRAB_PAL_FEATURE_DEVELOPER_FEEDBACK = ORIGINAL_ENV.CRAB_PAL_FEATURE_DEVELOPER_FEEDBACK;

  if (ORIGINAL_ENV.CRAB_PAL_FEATURE_CRABPAL_CLI === undefined) delete process.env.CRAB_PAL_FEATURE_CRABPAL_CLI;
  else process.env.CRAB_PAL_FEATURE_CRABPAL_CLI = ORIGINAL_ENV.CRAB_PAL_FEATURE_CRABPAL_CLI;

  if (ORIGINAL_ENV.CRAB_PAL_FEATURE_EMBEDDED_SERVER === undefined) delete process.env.CRAB_PAL_FEATURE_EMBEDDED_SERVER;
  else process.env.CRAB_PAL_FEATURE_EMBEDDED_SERVER = ORIGINAL_ENV.CRAB_PAL_FEATURE_EMBEDDED_SERVER;
});

describe('feature-flags runtime helpers', () => {
  it('isDevRuntime returns true for explicit dev NODE_ENV', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.CRAB_PAL_DEBUG;

    expect(isDevRuntime()).toBe(true);
  });

  it('isDevRuntime returns true for CRAB_PAL_DEBUG override', () => {
    process.env.NODE_ENV = 'production';
    process.env.CRAB_PAL_DEBUG = '1';

    expect(isDevRuntime()).toBe(true);
  });

  it('isDeveloperFeedbackEnabled honors explicit override false', () => {
    process.env.NODE_ENV = 'development';
    process.env.CRAB_PAL_FEATURE_DEVELOPER_FEEDBACK = '0';

    expect(isDeveloperFeedbackEnabled()).toBe(false);
  });

  it('isDeveloperFeedbackEnabled honors explicit override true', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.CRAB_PAL_DEBUG;
    process.env.CRAB_PAL_FEATURE_DEVELOPER_FEEDBACK = '1';

    expect(isDeveloperFeedbackEnabled()).toBe(true);
  });

  it('isDeveloperFeedbackEnabled falls back to dev runtime when no override', () => {
    process.env.NODE_ENV = 'production';
    process.env.CRAB_PAL_DEBUG = '1';
    delete process.env.CRAB_PAL_FEATURE_DEVELOPER_FEEDBACK;

    expect(isDeveloperFeedbackEnabled()).toBe(true);
  });

  it('isCraftAgentsCliEnabled defaults to false when no override is set', () => {
    delete process.env.CRAB_PAL_FEATURE_CRABPAL_CLI;

    expect(isCraftAgentsCliEnabled()).toBe(false);
  });

  it('isCraftAgentsCliEnabled honors explicit override true', () => {
    process.env.CRAB_PAL_FEATURE_CRABPAL_CLI = '1';

    expect(isCraftAgentsCliEnabled()).toBe(true);
  });

  it('isCraftAgentsCliEnabled honors explicit override false', () => {
    process.env.CRAB_PAL_FEATURE_CRABPAL_CLI = '0';

    expect(isCraftAgentsCliEnabled()).toBe(false);
  });

  it('isEmbeddedServerEnabled defaults to false when no override is set', () => {
    delete process.env.CRAB_PAL_FEATURE_EMBEDDED_SERVER;

    expect(isEmbeddedServerEnabled()).toBe(false);
  });

  it('isEmbeddedServerEnabled honors explicit override true', () => {
    process.env.CRAB_PAL_FEATURE_EMBEDDED_SERVER = '1';

    expect(isEmbeddedServerEnabled()).toBe(true);
  });

  it('isEmbeddedServerEnabled honors explicit override false', () => {
    process.env.CRAB_PAL_FEATURE_EMBEDDED_SERVER = '0';

    expect(isEmbeddedServerEnabled()).toBe(false);
  });
});
