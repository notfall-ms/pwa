export type BluetoothDiagnostic = {
    timestamp: string;
    step: string;
    state: 'start' | 'ok' | 'error' | 'info';
    detail?: string;
};

/** Keep a bounded, session-only trace rendered as text, never as markup. */
export const setupBluetoothDebug = (): ((
    entry: BluetoothDiagnostic
) => void) => {
    const output = document.querySelector('[data-bluetooth-debug-log]');
    const entries: string[] = [];
    const report = (entry: BluetoothDiagnostic): void => {
        entries.push(
            `${entry.timestamp} [${entry.state}] ${entry.step}${entry.detail ? `: ${entry.detail}` : ''}`
        );
        if (entries.length > 100) entries.shift();
        if (output) output.textContent = entries.join('\n');
    };
    document
        .querySelector('[data-bluetooth-debug-clear]')
        ?.addEventListener('click', () => {
            entries.length = 0;
            if (output) output.textContent = '';
        });
    report({
        timestamp: new Date().toISOString(),
        step: 'Browser',
        state: 'info',
        detail: `Sicherer Kontext: ${window.isSecureContext ? 'ja' : 'nein'}; Web Bluetooth: ${'bluetooth' in navigator ? 'vorhanden' : 'nicht verfügbar'}`,
    });
    return report;
};
