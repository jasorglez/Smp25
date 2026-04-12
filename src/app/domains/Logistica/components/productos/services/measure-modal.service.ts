import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export interface MeasureModalData {
  idCompany: number;
}

export interface MeasureSaveData {
  id: number;
  description: string;
}

@Injectable({
  providedIn: 'root'
})
export class MeasureModalService {
  private modalRequestSource = new Subject<MeasureModalData>();
  modalRequest$ = this.modalRequestSource.asObservable();

  private saveConfirmedSource = new Subject<MeasureSaveData>();
  saveConfirmed$ = this.saveConfirmedSource.asObservable();

  openModal(data: MeasureModalData) {
    this.modalRequestSource.next(data);
  }

  confirmSave(data: MeasureSaveData) {
    this.saveConfirmedSource.next(data);
  }
}