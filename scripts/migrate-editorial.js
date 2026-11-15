import { execFileSync } from 'node:child_process';

// Resolve the exact named production database before authorizing the EmDash CLI.
const args = ['migrate', '--manifest', '.emdash/migrations.json',
  '--account-id', '6fd29b2ebec569b31f62dc9dd838a88b', '--d1', 'kirshchenya-editorial'];
const readStatus = () => JSON.parse(execFileSync('emdash', [...args, '--status', '--json'], { encoding: 'utf8' }));
const status = readStatus();
const { target } = status;
if (target.kind !== 'd1' || !target.label.startsWith('6fd29b2ebec569b31f62dc9dd838a88b/kirshchenya-editorial/')) {
  throw new Error('Unexpected editorial database target');
}
// Recover only the lock left by the interrupted first-run Worker, which was
// replaced before this deployment. New locks belong to a different operation.
const recovery = [];
if (status.lock?.id === '1794700145936') {
  await new Promise(resolve => setTimeout(resolve, 15000));
  const latest = readStatus();
  if (latest.lock?.id !== status.lock.id || latest.target.fingerprint !== target.fingerprint ||
      JSON.stringify(latest.knownApplied) !== JSON.stringify(status.knownApplied) ||
      latest.unknownApplied.length || target.resourceId !== '61647591-aa5b-4db9-aeff-7e30dd09c58a') {
    throw new Error('Database migration state changed during recovery');
  }
  recovery.push('--take-over-lock', status.lock.id);
}
execFileSync('emdash', [...args, ...recovery, '--expected-target-fingerprint', target.fingerprint], { stdio: 'inherit' });
execFileSync('emdash', [...args, '--check'], { stdio: 'inherit' });
