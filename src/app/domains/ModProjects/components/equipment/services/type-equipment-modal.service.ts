import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export interface TypeEquipmentModalData {
  idCompany: number;
}

export interface TypeEquipmentSaveData {
  id: number;
  description: string;
}

@Injectable({
  providedIn: 'root'
})
export class TypeEquipmentModalService {
  private modalRequestSource = new Subject<TypeEquipmentModalData>();
  modalRequest$ = this.modalRequestSource.asObservable();

  private saveConfirmedSource = new Subject<TypeEquipmentSaveData>();
  saveConfirmed$ = this.saveConfirmedSource.asObservable();

  openModal(data: TypeEquipmentModalData) {
    this.modalRequestSource.next(data);
  }

  confirmSave(data: TypeEquipmentSaveData) {
    this.saveConfirmedSource.next(data);
  }
}
