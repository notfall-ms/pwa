import type { $HTMLElement, $string } from '../../../_shared/index.d';
import { loadJson, saveJson } from '../../../_shared/localStorage/localStorage';
import { getButtons, getElement, getElements } from '../../../_shared/select/select';

const COUNTDOWN_LIMIT_DAYS = 7;
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const HOUR_IN_MS = 60 * 60 * 1000;
const MAP_VIEWBOX_WIDTH = 1068;
const MAP_VIEWBOX_HEIGHT = 924;
const PLAN_STORAGE_KEY = 'craft-plan';
const UI_STORAGE_KEY = 'portfolio-ui';
const WALKING_SPEED_METERS_PER_MINUTE = 75;
const MANUAL_MOVE_UNITS = 26;
const TARGET_REACHED_RADIUS = 26;
const GPS_BOUNDS = {
    minLat: 47.5404,
    maxLat: 47.5425,
    minLng: 19.0929,
    maxLng: 19.0977,
};

type PlanTalk = {
    id: string,
    title: string,
    day: string,
    startTime: string,
    endTime: string,
    stageLabel: string,
    stageSvgIds: string[],
};

type RoutePoint = {
    x: number,
    y: number,
};

type RouteEntry = {
    index: number,
    from: PlanTalk,
    to: PlanTalk,
    gapMinutes: number,
    points: RoutePoint[],
};

type PlanStepVariant = 'talk' | 'walk' | 'wait';

type PortfolioUiState = {
    view?: string,
};

type RouteRenderEntry = {
    entry: RouteEntry,
    routeId: string,
    routeLabel: string,
    routeTooltip: string,
    walkingMinutes: number,
    waitingMinutes: number,
    slotIndex: number,
};

type PlanSlot = {
    day: string,
    label: string,
    emoji: string,
    startMinutes: number,
    endMinutes: number,
};

type CharacterState = {
    point: RoutePoint | null,
    label: string,
};

const parseEventDate = (value = ''): Date | null => {
    if (!value) return null;

    const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
        const [, year, month, day] = isoMatch;
        return new Date(Number(year), Number(month) - 1, Number(day), 23, 59, 59, 999);
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const changeDocumentAttribute = (key: string, value: string, defaultValue: string) => {
    document.documentElement.setAttribute(key, value ?? defaultValue);
};

const formatCountdown = (target: Date, now: Date): $string => {
    const diff = target.getTime() - now.getTime();
    const days = Math.floor(diff / DAY_IN_MS);
    const hours = Math.floor((diff % DAY_IN_MS) / HOUR_IN_MS);

    if (diff <= 0) return 'heute';
    if (days >= 2) return 'in ' + days + ' Tagen';
    if (days === 1) return hours > 0 ? 'morgen · ' + hours + 'h' : 'morgen';
    if (hours >= 1) return 'in ' + hours + 'h';

    const minutes = Math.max(1, Math.floor((diff % HOUR_IN_MS) / (60 * 1000)));
    return 'in ' + minutes + ' min';
};

const getSearchQuery = (value = ''): string => value
    .trim()
    .toLowerCase()
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const getStageIds = (value = ''): string[] => value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const getTimeOrderValue = (day = '', startTime = ''): string => day + ' ' + startTime;

const PLAN_SLOT_PARTS: Omit<PlanSlot, 'day'>[] = [
    { label: 'Morning', emoji: '🌅', startMinutes: 8 * 60, endMinutes: 11 * 60 + 59 },
    { label: 'Midday', emoji: '☀️', startMinutes: 12 * 60, endMinutes: 16 * 60 + 59 },
    { label: 'Evening', emoji: '🌙', startMinutes: 17 * 60, endMinutes: 23 * 60 + 59 },
];

const parseTimeToMinutes = (value = ''): number => {
    const [hours, minutes] = value.split(':').map((item) => Number(item));

    if (Number.isNaN(hours) || Number.isNaN(minutes)) {
        return 0;
    }

    return (hours * 60) + minutes;
};

const formatMinutesLabel = (value: number): string => {
    const hours = String(Math.floor(value / 60)).padStart(2, '0');
    const minutes = String(value % 60).padStart(2, '0');
    return hours + ':' + minutes;
};

const formatRouteGap = (gapMinutes: number): string => {
    if (gapMinutes <= 0) return 'tight change';
    if (gapMinutes < 60) return gapMinutes + ' min gap';

    const hours = Math.floor(gapMinutes / 60);
    const minutes = gapMinutes % 60;

    if (minutes === 0) {
        return hours + ' h gap';
    }

    return hours + ' h ' + minutes + ' min gap';
};

const isSamePoint = (first: RoutePoint, second: RoutePoint): boolean => {
    return Math.abs(first.x - second.x) < 1 && Math.abs(first.y - second.y) < 1;
};

const compactPoints = (points: RoutePoint[]): RoutePoint[] => {
    return points.filter((point, index) => {
        if (index === 0) return true;
        return !isSamePoint(point, points[index - 1]);
    });
};

const toPercent = (value: number, max: number): string => ((value / max) * 100).toFixed(3) + '%';

const clamp = (value: number, min: number, max: number): number => {
    return Math.min(max, Math.max(min, value));
};

const getVenueMetersPerUnit = (): RoutePoint => {
    const midLat = (GPS_BOUNDS.minLat + GPS_BOUNDS.maxLat) / 2;
    const latMeters = 111320;
    const lngMeters = 111320 * Math.cos(midLat * (Math.PI / 180));
    const widthMeters = (GPS_BOUNDS.maxLng - GPS_BOUNDS.minLng) * lngMeters;
    const heightMeters = (GPS_BOUNDS.maxLat - GPS_BOUNDS.minLat) * latMeters;

    return {
        x: widthMeters / MAP_VIEWBOX_WIDTH,
        y: heightMeters / MAP_VIEWBOX_HEIGHT,
    };
};

const VENUE_METERS_PER_UNIT = getVenueMetersPerUnit();

const getTalkData = (element: HTMLElement): PlanTalk | null => {
    const talkId = element.dataset.talkId;

    if (!talkId) {
        return null;
    }

    return {
        id: talkId,
        title: element.dataset.talkTitle || '',
        day: element.dataset.day || '',
        startTime: element.dataset.startTime || '',
        endTime: element.dataset.endTime || '',
        stageLabel: element.dataset.stageLabel || '',
        stageSvgIds: getStageIds(element.dataset.stageSvgIds || ''),
    };
};

const sortTalks = (talks: PlanTalk[]): PlanTalk[] => {
    return talks.slice().sort((left, right) => {
        return getTimeOrderValue(left.day, left.startTime).localeCompare(getTimeOrderValue(right.day, right.startTime));
    });
};

const getSvgCenter = (elements: HTMLElement[]): RoutePoint | null => {
    const graphics = elements.filter((element) => typeof (element as SVGGraphicsElement).getBBox === 'function') as SVGGraphicsElement[];

    if (graphics.length === 0) {
        return null;
    }

    const boxes = graphics.map((element) => element.getBBox());
    const minX = Math.min(...boxes.map((box) => box.x));
    const minY = Math.min(...boxes.map((box) => box.y));
    const maxX = Math.max(...boxes.map((box) => box.x + box.width));
    const maxY = Math.max(...boxes.map((box) => box.y + box.height));

    return {
        x: minX + ((maxX - minX) / 2),
        y: minY + ((maxY - minY) / 2),
    };
};

const samplePathPoints = (path: SVGPathElement, sampleCount = 120): RoutePoint[] => {
    const totalLength = path.getTotalLength();
    const step = totalLength / sampleCount;
    const points: RoutePoint[] = [];

    for (let index = 0; index <= sampleCount; index += 1) {
        const point = path.getPointAtLength(step * index);
        points.push({ x: point.x, y: point.y });
    }

    return points;
};

const getNearestPoint = (origin: RoutePoint, points: RoutePoint[]): RoutePoint => {
    return points.reduce((best, point) => {
        const bestDistance = Math.hypot(best.x - origin.x, best.y - origin.y);
        const pointDistance = Math.hypot(point.x - origin.x, point.y - origin.y);
        return pointDistance < bestDistance ? point : best;
    }, points[0]);
};

const mapGeoToVenue = (latitude: number, longitude: number): RoutePoint | null => {
    const withinBounds = latitude >= GPS_BOUNDS.minLat
        && latitude <= GPS_BOUNDS.maxLat
        && longitude >= GPS_BOUNDS.minLng
        && longitude <= GPS_BOUNDS.maxLng;

    if (!withinBounds) {
        return null;
    }

    const x = ((longitude - GPS_BOUNDS.minLng) / (GPS_BOUNDS.maxLng - GPS_BOUNDS.minLng)) * MAP_VIEWBOX_WIDTH;
    const y = ((GPS_BOUNDS.maxLat - latitude) / (GPS_BOUNDS.maxLat - GPS_BOUNDS.minLat)) * MAP_VIEWBOX_HEIGHT;

    return {
        x: clamp(x, 0, MAP_VIEWBOX_WIDTH),
        y: clamp(y, 0, MAP_VIEWBOX_HEIGHT),
    };
};

const createSvgNode = <T extends SVGElement>(tagName: string): T => {
    return document.createElementNS('http://www.w3.org/2000/svg', tagName) as T;
};

const getRouteDistanceMeters = (points: RoutePoint[]): number => {
    return points.slice(1).reduce((total, point, index) => {
        const previous = points[index];
        const deltaX = (point.x - previous.x) * VENUE_METERS_PER_UNIT.x;
        const deltaY = (point.y - previous.y) * VENUE_METERS_PER_UNIT.y;
        return total + Math.hypot(deltaX, deltaY);
    }, 0);
};

const estimateWalkingMinutes = (entry: RouteEntry): number => {
    const distanceMeters = getRouteDistanceMeters(entry.points);
    return Math.max(1, Math.round(distanceMeters / WALKING_SPEED_METERS_PER_MINUTE));
};

const getWaitingMinutes = (entry: RouteEntry): number => {
    return Math.max(entry.gapMinutes - estimateWalkingMinutes(entry), 0);
};

const getRouteId = (entry: RouteEntry): string => {
    return entry.from.id + '-' + entry.to.id + '-' + entry.index;
};

const getRouteLabel = (routeIndex: number): string => 'Route ' + String(routeIndex + 1).padStart(2, '0');

const getTalkStartDate = (talk: PlanTalk): Date => new Date(talk.day + 'T' + talk.startTime + ':00');

const getTalkEndDate = (talk: PlanTalk): Date => new Date(talk.day + 'T' + talk.endTime + ':00');

const getRouteTooltip = (entry: RouteEntry): string => {
    const walkingMinutes = estimateWalkingMinutes(entry);
    const waitingMinutes = getWaitingMinutes(entry);
    const waitText = waitingMinutes > 0 ? ' · wait ' + waitingMinutes + ' min' : '';

    return getRouteLabel(entry.index)
        + ' · '
        + entry.from.stageLabel
        + ' -> '
        + entry.to.stageLabel
        + ' · walk '
        + walkingMinutes
        + ' min'
        + waitText;
};

const getLiveTalkIndex = (talks: PlanTalk[], now: Date): number => {
    const activeIndex = talks.findIndex((talk) => getTalkEndDate(talk).getTime() > now.getTime());

    if (activeIndex >= 0) {
        return activeIndex;
    }

    return Math.max(talks.length - 1, 0);
};

const formatConferenceDayLabel = (value: string): string => {
    const date = new Date(value + 'T00:00:00');

    return new Intl.DateTimeFormat('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
    }).format(date);
};

const createPlanSlots = (days: string[]): PlanSlot[] => days.flatMap((day) => PLAN_SLOT_PARTS.map((slot) => ({
    ...slot,
    day,
})));

const getPlanSlotKey = (slot: PlanSlot): string => slot.day + '-' + slot.label;

const getInitialPlanSlotIndex = (slots: PlanSlot[], now: Date): number => {
    const today = now.toISOString().slice(0, 10);
    const nowMinutes = (now.getHours() * 60) + now.getMinutes();
    const sameSlotIndex = slots.findIndex((slot) => slot.day === today && nowMinutes >= slot.startMinutes && nowMinutes <= slot.endMinutes);

    if (sameSlotIndex >= 0) {
        return sameSlotIndex;
    }

    const sameDayIndex = slots.findIndex((slot) => slot.day === today);
    if (sameDayIndex >= 0) {
        return sameDayIndex;
    }

    const nextSlotIndex = slots.findIndex((slot) => slot.day >= today);
    if (nextSlotIndex >= 0) {
        return nextSlotIndex;
    }

    return Math.max(slots.length - 1, 0);
};

const talkOverlapsSlot = (talk: PlanTalk, slot: PlanSlot): boolean => {
    if (talk.day !== slot.day) {
        return false;
    }

    const talkStart = parseTimeToMinutes(talk.startTime);
    const talkEnd = parseTimeToMinutes(talk.endTime);
    return talkStart <= slot.endMinutes && talkEnd >= slot.startMinutes;
};

const getRouteSlotIndex = (entry: RouteEntry, slots: PlanSlot[]): number => {
    return slots.findIndex((slot) => talkOverlapsSlot(entry.from, slot) || talkOverlapsSlot(entry.to, slot));
};

const createRouteRenderEntry = (entry: RouteEntry): RouteRenderEntry => ({
    entry,
    routeId: getRouteId(entry),
    routeLabel: getRouteLabel(entry.index),
    routeTooltip: getRouteTooltip(entry),
    walkingMinutes: estimateWalkingMinutes(entry),
    waitingMinutes: getWaitingMinutes(entry),
    slotIndex: -1,
});

const interpolateRoutePoint = (points: RoutePoint[], progress: number): RoutePoint => {
    if (points.length === 0) {
        return { x: 0, y: 0 };
    }

    if (points.length === 1) {
        return points[0];
    }

    const clampedProgress = clamp(progress, 0, 1);
    if (clampedProgress <= 0) {
        return points[0];
    }

    if (clampedProgress >= 1) {
        return points[points.length - 1];
    }

    const segmentLengths = points.slice(1).map((point, index) => Math.hypot(point.x - points[index].x, point.y - points[index].y));
    const totalLength = segmentLengths.reduce((sum, value) => sum + value, 0);
    if (totalLength <= 0) {
        return points[points.length - 1];
    }

    let remainingLength = totalLength * clampedProgress;

    for (let index = 1; index < points.length; index += 1) {
        const segmentLength = segmentLengths[index - 1];
        if (remainingLength > segmentLength) {
            remainingLength -= segmentLength;
            continue;
        }

        const start = points[index - 1];
        const end = points[index];
        const segmentProgress = segmentLength === 0 ? 1 : remainingLength / segmentLength;

        return {
            x: start.x + ((end.x - start.x) * segmentProgress),
            y: start.y + ((end.y - start.y) * segmentProgress),
        };
    }

    return points[points.length - 1];
};

const createPlanStep = (variant: PlanStepVariant, emoji: string, numberLabel: string, title: string, detail: string, tooltip: string, extraClass = ''): HTMLElement => {
    const step = document.createElement('article');
    step.className = 'craft-plan-step is-' + variant + (extraClass ? ' ' + extraClass : '');
    step.title = tooltip;
    step.innerHTML = '<span class="craft-plan-step-index">' + emoji + ' ' + numberLabel + '</span>'
        + '<div class="craft-plan-step-body">'
        + '<strong>' + title + '</strong>'
        + '<span>' + detail + '</span>'
        + '</div>';
    return step;
};

const getOverlappingTalkIds = (talks: PlanTalk[]): Set<string> => {
    const overlappingTalkIds = new Set<string>();

    talks.forEach((talk, index) => {
        const talkStart = getTalkStartDate(talk).getTime();
        const talkEnd = getTalkEndDate(talk).getTime();

        talks.slice(index + 1).forEach((otherTalk) => {
            if (talk.day !== otherTalk.day) {
                return;
            }

            const otherStart = getTalkStartDate(otherTalk).getTime();
            const otherEnd = getTalkEndDate(otherTalk).getTime();
            const overlaps = talkStart < otherEnd && otherStart < talkEnd;

            if (overlaps) {
                overlappingTalkIds.add(talk.id);
                overlappingTalkIds.add(otherTalk.id);
            }
        });
    });

    return overlappingTalkIds;
};

const applyCraftExperience = (root: HTMLElement, filterButtons: HTMLButtonElement[], viewButtons: HTMLButtonElement[], empty: HTMLElement | null) => {
    const searchInput = getElement<HTMLInputElement>(root, '[data-search-input]');
    const scheduleItems = getElements(root, '[data-schedule-item]');
    const scheduleDays = getElements(root, '[data-schedule-day]');
    const talkItems = getElements(root, '[data-talk-item]');
    const talkDataElements = getElements(root, '[data-talk-id]');
    const mapCountSourceItems = getElements(root, '[data-map-count-source]');
    const mapRoot = getElement(root, '[data-craft-map]');
    const mapCharacter = getElement(root, '[data-craft-map-character]');
    const mapBubbleLayer = getElement(root, '[data-craft-map-bubbles]');
    const mapOverlay = getElement<SVGSVGElement>(root, '[data-craft-map-overlay]');
    const routeGroup = getElement(root, '[data-craft-route-group]');
    const positionGroup = getElement(root, '[data-craft-position-group]');
    const routeLabels = getElement(root, '[data-craft-map-route-labels]');
    const mapSuccess = getElement(root, '[data-craft-map-success]');
    const dpadButtons = getElements<HTMLButtonElement>(root, '[data-map-move]');
    const mapCenterButton = getElement<HTMLButtonElement>(root, '[data-map-center]');
    const planPanel = getElement(root, '[data-craft-plan]');
    const planCount = getElement(root, '[data-plan-count]');
    const routeRange = getElement<HTMLInputElement>(root, '[data-route-range]');
    const routeRangeLabel = getElement(root, '[data-route-range-label]');
    const routeRangeMeta = getElement(root, '[data-route-range-meta]');
    const routeScale = getElement(root, '[data-route-scale]');
    const routeHistoryToggle = getElement<HTMLInputElement>(root, '[data-route-history-toggle]');
    const routeList = getElement(root, '[data-route-list]');
    const clearPlanButton = getElement<HTMLButtonElement>(root, '[data-plan-clear]');
    const gpsToggle = getElement<HTMLInputElement>(root, '[data-gps-toggle]');
    const gpsStatus = getElement(root, '[data-gps-status]');
    const searchResultsPanel = getElement(root, '[data-craft-search-results]'); // TODO
    const searchResultItems = getElements(root, '[data-craft-result-item]');
    const searchResultsCount = getElement(root, '[data-craft-results-count]');
    const jumpLinks = getElements<HTMLAnchorElement>(root, '[data-talk-jump]');
    const planButtons = getElements<HTMLButtonElement>(root, '[data-plan-toggle]');

    if (scheduleItems.length === 0 && !mapRoot) {
        return;
    }

    let currentCategory = 'all';
    let currentStageIds: string[] = [];
    let hoveredStageIds: string[] = [];
    let isRefreshScheduled = false;
    let gpsWatchId: number | null = null;
    let gpsPoint: RoutePoint | null = null;
    let manualPoint: RoutePoint | null = null;
    let successTimeout: number | null = null;
    let savedTalkIds = loadJson<string[]>(PLAN_STORAGE_KEY, []);
    let selectedPlanSlotIndex = -1;
    let showPastRoutes = true;
    const reachedTalkIds = new Set<string>();

    const talkMap = new Map<string, PlanTalk>();
    const buttonMap = new Map<string, HTMLButtonElement[]>();
    const stageIds = new Set<string>();
    const stageElementMap = new Map<string, HTMLElement[]>();
    const stageButtonMap = new Map<string, HTMLButtonElement>();
    const bubbleMap = new Map<string, HTMLElement>();
    const routeElementMap = new Map<string, HTMLElement[]>();
    const routeSvgMap = new Map<string, SVGElement[]>();
    let hoveredRouteId = '';
    const getCurrentView = (): string => root.dataset.view || 'cards';
    const usesInlineSearchResults = (): boolean => ['schedule', 'agenda'].includes(getCurrentView());

    const applyRouteHighlight = () => {
        routeElementMap.forEach((elements, routeId) => {
            const isActive = routeId === hoveredRouteId && hoveredRouteId.length > 0;
            elements.forEach((element) => {
                element.classList.toggle('is-linked-active', isActive);
            });
        });

        routeSvgMap.forEach((elements, routeId) => {
            const isActive = routeId === hoveredRouteId && hoveredRouteId.length > 0;
            elements.forEach((element) => {
                element.classList.toggle('is-linked-active', isActive);
            });
        });
    };

    const registerRouteElements = (routeId: string, elements: HTMLElement[] = [], svgElements: SVGElement[] = []) => {
        const currentElements = routeElementMap.get(routeId) || [];
        const currentSvgElements = routeSvgMap.get(routeId) || [];

        routeElementMap.set(routeId, elements.length > 0 ? elements : currentElements);
        routeSvgMap.set(routeId, svgElements.length > 0 ? svgElements : currentSvgElements);
    };

    const bindRouteHover = (routeId: string, elements: Array<HTMLElement | SVGElement>) => {
        const activate = () => {
            hoveredRouteId = routeId;
            applyRouteHighlight();
        };

        const deactivate = () => {
            hoveredRouteId = '';
            applyRouteHighlight();
        };

        elements.forEach((element) => {
            element.addEventListener('mouseenter', activate);
            element.addEventListener('mouseleave', deactivate);
            element.addEventListener('focusin', activate);
            element.addEventListener('focusout', deactivate);
        });
    };

    talkDataElements.forEach((element) => {
        const talk = getTalkData(element);
        if (!talk) return;

        if (!talkMap.has(talk.id)) {
            talkMap.set(talk.id, talk);
        }

        talk.stageSvgIds.forEach((stageId) => stageIds.add(stageId));
    });

    const conferenceDays = Array.from(new Set(Array.from(talkMap.values()).map((talk) => talk.day))).sort();

    const renderPlanScale = (slots: PlanSlot[]) => {
        if (!routeScale) {
            return;
        }

        routeScale.innerHTML = '';
        routeScale.style.gridTemplateColumns = slots.length > 0 ? 'repeat(' + String(slots.length) + ', minmax(0, 1fr))' : '';

        slots.forEach((slot, index) => {
            const marker = document.createElement('span');
            marker.className = 'craft-plan-scale-marker';
            if (index === selectedPlanSlotIndex) {
                marker.classList.add('is-active');
            }
            marker.textContent = slot.emoji;
            marker.title = 'Day ' + String(conferenceDays.indexOf(slot.day) + 1) + ' · ' + slot.label;
            routeScale.appendChild(marker);
        });
    };

    const syncPlanPanelHeight = () => {
        if (!planPanel || !mapRoot) {
            return;
        }

        if (window.innerWidth < 992) {
            planPanel.style.height = '';
            return;
        }

        const mapHeight = Math.round(mapRoot.getBoundingClientRect().height);
        planPanel.style.height = mapHeight > 0 ? mapHeight + 'px' : '';
    };

    filterButtons.forEach((button) => {
        getStageIds(button.dataset.stageSvgIds).forEach((stageId) => stageIds.add(stageId));
    });

    planButtons.forEach((button) => {
        const talkId = button.dataset.talkId;
        if (!talkId) return;

        buttonMap.set(talkId, [...(buttonMap.get(talkId) || []), button]);
    });

    if (mapRoot) {
        stageIds.forEach((stageId) => {
            const matchedElements = Array.from(mapRoot.querySelectorAll<HTMLElement>('#' + stageId));
            if (matchedElements.length === 0) return;

            matchedElements.forEach((element) => {
                element.classList.add('craft-map-stage');
                element.setAttribute('tabindex', '0');
                element.setAttribute('role', 'button');
                element.setAttribute('aria-label', 'Highlight ' + stageId.replace(/_/g, ' ').toLowerCase());
            });

            stageElementMap.set(stageId, matchedElements);
        });
    }

    if (mapBubbleLayer) {
        stageElementMap.forEach((_elements, stageId) => {
            const bubble = document.createElement('span');
            bubble.className = 'craft-map-bubble d-none';
            bubble.dataset.stageBubble = stageId;
            mapBubbleLayer.appendChild(bubble);
            bubbleMap.set(stageId, bubble);
        });
    }

    filterButtons.forEach((button) => {
        getStageIds(button.dataset.stageSvgIds).forEach((stageId) => {
            if (!stageButtonMap.has(stageId)) {
                stageButtonMap.set(stageId, button);
            }
        });
    });

    const sidewalkPath = mapRoot?.querySelector('#SIDEWALK') as SVGPathElement | null;
    const sidewalkSamples = sidewalkPath ? samplePathPoints(sidewalkPath) : [];
    const sidewalkHub = sidewalkPath
        ? (() => {
            const box = sidewalkPath.getBBox();
            return { x: box.x + (box.width / 2), y: box.y + (box.height / 2) };
        })()
        : null;

    const normalizePlan = () => {
        const uniqueIds = Array.from(new Set(savedTalkIds));
        savedTalkIds = uniqueIds.filter((talkId) => talkMap.has(talkId));
        saveJson(PLAN_STORAGE_KEY, savedTalkIds);
    };

    const getSavedTalks = (): PlanTalk[] => {
        normalizePlan();
        return sortTalks(savedTalkIds.map((talkId) => talkMap.get(talkId)).filter(Boolean) as PlanTalk[]);
    };

    const getRouteAnchor = (talk: PlanTalk): { stageCenter: RoutePoint, sidewalkPoint: RoutePoint } | null => {
        for (const stageId of talk.stageSvgIds) {
            const elements = stageElementMap.get(stageId);
            const stageCenter = elements ? getSvgCenter(elements) : null;

            if (!stageCenter) {
                continue;
            }

            const sidewalkPoint = sidewalkSamples.length > 0 ? getNearestPoint(stageCenter, sidewalkSamples) : stageCenter;
            return { stageCenter, sidewalkPoint };
        }

        return null;
    };

    const showArrivalSuccess = (point: RoutePoint) => {
        if (!mapSuccess) {
            return;
        }

        mapSuccess.style.left = toPercent(point.x, MAP_VIEWBOX_WIDTH);
        mapSuccess.style.top = toPercent(point.y, MAP_VIEWBOX_HEIGHT);
        mapSuccess.classList.remove('d-none');

        if (successTimeout !== null) {
            window.clearTimeout(successTimeout);
        }

        successTimeout = window.setTimeout(() => {
            mapSuccess.classList.add('d-none');
            successTimeout = null;
        }, 1800);
    };

    const createRouteEntries = (talks: PlanTalk[]): RouteEntry[] => {
        const entries: RouteEntry[] = [];

        talks.forEach((talk, index) => {
            const nextTalk = talks[index + 1];
            if (!nextTalk || talk.day !== nextTalk.day) {
                return;
            }

            const fromAnchor = getRouteAnchor(talk);
            const toAnchor = getRouteAnchor(nextTalk);
            if (!fromAnchor || !toAnchor) {
                return;
            }

            const gapMinutes = parseTimeToMinutes(nextTalk.startTime) - parseTimeToMinutes(talk.endTime);
            const points = compactPoints([
                fromAnchor.stageCenter,
                fromAnchor.sidewalkPoint,
                sidewalkHub || fromAnchor.sidewalkPoint,
                toAnchor.sidewalkPoint,
                toAnchor.stageCenter,
            ]);

            entries.push({
                index,
                from: talk,
                to: nextTalk,
                gapMinutes,
                points,
            });
        });

        return entries;
    };

    const getManualSourcePoint = (talks: PlanTalk[], entries: RouteEntry[], now: Date): RoutePoint | null => {
        if (manualPoint) {
            return manualPoint;
        }

        const autoState = getAutomaticCharacterState(talks, entries, now);
        return autoState.point;
    };

    const positionMapCharacter = (point: RoutePoint | null, label = '') => {
        if (!mapCharacter) {
            return;
        }

        const isVisible = Boolean(point);
        mapCharacter.classList.toggle('is-hidden', !isVisible);
        mapCharacter.classList.toggle('is-gps-active', Boolean(gpsPoint));
        mapCharacter.setAttribute('title', label);

        if (!point) {
            return;
        }

        mapCharacter.setAttribute('style', 'left: ' + toPercent(point.x, MAP_VIEWBOX_WIDTH) + '; top: ' + toPercent(point.y, MAP_VIEWBOX_HEIGHT) + ';');
    };

    const getRouteProgressPoint = (entry: RouteEntry, now: Date): RoutePoint => {
        const routeStartTime = getTalkEndDate(entry.from).getTime();
        const routeEndTime = getTalkStartDate(entry.to).getTime();
        const walkingMinutes = Math.max(1, Math.min(estimateWalkingMinutes(entry), Math.max(entry.gapMinutes, 1)));
        const walkingDuration = walkingMinutes * 60 * 1000;
        const elapsed = now.getTime() - routeStartTime;
        const totalGap = routeEndTime - routeStartTime;

        if (totalGap <= 0 || elapsed <= 0) {
            return entry.points[0];
        }

        if (elapsed >= totalGap || elapsed >= walkingDuration) {
            return entry.points[entry.points.length - 1];
        }

        return interpolateRoutePoint(entry.points, elapsed / walkingDuration);
    };

    const getAutomaticCharacterState = (talks: PlanTalk[], entries: RouteEntry[], now: Date): CharacterState => {
        const activeTalk = talks.find((talk) => {
            const start = getTalkStartDate(talk).getTime();
            const end = getTalkEndDate(talk).getTime();
            return now.getTime() >= start && now.getTime() <= end;
        });
        if (activeTalk) {
            return {
                point: getRouteAnchor(activeTalk)?.stageCenter || null,
                label: 'LINK · at ' + activeTalk.stageLabel + ' for ' + activeTalk.title,
            };
        }

        const activeRoute = entries.find((entry) => {
            const routeStart = getTalkEndDate(entry.from).getTime();
            const routeEnd = getTalkStartDate(entry.to).getTime();
            return now.getTime() > routeStart && now.getTime() < routeEnd;
        });
        if (activeRoute) {
            return {
                point: getRouteProgressPoint(activeRoute, now),
                label: 'LINK · on the way from ' + activeRoute.from.stageLabel + ' to ' + activeRoute.to.stageLabel,
            };
        }

        const nextTalk = talks.find((talk) => getTalkStartDate(talk).getTime() > now.getTime());
        if (nextTalk) {
            return {
                point: getRouteAnchor(nextTalk)?.stageCenter || null,
                label: 'LINK · heading to ' + nextTalk.stageLabel,
            };
        }

        const lastTalk = talks[talks.length - 1];
        if (lastTalk) {
            return {
                point: getRouteAnchor(lastTalk)?.stageCenter || null,
                label: 'LINK · last saved stop at ' + lastTalk.stageLabel,
            };
        }

        return {
            point: null,
            label: 'LINK · no saved route available',
        };
    };

    const getDisplayedCharacterState = (talks: PlanTalk[], entries: RouteEntry[], now: Date): CharacterState => {
        if (gpsPoint) {
            return {
                point: gpsPoint,
                label: 'LINK · live GPS position',
            };
        }

        if (manualPoint) {
            return {
                point: manualPoint,
                label: 'LINK · manual position',
            };
        }

        return getAutomaticCharacterState(talks, entries, now);
    };

    const getManualRouteTarget = (savedTalks: PlanTalk[], visibleTalks: PlanTalk[], now: Date): PlanTalk | null => {
        const primaryTalks = visibleTalks.length > 0 ? visibleTalks : savedTalks.filter((talk) => getTalkEndDate(talk).getTime() >= now.getTime());
        const candidates = (primaryTalks.length > 0 ? primaryTalks : savedTalks).filter((talk) => !reachedTalkIds.has(talk.id));
        return candidates[0] || null;
    };

    const createRouteFromPointToTalk = (sourcePoint: RoutePoint, targetTalk: PlanTalk): RouteRenderEntry | null => {
        const targetAnchor = getRouteAnchor(targetTalk);
        if (!targetAnchor) {
            return null;
        }

        const sourceSidewalk = sidewalkSamples.length > 0 ? getNearestPoint(sourcePoint, sidewalkSamples) : sourcePoint;
        const points = compactPoints([
            sourcePoint,
            sourceSidewalk,
            sidewalkHub || sourceSidewalk,
            targetAnchor.sidewalkPoint,
            targetAnchor.stageCenter,
        ]);

        const entry: RouteEntry = {
            index: -1,
            from: {
                id: 'link-manual',
                title: 'LINK',
                day: targetTalk.day,
                startTime: targetTalk.startTime,
                endTime: targetTalk.endTime,
                stageLabel: 'Current position',
                stageSvgIds: [],
            },
            to: targetTalk,
            gapMinutes: Math.max(estimateWalkingMinutes({
                index: -1,
                from: targetTalk,
                to: targetTalk,
                gapMinutes: 0,
                points,
            }), 1),
            points,
        };

        return {
            entry,
            routeId: 'link-manual-' + targetTalk.id,
            routeLabel: 'LINK',
            routeTooltip: 'LINK route · move to ' + targetTalk.stageLabel + ' for ' + targetTalk.title,
            walkingMinutes: Math.max(1, Math.round(getRouteDistanceMeters(points) / WALKING_SPEED_METERS_PER_MINUTE)),
            waitingMinutes: 0,
            slotIndex: -1,
        };
    };

    const syncMapCharacter = (talks: PlanTalk[], entries: RouteEntry[]) => {
        const characterState = getDisplayedCharacterState(talks, entries, new Date());
        positionMapCharacter(characterState.point, characterState.label);
    };

    const renderGpsMarker = () => {
        if (!positionGroup) {
            return;
        }

        positionGroup.innerHTML = '';

        if (!gpsPoint) {
            return;
        }

        const pulse = createSvgNode<SVGCircleElement>('circle');
        pulse.setAttribute('cx', String(gpsPoint.x));
        pulse.setAttribute('cy', String(gpsPoint.y));
        pulse.setAttribute('r', '22');
        pulse.setAttribute('class', 'craft-map-gps-pulse');

        const dot = createSvgNode<SVGCircleElement>('circle');
        dot.setAttribute('cx', String(gpsPoint.x));
        dot.setAttribute('cy', String(gpsPoint.y));
        dot.setAttribute('r', '8');
        dot.setAttribute('class', 'craft-map-gps-dot');

        positionGroup.appendChild(pulse);
        positionGroup.appendChild(dot);
    };

    const renderRoutes = (activeEntries: RouteRenderEntry[], mutedEntries: RouteRenderEntry[] = []) => {
        if (!routeGroup || !routeLabels) {
            return;
        }

        routeGroup.innerHTML = '';
        routeLabels.innerHTML = '';
        routeSvgMap.clear();

        const renderRouteTrack = (item: RouteRenderEntry, isMuted: boolean) => {
            const { entry, routeId, routeLabel, routeTooltip } = item;
            const pointsValue = entry.points.map((point) => point.x + ',' + point.y).join(' ');
            const polyline = createSvgNode<SVGPolylineElement>('polyline');
            polyline.setAttribute('points', pointsValue);
            polyline.setAttribute('class', isMuted ? 'craft-map-route-line is-muted-route' : 'craft-map-route-line');
            polyline.setAttribute('data-route-id', routeId);
            routeGroup.appendChild(polyline);

            const startMarker = createSvgNode<SVGCircleElement>('circle');
            startMarker.setAttribute('cx', String(entry.points[0].x));
            startMarker.setAttribute('cy', String(entry.points[0].y));
            startMarker.setAttribute('r', isMuted ? '4' : '6');
            startMarker.setAttribute('class', isMuted ? 'craft-map-route-stop is-muted-route' : 'craft-map-route-stop');
            startMarker.setAttribute('data-route-id', routeId);
            routeGroup.appendChild(startMarker);

            const endPoint = entry.points[entry.points.length - 1];
            const endMarker = createSvgNode<SVGCircleElement>('circle');
            endMarker.setAttribute('cx', String(endPoint.x));
            endMarker.setAttribute('cy', String(endPoint.y));
            endMarker.setAttribute('r', isMuted ? '4' : '6');
            endMarker.setAttribute('class', isMuted ? 'craft-map-route-stop is-muted-route' : 'craft-map-route-stop');
            endMarker.setAttribute('data-route-id', routeId);
            routeGroup.appendChild(endMarker);

            if (isMuted) {
                registerRouteElements(routeId, [], [polyline, startMarker, endMarker]);
                return;
            }

            const hitbox = createSvgNode<SVGPolylineElement>('polyline');
            hitbox.setAttribute('points', pointsValue);
            hitbox.setAttribute('class', 'craft-map-route-hitbox');
            hitbox.setAttribute('data-route-id', routeId);
            hitbox.setAttribute('tabindex', '0');
            hitbox.setAttribute('aria-label', routeTooltip);
            const hitboxTitle = createSvgNode<SVGTitleElement>('title');
            hitboxTitle.textContent = routeTooltip;
            hitbox.appendChild(hitboxTitle);
            routeGroup.appendChild(hitbox);

            const labelPoint = entry.points[Math.floor(entry.points.length / 2)];
            const walkLabel = document.createElement('span');
            walkLabel.className = 'craft-map-route-label';
            walkLabel.style.left = toPercent(labelPoint.x, MAP_VIEWBOX_WIDTH);
            walkLabel.style.top = toPercent(labelPoint.y, MAP_VIEWBOX_HEIGHT);
            walkLabel.textContent = '🚶 ' + routeLabel.replace('Route ', '');
            walkLabel.title = routeTooltip;
            routeLabels.appendChild(walkLabel);

            const talkLabel = document.createElement('span');
            talkLabel.className = 'craft-map-route-label is-end';
            talkLabel.style.left = toPercent(endPoint.x, MAP_VIEWBOX_WIDTH);
            talkLabel.style.top = toPercent(endPoint.y, MAP_VIEWBOX_HEIGHT);
            talkLabel.textContent = '🎤';
            talkLabel.title = 'Talk destination · ' + entry.to.title;
            routeLabels.appendChild(talkLabel);

            registerRouteElements(routeId, [], [polyline, hitbox, startMarker, endMarker]);
            bindRouteHover(routeId, [hitbox]);
        };

        mutedEntries.forEach((item) => renderRouteTrack(item, true));
        activeEntries.forEach((item) => renderRouteTrack(item, false));

        applyRouteHighlight();
        renderGpsMarker();
    };

    const renderPlan = () => {
        const savedTalks = getSavedTalks();
        const routeEntries = createRouteEntries(savedTalks);
        const routeRenderEntries = routeEntries.map(createRouteRenderEntry);
        const planSlots = createPlanSlots(conferenceDays);
        const now = new Date();

        if (planSlots.length === 0) {
            selectedPlanSlotIndex = -1;
        } else if (selectedPlanSlotIndex < 0 || selectedPlanSlotIndex >= planSlots.length) {
            selectedPlanSlotIndex = getInitialPlanSlotIndex(planSlots, now);
        }

        const selectedSlot = selectedPlanSlotIndex >= 0 ? planSlots[selectedPlanSlotIndex] : null;
        routeRenderEntries.forEach((item) => {
            item.slotIndex = getRouteSlotIndex(item.entry, planSlots);
        });

        const visibleTalks = selectedSlot ? savedTalks.filter((talk) => talkOverlapsSlot(talk, selectedSlot)) : [];
        const overlappingTalkIds = getOverlappingTalkIds(visibleTalks);
        const visibleRouteEntries = selectedSlot
            ? routeRenderEntries.filter((item) => talkOverlapsSlot(item.entry.from, selectedSlot) || talkOverlapsSlot(item.entry.to, selectedSlot))
            : [];
        const pastRouteEntries = selectedSlot && showPastRoutes
            ? routeRenderEntries.filter((item) => item.slotIndex >= 0 && item.slotIndex < selectedPlanSlotIndex && !visibleRouteEntries.some((visible) => visible.routeId === item.routeId))
            : [];
        const dayLabel = selectedSlot ? formatConferenceDayLabel(selectedSlot.day) : 'No conference slot';
        const slotLabel = selectedSlot ? selectedSlot.emoji + ' ' + selectedSlot.label : 'No slot';
        const characterState = getDisplayedCharacterState(savedTalks, routeEntries, now);
        const manualTarget = !gpsPoint && characterState.point ? getManualRouteTarget(savedTalks, visibleTalks, now) : null;
        const manualRoute = !gpsPoint && characterState.point && manualTarget ? createRouteFromPointToTalk(characterState.point, manualTarget) : null;

        if (manualPoint && manualTarget) {
            const targetCenter = getRouteAnchor(manualTarget)?.stageCenter;
            if (targetCenter && Math.hypot(characterState.point!.x - targetCenter.x, characterState.point!.y - targetCenter.y) <= TARGET_REACHED_RADIUS) {
                if (!reachedTalkIds.has(manualTarget.id)) {
                    reachedTalkIds.add(manualTarget.id);
                    showArrivalSuccess(targetCenter);
                    window.requestAnimationFrame(() => renderPlan());
                }
            }
        }

        syncMapCharacter(savedTalks, routeEntries);

        if (planCount) {
            planCount.textContent = String(savedTalks.length);
        }

        renderPlanScale(planSlots);

        if (routeRange) {
            routeRange.min = '0';
            routeRange.max = String(Math.max(planSlots.length - 1, 0));
            routeRange.value = String(Math.max(selectedPlanSlotIndex, 0));
            routeRange.disabled = planSlots.length <= 1;
            routeRange.setAttribute('aria-valuetext', slotLabel + ' on ' + dayLabel);
        }

        if (routeRangeLabel) {
            routeRangeLabel.textContent = selectedSlot
                ? 'Day ' + String(conferenceDays.indexOf(selectedSlot.day) + 1) + ' · ' + slotLabel
                : 'No conference slots';
        }

        if (routeRangeMeta) {
            routeRangeMeta.textContent = selectedSlot
                ? dayLabel + ' · ' + formatMinutesLabel(selectedSlot.startMinutes) + ' - ' + formatMinutesLabel(selectedSlot.endMinutes)
                : 'No slots';
        }

        if (routeHistoryToggle) {
            routeHistoryToggle.checked = showPastRoutes;
            routeHistoryToggle.disabled = selectedPlanSlotIndex <= 0;
        }

        if (clearPlanButton) {
            clearPlanButton.classList.toggle('d-none', savedTalks.length === 0);
        }

        if (routeList) {
            routeList.innerHTML = '';
            routeList.classList.toggle('d-none', savedTalks.length === 0);
            routeElementMap.clear();

            if (manualRoute && manualTarget) {
                const liveStep = createPlanStep(
                    'walk',
                    '🕹️',
                    'LIVE',
                    'Move LINK',
                    manualRoute.walkingMinutes + ' min to ' + manualTarget.stageLabel,
                    manualRoute.routeTooltip,
                );
                routeList.appendChild(liveStep);
                registerRouteElements(manualRoute.routeId, [liveStep], routeSvgMap.get(manualRoute.routeId) || []);
                bindRouteHover(manualRoute.routeId, [liveStep]);
            }

            visibleTalks.forEach((talk) => {
                const talkIndex = savedTalks.findIndex((item) => item.id === talk.id);
                const hasOverlap = overlappingTalkIds.has(talk.id);
                const talkDetail = talk.title + ' · ' + talk.stageLabel + (hasOverlap ? ' · overlaps now' : '');
                const talkTooltip = 'Talk ' + String(talkIndex + 1) + ' · ' + talk.title + ' · ' + talk.stageLabel + (hasOverlap ? ' · overlaps with another saved talk' : '');
                const talkStep = createPlanStep(
                    'talk',
                    hasOverlap ? '⚠️' : '🎤',
                    String(talkIndex + 1).padStart(2, '0'),
                    talk.day + ' · ' + talk.startTime + ' - ' + talk.endTime,
                    talkDetail,
                    talkTooltip,
                    hasOverlap ? 'is-overlap' : '',
                );
                routeList.appendChild(talkStep);

                const route = visibleRouteEntries.find((item) => item.entry.from.id === talk.id);
                if (!route) {
                    return;
                }

                const stepElements: HTMLElement[] = [];
                const walkStep = createPlanStep(
                    'walk',
                    '🚶',
                    route.routeLabel,
                    'Walk',
                    route.walkingMinutes + ' min to ' + route.entry.to.stageLabel,
                    route.routeTooltip,
                );
                routeList.appendChild(walkStep);
                stepElements.push(walkStep);

                if (route.waitingMinutes > 0) {
                    const waitStep = createPlanStep(
                        'wait',
                        '⏳',
                        route.routeLabel,
                        'Wait',
                        route.waitingMinutes + ' min buffer before ' + route.entry.to.title,
                        route.routeTooltip,
                    );
                    routeList.appendChild(waitStep);
                    stepElements.push(waitStep);
                }

                registerRouteElements(route.routeId, stepElements, routeSvgMap.get(route.routeId) || []);
                bindRouteHover(route.routeId, stepElements);
            });
        }

        talkItems.forEach((item) => {
            const talkId = item.dataset.talkId || '';
            item.classList.toggle('is-saved', savedTalkIds.includes(talkId));
        });

        buttonMap.forEach((buttons, talkId) => {
            const isSaved = savedTalkIds.includes(talkId);
            buttons.forEach((button) => {
                button.classList.toggle('is-active', isSaved);
                button.textContent = isSaved ? '✅ Saved' : '💾 Save';
                button.setAttribute('aria-pressed', isSaved ? 'true' : 'false');
            });
        });

        renderRoutes(manualRoute ? [manualRoute, ...visibleRouteEntries] : visibleRouteEntries, pastRouteEntries);

        dpadButtons.forEach((button) => {
            button.disabled = Boolean(gpsPoint);
        });

        if (mapCenterButton) {
            mapCenterButton.disabled = Boolean(gpsPoint);
        }
        applyRouteHighlight();
    };

    const applyMapHighlight = () => {
        const planStageIds = getSavedTalks().flatMap((talk) => talk.stageSvgIds);
        const activeIds = new Set(hoveredStageIds.length > 0 ? hoveredStageIds : [...currentStageIds, ...planStageIds]);
        const hasActiveIds = activeIds.size > 0;

        stageElementMap.forEach((elements, stageId) => {
            const isActive = activeIds.has(stageId);
            elements.forEach((element) => {
                element.classList.toggle('is-active', isActive);
                element.classList.toggle('is-dimmed', hasActiveIds && !isActive);
            });
        });
    };

    const applyScheduleFilters = () => {
        if (scheduleItems.length === 0) {
            return;
        }

        const query = getSearchQuery(searchInput?.value || '');
        let visibleCount = 0;

        scheduleItems.forEach((item) => {
            const matchesCategory = currentCategory === 'all' || item.dataset.category === currentCategory;
            const matchesSearch = !query || (item.dataset.search || '').includes(query);
            const isVisible = matchesCategory && matchesSearch;

            item.classList.toggle('d-none', !isVisible);
            visibleCount += isVisible ? 1 : 0;
        });

        scheduleDays.forEach((day) => {
            const visibleItems = day.querySelectorAll('[data-schedule-item]:not(.d-none)').length;
            day.classList.toggle('d-none', visibleItems === 0);
        });

        if (empty) {
            empty.classList.toggle('is-visible', visibleCount === 0);
            empty.classList.toggle('d-none', visibleCount !== 0);
        }
    };

    const updateMapBubbles = () => {
        if (!searchInput || !mapRoot || !mapBubbleLayer) {
            return;
        }

        const query = getSearchQuery(searchInput.value || '');
        const showBubbles = query.length > 0;
        const counts = new Map<string, number>();
        const bubbleLayerRect = mapBubbleLayer.getBoundingClientRect();

        bubbleMap.forEach((bubble) => {
            bubble.classList.add('d-none');
        });

        if (!showBubbles) {
            return;
        }

        mapCountSourceItems.forEach((item) => {
            const itemSection = item.closest<HTMLElement>('[data-category-section]');
            const isVisible = !item.classList.contains('d-none') && !itemSection?.classList.contains('d-none');

            if (!isVisible) {
                return;
            }

            getStageIds(item.dataset.stageSvgIds).forEach((stageId) => {
                counts.set(stageId, (counts.get(stageId) || 0) + 1);
            });
        });

        counts.forEach((count, stageId) => {
            const elements = stageElementMap.get(stageId);
            const bubble = bubbleMap.get(stageId);
            const target = elements?.[0];

            if (!bubble || !target) {
                return;
            }

            const targetRect = target.getBoundingClientRect();
            const offsetX = 10;
            const offsetY = 8;

            bubble.textContent = String(count);
            bubble.style.left = String(targetRect.right - bubbleLayerRect.left + offsetX) + 'px';
            bubble.style.top = String(targetRect.top - bubbleLayerRect.top + offsetY) + 'px';
            bubble.classList.remove('d-none');
        });
    };

    const updateSearchResults = () => {
        if (!searchInput || !searchResultsPanel) {
            return;
        }

        const query = getSearchQuery(searchInput.value || '');
        const hasQuery = query.length > 0;
        let visibleCount = 0;

        searchResultItems.forEach((item) => {
            const matchesCategory = currentCategory === 'all' || item.dataset.category === currentCategory;
            const matchesSearch = !query || (item.dataset.search || '').includes(query);
            const isVisible = hasQuery && matchesCategory && matchesSearch;

            item.classList.toggle('d-none', !isVisible);
            visibleCount += isVisible ? 1 : 0;
        });

        searchResultItems
            .slice()
            .sort((left, right) => getTimeOrderValue(left.dataset.day, left.dataset.startTime)
                .localeCompare(getTimeOrderValue(right.dataset.day, right.dataset.startTime)))
            .forEach((item) => {
                item.parentElement?.appendChild(item);
            });

        searchResultsPanel.classList.toggle('d-none', usesInlineSearchResults() || !hasQuery || visibleCount === 0);

        if (searchResultsCount) {
            searchResultsCount.textContent = String(visibleCount);
        }
    };

    const refreshCraftUi = () => {
        syncPlanPanelHeight();
        updateSearchResults();
        updateMapBubbles();
        applyMapHighlight();
        renderPlan();
    };

    const scheduleCraftUiRefresh = () => {
        if (isRefreshScheduled) {
            return;
        }

        isRefreshScheduled = true;
        window.requestAnimationFrame(() => {
            isRefreshScheduled = false;
            refreshCraftUi();
        });
    };

    const syncCurrentStage = () => {
        const activeButton = filterButtons.find((button) => button.classList.contains('active'));
        currentCategory = activeButton?.dataset.filterButton || 'all';
        currentStageIds = getStageIds(activeButton?.dataset.stageSvgIds || '');
        applyScheduleFilters();
        applyMapHighlight();
        scheduleCraftUiRefresh();
    };

    const bindHoverHighlight = (element: HTMLElement) => {
        const stageIdsOfElement = getStageIds(element.dataset.stageSvgIds || '');
        if (stageIdsOfElement.length === 0) return;

        const activate = () => {
            hoveredStageIds = stageIdsOfElement;
            applyMapHighlight();
        };

        const deactivate = () => {
            hoveredStageIds = [];
            applyMapHighlight();
        };

        element.addEventListener('mouseenter', activate);
        element.addEventListener('mouseleave', deactivate);
        element.addEventListener('focusin', activate);
        element.addEventListener('focusout', deactivate);
    };

    const togglePlanTalk = (talkId: string) => {
        savedTalkIds = savedTalkIds.includes(talkId)
            ? savedTalkIds.filter((value) => value !== talkId)
            : [...savedTalkIds, talkId];

        normalizePlan();
        renderPlan();
    };

    const stopGps = () => {
        if (gpsWatchId !== null) {
            navigator.geolocation.clearWatch(gpsWatchId);
            gpsWatchId = null;
        }

        gpsPoint = null;
        renderGpsMarker();
        renderPlan();

        if (gpsToggle) {
            gpsToggle.checked = false;
        }

        if (gpsStatus) {
            gpsStatus.textContent = manualPoint ? 'Manual mode' : 'GPS off';
        }
    };

    const startGps = () => {
        if (!navigator.geolocation) {
            if (gpsStatus) {
                gpsStatus.textContent = 'GPS unavailable';
            }
            if (gpsToggle) {
                gpsToggle.checked = false;
            }
            return;
        }

        if (gpsToggle) {
            gpsToggle.checked = true;
        }

        if (gpsStatus) {
            gpsStatus.textContent = 'GPS loading';
        }

        gpsWatchId = navigator.geolocation.watchPosition((position) => {
            const mappedPoint = mapGeoToVenue(position.coords.latitude, position.coords.longitude);
            gpsPoint = mappedPoint;
            manualPoint = null;
            renderGpsMarker();
            renderPlan();

            if (!gpsStatus) {
                return;
            }

            if (!mappedPoint) {
                gpsStatus.textContent = 'GPS outside map';
                return;
            }

            gpsStatus.textContent = 'GPS ±' + Math.round(position.coords.accuracy) + ' m';
        }, () => {
            stopGps();
            if (gpsStatus) {
                gpsStatus.textContent = 'GPS denied';
            }
        }, {
            enableHighAccuracy: true,
            maximumAge: 15000,
            timeout: 10000,
        });
    };

    talkItems.forEach(bindHoverHighlight);
    filterButtons.forEach((button) => {
        button.addEventListener('click', () => {
            window.requestAnimationFrame(syncCurrentStage);
        });
        bindHoverHighlight(button);
    });

    planButtons.forEach((button) => {
        button.addEventListener('click', () => {
            const talkId = button.dataset.talkId;
            if (!talkId) return;
            togglePlanTalk(talkId);
        });
    });

    clearPlanButton?.addEventListener('click', () => {
        savedTalkIds = [];
        normalizePlan();
        renderPlan();
    });

    const moveManualCharacter = (deltaX: number, deltaY: number) => {
        if (gpsPoint) {
            return;
        }

        const savedTalks = getSavedTalks();
        const routeEntries = createRouteEntries(savedTalks);
        const basePoint = getManualSourcePoint(savedTalks, routeEntries, new Date());
        if (!basePoint) {
            return;
        }

        manualPoint = {
            x: clamp(basePoint.x + deltaX, 0, MAP_VIEWBOX_WIDTH),
            y: clamp(basePoint.y + deltaY, 0, MAP_VIEWBOX_HEIGHT),
        };
        renderPlan();
    };

    dpadButtons.forEach((button) => {
        button.addEventListener('click', () => {
            const direction = button.dataset.mapMove;
            if (direction === 'up') moveManualCharacter(0, -MANUAL_MOVE_UNITS);
            if (direction === 'down') moveManualCharacter(0, MANUAL_MOVE_UNITS);
            if (direction === 'left') moveManualCharacter(-MANUAL_MOVE_UNITS, 0);
            if (direction === 'right') moveManualCharacter(MANUAL_MOVE_UNITS, 0);
        });
    });

    mapCenterButton?.addEventListener('click', () => {
        if (gpsPoint) {
            return;
        }

        manualPoint = null;
        reachedTalkIds.clear();
        renderPlan();
    });

    if (gpsToggle) {
        gpsToggle.addEventListener('change', () => {
            if (gpsToggle.checked) {
                startGps();
                return;
            }

            stopGps();
        });
    }

    routeRange?.addEventListener('input', () => {
        selectedPlanSlotIndex = Number(routeRange.value || '0');
        renderPlan();
    });

    routeHistoryToggle?.addEventListener('change', () => {
        showPastRoutes = routeHistoryToggle.checked;
        renderPlan();
    });

    if (mapRoot) {
        stageElementMap.forEach((elements, stageId) => {
            const relatedButton = stageButtonMap.get(stageId);

            const activate = () => {
                hoveredStageIds = [stageId];
                applyMapHighlight();
            };

            const deactivate = () => {
                hoveredStageIds = [];
                applyMapHighlight();
            };

            const select = () => {
                relatedButton?.click();
            };

            elements.forEach((element) => {
                element.addEventListener('mouseenter', activate);
                element.addEventListener('mouseleave', deactivate);
                element.addEventListener('focus', activate);
                element.addEventListener('blur', deactivate);
                element.addEventListener('click', select);
                element.addEventListener('keydown', (event: KeyboardEvent) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        select();
                    }
                });
            });
        });
    }

    jumpLinks.forEach((link) => {
        link.addEventListener('click', (event) => {
            event.preventDefault();
            const targetId = link.dataset.talkJump;
            if (!targetId) return;

            const listButton = viewButtons.find((button) => button.dataset.viewButton === 'list');
            listButton?.click();

            window.requestAnimationFrame(() => {
                const target = document.getElementById(targetId);
                target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                window.location.hash = targetId;
            });
        });
    });

    searchInput?.addEventListener('input', () => {
        applyScheduleFilters();
        scheduleCraftUiRefresh();
    });

    root.addEventListener('portfolio:viewchange', scheduleCraftUiRefresh);

    window.addEventListener('resize', scheduleCraftUiRefresh);

    if (window.ResizeObserver && mapRoot) {
        const observer = new ResizeObserver(() => {
            syncPlanPanelHeight();
        });
        observer.observe(mapRoot);
    }
    syncCurrentStage();
    renderPlan();
};

export const createPortfolio = (base: any = document) => {
    const root: $HTMLElement = getElement(base as HTMLElement, '[data-portfolio]');
    if (!root) return;

    const filterButtons = getButtons(root, '[data-filter-button]');
    const viewButtons = getButtons(root, '[data-view-button]');
    const empty = getElement(root, '[data-search-empty]');
    const stored = loadJson<PortfolioUiState>(UI_STORAGE_KEY, {});
    let currentView = stored.view || 'cards';

    const save = () => saveJson(UI_STORAGE_KEY, { view: currentView });

    const applyView = () => {
        root.dataset.view = currentView;
        viewButtons.forEach((button) => button.classList.toggle('active', button.dataset.viewButton === currentView));
        root.dispatchEvent(new CustomEvent('portfolio:viewchange'));
    };

    viewButtons.forEach((button) => {
        button.addEventListener('click', () => {
            currentView = button.dataset.viewButton || 'cards';
            applyView();
            save();
        });
    });

    applyView();
    applyCraftExperience(root as HTMLElement, filterButtons, viewButtons, empty);
};
