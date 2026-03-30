import { Injectable } from '@angular/core';

export interface PdfFooterTemplate {
  text: string;       // usar {cp} y {pc} como placeholders
  alignment: string;
  fontSize: number;
  margin: number[];
}

@Injectable({ providedIn: 'root' })
export class PdfWorkerService {

  generateAndDownload(
    docDefinition: any,
    fileName: string,
    footerTemplate?: PdfFooterTemplate
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const worker = new Worker(
        new URL('../workers/pdf.worker', import.meta.url),
        { type: 'module' }
      );

      worker.onmessage = ({ data }) => {
        worker.terminate();
        if (data.error) {
          reject(new Error(data.error));
          return;
        }
        const blob = new Blob([data.buffer as ArrayBuffer], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = data.fileName ?? fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        resolve();
      };

      worker.onerror = (err) => {
        worker.terminate();
        reject(err);
      };

      worker.postMessage({ docDefinition, footerTemplate, fileName });
    });
  }
}
