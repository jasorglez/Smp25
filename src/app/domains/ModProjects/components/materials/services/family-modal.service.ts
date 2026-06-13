import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export interface FamilyModalData {
  idCompany: number;
}

export interface FamilySaveData {
  id: number;
  description: string;
}

@Injectable({
  providedIn: 'root'
})
export class FamilyModalService {
  // Observable para solicitar apertura del modal
  private modalRequestSource = new Subject<FamilyModalData>();
  modalRequest$ = this.modalRequestSource.asObservable();

  // Observable para confirmar guardado
  private saveConfirmedSource = new Subject<FamilySaveData>();
  saveConfirmed$ = this.saveConfirmedSource.asObservable();

  constructor() { }

  // Método para abrir el modal
  openModal(data: FamilyModalData) {
    this.modalRequestSource.next(data);
  }

  // Método para confirmar el guardado
  confirmSave(data: FamilySaveData) {
    this.saveConfirmedSource.next(data);
  }
}
