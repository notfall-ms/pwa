import { spawnSync } from 'node:child_process';
import { buildApp, startEleventy, startVite } from './_shared/utils';
import { buildPwa } from '../pwa/pwa';
import { markKioskPages, writeKioskInfo } from '../pwa/kiosk/kiosk';
import { config } from '../../../project.config';

const steps = [
    buildApp('api'),
    startVite('build', 'vite.config.ts'),
    startEleventy(false),
];
for (const [command, args] of steps) {
    const result = spawnSync(command, args, { stdio: 'inherit', shell: true });
    if (result.error || result.status !== 0) process.exit(result.status || 1);
}
const kiosk = process.env.NOTFALLMS_KIOSK === '1';
if (kiosk) markKioskPages(config.OUTPUT_DIR);
buildPwa();
if (kiosk) writeKioskInfo(config.OUTPUT_DIR);
