import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export interface SubfamilyModalData {
  idCompany: number;
  parentId: number;
  parentDescription: string;
}

export interface SubfamilySaveData {
  id: number;
  description: string;
  parentId: number;
}

@Injectable({
  providedIn: 'root'
})
export class SubfamilyModalService {
  // Observable para solicitar apertura del modal
  private modalRequestSource = new Subject<SubfamilyModalData>();
  modalRequest$ = this.modalRequestSource.asObservable();

  // Observable para confirmar guardado
  private saveConfirmedSource = new Subject<SubfamilySaveData>();
  saveConfirmed$ = this.saveConfirmedSource.asObservable();

  constructor() { }

  // Método para abrir el modal
  openModal(data: SubfamilyModalData) {
    this.modalRequestSource.next(data);
  }

  // Método para confirmar el guardado
  confirmSave(data: SubfamilySaveData) {
    this.saveConfirmedSource.next(data);
  }
}
