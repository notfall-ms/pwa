import { webcrypto } from 'node:crypto';
import { setTrackingEnabled, track } from './tracking';
import { getMockEvents } from './mock-client/mock-client';
import * as identity from './identity/identity';
import { restoreChecklist, setComplete } from '../checklist/state/state';
import { saveLocation } from '../location/state/state';
import { rememberInstallation } from '../../pwa/install/state/state';

beforeEach(() => {
    setTrackingEnabled(false);
    localStorage.clear();
    restoreChecklist();
    Object.defineProperty(globalThis, 'crypto', {
        configurable: true,
        value: webcrypto,
    });
});
afterEach(() => jest.restoreAllMocks());

test('does not create an identity or events without consent', async () => {
    await track('progress');
    expect(getMockEvents()).toEqual([]);
    expect(localStorage.getItem(identity.identityKey)).toBeNull();
});

test('records installation and aggregate progress under a stable random hash', async () => {
    setTrackingEnabled(true);
    saveLocation('56', 'manual');
    setComplete('contacts', true);
    rememberInstallation(true);
    await track('installation');
    await track('progress');
    const events = getMockEvents();
    expect(events).toHaveLength(2);
    expect(events[0].residentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(events[1].residentHash).toBe(events[0].residentHash);
    expect(events[1]).toMatchObject({
        district: 'Münster-West',
        installed: true,
        completed: 2,
        total: 7,
    });
    expect(Object.keys(events[1]).sort()).toEqual([
        'completed',
        'district',
        'eventId',
        'installed',
        'kind',
        'occurredAt',
        'residentHash',
        'schemaVersion',
        'total',
    ]);
    setTrackingEnabled(false);
    expect(getMockEvents()).toEqual([]);
    expect(localStorage.getItem(identity.identityKey)).toBeNull();
    expect(localStorage.getItem('notfall-ms-checklist-v1')).not.toBeNull();
});

test('does not recreate records if consent is withdrawn during hashing', async () => {
    let finish: (value: string) => void = () => undefined;
    jest.spyOn(identity, 'getResidentHash').mockImplementationOnce(
        () =>
            new Promise((resolve) => {
                finish = resolve;
            })
    );
    setTrackingEnabled(true);
    const event = track('snapshot');
    await Promise.resolve();
    setTrackingEnabled(false);
    finish('a'.repeat(64));
    await event;
    expect(getMockEvents()).toEqual([]);
    expect(localStorage.getItem(identity.identityKey)).toBeNull();
});
