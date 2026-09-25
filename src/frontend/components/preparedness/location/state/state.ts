import { readLocal, writeLocal } from '../../storage/storage';
import { areas } from '../areas/areas';
import type { SavedLocation } from '../location.d';

const key = 'notfall-ms-area-v1';

/** 🎯 Restore a validated area choice without storing coordinates. */
export const getLocation = (): SavedLocation | null => {
    const saved = readLocal<Partial<SavedLocation> | null>(key, null);
    const area = areas.find((item) => item.id === saved?.areaId);
    if (!area) return null;
    return {
        areaId: area.id,
        district: area.district,
        source: saved?.source === 'geolocation' ? 'geolocation' : 'manual',
    };
};

/** 🎯 Save only the selected area and coarse district. */
export const saveLocation = (
    areaId: string,
    source: SavedLocation['source']
): boolean => {
    const area = areas.find((item) => item.id === areaId);
    const saved = writeLocal(
        key,
        area ? { areaId, district: area.district, source } : null
    );
    window.dispatchEvent(new Event('preparedness:location'));
    return saved;
};
