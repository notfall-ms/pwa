import { setupHeadingTabs } from './tabs';

jest.mock('./tabs.css', () => ({}));

const render = (): HTMLElement => {
    const root = document.createElement('div');
    root.innerHTML =
        '<h1>Notfall</h1><p>Einführung</p><h2>Vorsorge</h2><h3>Wasser</h3><p>Details</p><h2>Kontakte</h2><p>Telefonliste</p>';
    document.body.replaceChildren(root);
    setupHeadingTabs(root);
    return root;
};

test('uses module headings as tabs and preserves introductory and nested content', () => {
    const root = render();
    const tabs = root.querySelectorAll<HTMLButtonElement>('[role=tab]');
    const panels = root.querySelectorAll<HTMLElement>('[role=tabpanel]');
    expect([...tabs].map((tab) => tab.textContent)).toEqual([
        'Vorsorge',
        'Kontakte',
    ]);
    expect(panels[0].hidden).toBe(false);
    expect(panels[0].querySelector('h3')?.textContent).toBe('Wasser');
    expect(panels[1].hidden).toBe(true);
    expect(root.querySelector(':scope > h1')?.textContent).toBe('Notfall');
    tabs[1].click();
    expect(panels[0].hidden).toBe(true);
    expect(panels[1].hidden).toBe(false);
    expect(tabs[1].getAttribute('aria-selected')).toBe('true');
});

test('supports arrow, Home and End navigation with roving focus', () => {
    const root = render();
    const tabs = root.querySelectorAll<HTMLButtonElement>('[role=tab]');
    tabs[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(document.activeElement).toBe(tabs[1]);
    expect(tabs[0].tabIndex).toBe(-1);
    tabs[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Home' }));
    expect(document.activeElement).toBe(tabs[0]);
    tabs[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'End' }));
    expect(document.activeElement).toBe(tabs[1]);
});

test('leaves documents without headings intact and uses unique IDs across documents', () => {
    const plain = document.createElement('div');
    plain.textContent = 'Text';
    setupHeadingTabs(plain);
    expect(plain.textContent).toBe('Text');
    const first = render().querySelector('[role=tab]')!.id;
    expect(render().querySelector('[role=tab]')!.id).not.toBe(first);
});
