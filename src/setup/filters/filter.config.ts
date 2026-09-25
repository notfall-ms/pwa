// 🧩 pre-defined filters from @robert.tools
import safeParam from '@robert.tools/eleventy-filter-safe-param';
import safeParamIf from '@robert.tools/eleventy-filter-safe-param-if';
import svg from '@robert.tools/eleventy-filter-svg';
import getFullDate from '@robert.tools/eleventy-filter-get-full-date';
import contains from '@robert.tools/eleventy-filter-contains';
import is_link from '@robert.tools/eleventy-filter-is-link';
import len from '@robert.tools/eleventy-filter-len';
import translate from '@robert.tools/eleventy-filter-translate';
import route from '@robert.tools/eleventy-filter-route';
import merge from '@robert.tools/eleventy-filter-merge';
import allValues from '@robert.tools/eleventy-filter-all-values';
import getSearchValue from '@robert.tools/eleventy-filter-get-search-value';
import prettyDate from '@robert.tools/eleventy-filter-pretty-date';
import filterByProp from '@robert.tools/eleventy-filter-by-prop';

// other filters (please define under ./<filter-name>/<filter-name>.ts)
export const FILTERS: { [key: string]: Function } = {
    safeParam,
    safeParamIf,
    svg,
    getFullDate,
    contains,
    is_link,
    len,
    translate,
    route,
    merge,
    allValues,
    getSearchValue,
    prettyDate,
    filterByProp,
};
