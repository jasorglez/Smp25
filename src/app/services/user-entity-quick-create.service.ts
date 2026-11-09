import { Injectable, inject } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { UserEntityCreateContext, UserEntityQuickCreateComponent } from 'app/domains/SMP/Components/users/details/user-entity-quick-create.component';

@Injectable({ providedIn: 'root' })
export class UserEntityQuickCreateService {
  private modal = inject(NgbModal);
  open(context: UserEntityCreateContext): Promise<boolean> {
    const ref = this.modal.open(UserEntityQuickCreateComponent, {
      centered: true, backdrop: 'static', keyboard: false, ariaLabelledBy: 'quick-create-title'
    });
    ref.componentInstance.context = { ...context };
    return ref.result.then(result => result === true, () => false);
  }
}
