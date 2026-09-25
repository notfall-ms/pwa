export type TrackingKind =
    'snapshot' | 'installation' | 'progress' | 'district';
export type TrackingEvent = {
    schemaVersion: 1;
    eventId: string;
    kind: TrackingKind;
    residentHash: string;
    district: string | null;
    installed: boolean;
    completed: number;
    total: number;
    occurredAt: string;
};
export type TrackingClient = {
    submit: (event: TrackingEvent) => Promise<void>;
    clear: () => void;
};
