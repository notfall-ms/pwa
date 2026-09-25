import { LOG } from '@robert.tools/log';

// 3rd-party imports
// import markdownIt from 'markdown-it';
import { config } from './project.config.ts';

// @ts-ignore - no type declarations available for @11ty/eleventy
import { EleventyRenderPlugin } from '@11ty/eleventy';
// NOTE: https://github.com/11ty/buildawesome/pull/3349

// .eleventy.config.ts
LOG.OK('[11ty] ts-config loaded');

// 🧩 custom filters from src/setup/filters
import { FILTERS } from './src/setup/filters/filter.config';

// filters (kept as JS imports as in your setup)

// shortcodes (JS)
import { SHORTCODES } from './src/setup/shortcodes/vite.shortcode';

// local constants taken from project config
const templateEngine = config.TEMPLATE_ENGINE;
const pathPrefix = config.PATH_PREFIX;

// minimal typing to keep TS happy without external Eleventy types
type EleventyConfig = any;

// export default arrow function (ESM)
const eleventyConfigFn = (eleventyConfig: EleventyConfig) => {
    eleventyConfig.on('eleventy.after', async () => {
        // Run me after the build ends
        LOG.OK('✅  Eleventy build finished!');
    });
    eleventyConfig.on('eleventy.error', (error: any) => {
        LOG.FAIL('❌  Eleventy error:', error.message);
    });
    eleventyConfig.addWatchTarget('./src/frontend/');

    // static asset paths
    config.STATIC_ASSETS.forEach((asset: Record<string, string>) => {
        eleventyConfig.addPassthroughCopy(asset);
    });

    // expose project config globally to nunjucks
    eleventyConfig.addNunjucksGlobal('config', config);

    // TODO: refactoring
    eleventyConfig.addCollection('menuPages', (collectionApi: any) => {
        return collectionApi
            .getFilteredByGlob(`./${config.INPUT_CONTENT}/**/*.njk`)
            .filter(
                (item: any) => item.data?.navigation === true && item.data?.menu
            )
            .map((item: any) => ({
                url: item.url,
                title: item.data.menu.label || item.data.title || '',
                emoji: item.data.menu.emoji || '',
                order: item.data.menu.order || 0,
            }))
            .sort((left: any, right: any) => left.order - right.order);
    });

    // 🧩 load: custom filters from filters.config.ts file
    for (const filter in FILTERS) {
        const fn = FILTERS[filter];
        LOG.OK(`Adding filter: ${filter}`);
        eleventyConfig.addNunjucksFilter(filter, fn);
    }

    // nunjucks filters

    // 🧩 load: vite shortcodes
    for (const shortcode in SHORTCODES) {
        const fn = SHORTCODES[shortcode];
        LOG.OK(`Adding shortcode: ${shortcode}`);
        eleventyConfig.addNunjucksShortcode(shortcode, fn);
    }
    eleventyConfig.addPlugin(EleventyRenderPlugin);

    return {
        templateFormats: ['md', templateEngine, 'html'],
        pathPrefix,
        markdownTemplateEngine: templateEngine,
        htmlTemplateEngine: templateEngine,
        dataTemplateEngine: templateEngine,
        passthroughFileCopy: true,
        dir: {
            input: config.INPUT_CONTENT,
            output: config.OUTPUT_DIR,
            layouts: config.LAYOUTS,
            includes: config.INCLUDES,
            // includes: config.INCLUDES,
            data: config.DATA_DIR,
        },
    };
};

export default eleventyConfigFn;
