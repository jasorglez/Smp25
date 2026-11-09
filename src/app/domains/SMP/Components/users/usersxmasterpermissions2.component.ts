import { Component, computed, effect, inject } from '@angular/core';
import { AgGridModule } from 'ag-grid-angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { alerts } from 'app/helpers/alerts';
import { UsersProfileComponent } from './users-profile.component';
import { SignalsService } from 'app/services/signals.service';
import { MasterPermissions2Service } from 'app/services/master-permissions-2.service';
import { forkJoin } from 'rxjs';
import { TrackingService } from 'app/services/tracking.service';

@Component({
  selector: 'app-usersxmasterpermissions2',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, UsersProfileComponent],
  templateUrl: './usersxmasterpermissions2.component.html',
  styleUrl: './usersxmasterpermissions2.component.scss',
  styles: [
    `.small-text {
      font-size: 12px;
    }`
  ]
})

export class UsersxMasterPermissions2Component {
  masterPermissions: any[] = []; // Almacena los permisos maestros
  userPermissions: number[] = []; // Almacena los IDs de los permisos del usuario
  selectedUserId: number; // Cambia esto según el usuario seleccionado
  idEmpresa: number;
  profileSectionTitle: string = 'Permisos activos';
  loading = false;
  saving = false;
  private loadRequest = 0;

  get profileItems(): string[] {
    return (this.masterPermissions ?? []).flatMap((master: any) =>
      (master.detailedPermissions ?? [])
        .filter((detail: any) => this.isPermissionChecked(detail.id))
        .map((detail: any) => `${master.permissionName}: ${detail.permissionName}`)
    );
  }

  private permissionService = inject(MasterPermissions2Service);
  private signalsService = inject(SignalsService);
  private trackingService = inject(TrackingService);
  
  profile = computed(() => this.signalsService.profile);

  constructor() {
    effect(() => {
      const userId   = Number(this.signalsService.profile.idUser());
      const empresa  = this.signalsService.getRootSelectedBySidebar()();
      this.selectedUserId = userId;
      this.idEmpresa = Number(empresa || 0);
      if (!userId || !empresa) {
        this.loadRequest++;
        this.masterPermissions = [];
        this.userPermissions = [];
        this.loading = false;
        return;
      }
      this.loadPermissions();
    });
  }

  // Cargar los permisos maestros y los permisos del usuario
  loadPermissions() {
    if (!this.idEmpresa || !this.selectedUserId) return;   // guard por si se llama antes de tiempo
    const request = ++this.loadRequest;
    const companyId = this.idEmpresa;
    const userId = this.selectedUserId;
    this.loading = true;
    this.masterPermissions = [];
    this.userPermissions = [];
    forkJoin({ masters: this.permissionService.getCompanyMasterPermissions(companyId),
      assigned: this.permissionService.getCompanyUserPermissions(companyId, userId) }).subscribe({
      next: ({ masters, assigned }) => {
        if (request !== this.loadRequest) return;
        this.masterPermissions = masters || [];
        this.userPermissions = (assigned || []).filter(p => p.active !== false).map(p => Number(p.permissionId));
        this.loading = false;
      },
      error: () => {
        if (request !== this.loadRequest) return;
        this.loading = false;
        alerts.basicAlert('Error', 'No se pudieron cargar los permisos de la empresa seleccionada.', 'error');
      }
    });
  }

  // Verificar si un permiso está seleccionado
  isPermissionChecked(permissionId: number): boolean {
    return this.userPermissions.includes(permissionId);
  }

  // Manejar la selección/deselección de un permiso individual
  togglePermission(permissionId: number) {
    if (this.loading || this.saving) return;
    if (this.isPermissionChecked(permissionId)) {
      this.userPermissions = this.userPermissions.filter((id) => id !== permissionId);
    } else {
      this.userPermissions.push(permissionId);
    }
    this.savePermissions('Toggle permiso ' + permissionId);
  }

  // Cuántos permisos del grupo están activos (para el badge)
  getActiveCount(master: any): number {
    if (!master?.detailedPermissions) return 0;
    return master.detailedPermissions.filter((d: any) => this.isPermissionChecked(d.id)).length;
  }

  // Activar todos los permisos de un grupo
  enableAllInMaster(master: any) {
    if (this.loading || this.saving) return;
    const ids: number[] = (master.detailedPermissions ?? []).map((d: any) => d.id);
    ids.forEach(id => { if (!this.userPermissions.includes(id)) this.userPermissions.push(id); });
    this.savePermissions('Activar todos en ' + master.permissionName);
  }

  // Desactivar todos los permisos de un grupo
  disableAllInMaster(master: any) {
    if (this.loading || this.saving) return;
    const ids: number[] = (master.detailedPermissions ?? []).map((d: any) => d.id);
    this.userPermissions = this.userPermissions.filter(id => !ids.includes(id));
    this.savePermissions('Desactivar todos en ' + master.permissionName);
  }

  // Guardar en backend y registrar tracking
  private savePermissions(action: string) {
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      action,
      'Menu Administracion Permisos Maestros',
      this.trackingService.getEmail()
    );
    const companyId = this.idEmpresa;
    const userId = this.selectedUserId;
    const ids = [...this.userPermissions];
    this.saving = true;
    this.permissionService.updateCompanyUserPermissions(companyId, userId, ids).subscribe({
      next: () => {
        this.saving = false;
        if (companyId === this.idEmpresa && userId === this.selectedUserId)
          alerts.basicAlert('Mensaje', 'Permisos de la empresa actualizados correctamente.', 'success');
      },
      error: () => {
        this.saving = false;
        if (companyId !== this.idEmpresa || userId !== this.selectedUserId) return;
        alerts.basicAlert('Error', 'No se pudieron guardar los permisos.', 'error');
        this.loadPermissions();
      }
    });
  }
}
