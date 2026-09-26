import { renderMessages } from './view';

test('renders plain text and excludes expired messages', () => {
    const container = document.createElement('div');
    renderMessages(container, [
        {
            id: 'current',
            title: 'Digitalhub',
            timestamp: '2026-09-26T11:45:00.000Z',
            message: '<img src=x onerror=alert(1)>',
            demo: true,
        },
        {
            id: 'old',
            title: 'Gestern',
            timestamp: '2026-09-26T11:45:00.000Z',
            message: 'Alt',
            expiresAt: '2000-01-01T00:00:00Z',
        },
    ]);
    expect(container.querySelectorAll('article')).toHaveLength(1);
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('Beispielnachricht');
    expect(container.textContent).not.toContain('Gestern');
});
