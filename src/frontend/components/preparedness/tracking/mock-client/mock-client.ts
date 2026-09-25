import { readLocal, writeLocal } from '../../storage/storage';
import type { TrackingClient, TrackingEvent } from '../tracking.d';

const key = 'notfall-ms-tracking-events-v1';

/** 🎯 Inspect local demo events; this adapter never performs network requests. */
export const getMockEvents = (): TrackingEvent[] => {
    const events = readLocal<unknown>(key, []);
    if (!Array.isArray(events)) return [];
    return events
        .filter(
            (event) =>
                event &&
                typeof event.residentHash === 'string' &&
                typeof event.completed === 'number' &&
                typeof event.total === 'number'
        )
        .slice(-20);
};

export const mockTrackingClient: TrackingClient = {
    submit: (event) => {
        const saved = writeLocal(key, [...getMockEvents(), event].slice(-20));
        return saved
            ? Promise.resolve()
            : Promise.reject(new Error('Local demo storage unavailable'));
    },
    clear: () => {
        writeLocal(key, null);
    },
};
