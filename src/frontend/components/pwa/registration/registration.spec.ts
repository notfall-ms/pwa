import { setupRegistration } from './registration';
import { setStatus } from '../status/status';
import { showDocuments } from '../documents/documents';

jest.mock('../status/status', () => ({ setStatus: jest.fn() }));
jest.mock('../documents/documents', () => ({
    showDocuments: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('./updates/updates', () => ({ watchUpdates: jest.fn() }));

const status = {
    version: '1.0.1',
    build: 'sample',
    cacheName: 'notfall-ms-sample',
    documents: ['/documents/beispiel.txt'],
};
const worker = {
    postMessage: jest.fn((message, ports) => {
        if (message.type === 'GET_STATUS') ports[0].deliver(status);
    }),
};

beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(window, 'isSecureContext', {
        configurable: true,
        value: true,
    });
    Object.defineProperty(window, 'MessageChannel', {
        configurable: true,
        value: class {
            port1 = {
                onmessage: jest.fn<void, [{ data: typeof status }]>(),
                close: jest.fn(),
            };
            port2 = {
                deliver: (data: typeof status) =>
                    this.port1.onmessage({ data }),
            };
        },
    });
});

test('reads existing offline state even if registration fails without a network', async () => {
    Object.defineProperty(navigator, 'serviceWorker', {
        configurable: true,
        value: {
            controller: worker,
            addEventListener: jest.fn(),
            register: jest.fn().mockRejectedValue(new Error('Offline')),
        },
    });
    await setupRegistration();
    expect(showDocuments).toHaveBeenCalledWith(status);
    expect(setStatus).not.toHaveBeenCalledWith(
        '[data-pwa-offline]',
        '⚠ Nicht gesichert'
    );
});

test('reads the active worker when the page does not have a controller yet', async () => {
    const registration = {
        active: worker,
        update: jest.fn().mockResolvedValue(undefined),
    };
    Object.defineProperty(navigator, 'serviceWorker', {
        configurable: true,
        value: {
            controller: null,
            addEventListener: jest.fn(),
            register: jest.fn().mockResolvedValue(registration),
            ready: Promise.resolve(registration),
        },
    });
    await setupRegistration();
    expect(showDocuments).toHaveBeenCalledWith(status);
});
