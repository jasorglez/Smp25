import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

// Silenciar todos los console.* en producción
const noop = () => {};
console.log   = noop;
console.warn  = noop;
console.info  = noop;
console.debug = noop;
console.error = noop;

bootstrapApplication(AppComponent, appConfig)
  .catch(() => {});
