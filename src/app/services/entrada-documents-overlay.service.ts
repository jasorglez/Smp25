import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export interface EntradaDocumentsOverlayData {
  idEntrada: number;
  docType?: string;
  readOnly?: boolean;
}

@Injectable({ providedIn: 'root' })
export class EntradaDocumentsOverlayService {
  readonly open$ = new Subject<EntradaDocumentsOverlayData | null>();
  /** Emitido cada vez que se guarda/elimina un documento en el modal. */
  readonly countUpdated$ = new Subject<{ idEntrada: number; count: number }>();

  open(data: EntradaDocumentsOverlayData) {
    this.open$.next(data);
  }

  close() {
    this.open$.next(null);
  }

  notifyCount(idEntrada: number, count: number) {
    this.countUpdated$.next({ idEntrada, count });
  }
}
