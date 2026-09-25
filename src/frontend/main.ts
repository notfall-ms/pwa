import { setupPager } from './components/pager/pager';
import './_shared/index.css';
import { setupSearch } from './components/molecules/search/search.molecule';
import { setupPreparedness } from './components/preparedness/preparedness';
import { setupPwa } from './components/pwa/pwa';

setupSearch();
setupPwa();

setupPreparedness();

setupPager();
