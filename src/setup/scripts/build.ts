import { spawnSync } from 'node:child_process';
import { buildApp, startEleventy, startVite } from './_shared/utils';
import { buildPwa } from '../pwa/pwa';

const steps = [
    buildApp('api'),
    startVite('build', 'vite.config.ts'),
    startEleventy(false),
];
for (const [command, args] of steps) {
    const result = spawnSync(command, args, { stdio: 'inherit', shell: true });
    if (result.error || result.status !== 0) process.exit(result.status || 1);
}
buildPwa();
