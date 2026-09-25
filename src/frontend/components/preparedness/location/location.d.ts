export type Area = { id: string; name: string; district: string };
export type SavedLocation = {
    areaId: string;
    district: string;
    source: 'manual' | 'geolocation';
};
export type GeoFeature = {
    properties: { id: string; name: string; district: string };
    geometry: { type: string; coordinates: number[][][] | number[][][][] };
};
