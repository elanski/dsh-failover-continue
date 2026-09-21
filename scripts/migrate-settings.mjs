/**
 * One-shot migration: `model-failover` + `auto-continue` settings sections
 * → the unified `failover-continue` section.
 *
 * Usage:
 *   node scripts/migrate-settings.mjs [--apply] [--settings PATH]
 *
 * Read-only report by default. With --apply: backs the file up to
 * `settings.yaml.bak-fc-migrate-<ts>` first, then writes the merged section
 * (operator values win; missing keys fall back to the new plugin defaults).
 * Needs a python with PyYAML (any machine running DSH tooling has one).
 * Never touches credentials. After migration: disable the old plugin rows
 * (`auto-continue`, `model-failover`, `model-failover-settings`) in the
 * profile patch and restart the host.
 */
import { readFileSync, copyFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { homedir } from 'node:os';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const settingsFlag = args.indexOf('--settings');
const settingsPath = settingsFlag >= 0 && args[settingsFlag + 1] !== undefined
  ? resolve(args[settingsFlag + 1])
  : resolve(homedir(), '.dsh', 'settings.yaml');
const pythons = ['python3', 'python', 'py'];

const reader = `
import sys, yaml, json
path = sys.argv[1]
with open(path, encoding='utf-8') as f:
    doc = yaml.safe_load(f) or {}
print(json.dumps(doc, ensure_ascii=False))
`;

const writer = `
import sys, yaml, json
path, payload = sys.argv[1], sys.argv[2]
fc = json.loads(payload)
with open(path, encoding='utf-8') as f:
    doc = yaml.safe_load(f) or {}
doc['failover-continue'] = fc
with open(path, 'w', encoding='utf-8') as f:
    yaml.safe_dump(doc, f, allow_unicode=True, sort_keys=False)
print('written')
`;

function runPython(code, extraArgs) {
  for (const py of pythons) {
    const run = spawnSync(py, ['-c', code, ...extraArgs], { encoding: 'utf-8' });
    if (run.status === 0) return run.stdout.trim();
  }
  return undefined;
}

const dumped = runPython(reader, [settingsPath]);
if (dumped === undefined) throw new Error('no python with PyYAML found (tried python3/python/py)');
const doc = JSON.parse(dumped);
const mf = doc['model-failover'] ?? {};
const ac = doc['auto-continue'] ?? {};
const merged = { ...mf, ...ac };
const order = [
  'enabled', 'locale', 'fallbacks', 'tripCodes',
  'modelCircuitThreshold', 'modelCooldownMs', 'platformCircuitThreshold',
  'platformCooldownMs', 'burstWindowMs', 'maxSwitchesPerStep',
  'continueText', 'graceMs', 'cooldownMs', 'maxConsecutive', 'scanOnBoot',
  'scanLimit', 'freshMs', 'verbose', 'classify', 'retryableErrorPatterns',
  'backoffFactor', 'backoffMaxMs', 'notify', 'paused',
  'loopGuard', 'loopShortChars', 'loopWindowMs', 'loopShortCount',
  'loopRepeatText', 'loopToolRepeat', 'loopText',
];
const fc = {};
for (const key of order) {
  if (merged[key] !== undefined) fc[key] = merged[key];
}
console.log(`model-failover keys: ${Object.keys(mf).length}, auto-continue keys: ${Object.keys(ac).length}`);
console.log(`merged failover-continue keys: ${Object.keys(fc).length}`);
console.log(JSON.stringify(fc, null, 2).slice(0, 2000));
if (!apply) {
  console.log('\nDry run. Re-run with --apply to write (a .bak is created first).');
  process.exit(0);
}
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const backup = `${settingsPath}.bak-fc-migrate-${stamp}`;
copyFileSync(settingsPath, backup);
console.log(`backup: ${backup}`);
const result = runPython(writer, [settingsPath, JSON.stringify(fc)]);
if (result === undefined) throw new Error('write-back failed: no working python');
console.log(result);
console.log('Next: disable old rows (auto-continue, model-failover, model-failover-settings) + restart host.');
