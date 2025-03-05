

import { CommonModule } from '@angular/common';
import { Component, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdministrationService } from 'app/services/administration.service';
import { SignalsService } from 'app/services/signals.service';
import { alerts } from 'app/helpers/alerts';

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

  idRoot: number = null;
  setupData: any = {};
  fiscalRegimes: any = [];
  newData: boolean;

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
          this.setupData = data[0] || {};
          this.newData = false;
        },
        error: (err) => {
          if (err.status === 404) {
            this.setupData = {}; // Inicializar objeto vacío si no hay datos
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
