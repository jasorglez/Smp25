import { AG_GRID_LOCALE_EN } from './ag-grid.locale.en';
import { AG_GRID_LOCALE_ES } from './ag-grid.locale.es';

const browserLanguage = typeof navigator === 'undefined' ? 'es' : navigator.language.toLowerCase();

export const AG_GRID_LOCALE = browserLanguage.startsWith('en')
  ? AG_GRID_LOCALE_EN
  : AG_GRID_LOCALE_ES;
