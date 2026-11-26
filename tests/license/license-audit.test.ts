import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { auditInstalledNodeModules, classifyLicense } from '@youbellkey/license-registry';

describe('Phase 0 License Policy Compliance', () => {
  it('blocks forbidden dependencies and copyleft licenses', () => {
    expect(classifyLicense('remotion', 'MIT').tier).toBe('RED');
    expect(classifyLicense('postiz-clone', 'AGPL-3.0-only').tier).toBe('RED');
    expect(classifyLicense('some-gpl-lib', 'GPL-3.0-or-later').tier).toBe('RED');
    expect(classifyLicense('hyperframes', 'Apache-2.0').tier).toBe('GREEN');
    expect(classifyLicense('three', 'MIT').tier).toBe('GREEN');
    expect(classifyLicense('weak-lib', 'LGPL-2.1').tier).toBe('YELLOW');
  });

  it('audits all installed node_modules dependencies with zero RED or UNKNOWN findings', () => {
    const report = auditInstalledNodeModules(process.cwd());
    expect(report.scannedPackages).toBeGreaterThan(0);
    expect(report.redFindings).toEqual([]);
    expect(report.unknownFindings).toEqual([]);
    expect(report.passed).toBe(true);
  });

  it('maintains THIRD_PARTY_NOTICES.md at the repository root', () => {
    const noticesPath = path.resolve(process.cwd(), 'THIRD_PARTY_NOTICES.md');
    expect(fs.existsSync(noticesPath)).toBe(true);
  });
});
