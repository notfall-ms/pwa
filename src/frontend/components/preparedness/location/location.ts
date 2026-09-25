import { areas } from './areas/areas';
import { getLocation, saveLocation } from './state/state';
import { locateArea } from './geolocation/geolocation';
import type { SavedLocation } from './location.d';

const show = (text: string): void => {
    const status = document.querySelector('[data-location-status]');
    if (status) status.textContent = text;
};

/** 🎯 Offer manual selection or one-time local geolocation. */
export const setupLocation = (): void => {
    const select =
        document.querySelector<HTMLSelectElement>('[data-area-select]');
    const button = document.querySelector<HTMLButtonElement>('[data-locate]');
    if (!select || !button) return;
    areas.forEach((area) =>
        select.add(
            new Option(
                `${area.name} · ${area.district.replace('Münster-', '')}`,
                area.id
            )
        )
    );
    select.value = getLocation()?.areaId || '';
    let generation = 0;
    const choose = (id: string, source: SavedLocation['source']): void => {
        select.value = id;
        const saved = saveLocation(id, source);
        const label = id
            ? `✓ ${areas.find((area) => area.id === id)?.name} · ${getLocation()?.district}`
            : '○ Ohne Ortsangabe';
        show(saved ? label : '⚠ Auswahl konnte nicht gespeichert werden.');
    };
    select.addEventListener('change', () => {
        generation++;
        choose(select.value, 'manual');
    });
    document
        .querySelector('[data-location-clear]')
        ?.addEventListener('click', () => {
            generation++;
            choose('', 'manual');
        });
    button.addEventListener('click', async () => {
        const request = ++generation;
        button.disabled = true;
        show('⌖ Standort wird einmalig bestimmt …');
        try {
            const area = await locateArea();
            if (request === generation) choose(area.id, 'geolocation');
        } catch (error) {
            if (request === generation)
                show(
                    error instanceof Error
                        ? error.message
                        : 'Bitte manuell wählen.'
                );
        } finally {
            button.disabled = false;
        }
    });
};
