import type { HEALTH_CHECK } from './checks/checks.d';
import type { TEST_URL } from './checks/checks.d';
import { getHttpStatusValue } from '@robert.tools/http';
import { LOG } from '@robert.tools/log';
import { FS } from '@robert.tools/fs';

const argv = process.argv;
const fastCheck = argv.includes('--fast') || argv.includes('-f');

const TEST_CONNECTION_URLS: string[] = [
    // 'https://github.com',
    // 'https://www.google.com/',
    // 'https://www.wikipedia.org/',
    // 'https://developer.mozilla.org/',
    // 'https://www.mozilla.org/',
    // 'https://www.cloudflare.com',
    // 'https://www.npmjs.com/',
];

// check for _site folder and html files
// check for internet connection (random url from list)
// check for dev server connection (localhost:8080, localhost:3000)

export const hasHTMLFiles = (path: string): HEALTH_CHECK[] => {
    const checks: HEALTH_CHECK[] = [];
    // has _site folder
    let hasSiteFolder = FS.exists(path);
    if (hasSiteFolder) {
        checks.push({
            name: '_site-folder',
            result: true,
            message: `✅ _site folder exists`,
        });
        const htmlFiles = FS.list(path).filter((file: string) =>
            file.endsWith('.html')
        );
        if (htmlFiles.length > 0) {
            checks.push({
                name: 'html-files',
                result: true,
                message: `✅ _site contains HTML files (${htmlFiles.length})`,
            });
        } else {
            checks.push({
                name: 'html-files',
                result: false,
                message: `❌ _site does not contain any HTML files`,
            });
        }
    } else {
        checks.push({
            name: '_site-folder',
            result: false,
            message: `❌ _site folder does not exist`,
        });
        checks.push({
            name: 'html-files',
            result: false,
            message: `❌ _site does not contain any HTML files`,
        });
    }
    return checks;
};

// valid for github copilot
const hasInternetConnection = (testUrls: string[]): HEALTH_CHECK[] => {
    const checks: HEALTH_CHECK[] = [];
    const randomIndex = Math.floor(Math.random() * testUrls.length);
    const url = testUrls[randomIndex];
    const httpStatus: string = getHttpStatusValue(url);
    const httpValue = parseInt(httpStatus, 10);
    const name = 'internet-connection';
    let message = `❌ ${url} is not reachable (status: ${httpStatus})`;
    const result = httpValue >= 200 && httpValue < 400 ? true : false;
    if (result === true) {
        message = `🌐 ${url} is reachable (status: ${httpStatus})`;
    }
    checks.push({ name, result, message });
    return checks;
};

export const hasDevelopmentServerConnection = (
    urls: TEST_URL[]
): HEALTH_CHECK[] => {
    const checks: HEALTH_CHECK[] = [];
    urls.forEach((item: TEST_URL) => {
        const url = item.url;
        const httpStatus: string = getHttpStatusValue(url);
        const httpValue = parseInt(httpStatus, 10);
        const name = item.name;
        console.log(httpStatus, name);
        const result = httpValue >= 200 && httpValue < 400 ? true : false;
        let message = `❌ ${url} [${name}] is not reachable (status: ${httpStatus})`;
        if (result === true) {
            message = `🖥️ ${url} [${name}] is reachable (status: ${httpStatus})`;
        }
        checks.push({ name, result, message });
    });
    return checks;
};

const TEST_URLS: TEST_URL[] = [
    // { url: 'http://localhost:8080', name: 'dev-server [eleventy]' },
    { url: 'http://localhost:3000/healthz', name: 'dev-server [vite]' },
    // { url: 'http://localhost:3000/client', name: 'dev-server CLIENT [vite]' },
];
const CHECKS: HEALTH_CHECK[] = [];
const hasHTMLFilesCheck = hasHTMLFiles('./_site').length > 0;
// console.log(hasHTMLFiles('./_site'))
CHECKS.push(...hasHTMLFiles('./_site'));
// if (hasHTMLFilesCheck) {
    LOG.OK('✅ HTML files check passed, proceeding with internet & dev server checks');
if (!fastCheck) {
    CHECKS.push(...hasInternetConnection(TEST_CONNECTION_URLS));
    CHECKS.push(...hasDevelopmentServerConnection(TEST_URLS));
} else {
    LOG.WARN('⚡ Fast check enabled, skipping internet & dev server checks');
}

const hasFailures = CHECKS.flat().filter((check) => check.result === false);
if (hasFailures.length > 0) {
    LOG.FAIL(`Healthcheck failed: ${hasFailures.length} issue(s) found`);
    hasFailures.forEach((check) => {
        LOG.FAIL(check.message);
    });
    // if no _site
    const hasNoSite = CHECKS.flat().find((check) => check.name === '_site-folder' && check.result === false);
    if (hasNoSite) {
        LOG.WARN('⚠️  No _site folder found, run "npm run build:eleventy" to generate the static site before running the healthcheck');
    }
} else {
    const all = CHECKS.flat().length;
    LOG.OK(`☘️💚 Healthcheck passed: All checks are good! [${all}/${all}]`);
}

// TODO: check for github.com
// TODO: chck for configs
// TODO: check for processes
// recreted json, timestamps