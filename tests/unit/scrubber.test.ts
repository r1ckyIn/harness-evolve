import { describe, it, expect } from 'vitest';
import { scrubString, scrubObject } from '../../src/scrubber/scrub.js';
import { SCRUB_PATTERNS } from '../../src/scrubber/patterns.js';

describe('SCRUB_PATTERNS', () => {
  it('exports at least 14 patterns', () => {
    expect(SCRUB_PATTERNS.length).toBeGreaterThanOrEqual(14);
  });

  it('each pattern has name, regex, and replacement', () => {
    for (const pattern of SCRUB_PATTERNS) {
      expect(pattern).toHaveProperty('name');
      expect(pattern).toHaveProperty('regex');
      expect(pattern).toHaveProperty('replacement');
      expect(pattern.regex).toBeInstanceOf(RegExp);
      expect(pattern.replacement).toMatch(/^\[REDACTED:\w+\]$/);
    }
  });
});

describe('scrubString', () => {
  it('redacts AWS access key (AKIA prefix)', () => {
    const input = 'key is AKIAIOSFODNN7EXAMPLE';
    expect(scrubString(input)).toBe('key is [REDACTED:aws_key]');
  });

  it('redacts AWS secret access key', () => {
    const input = 'aws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY1';
    expect(scrubString(input)).toContain('[REDACTED:aws_secret]');
    expect(scrubString(input)).not.toContain('wJalrXUtnFEMI');
  });

  it('redacts GitHub PAT (ghp_ prefix)', () => {
    const input = 'ghp_1234567890abcdefghijklmnopqrstuvwxyz12';
    expect(scrubString(input)).toBe('[REDACTED:github_token]');
  });

  it('redacts GitHub PAT (ghs_ prefix)', () => {
    const input = 'token: ghs_1234567890abcdefghijklmnopqrstuvwxyz12';
    expect(scrubString(input)).toContain('[REDACTED:github_token]');
    expect(scrubString(input)).not.toContain('ghs_');
  });

  it('redacts GitHub OAuth token (gho_ prefix)', () => {
    const input = 'gho_1234567890abcdefghijklmnopqrstuvwxyz12';
    expect(scrubString(input)).toBe('[REDACTED:github_oauth]');
  });

  it('redacts Bearer token', () => {
    const input = 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJ0ZXN0IjoiMSJ9.abc123';
    const result = scrubString(input);
    // Bearer match or JWT match -- either redaction is acceptable
    expect(result).toMatch(/\[REDACTED:(bearer_token|jwt)\]/);
    expect(result).not.toContain('eyJhbGciOiJIUzI1NiJ9');
  });

  it('redacts standalone JWT (eyJ prefix)', () => {
    const input = 'token=eyJhbGciOiJIUzI1NiJ9.eyJ0ZXN0IjoiMSJ9.abc123';
    const result = scrubString(input);
    expect(result).toMatch(/\[REDACTED:(bearer_token|jwt)\]/);
    expect(result).not.toContain('eyJhbGciOiJIUzI1NiJ9');
  });

  it('redacts generic API key assignment', () => {
    const input = 'api_key = "abcdefghij1234567890abc"';
    expect(scrubString(input)).toContain('[REDACTED:api_key]');
    expect(scrubString(input)).not.toContain('abcdefghij1234567890abc');
  });

  it('redacts generic secret assignment', () => {
    const input = 'secret = "abcdefghij1234567890abc"';
    expect(scrubString(input)).toContain('[REDACTED:secret]');
    expect(scrubString(input)).not.toContain('abcdefghij1234567890abc');
  });

  it('redacts private key header', () => {
    const input = '-----BEGIN RSA PRIVATE KEY-----';
    expect(scrubString(input)).toBe('[REDACTED:private_key]');
  });

  it('redacts EC private key header', () => {
    const input = '-----BEGIN EC PRIVATE KEY-----';
    expect(scrubString(input)).toBe('[REDACTED:private_key]');
  });

  it('redacts OPENSSH private key header', () => {
    const input = '-----BEGIN OPENSSH PRIVATE KEY-----';
    expect(scrubString(input)).toBe('[REDACTED:private_key]');
  });

  it('redacts password assignment', () => {
    const input = "password = 'mysecretpass123'";
    expect(scrubString(input)).toContain('[REDACTED:password]');
    expect(scrubString(input)).not.toContain('mysecretpass123');
  });

  it('redacts passwd assignment', () => {
    const input = 'passwd: my_secure_password1';
    expect(scrubString(input)).toContain('[REDACTED:password]');
    expect(scrubString(input)).not.toContain('my_secure_password1');
  });

  it('redacts Slack token (xoxb prefix)', () => {
    const input = 'xoxb-12345678-abcdefgh';
    expect(scrubString(input)).toBe('[REDACTED:slack_token]');
  });

  it('redacts Slack token (xoxp prefix)', () => {
    const input = 'token: xoxp-12345678-abcdefgh';
    expect(scrubString(input)).toContain('[REDACTED:slack_token]');
  });

  it('redacts Google API key (AIza prefix)', () => {
    const input = 'AIzaSyC3B7xj1234567890abcdefghijklmnopq';
    expect(scrubString(input)).toBe('[REDACTED:google_api_key]');
  });

  it('redacts Stripe secret key (sk_test_ prefix)', () => {
    const input = 'sk_test_1234567890abcdefghij';
    expect(scrubString(input)).toBe('[REDACTED:stripe_key]');
  });

  it('redacts Stripe secret key (sk_live_ prefix)', () => {
    const input = 'sk_live_1234567890abcdefghij';
    expect(scrubString(input)).toBe('[REDACTED:stripe_key]');
  });

  it('redacts database URL with credentials', () => {
    const input = 'postgres://user:pass@localhost:5432/db';
    expect(scrubString(input)).toBe('[REDACTED:db_url]');
  });

  it('redacts MySQL database URL', () => {
    const input = 'mysql://admin:secret@db.example.com/mydb';
    expect(scrubString(input)).toBe('[REDACTED:db_url]');
  });

  it('redacts MongoDB database URL', () => {
    const input = 'mongodb://root:pass123@mongo.host:27017/test';
    expect(scrubString(input)).toBe('[REDACTED:db_url]');
  });

  it('leaves non-secret strings unchanged', () => {
    const input = 'no secrets here';
    expect(scrubString(input)).toBe('no secrets here');
  });

  it('leaves empty string unchanged', () => {
    expect(scrubString('')).toBe('');
  });

  it('handles multiple secrets in one string', () => {
    const input = 'key=AKIAIOSFODNN7EXAMPLE token=ghp_1234567890abcdefghijklmnopqrstuvwxyz12';
    const result = scrubString(input);
    expect(result).toContain('[REDACTED:aws_key]');
    expect(result).toContain('[REDACTED:github_token]');
    expect(result).not.toContain('AKIAIOSFODNN7EXAMPLE');
    expect(result).not.toContain('ghp_');
  });

  it('is safe to call multiple times (regex lastIndex reset)', () => {
    const input = 'key AKIAIOSFODNN7EXAMPLE';
    // Call twice to verify global regex lastIndex is properly reset
    expect(scrubString(input)).toBe('key [REDACTED:aws_key]');
    expect(scrubString(input)).toBe('key [REDACTED:aws_key]');
  });
});

describe('scrubObject', () => {
  it('scrubs string values in a flat object', () => {
    const input = { prompt: 'key AKIAIOSFODNN7EXAMPLE', count: 5 };
    const result = scrubObject(input);
    expect(result).toEqual({
      prompt: 'key [REDACTED:aws_key]',
      count: 5,
    });
  });

  it('scrubs nested objects recursively', () => {
    const input = {
      outer: {
        inner: 'Bearer mytoken123456789012345',
        num: 42,
      },
      top: 'clean',
    };
    const result = scrubObject(input);
    expect(result.outer.inner).toContain('[REDACTED:bearer_token]');
    expect(result.outer.num).toBe(42);
    expect(result.top).toBe('clean');
  });

  it('scrubs arrays of strings', () => {
    const input = ['AKIAIOSFODNN7EXAMPLE', 'safe', 'ghp_1234567890abcdefghijklmnopqrstuvwxyz12'];
    const result = scrubObject(input);
    expect(result[0]).toBe('[REDACTED:aws_key]');
    expect(result[1]).toBe('safe');
    expect(result[2]).toBe('[REDACTED:github_token]');
  });

  it('handles arrays of objects', () => {
    const input = [
      { secret: 'sk_test_1234567890abcdefghij' },
      { safe: 'hello' },
    ];
    const result = scrubObject(input);
    expect(result[0].secret).toBe('[REDACTED:stripe_key]');
    expect(result[1].safe).toBe('hello');
  });

  it('passes through non-string primitives unchanged', () => {
    expect(scrubObject(42)).toBe(42);
    expect(scrubObject(true)).toBe(true);
    expect(scrubObject(null)).toBeNull();
    expect(scrubObject(undefined)).toBeUndefined();
  });

  it('scrubs a top-level string', () => {
    const result = scrubObject('password = "longpassword123"');
    expect(result).toContain('[REDACTED:password]');
  });
});
