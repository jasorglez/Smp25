import { inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

export function injectUserSetupTranslator(): (key: string, params?: Record<string, unknown>) => string {
  const translate = inject(TranslateService);
  return (key, params) => translate.instant(`modules.userSetup.ui.${key}`, params);
}
