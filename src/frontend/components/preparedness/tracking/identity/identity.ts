import { readLocal } from '../../storage/storage';

export const identityKey = 'notfall-ms-tracking-hash-v1';

/** 🎯 Hash a random identifier, never a name, location or device fingerprint. */
export const getResidentHash = async (): Promise<string> => {
    const stored = readLocal<unknown>(identityKey, null);
    if (typeof stored === 'string' && /^[a-f0-9]{64}$/.test(stored))
        return stored;
    const random = crypto.getRandomValues(new Uint8Array(32));
    const digest = await crypto.subtle.digest('SHA-256', random);
    return [...new Uint8Array(digest)]
        .map((value) => value.toString(16).padStart(2, '0'))
        .join('');
};
