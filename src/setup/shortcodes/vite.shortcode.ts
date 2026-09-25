import {
    viteScriptTag,
    viteLegacyScriptTag,
    viteLinkStylesheetTags,
} from '@robert.tools/eleventy-shortcodes-script-style';

export const SHORTCODES: { [key: string]: Function } = {
    viteScriptTag,
    viteLegacyScriptTag,
    viteLinkStylesheetTags,
};
