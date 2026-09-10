import { Component, computed, effect, inject } from '@angular/core';
import { AgGridModule } from 'ag-grid-angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { alerts } from 'app/helpers/alerts';
import { UsersProfileComponent } from './users-profile.component';
import { SignalsService } from 'app/services/signals.service';
import { MasterPermissions2Service } from 'app/services/master-permissions-2.service';
import { tap } from 'rxjs/operators';
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

  private permissionService = inject(MasterPermissions2Service);
  private signalsService = inject(SignalsService);
  private trackingService = inject(TrackingService);
  
  profile = computed(() => this.signalsService.profile);

  constructor() {
    effect(() => {
      const userId   = Number(this.signalsService.profile.idUser());
      const empresa  = this.signalsService.getRootSelectedBySidebar()();
      if (!userId || !empresa) return;          // esperar a que los signals tengan valor
      this.selectedUserId = userId;
      this.idEmpresa      = empresa;
      this.loadPermissions();
    });
  }

  // Cargar los permisos maestros y los permisos del usuario
  loadPermissions() {
    if (!this.idEmpresa || !this.selectedUserId) return;   // guard por si se llama antes de tiempo
    // Obtener permisos maestros
    this.permissionService.getMasterPermissions(this.idEmpresa).subscribe((data: any) => {
      this.masterPermissions = data;
      console.log(this.masterPermissions);
      this.trackingService.addLog(this.trackingService.getnameComp(),'Get Registro en Permisos Maestros', 'Menu Administracion Permisos Maestros',  this.trackingService.getEmail());
    });

    // Obtener permisos del usuario
    this.permissionService.getUserPermissions(this.selectedUserId).subscribe((data: any) => {
      this.userPermissions = data.map((perm: any) => perm.permissionId);
      console.log(data);
    });
  }

  // Verificar si un permiso está seleccionado
  isPermissionChecked(permissionId: number): boolean {
    return this.userPermissions.includes(permissionId);
  }

  // Manejar la selección/deselección de un permiso individual
  togglePermission(permissionId: number) {
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
    const ids: number[] = (master.detailedPermissions ?? []).map((d: any) => d.id);
    ids.forEach(id => { if (!this.userPermissions.includes(id)) this.userPermissions.push(id); });
    this.savePermissions('Activar todos en ' + master.permissionName);
  }

  // Desactivar todos los permisos de un grupo
  disableAllInMaster(master: any) {
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
    this.permissionService
      .updateUserPermissions(this.selectedUserId, this.userPermissions)
      .pipe(tap(() => alerts.basicAlert('Mensaje', 'Permisos actualizados correctamente.', 'success')))
      .subscribe();
  }
}
