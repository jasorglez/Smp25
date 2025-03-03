import { CommonModule } from '@angular/common';
import { Component, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { alerts } from 'app/helpers/alerts';
import { HRService } from 'app/services/hr.service';
import { SignalsService } from 'app/services/signals.service';
import * as XLSX from 'xlsx';
import { NominaData } from './models/payroll-data.module';

@Component({
  selector: 'app-setup',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './setup.component.html',
  styleUrl: './setup.component.scss'
})
export class SetupComponent {
  private signalsService = inject(SignalsService);
  private hrService = inject(HRService);
  isLoading: boolean = false;
  error: string | null = null;
  jsonData: any = null;
  fileName: string = '';

  ngOnInit() {
    this.idBranch = this.signalsService.getBranchSelectedBySidebar()();
    this.getData();
  }

  constructor() {
    effect(() => {
      this.idBranch = this.signalsService.getBranchSelectedBySidebar()();
      this.getData();
    }
    );
  }

  hrData: any = {};
  newData: boolean;
  idBranch: number;

  getData() {
    this.hrService.getHRManagementData(this.idBranch).subscribe({
      next: (data: any) => {
        this.hrData = data[0] || {};
        console.log(data);
      },
      error: (err) => {
        if (err.status === 404) {
          this.hrData = {};
          this.newData = true;
        } else {
          console.error(err);
        }
      }
    }
    );
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
            alerts.basicAlert("Actualización", "Los datos fueron guardados exitosamente.", "success");
            this.getData(); // Refrescar datos
          },
          error: (err) => {
            alerts.basicAlert("Error", "Error al actualizar los datos.", "error");
          }
        });
    }
  }

  revertChanges() {
    this.getData(); // Refrescar datos
  }

  onFileChange(event: Event): void {
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
        
        // Asignamos los datos a nuestra variable para mostrarlos
        this.jsonData = data;
      } catch (error) {
        console.error('Error al procesar el archivo:', error);
        this.error = 'Error al procesar el archivo. Verifica que sea un Excel válido.';
      } finally {
        this.isLoading = false;
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

    console.log("nombre de la hoja", firstSheetName);
    console.log("nombre de worsheet", worksheet);


    // Creamos el objeto base para la nómina
    const nominaData: NominaData = {
      empresa: this.getCellValue(worksheet, 'B5') || '',
      periodo: this.getCellValue(worksheet, 'B6') || '',
      ejercicio: this.getCellValue(worksheet, 'B7') || '',
      empleados: []
    };

    // Obtenemos el rango de celdas
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');

    console.log("rango de empleados", range);

    
    // Procesamos cada fila a partir de la fila 11 (donde comienzan los datos de empleados)
    for (let rowNum = 10; rowNum <= range.e.r; rowNum++) {
      const nombre = this.getCellValue(worksheet, `B${rowNum}`);
      
      console.log("fila", rowNum);

      console.log("nombre del empleado", nombre);

      // Si no hay nombre, asumimos que es una fila vacía
      //if (!nombre || nombre.length < 2) continue;
      // Verificar si un nombre tiene caracteres no alfabéticos o es muy corto
      if (!nombre || !/^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]+$/.test(nombre)) continue;
      
      const empleado = {
        nombre: nombre,
        diasTrabajados: this.getNumericCellValue(worksheet, `C${rowNum}`),
        salarioDiarioIntegrado: this.getNumericCellValue(worksheet, `D${rowNum}`),
        salarioDiario: this.getNumericCellValue(worksheet, `E${rowNum}`),
        sueldos: this.getNumericCellValue(worksheet, `F${rowNum}`),
        totalPercepciones: this.getNumericCellValue(worksheet, `G${rowNum}`),
        otrosIngresos: this.getNumericCellValue(worksheet, `H${rowNum}`),
        percepcionesGravadas: this.getNumericCellValue(worksheet, `I${rowNum}`),
        impuestoArt96: this.getNumericCellValue(worksheet, `J${rowNum}`),
        subsidioArt114: this.getNumericCellValue(worksheet, `K${rowNum}`),
        totalSubsidioPEmpleoArt115: this.getNumericCellValue(worksheet, `L${rowNum}`),
        subsidioPEmpleoAcreditado: this.getNumericCellValue(worksheet, `M${rowNum}`),
        ISPT: this.getNumericCellValue(worksheet, `N${rowNum}`),
        subsidioPEmpleo: this.getNumericCellValue(worksheet, `O${rowNum}`),
        IMSSEnfermedad: this.getNumericCellValue(worksheet, `P${rowNum}`),
        IMSSCesantiaVejez: this.getNumericCellValue(worksheet, `Q${rowNum}`),
        IMSS: this.getNumericCellValue(worksheet, `R${rowNum}`),
        retencionesINFONAVIT: this.getNumericCellValue(worksheet, `S${rowNum}`),
        pensionAlimenticia: this.getNumericCellValue(worksheet, `T${rowNum}`),
        neto: this.getNumericCellValue(worksheet, `U${rowNum}`),
        firma: this.getCellValue(worksheet, `V${rowNum}`)
      };

      console.log("empleado", empleado);

      console.log("nominaData", nominaData.empleados);

      
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

}
