import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { TranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class TraductorService {

  constructor(private translate: TranslateService, private http: HttpClient) {
    // Agregar los idiomas disponibles
    this.translate.addLangs(['es', 'en']);

    // Obtener el idioma del navegador
    const browserLang = this.translate.getBrowserLang();

    // Verificar si browserLang tiene un valor antes de establecerlo como idioma predeterminado
    if (browserLang) {
      this.translate.setDefaultLang(browserLang);
    } else {
      this.translate.setDefaultLang('es'); // Establecer un valor predeterminado si browserLang es undefined
    }

  }

  getTranslation(lang: string): Observable<any> {
    return this.http.get(`/assets/i18n/${lang}.json`);
  }

  // Función para cambiar el idioma
  public changeLanguage(lang: string): void {
    this.translate.use(lang);
  }

  // Función para obtener el idioma actual
  public getCurrentLanguage(): string {
    return this.translate.currentLang;
  }

  // Función para obtener un texto traducido
  public translateText(key: string): string {
    let translatedText = '';
    this.translate.get(key).subscribe((text: string) => {
      translatedText = text;
    });
    return translatedText || '';
  }

}
