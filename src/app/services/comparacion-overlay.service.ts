import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export interface ComparacionOverlayData {
  cotizacionId: number;
  cotizacionFolio: string;
  requisitionId: number;
  requisitionFolio: string;
  selectedProviderIds: number[];
  idBranchFromReq?: number;
}

@Injectable({ providedIn: 'root' })
export class ComparacionOverlayService {
  readonly open$ = new Subject<ComparacionOverlayData | null>();

  open(data: ComparacionOverlayData) {
    this.open$.next(data);
  }

  close() {
    this.open$.next(null);
  }
}
