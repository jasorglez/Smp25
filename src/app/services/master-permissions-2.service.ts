import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { TrackingService } from './tracking.service';
import { environment } from '@env/environment';
import { forkJoin, Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class MasterPermissions2Service {

  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);
  
  // Obtener todos los permisos maestros
  getMasterPermissions(idEmpresa: number): Observable<any> {
    return this.http.get(`${environment.urlSecurity}/UserSystemPermissions/master/${idEmpresa}`, {headers: this.trackingService.getHeaders()} );
  }

  // Obtener permisos detallados por masterId
  getDetailedPermissions(masterId: number): Observable<any> {
    return this.http.get(`${environment.urlSecurity}/UserSystemPermissions/detailed/${masterId}`, {headers: this.trackingService.getHeaders()} );
  }

  // Obtener permisos de un usuario específico
  getUserPermissions(userId: number): Observable<any> {
    return this.http.get(`${environment.urlSecurity}/UserSystemPermissions/user/${userId}`, {headers: this.trackingService.getHeaders()} );
  }

  // Actualizar permisos de un usuario
  updateUserPermissions(userId: number, permissionIds: number[]): Observable<any> {
    return this.http.put(`${environment.urlSecurity}/UserSystemPermissions/user/${userId}`, permissionIds, {headers: this.trackingService.getHeaders()} );
  }

  /**
   * Estados de los switches «Departamento» y «Security» bajo Setup Usuarios (Permisos maestros / UserSystem)
   * para un usuario concreto y empresa (`idRoot`).
   */
  getSetupUsuarioDepartmentAndSecurityFlags(
    userId: number,
    idRoot: number
  ): Observable<{ department: boolean; security: boolean }> {
    return forkJoin({
      masters: this.getMasterPermissions(idRoot).pipe(catchError(() => of([]))),
      userPerms: this.getUserPermissions(userId).pipe(catchError(() => of([]))),
    }).pipe(
      map(({ masters, userPerms }) => {
        const deptIds = this.extractSetupUsuarioDetailIds(masters, 'department');
        const secIds = this.extractSetupUsuarioDetailIds(masters, 'security');
        const list = Array.isArray(userPerms) ? userPerms : [];
        const userIds = new Set(
          list.map((p: any) => Number(p.permissionId ?? p.PermissionId ?? p.id)).filter(Number.isFinite)
        );
        return {
          department: deptIds.some((id) => userIds.has(id)),
          security: secIds.some((id) => userIds.has(id)),
        };
      })
    );
  }

  private extractSetupUsuarioDetailIds(masters: unknown, kind: 'department' | 'security'): number[] {
    if (!Array.isArray(masters)) {
      return [];
    }
    const setup = masters.find((m: any) => {
      const idf = String(m?.identifier ?? m?.Identifier ?? '').toLowerCase();
      const n = String(m?.permissionName ?? '').toLowerCase();
      return idf === 'users-setup' || (n.includes('setup') && n.includes('usuario'));
    }) ?? null;
    const details = setup?.detailedPermissions ?? [];
    const ids: number[] = [];
    for (const d of details) {
      const idf = String(d?.identifier ?? d?.Identifier ?? '').toLowerCase();
      const n = String(d?.permissionName ?? '').toLowerCase();
      const match =
        kind === 'department'
          ? idf === 'department' ||
            idf === 'departamento' ||
            n.includes('departamento') ||
            n.includes('department')
          : idf === 'security' || n.includes('security') || n.includes('seguridad');
      if (match) {
        const id = Number(d.id);
        if (Number.isFinite(id)) {
          ids.push(id);
        }
      }
    }
    return ids;
  }
}
