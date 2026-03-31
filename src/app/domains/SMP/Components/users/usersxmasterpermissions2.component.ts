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
import { AuthService } from 'app/services/auth.service';
import { lastValueFrom } from 'rxjs';

@Component({
  selector: 'app-usersxmasterpermissions2',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, UsersProfileComponent],
  templateUrl: './usersxmasterpermissions2.component.html',
  styleUrl: './usersxmasterpermissions2.component.scss',
})

export class UsersxMasterPermissions2Component {
  masterPermissions: any[] = []; // Almacena los permisos maestros
  userPermissions: number[] = []; // Almacena los IDs de los permisos del usuario
  selectedUserId: number; // Cambia esto según el usuario seleccionado
  idEmpresa: number;

  private permissionService = inject(MasterPermissions2Service);
  private signalsService = inject(SignalsService);
  private trackingService = inject(TrackingService);
  private authService = inject(AuthService);
  
  profile = computed(() => this.signalsService.profile);

  ngOnInit(): void {
    this.loadPermissions();
  }

  constructor() {
    effect(() => {
      this.selectedUserId = Number(this.signalsService.profile.idUser());
      this.idEmpresa = this.signalsService.getRootSelectedBySidebar()();
      this.signalsService.guardRefreshTick(); // Recargar cuando el modal guarda permisos del mismo usuario
      this.loadPermissions();
    });
  }

  // Cargar los permisos maestros y los permisos del usuario
  loadPermissions() {
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

  // Manejar la selección/deselección de un permiso
  togglePermission(permissionId: number) {
    
    if (this.isPermissionChecked(permissionId)) {
      // Si el permiso ya está seleccionado, lo quitamos
      this.trackingService.addLog(this.trackingService.getnameComp(),'Remove Permiso de Usuario en Permisos Maestros', 'Menu Administracion Permisos Maestros',  this.trackingService.getEmail());
      this.userPermissions = this.userPermissions.filter((id) => id !== permissionId);
    } else {
      // Si el permiso no está seleccionado, lo agregamos
      this.trackingService.addLog(this.trackingService.getnameComp(),'Add Permiso de Usuario en Permisos Maestros', 'Menu Administracion Permisos Maestros',  this.trackingService.getEmail());
      this.userPermissions.push(permissionId);
    }

    // Actualizar los permisos del usuario en el backend
    this.permissionService
      .updateUserPermissions(this.selectedUserId, this.userPermissions)
      .pipe(
        tap(async () => {
          console.log('Permisos actualizados correctamente');
          alerts.basicAlert('Mensaje', 'Se ha cambiado correctamente el permiso.', 'success');
          // Refrescar el menú lateral (pestañas Sucursales, Empresas, etc.) usando el guard básico
          try {
            await lastValueFrom(
              this.authService.reloadCurrentSessionGuard({ preferUserSystemGuard: true })
            );
          } catch (err) {
            console.error('Error al refrescar permisos del menú tras Permisos Maestros', err);
          }
        })
      )
      .subscribe();
  }
}
