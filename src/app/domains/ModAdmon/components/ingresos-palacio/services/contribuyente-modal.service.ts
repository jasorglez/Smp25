import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export interface ContribuyenteModalData {
  idRoot: number;
}

export interface ContribuyenteSaveData {
  id: number;
  name: string;
}

@Injectable({
  providedIn: 'root'
})
export class ContribuyenteModalService {
  // Observable para solicitar apertura del modal
  private modalRequestSource = new Subject<ContribuyenteModalData>();
  modalRequest$ = this.modalRequestSource.asObservable();

  // Observable para confirmar guardado
  private saveConfirmedSource = new Subject<ContribuyenteSaveData>();
  saveConfirmed$ = this.saveConfirmedSource.asObservable();

  constructor() { }

  // Método para abrir el modal desde el cell renderer
  openModal(data: ContribuyenteModalData) {
    this.modalRequestSource.next(data);
  }

  // Método para confirmar el guardado desde el componente padre
  confirmSave(data: ContribuyenteSaveData) {
    this.saveConfirmedSource.next(data);
  }
}
