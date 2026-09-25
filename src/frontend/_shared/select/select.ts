
export const getButtons = (root: HTMLElement, selector: string): HTMLButtonElement[] => {
    return getElements<HTMLButtonElement>(root, selector);
//  return Array.from(root.querySelectorAll<HTMLButtonElement>(selector));
}
export const getElements = <T extends HTMLElement = HTMLElement>(
    root: HTMLElement,
    selector: string,
): T[] => {
    return Array.from(root.querySelectorAll<T>(selector));
};
export const getElement = <T extends HTMLElement = HTMLElement>(
    root: HTMLElement,
    selector: string,
): T | null => {
    return root.querySelector(selector) as T | null;
};