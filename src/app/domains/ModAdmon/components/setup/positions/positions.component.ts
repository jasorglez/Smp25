

import { CommonModule } from '@angular/common';
import { Component, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdministrationService } from 'app/services/administration.service';
import { SignalsService } from 'app/services/signals.service';
import { alerts } from 'app/helpers/alerts';
import { TrackingService } from 'app/services/tracking.service';
import { AuthService } from 'app/services/auth.service';

@Component({
  selector: 'app-positions',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './positions.component.html',
  styleUrl: './positions.component.scss',
})
export class PositionsComponent {
  private signalsService = inject(SignalsService);
  private administrationService = inject(AdministrationService);
  private trackingService = inject(TrackingService);
  authService = inject(AuthService);
  
  idRoot: number = null;
  setupData: any = {};
  fiscalRegimes: any = [];
  newData: boolean;

  private getDefaultSetupData(): any {
    return {
      directorName: '',
      directorTitle: 'DIRECTOR',
      gerencyName: '',
      gerencyTitle: 'GERENCIA',
      administratorName: '',
      administratorTitle: 'ADMINISTRACION',
      operatorName: '',
      operatorTitle: 'OPERACION',
      consecutiveReceipt: 1,
      consecutiveCreditNote: 1,
      iva: 0
    };
  }

  ngOnInit() {
    this.idRoot = this.signalsService.getRootSelectedBySidebar()();
    this.getSetupManagementData();
  }

  constructor() {
    effect(() => {
      this.idRoot = this.signalsService.getRootSelectedBySidebar()();
      this.getSetupManagementData();
    });
  }

  getSetupManagementData() {
    this.administrationService
      .getSetupManagementInfo(this.idRoot)
      .subscribe({
        next: (data: any) => {
          this.setupData = { ...this.getDefaultSetupData(), ...(data[0] || {}) };
          this.newData = false;
          this.trackingService.addLog(this.trackingService.getnameComp(),'Get Registro en Posiciones', 'Menu Administracion Posiciones',  this.trackingService.getEmail());
        },
        error: (err) => {
          if (err.status === 404) {
            this.setupData = this.getDefaultSetupData();
            this.newData = true;
          }
        }
      });
  }

  saveChanges() {
    if (this.newData) {
      // Si no hay datos, hacer POST
      this.setupData.idRoot = this.idRoot; // Agregar idRoot al objeto
      console.log('Datos enviados a addSetupManagementInfo:', this.setupData);
      this.administrationService.addSetupManagementInfo(this.setupData)
        .subscribe({
          next: () => {
            alerts.basicAlert("Actualización", "Los datos fueron guardados exitosamente.", "success");
            this.getSetupManagementData(); // Refrescar datos
            this.trackingService.addLog(this.trackingService.getnameComp(),'Add Registro en Posiciones', 'Menu Administracion Posiciones',  this.trackingService.getEmail());
            this.newData = false;
          },
          error: (err) => {
            alerts.basicAlert("Error", "Error al actualizar los datos.", "error");
          }
        });
    } else {
      // Si hay datos, hacer PUT
      this.administrationService.updateSetupManagementInfo(this.idRoot, this.setupData)
        .subscribe({
          next: () => {
            alerts.basicAlert("Actualización", "Los datos fueron guardados exitosamente.", "success");
            this.trackingService.addLog(this.trackingService.getnameComp(),'Update Registro en Posiciones', 'Menu Administracion Posiciones',  this.trackingService.getEmail());
            this.getSetupManagementData(); // Refrescar datos
          },
          error: (err) => {
            alerts.basicAlert("Error", "Error al actualizar los datos.", "error");
          }
        });
    }
  }

  revertChanges() {
    this.getSetupManagementData();
  }
}
