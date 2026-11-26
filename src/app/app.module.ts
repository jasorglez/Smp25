import { APP_INITIALIZER, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { BrowserModule } from '@angular/platform-browser';
import { AngularFireModule } from '@angular/fire/compat';
import { environment } from '../environments/environment';
import { TranslateService } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';

export function HttpLoaderFactory(http: HttpClient) {
  // Cache-busting por versión (ver app.config.ts) para que no se sirva un
  // catálogo i18n cacheado tras un deploy.
  const v = (environment.version || '0').split(' ')[0];
  return new TranslateHttpLoader(http, './assets/i18n/', `.json?v=${v}`);
}

export function appInitializer(translate: TranslateService) {
  return () => {
    const browserLanguage = translate.getBrowserLang()?.toLowerCase();
    const language = browserLanguage === 'en' ? 'en' : 'es';
    translate.setDefaultLang('es');
    if (typeof document !== 'undefined') document.documentElement.lang = language;
    return translate.use(language).toPromise();
  };
}

@NgModule({
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    NgbModule,
    BrowserModule,
    AngularFireModule.initializeApp(environment.firebase),
   ],
   providers: [
    {
      provide: APP_INITIALIZER,
      useFactory: appInitializer,
      deps: [TranslateService],
      multi: true
    }
  ],
  exports: [
    CommonModule,
    ReactiveFormsModule,
  ],
  

})
export class AppModule { }
