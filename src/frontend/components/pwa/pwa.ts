import './logo/logo.css';
import { setupCacheReset } from './reset/reset';
import { setupInstall } from './install/install';
import { setupStatus } from './status/status';
import { setupRegistration } from './registration/registration';

/** 🎯 Initialize the PWA interface. */
export const setupPwa = (): void => {
    setupStatus();
    setupCacheReset();
    setupInstall();
    void setupRegistration(import.meta.env.DEV);
};
