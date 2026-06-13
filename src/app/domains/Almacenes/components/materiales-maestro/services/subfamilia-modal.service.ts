import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export interface ModalData {
  type: 'subfamilia' | 'flavor' | 'presentation';
  mode: 'add' | 'edit';
  data?: any;
  parentData?: any;
}

@Injectable({
  providedIn: 'root'
})
export class SubfamiliaModalService {
  private modalSubject = new Subject<ModalData>();
  private saveSubject = new Subject<any>();

  modalRequest$ = this.modalSubject.asObservable();
  saveConfirmed$ = this.saveSubject.asObservable();

  openModal(modalData: ModalData) {
    this.modalSubject.next(modalData);
  }

  confirmSave(data: any) {
    this.saveSubject.next(data);
  }
}
