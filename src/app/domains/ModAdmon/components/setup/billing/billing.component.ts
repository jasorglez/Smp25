import { CommonModule } from '@angular/common';
import { Component, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdministrationService } from 'app/services/administration.service';
import { SignalsService } from 'app/services/signals.service';
import { alerts } from 'app/helpers/alerts';
import * as asn1js from 'asn1js';
import * as pkijs from 'pkijs';
import { TrackingService } from 'app/services/tracking.service';

@Component({
  selector: 'app-billing',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './billing.component.html',
  styleUrl: './billing.component.scss'
})
export class BillingComponent {
  private signalsService = inject(SignalsService);
  private administrationService = inject(AdministrationService);
  private trackingService = inject(TrackingService);
  idRoot: number = null;
  billingData: any = {};
  fiscalRegimes: any = [];
  newData: boolean;

  ngOnInit() {
    this.idRoot = this.signalsService.getRootSelectedBySidebar()();
    this.getBillingManagementData();
    this.getFiscalRegimes();
  }

  constructor() {
    effect(() => {
      this.idRoot = this.signalsService.getRootSelectedBySidebar()();
      this.getBillingManagementData();
      this.getFiscalRegimes();
    });
  }

  getBillingManagementData() {
    this.administrationService
      .getBillingManagementInfo(this.idRoot)
      .subscribe({
        next: (data: any) => {
          this.billingData = data[0] || {};
          if (this.billingData.fiscalRegime) {
            this.billingData.fiscalRegime = Number(this.billingData.fiscalRegime);
          }
          // Convertir fechas a formato YYYY-MM-DD si existen
          if (this.billingData.dateStart) {
            this.billingData.dateStart = this.billingData.dateStart.split('T')[0];
          }
          if (this.billingData.dateEnd) {
            this.billingData.dateEnd = this.billingData.dateEnd.split('T')[0];
          }
          this.newData = false;
          console.log(this.billingData)
          this.trackingService.addLog(this.trackingService.getnameComp(),'Get Registro en Facturación', 'Menu Administracion Facturación',  this.trackingService.getEmail());
        },
        error: (err) => {
          if (err.status === 404) {
            this.billingData = {}; // Inicializar objeto vacío si no hay datos
            this.newData = true;
          }
        }
      });
  }

  getFiscalRegimes() {
    this.administrationService
      .getFiscalRegimes()
      .subscribe({
        next: (data: any) => {
          this.fiscalRegimes = data;
          console.log(this.fiscalRegimes);
        },
        error: (err) => {
          console.error(err);
        }
      });
  }

  saveChanges() {
    if (this.newData) {
      // Si no hay datos, hacer POST
      this.billingData.idRoot = this.idRoot; // Agregar idRoot al objeto
      console.log('Datos enviados a addBillingManagementInfo:', this.billingData);
      this.administrationService.addBillingManagementInfo(this.billingData)
        .subscribe({
          next: () => {
            alerts.basicAlert("Actualización", "Los datos fueron guardados exitosamente.", "success");
            this.getBillingManagementData(); // Refrescar datos
            this.newData = false;
            this.trackingService.addLog(this.trackingService.getnameComp(),'Add Registro en Facturación', 'Menu Administracion Facturación',  this.trackingService.getEmail());
          },
          error: (err) => {
            alerts.basicAlert("Error", "Error al actualizar los datos.", "error");
          }
        });
    } else {
      // Si hay datos, hacer PUT
      this.administrationService.updateBillingManagementInfo(this.idRoot, this.billingData)
        .subscribe({
          next: () => {
            alerts.basicAlert("Actualización", "Los datos fueron guardados exitosamente.", "success");
            this.getBillingManagementData(); // Refrescar datos
            this.trackingService.addLog(this.trackingService.getnameComp(),'Update Registro en Facturación', 'Menu Administracion Facturación',  this.trackingService.getEmail());
          },
          error: (err) => {
            alerts.basicAlert("Error", "Error al actualizar los datos.", "error");
          }
        });
    }
  }

  revertChanges() {
    this.getBillingManagementData();
    this.trackingService.addLog(this.trackingService.getnameComp(),'Revertir Registro en Facturación', 'Menu Administracion Facturación',  this.trackingService.getEmail());
  }

  onCerFileSelected(event: any) {
    const file: File = event.target.files[0];
    if (file) {
      this.billingData.pathCer = file.name;
      
      // Leer el archivo .cer
      const reader = new FileReader();
      reader.onload = (e: any) => {
        try {
          const certData = new Uint8Array(e.target.result);
          const cert = this.parseCert(certData);
          
          // Asignar las fechas al formulario
          this.billingData.dateStart = cert.validFrom;
          this.billingData.dateEnd = cert.validTo;
        } catch (error) {
          console.error('Error al leer el certificado:', error);
          alerts.basicAlert("Error", "No se pudo leer el certificado. Asegúrese de que es un archivo .cer válido.", "error");
        }
      };
      reader.readAsArrayBuffer(file);
    }
  }

  // Método para parsear el certificado
  private parseCert(certData: Uint8Array): { validFrom: string, validTo: string } {
    const asn1 = asn1js.fromBER(certData.buffer);
    const cert = new pkijs.Certificate({ schema: asn1.result });
    
    // Convertir fechas a formato YYYY-MM-DD
    const validFrom = cert.notBefore.value.toISOString().split('T')[0];
    const validTo = cert.notAfter.value.toISOString().split('T')[0];
    
    return { validFrom, validTo };
  }

  onKeyFileSelected(event: any) {
    const file: File = event.target.files[0];
    if (file) {
      this.billingData.pathKey = file.name;
    }
  }

}
