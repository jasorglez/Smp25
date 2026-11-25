import { inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

export function injectWorkOrderTranslator(): (key: string, params?: Record<string, unknown>) => string {
  const translate = inject(TranslateService);
  return (key, params) => translate.instant(`modules.projects.workOrders.${key}`, params);
}
