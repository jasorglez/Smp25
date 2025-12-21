import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export interface ProviderModalData {
  idRoot: number;
}

export interface ProviderSaveData {
  id: number;
  name: string;
}

@Injectable({
  providedIn: 'root'
})
export class ProviderModalService {
  // Observable para solicitar apertura del modal
  private modalRequestSource = new Subject<ProviderModalData>();
  modalRequest$ = this.modalRequestSource.asObservable();

  // Observable para confirmar guardado
  private saveConfirmedSource = new Subject<ProviderSaveData>();
  saveConfirmed$ = this.saveConfirmedSource.asObservable();

  constructor() { }

  // Método para abrir el modal desde el cell renderer
  openModal(data: ProviderModalData) {
    this.modalRequestSource.next(data);
  }

  // Método para confirmar el guardado desde el componente padre
  confirmSave(data: ProviderSaveData) {
    this.saveConfirmedSource.next(data);
  }
}
