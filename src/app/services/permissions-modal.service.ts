import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export interface PermissionsModalData {
  /** Puede ser id numérico o fila temporal `temp_*` antes de guardar el usuario. */
  idUser: number | string;
  idBranch: number;
  idRole: number;
  idPosicion: number;
  userName: string;
  /** Si se define, sustituye a `userName` en el título «Permisos — …» (p. ej. departamento — posición). */
  modalTitleDetail?: string;
  /**
   * Si es true y el modal se abre en modo `userSystem`, se precarga la configuración base
   * desde la plantilla del rol+posición (sin ligar cambios posteriores a esa plantilla).
   */
  seedFromRolePosition?: boolean;
  /**
   * Catálogo rol+posición (pestaña Departamento › Ver permisos): solo lee/escribe `RolesxDetailedPermission`,
   * nunca `CrudPermissions` por usuario.
   */
  roleTemplateOnly?: boolean;
  /** 'userSystem' = permisos maestros / UserSystemPermissions; 'position' = permisos por posición */
  scope?: 'userSystem' | 'position';
  /** Empresa del usuario editado. Si no se pasa, permissions-view usa la empresa del sidebar. */
  idCompany?: number;
}

@Injectable({ providedIn: 'root' })
export class ModalService {
  openPermissions$ = new Subject<PermissionsModalData>();

  openPermissions(data: PermissionsModalData) {
    this.openPermissions$.next(data);
  }
}