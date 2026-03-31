import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export interface PermissionsModalData {
  idUser: number;
  idBranch: number;
  idRole: number;
  idPosicion: number;
  userName: string;
  /** 'userSystem' = permisos maestros / UserSystemPermissions; 'position' = permisos por posición */
  scope?: 'userSystem' | 'position';
}

@Injectable({ providedIn: 'root' })
export class ModalService {
  openPermissions$ = new Subject<PermissionsModalData>();

  openPermissions(data: PermissionsModalData) {
    this.openPermissions$.next(data);
  }
}