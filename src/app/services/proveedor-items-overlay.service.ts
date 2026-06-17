import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

/** Datos necesarios para abrir DetalleItemsProveedorComponent como modal. */
export interface ProveedorItemsOverlayData {
  /** node.data del pedimento (articulos, cotizacionId, requisitionId, idBranch, etc.) */
  pedimentoData: any;
  providerLabel: string;
  /** Título breadcrumb para la cabecera del modal: "BOD-1 > P1 > Proveedor 1". */
  headerTitle?: string;
  providerField: string;
  slotInfo: any;
  branchPrefix: string;
  pedimentoNum: number;
  siblingSlots: any[];
  /** Callback al guardar un slot — el padre actualiza providerSlots sin recargar. */
  onSlotSaved?: (savedSlot: any) => void;
}

@Injectable({ providedIn: 'root' })
export class ProveedorItemsOverlayService {
  readonly open$ = new Subject<ProveedorItemsOverlayData | null>();

  open(data: ProveedorItemsOverlayData) {
    this.open$.next(data);
  }

  close() {
    this.open$.next(null);
  }
}
