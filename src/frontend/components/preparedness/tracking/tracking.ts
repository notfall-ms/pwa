import { readLocal, writeLocal } from '../storage/storage';
import { getProgress } from '../checklist/state/state';
import { getLocation } from '../location/state/state';
import { wasInstalled } from '../../pwa/install/state/state';
import { getResidentHash, identityKey } from './identity/identity';
import { mockTrackingClient } from './mock-client/mock-client';
import type { TrackingKind } from './tracking.d';

export const consentKey = 'notfall-ms-tracking-consent-v1';
let enabled = readLocal<boolean>(consentKey, false) === true;
let epoch = 0;
let pending = Promise.resolve();

/** 🎯 Expose voluntary tracking consent. */
export const isTrackingEnabled = (): boolean => enabled;

/** 🎯 Withdraw consent immediately, including queued events and local identity. */
export const setTrackingEnabled = (value: boolean): void => {
    enabled = value;
    epoch += 1;
    writeLocal(consentKey, value);
    if (!value) {
        mockTrackingClient.clear();
        writeLocal(identityKey, null);
    }
    window.dispatchEvent(new Event('preparedness:tracking'));
};

/** 🎯 Serialize privacy-minimized snapshots through the replaceable mock client. */
export const track = (kind: TrackingKind): Promise<void> => {
    if (!enabled) return Promise.resolve();
    const generation = epoch;
    const { completed, total } = getProgress();
    const district = getLocation()?.district || null;
    const installed = wasInstalled();
    pending = pending
        .then(async () => {
            if (!enabled || generation !== epoch) return;
            const residentHash = await getResidentHash();
            if (!enabled || generation !== epoch) return;
            writeLocal(identityKey, residentHash);
            await mockTrackingClient.submit({
                schemaVersion: 1,
                eventId: crypto.randomUUID(),
                kind,
                residentHash,
                district,
                installed,
                completed,
                total,
                occurredAt: new Date().toISOString(),
            });
            window.dispatchEvent(new Event('preparedness:tracking'));
        })
        .catch(() => {
            window.dispatchEvent(
                new CustomEvent('preparedness:tracking-error')
            );
        });
    return pending;
};
