import './tabs.css';

let nextId = 0;

/** 🎯 Group Markdown sections into keyboard-accessible heading tabs. */
export const setupHeadingTabs = (preview: HTMLElement): void => {
    const level = ['h2', 'h1', 'h3', 'h4', 'h5', 'h6'].find((tag) =>
        preview.querySelector(`:scope > ${tag}`)
    );
    if (!level) return;
    const headings = [
        ...preview.querySelectorAll<HTMLElement>(`:scope > ${level}`),
    ];
    const tablist = document.createElement('div');
    tablist.className = 'document-tabs';
    tablist.setAttribute('role', 'tablist');
    tablist.setAttribute('aria-label', 'Dokumentkapitel');
    const sections = headings.map((heading) => createSection(heading));
    sections[0].panel.before(tablist);
    sections.forEach(({ tab }) => tablist.append(tab));
    connectTabs(sections);
};

const createSection = (heading: HTMLElement) => {
    const id = `document-section-${++nextId}`;
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.id = `${id}-tab`;
    tab.textContent = heading.textContent;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', id);
    const panel = document.createElement('section');
    panel.id = id;
    panel.className = 'document-tab-panel';
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', tab.id);
    panel.tabIndex = 0;
    heading.before(panel);
    let node: ChildNode | null = heading;
    while (node) {
        const next: ChildNode | null = node.nextSibling;
        if (
            node !== heading &&
            node instanceof HTMLElement &&
            node.tagName === heading.tagName
        )
            break;
        panel.append(node);
        node = next;
    }
    return { tab, panel };
};

const connectTabs = (sections: ReturnType<typeof createSection>[]): void => {
    const activate = (selected: number, focus = false): void => {
        sections.forEach(({ tab, panel }, index) => {
            const active = index === selected;
            tab.setAttribute('aria-selected', String(active));
            tab.tabIndex = active ? 0 : -1;
            panel.hidden = !active;
            if (active && focus) tab.focus();
        });
    };
    sections.forEach(({ tab }, index) => {
        tab.addEventListener('click', () => activate(index));
        tab.addEventListener('keydown', (event) => {
            const targets: Record<string, number> = {
                ArrowRight: (index + 1) % sections.length,
                ArrowLeft: (index + sections.length - 1) % sections.length,
                Home: 0,
                End: sections.length - 1,
            };
            const target = targets[event.key];
            if (target === undefined) return;
            event.preventDefault();
            activate(target, true);
        });
    });
    activate(0);
};
