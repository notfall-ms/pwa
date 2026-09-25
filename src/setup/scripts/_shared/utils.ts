import { command } from '@robert.tools/cmd';
import { FS } from '@robert.tools/fs';
import { LOG } from '@robert.tools/log';

type TASK = [string, string[]];
export const startApp = (appName: string): TASK => {
    return ['npm', ['run', 'start_app', '--', appName]];
};
export const buildApp = (appName: string, param: string = ''): TASK => {
    const appFile = `src/backend/apps/${appName}/index.ts`;
    return ['tsx', [appFile, param]];
};

export const startVite = (type = 'serve', config?: string): TASK => {
    return ['vite', [type, ...(config ? ['--config', config] : [])]] as const;
};
export const startEleventy = (serve = true): TASK => {
    const has = FS.hasFile('.eleventy.shim.js');
    LOG.INFO(`Eleventy shim exists: ${has}`);
    return ['eleventy', ['--config=.eleventy.shim.js', ...(serve ? ['--serve'] : [])]] as const;
};

export const checkOldViteProcess = (): string => {
    return checkProcess('/node_modules/.bin/vite');
};
export const checkProcess = (name: string): string => {
    const finalName = `[${name[0]}]${name.slice(1)}`;
    const result = command(`ps aux | grep "${finalName}"`);
    return result.trim();
};

// "watch:api": "chokidar 'src/frontend' -c 'npm run build:api'",  => "build:api": "npm run build_app -- api",


// "dev:vite": "vite",
//     "dev:eleventy": "eleventy --config=.eleventy.shim.js --serve"