// modal.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ModalService {
  private modalVisibleSource = new BehaviorSubject<boolean>(false);
  modalVisible$ = this.modalVisibleSource.asObservable();

  private modalDataSource = new BehaviorSubject<any>(null);
  modalData$ = this.modalDataSource.asObservable();

  showModal(data: any) {
    this.modalDataSource.next(data);
    this.modalVisibleSource.next(true);
  }

  hideModal() {
    this.modalVisibleSource.next(false);
  }

  updateData(data: any) {
    this.modalDataSource.next(data);
  }
}
