import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export interface ComparacionOverlayData {
  cotizacionId: number;
  requisitionId: number;
  selectedProviderIds: number[];
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
