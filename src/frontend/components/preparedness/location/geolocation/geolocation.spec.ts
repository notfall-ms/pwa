import { locateArea } from './geolocation';

const mockLocation = (implementation: jest.Mock): void => {
    Object.defineProperty(navigator, 'geolocation', {
        configurable: true,
        value: { getCurrentPosition: implementation },
    });
};

test('asks once and returns only the area, never coordinates', async () => {
    const request = jest.fn((success) =>
        success({
            coords: { latitude: 51.9625, longitude: 7.6255, accuracy: 15 },
        })
    );
    mockLocation(request);
    const area = await locateArea();
    expect(area.district).toBe('Münster-Mitte');
    expect(Object.keys(area).sort()).toEqual(['district', 'id', 'name']);
    expect(request).toHaveBeenCalledTimes(1);
});

test('supports denied permission and inaccurate positions without a fake district', async () => {
    mockLocation(
        jest.fn((success, error) => {
            void success;
            error({ code: 1 });
        })
    );
    await expect(locateArea()).rejects.toThrow('Keine Freigabe');
    mockLocation(
        jest.fn((success) =>
            success({
                coords: { latitude: 51.96, longitude: 7.62, accuracy: 3000 },
            })
        )
    );
    await expect(locateArea()).rejects.toThrow('zu ungenau');
});
