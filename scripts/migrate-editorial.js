import { execFileSync } from 'node:child_process';

// Resolve the exact named production database before authorizing the EmDash CLI.
const args = ['migrate', '--manifest', '.emdash/migrations.json',
  '--account-id', '6fd29b2ebec569b31f62dc9dd838a88b', '--d1', 'kirshchenya-editorial'];
const status = JSON.parse(execFileSync('emdash', [...args, '--status', '--json'], { encoding: 'utf8' }));
const { target } = status;
if (target.kind !== 'd1' || !target.label.startsWith('6fd29b2ebec569b31f62dc9dd838a88b/kirshchenya-editorial/')) {
  throw new Error('Unexpected editorial database target');
}
execFileSync('emdash', [...args, '--expected-target-fingerprint', target.fingerprint], { stdio: 'inherit' });
execFileSync('emdash', [...args, '--check'], { stdio: 'inherit' });
