import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { auditInstalledNodeModules, formatThirdPartyNotices } from './index.js';

function readFfmpegConfig(): string {
  try {
    const out = execFileSync('ffmpeg', ['-version'], { encoding: 'utf8' });
    const configLine = out.split('\n').find((line) => line.startsWith('configuration:'));
    return configLine?.trim() ?? out.split('\n')[0]?.trim() ?? 'unknown';
  } catch {
    return 'ffmpeg binary not found on PATH';
  }
}

const repoRoot = process.cwd();
const args = new Set(process.argv.slice(2));
const report = auditInstalledNodeModules(repoRoot);
const ffmpegConfig = readFfmpegConfig();

console.log(
  JSON.stringify(
    {
      scannedPackages: report.scannedPackages,
      greenCount: report.greenCount,
      yellowCount: report.yellowFindings.length,
      redCount: report.redFindings.length,
      unknownCount: report.unknownFindings.length,
      passed: report.passed,
    },
    null,
    2,
  ),
);

if (args.has('--write-notices')) {
  const notices = formatThirdPartyNotices(report, ffmpegConfig);
  fs.writeFileSync(path.join(repoRoot, 'THIRD_PARTY_NOTICES.md'), notices, 'utf8');
  console.log('Updated THIRD_PARTY_NOTICES.md');
}

if (args.has('--verify') && !report.passed) {
  console.error('License verification failed:', report.redFindings, report.unknownFindings);
  process.exit(1);
}
