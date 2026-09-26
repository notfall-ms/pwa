import { setupBluetoothDebug } from './debug';

test('renders diagnostics as text, limits history and clears it on request', () => {
    document.body.innerHTML =
        '<pre data-bluetooth-debug-log></pre><button data-bluetooth-debug-clear></button>';
    const report = setupBluetoothDebug();
    for (let i = 0; i < 105; i++)
        report({
            timestamp: String(i),
            step: 'Read',
            state: 'error',
            detail: '<img src=x>',
        });
    const log = document.querySelector('[data-bluetooth-debug-log]')!;
    expect(log.textContent!.split('\n')).toHaveLength(100);
    expect(log.textContent).toContain('<img src=x>');
    expect(log.querySelector('img')).toBeNull();
    document
        .querySelector<HTMLButtonElement>('[data-bluetooth-debug-clear]')!
        .click();
    expect(log.textContent).toBe('');
});
