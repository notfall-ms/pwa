import { $string } from '../../../_shared';
import { load, save } from '../../../_shared/localStorage/localStorage';
import { getButtons, getElement, getElements } from '../../../_shared/select/select';

const getAttribute = (target: HTMLElement, key: string) => {
    const KEY = target.getAttribute(key);
    if(!KEY){
        console.warn(`Dropdown is missing ${key} attribute`);
    }
    return KEY;
}

const parseDate = (value: $string) => {
            if (!value) return Number.NEGATIVE_INFINITY;

            const match = String(value).trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
            if (!match) return Number.NEGATIVE_INFINITY;

            const [, day, month, year] = match;
            return new Date(Number(year), Number(month) - 1, Number(day)).getTime();
        };

        const compareText = (a: HTMLElement, b: HTMLElement, key: string) => (a.dataset[key] || '').localeCompare(b.dataset[key] || '', 'de', { sensitivity: 'base' });


const sortItems = (target: string, mode: string) => {
    const sections = getElements(document as unknown as HTMLElement, `${target}`);
    sections.forEach((section) => {
        const grid = getElement(section, '.portfolio-grid');
        if (!grid) return;

        const sectionItems = getElements(grid, '[data-search-item]');

        sectionItems.sort((a, b) => {
            const pinnedDiff = Number(b.dataset.pinned || 0) - Number(a.dataset.pinned || 0);
            if (pinnedDiff) return pinnedDiff;

            if (mode === 'title-asc') return compareText(a, b, 'title');
            if (mode === 'title-desc') return compareText(b, a, 'title');
            if (mode === 'status-asc') return compareText(a, b, 'status') || compareText(a, b, 'title');

            const dateA = parseDate(a.dataset.start);
            const dateB = parseDate(b.dataset.start);

            if (mode === 'date-asc') return dateA - dateB || compareText(a, b, 'title');
            return dateB - dateA || compareText(a, b, 'title');
        });

        sectionItems.forEach((item) => grid.appendChild(item));
    });

}

export const createDropdowns = () => {
    const root = document as unknown as HTMLElement;
    const dropdowns = getElements(root, `[data-bs-toggle="dropdown"]`);
    for(const dropdown of dropdowns){

        if(dropdown) {
            const KEY = getAttribute(dropdown, 'data-key');
            const DEFAULT_VALUE = getAttribute(dropdown, 'data-default-value');
            if(!KEY || !DEFAULT_VALUE){
                return;
            }
            const SORT_TARGET = getAttribute(dropdown, 'data-sort');
            const current = load(KEY) || DEFAULT_VALUE;
            document.documentElement.setAttribute(`data-${KEY}`, current);
            if(SORT_TARGET){
                sortItems(SORT_TARGET, current);
            }
            const parent = dropdown.parentElement
            if(parent){
                const themeButtons = getButtons(parent, 'ul li button' );
                themeButtons.forEach((button) => {
                        button.addEventListener('click', () => {
                            const value = button.dataset.option ?? DEFAULT_VALUE;
                            document.documentElement.setAttribute(`data-${KEY}`, value);
                            save(KEY, value);
                            if(SORT_TARGET){
                                sortItems(SORT_TARGET, value);
                            }
                        });
                    });
            }
        }
    }
}