import { findArea, inRing } from './geometry';
import { areas } from '../areas/areas';

test('contains all 45 published areas mapped to six city districts', () => {
    expect(areas).toHaveLength(45);
    expect(new Set(areas.map((area) => area.district)).size).toBe(6);
});

test('resolves central Münster and rejects a location outside the city', () => {
    expect(findArea(7.6255, 51.9625)?.district).toBe('Münster-Mitte');
    expect(findArea(13.405, 52.52)).toBeNull();
    expect(findArea(NaN, 51.96)).toBeNull();
});

test('includes polygon boundaries and excludes points outside', () => {
    const ring = [
        [0, 0],
        [4, 0],
        [4, 4],
        [0, 4],
        [0, 0],
    ];
    expect(inRing(2, 2, ring)).toBe(true);
    expect(inRing(0, 2, ring)).toBe(true);
    expect(inRing(5, 2, ring)).toBe(false);
});
