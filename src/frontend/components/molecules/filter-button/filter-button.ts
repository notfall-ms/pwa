import { getElements } from '../../../_shared/select/select';

export const activateFilterButtons = (defaultCategory: string): void => {
    const root: HTMLElement = document as unknown as HTMLElement;
    const filterButtons = getElements(root, '[data-filter-button]');
    const sections = getElements(root, '[data-category-section]');
    filterButtons.forEach((button) => {
        button.addEventListener('click', () => {
            if(button.classList.contains('inactive')) {
                return; // Do nothing if the button is inactive
            }
            const category = button.dataset.filterButton || defaultCategory;
            filterButtons.forEach((btn) => btn.classList.toggle('active', btn === button));
            // root.setAttribute('data-category', category);
            sections.forEach((section) => {
                const isVisible = category === defaultCategory ? true : section.dataset.categorySection === category;
                section.classList.toggle('d-none', !isVisible);
            });
        });
    });
}