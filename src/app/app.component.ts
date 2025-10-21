import { Component, effect, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import {AuthService} from "./services/auth.service";
import { SignalsService } from './services/signals.service';


@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: '<router-outlet></router-outlet>',
})
export class AppComponent implements OnInit {
  title = 'bi-aug-24';
  private lastLoadedBranchId: number | null = null; // Variable para rastrear la última sucursal cargada

  private authService = inject(AuthService);
  private signalsService = inject(SignalsService);

  constructor() {
    effect(() => {
      const email = localStorage.getItem('mail');
      const isAdvanced = this.signalsService.getIsAdvanced();
      const idBranch = this.signalsService.getBranchSelectedBySidebar()();

      // --- INICIO DE LA SOLUCIÓN ---
      // Si es un usuario avanzado y la sucursal ha cambiado,
      // reseteamos los permisos para forzar la recarga.
      if (isAdvanced && idBranch !== this.lastLoadedBranchId) {
        this.authService.setUserPermissions(null);
      }
      // --- FIN DE LA SOLUCIÓN ---

      // Solo cargamos permisos si tenemos el email y, en caso de ser avanzado, el idBranch.
      if (email && (!isAdvanced || (isAdvanced && idBranch))) {
        this.loadPermissions(email, isAdvanced, idBranch);
      }
    });
  }

  ngOnInit() {
    // ngOnInit puede permanecer vacío o usarse para otra lógica inicial que no dependa de estos signals.
  }

  private loadPermissions(email: string, isAdvanced: boolean, idBranch: number | null) {
    // --- INICIO DE LA SOLUCIÓN ---
    // Si los permisos ya existen en el servicio, no los volvemos a cargar.
    // Esto evita que se sobrescriban los permisos establecidos durante el login.
    if (this.authService.getUserPermissions() && Object.keys(this.authService.getUserPermissions()).length > 0) {
      // Si no es avanzado, o si es avanzado y la sucursal no ha cambiado, no hacemos nada.
      if (!isAdvanced || (isAdvanced && idBranch === this.lastLoadedBranchId)) {
      return;
    }
    }
    // --- FIN DE LA SOLUCIÓN ---
    //alert('Carga desde app component' + idBranch)
    this.authService.getUserId(email).subscribe((userId) => {
      const permissions$ = isAdvanced
        ? this.authService.fetchUserPermissionsAdvanced(userId, idBranch)
        : this.authService.fetchUserPermissions(userId);
 
      permissions$.subscribe({
        next: (data: any) => {
          this.authService.setUserPermissions(data.permissions);
          this.lastLoadedBranchId = idBranch; // Actualizamos la última sucursal cargada
        },
        error: (error) => console.error('Error fetching user permissions:', error),
      });
    });
  }
}
