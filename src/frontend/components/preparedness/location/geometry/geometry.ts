import { areaFeatures } from '../areas/areas';
import type { Area } from '../location.d';

/** 🎯 Test a point against a ring, including its boundary. */
export const inRing = (x: number, y: number, ring: number[][]): boolean => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [ax, ay] = ring[j];
        const [bx, by] = ring[i];
        const cross = (x - ax) * (by - ay) - (y - ay) * (bx - ax);
        if (
            Math.abs(cross) < 1e-12 &&
            x >= Math.min(ax, bx) &&
            x <= Math.max(ax, bx) &&
            y >= Math.min(ay, by) &&
            y <= Math.max(ay, by)
        )
            return true;
        if (ay > y !== by > y && x < ((bx - ax) * (y - ay)) / (by - ay) + ax)
            inside = !inside;
    }
    return inside;
};

/** 🎯 Resolve a location locally using the city's published polygons. */
export const findArea = (longitude: number, latitude: number): Area | null => {
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;
    const match = areaFeatures.find(({ geometry }) => {
        const polygons =
            geometry.type === 'Polygon'
                ? [geometry.coordinates as number[][][]]
                : (geometry.coordinates as number[][][][]);
        return polygons.some(
            ([outer, ...holes]) =>
                inRing(longitude, latitude, outer) &&
                !holes.some((hole) => inRing(longitude, latitude, hole))
        );
    });
    return match?.properties || null;
};
