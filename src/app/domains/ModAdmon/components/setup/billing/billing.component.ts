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
  cerFile: File | null = null;
  keyFile: File | null = null;
  certificateStatus: any = {};

  ngOnInit() {
    this.idRoot = this.signalsService.getRootSelectedBySidebar()();
    console.log('ngOnInit - idRoot:', this.idRoot);
    this.getFiscalRegimes();
    this.getBillingManagementData();
  }

  constructor() {
    effect(() => {
      const newIdRoot = this.signalsService.getRootSelectedBySidebar()();
      console.log('effect triggered - newIdRoot:', newIdRoot, 'currentIdRoot:', this.idRoot);
      if (newIdRoot && newIdRoot !== this.idRoot) {
        this.idRoot = newIdRoot;
        this.getBillingManagementData();
      }
    });
  }

  getBillingManagementData() {
    if (!this.idRoot) {
      console.log('getBillingManagementData - idRoot is null, skipping');
      return;
    }

    console.log('getBillingManagementData - calling API with idRoot:', this.idRoot);
    this.administrationService
      .getBillingManagementInfo(this.idRoot)
      .subscribe({
        next: (data: any) => {
          console.log('getBillingManagementData - received data:', data);
          this.billingData = data[0] || {};
          console.log('getBillingManagementData - billingData after assignment:', this.billingData);

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
          // Ensure emisor fields are handled
          if (!this.billingData.emisorRfc) {
            this.billingData.emisorRfc = '';
          }
          if (!this.billingData.emisorNombre) {
            this.billingData.emisorNombre = '';
          }
          if (!this.billingData.emisorCp) {
            this.billingData.emisorCp = '';
          }
          this.newData = false;
          console.log('getBillingManagementData - final billingData:', this.billingData);
          this.trackingService.addLog(this.trackingService.getnameComp(),'Get Registro en Facturación', 'Menu Administracion Facturación',  this.trackingService.getEmail());
          this.checkCertificateStatus();
        },
        error: (err) => {
          console.log('getBillingManagementData - error:', err);
          if (err.status === 404) {
            this.billingData = {}; // Inicializar objeto vacío si no hay datos
            this.newData = true;
            this.certificateStatus = {};
          }
        }
      });
  }

  getFiscalRegimes() {
    console.log('getFiscalRegimes - calling API');
    this.administrationService
      .getFiscalRegimes()
      .subscribe({
        next: (data: any) => {
          this.fiscalRegimes = data;
          console.log('getFiscalRegimes - received data:', this.fiscalRegimes);
        },
        error: (err) => {
          console.error('getFiscalRegimes - error:', err);
        }
      });
  }

  checkCertificateStatus() {
    this.administrationService
      .checkCertificates(this.idRoot)
      .subscribe({
        next: (data: any) => {
          this.certificateStatus = data;
          console.log('Certificate status:', this.certificateStatus);
        },
        error: (err) => {
          console.error('Error checking certificates:', err);
          this.certificateStatus = {};
        }
      });
  }

  saveChanges() {
    console.log('Saving changes, cerFile:', this.cerFile, 'keyFile:', this.keyFile);
    if (this.cerFile || this.keyFile) {
      console.log('Uploading files');
      const formData = new FormData();
      if (this.cerFile) formData.append('CerFile', this.cerFile);
      if (this.keyFile) formData.append('KeyFile', this.keyFile);

      this.administrationService.uploadCertificates(this.idRoot, formData)
        .subscribe({
          next: (response: any) => {
            console.log('Upload success:', response);
            if (response.message) {
              alerts.basicAlert("Éxito", response.message, "success");
            }
            this.saveConfig();
          },
          error: (err) => {
            console.log('Upload error:', err);
            alerts.basicAlert("Error", "Error al subir certificados.", "error");
          }
        });
    } else {
      this.saveConfig();
    }
  }

  saveConfig() {
    if (this.newData) {
      this.billingData.idRoot = this.idRoot;
      console.log('Datos enviados a addBillingManagementInfo:', this.billingData);
      this.administrationService.addBillingManagementInfo(this.billingData)
        .subscribe({
          next: () => {
            alerts.basicAlert("Actualización", "Los datos fueron guardados exitosamente.", "success");
            this.getBillingManagementData();
            this.newData = false;
            this.checkCertificateStatus();
            this.trackingService.addLog(this.trackingService.getnameComp(),'Add Registro en Facturación', 'Menu Administracion Facturación',  this.trackingService.getEmail());
          },
          error: (err) => {
            alerts.basicAlert("Error", "Error al actualizar los datos.", "error");
          }
        });
    } else {
      // Create a copy without file fields to avoid overwriting them
      const dataToUpdate = { ...this.billingData };
      delete dataToUpdate.CerFileContent;
      delete dataToUpdate.KeyFileContent;
      this.administrationService.updateBillingManagement(this.idRoot, dataToUpdate)
        .subscribe({
          next: () => {
            alerts.basicAlert("Actualización", "Los datos fueron guardados exitosamente.", "success");
            this.getBillingManagementData();
            this.checkCertificateStatus();
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
      this.cerFile = file;

      // Leer el archivo .cer
      const reader = new FileReader();
      reader.onload = (e: any) => {
        try {
          const certData = e.target.result as ArrayBuffer;
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
  private parseCert(certData: ArrayBuffer): { validFrom: string, validTo: string } {
    const asn1 = asn1js.fromBER(certData);
    const cert = new pkijs.Certificate({ schema: asn1.result });

    // Convertir fechas a formato YYYY-MM-DD
    const validFrom = cert.notBefore.value.toISOString().split('T')[0];
    const validTo = cert.notAfter.value.toISOString().split('T')[0];

    return { validFrom, validTo };
  }

  onKeyFileSelected(event: any) {
    const file: File = event.target.files[0];
    if (file) {
      this.keyFile = file;
    }
  }

}
