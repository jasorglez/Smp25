import { Component, HostListener, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { DomainsModule } from 'app/domains/domainsmodule';
import { AgGridModule } from 'ag-grid-angular';
import { MultiLineEditorComponent } from 'app/shared/multi-line/multi-line-editor.component';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { alerts } from 'app/helpers/alerts';
import { AdministrationService } from 'app/services/administration.service';
import * as XLSX from 'xlsx';
import { NominaData } from '../setup/models/payroll-data.module';

@Component({
  selector: 'app-salary',
  standalone: true,
  imports: [RouterModule, DomainsModule, AgGridModule, MultiLineEditorComponent],
  templateUrl: './salary.component.html',
  styleUrl: './salary.component.scss'
})

export class SalaryComponent {
  private lastSelectedId: string | null = null;
  notSavedChanges: boolean = false;
  rowMaster: any;
  rowDetails: any;
  accounts: { [key: string]: string } = {};
  errorMessage: string = '';
  isLoading: boolean = false

   // Variables para almacenar y mostrar datos
   jsonData: any = null;
   fileName: string = '';
   error: string | null = null;
   
   // Variable para controlar cómo se muestra el JSON
   prettyJson: boolean = true;

  newlyAddedRows: string[] = [];
  selectedRowData: any = null;

  banks: any;
  id: string;
  private tempIdCounter: number = 0;

  private gridApi!: GridApi;

  currentIndex = 0;

  private detailsGridApi!: GridApi<any>;

  public rowSelection: 'single' | 'multiple' = 'single';
  public rowGroupPanelShow: 'always' | 'onlyWhenGrouping' | 'never' = 'always';
  public pivotPanelShow: 'always' | 'onlyWhenPivoting' | 'never' = 'always';
  public paginationPageSize = 15;
  public paginationPageSizeSelector: number[] | boolean = [15, 50, 100];
  frameworkComponents = {
    multiLineEditor: MultiLineEditorComponent
  };

  // Column Definitions: Defines the columns to be displayed.
public gridOptions: any = {
  headerHeight: 30,
  rowHeight: 30,
  rowClass: (params) => {
    // Verificar si la fila está seleccionada
    if (params.node.isSelected()) {
      return 'selected-row';
    }
    return '';
  },
  
  onRowClicked: (event) => {
    // Seleccionar la fila al hacer clic en cualquier celda
    event.node.setSelected(true);
  },
  onRowSelected: (event) => {
    // Deseleccionar otras filas cuando se selecciona una nueva
    if (event.node.isSelected()) {
      this.gridApi.forEachNode((node) => {
        if (node.id !== event.node.id) {
          node.setSelected(false);
        }
      });
    }
  },
};

onMasterGridReady(params: GridReadyEvent) {
  this.gridApi = params.api;
};

onCellValueChanged(event: any) {
  //  console.log('Dato cambiado:', event.data);
  event.data.__modified = true;
  this.notSavedChanges = true;
}

onSelectionChanged(event: any) {
  const selectedNodes = event.api.getSelectedNodes();
  if (selectedNodes.length > 0) {
    const selectedData = selectedNodes[0].data;
    this.selectedRowData = selectedData;
    this.loadBalanceData(selectedData.id);
  } else {
    this.selectedRowData = null;
  }
}

get colMaster(): ColDef[] {
  return [
    {
      field: 'idBanco', headerName: 'Fecha Inicio', editable: true, width: 150, cellEditor: 'agSelectCellEditor',
      cellEditorParams: {
        values: this.banks ? this.banks.map(item => item.id) : [],
      },
      valueFormatter: (params) => {
        const foundItem = this.banks ? this.banks.find(item => item.id === params.value) : null;
        return foundItem ? `${foundItem.name}` : params.value;
      }
    },
    { field: 'numberAccount', headerName: 'Fecha Fin', editable: true, filter: true, width: 200 },

    { field: 'nameAccount', headerName: 'Total Jornadas Base', editable: true, width: 200, filter: true },

    { field: 'signAccount', headerName: 'Total Jornadas Extra', editable: true, width: 200 },

    { field: 'interbancaria', headerName: 'Total Subtotal', editable: true, width: 160 },

    {
      field: 'folioCheque', headerName: 'Total Descuento', editable: true, width: 129, cellEditorParams: {
        maxLength: 5
      }
    },

    { field: 'folioSinCheque', headerName: 'Total', editable: true, width: 140 }
  ]
};

private loadBalanceData(id: string) {
  if (!id || id === this.lastSelectedId) return;

  this.lastSelectedId = id;
  this.rowDetails = [];
  this.isLoading = true;

  this.administrationService.getBalance(parseInt(id))
    .subscribe({
      next: (response: any) => {
        if (response.success && response.hasData) {
          this.rowDetails = response.data;
        } else {
          this.rowDetails = [];
          alerts.basicAlert('Aviso', 'No hay datos disponibles', 'info');
        }
      },
      error: () => {
        this.rowDetails = [];
        alerts.basicAlert('Error', 'Error al cargar los datos', 'error');
      },
      complete: () => {
        this.isLoading = false;
      }
    });
}

private administrationService = inject(AdministrationService);

/**
   * Maneja el evento de selección de archivo
   * @param event Evento del input file
   */
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
