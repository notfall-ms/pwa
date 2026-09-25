import { LOG } from '@robert.tools/log';
// project.config.ts
LOG.OK('Loading project.config.ts...');
// internal camelCase constants (authoring style)
const base = 'src';
const relativeBase = './..';

// const inputContent = `${base}/frontend`;
const inputContent = `${base}/frontend/pages`;
const outputDir = '_site';
const clientDir = `${base}/frontend`;
const pathPrefix = '/';

const templates = `${relativeBase}/templates`;
// const templates = `${relativeBase}/frontend/templates`;

// const includes = `${templates}/_setup`;
const includes = `${templates}/_includes`;
const layouts = templates;

const dataDir = `${relativeBase}/../_data`;
const dataPath = 'src/_data';

// const projectData = 'src/_data/projects';
const projectData = 'items';

const entryFile = `${clientDir}/main.ts`;
const templateEngine = 'njk';

const hostnameDev = 'localhost';
const portVite = 3000;
const hostVite = `http://${hostnameDev}:${portVite}`;

const projectSlug = 'XXX-XXX';
const logo = 'logo.svg';
const menuIcon = 'burger.svg';
const projectName = 'XXX-XXX';
const configId = 'eleventynunjuckstemplate';

// source → dist pairs (authoring format)
const staticAssetsAuthoring: Array<{ src: string; dist: string }> = [
    { src: './src/frontend/assets/', dist: 'assets' },
    {
        src: './src/frontend/manifest.webmanifest',
        dist: 'manifest.webmanifest',
    },
];

// Eleventy passthrough expects: [{ 'src': 'dist' }, ...]
const staticAssets: Array<Record<string, string>> = staticAssetsAuthoring.map(
    (item) => ({
        [item.src]: item.dist,
    })
);

// exported shape (keeps legacy UPPER_CASE keys for compatibility)
export type ProjectConfig = {
    CONFIG_ID: string;
    LOGO: string;
    MENU_ICON: string;
    PROJECT_SLUG: string;
    PROJECT_NAME: string;
    OUTPUT_DIR: string;
    PATH_PREFIX: string;
    INCLUDES: string;
    DATA_DIR: string;
    DATA_PATH: string;
    PROJECT_DATA: string;
    ENTRY_FILE: string;
    TEMPLATE_ENGINE: string;
    PORT_VITE: number;
    HOST_VITE: string;
    INPUT_CONTENT: string;
    LAYOUTS: string;
    STATIC_ASSETS: Array<Record<string, string>>;
};

export const config: ProjectConfig = {
    CONFIG_ID: configId,
    LOGO: logo,
    MENU_ICON: menuIcon,
    PROJECT_SLUG: projectSlug,
    PROJECT_NAME: projectName,
    OUTPUT_DIR: outputDir,
    PATH_PREFIX: pathPrefix,
    INCLUDES: includes,
    DATA_DIR: dataDir,
    DATA_PATH: dataPath,
    PROJECT_DATA: projectData,
    ENTRY_FILE: entryFile,
    TEMPLATE_ENGINE: templateEngine,
    PORT_VITE: portVite,
    HOST_VITE: hostVite,
    INPUT_CONTENT: inputContent,
    LAYOUTS: layouts,
    STATIC_ASSETS: staticAssets,
};

// export default config;
