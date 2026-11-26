import fs from 'node:fs';
import path from 'node:path';

export type LicenseTier = 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN';

export interface PackageLicenseFinding {
  name: string;
  version: string;
  license: string;
  tier: LicenseTier;
  reason: string;
}

export interface LicenseAuditReport {
  scannedPackages: number;
  greenCount: number;
  yellowFindings: PackageLicenseFinding[];
  redFindings: PackageLicenseFinding[];
  unknownFindings: PackageLicenseFinding[];
  passed: boolean;
}

const GREEN_TOKENS = new Set([
  'MIT',
  'APACHE-2.0',
  'ISC',
  'BSD-2-CLAUSE',
  'BSD-3-CLAUSE',
  'UNLICENSE',
  '0BSD',
  'CC0-1.0',
  'CC-BY-4.0',
  'BLUEOAK-1.0.0',
  'PYTHON-2.0',
]);

const FORBIDDEN_PACKAGES = new Set(['remotion', '@remotion/cli', '@remotion/bundler', '@remotion/renderer']);

function isYellowToken(tokenUpper: string): boolean {
  return (
    tokenUpper === 'MPL-2.0' ||
    tokenUpper.startsWith('LGPL')
  );
}

function isRedToken(tokenUpper: string): boolean {
  if (isYellowToken(tokenUpper)) return false;
  return (
    tokenUpper.startsWith('AGPL') ||
    tokenUpper.startsWith('GPL') ||
    tokenUpper.startsWith('SSPL')
  );
}

function normalizeLicenseField(raw: unknown): string {
  if (typeof raw === 'string' && raw.trim().length > 0) return raw.trim();
  if (raw && typeof raw === 'object' && 'type' in raw && typeof (raw as { type?: unknown }).type === 'string') {
    return (raw as { type: string }).type.trim();
  }
  if (Array.isArray(raw)) {
    return raw.map((item) => normalizeLicenseField(item)).filter(Boolean).join(' OR ');
  }
  return 'UNKNOWN';
}

export function classifyLicense(packageName: string, licenseExpr: string): { tier: LicenseTier; reason: string } {
  if (FORBIDDEN_PACKAGES.has(packageName)) {
    return { tier: 'RED', reason: 'Forbidden required dependency per ADR-0002 (Remotion).' };
  }

  const parts = licenseExpr
    .replace(/[()]/g, ' ')
    .split(/\s+OR\s+|\s*\/\s*|\s+AND\s+/i)
    .map((p) => p.trim().toUpperCase())
    .filter(Boolean);

  if (parts.length === 0 || licenseExpr === 'UNKNOWN') {
    return { tier: 'UNKNOWN', reason: 'Missing or unparseable license expression.' };
  }

  // For OR disjunctive licenses, pick the most permissive option available.
  const isOrDisjunction = /\s+OR\s+|\s*\/\s*/i.test(licenseExpr);
  if (isOrDisjunction && parts.some((p) => GREEN_TOKENS.has(p))) {
    return { tier: 'GREEN', reason: `Permissive disjunctive license (${licenseExpr}).` };
  }

  if (parts.some((p) => isRedToken(p))) {
    return { tier: 'RED', reason: `Copyleft/network-copyleft license (${licenseExpr}) prohibited in core bundle.` };
  }

  if (parts.every((p) => GREEN_TOKENS.has(p))) {
    return { tier: 'GREEN', reason: 'Permissive open-source license.' };
  }

  if (parts.some((p) => isYellowToken(p))) {
    return { tier: 'YELLOW', reason: `Weak copyleft (${licenseExpr}) requires attribution/boundary review.` };
  }

  return { tier: 'UNKNOWN', reason: `Unclassified license (${licenseExpr}) requires manual review.` };
}

function collectPackageJsonFiles(nodeModulesDir: string, out: string[] = []): string[] {
  if (!fs.existsSync(nodeModulesDir)) return out;
  for (const entry of fs.readdirSync(nodeModulesDir, { withFileTypes: true })) {
    if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
    if (entry.name.startsWith('.')) continue;

    const fullPath = path.join(nodeModulesDir, entry.name);
    if (entry.name.startsWith('@')) {
      for (const scoped of fs.readdirSync(fullPath, { withFileTypes: true })) {
        if (!scoped.isDirectory() && !scoped.isSymbolicLink()) continue;
        const pkgJson = path.join(fullPath, scoped.name, 'package.json');
        if (fs.existsSync(pkgJson)) out.push(pkgJson);
        const nestedNm = path.join(fullPath, scoped.name, 'node_modules');
        if (fs.existsSync(nestedNm)) collectPackageJsonFiles(nestedNm, out);
      }
    } else {
      const pkgJson = path.join(fullPath, 'package.json');
      if (fs.existsSync(pkgJson)) out.push(pkgJson);
      const nestedNm = path.join(fullPath, 'node_modules');
      if (fs.existsSync(nestedNm)) collectPackageJsonFiles(nestedNm, out);
    }
  }
  return out;
}

export function auditInstalledNodeModules(repoRoot: string): LicenseAuditReport {
  const pkgFiles = collectPackageJsonFiles(path.join(repoRoot, 'node_modules'));
  const seen = new Map<string, PackageLicenseFinding>();

  for (const file of pkgFiles) {
    try {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as {
        name?: string;
        version?: string;
        license?: unknown;
        licenses?: unknown;
      };
      if (!parsed.name || parsed.name.startsWith('@youbellkey/')) continue;
      const version = parsed.version ?? '0.0.0';
      const key = `${parsed.name}@${version}`;
      if (seen.has(key)) continue;

      const license = normalizeLicenseField(parsed.license ?? parsed.licenses);
      const { tier, reason } = classifyLicense(parsed.name, license);
      seen.set(key, { name: parsed.name, version, license, tier, reason });
    } catch {
      // Ignore malformed internal stub package.json files without name/version
    }
  }

  const findings = [...seen.values()];
  const yellowFindings = findings.filter((f) => f.tier === 'YELLOW');
  const redFindings = findings.filter((f) => f.tier === 'RED');
  const unknownFindings = findings.filter((f) => f.tier === 'UNKNOWN');

  return {
    scannedPackages: findings.length,
    greenCount: findings.filter((f) => f.tier === 'GREEN').length,
    yellowFindings,
    redFindings,
    unknownFindings,
    passed: redFindings.length === 0 && unknownFindings.length === 0,
  };
}

export function formatThirdPartyNotices(
  report: LicenseAuditReport,
  ffmpegConfigLine: string,
): string {
  const lines = [
    '# THIRD-PARTY NOTICES AND SOFTWARE BILL OF MATERIALS (SBOM)',
    '',
    'Generated by `@youbellkey/license-registry`.',
    '',
    '## 1. Summary',
    `- Scanned npm dependencies: ${report.scannedPackages}`,
    `- Green (MIT/Apache-2.0/BSD/ISC/Unlicense/CC-BY-4.0): ${report.greenCount}`,
    `- Yellow (Weak copyleft review): ${report.yellowFindings.length}`,
    `- Red violations: ${report.redFindings.length}`,
    `- Unknown requiring review: ${report.unknownFindings.length}`,
    '',
    '## 2. Core Engines & External System Binaries',
    '- **HyperFrames (`hyperframes`):** Apache-2.0 (Copyright HeyGen). Used as master HTML/CSS/JS deterministic renderer.',
    '- **Three.js (`three`):** MIT. Used for 3D motion graphics presets.',
    '- **Zod (`zod`), TypeScript (`typescript`), Vitest (`vitest`), tsx (`tsx`), Next.js (`next`), React (`react`):** MIT / Apache-2.0.',
    '- **Browser Compatibility Data (`caniuse-lite`):** CC-BY-4.0 (BrowserStack / Fyrd, transitive dependency of Next.js).',
    `- **Local System FFmpeg Audit:** \`${ffmpegConfigLine || 'ffmpeg not inspected'}\``,
    '  - Note: Local personal builds containing `--enable-gpl` (`libx264`/`libx265`) are executed strictly as external CLI subprocesses for personal use and MUST NOT be bundled in Phase 7 commercial distribution.',
  ];

  if (report.yellowFindings.length > 0) {
    lines.push('', '## 3. Yellow Findings (Weak Copyleft — Boundary / Attribution Review)');
    for (const f of report.yellowFindings) {
      lines.push(`- \`${f.name}@${f.version}\` (${f.license}): ${f.reason}`);
    }
  }
  if (report.redFindings.length > 0) {
    lines.push('', '## 4. Red Findings (Action Required)');
    for (const f of report.redFindings) {
      lines.push(`- \`${f.name}@${f.version}\` (${f.license}): ${f.reason}`);
    }
  }
  if (report.unknownFindings.length > 0) {
    lines.push('', '## 5. Unknown Licenses (Manual Review)');
    for (const f of report.unknownFindings) {
      lines.push(`- \`${f.name}@${f.version}\` (${f.license}): ${f.reason}`);
    }
  }

  return `${lines.join('\n')}\n`;
}
