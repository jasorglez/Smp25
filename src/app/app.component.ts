import { Component, effect, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import {AuthService} from "./services/auth.service";
import { SignalsService } from './services/signals.service';
import { ChatbotComponent } from './shared/chatbot/chatbot.component';


@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ChatbotComponent],
  template: '<router-outlet></router-outlet><app-chatbot></app-chatbot>',
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
    // Si el token expiró, cerrar sesión inmediatamente sin hacer llamadas al backend
    if (this.authService.isTokenExpired()) {
      this.authService.logout();
      return;
    }

    // Si los permisos ya existen y no han cambiado las condiciones, no recargar.
    if (this.authService.getUserPermissions() && Object.keys(this.authService.getUserPermissions()).length > 0) {
      if (!isAdvanced || (isAdvanced && idBranch === this.lastLoadedBranchId)) {
        return;
      }
    }

    this.authService.getUserId(email).subscribe((userId) => {
      if (isAdvanced && idBranch > 0) {
        // Intentar cargar permisos avanzados por sucursal
        this.authService.fetchUserPermissionsAdvanced(userId, idBranch).subscribe({
          next: (data: any) => {
            const perms = data.permissions;
            if (perms && Object.keys(perms).length > 0) {
              // Tiene permisos CRUD detallados para esta sucursal
              this.authService.setUserPermissions(perms);
            } else {
              // No tiene CrudPremissions para esta sucursal, usar permisos básicos
              this.authService.fetchUserPermissions(userId).subscribe({
                next: (basicData: any) => {
                  this.authService.setUserPermissions(basicData.permissions);
                },
                error: (error) => console.error('Error fetching basic permissions:', error),
              });
            }
            this.lastLoadedBranchId = idBranch;
          },
          error: (error) => console.error('Error fetching advanced permissions:', error),
        });
      } else {
        // No avanzado o "Todas las sucursales" (idBranch negativo): usar permisos básicos
        this.authService.fetchUserPermissions(userId).subscribe({
          next: (data: any) => {
            this.authService.setUserPermissions(data.permissions);
            this.lastLoadedBranchId = idBranch;
          },
          error: (error) => console.error('Error fetching user permissions:', error),
        });
      }
    });
  }
}
