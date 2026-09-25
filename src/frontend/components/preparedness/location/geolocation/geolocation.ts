import { findArea } from '../geometry/geometry';
import type { Area } from '../location.d';

/** 🎯 Request a one-time browser location and discard precise coordinates. */
export const locateArea = (): Promise<Area> =>
    new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(
                new Error('Standort nicht verfügbar. Bitte Ortsteil wählen.')
            );
            return;
        }
        navigator.geolocation.getCurrentPosition(
            ({ coords }) => {
                if (coords.accuracy > 1000) {
                    reject(
                        new Error('Standort zu ungenau. Bitte Ortsteil wählen.')
                    );
                    return;
                }
                const area = findArea(coords.longitude, coords.latitude);
                if (area) resolve(area);
                else
                    reject(
                        new Error(
                            'Kein Ortsteil in Münster erkannt. Bitte manuell wählen.'
                        )
                    );
            },
            (error) =>
                reject(
                    new Error(
                        error.code === 1
                            ? 'Keine Freigabe. Die manuelle Auswahl bleibt verfügbar.'
                            : 'Standort nicht ermittelt. Bitte manuell wählen.'
                    )
                ),
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 }
        );
    });
