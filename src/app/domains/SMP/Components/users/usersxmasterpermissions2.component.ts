import { Component, computed, effect, inject } from '@angular/core';
import { AgGridModule } from 'ag-grid-angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { alerts } from 'app/helpers/alerts';
import { UsersProfileComponent } from './users-profile.component';
import { SignalsService } from 'app/services/signals.service';
import { MasterPermissions2Service } from 'app/services/master-permissions-2.service';
import { tap } from 'rxjs/operators';

@Component({
  selector: 'app-usersxmasterpermissions2',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, UsersProfileComponent],
  templateUrl: './usersxmasterpermissions2.component.html',
  styles: [
    ``
  ]
})

export class UsersxMasterPermissions2Component {
  masterPermissions: any[] = []; // Almacena los permisos maestros
  userPermissions: number[] = []; // Almacena los IDs de los permisos del usuario
  selectedUserId: number; // Cambia esto según el usuario seleccionado
  private permissionService = inject(MasterPermissions2Service);
  private signalsService = inject(SignalsService);

  profile = computed(() => this.signalsService.profile);

  ngOnInit(): void {
    this.loadPermissions();
  }

  constructor() {
    effect(() => {
      this.selectedUserId = Number(this.signalsService.profile.idUser());
      this.loadPermissions();
    });
  }

  // Cargar los permisos maestros y los permisos del usuario
  loadPermissions() {
    // Obtener permisos maestros
    this.permissionService.getMasterPermissions().subscribe((data: any) => {
      this.masterPermissions = data;
      console.log(this.masterPermissions);
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
      this.userPermissions = this.userPermissions.filter((id) => id !== permissionId);
    } else {
      // Si el permiso no está seleccionado, lo agregamos
      this.userPermissions.push(permissionId);
    }

    // Actualizar los permisos del usuario en el backend
    this.permissionService
      .updateUserPermissions(this.selectedUserId, this.userPermissions)
      .pipe(
        tap(() => {
          console.log('Permisos actualizados correctamente');
          alerts.basicAlert('Mensaje', 'Se ha cambiado correctamente el permiso.', 'success');
        })
      )
      .subscribe(); // Solo suscribirse sin manejar el resultado aquí
  }
}
