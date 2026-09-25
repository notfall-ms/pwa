import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pwaConfig } from '../../../pwa.config';
import { config } from '../../../project.config';
import { version } from '../../../package.json';
import { listFiles, toUrl } from './files/files';

/** 🎯 Generate a versioned worker after all application assets exist. */
export const buildPwa = (development = false): void => {
    const { documentsSource, documentsPath } = pwaConfig;
    if (!/^\/(?:[a-zA-Z0-9_-]+\/)+$/.test(documentsPath)) {
        throw new Error('documentsPath must be an absolute directory URL.');
    }
    if (development)
        cpSync(
            'src/frontend/components/pwa/service-worker/development/development.js',
            join(config.OUTPUT_DIR, 'sw-development.js')
        );
    const destination = join(config.OUTPUT_DIR, documentsPath.slice(1));
    mkdirSync(destination, { recursive: true });
    cpSync(documentsSource, destination, { recursive: true });
    const documents = listFiles(documentsSource).map(
        (file) =>
            documentsPath + toUrl(relative(documentsSource, file)).slice(1)
    );
    writeWorker(documents, development);
};

const writeWorker = (documents: string[], development: boolean): void => {
    const root = config.OUTPUT_DIR;
    const assets = listFiles(root).filter(
        (file) =>
            /\.(html|css|js|svg|png|webmanifest)$/.test(file) &&
            relative(root, file) !== 'sw.js'
    );
    const precache = [
        ...new Set([
            '/',
            ...assets.map((file) => toUrl(relative(root, file))),
            ...documents,
        ]),
    ];
    const source = readFileSync(
        'src/frontend/components/pwa/service-worker/service-worker.js',
        'utf8'
    );
    const hash = createHash('sha256')
        .update(source)
        .update(JSON.stringify(pwaConfig))
        .update(version)
        .update(String(development));
    if (development) {
        listFiles(config.INPUT_CONTENT)
            .concat(listFiles('src/frontend/components'))
            .sort()
            .forEach((file) => hash.update(file).update(readFileSync(file)));
    }
    [...new Set([...assets, ...listFiles(pwaConfig.documentsSource)])]
        .sort()
        .forEach((file) => hash.update(file).update(readFileSync(file)));
    const build = hash.digest('hex').slice(0, 12);
    const metadata = {
        ...pwaConfig,
        version,
        development,
        viteOrigin: new URL(config.HOST_VITE).origin,
        build,
        documents,
        precache,
        cacheName: `${pwaConfig.cachePrefix}${version}-${build}`,
    };
    writeFileSync(
        join(root, 'sw.js'),
        `const PWA = ${JSON.stringify(metadata)};\n${source}`
    );
};
