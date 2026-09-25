import { setupChecklist } from './checklist/checklist';
import { setupReminders } from './reminders/reminders';
import { setupLocation } from './location/location';
import { setupTracking } from './tracking/view/view';
import './preparedness.css';

/** 🎯 Initialize local preparedness tools and the voluntary tracking demo. */
export const setupPreparedness = (): void => {
    setupChecklist();
    setupLocation();
    setupTracking();
    setupReminders();
};
