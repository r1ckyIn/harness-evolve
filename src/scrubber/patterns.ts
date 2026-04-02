// Secret detection regex patterns with [REDACTED:type] markers.
// Based on top-15 patterns from secrets-patterns-db research.
// 14 regex patterns included; high-entropy detection (pattern 15)
// is deferred to config.scrubbing.highEntropyDetection enablement.

export interface ScrubPattern {
  name: string;
  regex: RegExp;
  replacement: string;
}

export const SCRUB_PATTERNS: ScrubPattern[] = [
  {
    name: 'aws_key',
    regex: /AKIA[0-9A-Z]{16}/g,
    replacement: '[REDACTED:aws_key]',
  },
  {
    name: 'aws_secret',
    regex: /(?:aws_secret_access_key|AWS_SECRET_ACCESS_KEY)[\s=:]+[A-Za-z0-9/+=]{40}/g,
    replacement: '[REDACTED:aws_secret]',
  },
  {
    name: 'github_token',
    regex: /gh[ps]_[A-Za-z0-9_]{36,}/g,
    replacement: '[REDACTED:github_token]',
  },
  {
    name: 'github_oauth',
    regex: /gho_[A-Za-z0-9_]{36,}/g,
    replacement: '[REDACTED:github_oauth]',
  },
  {
    name: 'bearer_token',
    regex: /[Bb]earer\s+[A-Za-z0-9\-._~+/]+=*/g,
    replacement: '[REDACTED:bearer_token]',
  },
  {
    name: 'jwt',
    regex: /eyJ[A-Za-z0-9\-_]+\.eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/g,
    replacement: '[REDACTED:jwt]',
  },
  {
    name: 'api_key',
    regex: /(?:api[_-]?key|apikey)[\s=:]+['"]?[A-Za-z0-9\-._]{20,}['"]?/gi,
    replacement: '[REDACTED:api_key]',
  },
  {
    name: 'secret',
    regex: /(?:secret|SECRET)[\s=:]+['"]?[A-Za-z0-9\-._]{20,}['"]?/g,
    replacement: '[REDACTED:secret]',
  },
  {
    name: 'private_key',
    regex: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g,
    replacement: '[REDACTED:private_key]',
  },
  {
    name: 'password',
    regex: /(?:password|passwd|pwd)[\s=:]+['"]?[^\s'"]{8,}['"]?/gi,
    replacement: '[REDACTED:password]',
  },
  {
    name: 'slack_token',
    regex: /xox[bpors]-[A-Za-z0-9-]{10,}/g,
    replacement: '[REDACTED:slack_token]',
  },
  {
    name: 'google_api_key',
    regex: /AIza[0-9A-Za-z\-_]{35}/g,
    replacement: '[REDACTED:google_api_key]',
  },
  {
    name: 'stripe_key',
    regex: /[sr]k_(?:test|live)_[A-Za-z0-9]{20,}/g,
    replacement: '[REDACTED:stripe_key]',
  },
  {
    name: 'db_url',
    regex: /(?:postgres|mysql|mongodb):\/\/[^\s]+:[^\s]+@[^\s]+/g,
    replacement: '[REDACTED:db_url]',
  },
  // Pattern 15: High-entropy string detection is intentionally omitted.
  // It requires Shannon entropy calculation and is deferred to when
  // config.scrubbing.highEntropyDetection is enabled.
];
