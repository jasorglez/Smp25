import { Component, effect, inject } from '@angular/core';
import { SignalsService } from 'app/services/signals.service';
import { CommonModule } from '@angular/common';
import { NgFor } from '@angular/common';
import { alerts } from 'app/helpers/alerts';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormControl } from '@angular/forms';
import { TrackingService } from 'app/services/tracking.service';
import { PayrollService } from 'app/services/payroll.service';
import { HRService } from 'app/services/hr.service';
import { NominaData } from '../../setup/models/payroll-data.module';
import { AdministrationService } from 'app/services/administration.service';
import * as XLSX from 'xlsx';

interface Bank {
  id: number;
  name: string;
  active: boolean;
}

@Component({
  selector: 'app-payroll',
  standalone: true,
  imports: [ NgFor, ReactiveFormsModule ],
  templateUrl: './payroll.component.html',
})
export class PayrollComponent {
  idBranch: number;
  private signalsService = inject(SignalsService); 
  private trackingService = inject(TrackingService);
  private hrService = inject(HRService);

  formBuilder = inject(FormBuilder);
  isLoading: boolean = false;
  error: string | null = null;
  jsonData: any = null;
  fileName: string = '';
  // Variable para controlar cómo se muestra el JSON
  prettyJson: boolean = false;
  hrData: any = {};
  newData: any = {};
  isNew: boolean = false;
  banks: Bank[] = [];
  selectedBankId: number | null = null;
  archivo: File;
  formData = new FormData();
  file: File;
  diasSemana = [
    'Lunes',
    'Martes',
    'Miércoles',
    'Jueves',
    'Viernes',
    'Sábado',
    'Domingo'
  ];

  constructor(private payrollService: PayrollService, private administrationService: AdministrationService) {
      effect(() => {
        this.idBranch = this.signalsService.getBranchSelectedBySidebar()();
        this.getData();
      });
  }

  myForm: FormGroup = this.formBuilder.group({
    startDay: ['', Validators.required, []],
    payrollPeriod: ['', [Validators.required, Validators.minLength(1)], []],
    overtimePay: ['', [Validators.required, Validators.minLength(1)], []],
    discount: ['', [Validators.required, Validators.minLength(1)], []],
    specialOvertimePay: ['', [Validators.required, Validators.minLength(1)], []],
  })
  

  getData() {
    this.hrService.getHRManagementData(this.idBranch).subscribe({
      next: (data: any) => {
        this.hrData = data[0] || {};
        console.log(this.hrData)
        this.myForm.patchValue({
          payrollPeriod: this.hrData.payrollPeriod,
          startDay: this.hrData.startDay,
          discount: this.hrData.discount,
          overtimePay: this.hrData.overtimePay,
          specialOvertimePay: this.hrData.specialOvertimePay
        });
        this.isNew = false;
      },
      error: (err) => {
        if (err.status === 404) {
          this.myForm.patchValue({
            payrollPeriod: null,
            startDay: null,
            discount: null,
            overtimePay: null,
            specialOvertimePay: null
            
          });
          this.isNew = true
        } else {
          console.error(err);
        }
      }
    });
  }
  onSubmit() {
    if (this.myForm.invalid) {
      alerts.basicAlert("Error", "Faltan datos por llenar", "error");
      return;
    }
  
    const values = this.myForm.value;
  
    this.hrData = {
      ...this.hrData, // conserva id u otros campos
      ...values       // actualiza con valores nuevos
    };
    console.log(this.isNew)
    if (!this.isNew) {
      // Actualizar datos existentes
      this.hrService.updateHRManagementData(this.idBranch, this.hrData).subscribe({
        next: () => {
          alerts.basicAlert("Actualización", "Los datos fueron guardados exitosamente", "success");
          this.getData(); // Refrescar datos
        },
        error: () => {
          alerts.basicAlert("Error", "Error al actualizar los datos.", "error");
        }
      });
      return;
    }else{
      const payload = {
        active: true,
        discount: values.discount,
        idBranch: this.idBranch,
        overtimePay: values.overtimePay,
        payrollPeriod: values.payrollPeriod,
        specialOvertimePay: values.specialOvertimePay,
        startDay: values.startDay,
      };
      console.log(payload)
    
      this.hrService.addHRManagementData(payload).subscribe({
        next: () => {
          alerts.basicAlert("Registro", "Los datos fueron guardados exitosamente", "success");
          this.getData(); // Refrescar datos
        },
        error: () => {
          alerts.basicAlert("Error", "Error al añadir los datos.", "error");
        }
      });
    
      this.isNew = false;
    }
    // Insertar nuevos datos
    
  }
  
  
  revertChanges() {
    this.getData();
  }

  obtenerBanks(): Promise<any> {
     return new Promise((resolve) => {
       this.administrationService.get2fieldsBanks().subscribe((data: any) => {
         this.banks = data;
         resolve(data);
       });
     });
   }
 
   onBankSelected() {
     console.log("Banco seleccionado ID:", this.selectedBankId);
     // Aquí puedes guardar el ID o hacer lo que necesites
   }
 
   async sendPayrollData() {
     // Tracking Log
     this.trackingService.addLog('', 'Envio de nomina digital','Configuracion Upload Nomina Digital','');
 
     //console.log("---------- SENDPAYROLLDATA() Bancos: --> ", this.banks);
 
 
     console.log("---------- SENDPAYROLLDATA() enviando datos de nómina --> ", this.jsonData);
 
     if (!this.jsonData) {
       alerts.basicAlert("Error", "No hay datos para enviar.", "error");
       return;
     };
 
     if (!Array.isArray(this.jsonData)) {
       this.formatNumericPropertiesToTwoDecimals(this.jsonData);
     }
     // En caso de que jsonData sea un array de objetos
     else {
       this.jsonData.forEach(item => {
         this.formatNumericPropertiesToTwoDecimals(item);
       });
     }
 
     // Agregar el ID del banco seleccionado
     //this.jsonData.IdBranch = this.selectedBankId;
 
     console.log("---------- SENDPAYROLLDATA() Datos formateados --> ", this.jsonData);
 
     //if (!this.selectedBankId) {
     //  alerts.basicAlert("Error", "Por favor seleccione un banco.", "error");
     //  return;
     //}
 
     // Asegúrate de que los bancos estén cargados
     //if (this.banks.length === 0) {
       //await this.obtenerBanks();
     //}
 
     // Añadir el ID del banco a los datos que envías
     //this.jsonData.IdBank = this.selectedBankId;
 
     this.jsonData.idBranch = this.idBranch;
 
     console.log("---------- SENDPAYROLLDATA() Datos a enviar con ID de banco --> ", this.jsonData);
     console.log("---------- SENDPAYROLLDATA() enviando datos de nómina con idBranch --> ", this.jsonData);
 
 
     this.payrollService.uploadPayrollData(this.jsonData).subscribe({
       next: (response) => {
         this.isLoading = true;
         alerts.basicAlert("Actualización", "Los datos fueron guardados exitosamente.", "success");
         console.log('-------------- uploadpayrollDATA() Respuesta del servidor servicio payroll:', response);
         console.log("---------------justo antes de subir el uplodadexcel: ", this.formData);
         this.payrollService.upLoadExcelFile(response, this.formData). subscribe({
           next: (response) => {
             this.isLoading = true;
             alerts.basicAlert("Actualización", "El archivo excel fue subido exitosamente!", "success");
             console.log('-------------- uploadpayrollDATA() Respuesta del servicio uploadexcelfile:', response);
             this.resetForm();
           }
         });
         this.resetForm();
       },
       error: (error) => console.error('Error al enviar los datos:', error)
     });
   }
 
   resetForm() {
     // Limpiar datos del archivo
     this.jsonData = null;
     this.fileName = '';
     this.formData = null;
     this.isLoading = false;
 
     // Limpiar el banco seleccionado
     //this.selectedBankId = null;
 
     // Limpiar el input file para que el usuario pueda seleccionar el mismo archivo si lo desea
     const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
     if (fileInput) {
       fileInput.value = '';
     }
     // Refrescar la vista
     this.getData();
   }
 
   formatNumericPropertiesToTwoDecimals(obj: any) {
     // Lista de propiedades que necesitan formatearse a 2 decimales
     const propertiesToFormat = [
       'IMSS', 'IMSSCesantiaVejez', 'IMSSEnfermedad', 'ISPT',
       'impuestoArt96', 'neto', 'otrosIngresos', 'pensionAlimenticia',
       'percepcionesGravadas', 'retencionesINFONAVIT', 'salarioDiario',
       'salarioDiarioIntegrado', 'subsidioArt114', 'subsidioPEmpleo',
       'subsidioPEmpleoAcreditado', 'sueldos', 'totalPercepciones'
     ];
 
     // Recorrer todas las propiedades que necesitan formato
     propertiesToFormat.forEach(prop => {
       if (obj[prop] != null && typeof obj[prop] === 'number') {
         // Convertir el valor a un número con 2 decimales
         obj[prop] = Number(obj[prop].toFixed(2));
       }
     });
 
     return obj;
   }

 
   saveChanges() {
     if (this.newData) {
       // Si no hay datos, hacer POST
       this.hrData.idBranch = this.idBranch; // Agregar idBranch al objeto
       console.log('Datos enviados a addBillingManagementInfo:', this.hrData);
       this.hrService.addHRManagementData(this.hrData)
         .subscribe({
           next: () => {
             alerts.basicAlert("Actualización", "Los datos fueron guardados exitosamente.", "success");
             this.getData(); // Refrescar datos
             this.newData = false;
           },
           error: (err) => {
             alerts.basicAlert("Error", "Error al actualizar los datos.", "error");
           }
         });
     } else {
       // Si hay datos, hacer PUT
       this.hrService.updateHRManagementData(this.idBranch, this.hrData)
         .subscribe({
           next: () => {
             alerts.basicAlert("Actualización", "Los datos fueron guardados exitosamente", "success");
             this.getData(); // Refrescar datos
           },
           error: (err) => {
             alerts.basicAlert("Error", "Error al actualizar los datos.", "error");
           }
         });
     }
   }

 
   onFileChange(event: Event): void {
     console.log("entrando a onFileChange");
     this.isLoading = true;
     this.error = null;
     this.jsonData = null;
 
     const target = event.target as HTMLInputElement;
     const files = target.files;
 
     // Verificamos que haya un archivo seleccionado
     if (!files || files.length !== 1) {
       this.error = 'Por favor selecciona un archivo.';
       this.isLoading = false;
       return;
     }
 
     const file: File = files[0];
     this.fileName = file.name;
     this.file = file;
     this.formData = new FormData();
     this.formData.append('archivo', this.file);
     console.log("nombre del archivo --> ", file);
     console.log("contenido de formData: ", this.formData);
 
 
     // Verificamos que sea un archivo Excel
     if (!this.isExcelFile(file)) {
       this.error = 'El archivo debe ser un Excel (.xlsx, .xls)';
       this.isLoading = false;
       return;
     }
 
     // Leemos el archivo como ArrayBuffer
     const reader: FileReader = new FileReader();
 
     reader.onload = (e: ProgressEvent<FileReader>) => {
       try {
         // Procesamos el archivo con XLSX
         const binaryString = e.target?.result;
         const workbook: XLSX.WorkBook = XLSX.read(binaryString, { type: 'binary' });
 
         // Procesamos el Excel de nómina específicamente
         const data = this.processNominaExcel(workbook);
         console.log("la data despues de procesar el archivo es --> ", data);
 
         // Asignamos los datos a nuestra variable para mostrarlos
         this.jsonData = data;
       } catch (error) {
         console.error('Error al procesar el archivo:', error);
         this.error = 'Error al procesar el archivo. Verifica que sea un Excel válido.';
       } finally {
         this.isLoading = false;
       }
 
       if (this.jsonData) {
         console.log("la data despues de procesar y sin errores es --> ", this.jsonData);
         console.log("aqui yq podemos enviar el archivo a guardar a BD --> ", this.jsonData.empleados);
         //this.sendPayrollData()
       }
     };
 
     reader.onerror = () => {
       this.error = 'Error al leer el archivo.';
       this.isLoading = false;
     };
 
     // Iniciamos la lectura del archivo
     reader.readAsBinaryString(file);
   }
 
   /**
    * Verifica si el archivo es un Excel válido
    */
   private isExcelFile(file: File): boolean {
     const allowedExtensions = ['.xlsx', '.xls'];
     const fileName = file.name.toLowerCase();
     return allowedExtensions.some(ext => fileName.endsWith(ext));
   }
 
   /**
    * Procesa el archivo Excel de nómina específicamente
    */
   private processNominaExcel(workbook: XLSX.WorkBook): any {
     // Tomamos la primera hoja
     const firstSheetName = workbook.SheetNames[0];
     const worksheet = workbook.Sheets[firstSheetName];
 
     //console.log("nombre de la hoja", firstSheetName);
     //console.log("nombre de worsheet", worksheet);
 
     // Creamos el objeto base para la nómina
     const nominaData: NominaData = {
       empresa: this.getCellValue(worksheet, 'B5') || '',
       periodo: this.getCellValue(worksheet, 'B6') || '',
       ejercicio: this.getCellValue(worksheet, 'B7') || '',
       archivo: this.archivo,
       archivoNombre: this.fileName,
       empleados: []
     };
 
     // Obtenemos el rango de celdas
     const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
 
     console.log("rango de empleados", range);
 
     // Procesamos cada fila a partir de la fila 11 (donde comienzan los datos de empleados)
     for (let rowNum = 10; rowNum <= range.e.r; rowNum++) {
       const nombre = this.getCellValue(worksheet, `B${rowNum}`);
       const idempleado = this.getNumericCellValue(worksheet, `C${rowNum}`);
 
       //console.log("fila", rowNum);
       //console.log("nombre del empleado", nombre);
 
       // Si no hay nombre, asumimos que es una fila vacía
       //if (!nombre || nombre.length < 2) continue;
       // Verificar si un nombre tiene caracteres no alfabéticos o es muy corto
       if (!nombre || !/^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]+$/.test(nombre)) continue;
 
       const empleado = {
         nombre: nombre,
         idEmpleado: idempleado,
         diasTrabajados: this.getNumericCellValue(worksheet, `D${rowNum}`),
         salarioDiarioIntegrado: this.getNumericCellValue(worksheet, `E${rowNum}`),
         salarioDiario: this.getNumericCellValue(worksheet, `F${rowNum}`),
         sueldos: this.getNumericCellValue(worksheet, `G${rowNum}`),
         totalPercepciones: this.getNumericCellValue(worksheet, `H${rowNum}`),
         otrosIngresos: this.getNumericCellValue(worksheet, `I${rowNum}`),
         percepcionesGravadas: this.getNumericCellValue(worksheet, `J${rowNum}`),
         impuestoArt96: this.getNumericCellValue(worksheet, `K${rowNum}`),
         subsidioArt114: this.getNumericCellValue(worksheet, `L${rowNum}`),
         totalSubsidioPEmpleoArt115: this.getNumericCellValue(worksheet, `M${rowNum}`),
         subsidioPEmpleoAcreditado: this.getNumericCellValue(worksheet, `N${rowNum}`),
         ISPT: this.getNumericCellValue(worksheet, `O${rowNum}`),
         subsidioPEmpleo: this.getNumericCellValue(worksheet, `P${rowNum}`),
         IMSSEnfermedad: this.getNumericCellValue(worksheet, `Q${rowNum}`),
         IMSSCesantiaVejez: this.getNumericCellValue(worksheet, `R${rowNum}`),
         IMSS: this.getNumericCellValue(worksheet, `S${rowNum}`),
         retencionesINFONAVIT: this.getNumericCellValue(worksheet, `T${rowNum}`),
         pensionAlimenticia: this.getNumericCellValue(worksheet, `U${rowNum}`),
         neto: this.getNumericCellValue(worksheet, `V${rowNum}`),
         firma: this.getCellValue(worksheet, `W${rowNum}`)
       };
 
       console.log("empleado", empleado);
 
       nominaData.empleados.push(empleado);
     }
 
     return nominaData;
   }
 
   /**
    * Obtiene el valor de una celda específica
    */
   private getCellValue(worksheet: XLSX.WorkSheet, cellAddress: string): any {
     const cell = worksheet[cellAddress];
     return cell ? cell.v : null;
   }
 
   /**
    * Obtiene el valor numérico de una celda
    */
   private getNumericCellValue(worksheet: XLSX.WorkSheet, cellAddress: string): number {
     const value = this.getCellValue(worksheet, cellAddress);
     // Convertimos a número o retornamos 0 si no es un valor numérico
     return typeof value === 'number' ? value : 0;
   }
 
   /**
    * Formatea el JSON para mostrarlo con indentación
    */
   formatJson(jsonData: any): string {
     if (!jsonData) return '';
     return this.prettyJson ? JSON.stringify(jsonData, null, 2) : JSON.stringify(jsonData);
   }
 
   /**
    * Cambia el modo de visualización del JSON
    */
   toggleJsonFormat(): void {
     this.prettyJson = !this.prettyJson;
   }
 
   /**
    * Descarga el JSON como archivo
    */
   downloadJson(): void {
     if (!this.jsonData) return;
 
     const jsonString = JSON.stringify(this.jsonData, null, 2);
     const blob = new Blob([jsonString], { type: 'application/json' });
     const url = window.URL.createObjectURL(blob);
 
     // Creamos un enlace temporal para la descarga
     const a = document.createElement('a');
     a.href = url;
     a.download = this.fileName.replace(/\.(xlsx|xls)$/i, '.json');
     document.body.appendChild(a);
     a.click();
 
     // Limpiamos
     window.URL.revokeObjectURL(url);
     document.body.removeChild(a);
   }
 
   /**
    * Copia el JSON al portapapeles
    */
   copyToClipboard(): void {
     if (!this.jsonData) return;
 
     const jsonString = this.formatJson(this.jsonData);
     navigator.clipboard.writeText(jsonString)
       .then(() => alert('JSON copiado al portapapeles'))
       .catch(err => console.error('Error al copiar:', err));
   }

  
    
}
