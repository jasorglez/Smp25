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

          if (data && data.length > 0) {
            // Crear nuevo objeto con todos los campos
            const record = data[0];

            this.billingData = {
              id: record.id,
              idRoot: record.idRoot,
              emisorRfc: record.emisorRfc || '',
              emisorNombre: record.emisorNombre || '',
              emisorCp: record.emisorCp || '',
              fiscalYear: record.fiscalYear,
              fiscalRegime: record.fiscalRegime ? Number(record.fiscalRegime) : null,
              prefix: record.prefix || '',
              consecutive: record.consecutive,
              iIva: record.iIva,
              iIeps: record.iIeps,
              iI3: record.iI3,
              rIva: record.rIva,
              rIeps: record.rIeps,
              efirmaPass: record.efirmaPass || '',
              dateStart: record.dateStart ? record.dateStart.split('T')[0] : '',
              dateEnd: record.dateEnd ? record.dateEnd.split('T')[0] : '',
              cerFileContent: record.cerFileContent,
              keyFileContent: record.keyFileContent,
              active: record.active
            };

            this.newData = false;
            console.log('getBillingManagementData - final billingData:', this.billingData);
          } else {
            this.billingData = {};
            this.newData = true;
          }

          this.trackingService.addLog(this.trackingService.getnameComp(),'Get Registro en Facturación', 'Menu Administracion Facturación',  this.trackingService.getEmail());
          this.checkCertificateStatus();
        },
        error: (err) => {
          console.log('getBillingManagementData - error:', err);
          if (err.status === 404) {
            this.billingData = {
              emisorRfc: '',
              emisorNombre: '',
              emisorCp: '',
              prefix: '',
              efirmaPass: '',
              dateStart: '',
              dateEnd: ''
            };
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



// En billing.component.ts - Modifica el método saveChanges()

saveChanges() {
  console.log('Saving changes, cerFile:', this.cerFile, 'keyFile:', this.keyFile);
  
  // Si hay archivos para subir/actualizar
  if (this.cerFile || this.keyFile) {
    console.log('Processing certificate files');
    const formData = new FormData();
    if (this.cerFile) formData.append('CerFile', this.cerFile);
    if (this.keyFile) formData.append('KeyFile', this.keyFile);

    // Decidir si es subida inicial o actualización
    const uploadMethod = this.certificateStatus.certificateConfigured || this.certificateStatus.keyConfigured 
      ? this.administrationService.updateCertificates.bind(this.administrationService)
      : this.administrationService.uploadCertificates.bind(this.administrationService);

    uploadMethod(this.idRoot, formData)
      .subscribe({
        next: (response: any) => {
          console.log('Certificate operation success:', response);
          if (response.message) {
            alerts.basicAlert("Éxito", response.message, "success");
          }
          // Limpiar los archivos seleccionados después de subir/actualizar
          this.cerFile = null;
          this.keyFile = null;
          this.clearFileInputs();
          this.saveConfig();
        },
        error: (err) => {
          console.log('Certificate operation error:', err);
          const errorMessage = err.error?.message || "Error al procesar los certificados.";
          alerts.basicAlert("Error", errorMessage, "error");
        }
      });
  } else {
    this.saveConfig();
  }
}

// Método para limpiar los inputs de archivo
clearFileInputs() {
  const cerInput = document.getElementById('pathCer') as HTMLInputElement;
  const keyInput = document.getElementById('pathKey') as HTMLInputElement;
  if (cerInput) cerInput.value = '';
  if (keyInput) keyInput.value = '';
}

// Modifica onCerFileSelected para mejor feedback
onCerFileSelected(event: any) {
  const file: File = event.target.files[0];
  if (file) {
    // Validar tamaño (5MB máximo)
    if (file.size > 5 * 1024 * 1024) {
      alerts.basicAlert("Error", "El archivo .cer no debe exceder 5MB", "error");
      event.target.value = '';
      return;
    }

    // Validar extensión
    if (!file.name.toLowerCase().endsWith('.cer')) {
      alerts.basicAlert("Error", "El archivo debe tener extensión .cer", "error");
      event.target.value = '';
      return;
    }

    this.cerFile = file;
    console.log('Cer file selected:', file.name, 'Size:', file.size);

    // Leer el archivo .cer para extraer fechas
    const reader = new FileReader();
    reader.onload = (e: any) => {
      try {
        const certData = e.target.result as ArrayBuffer;
        const cert = this.parseCert(certData);

        // Asignar las fechas al formulario
        this.billingData.dateStart = cert.validFrom;
        this.billingData.dateEnd = cert.validTo;
        
        console.log('Certificate dates extracted:', cert.validFrom, 'to', cert.validTo);
      } catch (error) {
        console.error('Error al leer el certificado:', error);
        alerts.basicAlert("Advertencia", "No se pudieron extraer las fechas del certificado. Verifique que sea un archivo .cer válido.", "warning");
      }
    };
    reader.readAsArrayBuffer(file);
  }
}

onKeyFileSelected(event: any) {
  const file: File = event.target.files[0];
  if (file) {
    // Validar tamaño (5MB máximo)
    if (file.size > 5 * 1024 * 1024) {
      alerts.basicAlert("Error", "El archivo .key no debe exceder 5MB", "error");
      event.target.value = '';
      return;
    }

    // Validar extensión
    if (!file.name.toLowerCase().endsWith('.key')) {
      alerts.basicAlert("Error", "El archivo debe tener extensión .key", "error");
      event.target.value = '';
      return;
    }

    this.keyFile = file;
    console.log('Key file selected:', file.name, 'Size:', file.size);
  }
}


  validateRfc() {
    const rfc = this.billingData.emisorRfc;
    const fiscalRegime = this.billingData.fiscalRegime;
    const moralRegimes = [601, 603, 610, 620, 622, 623, 624, 626];
    const fisicaRegimes = [605, 606, 607, 608, 610, 611, 612, 614, 615, 616, 621, 625, 626];
    
    if (!rfc) return true;

    // Validar longitud del RFC
    if (rfc.length < 12 || rfc.length > 13) {
      alerts.basicAlert("Error", "El RFC debe tener entre 12 y 13 caracteres", "error");
      return false;
    }

    // Validar régimen fiscal para personas morales
    if (fiscalRegime && moralRegimes.includes(Number(fiscalRegime)) && rfc.length !== 12) {
      alerts.basicAlert("Error", "Para el régimen fiscal seleccionado (Persona Moral), el RFC debe tener exactamente 12 caracteres", "error");
      return false;
    }

    // Validar régimen fiscal para personas físicas
    if (fiscalRegime && fisicaRegimes.includes(Number(fiscalRegime)) && rfc.length !== 13) {
      alerts.basicAlert("Error", "Para el régimen fiscal seleccionado (Persona Física), el RFC debe tener exactamente 13 caracteres", "error");
      return false;
    }

    return true;
  }

  onRfcBlur() {
    this.validateRfc();
  }

  onFiscalRegimeChange() {
    this.validateRfc();
  }

  saveConfig() {
    if (!this.validateRfc()) {
      return;
    }

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

 

  // Método para parsear el certificado
  private parseCert(certData: ArrayBuffer): { validFrom: string, validTo: string } {
    const asn1 = asn1js.fromBER(certData);
    const cert = new pkijs.Certificate({ schema: asn1.result });

    // Convertir fechas a formato YYYY-MM-DD
    const validFrom = cert.notBefore.value.toISOString().split('T')[0];
    const validTo = cert.notAfter.value.toISOString().split('T')[0];

    return { validFrom, validTo };
  }

getCertificateStatusMessage(): string {
  if (!this.certificateStatus.certificateConfigured && !this.certificateStatus.keyConfigured) {
    return 'Suba ambos archivos (.cer y .key) para completar la configuración.';
  } else if (this.certificateStatus.certificateConfigured && !this.certificateStatus.keyConfigured) {
    return 'Falta configurar el archivo .key.';
  } else if (!this.certificateStatus.certificateConfigured && this.certificateStatus.keyConfigured) {
    return 'Falta configurar el archivo .cer.';
  } else {
    return 'Ambos certificados están configurados correctamente.';
  }
}
 

}
