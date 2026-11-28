import { inject, Injectable } from '@angular/core';
import { Observable, map, of, switchMap, catchError } from 'rxjs';
import { alerts } from 'app/helpers/alerts';
import { SignalsService } from './signals.service';
import { TrackingService } from './tracking.service';
import { UsersxpermissionsService } from './usersxpermissions.service';

export type CreatorPermissionType = 'branch' | 'contract' | 'project' | 'warehouse';

@Injectable({ providedIn: 'root' })
export class CreatorPermissionService {
  private signalsService = inject(SignalsService);
  private trackingService = inject(TrackingService);
  private permissionsService = inject(UsersxpermissionsService);

  ensurePermission(userId: number, entityId: number, type: string): Observable<any> {
    if (!userId || !entityId) {
      return of(null);
    }

    return this.permissionsService.getUsersxPermissionsGeneral(type, userId).pipe(
      switchMap((permissions: any[]) => {
        const existing = Array.isArray(permissions)
          ? permissions.find(permission => Number(permission.idPermission) === entityId)
          : null;
        return existing
          ? of(existing)
          : this.permissionsService.addUserxPermission({
              idUser: userId,
              idPermission: entityId,
              type,
              active: 1
            });
      })
    );
  }

  grantToCreator<T>(type: CreatorPermissionType, created: T): Observable<T> {
    const entityId = Number((created as any)?.id);
    const userId = Number(this.signalsService.getIdUSer()() || this.trackingService.getId());
    if (!entityId || !userId) {
      console.error(`No se pudo identificar el creador o el ID del nuevo ${type}.`, { entityId, userId });
      alerts.basicAlert('Permiso pendiente', 'El registro se creó, pero no se pudo identificar el usuario o el ID para asignar su permiso. Revise los permisos del registro.', 'warning');
      return of(created);
    }

    return this.ensurePermission(userId, entityId, type).pipe(
      map(() => created),
      catchError(error => {
        console.error(`El ${type} se creó, pero no se pudo asignar el permiso al creador.`, error);
        alerts.basicAlert('Permiso pendiente', 'El registro se creó, pero no se pudo asignar el permiso al usuario creador. Revise los permisos del registro.', 'warning');
        return of(created);
      })
    );
  }
}
