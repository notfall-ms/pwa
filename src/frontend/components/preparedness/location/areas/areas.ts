import { features } from './areas.json';
import type { Area, GeoFeature } from '../location.d';

export const areaFeatures: GeoFeature[] = features;
export const areas: Area[] = areaFeatures
    .map((feature) => feature.properties)
    .sort((left, right) => left.name.localeCompare(right.name, 'de'));
