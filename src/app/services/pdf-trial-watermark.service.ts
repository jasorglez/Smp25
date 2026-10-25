import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import pdfMake from 'pdfmake/build/pdfmake';
import { SignalsService } from './signals.service';

type PdfMakeApi = {
  createPdf: (definition: any, ...args: any[]) => any;
};

@Injectable({ providedIn: 'root' })
export class PdfTrialWatermarkService {
  private readonly signals = inject(SignalsService);
  private readonly router = inject(Router);
  private installed = false;

  constructor() {
    this.install();
  }

  private install(): void {
    if (this.installed) return;
    this.installed = true;

    const pdfMakeApi = pdfMake as unknown as PdfMakeApi;
    const createPdf = pdfMakeApi.createPdf;
    if (typeof createPdf !== 'function') return;

    pdfMakeApi.createPdf = (definition: any, ...args: any[]) => {
      const shouldMark = this.signals.getLicenseType()() === 'trial' && this.isIncludedModule();
      if (!shouldMark || !definition || typeof definition !== 'object' || Array.isArray(definition)) {
        return createPdf.call(pdfMakeApi, definition, ...args);
      }

      const watermark = this.withTrialLabel(definition.watermark);
      const markedDefinition = { ...definition, watermark };
      return createPdf.call(pdfMakeApi, markedDefinition, ...args);
    };
  }

  private isIncludedModule(): boolean {
    const path = this.router.url.split(/[?#]/, 1)[0].toLowerCase();
    return [
      '/procsales',
      '/proceswar',
      '/shoppingtd',
      '/warehousestd',
      '/projects',
      '/preciosunitarios',
      '/procmodadmon',
      '/admon',
      '/palacio-municipal',
    ].some((modulePath) => path.includes(modulePath));
  }

  private withTrialLabel(existing: any): Record<string, unknown> {
    const existingOptions = typeof existing === 'string'
      ? { text: existing }
      : existing && typeof existing === 'object'
        ? existing
        : {};
    const existingText = typeof existingOptions.text === 'string' ? existingOptions.text.trim() : '';
    const label = existingText
      ? `${existingText} · VERSIÓN DE PRUEBA`
      : 'VERSIÓN DE PRUEBA';

    return {
      color: '#64748b',
      opacity: 0.22,
      bold: true,
      fontSize: 54,
      angle: -45,
      ...existingOptions,
      text: label,
    };
  }
}
