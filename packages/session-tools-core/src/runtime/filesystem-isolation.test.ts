import { describe, it, expect } from 'bun:test';
import { buildDarwinSandboxProfile } from './filesystem-isolation.ts';

describe('buildDarwinSandboxProfile', () => {
  it('includes session subpath write allow', () => {
    const profile = buildDarwinSandboxProfile('/tmp/crabpal-session');
    expect(profile).toContain('(allow file-write* (subpath "/tmp/crabpal-session"))');
    expect(profile).not.toContain('(deny network*)');
  });

  it('includes deny network when requested', () => {
    const profile = buildDarwinSandboxProfile('/tmp/crabpal-session', { includeNetworkDeny: true });
    expect(profile).toContain('(deny network*)');
  });
});
