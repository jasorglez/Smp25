

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

  private readonly requiredFields = [
    { key: 'directorName', label: 'Nombre de dirección' },
    { key: 'directorTitle', label: 'Título de dirección' },
    { key: 'gerencyName', label: 'Nombre de gerencia' },
    { key: 'gerencyTitle', label: 'Título de gerencia' },
    { key: 'administratorName', label: 'Nombre de administración' },
    { key: 'administratorTitle', label: 'Título de administración' },
    { key: 'operatorName', label: 'Nombre de operación' },
    { key: 'operatorTitle', label: 'Título de operación' },
    { key: 'consecutiveReceipt', label: 'Consecutivo Recibo' },
    { key: 'consecutiveCreditNote', label: 'Consecutivo Nota de Crédito' },
    { key: 'iva', label: 'IVA' }
  ];

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
    if (!this.validateRequiredFields()) {
      return;
    }

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
            alerts.basicAlert('No fue posible guardar', this.getErrorMessage(err), 'error');
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
            alerts.basicAlert('No fue posible guardar', this.getErrorMessage(err), 'error');
          }
        });
    }
  }

  private validateRequiredFields(): boolean {
    const missingFields = this.requiredFields.filter(({ key }) => {
      const value = this.setupData[key];
      return value === null || value === undefined || (typeof value === 'string' && !value.trim());
    });

    if (!this.idRoot) {
      alerts.basicAlert('No fue posible guardar', 'Seleccione una empresa antes de guardar la configuración.', 'warning');
      return false;
    }

    if (missingFields.length === 0) {
      return true;
    }

    const fieldNames = missingFields.map(({ label }) => label).join(', ');
    alerts.basicAlert(
      'Campos obligatorios pendientes',
      `Complete los siguientes campos: ${fieldNames}.`,
      'warning'
    );
    document.getElementById(missingFields[0].key)?.focus();
    return false;
  }

  private getErrorMessage(err: any): string {
    const validationErrors = err?.error?.errors;
    if (validationErrors && typeof validationErrors === 'object') {
      const details = Object.entries(validationErrors)
        .flatMap(([field, messages]: [string, any]) => {
          const text = Array.isArray(messages) ? messages.join(', ') : String(messages);
          return `${this.getFieldLabel(field)}: ${text}`;
        });
      if (details.length) {
        return details.join(' | ');
      }
    }

    return err?.error?.message
      || err?.error?.error
      || (typeof err?.error === 'string' ? err.error : null)
      || err?.message
      || 'Ocurrió un problema inesperado al guardar. Intente nuevamente.';
  }

  private getFieldLabel(field: string): string {
    const normalizedField = field.split('.').pop()?.toLowerCase();
    return this.requiredFields.find(({ key }) => key.toLowerCase() === normalizedField)?.label || field;
  }

  revertChanges() {
    this.getSetupManagementData();
  }
}
