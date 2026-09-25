import { getElement, getElements } from '../../../_shared/select/select';

const getSearchValue = (element: HTMLInputElement): string => element.value
                                                                .trim().toLowerCase()
                                                                // sanitize xss
                                                                .replace(/</g, '&lt;')
                                                                .replace(/>/g, '&gt;');

const updateProjectVisibility = (cards: HTMLElement[], query: string): number => {
    let visibleCount = 0;

    const startTime = new Date().getTime();
    cards.forEach((card) => {
        if(!card.dataset.search) {
            console.warn('Card is missing data-search attribute:', card);
        }
        const haystack = card.dataset.search ?? '';
        const isVisible = haystack.includes(query);

        card.classList.toggle('d-none', !isVisible);
        // card.classList.toggle('hidden', !isVisible);
        visibleCount += isVisible ? 1 : 0;
        if(isVisible) {

            const marks = getElements(card, '[data-search-mark]');
            if(marks.length > 0){
                for(const mark of marks) {
                    const originalText = mark.textContent || '';
                    const lowerText = originalText.toLowerCase();
                    if(lowerText.includes(query) && query !== '') {
                        const regex = new RegExp(`(${query})`, 'gi');
                        mark.innerHTML = originalText.replace(regex, '<mark>$1</mark>');
                    } else {
                        mark.innerHTML = originalText;
                    }
                }
            }
        }
    });
    const result = getElement(document as unknown as HTMLElement, '[data-search-result]');
    if(result){
        if(visibleCount > 0 && query !== '') {
            result.classList.remove('search--hidden');
            result.querySelector('[data-search-count]')!.textContent = `${visibleCount}`;
            result.querySelector('[data-search-time]')!.textContent = `${new Date().getTime() - startTime}`;
            
        } else {
            result.classList.add('search--hidden');
        }
    }
    console.log(`Search for "${query}" took ${new Date().getTime() - startTime} ms and found ${visibleCount} results.`);
    return visibleCount;
};

const updateEmptyState = (emptyState: HTMLElement, visibleCount: number): void => {
    emptyState.classList.toggle('is-visible', visibleCount === 0);
};

export const setupSearch = (): void => {
    const allContexts = document.querySelectorAll<HTMLElement>('[search-context]');
    if (allContexts.length === 0) {
        return;
    }
    for(const context of allContexts) {
        const root = context;
        const sections = getElements(root, '[data-category-section]');
        const input = root.querySelector<HTMLInputElement>('[data-search-input]');
        const emptyState = root.querySelector<HTMLElement>('[data-search-empty]');
    
        if (!input || !emptyState) {
            return;
        }
    
        const cards = Array.from(root.querySelectorAll<HTMLElement>('[data-search-item]'));
        const applySearch = (): void => {
            const visibleCount = updateProjectVisibility(cards, getSearchValue(input));
            updateEmptyState(emptyState, visibleCount);
            sections.forEach((section) => {
                const sectionID = section.dataset.categorySection;
                const countElement = section.querySelector<HTMLElement>('[data-count]');
                const filterButton = root.querySelector<HTMLElement>(`[data-filter-button="${sectionID}"]`);
                const num = section.querySelectorAll('article:not(.d-none)').length
                const hasNoVisibleItems = num === 0;
                section.classList.toggle('d-none', hasNoVisibleItems);
                if(filterButton){
                    const countElementButton = filterButton.querySelector<HTMLElement>('[data-count]');
                    if(countElementButton) {
                        countElementButton.textContent = `${num}`;
                    }
                    if(hasNoVisibleItems) {
                        filterButton.classList.add('inactive');
                    } else {
                        filterButton.classList.remove('inactive');
                    }
                }
                if(countElement) {
                    countElement.textContent = `${num}`;
                }
            });
            
        };
    
        input.addEventListener('input', applySearch);
        applySearch();
    }
};