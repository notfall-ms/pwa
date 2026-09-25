// import 'vite/dynamic-import-polyfill'; // for prod mode
import './_shared/index.css';
import { setupSearch } from './components/molecules/search/search.molecule';

// activate in prod or explicitly with a flag
const ENABLE_SERVICE_WORKER =
    import.meta.env.PROD || import.meta.env.VITE_ENABLE_SW === 'true';

(() => {
    // insert function here
    setupSearch();

    if ('serviceWorker' in navigator && ENABLE_SERVICE_WORKER) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js').catch(() => undefined);
        });
    }
})();
