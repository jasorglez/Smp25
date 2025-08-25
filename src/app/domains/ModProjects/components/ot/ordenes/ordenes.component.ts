import { Component, effect, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent ,CellDoubleClickedEvent, ICellRendererParams,} from 'ag-grid-enterprise';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormControl, FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { OtService } from 'app/services/ot.service';
import { DailyReportService } from 'app/services/daily-report.service';
import { LogbookService } from 'app/services/logbook.service';
import pdfMake from 'pdfmake/build/pdfmake';
import { SignalsService } from 'app/services/signals.service';
import { SignalrService } from 'app/services/signalr.service';
import { TrackingService } from 'app/services/tracking.service';
import { PdfGeneratorService } from 'app/services/pdf-generator.service';
import { EmployeesService } from 'app/services/employees.service';
import { alerts } from 'app/helpers/alerts';
import { environment } from '@env/environment';
import { TimeEditorComponent } from 'app/domains/Indicadores/components/ind01/timeinactives/time-editor.component';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Pipe, PipeTransform } from '@angular/core';
import { MaterialsService } from 'app/services/materials.service';
import { CatalogsService } from 'app/services/catalogs.service';
import { ImageHandlerService } from 'app/services/image-handler.service';
import { EquipmentService } from 'app/services/equipment.service';
import { ModalService } from 'app/services/modal.service';
import { WorkprogramsService } from 'app/services/workprograms.service';
import { UpdateExcelService } from 'app/services/updateExcel.service';
import { ProjectsService } from 'app/services/projects.service';
import { AuthService } from 'app/services/auth.service';
import * as bootstrap from 'bootstrap';
import { firstValueFrom, lastValueFrom, EMPTY } from 'rxjs';


@Pipe({
  name: 'safe',
  standalone: true
})
export class SafePipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) {}

  transform(url: string): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }
}


interface OrdenesData {
  id: string;
  registerDate: string;
  otNumber: string;
  assignedTo: string;
  description: string;
  nameConsumer: string;
  area: string;
  projectName?: string;
  idProject?: number;
}

// Interfaces para la data de las pestañas
interface ReporteDiario {
  id: number | string;
  idOt: number;
  date: string; // "2025-07-20T00:00:00"
  startTime: string; // "08:00:00"
  endTime: string; // "12:00:00"
  supervisor: string;
  type: string; // "PROCESO"
  description: string | null;
  close: boolean;
  active: boolean;
  
  // Propiedades computadas para el grid (compatibilidad)
  fecha?: string; // date parseado
  horaInicio?: string; // startTime parseado
  horaTermino?: string; // endTime parseado
  tipoNota?: string; // type
  descripcion?: string; // description
  
  // Propiedades de control CRUD
  __isNew?: boolean;
  __modified?: boolean;
}

interface Material {
  id: string;
  nombre: string;
  cantidad: number;
  unidad: string;
  fechaUso: string;
}

interface Equipo {
  id: string;
  nombre: string;
  tipoEquipo: string;
  horasUso: number;
  fechaUso: string;
}

interface Personal {
  id: string;
  idOt: number;
  idReporte: number | string;
  idResource: string;
  position: string;
  quantity: number;
  start: string;
  end: string;
  date: string;
  typeNote?: string;
  description?: string;
  orden?: number;
  
  // Propiedades de control CRUD
  __isNew?: boolean;
  __modified?: boolean;
}

interface Fotografia {
  id: string;
  nombre: string;
  descripcion: string;
  fecha: string;
  url: string;
}

interface Video {
  id: string;
  nombre: string;
  descripcion: string;
  fecha: string;
  url: string;
}

@Component({
  selector: 'app-ordenes',
  standalone: true,
  imports: [CommonModule, TranslateModule, AgGridModule, ReactiveFormsModule, FormsModule],
  templateUrl: './ordenes.component.html',
  styleUrl: './ordenes.component.scss',
})
export class OrdenesComponent implements OnInit, OnDestroy {
  private otService = inject(OtService);
  private equipmentService = inject(EquipmentService);
  private dailyReportService = inject(DailyReportService);
  private logbookService = inject(LogbookService);
  public signalsService = inject(SignalsService);
  private trackingService = inject(TrackingService);
  private imageHandlerService = inject(ImageHandlerService);
  private workprogramsService = inject(WorkprogramsService);
  private modalServiceTable = inject(ModalService);
  private updateExcelService = inject(UpdateExcelService)
  private router = inject(Router);
  private sanitizer = inject(DomSanitizer);
  private pdfGeneratorService = inject(PdfGeneratorService);
  private employeesService = inject(EmployeesService);
  private catalogService = inject(CatalogsService);
  private materialsService = inject(MaterialsService);
  private projectsService = inject(ProjectsService);
  public authService = inject(AuthService);
  private signalrService = inject(SignalrService);
  gestionarDatos: any[] = [];

  // Variables de control
  public isUploading: boolean = false;
  private idProject: number = 0;
  private idcompany: number = 0;
  private catalogMateriales   : any[] = [];
  public catalogEquipos      : any[] = [];
  private catalogDepartamentos: any[] = [];
  private catalogConcepto: any[] = [];
  private unitsCatalog: any[] = [];
  private typeNotesCatalog: any[] = [];
  public projectsList: any[] = [];
    public conceptos  : any[] = [];
  public notas        : any[] = [];

  // Variables para el nuevo layout
  public selectedOt: OrdenesData | null = null;
  public activeTab: string = 'reportes';
  public selectedReporteFecha: string = '';
  public selectedReporteTipo: string = '';
  public selectedReporteHoraInicio: string = '';
  public selectedReporteHoraTermino: string = '';
  public selectedReporteArea: string = '';
  public selectedReporteId: number | string | null = null;
  public selectedFotografia: Fotografia | null = null;
  public selectedVideo: Video | null = null;
  public selectedStatusReport: boolean = false;
  
  // Variables para cambio de proyecto
  public selectedNewProject: string = '';
  public isChangingProject: boolean = false;
  
  // Getter para verificar permisos de selección múltiple
  public get hasMultiSelectPermission(): boolean {
    return this.authService.hasDetailedPermission('projects', 'get-all-ot');
  }
  

  // Variables para columnas ajustables
  public leftColumnSize: number = 8;
  public rightColumnSize: number = 4;
  public isResizing: boolean = false;
  private startX: number = 0;
  private startLeftSize: number = 0;
  private containerWidth: number = 0;
  
  // Variables para el patrón CRUD
  public notSavedChanges: boolean = false;
  public notSavedPersonalChanges: boolean = false;
  public notSavedMaterialChanges: boolean = false;
  public notSavedEquipoChanges: boolean = false;
  public notSavedFotografiaChanges: boolean = false;
  public notSavedVideoChanges: boolean = false;
  public notSavedNoteChanges: boolean = false;
  public notSavedConceptoChanges: boolean = false;

  private tempIdCounter: number = 1;
  private tempPersonalIdCounter: number = 1;
  private currentEditingRow: number = -1;
  private currentEditingCol: string = '';
  rowDataMaster: any[] = [];
  notSavedChangesMaster: boolean = false;

  // Reportes diarios obtenidos de la API
  public reportesDiarios: ReporteDiario[] = [];

  // Lista de empleados para el select
  public employees: any[] = [];

  // Componentes personalizados para AG-Grid
  components = {
    timeEditor: TimeEditorComponent
  };

  // PDF
  inputData: any;
  gridHeight = '30vh';
  gridWidth = '100%';
  gridWidthDetail = '100%'; 
  isGeneratingPdf: boolean = false;
  isGeneratingPdfEmbed: boolean = false;
  pdfUrl: SafeResourceUrl | null = null;
  private originalUrl: string | null = null;
  showPdfEmbed: boolean = false;
  fechaInicio: string = '';
  fechaFin: string = '';
  tipoReporte: string = 'personalizado';
  opcionSeleccionada: string = 'seleccionar';
  cuadrillaSelect: string = '';
  opcionesNumericas = [6, 4, 8, 9];
  seleccionados: number[] = [];
  projet: number = 0;
  myForm;
  isGeneratingReport: boolean = false;
  private modalInstance: any = null;

  public  materiales: any[] = [];
  public equipos: any[] = [];
  public personal: any[] = [];
  public fotografias: any[] = [];
  public videos: any[] = [];

  
  // Propiedades computadas para filtrar datos
  get materialesFiltrados(): Material[] {
    if (!this.selectedReporteFecha) return this.materiales;
    return this.materiales.filter(m => m.fechaUso === this.selectedReporteFecha);
  }

  get equiposFiltrados(): Equipo[] {
    if (!this.selectedReporteFecha) return this.equipos;
    return this.equipos.filter(e => e.fechaUso === this.selectedReporteFecha);
  }

  get personalFiltrado(): Personal[] {
    // El personal ya está filtrado por idReporte cuando se carga
    // No necesitamos filtrar por fecha aquí
    return this.personal;
  }

  get fotografiasFiltradas(): Fotografia[] {
    if (!this.selectedReporteFecha) return this.fotografias;
    return this.fotografias.filter(f => f.fecha === this.selectedReporteFecha);
  }

  get videosFiltrados(): Video[] {
    if (!this.selectedReporteFecha) return this.videos;
    return this.videos.filter(v => v.fecha === this.selectedReporteFecha);
  }
  excel() {
    // Reset form to initial state
    /*this.myForm.reset();
    this.fechaInicio = '';
    this.fechaFin = '';*/
    this.isGeneratingReport = false;
    
    // Initialize and show modal
    const modalElement = document.getElementById('modal');
    if (modalElement) {
      this.modalInstance = new bootstrap.Modal(modalElement, {
        backdrop: 'static',
        keyboard: false
      });
      this.modalInstance.show();
    }
  }
  onTipoReporteChange() {
    const selectElement = document.getElementById('tipeReporte') as HTMLSelectElement;
      this.tipoReporte = selectElement.value;
      this.filtrarTipoReporte(this.tipoReporte);
  }
  onOpcionSeleccionadaChange() {
    const selectElement = document.getElementById('opcion') as HTMLSelectElement;
      this.opcionSeleccionada = selectElement.value;
  }
  toggleSeleccion(valor: number) {
  const index = this.seleccionados.indexOf(valor);
  if (index > -1) {
    // ya está seleccionado, lo quitamos
    this.seleccionados.splice(index, 1);
  } else {
    // no está, lo agregamos
    this.seleccionados.push(valor);
  }
}
obtenerNumeroSemana(fecha) {
  const tempFecha = new Date(fecha.getTime());
  tempFecha.setHours(0, 0, 0, 0);
  // Jueves en la semana actual determina el año ISO
  tempFecha.setDate(tempFecha.getDate() + 3 - ((tempFecha.getDay() + 6) % 7));
  const jueves = new Date(tempFecha.getFullYear(), 0, 4);
  const semana = 1 + Math.round(
    ((tempFecha.getTime() - jueves.getTime()) / 86400000 - 3 + ((jueves.getDay() + 6) % 7)) / 7
  );
  const año = tempFecha.getFullYear();
  return `${año}-W${String(semana).padStart(2, '0')}`;
}
obtenerAnoMes(fecha) {
  const año = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0'); // +1 porque enero es 0
  return `${año}-${mes}`;
}
  onSubmit() {
  if (this.myForm.invalid) {
    alerts.basicAlert('Info', 'Por favor, completa todos los campos requeridos.', 'info');
    return;
  }

  const formValues = this.myForm.value;
  /*this.fechaInicio = formValues.fechaInicio;
  this.fechaFin = formValues.fechaFin;*/

  if (this.fechaInicio > this.fechaFin) {
    alert('La fecha de inicio no puede ser mayor que la fecha de fin.');
    return;
  }
  this.isGeneratingReport = true;
  console.log(formValues);
  

  switch (this.opcionSeleccionada) {
    case 'ot':
      this.updateExcelService.processAndDownloadOt(this.fechaInicio, this.fechaFin).subscribe({
        next: (blob: Blob) => {
          this.isGeneratingReport = false;

          // Crear link de descarga
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `FORMATO_GENERADOR_${new Date().getTime()}.xlsx`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);

          console.log('Excel generado y descargado exitosamente');
          alerts.basicAlert('Éxito', `Excel generado desde ${this.fechaInicio} hasta ${this.fechaFin}`, 'success');
          this.closeModal();
        },
        error: (error) => {
          this.isGeneratingReport = false;
          console.error('Error al generar Excel:', error);
          alerts.basicAlert('Error', 'Error al generar el Excel. Inténtalo de nuevo.', 'error');
        }
      });
      break;

    case 'cuadrilla-interna':
      this.updateExcelService.processAndDownloadCuadInter(this.fechaInicio, this.fechaFin).subscribe({
        next: (blob: Blob) => {
          this.isGeneratingReport = false;

          // Crear link de descarga
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `CALCULO_DE_PAGO_A_CUADRILLA_INTERNAS_${new Date().getTime()}.xlsx`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);

          console.log('Excel generado y descargado exitosamente');
          alerts.basicAlert('Éxito', `Excel generado desde ${this.fechaInicio} hasta ${this.fechaFin}`, 'success');
          this.closeModal();
        },
        error: (error) => {
          this.isGeneratingReport = false;
          console.error('Error al generar Excel:', error);
          alerts.basicAlert('Error', 'Error al generar el Excel. Inténtalo de nuevo.', 'error');
        }
      });
      break;

    case 'cuadrilla-externa':
      if (this.seleccionados.length === 0) {
        alerts.basicAlert('Advertencia', 'Seleccione una cuadrilla', 'warning');
        this.isGeneratingReport = false;
      } else {
        this.updateExcelService.processAndDownloadCuadExter(this.fechaInicio, this.fechaFin, this.seleccionados).subscribe({
          next: (blob: Blob) => {
            this.isGeneratingReport = false;

          // Crear link de descarga
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `CALCULO_DE_PAGO_A_CUADRILLA_EXTERNAS_${new Date().getTime()}.xlsx`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);

          console.log('Excel generado y descargado exitosamente');
          alerts.basicAlert('Éxito', `Excel generado desde ${this.fechaInicio} hasta ${this.fechaFin}`, 'success');
          this.closeModal();
        },
        error: (error) => {
          this.isGeneratingReport = false;
          console.error('Error al generar Excel:', error);
          alerts.basicAlert('Error', 'Error al generar el Excel. Inténtalo de nuevo.', 'error');
        }
      });
      }
      break;

    default:
      this.isGeneratingReport = false;
      alerts.basicAlert('Advertencia', 'Opción no válida.', 'warning');
      break;
  }
}


  cancelar() {
    this.fechaInicio = '';
    this.fechaFin = '';
    this.tipoReporte = 'personalizado';
    this.seleccionados = []; // <-- Limpia la selección de cuadrillas
    this.opcionSeleccionada = ''; // <-- Opcional: limpia la opción seleccionada
    this.myForm.patchValue(
      {
        opcionSeleccionada: '',
        tipoReporte: 'personalizado'
      }
    );
  }

  closeModal() {
    if (this.modalInstance) {
      this.modalInstance.hide();
    }
  }

  // Configuraciones de columnas para AG-Grid
  // Definición de columnas
  public get oTcolumnDefs(): ColDef[] {
    const hasPermission = this.authService.hasDetailedPermission('projects', 'get-all-ot');
    return [
      {
        headerName: '',
        checkboxSelection: hasPermission,
        headerCheckboxSelection: hasPermission,
        width: 50,
        pinned: 'left',
        suppressMenu: true,
        sortable: false,
        filter: false,
        resizable: false,
        hide: !hasPermission
      },
    /*   {
      field: 'id',
      headerName: 'ID',
      sortable: true,
      filter: true,
      resizable: true,
      width: 77,
    }, 
   */
    {
      field: 'idProject',
      headerName: 'Proyecto',
      sortable: true,
      filter: true,
      filterParams: {
        excelMode: 'mac'
      },
      resizable: true,
      flex: 4,
      hide: !this.authService.hasDetailedPermission('projects', 'get-all-ot'),
      editable: true,
      rowGroup: this.authService.hasDetailedPermission('projects', 'get-all-ot'),
      cellEditor: 'agRichSelectCellEditor',
      cellEditorParams: {
        values: () => this.projectsList.map(p => p.id),
        formatValue: (value: any) => {
          const project = this.projectsList.find(p => p.id === value);
          return project ? project.name : value;
        }
      },
      valueFormatter: (params: any) => {
        const project = this.projectsList.find(p => p.id === params.value);
        return project ? project.name : params.value;
      },
      filterValueGetter: (params: any) => {
        const project = this.projectsList.find(p => p.id === params.data.idProject);
        return project ? project.name : params.data.idProject;
      },
      onCellValueChanged: (params: any) => {
        this.onProjectChangedWithConfirmation(params);
      }
    },
        {
      field: 'cdc',
      headerName: 'CDC',
      sortable: true,
      filter: true,
      resizable: true,
      flex: 3,
    },
    {
      field: 'otNumber',
      headerName: 'OT',
      sortable: true,
      filter: true,
      filterParams: {
        excelMode: 'mac'
      },
      resizable: true,
      flex: 3,    
    },
     /*{
      field: 'results',
      headerName: 'Resultados',
      sortable: true,
      filter: true,
      resizable: true,
      flex: 2,
      onCellDoubleClicked: (params: any) => {
        this.onOTCellDoubleClicked(params);
      }
    },*/
    {
      field: 'closed',
      headerName: 'Cerrado',
      sortable: true,
      filter: true,
      resizable: true,
      flex: 4,
      editable: false
    }
    
    ];
  }

 public get materialesColumnDefs(): ColDef[] {
  return [
  {
  field: 'idResource',
  headerName: 'Material',
  flex: 2,
  editable: () => !this.signalsService.getClosedReport()(),
  cellEditor: 'agSelectCellEditor',
  cellEditorParams: (params: any) => {
    return {
         values: this.catalogMateriales.map(emp => emp.description),
         filterList: this.catalogMateriales.map(emp => emp.description),
         filterKey: 'idResource',
         placeholder: 'Buscar empleado...',
         minLength: 1,
       };
  },
  // Muestra la descripción del material
  valueFormatter: (params) => {
    // Obtener el ID del material desde idResource
    const materialId = params.data?.idResource;
    if (!materialId) return '';
    
    const foundItem = this.catalogMateriales?.find(item => item.id == materialId);
    return foundItem ? foundItem.description : `ID: ${materialId}`;
  },
  // Obtiene el valor para mostrar en el editor (descripción)
  valueGetter: (params) => {
    if (!params.data || !params.data.idResource) return '';
    const foundItem = this.catalogMateriales?.find(item => item.id == params.data.idResource);
    return foundItem ? foundItem.description : '';
  },
  // Convierte la descripción seleccionada de vuelta al ID
  valueSetter: (params) => {
   
    if (!params.newValue) {
      params.data.idResource = null;
      return true;
    }
    
    const foundItem = this.catalogMateriales?.find(item => item.description === params.newValue);
    if (foundItem) {
       const duplicateExists = this.materiales.some(
          (row, index) =>
            index !== params.node.rowIndex &&
            row.idResource === foundItem.id
        );
      
        if (duplicateExists) {
          alerts.basicAlert(
            'Duplicado',
            'Este material ya está asignado.',
            'error'
          );
          return false;
        }
      params.data.idResource = foundItem.id;
      return true;
    } else {
      console.log('Material no encontrado para:', params.newValue);
      return false; // No aceptar valores no válidos
    }
  }
  },

  {
    field: 'quantity',
    headerName: 'Cantidad',
    width: 100,
    editable: this.signalsService.getClosedReport()()? false : true
  },

  {
    field: 'unidad',
    headerName: 'Unidad',
    width: 100,
    editable: false,
    
    // Obtiene la unidad del material seleccionado
    valueGetter: (params) => {
      const materialId = params.data?.idResource;
      if (!materialId) return '';
      
      // Buscar el material en el catálogo
      const material = this.catalogMateriales?.find(m => m.id == materialId);
      if (!material || !material.idMedida) return '';
      
      // Buscar la descripción de la unidad
      const unit = this.unitsCatalog?.find(u => u.id == material.idMedida);
      return unit ? unit.description : material.idMedida;
    }
  }
  ];
 }

  public equiposColumnDefs: ColDef[] = [
    //{ field: 'id', headerName: 'ID', width: 80 },
    {
    field: 'idResource',
    headerName: 'Equipo',
    flex: 2,
   editable: () => !this.signalsService.getClosedReport()(),
    cellEditor: 'agSelectCellEditor',
    cellEditorParams: (params: any) => {
      return {
         values: this.catalogEquipos.map(emp => emp.description),
         filterList: this.catalogEquipos.map(emp => emp.description),
         filterKey: 'idResource',
         placeholder: 'Buscar empleado...',
         minLength: 1,
       };
    },
    // Muestra la descripción del equipo en la celda
    valueFormatter: (params) => {
      const equipoId = params.data?.idResource;
      if (!equipoId) return '';

      const foundItem = this.catalogEquipos?.find(item => item.id == equipoId);
      return foundItem ? foundItem.description : `ID: ${equipoId}`;
    },
    // Muestra la descripción del equipo cuando se lee el valor actual
    valueGetter: (params) => {
      const equipoId = params.data?.idResource;
      if (!equipoId) return '';

      const foundItem = this.catalogEquipos?.find(item => item.id == equipoId);
      return foundItem ? foundItem.description : '';
    },
    // Convierte la descripción seleccionada de vuelta al ID
    valueSetter: (params) => {

      if (!params.newValue) {
        params.data.idResource = null;
        console.log('Data después (null):', params.data.idResource);
        return true;
      }

      const foundItem = this.catalogEquipos?.find(item => item.description === params.newValue);
      if (foundItem) {
        const duplicateExists = this.equipos.some(
          (row, index) =>
            index !== params.node.rowIndex &&
            row.idResource === foundItem.id
        );
      
        if (duplicateExists) {
          alerts.basicAlert(
            'Duplicado',
            'Este equipo ya está asignado.',
            'error'
          );
          return false;
        }
        params.data.idResource = foundItem.id;
        return true;
      } else {
        console.warn('Descripción no válida:', params.newValue);
        return false;
      }
    }
  },
    { 
      field: 'quantity', 
      headerName: 'Cantidad', 
      flex: 1, 
      editable: () => !this.signalsService.getClosedReport()(),
      cellDataType: 'number',
      cellEditorParams: {
        min: 0,
        step: 0.01,
        precision: 2
      }
    },
    //{ field: 'quantity', headerName: 'Horas', width: 100, editable: !this.signalsService.getClosedReport() },
    //{ field: 'fechaUso', headerName: 'Fecha', width: 120 }
  ];
  
  public personalColumnDefs: ColDef[] = [
    //{ field: 'id', headerName: 'ID', width: 80 },
    {
      field: 'idResource',
      headerName: 'Nombre',
      flex: 1,
      editable: () => !this.signalsService.getClosedReport()(),
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: (params: any) => {
        return {
          values: this.employees.map(emp => emp.name),
          filterList: this.employees.map(emp => emp.name),
          filterKey: 'idResource',
          placeholder: 'Buscar empleado...',
          minLength: 1,
        };
      },
      
      valueFormatter: (params: any) => {
        if (params.value && params.value !== '0') {
          const employee = this.employees.find(emp => emp.id.toString() === params.value.toString());
          return employee ? employee.name : '';
        }
        return '';
      },
      valueSetter: (params: any) => {
        console.log(params)
        if (params.newValue) {
          const employee = this.employees.find(emp => emp.name === params.newValue);
          if (employee) {
            // Verificar si el empleado ya está en la lista
            const duplicateExists = this.personal.some(
              (row, index) =>
                index !== params.node.rowIndex &&
                row.idResource === employee.id
            );
          
            if (duplicateExists) {
              alerts.basicAlert(
                'Duplicado',
                'Este empleado ya está asignado.',
                'error'
              );
              return false;
            }

            // Establecer el ID del empleado
            params.data[params.colDef.field] = employee.id.toString();
            const depto = this.catalogDepartamentos.find(d => d.id === +employee.idPosition);
          
            // Establecer automáticamente la posición
            params.data['position'] = depto ? depto.description : '';
          
            console.log('Empleado seleccionado:', employee);
            return true;
          }
        }
        return false;
      }
    },
    {
      field: 'position',
      headerName: 'Cargo',
      flex: 1,
      editable: false,
      valueFormatter: (params: any) => {
        if (params.data?.idResource) {
          const employee = this.employees.find(emp => emp.id.toString() === params.data.idResource.toString());
          if (employee) {
            const depto = this.catalogDepartamentos.find(d => d.id === +employee.idPosition);
            return depto ? depto.description : '';
          }
        }
        return params.value || '';
      }
    },

    { 
      field: 'cuadrilla', 
      headerName: 'Cuadrilla', 
      flex: 1, editable:() => !this.signalsService.getClosedReport()(), 
      valueGetter: (params) => {
        return params.data.cuadrilla || `Cuadrilla ${this.cuadrillaSelect}`;
      }
    },
    /*{ field: 'start', headerName: 'Inicio', width: 100, editable: !this.signalsService.getClosedReport() },
    { field: 'end', headerName: 'Fin', width: 100, editable: !this.signalsService.getClosedReport() },
    { field: 'date', headerName: 'Fecha', width: 120 }*/
  ];

  public fotografiasColumnDefs: ColDef[] = [
    //{ field: 'id', headerName: 'ID', width: 80 },
    { 
      field: 'imageUrl', 
      headerName: 'Foto', 
      flex: 1,
      cellRenderer: this.imageHandlerService.imageCellRenderer.bind(this.imageHandlerService),
        cellRendererParams: {
          clicked: this.imageHandlerService.onImageCellClicked.bind(this.imageHandlerService),
          field: 'imageUrl'
        },
        editable: false,
     },
    { field: 'description', headerName: 'Descripción', flex: 1, editable: () => !this.signalsService.getClosedReport()()},
    //{ field: 'fecha', headerName: 'Fecha', width: 120 }
  ];


public videosColumnDefs: ColDef[] = [
  { 
    field: 'videoUrl', 
    headerName: 'Video', 
    flex: 1,
    cellRenderer: (params: any) => {
      const cellContainer = document.createElement('div');
      cellContainer.style.width = '100%';
      cellContainer.style.height = '100%';
      cellContainer.style.display = 'flex';
      cellContainer.style.alignItems = 'center';
      cellContainer.style.justifyContent = 'center';
      cellContainer.style.cursor = 'pointer';
      cellContainer.style.gap = '8px';

      if (params.data.imageUrl && params.data.imageUrl !== 'NO FILE') {
        // Video ya subido
        const icon = document.createElement('i');
        icon.className = 'bi bi-play-circle-fill text-success';
        icon.style.fontSize = '20px';
        
        const text = document.createElement('span');
        text.textContent = 'Video subido - Click para cambiar';
        
        cellContainer.appendChild(icon);
        cellContainer.appendChild(text);
      } else {
        // No hay video
        const icon = document.createElement('i');
        icon.className = 'bi bi-cloud-upload text-primary';
        icon.style.fontSize = '20px';
        
        const text = document.createElement('span');
        text.textContent = 'Click para subir video';
        
        cellContainer.appendChild(icon);
        cellContainer.appendChild(text);
      }

      // Agregar evento click directamente al container
      cellContainer.addEventListener('click', () => {
        // Crear objeto con estructura correcta para el servicio
        const mockParams = {
          node: params.node,
          data: params.data,
          colDef: {
            cellRendererParams: {
              field: 'imageUrl'
            }
          }
        };
        this.imageHandlerService.onVideoCellClicked(mockParams as any);
      });

      return cellContainer;
    },
    editable: false,
  },
  { field: 'description', headerName: 'Descripción', flex: 1, editable: () => !this.signalsService.getClosedReport()()},
];


 public notasColumnDefs: ColDef[] = [
  {
    field: 'idResource',
    headerName: 'Notas',
    flex: 2,
    editable: () => !this.signalsService.getClosedReport()(),
    cellEditor: 'agSelectCellEditor',
    cellEditorParams: (params: any) => ({
      values: this.typeNotesCatalog?.map((item) => item.description) || [],
    }),
    // Muestra la descripción del equipo en la celda
    valueFormatter: (params) => {
      const equipoId = params.data?.idResource;
      if (!equipoId) return '';

      const foundItem = this.typeNotesCatalog?.find(item => item.id == equipoId);
      return foundItem ? foundItem.description : `ID: ${equipoId}`;
    },
    // Muestra la descripción del equipo cuando se lee el valor actual
    valueGetter: (params) => {
      const equipoId = params.data?.idResource;
      if (!equipoId) return '';

      const foundItem = this.typeNotesCatalog?.find(item => item.id == equipoId);
      return foundItem ? foundItem.description : '';
    },
    // Convierte la descripción seleccionada de vuelta al ID
    valueSetter: (params) => {
      console.log('=== VALUE SETTER EQUIPOS ===');
      console.log('Nuevo valor (descripción):', params.newValue);
      console.log('Valor anterior:', params.oldValue);
      console.log('Data antes:', params.data.idResource);

      if (!params.newValue) {
        params.data.idResource = null;
        console.log('Data después (null):', params.data.idResource);
        return true;
      }

      const foundItem = this.typeNotesCatalog?.find(item => item.description === params.newValue);
      if (foundItem) {
        params.data.idResource = foundItem.id;
        console.log('Data después:', params.data.idResource);
        return true;
      } else {
        console.warn('Descripción no válida:', params.newValue);
        return false;
      }
    }
  },
  {
    field: 'description',
    headerName: 'Descripción',
    flex: 1,
    editable: () => !this.signalsService.getClosedReport()(),
    cellEditor: 'agPopupTextCellEditor',
    cellEditorParams: {
      maxLength: 1000,
      cols: 50,
      rows: 5,
      onKeyDown: (event: KeyboardEvent) => {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.stopPropagation();
        }
      },
    },
    onCellDoubleClicked: (event: CellDoubleClickedEvent) => {
      this.openDescriptionModal(event);
    },
    cellRenderer: (params: ICellRendererParams) => {
      if (params.node.group) {
        return params.value ? params.value.toUpperCase() : '';
      }
      return params.value ? params.value.toUpperCase() : '';
    },
  }


  ]

  public conceptosColumnDefs: ColDef[] = [
    {
    field: 'idResource',
    headerName: 'Trabajo realizado',
    flex: 2,
    editable: () => !this.signalsService.getClosedReport()(),
    cellEditor: 'agSelectCellEditor',
    cellEditorParams: (params: any) => {
      return {
          values: this.catalogConcepto.map(emp => emp.actandNom),
          filterList: this.catalogConcepto.map(emp => emp.actandNom),
          filterKey: 'idResource',
          placeholder: 'Buscar empleado...',
          minLength: 1,
        };
    },
    // Muestra la descripción del equipo en la celda
    valueFormatter: (params) => {
      const equipoId = params.data?.idResource;
      if (!equipoId) return '';

      const foundItem = this.catalogConcepto?.find(item => item.id == equipoId);
      return foundItem ? foundItem.actandNom : `ID: ${equipoId}`;
    },
    // Muestra la descripción del equipo cuando se lee el valor actual
    valueGetter: (params) => {
      const equipoId = params.data?.idResource;
      if (!equipoId) return '';

      const foundItem = this.catalogConcepto?.find(item => item.id == equipoId);
      return foundItem ? foundItem.actandNom : '';
    },
    // Convierte la descripción seleccionada de vuelta al ID
    valueSetter: (params) => {

      if (!params.newValue) {
        params.data.idResource = null;
        return true;
      }

      const foundItem = this.catalogConcepto?.find(item => item.actandNom === params.newValue);
      if (foundItem) {
        const duplicateExists = this.conceptos.some(
          (row, index) =>
            index !== params.node.rowIndex &&
            row.idResource === foundItem.id
        );
      
        if (duplicateExists) {
          alerts.basicAlert(
            'Duplicado',
            'Este trabajo ya está asignado.',
            'error'
          );
          return false;
        }
        params.data.idResource = foundItem.id;
        console.log('Data después:', params.data.idResource);
        return true;
      } else {
        console.warn('Descripción no válida:', params.newValue);
        return false;
      }
    }
  },
  { field: 'quantity', headerName: 'Cantidad', flex: 1, editable: () => !this.signalsService.getClosedReport()()},
  ]

  // Configuración de columnas para reportes diarios con edición inline
  public reportesColumnDefs: ColDef[] = [
    { 
      field: 'date', 
      headerName: 'Fecha', 
      width: 120, 
      //editable: () => !this.signalsService.getClosedReport()(),
      editable: true,
      cellEditor: 'agDateCellEditor',
      cellEditorParams: {
        min: '2020-01-01',
        max: '2030-12-31'
      },
      valueFormatter: (params) => {
        if (!params.value) return '';
        // Convertir YYYY-MM-DD a DD/MM/YYYY para mostrar
        const dateValue = params.value.split('T')[0];
        const [year, month, day] = dateValue.split('-');
        return `${day}/${month}/${year}`;
      },
      valueParser: (params) => {
        // Convertir DD/MM/YYYY a YYYY-MM-DD para guardar
        if (!params.newValue) return '';
        
        // Si ya viene en formato YYYY-MM-DD (del date picker), usar así
        if (params.newValue.includes('-')) {
          return params.newValue.split('T')[0];
        }
        
        // Si viene en formato DD/MM/YYYY, convertir
        const [day, month, year] = params.newValue.split('/');
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      },
      valueSetter: (params) => {
        if (params.newValue) {
          let dateValue;
          
          // Si es un objeto Date (del date picker)
          if (params.newValue instanceof Date) {
            const year = params.newValue.getFullYear();
            const month = String(params.newValue.getMonth() + 1).padStart(2, '0');
            const day = String(params.newValue.getDate()).padStart(2, '0');
            dateValue = `${year}-${month}-${day}`;
          }
          // Si es string y contiene guiones (formato YYYY-MM-DD)
          else if (typeof params.newValue === 'string' && params.newValue.includes('-')) {
            dateValue = params.newValue.split('T')[0];
          }
          // Si es string y contiene barras (formato DD/MM/YYYY)
          else if (typeof params.newValue === 'string' && params.newValue.includes('/')) {
            const [day, month, year] = params.newValue.split('/');
            dateValue = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          }
          // Si es otro tipo de string, intentar parsearlo
          else if (typeof params.newValue === 'string') {
            dateValue = params.newValue;
          }
          
          params.data[params.colDef.field] = dateValue;
        } else {
          params.data[params.colDef.field] = '';
        }
        return true;
      }
    },
    { 
      field: 'startTime', 
      headerName: 'Inicio', 
      width: 105, 
      //editable: () => !this.signalsService.getClosedReport()(),
      editable: true,
      cellEditor: 'timeEditor',
      valueFormatter: (params) => {
        return params.value ? params.value.substring(0, 5) : '';
      }
    },
    { 
      field: 'endTime', 
      headerName: 'Término', 
      width: 105, 
      //editable: () => !this.signalsService.getClosedReport()(),
      editable: true,
      cellEditor: 'timeEditor',
      valueFormatter: (params) => {
        return params.value ? params.value.substring(0, 5) : '';
      }
    },
    { 
      field: 'paid', 
      headerName: 'Pagado', 
      //editable: () => !this.signalsService.getClosedReport()(),
      editable: true,
      width: 110,
    },
  {
      field: 'totalPay', 
      headerName: 'Total $ Ejecutado', 
      width: 150,
      editable: true,
      cellRenderer: (params) => {
        const value = params.value || 0;
        const formatted = new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD'
        }).format(value);
        
        return `
          <div style="
            text-align: center; 
            width: 100%; 
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
          ">${formatted}</div>
        `;
      },
      cellStyle: { 
        textAlign: 'center',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }
    },
    { 
      field: 'close', 
      headerName: 'Cerrado', 
      //editable: () => !this.signalsService.getClosedReport()(),
      editable: true,
      width: 100,
    },
     { 
      field: 'description', 
      headerName: 'Comentario', 
      //editable: () => !this.signalsService.getClosedReport()(),
      editable: true,
      width: 180,
    }
  ];

 onCellDoubleClicked(event: CellDoubleClickedEvent) {
  if (!event.node.group) {
    this.modalServiceTable.showModal({
      params: event,
      value: event.value,
    });
  }
}

openDescriptionModal(event: CellDoubleClickedEvent) {
  if (event.node.group) return;
  
  const currentValue = event.value || '';
  const fieldName = event.colDef.field;
  
  // Usar SweetAlert2 como modal para editar la descripción
  alerts.inputAlert(
    'Editar Descripción',
    'Ingrese la descripción:',
    'textarea',
    currentValue,
    {
      inputAttributes: {
        maxlength: '1000',
        rows: '8',
        cols: '80',
        style: 'min-height: 200px; min-width: 400px; resize: both;',
        placeholder: 'Escriba aquí la descripción...'
      },
      showCancelButton: true,
      confirmButtonText: 'Guardar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#28a745',
      cancelButtonColor: '#6c757d'
    }
  ).then((result) => {
    if (result.isConfirmed && result.value !== undefined) {
      // Actualizar el valor en el grid
      event.node.setDataValue(fieldName, result.value);
      
      // Marcar como modificado para trackear cambios
      if (event.data) {
        event.data.__modified = true;
        // Actualizar el flag de cambios no guardados dependiendo de qué grid sea
        if (fieldName === 'description') {
          this.notSavedNoteChanges = true;
        }
      }
      
      // Log para tracking
      this.trackingService.addLog(
        this.trackingService.getnameComp(),
        `Descripción editada via modal - Campo: ${fieldName}`,
        'Orden de Trabajo - Edición Modal',
        this.trackingService.getEmail()
      );
    }
  });
}

  addFotografia(){
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Agregar Fotografía OT',
      'Modulo Proyectos - Ordenes de Trabajo - Fotografías',
      this.trackingService.getEmail()
    );
    
    if (!this.selectedOt) {
      alerts.basicAlert('Error', 'Debe seleccionar una OT primero', 'error');
      return;
    }

    if (!this.selectedReporteFecha) {
      alerts.basicAlert('Error', 'Debe seleccionar una fecha de reporte primero', 'error');
      return;
    }

    const tempId = `temp_personal_${this.tempPersonalIdCounter++}`;
   
    const newFotografia = {
      id: tempId,
      idOt: parseInt(this.selectedOt.id),
      idReporte: this.selectedReporteId,
      idResource: null, // Se almacenará el ID del empleado
      position: '', 
      quantity: 1,
      start: this.selectedReporteHoraInicio + ':00',
      end: this.selectedReporteHoraTermino + ':00',
      azureUrl: 'NO FILE',
      date: this.selectedReporteFecha,
      typeNote: 'Photo',
      imageazure: 'NO FILE',
      orden: 4,
      __isNew: true
    };

    console.log('📸 === NUEVA FOTOGRAFÍA CREADA ===');
    console.log('📸 newFotografia.typeNote:', newFotografia.typeNote);
    console.log('📸 newFotografia.orden:', newFotografia.orden);
    console.log('📸 newFotografia completa:', newFotografia);

    this.fotografias = [newFotografia, ...this.fotografias];
    this.notSavedFotografiaChanges = true;

    setTimeout(() => {
      if (this.fotografiaGridApi) {
        this.fotografiaGridApi.startEditingCell({
          rowIndex: 0,
          colKey: 'imageUrl'
        });
      }
    }, 0);
  }

addVideo(){
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Agregar Video OT',
      'Modulo Proyectos - Ordenes de Trabajo - Videos',
      this.trackingService.getEmail()
    );
    
    if (!this.selectedOt) {
      alerts.basicAlert('Error', 'Debe seleccionar una OT primero', 'error');
      return;
    }

    if (!this.selectedReporteFecha) {
      alerts.basicAlert('Error', 'Debe seleccionar una fecha de reporte primero', 'error');
      return;
    }

    const tempId = `temp_video_${this.tempPersonalIdCounter++}`;
   
    const newVideo = {
      id: tempId,
      idOt: parseInt(this.selectedOt.id),
      idReporte: this.selectedReporteId,
      idResource: null,
      position: '', 
      quantity: 1,
      start: this.selectedReporteHoraInicio + ':00',
      end: this.selectedReporteHoraTermino + ':00',
      azureUrl: 'NO FILE',
      date: this.selectedReporteFecha,
      typeNote: 'Video',
      imageUrl: 'NO FILE',        // ← Campo donde Firebase guarda la URL
      description: '',
      orden: 1,
      __isNew: true
    };

    this.videos = [newVideo, ...this.videos];
    this.notSavedVideoChanges = true;

    setTimeout(() => {
      if (this.videoGridApi) {
        this.videoGridApi.startEditingCell({
          rowIndex: 0,
          colKey: 'videoUrl'
        });
      }
    }, 0);
  }

  async saveFotografiasChanges() {
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Guardar Cambios Fotografías OT',
      'Modulo Proyectos - Ordenes de Trabajo - Fotografías',
      this.trackingService.getEmail()
    );
    
    const newRows = this.fotografias.filter(row => row.__isNew);
    const modifiedRows = this.fotografias.filter(row => row.__modified && !row.__isNew);

    console.log('📸 === DEBUGGING FOTOGRAFÍAS ===');
    console.log('📸 newRows:', newRows);
    console.log('📸 modifiedRows:', modifiedRows);

    // Validación básica
    const invalidRows = newRows.filter(item => item.imageUrl && item.descripcion);
    
    if (invalidRows.length > 0) {
      alerts.basicAlert('Error', 'Debe completar la imagen y la descripción antes de guardar.', 'error');
      return;
    }

    if (newRows.length === 0 && modifiedRows.length === 0) {
      alerts.basicAlert('Info', 'No hay cambios para guardar', 'info');
      return;
    }

    try {
      console.log('📸 === USANDO ENDPOINTS DE LOGBOOK SERVICE PARA FOTOGRAFÍAS ===');
      
      // Preparar requests para nuevos registros
      const addRequests = newRows.map((row, index) => {
        console.log(`📸 === FOTO DATOS ORIGINALES ${index + 1} ===`);
        console.log(`📸 row.typeNote:`, row.typeNote);
        console.log(`📸 row.orden:`, row.orden);
        console.log(`📸 row completo:`, row);
        
        const cleanedData = this.cleanPersonalDataForServer(row);
        
        console.log(`📸 === FOTO DATOS LIMPIADOS ${index + 1} ===`);
        console.log(`📸 cleanedData.typeNote:`, cleanedData.typeNote);
        console.log(`📸 cleanedData.orden:`, cleanedData.orden);
        console.log(`📸 cleanedData.TypeNote:`, cleanedData.TypeNote);
        console.log(`📸 cleanedData.Orden:`, cleanedData.Orden);
        console.log(`📸 cleanedData completo:`, cleanedData);
        console.log(`📸 JSON.stringify:`, JSON.stringify(cleanedData, null, 2));
        
        return this.logbookService.addDataForOt(cleanedData).toPromise();
      });

      // Preparar requests para registros modificados
      const updateRequests = modifiedRows.map((row, index) => {
        const cleanedData = this.cleanPersonalDataForServer(row);
        console.log(`Datos para PUT ${index + 1} (ID: ${row.id}):`, cleanedData);
        return this.logbookService.updateDataForOt(Number(row.id), cleanedData).toPromise();
      });

      console.log(`Ejecutando ${addRequests.length} requests de creación`);
      console.log(`Ejecutando ${updateRequests.length} requests de actualización`);

      // Ejecutar todos los requests
      const responses = await Promise.all([...addRequests, ...updateRequests]);
      
      console.log('=== RESPUESTAS RECIBIDAS ===');
      console.log('Número de respuestas:', responses.length);
      responses.forEach((response, index) => {
        console.log(`Respuesta ${index + 1}:`, response);
      });

      // Verificar si las respuestas son exitosas
      const failedResponses = responses.filter(response => 
        !response || 
        (response.hasOwnProperty('success') && !response.success) ||
        (response.status && response.status >= 400)
      );

      if (failedResponses.length > 0) {
        console.error('Respuestas fallidas:', failedResponses);
        throw new Error(`${failedResponses.length} requests fallaron`);
      }

      console.log('=== GUARDADO EXITOSO ===');
      alerts.basicAlert('Éxito', 'Cambios de fotografías guardados correctamente', 'success');
      this.autoUpdatePdf()
      this.notSavedFotografiaChanges = false;
      
      // Limpiar flags de control
      this.fotografias.forEach(item => {
        delete item.__isNew;
        delete item.__modified;
      });

      // Recargar datos para reflejar cambios del servidor
      // Aquí podrías recargar datos si tienes un endpoint específico para fotografías

    } catch (error: any) {
      console.error('=== ERROR AL GUARDAR FOTOGRAFÍAS ===');
      console.error('Error completo:', error);

      let errorMessage = 'Error al guardar cambios de fotografías';
      if (error.status === 400) {
        errorMessage = 'Datos inválidos. Verifique que todos los campos estén correctos.';
      } else if (error.status === 401) {
        errorMessage = 'No autorizado. Por favor, vuelva a iniciar sesión.';
      } else if (error.status === 500) {
        errorMessage = 'Error interno del servidor. Contacte al administrador.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      alerts.basicAlert('Error', errorMessage, 'error');
    }
  }

  async saveVideosChanges() {
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Guardar Cambios Videos OT',
      'Modulo Proyectos - Ordenes de Trabajo - Videos',
      this.trackingService.getEmail()
    );
    
    const newRows = this.videos.filter(row => row.__isNew);
    const modifiedRows = this.videos.filter(row => row.__modified && !row.__isNew);

    // Validación básica
    const invalidRows = newRows.filter(item => item.videoUrl && item.descripcion);
    
    if (invalidRows.length > 0) {
      alerts.basicAlert('Error', 'Debe completar el video y la descripción antes de guardar.', 'error');
      return;
    }

    if (newRows.length === 0 && modifiedRows.length === 0) {
      alerts.basicAlert('Info', 'No hay cambios para guardar', 'info');
      return;
    }

    try {
      console.log('=== USANDO ENDPOINTS DE LOGBOOK SERVICE PARA VIDEOS ===');
      
      // Preparar requests para nuevos registros
      const addRequests = newRows.map((row, index) => {
        const cleanedData = this.cleanPersonalDataForServer(row);
        console.log(`Datos para POST video ${index + 1}:`, cleanedData);
        return this.logbookService.addDataForOt(cleanedData).toPromise();
      });

      // Preparar requests para registros modificados
      const updateRequests = modifiedRows.map((row, index) => {
        const cleanedData = this.cleanPersonalDataForServer(row);
        console.log(`Datos para PUT video ${index + 1} (ID: ${row.id}):`, cleanedData);
        return this.logbookService.updateDataForOt(Number(row.id), cleanedData).toPromise();
      });

      console.log(`Ejecutando ${addRequests.length} requests de creación de videos`);
      console.log(`Ejecutando ${updateRequests.length} requests de actualización de videos`);

      // Ejecutar todos los requests
      const responses = await Promise.all([...addRequests, ...updateRequests]);
      
      console.log('=== RESPUESTAS RECIBIDAS PARA VIDEOS ===');
      console.log('Número de respuestas:', responses.length);
      responses.forEach((response, index) => {
        console.log(`Respuesta video ${index + 1}:`, response);
      });

      // Verificar si las respuestas son exitosas
      const failedResponses = responses.filter(response => 
        !response || 
        (response.hasOwnProperty('success') && !response.success) ||
        (response.status && response.status >= 400)
      );

      if (failedResponses.length > 0) {
        console.error('Respuestas fallidas:', failedResponses);
        throw new Error(`${failedResponses.length} requests fallaron`);
      }

      console.log('=== GUARDADO EXITOSO DE VIDEOS ===');
      alerts.basicAlert('Éxito', 'Cambios de videos guardados correctamente', 'success');
      this.autoUpdatePdf()
      this.notSavedVideoChanges = false;
      
      // Limpiar flags de control
      this.videos.forEach(item => {
        delete item.__isNew;
        delete item.__modified;
      });

    } catch (error: any) {
      console.error('=== ERROR AL GUARDAR VIDEOS ===');
      console.error('Error completo:', error);

      let errorMessage = 'Error al guardar cambios de videos';
      if (error.status === 400) {
        errorMessage = 'Datos inválidos. Verifique que todos los campos estén correctos.';
      } else if (error.status === 501) {
        errorMessage = 'No autorizado. Por favor, vuelva a iniciar sesión.';
      } else if (error.status === 500) {
        errorMessage = 'Error interno del servidor. Contacte al administrador.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      alerts.basicAlert('Error', errorMessage, 'error');
    }
  }

  revertFotografias() {
    this.obtenerFotografias(this.selectedReporteId);
    this.notSavedFotografiaChanges = false;
  }

  revertVideos() {
    this.obtenerVideos(this.selectedReporteId);
    this.notSavedVideoChanges = false;
  }

  deleteFotografia(){
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Eliminar Fotografía OT',
      'Modulo Proyectos - Ordenes de Trabajo - Fotografías',
      this.trackingService.getEmail()
    );
    
    if (!this.fotografiaGridApi) {
      alerts.basicAlert('Error', 'Grid no disponible', 'error');
      return;
    }

    const selectedNodes = this.fotografiaGridApi.getSelectedNodes();
    if (selectedNodes.length === 0) {
      alerts.basicAlert('Error', 'Seleccione una entrada de fotografía para eliminar', 'error');
      return;
    }

    const selectedData = selectedNodes[0].data;
    const id = selectedData.id;

    console.log('=== INTENTANDO ELIMINAR FOTOGRAFÍA ===');
    console.log('Registro seleccionado para eliminar:', selectedData);
    console.log('ID a eliminar:', id);
    
    alerts.confirmAlert(
      'Eliminar fotografía',
      '¿Está seguro que desea eliminar este registro de fotografía?',
      'warning',
      'Sí, eliminar'
    ).then((value) => {
      if (value.isConfirmed) {
        if (selectedData.__isNew) {
          this.fotografias = this.fotografias.filter(f => f.id !== id);
          this.notSavedFotografiaChanges = this.fotografias.some(f => f.__isNew);
          alerts.basicAlert('Éxito', 'Fotografía eliminada correctamente', 'success');
        } else {
          this.logbookService.deleteDataForOt(Number(id)).subscribe({
            next: (response) => {
              this.fotografias = this.fotografias.filter(f => f.id !== id);
              alerts.basicAlert('Éxito', 'Fotografía eliminada correctamente del servidor', 'success');
            },
            error: (error) => {
              console.error('Error al eliminar fotografía del servidor:', error);
              let errorMessage = 'Error al eliminar el registro de fotografía';
              if (error.status === 404) {
                errorMessage = 'El registro ya no existe en el servidor';
              } else if (error.status === 401) {
                errorMessage = 'No autorizado para eliminar este registro';
              }
              alerts.basicAlert('Error', errorMessage, 'error');
            }
          });
        }
      }
    });
  }

  deleteVideo(){
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Eliminar Video OT',
      'Modulo Proyectos - Ordenes de Trabajo - Videos',
      this.trackingService.getEmail()
    );
    
    if (!this.videoGridApi) {
      alerts.basicAlert('Error', 'Grid no disponible', 'error');
      return;
    }

    const selectedNodes = this.videoGridApi.getSelectedNodes();
    if (selectedNodes.length === 0) {
      alerts.basicAlert('Error', 'Seleccione una entrada de video para eliminar', 'error');
      return;
    }

    const selectedData = selectedNodes[0].data;
    const id = selectedData.id;

    console.log('=== INTENTANDO ELIMINAR VIDEO ===');
    console.log('Registro seleccionado para eliminar:', selectedData);
    console.log('ID a eliminar:', id);
    
    alerts.confirmAlert(
      'Eliminar video',
      '¿Está seguro que desea eliminar este registro de video?',
      'warning',
      'Sí, eliminar'
    ).then((value) => {
      if (value.isConfirmed) {
        if (selectedData.__isNew) {
          this.videos = this.videos.filter(v => v.id !== id);
          this.notSavedVideoChanges = this.videos.some(v => v.__isNew);
          alerts.basicAlert('Éxito', 'Video eliminado correctamente', 'success');
        } else {
          this.logbookService.deleteDataForOt(Number(id)).subscribe({
            next: (response) => {
              this.videos = this.videos.filter(v => v.id !== id);
              alerts.basicAlert('Éxito', 'Video eliminado correctamente del servidor', 'success');
            },
            error: (error) => {
              console.error('Error al eliminar video del servidor:', error);
              let errorMessage = 'Error al eliminar el registro de video';
              if (error.status === 404) {
                errorMessage = 'El registro ya no existe en el servidor';
              } else if (error.status === 401) {
                errorMessage = 'No autorizado para eliminar este registro';
              }
              alerts.basicAlert('Error', errorMessage, 'error');
            }
          });
        }
      }
    });
  }

  // Variables para el grid de reportes
  public reportesGridApi!: GridApi;
  
  // Variables para el grid de personal
  public personalGridApi!: GridApi;
  
  // Variables para el grid de materiales
  public materialesGridApi!: GridApi;

  public fotografiaGridApi!: GridApi;

  public videoGridApi!: GridApi;

  public notasGridApi!: GridApi;

  // Grid options específico para notas
  public notasGridOptions: any = {
    headerHeight: 35,
    rowHeight: 30,
    suppressDragLeaveHidesColumns: true,
    suppressHorizontalScroll: false,
    animateRows: true,
    pagination: false,
    domLayout: 'autoHeight',
    stopEditingWhenCellsLoseFocus: true,
    rowSelection: 'single',
    onCellValueChanged: (event: any) => this.onCellValueChangedNota(event),
    onGridReady: (params: any) => this.onNotasGridReady(params)
  };
  
  // Variables para el grid de equipos
  public equiposGridApi!: GridApi;

  public conceptosGridApi!: GridApi;

  // Configuración del grid principal
  public gridApi!: GridApi;

  public gridOptions: any = {
    headerHeight: 35,
    rowHeight: 25,
    suppressDragLeaveHidesColumns: true,
    suppressHorizontalScroll: true,
    animateRows: true,
    pagination: false,
    domLayout: 'normal',
    groupDefaultExpanded: 1,
    autoGroupColumnDef: {
      headerName: 'Grupo',
      field: 'ag-Grid-AutoColumn',
      width: 150,
      cellRendererParams: {
        suppressCount: false
      }
    },
    onCellDoubleClicked: (event: any) => this.onOTCellDoubleClicked(event),
  };

  // Configuraciones de grid para las pestañas
  public tabGridOptions: any = {
    headerHeight: 35,
    rowHeight: 30,
    suppressDragLeaveHidesColumns: true,
    suppressHorizontalScroll: false,
    animateRows: true,
    pagination: false,
    domLayout: 'autoHeight',
    stopEditingWhenCellsLoseFocus: true,
    rowSelection: 'single',
    onCellValueChanged: (event: any) => this.onCellValueChangedConcepto(event),
    onGridReady: (params: any) => this.onConceptosGridReady(params)
  };

  // Configuración específica para el grid de personal con edición
  public personalGridOptions: any = {
    headerHeight: 35,
    rowHeight: 30,
    suppressDragLeaveHidesColumns: true,
    suppressHorizontalScroll: false,
    animateRows: true,
    pagination: false,
    domLayout: 'autoHeight',
    stopEditingWhenCellsLoseFocus: true,
    rowSelection: 'single',
    onCellValueChanged: (event: any) => this.onPersonalCellValueChanged(event),
    onGridReady: (params: any) => this.onPersonalGridReady(params)
  };

   public fotografiasGridOptions: any = {
    headerHeight: 35,
    rowHeight: 30,
    suppressDragLeaveHidesColumns: true,
    suppressHorizontalScroll: false,
    animateRows: true,
    pagination: false,
    domLayout: 'autoHeight',
    stopEditingWhenCellsLoseFocus: true,
    rowSelection: 'single',
    onCellValueChanged: (event: any) => this.onCellValueChangedFotografia(event),
    onGridReady: (params: any) => this.onFotografiasGridReady(params)
  };

  public videosGridOptions: any = {
    headerHeight: 35,
    rowHeight: 30,
    suppressDragLeaveHidesColumns: true,
    suppressHorizontalScroll: false,
    animateRows: true,
    pagination: false,
    domLayout: 'autoHeight',
    stopEditingWhenCellsLoseFocus: true,
    rowSelection: 'single',
    onCellValueChanged: (event: any) => this.onCellValueChangedVideo(event),
    onGridReady: (params: any) => this.onVideosGridReady(params)
  };

  // Configuración específica para el grid de reportes con edición inline
  public reportesGridOptions: any = {
    headerHeight: 30,
    rowHeight: 30,
    suppressDragLeaveHidesColumns: true,
    suppressHorizontalScroll: false,
    animateRows: true,
    pagination: false,
    domLayout: 'autoHeight',
    stopEditingWhenCellsLoseFocus: true,
    onCellValueChanged: (event: any) => this.onCellValueChangedReportes(event),
    onGridReady: (params: any) => this.onReportesGridReady(params)
  };

  // Configuración específica para el grid de materiales con edición
  public materialesGridOptions: any = {
    headerHeight: 35,
    rowHeight: 30,
    suppressDragLeaveHidesColumns: true,
    suppressHorizontalScroll: false,
    animateRows: true,
    pagination: false,
    domLayout: 'autoHeight',
    stopEditingWhenCellsLoseFocus: true,
    rowSelection: 'single',
    onCellValueChanged: (event: any) => this.onMaterialCellValueChanged(event),
    onGridReady: (params: any) => this.onMaterialesGridReady(params)
  };

  public equiposGridOptions: any = {
    headerHeight: 35,
    rowHeight: 30,
    suppressDragLeaveHidesColumns: true,
    suppressHorizontalScroll: false,
    animateRows: true,
    pagination: false,
    domLayout: 'autoHeight',
    stopEditingWhenCellsLoseFocus: true,
    rowSelection: 'single',
    onCellValueChanged: (event: any) => this.onCellValueChangedEquipo(event),
    onGridReady: (params: any) => this.onEquiposGridReady(params)
  };


  // Datos del grid obtenidos del servicio
  public rowData: OrdenesData[] = [];

  constructor(private formBuilder: FormBuilder) {
    // Initialize form immediately in constructor
    
    
    // Log de acceso al componente
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Acceso a Ordenes de Trabajo',
      'Modulo Proyectos - Ordenes de Trabajo',
      this.trackingService.getEmail()
    );
    
    effect(() => {
      this.idProject =this.signalsService.getProjectSelectedBySidebar()();
      this.idcompany = this.signalsService.getRootSelectedBySidebar()();
      
      //alert(this.signalsService.getClosedReport()())
      //this.selectedStatusReport = this.signalsService.getClosedReport()();
      this.catalogoMateriales();
      this.catalogoEquipo();
      this.obtenerTypeNotes();
      this.obtenerConceptos();
      this.obtenerProyectos();
      this.loadEmployees();
      this.getDeptoandPosition();
      this.obtenerUnidades();
      this.filtrarTipoReporte(this.tipoReporte);
    });

    // Effect para auto-actualizar PDF cuando se guarden cambio

    this.loadColumnSizes();
  }

  ngOnInit(): void {
    const hoy = new Date();
    const hace7Dias = new Date();
    hace7Dias.setDate(hoy.getDate() - 7);
    const hoyStr = hoy.toISOString().split('T')[0];
    const hace7DiasStr = hace7Dias.toISOString().split('T')[0];
    const semana = this.obtenerNumeroSemana(hoy);
    const mes = this.obtenerAnoMes(hoy);
    console.log("fechas", hoyStr, hace7DiasStr)
    this.myForm = this.formBuilder.group({
      opcionSeleccionada: ['', Validators.required],
      seleccionNumerica: this.formBuilder.array([]),
      tipoReporte: [this.tipoReporte, Validators.required],
      fechaInicio: [hace7DiasStr, Validators.required],
      semanaSelect: [semana],
      mesSelect: [mes],
      fechaFin: [hoyStr, Validators.required]
    });
     this.myForm.get('semanaSelect')?.valueChanges.subscribe(value => {
    if (this.tipoReporte === 'semanal') {
      this.filtrarTipoReporte('semanal');
    }
  });

  this.myForm.get('mesSelect')?.valueChanges.subscribe(value => {
    if (this.tipoReporte === 'mensual') {
      this.filtrarTipoReporte('mensual');
    }
  });

  this.myForm.get('fechaInicio')?.valueChanges.subscribe(() => {
    if (this.tipoReporte === 'personalizado') {
      this.filtrarTipoReporte('personalizado');
    }
  });

  this.myForm.get('fechaFin')?.valueChanges.subscribe(() => {
    if (this.tipoReporte === 'personalizado') {
      this.filtrarTipoReporte('personalizado');
    }
  });

    // Iniciar SignalR connection para sistema reactivo
    const token = this.trackingService.getAuthToken();
    console.log('Iniciando conexión SignalR con token:', token);
    this.signalrService.startConnection('storageHub', token);

    console.log('SignalR connection info:', this.signalrService.getConnectionInfo());
    
    // Configurar listeners para updates en tiempo real
    this.setupSignalRListeners();
  }
  filtrarTipoReporte(type: string) {
  const fechaInicio = this.myForm.get('fechaInicio')?.value;
  const fechaFin = this.myForm.get('fechaFin')?.value;
  const semana = this.myForm.get('semanaSelect')?.value;
  const mes = this.myForm.get('mesSelect')?.value;

  if (type === 'personalizado') {
    this.fechaInicio = fechaInicio;
    this.fechaFin = fechaFin;
    //alert(`Filtrado por fechas personalizadas: ${this.fechaInicio} a ${this.fechaFin}`);
  }

  if (type === 'semanal' && semana) {
    const [añoStr, semanaIsoStr] = semana.split('-W');
    const año = parseInt(añoStr, 10);
    const numSemana = parseInt(semanaIsoStr, 10);

    // ISO 8601: semana empieza en lunes
    const simple = new Date(año, 0, 1 + (numSemana - 1) * 7);
    const dia = simple.getDay();
    const ISOsemanaInicio = new Date(simple);

    // Ajustar al lunes (ISO)
    const diferenciaLunes = (dia <= 4 ? dia - 1 : dia - 8); 
    ISOsemanaInicio.setDate(simple.getDate() - diferenciaLunes);

    const ISOsemanaFin = new Date(ISOsemanaInicio);
    ISOsemanaFin.setDate(ISOsemanaInicio.getDate() + 6);

    this.fechaInicio = ISOsemanaInicio.toISOString().slice(0, 10); // YYYY-MM-DD
    this.fechaFin = ISOsemanaFin.toISOString().slice(0, 10);       // YYYY-MM-DD
    //alert(`Filtrado por fechas personalizadas: ${this.fechaInicio} a ${this.fechaFin}`);
  }

  if (type === 'mensual' && mes) {
    // mes es algo como "2025-08"
    const [añoStr, mesStr] = mes.split('-');
    const año = parseInt(añoStr, 10);
    const mesNum = parseInt(mesStr, 10);

    // Fecha inicio = primer día del mes
    const inicio = new Date(año, mesNum - 1, 1);

    // Fecha fin = último día del mes
    const fin = new Date(año, mesNum, 0); // día 0 del mes siguiente = último del actual

    this.fechaInicio = inicio.toISOString().slice(0, 10); // YYYY-MM-DD
    this.fechaFin = fin.toISOString().slice(0, 10);       // YYYY-MM-DD
    //alert(`Filtrado por fechas personalizadas: ${this.fechaInicio} a ${this.fechaFin}`);
  }
}


  loadEmployees() {
    const idRoot = this.signalsService.getRootSelectedBySidebar()();
    const idBranch = -idRoot; // Convertir a negativo como se solicita

    this.employeesService.getEmployees(idBranch).subscribe({
      next: (response: any) => {
        if (response && Array.isArray(response)) {
          // El endpoint devuelve directamente un array de empleados
          this.employees = response;
          console.log('Empleados cargados:', this.employees);
        } else if (response && response.data && Array.isArray(response.data)) {
          // Por si acaso viene encapsulado en un objeto con propiedad data
          this.employees = response.data;
          console.log('Empleados cargados (desde data):', this.employees);
        } else {
          this.employees = [];
          console.log('No se encontraron empleados o formato inesperado:', response);
        }
      },
      error: (error) => {
        console.error('Error al cargar empleados:', error);
        this.employees = [];
      }
    });
  }

  // ========================= SignalR Methods =========================
  
      // Configurar listeners de SignalR para sistema reactivo multi-usuario
    private setupSignalRListeners(): void {
        console.log('🎧 Configurando listeners del componente ordenes...');

        // Escuchar actualizaciones de texto/reportes
        this.signalrService.textUpdate$.subscribe(logbookData => {
          console.log('📝 COMPONENTE RECIBIÓ textUpdate$:', logbookData);
          if (logbookData && this.shouldUpdateForLogbook(logbookData)) {
            console.log('📝 Nuevo reporte recibido para esta OT:', logbookData);
            this.handleDailyReportUpdate(logbookData);
          } else if (logbookData) {
            console.log('📝 Reporte recibido pero no es para la OT actual. IdOt del evento:', logbookData.IdOt || logbookData.idOt, 'OT actual:', this.selectedOt?.id);
          }
        });

        // Escuchar actualizaciones de fotos
        this.signalrService.photoUpdate$.subscribe(photoData => {
          console.log('📸 COMPONENTE RECIBIÓ photoUpdate$:', photoData);
          if (photoData && this.shouldUpdateForLogbook(photoData)) {
            console.log('📸 Nueva foto recibida para esta OT:', photoData);
            this.handlePhotoUpdate(photoData);
          } else if (photoData) {
            console.log('📸 Foto recibida pero no es para la OT actual. IdOt del evento:', photoData.IdOt || photoData.idOt, 'OT actual:', this.selectedOt?.id);
          }
        });

          // Escuchar nuevos reportes diarios
      this.signalrService.newDailyReport$.subscribe(reportData => {
        console.log('📊 COMPONENTE RECIBIÓ newDailyReport$:', reportData);
        if (reportData && this.shouldUpdateForDailyReport(reportData)) {
          console.log('📊 Nuevo reporte diario recibido para esta OT:', reportData);
          this.handleDailyReportUpdate(reportData);
        } else if (reportData) {
          console.log('📊 Reporte diario recibido pero no es para la OT actual. IdOt del evento:', reportData.IdOt || reportData.idOt, 'OT actual:', this.selectedOt?.id);
        }
      });

        console.log('✅ Listeners del componente configurados correctamente');

    }

    // Verificar si el update es relevante para la OT actual
    private shouldUpdateForLogbook(logbookData: any): boolean {
      // Verificar si hay OT seleccionada
      if (!this.selectedOt) return false;
      
      // Verificar si el update es para la OT actual
      const currentOtId = parseInt(this.selectedOt.id);
      const logbookOtId = logbookData.IdOt || logbookData.idOt;
      
      return currentOtId === logbookOtId;
    }

    // Manejar actualizaciones de fotos en tiempo real
    private handlePhotoUpdate(photoData: any): void {
      console.log('✅ Actualizando fotos por SignalR...');
      
      // Si hay un reporte seleccionado, recargar sus fotos
      if (this.selectedReporteId) {
        this.obtenerFotografias(this.selectedReporteId);
      }
      
      // También recargar reportes por si cambió algo en el grid
      this.loadDailyReports();
    }

    // Verificar si el update de reporte diario es relevante para la OT actual
    private shouldUpdateForDailyReport(reportData: any): boolean {
    // Verificar si hay OT seleccionada
    if (!this.selectedOt) return false;
    
    // Verificar si el update es para la OT actual
    const currentOtId = parseInt(this.selectedOt.id);
    const reportOtId = reportData.IdOt || reportData.idOt;
    
    return currentOtId === reportOtId;
    }

    // Manejar actualizaciones de reportes diarios en tiempo real
    private handleDailyReportUpdate(reportData: any): void {
      console.log('✅ Actualizando reportes diarios por SignalR...');
      
      // Recargar reportes diarios para mostrar el nuevo reporte
      this.loadDailyReports();
      
      // Mostrar notificación opcional (descomentarla si quieres notificaciones visuales)
      // alerts.basicAlert('Nuevo Reporte Diario', 'Se creó un nuevo reporte diario para esta OT', 'info');
    }

  // ========================= SignalR Debug Methods =========================
  
  // Método público para debugging - llamar desde consola del navegador
  public debugSignalR(): void {
    console.log('🐛 === DEBUG SIGNALR ===');
    const info = this.signalrService.getConnectionInfo();
    console.log('📊 Info de conexión:', info);
    console.log('📍 OT seleccionada:', this.selectedOt?.id);
    console.log('🧪 Enviando mensaje de prueba...');
    this.signalrService.sendTestMessage();
  }

  // Método para forzar reconexión
  public reconnectSignalR(): void {
    console.log('🔄 Forzando reconexión SignalR...');
    this.signalrService.stopConnection();
    setTimeout(() => {
      this.signalrService.startConnection();
    }, 1000);
  }

  // ========================= End SignalR Methods =========================

  obtenerDatos() {
    // Verificar si el usuario tiene permisos para ver todas las OTs de todos los proyectos
    if (this.authService.hasDetailedPermission('projects', 'get-all-ot')) {
      console.log('Usuario tiene permisos para ver todas las OTs de todos los proyectos');
      this.obtenerTodasLasOTs();
    } else {
      console.log('Usuario solo puede ver OTs del proyecto actual');
      this.obtenerOTsDelProyectoActual();
    }
  }

  obtenerOTsDelProyectoActual() {
    this.otService.getOtListByProject(this.idProject).subscribe({
      next: (data: any) => {
        console.log('Datos obtenidos del servicio OT para proyecto actual:', data);
        this.rowData = data;
        
        // Actualizar catálogo de conceptos después de cargar los datos
        if (this.idProject) {
          this.obtenerConceptos();
        }
        
        this.trackingService.addLog(
          this.trackingService.getnameComp(),
          'Get Lista de OT - Proyecto Actual',
          'Menu Proyectos Ordenes de Trabajo',
          this.trackingService.getEmail()
        );
      },
      error: (error) => {
        console.error('Error al obtener datos de OT del proyecto actual:', error);
        this.rowData = [];
      },
    });
  }

  async obtenerTodasLasOTs() {
    try {
      console.log('Obteniendo OTs de todos los proyectos...');
      const allOTs: any[] = [];
      
      // Usar la lista de proyectos que ya tenemos cargada
      if (this.projectsList && this.projectsList.length > 0) {
        console.log(`Procesando ${this.projectsList.length} proyectos:`, this.projectsList);
        
        // Crear un array de promesas para obtener las OTs de cada proyecto
        const otPromises = this.projectsList.map(project => 
          firstValueFrom(this.otService.getOtListByProject(project.id))
            .then((ots: any[]) => {
              console.log(`Proyecto ${project.name} (ID: ${project.id}): ${ots.length} OTs`);
              return ots || [];
            })
            .catch((error) => {
              console.error(`Error obteniendo OTs del proyecto ${project.name}:`, error);
              return [];
            })
        );
        
        // Ejecutar todas las peticiones en paralelo
        const allProjectOTs = await Promise.all(otPromises);
        
        // Combinar todos los resultados
        allProjectOTs.forEach(projectOTs => {
          allOTs.push(...projectOTs);
        });
        
        console.log(`Total de OTs obtenidas de todos los proyectos: ${allOTs.length}`);
        this.rowData = allOTs;
        
        // Actualizar catálogo de conceptos después de cargar los datos
        if (this.idProject) {
          this.obtenerConceptos();
        }
        
        this.trackingService.addLog(
          this.trackingService.getnameComp(),
          'Get Lista de OT - Todos los Proyectos',
          'Menu Proyectos Ordenes de Trabajo',
          this.trackingService.getEmail()
        );
      } else {
        console.log('No hay proyectos disponibles, obteniendo del proyecto actual');
        this.obtenerOTsDelProyectoActual();
      }
    } catch (error) {
      console.error('Error al obtener todas las OTs:', error);
      // Fallback al método original
      this.obtenerOTsDelProyectoActual();
    }
  }

  // Métodos del grid
  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    // Remover sizeColumnsToFit para que funcione el flex
    // params.api.sizeColumnsToFit();
  }

  onSelectionChanged(event: any) {
    const selectedRows = this.gridApi.getSelectedRows();
    console.log('Filas seleccionadas:', selectedRows);
    const cuadrilla = this.projectsList.find(p => p.id === selectedRows[0].idProject);
    console.log('Cuadrilla seleccionada:', cuadrilla.name);
    if(cuadrilla.name == "ADMON TD"){
      this.cuadrillaSelect = "";
    }else{
      console.log('Cuadrilla seleccionada:', cuadrilla.name);
      const select = cuadrilla.name.split('-');
      const numero = parseInt(select[1], 10);
      this.cuadrillaSelect = `${numero}`;
    }
    console.log('Cuadrilla seleccionada:', this.cuadrillaSelect);
    // Actualizar la OT seleccionada para mostrar en la vista previa
    // Si hay múltiples selecciones, usar la primera para la vista previa
    if (selectedRows.length > 0) {
      this.selectedOt = selectedRows[0];
      this.activeTab = 'reportes'; // Resetear a la primera pestaña
      
      // Limpiar selección de reporte anterior
      this.selectedReporteFecha = '';
      this.selectedReporteTipo = '';
      this.selectedReporteHoraInicio = '';
      this.selectedReporteHoraTermino = '';
      this.selectedReporteArea = selectedRows[0].area
      this.selectedReporteId = null;
      
      // Resetear vista previa del PDF
      this.showPdfEmbed = false;
      this.pdfUrl = null;
      if (this.originalUrl) {
        URL.revokeObjectURL(this.originalUrl);
        this.originalUrl = null;
      }
      
      console.log('OT seleccionada para vista previa:', this.selectedOt);
      console.log('Total OTs seleccionadas:', selectedRows.length);
      
      // Verificar si hay proyecto seleccionado/detectado solo si hay OTs seleccionadas
      if (selectedRows.length > 0) {
        const detectedProject = this.detectProjectFromData();
        if (!detectedProject) {
          console.log('⚠️ No hay proyecto seleccionado. Se requiere seleccionar proyecto en sidebar.');
          // Solo mostrar alerta si se está intentando trabajar con conceptos o materiales
          // alerts.basicAlert(
          //   'Proyecto Requerido', 
          //   'Por favor selecciona un proyecto en el sidebar izquierdo antes de trabajar con las OTs. Esto es necesario para cargar correctamente los catálogos de conceptos y materiales.', 
          //   'warning'
          // );
        } else {
          console.log('✅ Proyecto detectado:', detectedProject);
        }
      }
      
      // Cargar reportes diarios para esta OT
      this.loadDailyReports();
      
      // Cargar datos de Personal para esta OT
      this.loadPersonalData();
    } else {
      this.selectedOt = null;
    }
  }

  getSelectedOTs(): any[] {
    return this.gridApi ? this.gridApi.getSelectedRows() : [];
  }

  openChangeProjectModal() {
    if (!this.hasMultiSelectPermission) {
      alerts.basicAlert('Error', 'No tiene permisos para realizar esta acción.', 'error');
      return;
    }

    const selectedOTs = this.getSelectedOTs();
    if (selectedOTs.length === 0) {
      alerts.basicAlert('Error', 'Debe seleccionar al menos una OT para cambiar de proyecto.', 'error');
      return;
    }
    
    this.selectedNewProject = '';
    const modal = new bootstrap.Modal(document.getElementById('changeProjectModal')!);
    modal.show();
  }

  async changeProjectForSelectedOTs() {
    if (!this.selectedNewProject) {
      alerts.basicAlert('Error', 'Debe seleccionar un proyecto.', 'error');
      return;
    }

    const selectedOTs = this.getSelectedOTs();
    if (selectedOTs.length === 0) {
      alerts.basicAlert('Error', 'No hay OTs seleccionadas.', 'error');
      return;
    }

    this.isChangingProject = true;

    try {      
      const confirmResult = await alerts.confirmAlert(
        '¿Confirmar cambio?',
        `¿Está seguro de cambiar ${selectedOTs.length} OT(s) de proyecto? Esta acción no se puede deshacer.`,
        'warning',
        'Confirmar'
      );

      if (!confirmResult.isConfirmed) {
        this.isChangingProject = false;
        return;
      }

      for (const ot of selectedOTs) {
        await firstValueFrom(this.otService.updateOt(ot.id, {
          ...ot,
          idProject: this.selectedNewProject
        }));
      }

      // Cerrar modal
      const modal = bootstrap.Modal.getInstance(document.getElementById('changeProjectModal')!);
      modal?.hide();

      // Recargar datos
      this.obtenerDatos();
      
      alerts.basicAlert('Éxito', `Se cambiaron ${selectedOTs.length} OT(s) de proyecto exitosamente.`, 'success');
      
    } catch (error) {
      console.error('Error al cambiar proyecto:', error);
      alerts.basicAlert('Error', 'Error al cambiar el proyecto de las OTs.', 'error');
    } finally {
      this.isChangingProject = false;
    }
  }

  onOTCellDoubleClicked(event: any) {
    console.log('Cell double click event:', event);
    console.log('Column:', event.column);
    console.log('Column field:', event.column?.colDef?.field);
    console.log('Row data:', event.data);
    
    const rowData = event.data;
    const column = event.column;
    
    // Navegar si el doble click es en la columna "OT" o "Resultados"
    if (column && column.colDef && (column.colDef.field === 'otNumber' || column.colDef.field === 'results')) {
      console.log(`Navigating to OT details from ${column.colDef.field} column...`);
      if (rowData && rowData.id) {
        console.log('Navigating with ID:', rowData.id);
        this.router.navigate(['/projects/ot/details', rowData.id]);
      } else {
        console.log('No ID found in row data');
      }
    } else {
      console.log('Not clicking on navigation column, field is:', column?.colDef?.field);
    }
  }

  onProjectChangedWithConfirmation(params: any) {
    console.log('Project change requested for OT:', params.data);
    console.log('New project ID:', params.newValue);
    console.log('Old project ID:', params.oldValue);
    
    if (params.newValue !== params.oldValue) {
      const oldProject = this.projectsList.find(p => p.id === params.oldValue);
      const newProject = this.projectsList.find(p => p.id === params.newValue);
      
      const oldProjectName = oldProject ? oldProject.name : params.oldValue;
      const newProjectName = newProject ? newProject.name : params.newValue;
      
      alerts.confirmAlert(
        'Cambiar Proyecto de OT',
        `¿Está seguro que desea cambiar esta orden de trabajo del proyecto "${oldProjectName}" al proyecto "${newProjectName}"?`,
        'question',
        'Sí, cambiar proyecto'
      ).then((result) => {
        if (result.isConfirmed) {
          // Usuario confirmó el cambio
          this.onProjectChanged(params);
        } else {
          // Usuario canceló, revertir el cambio
          console.log('Cambio de proyecto cancelado por el usuario');
          params.data.idProject = params.oldValue;
          params.api.refreshCells({ rowNodes: [params.node], force: true });
        }
      });
    }
  }

  onProjectChanged(params: any) {
    console.log('Project changed for OT:', params.data);
    console.log('New project ID:', params.newValue);
    console.log('Old project ID:', params.oldValue);
    
    const otId = params.data.id;
    const updatedOtData = { ...params.data };
    
    console.log('Updating OT with ID:', otId);
    console.log('Updated data:', updatedOtData);
    
    this.otService.updateOt(otId, updatedOtData).subscribe({
      next: (response: any) => {
        console.log('OT updated successfully:', response);
        const oldProject = this.projectsList.find(p => p.id === params.oldValue);
        const newProject = this.projectsList.find(p => p.id === params.newValue);
        const oldProjectName = oldProject ? oldProject.name : params.oldValue;
        const newProjectName = newProject ? newProject.name : params.newValue;
        
        this.trackingService.addLog(
          this.trackingService.getnameComp(),
          `Proyecto cambiado de ${oldProjectName} a ${newProjectName} para OT ${params.data.otNumber}`,
          'Menu Proyectos Ordenes de Trabajo',
          this.trackingService.getEmail()
        );

        alerts.basicAlert(
          'Proyecto Actualizado',
          `La orden de trabajo ${params.data.otNumber} ha sido movida exitosamente al proyecto ${newProjectName}.`,
          'success'
        );

        // Refrescar la tabla para mostrar los cambios
        this.obtenerDatos();
      },
      error: (error: any) => {
        console.error('Error updating OT:', error);
        alerts.basicAlert(
          'Error al Cambiar Proyecto',
          'Ocurrió un error al intentar cambiar el proyecto de la orden de trabajo. Por favor, inténtelo nuevamente.',
          'error'
        );
        // Revertir el cambio en caso de error
        params.data.idProject = params.oldValue;
        params.api.refreshCells({ rowNodes: [params.node], force: true });
      }
    });
  }

  // Métodos para pestañas y vista previa
  setActiveTab(tab: string) {
    this.activeTab = tab;
    console.log('Pestaña activa:', tab);
  }

  selectReporte(reporte: ReporteDiario) {
    // Limpiar selecciones previas
    this.selectedFotografia = null;
    this.selectedVideo = null;
    
    // Verificar que el proyecto del sidebar coincida con el proyecto de la OT
    const sidebarProjectId = this.signalsService.getProjectSelectedBySidebar()();
    const otProjectId = this.selectedOt?.idProject;
    
    console.log('🔍 Comparando proyectos:');
    console.log('  - Sidebar Project ID:', sidebarProjectId);
    console.log('  - OT Project ID:', otProjectId);
    
    // Obtener nombres de proyectos usando projectsList
    const sidebarProject = this.projectsList.find(p => p.id === sidebarProjectId);
    const otProject = this.projectsList.find(p => p.id === otProjectId);
    
    const sidebarProjectName = sidebarProject?.name || '';
    const otProjectName = otProject?.name || '';
    const hasPermission = this.authService.hasDetailedPermission('projects', 'get-all-ot');
    console.log('  - Sidebar Project Name:', sidebarProjectName);
    console.log('  - OT Project Name:', otProjectName);
    
    // Validar que ambos proyectos coincidan
    if (!hasPermission) {
      console.log('⚠️ Los proyectos no coinciden, mostrando alerta');
      alerts.basicAlert(
        'Proyecto Requerido', 
        `El proyecto seleccionado en el sidebar (${sidebarProjectName || 'ninguno'}) debe coincidir con el proyecto de la OT (${otProjectName}). Por favor selecciona el proyecto correcto en el sidebar izquierdo.`, 
        'warning'
      );
    } else {
      console.log('✅ Los proyectos coinciden correctamente');
    }
    
    this.selectedReporteFecha = reporte.fecha || reporte.date.split('T')[0];
    this.selectedReporteTipo = reporte.tipoNota || reporte.type;
    this.selectedReporteHoraInicio = reporte.horaInicio || reporte.startTime.substring(0, 5);
    this.selectedReporteHoraTermino = reporte.horaTermino || reporte.endTime.substring(0, 5);
    this.selectedReporteId = reporte.id;
    console.log(reporte)
    const id: number = Number(this.selectedReporteId);
    //this.updateExcelService.UpdateOT(id)
    this.signalsService.setClosedReport(reporte.close)
    this.obtenerMateriales(this.selectedReporteId);
    this.obtenerEquipos(this.selectedReporteId);
    this.obtenerPersonal(this.selectedReporteId);
    this.obtenerFotografias(this.selectedReporteId);
    this.obtenerVideos(this.selectedReporteId);
    this.obtenerNotas(this.selectedReporteId);
    this.obtenerConcep(this.selectedReporteId);
    
    // Actualizar selección visual en el grid
    if (this.reportesGridApi) {
      // Encontrar el índice del reporte seleccionado
      const reporteIndex = this.reportesDiarios.findIndex(r => r.id === reporte.id);
      
      if (reporteIndex >= 0) {
        // Limpiar selecciones anteriores
        this.reportesGridApi.deselectAll();
        // Seleccionar la fila correspondiente
        const rowNode = this.reportesGridApi.getDisplayedRowAtIndex(reporteIndex);
        
        if (rowNode) {
          rowNode.setSelected(true);
          // Asegurar que la fila sea visible
          this.reportesGridApi.ensureIndexVisible(reporteIndex);
        }
      }
    }

    // Resetear vista previa del PDF cuando se selecciona nueva fecha
    this.showPdfEmbed = false;
    this.pdfUrl = null;
    if (this.originalUrl) {
      URL.revokeObjectURL(this.originalUrl);
      this.originalUrl = null;
    }
    
    console.log('Reporte seleccionado:', {
      id: this.selectedReporteId,
      fecha: this.selectedReporteFecha,
      tipo: this.selectedReporteTipo,
      horaInicio: this.selectedReporteHoraInicio,
      horaTermino: this.selectedReporteHoraTermino
    });
    console.log('Datos completos del reporte:', reporte);
  }

  getReporteRowClass = (params: any) => {
    const fecha = params.data.fecha || params.data.date?.split('T')[0];
    const tipo = params.data.tipoNota || params.data.type;
    
    if (this.selectedReporteFecha === fecha && this.selectedReporteTipo === tipo) {
      return 'ag-row-selected';
    }
    return '';
  };

  selectFotografia(fotografia: any) {
    // Map the data from the grid to the expected Fotografia interface
    this.selectedFotografia = {
      id: fotografia.id,
      nombre: fotografia.nombre || '',
      descripcion: fotografia.descripcion || '',
      fecha: fotografia.fecha || '',
      url: fotografia.imageUrl || fotografia.url || '' // Use imageUrl from grid or fallback to url
    };
    console.log('Fotografía seleccionada:', this.selectedFotografia);
  }

  selectVideo(video: any) {
    // Map the data from the grid to the expected Video interface
    // La URL del video está en el campo 'imageUrl'
    const videoUrl = video.imageUrl || video.videoUrl || video.url || '';
    
    this.selectedVideo = {
      id: video.id,
      nombre: video.nombre || '',
      descripcion: video.descripcion || '',
      fecha: video.fecha || '',
      url: videoUrl
    };
    
    console.log('Video seleccionado:', this.selectedVideo);
    console.log('Video original (con imageUrl):', video);
    console.log('URL del video:', videoUrl);
  }

  // Función helper para convertir tiempo a ticks de .NET
  timeToTicks(timeString: string): number {
    const parts = timeString.split(':');
    const hours = parseInt(parts[0]) || 0;
    const minutes = parseInt(parts[1]) || 0;
    const seconds = parseInt(parts[2]) || 0;
    
    // Convertir a ticks de .NET (100 nanosegundos = 1 tick)
    const totalSeconds = hours * 3600 + minutes * 60 + seconds;
    return totalSeconds * 10000000; // 10,000,000 ticks por segundo
  }

  // Grid ready para reportes
  onReportesGridReady(params: any) {
    this.reportesGridApi = params.api;
    // Remover sizeColumnsToFit para respetar flex
    // params.api.sizeColumnsToFit();
  }

  // Controlar qué celda es editable
  isCellEditable(params: any, field: string): boolean {
    return params.rowIndex === this.currentEditingRow && field === this.currentEditingCol;
  }

  // Navegación personalizada con Enter - orden correcto
  tabToNextCell(params: any) {
    const columnsOrder = ['fecha', 'horaInicio', 'horaTermino', 'tipoNota', 'supervisor', 'descripcion'];
    const currentColIndex = columnsOrder.indexOf(params.previousCellPosition.column.colId);
    
    if (currentColIndex < columnsOrder.length - 1) {
      // Mover a la siguiente columna
      const nextColumn = columnsOrder[currentColIndex + 1];
      this.currentEditingRow = params.previousCellPosition.rowIndex;
      this.currentEditingCol = nextColumn;
      
      // Refrescar el grid para aplicar la nueva editabilidad
      setTimeout(() => {
        if (this.reportesGridApi) {
          this.reportesGridApi.refreshCells();
        }
      }, 0);
      
      return {
        rowIndex: params.previousCellPosition.rowIndex,
        column: nextColumn
      };
    } else {
      // Fin de la fila - limpiar edición
      this.currentEditingRow = -1;
      this.currentEditingCol = '';
      setTimeout(() => {
        if (this.reportesGridApi) {
          this.reportesGridApi.refreshCells();
        }
      }, 0);
      return null;
    }
  }

  // Métodos para manejo de edición inline en el grid
  onCellValueChanged(event: any) {
    const data = event.data;
    const field = event.colDef.field;
    const newValue = event.newValue;
    const oldValue = event.oldValue;

    if (newValue !== oldValue) {
      // Para filas nuevas (__isNew), solo marcar cambios sin hacer POST
      if (data.__isNew) {
        this.notSavedChanges = true;
        return;
      }

      // Para filas existentes, actualizar inmediatamente en el servidor
      const updatedReport = {
        idOt: data.idOt || parseInt(this.selectedOt!.id),
        date: data.fecha ? data.fecha + 'T00:00:00' : data.date,
        startTime: data.horaInicio ? data.horaInicio + ':00' : (data.startTime || '00:00:00'),
        endTime: data.horaTermino ? data.horaTermino + ':00' : (data.endTime || '00:00:00'),
        supervisor: data.supervisor,
        type: data.tipoNota || data.type,
        description: data.descripcion || data.description,
        report: data.report || 'Reporte actualizado',
        active: true
      };

      this.dailyReportService.updateDailyReport(data.id, updatedReport).subscribe({
        next: (response) => {
          console.log('Campo actualizado:', field);
        },
        error: (error) => {
          console.error('Error al actualizar campo:', error);
          // Revertir el cambio en caso de error
          event.node.setDataValue(field, oldValue);
          alerts.basicAlert('Error', 'No se pudo actualizar el campo', 'error');
        }
      });
    }
  }

  onRowEditingStarted(event: any) {
    //console.log('Iniciando edición de fila:', event.data);
  }

  onRowEditingStopped(event: any) {
    //console.log('Finalizando edición de fila:', event.data);
  }

  // Método addReporte siguiendo exactamente el patrón de usuarios
  addReporte() {
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Agregar Reporte Diario OT',
      'Modulo Proyectos - Ordenes de Trabajo - Reportes',
      this.trackingService.getEmail()
    );
    
    if (!this.selectedOt) {
      alerts.basicAlert('Error', 'Debe seleccionar una OT primero', 'error');
      return;
    }

    const tempId = `temp_${this.tempIdCounter++}`;
    const newReporte = {
      id: tempId,
      idOt: parseInt(this.selectedOt.id),
      date: new Date().toISOString().split('T')[0] + 'T00:00:00',
      startTime: '08:00:00',
      endTime: '19:00:00',
      supervisor: 'SIN SUPERVISOR',
      type: this.selectedReporteArea,
      description: 'SIN DESCRIPCIÓN',
      result: 'SIN RESULTADO',
      totalPay : 0,
      active: true,
      paid: true,
      close: false,
      __isNew: true
    };

    console.log('Agregando nuevo reporte:', newReporte);
    this.reportesDiarios = [newReporte, ...this.reportesDiarios];
    this.notSavedChanges = true;
    
   /* setTimeout(() => {
      if (this.reportesGridApi) {
        this.reportesGridApi.startEditingCell({
          rowIndex: 0,
          colKey: 'date'
        });
      }
    }, 0);*/
  }


async saveChanges() {
  this.trackingService.addLog(
    this.trackingService.getnameComp(),
    'Guardar Cambios Reportes Diarios OT',
    'Modulo Proyectos - Ordenes de Trabajo - Reportes',
    this.trackingService.getEmail()
  );
  
  console.log('=== INICIO DEBUG SAVE CHANGES ===');
  
  const newRows = this.reportesDiarios.filter(row => row.__isNew);
  const modifiedRows = this.reportesDiarios.filter(row => row.__modified && !row.__isNew);
  
  console.log('Filas nuevas encontradas:', newRows.length);
  console.log('Filas modificadas encontradas:', modifiedRows.length);

  // Validación
  /*const invalidNewRows = newRows.filter(item => !item.date || !item.supervisor);
  
  if (invalidNewRows.length > 0) {
    alerts.basicAlert('Añadir entrada', 'Debe introducir la fecha y supervisor antes de guardar.', 'error');
    return;
  }*/

  if (newRows.length === 0 && modifiedRows.length === 0) {
    alerts.basicAlert('Info', 'No hay cambios para guardar', 'info');
    return;
  }

  try {
    console.log('=== PREPARANDO REQUESTS ===');
    
    const addRequests = newRows.map((row, index) => {
      const cleanedData = this.cleanDataForServer(row);
      console.log(`Datos limpiados para nueva fila ${index + 1}:`, cleanedData);
      return this.dailyReportService.addDailyReport(cleanedData).toPromise();
    });

    const updateRequests = modifiedRows.map((row, index) => {
      const cleanedData = this.cleanDataForServer(row);
      console.log(`Datos limpiados para fila modificada ${index + 1}:`, cleanedData);
      return this.dailyReportService.updateDailyReport(Number(row.id), cleanedData).toPromise();
    });

    console.log(`Ejecutando ${addRequests.length} requests de creación`);
    console.log(`Ejecutando ${updateRequests.length} requests de actualización`);

    const responses = await Promise.all([...addRequests, ...updateRequests]);
    
    console.log('=== RESPUESTAS RECIBIDAS ===');
    console.log('Número de respuestas:', responses.length);
    responses.forEach((response, index) => {
      console.log(`Respuesta ${index + 1}:`, response);
      
      // Verificar estructura de la respuesta
      if (response && typeof response === 'object') {
        console.log(`- success: ${response.success}`);
        console.log(`- message: ${response.message}`);
        console.log(`- data: ${response.data ? 'SÍ' : 'NO'}`);
        
        if (response.data) {
          console.log(`- data.id: ${response.data.id}`);
        }
      }
    });

    // Verificar si las respuestas son exitosas
    const failedResponses = responses.filter(response => 
      !response || 
      (response.hasOwnProperty('success') && !response.success) ||
      (response.status && response.status >= 400)
    );

    if (failedResponses.length > 0) {
      console.error('Respuestas fallidas:', failedResponses);
      throw new Error(`${failedResponses.length} requests fallaron`);
    }

    console.log('=== GUARDADO EXITOSO ===');
    alerts.basicAlert('Datos actualizados', 'Se han actualizado los datos correctamente.', 'success');

    this.notSavedChanges = false;
    
    // Recargar datos desde el servidor
    console.log('Recargando datos desde el servidor...');
    await this.loadDailyReports();
    console.log('Datos recargados exitosamente');

  } catch (error: any) {
    console.error('=== ERROR DETALLADO ===');
    console.error('Error completo:', error);
    
    let errorMessage = 'Ocurrió un error al actualizar los datos.';
    
    if (error.status === 400) {
      errorMessage = 'Datos inválidos. Verifique que todos los campos estén correctos.';
    } else if (error.status === 401) {
      errorMessage = 'No autorizado. Por favor, vuelva a iniciar sesión.';
    } else if (error.status === 403) {
      errorMessage = 'No tiene permisos para realizar esta operación.';
    } else if (error.status === 404) {
      errorMessage = 'Recurso no encontrado. Verifique la URL del servicio.';
    } else if (error.status === 500) {
      errorMessage = 'Error interno del servidor. Contacte al administrador.';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    alerts.basicAlert('Error', errorMessage, 'error');
  }
}

async saveChangesMaterial() {
  this.trackingService.addLog(
    this.trackingService.getnameComp(),
    'Guardar Cambios Materiales OT',
    'Modulo Proyectos - Ordenes de Trabajo - Materiales',
    this.trackingService.getEmail()
  );
  
  const newRows = this.materiales.filter(row => row.__isNew);
  const modifiedRows = this.materiales.filter(row => row.__modified && !row.__isNew);
  
  // Validación básica para materiales
  const invalidRows = newRows.filter(item => !item.idResource || !item.quantity);
  
  if (invalidRows.length > 0) {
    alerts.basicAlert('Error', 'Debe completar material y cantidad antes de guardar.', 'error');
    return;
  }

  if (newRows.length === 0 && modifiedRows.length === 0) {
    alerts.basicAlert('Info', 'No hay cambios para guardar', 'info');
    return;
  }

  try {
    const addRequests = newRows.map((row, index) => {
      const cleanedData = this.cleanDataSinDescripcion(row);
      console.log(`Datos limpiados para nueva fila ${index + 1}:`, cleanedData);
      return this.logbookService.addDataForOt(cleanedData).toPromise();
    });

    const updateRequests = modifiedRows.map((row, index) => {
      const cleanedData = this.cleanDataSinDescripcion(row);
      console.log(`Datos limpiados para fila modificada ${index + 1}:`, cleanedData);
      return this.logbookService.updateDataForOt(Number(row.id), cleanedData).toPromise();
    });

    console.log(`Ejecutando ${addRequests.length} requests de creación`);
    console.log(`Ejecutando ${updateRequests.length} requests de actualización`);

    const responses = await Promise.all([...addRequests, ...updateRequests]);
    
    console.log('=== RESPUESTAS RECIBIDAS ===');
    console.log('Número de respuestas:', responses.length);
    responses.forEach((response, index) => {
      console.log(`Respuesta ${index + 1}:`, response);
      
      // Verificar estructura de la respuesta
      if (response && typeof response === 'object') {
        console.log(`- success: ${response.success}`);
        console.log(`- message: ${response.message}`);
        console.log(`- data: ${response.data ? 'SÍ' : 'NO'}`);
        
        if (response.data) {
          console.log(`- data.id: ${response.data.id}`);
        }
      }
    });

    // Verificar si las respuestas son exitosas
    const failedResponses = responses.filter(response => 
      !response || 
      (response.hasOwnProperty('success') && !response.success) ||
      (response.status && response.status >= 400)
    );

    if (failedResponses.length > 0) {
      console.error('Respuestas fallidas:', failedResponses);
      throw new Error(`${failedResponses.length} requests fallaron`);
    }

    console.log('=== GUARDADO EXITOSO ===');
    alerts.basicAlert('Datos actualizados', 'Se han actualizado los datos correctamente.', 'success');
    this.autoUpdatePdf()
    this.notSavedMaterialChanges = false;
    
    // Recargar datos desde el servidor
    console.log('Recargando datos desde el servidor...');
    await this.loadDailyReports();
    console.log('Datos recargados exitosamente');
    this.materiales.forEach(item => {
        delete item.__isNew;
        delete item.__modified;
      });


  } catch (error: any) {
    console.error('=== ERROR DETALLADO ===');
    console.error('Error completo:', error);
    
    let errorMessage = 'Ocurrió un error al actualizar los datos.';
    
    if (error.status === 400) {
      errorMessage = 'Datos inválidos. Verifique que todos los campos estén correctos.';
    } else if (error.status === 401) {
      errorMessage = 'No autorizado. Por favor, vuelva a iniciar sesión.';
    } else if (error.status === 403) {
      errorMessage = 'No tiene permisos para realizar esta operación.';
    } else if (error.status === 404) {
      errorMessage = 'Recurso no encontrado. Verifique la URL del servicio.';
    } else if (error.status === 500) {
      errorMessage = 'Error interno del servidor. Contacte al administrador.';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    alerts.basicAlert('Error', errorMessage, 'error');
  }
}

async saveChangesEquipos() {
  this.trackingService.addLog(
    this.trackingService.getnameComp(),
    'Guardar Cambios Equipos OT',
    'Modulo Proyectos - Ordenes de Trabajo - Equipos',
    this.trackingService.getEmail()
  );
  
  const newRows = this.equipos.filter(row => row.__isNew);
  const modifiedRows = this.equipos.filter(row => row.__modified && !row.__isNew);
  /*const invalidNewRows = newRows.filter(item => !item.date || !item.supervisor);
  
  if (invalidNewRows.length > 0) {
    alerts.basicAlert('Añadir entrada', 'Debe introducir la fecha y supervisor antes de guardar.', 'error');
    return;
  }*/

  if (newRows.length === 0 && modifiedRows.length === 0) {
    alerts.basicAlert('Info', 'No hay cambios para guardar', 'info');
    return;
  }

  try {
    const addRequests = newRows.map((row, index) => {
      console.log(`=== FILA ORIGINAL ${index + 1} ===`, row);
      const cleanedData = this.cleanDataSinDescripcion(row);
      console.log(`=== DATOS LIMPIADOS ${index + 1} ===`, cleanedData);
      console.log(`JSON.stringify:`, JSON.stringify(cleanedData, null, 2));
      return this.logbookService.addDataForOt(cleanedData).toPromise();
    });

    const updateRequests = modifiedRows.map((row, index) => {
      const cleanedData = this.cleanDataSinDescripcion(row);
      console.log(`Datos limpiados para fila modificada ${index + 1}:`, cleanedData);
      return this.logbookService.updateDataForOt(Number(row.id), cleanedData).toPromise();
    });

    console.log(`Ejecutando ${addRequests.length} requests de creación`);
    console.log(`Ejecutando ${updateRequests.length} requests de actualización`);

    const responses = await Promise.all([...addRequests, ...updateRequests]);
    
    console.log('=== RESPUESTAS RECIBIDAS ===');
    console.log('Número de respuestas:', responses.length);
    responses.forEach((response, index) => {
      console.log(`Respuesta ${index + 1}:`, response);
      
      // Verificar estructura de la respuesta
      if (response && typeof response === 'object') {
        console.log(`- success: ${response.success}`);
        console.log(`- message: ${response.message}`);
        console.log(`- data: ${response.data ? 'SÍ' : 'NO'}`);
        
        if (response.data) {
          console.log(`- data.id: ${response.data.id}`);
        }
      }
    });

    // Verificar si las respuestas son exitosas
    const failedResponses = responses.filter(response => 
      !response || 
      (response.hasOwnProperty('success') && !response.success) ||
      (response.status && response.status >= 400)
    );

    if (failedResponses.length > 0) {
      console.error('Respuestas fallidas:', failedResponses);
      throw new Error(`${failedResponses.length} requests fallaron`);
    }

    console.log('=== GUARDADO EXITOSO ===');
    alerts.basicAlert('Datos actualizados', 'Se han actualizado los datos correctamente.', 'success');
    this.autoUpdatePdf()
    this.notSavedEquipoChanges = false;
    
    // Recargar datos desde el servidor 
    this.equipos.forEach(item => {
        delete item.__isNew;
        delete item.__modified;
      });

    console.log('Recargando datos desde el servidor...');
    await this.loadDailyReports();
    console.log('Datos recargados exitosamente');

  } catch (error: any) {
    console.error('=== ERROR DETALLADO ===');
    console.error('Error completo:', error);
    
    // Log específico para errores de validación
    if (error.status === 400 && error.error && error.error.errors) {
      console.error('Errores de validación específicos:', error.error.errors);
    }
    
    let errorMessage = 'Ocurrió un error al actualizar los datos.';
    
    if (error.status === 400) {
      errorMessage = 'Datos inválidos. Verifique que todos los campos estén correctos.';
      
      // Mostrar errores específicos si están disponibles
      if (error.error && error.error.errors) {
        const validationErrors = Object.keys(error.error.errors).map(key => 
          `${key}: ${error.error.errors[key].join(', ')}`
        ).join('\n');
        errorMessage += '\n\nErrores específicos:\n' + validationErrors;
      }
    } else if (error.status === 401) {
      errorMessage = 'No autorizado. Por favor, vuelva a iniciar sesión.';
    } else if (error.status === 403) {
      errorMessage = 'No tiene permisos para realizar esta operación.';
    } else if (error.status === 404) {
      errorMessage = 'Recurso no encontrado. Verifique la URL del servicio.';
    } else if (error.status === 500) {
      errorMessage = 'Error interno del servidor. Contacte al administrador.';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    alerts.basicAlert('Error', errorMessage, 'error');
  }
}

  revertReportes() {
    this.loadDailyReports();
    this.notSavedChanges = false;
  }
  revertEquipos() {
    this.obtenerEquipos(this.selectedReporteId);
    this.notSavedEquipoChanges = false;
  }
  revertMaterial() {
    this.obtenerMateriales(this.selectedReporteId);
    this.notSavedMaterialChanges = false;
  }

  printReporte() {
    if (!this.selectedReporteFecha || !this.selectedReporteTipo) {
      alerts.basicAlert('Error', 'Debe seleccionar un reporte primero', 'error');
      return;
    }

    // Buscar el reporte seleccionado
    const reporteSeleccionado = this.reportesDiarios.find(r => 
      (r.fecha === this.selectedReporteFecha || r.date?.split('T')[0] === this.selectedReporteFecha) && 
      (r.tipoNota === this.selectedReporteTipo || r.type === this.selectedReporteTipo)
    );

    if (!reporteSeleccionado) {
      alerts.basicAlert('Error', 'No se encontró el reporte seleccionado', 'error');
      return;
    }

    // Generar PDF del reporte
    this.dailyReportService.generateReportPdf(Number(reporteSeleccionado.id)).subscribe({
      next: (pdfBlob) => {
        const url = window.URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `reporte_diario_${this.selectedOt?.otNumber}_${this.selectedReporteFecha}_${this.selectedReporteTipo}.pdf`;
        link.click();
        window.URL.revokeObjectURL(url);
        
        alerts.basicAlert('Éxito', 'PDF generado y descargado correctamente', 'success');
      },
      error: (error) => {
        console.error('Error al generar PDF:', error);
        let errorMessage = 'No se pudo generar el PDF del reporte';
        if (error.error?.message) {
          errorMessage = error.error.message;
        }
        alerts.basicAlert('Error', errorMessage, 'error');
      }
    });
  }


  // Método para cargar datos de Personal desde el servidor
  loadPersonalData() {
    if (this.selectedOt) {
      const otId = parseInt(this.selectedOt.id);
      console.log('Cargando datos de Personal para OT:', otId);
      
      this.logbookService.getInfoByOt(otId, 'PERSONAL').subscribe({
        next: (response) => {
          console.log('Respuesta de Personal:', response);
          if (response.success && response.data) {
            // Mapear datos del endpoint a la estructura esperada por el ag-grid
            this.personal = response.data.map((item: any) => ({
              id: item.id.toString(), // Convertir a string para consistencia
              idOt: item.idOt,
              idReporte: item.idReporte,
              idResource: item.idResource ? item.idResource.toString() : '',
              position: item.position || '',
              quantity: item.quantity || 1,
              start: item.start || '08:00',
              end: item.end || '17:00',
              date: item.date ? item.date.split('T')[0] : '',
              typeNote: item.typeNote,
              description: item.description || '',
              orden: item.orden || 1
            }));
            // Forzar actualización del grid si ya está inicializado
            if (this.personalGridApi) {
              this.personalGridApi.refreshCells();
              this.personalGridApi.redrawRows();
            }
          } else {
            console.log('No hay datos de Personal o estructura de respuesta diferente:', response);
            this.personal = [];
          }
        },
        error: (error) => {
          console.error('Error al cargar Personal:', error);
          this.personal = [];
        }
      });
    }
  }

  // Método para cargar reportes diarios desde el servidor
  loadDailyReports() {
    if (this.selectedOt) {
      const otId = parseInt(this.selectedOt.id);
      
      this.dailyReportService.getDailyReportsByOt(otId).subscribe({
        next: (response) => {
          if (response.success && response.data) {
            // Usar los datos directamente sin mapeo
            this.reportesDiarios = response.data.map((item: any) => {
              return { ...item };
            });
            
            // Seleccionar automáticamente el primer reporte si existe
            if (this.reportesDiarios.length > 0) {
              const firstReport = this.reportesDiarios[0];
              
              // Esperar un poco para asegurar que el grid esté completamente renderizado
              setTimeout(() => {
                this.selectReporte(firstReport);
              }, 200);
            }
          } else {
            this.reportesDiarios = [];
          }
        },
        error: (error) => {
          this.reportesDiarios = [];
          alerts.basicAlert('Error', 'No se pudieron cargar los reportes diarios', 'error');
        }
      });
    }
  }

  async generatePdfPreview() {
    
    
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Generar Vista Previa PDF OT',
      'Modulo Proyectos - Ordenes de Trabajo - PDF',
      this.trackingService.getEmail()
    );
    
    if (!this.selectedOt) {
      console.error('❌ Error: No hay OT seleccionada');
      alerts.basicAlert('Error', 'Debe seleccionar una OT primero', 'error');
      return;
    }

    if (!this.selectedReporteId || !this.selectedReporteFecha) {
      console.error('❌ Error: No hay reporte seleccionado');
      console.log('Detalles:', { selectedReporteId: this.selectedReporteId, selectedReporteFecha: this.selectedReporteFecha });
      alerts.basicAlert('Error', 'Debe seleccionar un reporte diario primero', 'error');
      return;
    }

    this.isGeneratingPdf = true;
    console.log('Generando PDF para:', {
      otId: this.selectedOt.id,
      reporteId: this.selectedReporteId,
      fecha: this.selectedReporteFecha
    });

    try {
      // Preparar los datos para el generador de PDF
      console.log('Fotografías disponibles para PDF:', this.fotografias);
      
      // Procesar datos de personal para resolver nombres y cargos automáticamente
      const processedPersonalData = this.personal.map(person => {
        const processedPerson = { ...person };
        
        // Resolver nombre del empleado
        if (person.idResource) {
          const employee = this.employees.find(emp => emp.id.toString() === person.idResource.toString());
          if (employee) {
            processedPerson.employeeName = employee.name;
            
            // Resolver cargo del empleado
            const depto = this.catalogDepartamentos.find(d => d.id === +employee.idPosition);
            processedPerson.position = depto ? depto.description : '';
          }
        }
        
        return processedPerson;
      });
      
      // Procesar datos de conceptos para resolver nombres automáticamente
      const processedConceptosData = this.conceptos.map(concepto => {
        const processedConcepto = { ...concepto };
        
        // Resolver nombre del concepto
        if (concepto.idResource) {
          const foundItem = this.catalogConcepto?.find(item => item.id == concepto.idResource);
          processedConcepto.conceptName = foundItem ? foundItem.actandNom : `ID: ${concepto.idResource}`;
        }
        
        return processedConcepto;
      });
      
      const inputData = {
        id: parseInt(this.selectedOt.id),
        date: this.selectedReporteFecha,
        description: this.selectedOt.description,
        personalData: processedPersonalData, // Usar datos procesados con nombres y cargos resueltos
        materialesData: this.materiales,
        equiposData: this.equipos,
        fotografiasData: this.fotografias, // Agregar fotografías de la pestaña
        notasData: this.notas, // Agregar notas de la pestaña
        idReport: typeof this.selectedReporteId === 'string' ? parseInt(this.selectedReporteId) : this.selectedReporteId, // Agregar idReport para obtener notas de TRABAJO ANTECEDENTES
        typeNotesCatalog: this.typeNotesCatalog, // Agregar catálogo de tipos de notas
        conceptosData: processedConceptosData, // Usar datos procesados con nombres de conceptos resueltos
        conceptosCatalog: this.catalogConcepto,
      };

      // Asignar a la propiedad de la clase para uso posterior
      this.inputData = inputData;


      // Generar la definición del documento
      const docDefinition = await this.pdfGeneratorService.generatePdfData(inputData);

      // Crear el PDF y obtener el blob
      pdfMake.createPdf(docDefinition as any).getBlob((blob) => {
        // Crear URL del blob para la vista previa
        if (this.originalUrl) {
          URL.revokeObjectURL(this.originalUrl);
        }
        
        const url = URL.createObjectURL(blob);
        this.originalUrl = url;
        this.pdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
        this.showPdfEmbed = true;
        this.isGeneratingPdf = false;

        console.log('✅ PDF generado exitosamente para vista previa');
        console.log('📄 URL del PDF:', url);
        console.log('🖥️ Estado de visualización:', { showPdfEmbed: this.showPdfEmbed, pdfUrl: !!this.pdfUrl });
        
        //alerts.basicAlert('Éxito', 'PDF generado correctamente', 'success');
      });

    } catch (error) {
      console.error('❌ Error al generar PDF:', error);
      console.error('📊 Stack trace:', error);
      this.isGeneratingPdf = false;
      
      let errorMessage = 'No se pudo generar el PDF del reporte';
      if (error instanceof Error) {
        errorMessage = error.message;
        console.error('💥 Mensaje de error:', errorMessage);
      }
      
      alerts.basicAlert('Error', errorMessage, 'error');
    }
  }

  // Métodos CRUD - addRow está arriba para reportes

  revert() {
    // Recargar datos originales desde el servicio
    this.obtenerDatos();
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Revertir Cambios en Lista de OT',
      'Menu Proyectos Ordenes de Trabajo',
      this.trackingService.getEmail()
    );
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;

    if (input.files && input.files.length > 0) {
      const file = input.files[0];

      // Validar que sea un PDF
      if (file.type !== 'application/pdf') {
        alert('Por favor seleccione un archivo PDF válido.');
        return;
      }

      // Validar tamaño del archivo (ej: máximo 10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        alert(
          'El archivo es demasiado grande. El tamaño máximo permitido es 10MB.'
        );
        return;
      }
      console.log('File MIME type:', file.type);


      this.uploadPdf(file);
    }

    // Limpiar el input para permitir seleccionar el mismo archivo nuevamente
    input.value = '';
  }

  async uploadPdf(file: File) {
  this.isUploading = true;
  
  //console.log('=== PDF Upload Process Started ===');
  /*console.log('File details:', {
    name: file.name,
    size: file.size,
    type: file.type,
    lastModified: new Date(file.lastModified),
  });
  console.log('Project ID being sent:', 760);
  console.log('Calling OtService.addOtViaPdf with parameters:', {
    projectId: 760,
    file: file,
  });*/

  try {
    const response: any = await lastValueFrom(this.otService.addOtViaPdf(this.idProject, file));

    //console.log('=== PDF Upload Success ===');
    //console.log('Response received:', response);

    
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      `Upload PDF OT - ID: ${response.otId}`,
      'Menu Proyectos Ordenes de Trabajo',
      this.trackingService.getEmail()
    );

    alerts.basicAlert(
      'PDF Procesado Exitosamente',
      `El PDF ha sido cargado y se han obtenido algunos datos. Será redirigido al formulario de OT para que corrobore los datos.\n\nNúmero OT: ${response.otNumber}`,
      'success'
    );
      this.obtenerDatos();

    // Redirigir después de un breve delay
    /*console.log('Navigating to details page with otId:', response.otId);
    setTimeout(() => {
      this.router.navigate(['/projects/ot/details', response.otId]);
    }, 2000);*/
  } catch (error: any) {
    console.log('=== PDF Upload Error ===');
    console.error('Complete error object:', error);
    console.error('Error status:', error.status);
    console.error('Error statusText:', error.statusText);
    console.error('Error headers:', error.headers);
    console.error('Error body:', error.error);

    let errorMessage = 'Error al procesar el archivo PDF.';
    if (error?.error?.message) {
      errorMessage = error.error.message;
    } else if (error?.message) {
      errorMessage = error.message;
    }

    alert(errorMessage);
  } finally {
    this.isUploading = false;
  }
}


  // Método para limpiar datos antes de enviar al servidor
  private cleanDataForServer(data: any): any {
    const cleanedData = { ...data };
    
    // Eliminar propiedades temporales de control
    delete cleanedData.__isNew;
    delete cleanedData.__modified;
    
    // Solo incluir ID si no es temporal
    if (cleanedData.id && cleanedData.id.toString().startsWith('temp_')) {
      delete cleanedData.id;
    }
    
    // Si hay idResource pero no Description, agregar la descripción del equipo
    /*if (cleanedData.idResource && !cleanedData.Description) {
      const foundEquipo = this.catalogEquipos?.find(item => item.id == cleanedData.idResource);
      if (foundEquipo) {
        cleanedData.Description = foundEquipo.description;
      } else {
        // Si no se encuentra el equipo, usar un valor por defecto
        cleanedData.Description = `Equipo ID: ${cleanedData.idResource}`;
      }
    }
    
    // Si no hay Description y es un nuevo registro, poner un valor por defecto
    if (!cleanedData.Description) {
      cleanedData.Description = 'Sin descripción';
    }*/
    
    return cleanedData;
  }
  private cleanDataSinDescripcion(data: any): any {
    const cleanedData = { ...data };
    
    // Eliminar propiedades temporales de control
    delete cleanedData.__isNew;
    delete cleanedData.__modified;
    
    // Solo incluir ID si no es temporal
    if (cleanedData.id && cleanedData.id.toString().startsWith('temp_')) {
      delete cleanedData.id;
    }
    
    // AGREGAR CAMPO REQUEST REQUERIDO POR BACKEND - SIEMPRE
    cleanedData.request = cleanedData.request || 'DEFAULT_REQUEST';
    
    // MANTENER QUANTITY COMO DECIMAL - Backend acepta decimales
    if (cleanedData.quantity !== undefined && cleanedData.quantity !== null) {
      const quantityValue = Number(cleanedData.quantity);
      // Verificar que la conversión sea válida
      if (!isNaN(quantityValue)) {
        cleanedData.quantity = quantityValue;
      } else {
        console.error('Quantity no es un número válido:', cleanedData.quantity);
        cleanedData.quantity = 1.0; // Valor por defecto
      }
    }
    
    // Si no hay Description y es un nuevo registro, poner un valor por defecto
    if (!cleanedData.Description) {
      cleanedData.Description = 'Sin descripción';
    }
    
    return cleanedData;
  }

  // Método para limpiar datos de Personal antes de enviar al servidor
  private cleanPersonalDataForServer(data: any): any {
    const cleanedData = { ...data };
    
    // Eliminar propiedades temporales de control
    delete cleanedData.__isNew;
    delete cleanedData.__modified;
    
    // Eliminar date ya que el endpoint espera date
    
    // Solo incluir ID si no es temporal
    if (cleanedData.id && cleanedData.id.toString().startsWith('temp_')) {
      delete cleanedData.id;
    }
    
    // Asegurar que los campos requeridos están presentes
    if (!cleanedData.idOt) {
      cleanedData.idOt = this.selectedOt?.id;
    }
    if (!cleanedData.idReporte) {
      cleanedData.idReporte = this.selectedReporteId;
    }
    
    // Agregar campos requeridos por el endpoint
    cleanedData.typeNote = cleanedData.typeNote || 'PERSONAL';
    cleanedData.description = cleanedData.description || 'NOTAS';
    cleanedData.orden = cleanedData.orden || 1;
    
    return cleanedData;
  }

  // Método específico para limpiar datos de fotografías
  private cleanPhotoDataForServer(data: any): any {
    const cleanedData = { ...data };
    
    console.log('🖼️ Limpiando datos de fotografía:', cleanedData);
    
    // Eliminar propiedades temporales de control
    delete cleanedData.__isNew;
    delete cleanedData.__modified;
    
    // Solo incluir ID si no es temporal
    if (cleanedData.id && cleanedData.id.toString().startsWith('temp_')) {
      delete cleanedData.id;
    }
    
    // Asegurar que los campos requeridos están presentes
    if (!cleanedData.idOt) {
      cleanedData.idOt = this.selectedOt?.id;
    }
    if (!cleanedData.idReporte) {
      cleanedData.idReporte = this.selectedReporteId;
    }
    
    // ✅ CONFIGURACIÓN CORRECTA PARA SIGNALR PHOTOUPDATE
    cleanedData.typeNote = 'Photo';  // Requerido por backend para ReceivePhotoUpdate
    cleanedData.orden = 4;           // Requerido por backend para ReceivePhotoUpdate
    
    // Mapear campos de fotografía a formato esperado por backend
    cleanedData.description = cleanedData.descripcion || cleanedData.description || 'Sin descripción';
    cleanedData.imageUrl = cleanedData.imageUrl || '';
    cleanedData.imageAzure = cleanedData.imageazure || cleanedData.imageAzure || 'NO FILE';
    
    console.log('🖼️ Datos de fotografía limpiados:', cleanedData);
    
    return cleanedData;
  }

  // Método para eliminar reporte siguiendo patrón de usuarios
  async deleteReporte() {
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Eliminar Reporte Diario OT',
      'Modulo Proyectos - Ordenes de Trabajo - Reportes',
      this.trackingService.getEmail()
    );
    
    if (!this.reportesGridApi) {
      alerts.basicAlert('Error', 'Grid no disponible', 'error');
      return;
    }

    const selectedNodes = this.reportesGridApi.getSelectedNodes();
    if (selectedNodes.length === 0) {
      alerts.basicAlert(
        'Eliminar entrada',
        'Por favor, seleccione una entrada para eliminar.',
        'error'
      );
      return;
    }

    const selectedData = selectedNodes[0].data;
    const id = selectedData.id;

    // Mostrar mensaje de confirmación
    alerts.confirmAlert(
      'Eliminar reporte',
      '¿Está seguro que desea eliminar este reporte?',
      'warning',
      'Sí, eliminar'
    ).then((value) => {
      if (value.isConfirmed) {
        if (selectedData.__isNew) {
          // Si es nuevo, solo remover del array local
          this.reportesDiarios = this.reportesDiarios.filter(r => r.id !== id);
          this.notSavedChanges = this.reportesDiarios.some(r => r.__isNew);
          alerts.basicAlert(
            'Eliminar entrada',
            'Entrada eliminada satisfactoriamente.',
            'success'
          );
        } else {
          // Si existe en el servidor, eliminarlo
          this.dailyReportService.deleteDailyReport(Number(id)).subscribe({
            next: () => {
              alerts.basicAlert(
                'Eliminar entrada',
                'Entrada eliminada satisfactoriamente.',
                'success'
              );
              this.loadDailyReports();
              this.notSavedChanges = false;
            },
            error: (error) => {
              alerts.basicAlert(
                'Eliminar entrada',
                'Error al eliminar la entrada.',
                'error'
              );
              console.error(error);
            }
          });
        }
      }
    });
  }

  // Método para manejar cambios en celdas
  onCellValueChangedReportes(event: any) {
    this.notSavedChanges = true;

    if (!event.data.__isNew) {
      event.data.__modified = true;
    }
  }

  // Método para manejar cambios en el grid de personal
  onPersonalCellValueChanged(event: any) {
    console.log('=== CAMBIO EN GRID DE PERSONAL ===');
    console.log('Campo modificado:', event.colDef.field);
    console.log('Valor anterior:', event.oldValue);
    console.log('Valor nuevo:', event.newValue);
    console.log('Dato completo después del cambio:', event.data);
    
    this.notSavedPersonalChanges = true;

    if (!event.data.__isNew) {
      event.data.__modified = true;
    }
  }

  onCellValueChangedMaterial(event: any) {

    this.notSavedMaterialChanges = true;

    if (!event.data.__isNew) {
      event.data.__modified = true;
    }
  }
   onCellValueChangedFotografia(event: any) {

    this.notSavedFotografiaChanges = true;

    if (!event.data.__isNew) {
      event.data.__modified = true;
    }
  }
  onCellValueChangedEquipo(event: any) {

    this.notSavedEquipoChanges = true;

    if (!event.data.__isNew) {
      event.data.__modified = true;
    }
  }

  onCellValueChangedConcepto(event: any) {

    this.notSavedConceptoChanges = true;

    if (!event.data.__isNew) {
      event.data.__modified = true;
    }
  }

  // Método para manejar cambios en el grid de materiales
  onMaterialCellValueChanged(event: any) {
    console.log('=== CAMBIO EN GRID DE MATERIALES ===');
    console.log('Campo modificado:', event.colDef.field);
    console.log('Valor anterior:', event.oldValue);
    console.log('Valor nuevo:', event.newValue);
    console.log('Dato completo después del cambio:', event.data);
    
    this.notSavedChangesMaster = true;

    if (!event.data.__isNew) {
      event.data.__modified = true;
    }

    // Refrescar las celdas para mostrar la descripción y unidad correctas
    if (this.materialesGridApi && event.colDef.field === 'idResource') {
      setTimeout(() => {
        this.materialesGridApi.refreshCells({
          rowNodes: [event.node],
          columns: ['idResource', 'unidad'] // Refrescar tanto el material como la unidad
        });
      }, 0);
    }
  }

  // Grid ready para personal
  onPersonalGridReady(params: any) {
    this.personalGridApi = params.api;
    // Remover sizeColumnsToFit para respetar flex
    // params.api.sizeColumnsToFit();
  }

  // Grid ready para materiales
  onMaterialesGridReady(params: any) {
    this.materialesGridApi = params.api;
  }

  // Grid ready para equipos
  onEquiposGridReady(params: any) {
    this.equiposGridApi = params.api;
  }

  onConceptosGridReady(params: any) {
    this.conceptosGridApi = params.api;
  }

  onFotografiasGridReady(params: any) {
    this.fotografiaGridApi = params.api;
  }

  onVideosGridReady(params: any) {
    this.videoGridApi = params.api;
  }

  onCellValueChangedVideo(event: any) {
    this.notSavedVideoChanges = true;

    if (!event.data.__isNew) {
      event.data.__modified = true;
    }
  }

  // Métodos CRUD para Personal
  addPersonal() {
    //alert(typeof(!this.signalsService.getClosedReport()))
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Agregar Personal OT',
      'Modulo Proyectos - Ordenes de Trabajo - Personal',
      this.trackingService.getEmail()
    );
    
    //console.log('=== AGREGANDO NUEVO PERSONAL ===');
    //console.log('OT seleccionada:', this.selectedOt);
    //console.log('Fecha de reporte seleccionada:', this.selectedReporteFecha);
    
    if (!this.selectedOt) {
      alerts.basicAlert('Error', 'Debe seleccionar una OT primero', 'error');
      return;
    }

    if (!this.selectedReporteFecha) {
      alerts.basicAlert('Error', 'Debe seleccionar una fecha de reporte primero', 'error');
      return;
    }

    const tempId = `temp_personal_${this.tempPersonalIdCounter++}`;
   
    const newPersonal = {
      //id: tempId,
      idOt: parseInt(this.selectedOt.id),
      idReporte: this.selectedReporteId,
      idResource: null, // Se almacenará el ID del empleado
      position: '', 
      quantity: 1,
      start: this.selectedReporteHoraInicio + ':00',
      end: this.selectedReporteHoraTermino + ':00',
      azureUrl: 'NO FILE',
      date: this.selectedReporteFecha,
      typeNote: 'PERSONAL',
      description: 'NOTAS',
      imageazure: 'NO FILE',
      cuadrilla: `Cuadrilla ${this.cuadrillaSelect}`,
      orden: 1,
      __isNew: true
    };

    this.personal = [newPersonal, ...this.personal];
    this.notSavedPersonalChanges = true;
    
    setTimeout(() => {
      if (this.personalGridApi) {
        this.personalGridApi.startEditingCell({
          rowIndex: 0,
          colKey: 'idResource'
        });
      }
    }, 0);
  }

  addMaterial() {
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Agregar Material OT',
      'Modulo Proyectos - Ordenes de Trabajo - Materiales',
      this.trackingService.getEmail()
    );
    
    if (!this.selectedOt) {
      alerts.basicAlert('Error', 'Debe seleccionar una OT primero', 'error');
      return;
    }

    if (!this.selectedReporteFecha) {
      alerts.basicAlert('Error', 'Debe seleccionar una fecha de reporte primero', 'error');
      return;
    }

    const tempId = `temp_material_${this.tempPersonalIdCounter++}`;
    const newMaterial = {
      //id: tempId,
      idOt: parseInt(this.selectedOt.id),
      idReporte: this.selectedReporteId,
      idResource: '', // Inicializar como string vacío para consistencia
      quantity: 1,
      unidad: '', // Inicializar campo unidad explícitamente
      start: this.selectedReporteHoraInicio + ':00',
      end: this.selectedReporteHoraTermino + ':00',
      date: this.selectedReporteFecha,
      typeNote: 'MATERIAL',
      description: 'Nota',
      orden: 1,
      __isNew: true
    };

    this.materiales = [newMaterial, ...this.materiales];
    this.notSavedMaterialChanges = true;

    setTimeout(() => {
      if (this.materialesGridApi) {
          this.materialesGridApi.startEditingCell({
            rowIndex: 0,
          colKey: 'idResource'
        });
      }
    }, 0);
  }

  addEquipos() {
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Agregar Equipo OT',
      'Modulo Proyectos - Ordenes de Trabajo - Equipos',
      this.trackingService.getEmail()
    );
    
    if (!this.selectedOt) {
      alerts.basicAlert('Error', 'Debe seleccionar una OT primero', 'error');
      return;
    }

    if (!this.selectedReporteFecha) {
      alerts.basicAlert('Error', 'Debe seleccionar una fecha de reporte primero', 'error');
      return;
    }

    const tempId = `temp_equipo_${this.tempPersonalIdCounter++}`;
    const newEquipo = {
      //id: tempId,
      idOt: parseInt(this.selectedOt.id),
      idReporte: this.selectedReporteId,
      idResource: null, // Se almacenará el ID del equipo
      position: '', 
      quantity: 1,
      start: this.selectedReporteHoraInicio + ':00',
      end: this.selectedReporteHoraTermino + ':00',
      date: this.selectedReporteFecha,
      typeNote: 'EQUIPMENT',
      description: '',
      orden: 1,
      __isNew: true
    };

    this.equipos = [newEquipo, ...this.equipos];
    this.notSavedEquipoChanges = true;
    
    setTimeout(() => {
      if (this.equiposGridApi) {
          this.equiposGridApi.startEditingCell({
           rowIndex: 0,
          colKey: 'idResource'
        });
      }
    }, 0);
  }

  async savePersonalChanges() {
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Guardar Cambios Personal OT',
      'Modulo Proyectos - Ordenes de Trabajo - Personal',
      this.trackingService.getEmail()
    );
    
    const newRows = this.personal.filter(row => row.__isNew);
    const modifiedRows = this.personal.filter(row => row.__modified && !row.__isNew);

    // Validación básica
    const invalidRows = newRows.filter(item => !item.idResource || !item.position);
    
    if (invalidRows.length > 0) {
      alerts.basicAlert('Error', 'Debe completar nombre y cargo antes de guardar.', 'error');
      return;
    }

    if (newRows.length === 0 && modifiedRows.length === 0) {
      alerts.basicAlert('Info', 'No hay cambios para guardar', 'info');
      return;
    }

    try {
      console.log('=== USANDO ENDPOINTS DE LOGBOOK SERVICE ===');
      
      // Preparar requests para nuevos registros
      const addRequests = newRows.map((row, index) => {
        const cleanedData = this.cleanPersonalDataForServer(row);
        console.log(`Datos para POST ${index + 1}:`, cleanedData);
        return this.logbookService.addDataForOt(cleanedData).toPromise();
      });

      // Preparar requests para registros modificados
      const updateRequests = modifiedRows.map((row, index) => {
        const cleanedData = this.cleanPersonalDataForServer(row);
        console.log(`Datos para PUT ${index + 1} (ID: ${row.id}):`, cleanedData);
        return this.logbookService.updateDataForOt(Number(row.id), cleanedData).toPromise();
      });

      console.log(`Ejecutando ${addRequests.length} requests de creación`);
      console.log(`Ejecutando ${updateRequests.length} requests de actualización`);

      // Ejecutar todos los requests
      const responses = await Promise.all([...addRequests, ...updateRequests]);
      
      console.log('=== RESPUESTAS RECIBIDAS ===');
      console.log('Número de respuestas:', responses.length);
      responses.forEach((response, index) => {
        console.log(`Respuesta ${index + 1}:`, response);
      });

      // Verificar si las respuestas son exitosas
      const failedResponses = responses.filter(response => 
        !response || 
        (response.hasOwnProperty('success') && !response.success) ||
        (response.status && response.status >= 400)
      );

      if (failedResponses.length > 0) {
        console.error('Respuestas fallidas:', failedResponses);
        throw new Error(`${failedResponses.length} requests fallaron`);
      }

      console.log('=== GUARDADO EXITOSO ===');
      alerts.basicAlert('Éxito', 'Cambios de personal guardados correctamente', 'success');
      this.autoUpdatePdf()
      this.notSavedPersonalChanges = false;
      
      // Limpiar flags de control
      this.personal.forEach(item => {
        delete item.__isNew;
        delete item.__modified;
      });

      // Recargar datos para reflejar cambios del servidor
      // Aquí podrías recargar datos si tienes un endpoint específico para personal

    } catch (error: any) {
      console.error('=== ERROR AL GUARDAR PERSONAL ===');
      console.error('Error completo:', error);
      
      let errorMessage = 'Error al guardar cambios de personal';
      if (error.status === 400) {
        errorMessage = 'Datos inválidos. Verifique que todos los campos estén correctos.';
      } else if (error.status === 401) {
        errorMessage = 'No autorizado. Por favor, vuelva a iniciar sesión.';
      } else if (error.status === 500) {
        errorMessage = 'Error interno del servidor. Contacte al administrador.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      alerts.basicAlert('Error', errorMessage, 'error');
    }
  }

  revertPersonal() {
    // Remover elementos nuevos y revertir modificados
    this.obtenerPersonal(this.selectedReporteId);
    this.notSavedPersonalChanges = false;
  }

  async deletePersonal() {
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Eliminar Personal OT',
      'Modulo Proyectos - Ordenes de Trabajo - Personal',
      this.trackingService.getEmail()
    );
    
    if (!this.personalGridApi) {
      alerts.basicAlert('Error', 'Grid no disponible', 'error');
      return;
    }

    const selectedNodes = this.personalGridApi.getSelectedNodes();
    if (selectedNodes.length === 0) {
      alerts.basicAlert('Error', 'Seleccione una entrada de personal para eliminar', 'error');
      return;
    }

    const selectedData = selectedNodes[0].data;
    const id = selectedData.id;

    console.log('=== INTENTANDO ELIMINAR PERSONAL ===');
    console.log('Registro seleccionado para eliminar:', selectedData);
    console.log('ID a eliminar:', id);
    
    alerts.confirmAlert(
      'Eliminar personal',
      '¿Está seguro que desea eliminar este registro de personal?',
      'warning',
      'Sí, eliminar'
    ).then((value) => {
      if (value.isConfirmed) {
        if (selectedData.__isNew) {
          this.personal = this.personal.filter(p => p.id !== id);
          this.notSavedPersonalChanges = this.personal.some(p => p.__isNew);
          alerts.basicAlert('Éxito', 'Personal eliminado correctamente', 'success');
        } else {
          this.logbookService.deleteDataForOt(Number(id)).subscribe({
            next: (response) => {
              this.personal = this.personal.filter(p => p.id !== id);
              alerts.basicAlert('Éxito', 'Personal eliminado correctamente del servidor', 'success');
            },
            error: (error) => {
              console.error('Error al eliminar personal del servidor:', error);
              let errorMessage = 'Error al eliminar el registro de personal';
              if (error.status === 404) {
                errorMessage = 'El registro ya no existe en el servidor';
              } else if (error.status === 401) {
                errorMessage = 'No autorizado para eliminar este registro';
              }
              alerts.basicAlert('Error', errorMessage, 'error');
            }
          });
        }
      }
    });
  }

  async crearPdfEmbedAutomatico() {
    if (!this.inputData || !this.inputData.id) {
      console.log('No hay datos disponibles para generar PDF');
      this.showPdfEmbed = false;
      this.isGeneratingPdfEmbed = false;
      return;
    }

    // Verificar si hay datos en la tabla
    if (!this.gestionarDatos || this.gestionarDatos.length === 0) {
      console.log('No hay datos en la tabla para generar PDF');
      this.showPdfEmbed = false;
      this.isGeneratingPdfEmbed = false;
      return;
    }

    this.isGeneratingPdfEmbed = true;
    this.showPdfEmbed = false;
    this.pdfUrl = null;
    this.originalUrl = null;
    
    try {
      const docDefinition = await this.pdfGeneratorService.generatePdfData(
        this.inputData
      );
      
      pdfMake.createPdf(docDefinition as any).getBlob((blob) => {
        const url = URL.createObjectURL(blob);
        this.originalUrl = url;
        this.pdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
        this.showPdfEmbed = true;
        this.isGeneratingPdfEmbed = false;
      });
    } catch (error) {
      console.error('Error generando PDF automáticamente:', error);
      this.isGeneratingPdfEmbed = false;
      this.showPdfEmbed = false;
    }
  }

  obtenerMateriales(selectedReporteId: any) {
    // alert('this.branchs'+ this.idBranch)
    console.log('Obteniendo materiales para reporte ID:', selectedReporteId);
    this.logbookService.getInfoByReporte(selectedReporteId, "MATERIAL").subscribe(
      (data: any) => {
        // Procesar los datos del servidor para evitar duplicaciones
        this.materiales = data.data.map((material: any, index: number) => ({
          ...material,
          // Generar ID único si viene con 0 o no tiene ID válido
          id: material.id && material.id !== 0 ? material.id : `server_material_${selectedReporteId}_${index}_${Date.now()}`,
          // Marcar como existente del servidor (no nuevo)
          __isNew: false,
          __modified: false
        }));
        console.log('Materiales procesados desde servidor:', this.materiales);
      },
      (error) => console.error('Error fetching data:', error)
    );
  }
   obtenerEquipos(selectedReporteId: any) {
    // alert('this.branchs'+ this.idBranch)
    console.log('Obteniendo equipos para reporte ID:', selectedReporteId);
    this.logbookService.getInfoByReporte(selectedReporteId, "EQUIPMENT").subscribe(
      (data: any) => {
        // Procesar los datos del servidor para evitar duplicaciones
        this.equipos = data.data.map((equipo: any, index: number) => ({
          ...equipo,
          // Generar ID único si viene con 0 o no tiene ID válido
          id: equipo.id && equipo.id !== 0 ? equipo.id : `server_equipo_${selectedReporteId}_${index}_${Date.now()}`,
          // Marcar como existente del servidor (no nuevo)
          __isNew: false,
          __modified: false
        }));
        console.log('Equipos procesados desde servidor:', this.equipos);
      },
      (error) => console.error('Error fetching data:', error)
    );
  }
   obtenerPersonal(selectedReporteId: any) {
    this.logbookService.getInfoByReporte(selectedReporteId, "PERSONAL").subscribe(
      (data: any) => {
        // Procesar los datos del servidor para evitar duplicaciones
        this.personal = data.data.map((persona: any, index: number) => ({
          ...persona,
          // Generar ID único si viene con 0 o no tiene ID válido
          id: persona.id && persona.id !== 0 ? persona.id : `server_personal_${selectedReporteId}_${index}_${Date.now()}`,
          // Marcar como existente del servidor (no nuevo)
          __isNew: false,
          __modified: false
        }));
        console.log('Personal procesado desde servidor:', this.personal);
        //this.updateExcelService.dataPersonal(this.personal)
      },
      (error) => console.error('Error fetching data:', error)
    );
  }
   obtenerFotografias(selectedReporteId: any) {
    this.logbookService.getInfoByReporte(selectedReporteId, "Photo").subscribe(
      (data: any) => {
        this.fotografias = data.data;
      },
      (error) => console.error('Error fetching data:', error)
    );
  }

  obtenerVideos(selectedReporteId: any) {
    this.logbookService.getInfoByReporte(selectedReporteId, "Video").subscribe(
      (data: any) => {
        this.videos = data.data.map((video: any) => {
          // La URL del video está en el campo 'imageUrl'
          const videoUrl = video.imageUrl || video.videoUrl || video.url || '';
          
          return {
            ...video,
            url: videoUrl,
            videoUrl: videoUrl
          };
        });
      },
      (error) => console.error('Error fetching data:', error)
    );
  }

  obtenerNotas(selectedReporteId: any) {
    this.logbookService.getInfoByReporte(selectedReporteId, "NOTE").subscribe(
      (data: any) => {
        // Procesar los datos del servidor para evitar duplicaciones
        this.notas = data.data.map((nota: any, index: number) => ({
          ...nota,
          // Generar ID único si viene con 0 o no tiene ID válido
          id: nota.id && nota.id !== 0 ? nota.id : `server_nota_${selectedReporteId}_${index}_${Date.now()}`,
          // Marcar como existente del servidor (no nuevo)
          __isNew: false,
          __modified: false
        }));
        console.log('Notas procesadas desde servidor:', this.notas);
      },
      (error) => console.error('Error fetching data:', error)
    );
  }

  obtenerConcep(selectedReporteId: any) {
    this.logbookService.getInfoByReporte(selectedReporteId, "CONCEPT").subscribe(
      (data: any) => {
        // Procesar los datos del servidor para evitar duplicaciones
        this.conceptos = data.data.map((concepto: any, index: number) => ({
          ...concepto,
          // Generar ID único si viene con 0 o no tiene ID válido
          id: concepto.id && concepto.id !== 0 ? concepto.id : `server_concepto_${selectedReporteId}_${index}_${Date.now()}`,
          // Marcar como existente del servidor (no nuevo)
          __isNew: false,
          __modified: false
        }));
        console.log('Conceptos procesados desde servidor:', this.conceptos);
      },
      (error) => console.error('Error fetching data:', error)
    );
  }


  catalogoMateriales(){
    return this.materialsService.getMaterials(this.idcompany, 'CONSUMABLE').subscribe(
      (data: any) => {
        this.catalogMateriales = data;
        console.log('Catálogo de materiales cargado:', this.catalogMateriales);
        if (this.materialesGridApi) {
          this.materialesGridApi.refreshCells();
          console.log('Grid de materiales actualizado con catálogo');
        }
      },
      (error) => console.error('Error fetching data:', error)
    );
  }

  catalogoEquipo(){
    return this.equipmentService.getEquipment(this.idcompany).subscribe(
      (data: any) => {
        this.catalogEquipos = data;
        console.log('Catálogo de equipos cargado:', this.catalogEquipos);

        // Actualizar el grid de equipos si ya está inicializado
        if (this.equiposGridApi) {
          this.equiposGridApi.refreshCells();
          console.log('Grid de equipos   actualizado con catálogo');
          
        }
      },
      (error) => console.error('Error fetching data:', error)
    );
  }

  getDeptoandPosition() {
    this.catalogService.getCatalogsVigente(this.idcompany, 'POSITION').subscribe(
      (data: any) => {
        this.catalogDepartamentos = data;
        console.log('Departamentos obtenidos:', this.catalogDepartamentos);
      },
      (error) => {
        if (error.status == 404) this.catalogDepartamentos = [];
        console.error('Error fetching data:', error);
      }
    );
  
  }

  obtenerUnidades(){
    return this.catalogService.getUnits(this.idcompany).subscribe(
      (data: any) => {
        this.unitsCatalog = data;
        console.log('Catálogo de unidades obtenido:', this.unitsCatalog);
      },
      (error) => console.error('Error fetching units:', error)
    );
  }
  obtenerTypeNotes(){
    return this.catalogService.getTypeNote(this.idcompany).subscribe(
      (data: any) => {
        this.typeNotesCatalog = data;
        console.log('Catálogo de tipos de nota obtenido:', this.typeNotesCatalog);
      },
      (error) => console.error('Error fetching type notes:', error)
    );
  }
  obtenerConceptos(){
    // Verificar si hay proyecto seleccionado
    if (!this.idProject) {
      console.warn('No hay proyecto seleccionado, intentando detectar automáticamente...');
      
      // Intentar detectar proyecto automáticamente desde los datos cargados
      const detectedProject = this.detectProjectFromData();
      
      if (detectedProject) {
        console.log('Proyecto detectado automáticamente:', detectedProject);
        this.idProject = parseInt(detectedProject.toString());
      } else {
        // Si no se puede detectar, solo loggear el warning
        console.warn('⚠️ No se pudo detectar proyecto para cargar conceptos. Los conceptos se cargarán sin filtro por proyecto.');
        // Solo mostrar alerta si es crítico para la funcionalidad
        // alerts.basicAlert(
        //   'Proyecto requerido',
        //   'Por favor seleccione un proyecto en el menú lateral para cargar los conceptos correctamente.',
        //   'warning'
        // );
        // En lugar de retornar EMPTY, intentar cargar conceptos sin filtro de proyecto
        // return EMPTY;
      }
    }
    
    return this.workprogramsService.getActivities(this.idProject).subscribe(
      (data: any) => {
        this.catalogConcepto = data;
        console.log('Catálogo de conceptos obtenido:', this.catalogConcepto);
        
        // Refrescar el grid de conceptos después de cargar el catálogo
        if (this.conceptosGridApi) {
          this.conceptosGridApi.refreshCells();
          console.log('Grid de conceptos actualizado con catálogo');
        }
      },
      (error) => console.error('Error fetching conceptos:', error)
    );
  }

  // Método para detectar proyecto automáticamente desde los datos
  private detectProjectFromData(): number | null {
    try {
      // Opción 1: Desde sidebar (señales)
      const sidebarProject = this.signalsService.getProjectSelectedBySidebar()();
      if (sidebarProject && sidebarProject !== 0) {
        console.log('Proyecto detectado desde sidebar:', sidebarProject);
        return sidebarProject;
      }
      
      // Opción 2: Desde OT seleccionada (probar diferentes nombres de campo)
      if (this.selectedOt) {
        const otData = this.selectedOt as any;
        const possibleFields = ['projectId', 'idProject', 'project_id', 'idProyecto', 'proyectoId'];
        
        for (const field of possibleFields) {
          if (otData[field] && otData[field] !== 0) {
            console.log(`Proyecto detectado desde OT seleccionada (campo ${field}):`, otData[field]);
            return parseInt(otData[field].toString());
          }
        }
      }
      
      // Opción 3: Desde cualquier OT en la lista
      if (this.rowData && this.rowData.length > 0) {
        const possibleFields = ['projectId', 'idProject', 'project_id', 'idProyecto', 'proyectoId'];
        
        for (const field of possibleFields) {
          const firstOtWithProject = this.rowData.find(ot => (ot as any)[field] && (ot as any)[field] !== 0);
          if (firstOtWithProject) {
            const projectId = (firstOtWithProject as any)[field];
            console.log(`Proyecto detectado desde lista de OTs (campo ${field}):`, projectId);
            return parseInt(projectId.toString());
          }
        }
      }
      
      // Opción 4: Desde datos de conceptos existentes (si hay relación con proyecto)
      if (this.conceptos && this.conceptos.length > 0) {
        // Buscar en la lista de proyectos cargada
        if (this.projectsList && this.projectsList.length > 0) {
          // Intentar correlacionar con proyectos disponibles
          const matchedProject = this.projectsList.find(project => 
            // Buscar coincidencias por nombre o algún identificador
            project.name && project.name.includes('CUADR')
          );
          if (matchedProject) {
            console.log('Proyecto detectado por correlación:', matchedProject.id);
            return parseInt(matchedProject.id.toString());
          }
        }
      }
      
      console.warn('No se pudo detectar proyecto automáticamente');
      return null;
    } catch (error) {
      console.error('Error detectando proyecto:', error);
      return null;
    }
  }

  obtenerProyectos(){
    return this.projectsService.getProjectListByCompany(this.idcompany).subscribe(
      (data: any) => {
        this.projectsList = data;
        console.log('Lista de proyectos obtenida:', this.projectsList);
        // Llamar obtenerDatos después de cargar la lista de proyectos
        this.obtenerDatos();
      },
      (error) => console.error('Error fetching projects:', error)
    );
  }

  // Métodos para manejo de columnas ajustables
  loadColumnSizes() {
    const savedSizes = localStorage.getItem('ot-column-sizes');
    if (savedSizes) {
      const sizes = JSON.parse(savedSizes);
      this.leftColumnSize = sizes.left || 8;
      this.rightColumnSize = sizes.right || 4;
    }
  }

  saveColumnSizes() {
    const sizes = {
      left: this.leftColumnSize,
      right: this.rightColumnSize
    };
    localStorage.setItem('ot-column-sizes', JSON.stringify(sizes));
  }

  adjustColumns(leftSize: number) {
    if (leftSize >= 3 && leftSize <= 9) {
      this.leftColumnSize = leftSize;
      this.rightColumnSize = 12 - leftSize;
      this.saveColumnSizes();
    }
  }

  // Métodos para drag resizer
  onResizerMouseDown(event: MouseEvent) {
    event.preventDefault();
    this.isResizing = true;
    this.startX = event.clientX;
    this.startLeftSize = this.leftColumnSize;
    
    // Obtener el ancho del contenedor
    const container = (event.target as HTMLElement).closest('.row');
    if (container) {
      this.containerWidth = container.clientWidth;
    }

    // Agregar event listeners globales
    document.addEventListener('mousemove', this.onMouseMove.bind(this));
    document.addEventListener('mouseup', this.onMouseUp.bind(this));
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }

  private onMouseMove(event: MouseEvent) {
    if (!this.isResizing) return;

    const deltaX = event.clientX - this.startX;
    const containerWidth = this.containerWidth || 1200; // fallback
    const deltaPercent = (deltaX / containerWidth) * 12; // Bootstrap tiene 12 columnas
    
    let newLeftSize = Math.round(this.startLeftSize + deltaPercent);
    
    // Limitar entre 3 y 9 columnas
    newLeftSize = Math.max(3, Math.min(9, newLeftSize));
    
    this.adjustColumns(newLeftSize);
  }

  private onMouseUp(event: MouseEvent) {
    this.isResizing = false;
    document.removeEventListener('mousemove', this.onMouseMove.bind(this));
    document.removeEventListener('mouseup', this.onMouseUp.bind(this));
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }

   async deleteMaterial() {
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Eliminar Material OT',
      'Modulo Proyectos - Ordenes de Trabajo - Materiales',
      this.trackingService.getEmail()
    );
    
    if (!this.materialesGridApi) {
      alerts.basicAlert('Error', 'Grid no disponible', 'error');
      return;
    }

    const selectedNodes = this.materialesGridApi.getSelectedNodes();
    if (selectedNodes.length === 0) {
      alerts.basicAlert('Error', 'Seleccione una entrada de material para eliminar', 'error');
      return;
    }

    const selectedData = selectedNodes[0].data;
    const id = selectedData.id;

    console.log('=== INTENTANDO ELIMINAR MATERIAL ===');
    console.log('Registro seleccionado para eliminar:', selectedData);
    console.log('ID a eliminar:', id);
    
    alerts.confirmAlert(
      'Eliminar material',
      '¿Está seguro que desea eliminar este registro de material?',
      'warning',
      'Sí, eliminar'
    ).then((value) => {
      if (value.isConfirmed) {
        console.log('=== CONFIRMACIÓN DE ELIMINACIÓN ===');
        
        if (selectedData.__isNew) {
          console.log('Eliminando registro nuevo (solo local)');
          this.materiales = this.materiales.filter(m => m.id !== id);
          this.notSavedMaterialChanges = this.materiales.some(m => m.__isNew);
          console.log('Material después de eliminación local:', this.materiales);
          alerts.basicAlert('Éxito', 'Material eliminado correctamente', 'success');
        } else {
          console.log('Eliminando registro existente usando endpoint DELETE');
          console.log('Enviando DELETE para ID:', id);
          
          this.logbookService.deleteDataForOt(Number(id)).subscribe({
            next: (response) => {
              console.log('Respuesta del DELETE:', response);
              this.materiales = this.materiales.filter(m => m.id !== id);
              console.log('Material después de eliminación del servidor:', this.materiales);
              alerts.basicAlert('Éxito', 'Material eliminado correctamente del servidor', 'success');
            },
            error: (error) => {
              console.error('Error al eliminar material del servidor:', error);
              let errorMessage = 'Error al eliminar el registro de material';
              if (error.status === 404) {
                errorMessage = 'El registro ya no existe en el servidor';
              } else if (error.status === 401) {
                errorMessage = 'No autorizado para eliminar este registro';
              }
              alerts.basicAlert('Error', errorMessage, 'error');
            }
          });
        }
      }
    });
  }

  async deleteEquipo() {
    if (!this.equiposGridApi) {
      alerts.basicAlert('Error', 'Grid no disponible', 'error');
      return;
    }

    const selectedNodes = this.equiposGridApi.getSelectedNodes();
    if (selectedNodes.length === 0) {
      alerts.basicAlert('Error', 'Seleccione una entrada de equipo para eliminar', 'error');
      return;
    }

    const selectedData = selectedNodes[0].data;
    const id = selectedData.id;

    console.log('=== INTENTANDO ELIMINAR EQUIPO ===');
    console.log('Registro seleccionado para eliminar:', selectedData);
    console.log('ID a eliminar:', id);
    
    alerts.confirmAlert(
      'Eliminar equipo',
      '¿Está seguro que desea eliminar este registro de equipo?',
      'warning',
      'Sí, eliminar'
    ).then((value) => {
      if (value.isConfirmed) {
        console.log('=== CONFIRMACIÓN DE ELIMINACIÓN ===');
        
        if (selectedData.__isNew) {
          console.log('Eliminando registro nuevo (solo local)');
          this.equipos = this.equipos.filter(m => m.id !== id);
          this.notSavedEquipoChanges = this.equipos.some(m => m.__isNew);
          console.log('Equipo después de eliminación local:', this.equipos);
          alerts.basicAlert('Éxito', 'Equipo eliminado correctamente', 'success');
        } else {
          console.log('Eliminando registro existente usando endpoint DELETE');
          console.log('Enviando DELETE para ID:', id);
          
          this.logbookService.deleteDataForOt(Number(id)).subscribe({
            next: (response) => {
              console.log('Respuesta del DELETE:', response);
              this.equipos = this.equipos.filter(m => m.id !== id);
              console.log('Equipo después de eliminación del servidor:', this.equipos);
              alerts.basicAlert('Éxito', 'Equipo eliminado correctamente del servidor', 'success');
            },
            error: (error) => {
              console.error('Error al eliminar equipo del servidor:', error);
              let errorMessage = 'Error al eliminar el registro de equipo';
              if (error.status === 404) {
                errorMessage = 'El registro ya no existe en el servidor';
              } else if (error.status === 401) {
                errorMessage = 'No autorizado para eliminar este registro';
              }
              alerts.basicAlert('Error', errorMessage, 'error');
            }
          });
        }
      }
    });
  }


 // -- Métodos para Conceptos --
  addConcepto() {
    if (!this.selectedOt) {
      alerts.basicAlert('Error', 'Debe seleccionar una OT primero', 'error');
      return;
    }

    if (!this.selectedReporteFecha) {
      alerts.basicAlert('Error', 'Debe seleccionar una fecha de reporte primero', 'error');
      return;
    }

    // Generar un ID temporal único
    const tempId = Date.now() + Math.random();
    
    // Calcular el siguiente orden basado en conceptos existentes
    const maxOrden = this.conceptos.length > 0 
      ? Math.max(...this.conceptos.map(c => c.orden || 0)) 
      : 0;

    const newConcepto = {
      id: tempId,
      idOt: parseInt(this.selectedOt.id),
      idReporte: this.selectedReporteId,
      idResource: null, // Se almacenará el ID del concepto
      position: '', 
      quantity: 1.0,
      start: this.selectedReporteHoraInicio + ':00',
      end: this.selectedReporteHoraTermino + ':00',
      date: this.selectedReporteFecha,
      typeNote: 'CONCEPT',
      description: 'SIN DESCRIPCIÓN',
      request: 'DEFAULT_REQUEST', // Campo requerido por backend
      orden: maxOrden + 1,
      __isNew: true
    };

    this.conceptos = [newConcepto, ...this.conceptos];
    this.notSavedConceptoChanges = true;
    
    setTimeout(() => {
      if (this.conceptosGridApi) {
        //this.conceptosGridApi.setGridOption('rowData', this.conceptos);
        setTimeout(() => {
          this.conceptosGridApi.startEditingCell({
            rowIndex: 0,
            colKey: 'description'
          });
        }, 100);
      }
    }, 0);
  }

  
  async saveConceptosChanges() {
    const newRows = this.conceptos.filter(row => row.__isNew);
  const modifiedRows = this.conceptos.filter(row => row.__modified && !row.__isNew);
  /*const invalidNewRows = newRows.filter(item => !item.date || !item.supervisor);
  
  if (invalidNewRows.length > 0) {
    alerts.basicAlert('Añadir entrada', 'Debe introducir la fecha y supervisor antes de guardar.', 'error');
    return;
  }*/

  if (newRows.length === 0 && modifiedRows.length === 0) {
    alerts.basicAlert('Info', 'No hay cambios para guardar', 'info');
    return;
  }

  try {
    const addRequests = newRows.map((row, index) => {
      console.log(`=== FILA ORIGINAL ${index + 1} ===`, row);
      const cleanedData = this.cleanDataSinDescripcion(row);
      console.log(`=== DATOS LIMPIADOS ${index + 1} ===`, cleanedData);
      console.log(`JSON.stringify:`, JSON.stringify(cleanedData, null, 2));
      return this.logbookService.addDataForOt(cleanedData).toPromise();
    });

    const updateRequests = modifiedRows.map((row, index) => {
      const cleanedData = this.cleanDataSinDescripcion(row);
      console.log(`Datos limpiados para fila modificada ${index + 1}:`, cleanedData);
      return this.logbookService.updateDataForOt(Number(row.id), cleanedData).toPromise();
    });

    console.log(`Ejecutando ${addRequests.length} requests de creación`);
    console.log(`Ejecutando ${updateRequests.length} requests de actualización`);

    const responses = await Promise.all([...addRequests, ...updateRequests]);
    
    console.log('=== RESPUESTAS RECIBIDAS ===');
    console.log('Número de respuestas:', responses.length);
    responses.forEach((response, index) => {
      console.log(`Respuesta ${index + 1}:`, response);
      
      // Verificar estructura de la respuesta
      if (response && typeof response === 'object') {
        console.log(`- success: ${response.success}`);
        console.log(`- message: ${response.message}`);
        console.log(`- data: ${response.data ? 'SÍ' : 'NO'}`);
        
        if (response.data) {
          console.log(`- data.id: ${response.data.id}`);
        }
      }
    });

    // Verificar si las respuestas son exitosas
    const failedResponses = responses.filter(response => 
      !response || 
      (response.hasOwnProperty('success') && !response.success) ||
      (response.status && response.status >= 400)
    );

    if (failedResponses.length > 0) {
      console.error('Respuestas fallidas:', failedResponses);
      throw new Error(`${failedResponses.length} requests fallaron`);
    }

    console.log('=== GUARDADO EXITOSO ===');
    alerts.basicAlert('Datos actualizados', 'Se han actualizado los datos correctamente.', 'success');
    this.autoUpdatePdf()
    this.notSavedConceptoChanges = false;
    this.conceptos.forEach(item => {
        delete item.__isNew;
        delete item.__modified;
      });

    // Actualizar automáticamente el totalPay del reporte diario
    await this.updateTotalPayAfterConceptos();

    // Recargar datos desde el servidor
    console.log('Recargando datos desde el servidor...');
    await this.loadDailyReports();
    console.log('Datos recargados exitosamente');

  } catch (error: any) {
    console.error('=== ERROR DETALLADO ===');
    console.error('Error completo:', error);
    
    // Log específico para errores de validación
    if (error.status === 400 && error.error && error.error.errors) {
      console.error('Errores de validación específicos:', error.error.errors);
    }
    
    let errorMessage = 'Ocurrió un error al actualizar los datos.';
    
    if (error.status === 400) {
      errorMessage = 'Datos inválidos. Verifique que todos los campos estén correctos.';
      
      // Mostrar errores específicos si están disponibles
      if (error.error && error.error.errors) {
        const validationErrors = Object.keys(error.error.errors).map(key => 
          `${key}: ${error.error.errors[key].join(', ')}`
        ).join('\n');
        errorMessage += '\n\nErrores específicos:\n' + validationErrors;
      }
    } else if (error.status === 401) {
      errorMessage = 'No autorizado. Por favor, vuelva a iniciar sesión.';
    } else if (error.status === 403) {
      errorMessage = 'No tiene permisos para realizar esta operación.';
    } else if (error.status === 404) {
      errorMessage = 'Recurso no encontrado. Verifique la URL del servicio.';
    } else if (error.status === 500) {
      errorMessage = 'Error interno del servidor. Contacte al administrador.';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    alerts.basicAlert('Error', errorMessage, 'error');
  }
  }

    // Método para actualizar totalPay después de guardar conceptos
private async updateTotalPayAfterConceptos(): Promise<void> {
  if (!this.selectedReporteId) {
    console.log('No hay reporte seleccionado para actualizar totalPay');
    return;
  }

  try {
    console.log('🧮 Calculando totalPay para reporte ID:', this.selectedReporteId);
    
    const reporteId = Number(this.selectedReporteId);
    const costResponse = await this.dailyReportService.getReportxCost(reporteId).toPromise();
    console.log('💰 Respuesta de costo:', costResponse);

    if (costResponse && costResponse.total && Array.isArray(costResponse.total) && costResponse.total.length > 0) {
      const calculatedTotal = costResponse.total[0].total;
      console.log('💵 Total calculado:', calculatedTotal);

      // Buscar el reporte actual en el array de reportes diarios
      const currentReport = this.reportesDiarios.find(r => r.id === this.selectedReporteId);
      if (currentReport) {
        // Actualizar el campo paid (que corresponde a totalPay) silenciosamente
        (currentReport as any).paid = calculatedTotal;
        console.log('✅ TotalPay actualizado en memoria:', calculatedTotal);

        // Actualizar en el servidor - AJUSTADO PARA EL NUEVO ENDPOINT
        const updateData = {
          totalPay: calculatedTotal  // Solo enviar el campo que necesitas
        };

        await this.dailyReportService.updateCostReport(reporteId, updateData).toPromise();
        console.log('✅ TotalPay actualizado en servidor exitosamente');
        
      } else {
        console.warn('⚠️ No se encontró el reporte actual para actualizar totalPay');
      }
    } else {
      console.log('ℹ️ No se encontraron totales en la respuesta de costos');
    }

  } catch (error) {
    console.error('❌ Error al actualizar totalPay:', error);
    // No mostrar error al usuario ya que debe ser silencioso
  }
}

  revertConceptos() {
   this.obtenerConcep(this.selectedReporteId);
  this.notSavedConceptoChanges = false;
  }
  deleteConcepto() {
    if (!this.conceptosGridApi) {
      alerts.basicAlert('Error', 'Grid no disponible', 'error');
      return;
    }

    const selectedNodes = this.conceptosGridApi.getSelectedNodes();
    if (selectedNodes.length === 0) {
      alerts.basicAlert('Error', 'Seleccione una entrada de concepto para eliminar', 'error');
      return;
    }

    const selectedData = selectedNodes[0].data;
    const id = selectedData.id;

    console.log('=== INTENTANDO ELIMINAR CONECEPTO ===');
    console.log('Registro seleccionado para eliminar:', selectedData);
    console.log('ID a eliminar:', id);
    
    alerts.confirmAlert(
      'Eliminar concepto',
      '¿Está seguro que desea eliminar este registro de concepto?',
      'warning',
      'Sí, eliminar'
    ).then((value) => {
      if (value.isConfirmed) {
        console.log('=== CONFIRMACIÓN DE ELIMINACIÓN ===');
        
        if (selectedData.__isNew) {
          console.log('Eliminando registro nuevo (solo local)');
          this.conceptos = this.conceptos.filter(m => m.id !== id);
          this.notSavedConceptoChanges = this.conceptos.some(m => m.__isNew);
          console.log('Concepto después de eliminación local:', this.conceptos);
          alerts.basicAlert('Éxito', 'Concepto eliminado correctamente', 'success');
        } else {
          console.log('Eliminando registro existente usando endpoint DELETE');
          console.log('Enviando DELETE para ID:', id);
          
          this.logbookService.deleteDataForOt(Number(id)).subscribe({
            next: (response) => {
              console.log('Respuesta del DELETE:', response);
              this.conceptos = this.conceptos.filter(m => m.id !== id);
              console.log('Concepto después de eliminación del servidor:', this.conceptos);
              alerts.basicAlert('Éxito', 'Concepto eliminado correctamente del servidor', 'success');
            },
            error: (error) => {
              console.error('Error al eliminar concepto del servidor:', error);
              let errorMessage = 'Error al eliminar el registro de concepto';
              if (error.status === 404) {
                errorMessage = 'El registro ya no existe en el servidor';
              } else if (error.status === 401) {
                errorMessage = 'No autorizado para eliminar este registro';
              }
              alerts.basicAlert('Error', errorMessage, 'error');
            }
          });
        }
      }
    });
  }

  // -- Métodos para Notas --
  addNota() {
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Agregar Nota OT',
      'Modulo Proyectos - Ordenes de Trabajo - Notas',
      this.trackingService.getEmail()
    );
    
    if (!this.selectedOt) {
      alerts.basicAlert('Error', 'Debe seleccionar una OT primero', 'error');
      return;
    }

    if (!this.selectedReporteFecha) {
      alerts.basicAlert('Error', 'Debe seleccionar una fecha de reporte primero', 'error');
      return;
    }

    const newNota = {
      idOt: parseInt(this.selectedOt.id),
      idReporte: this.selectedReporteId,
      idResource: '', // Inicializar como string vacío para consistencia
      quantity: 1,
      unidad: '', // Inicializar campo unidad explícitamente
      start: this.selectedReporteHoraInicio + ':00',
      end: this.selectedReporteHoraTermino + ':00',
      date: this.selectedReporteFecha,
      typeNote: 'NOTE',
      orden: 1,
      __isNew: true
    };

    this.notas = [newNota, ...this.notas];
    this.notSavedNoteChanges = true;

    setTimeout(() => {
      if (this.notasGridApi) {
        //this.notasGridApi.setGridOption('rowData', this.notas);
        setTimeout(() => {
          this.notasGridApi.startEditingCell({
            rowIndex: 0,
            colKey: 'idResource'
          });
        }, 100);
      }
    }, 0);
  }
  async saveNotasChanges() {
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Guardar Cambios Notas OT',
      'Modulo Proyectos - Ordenes de Trabajo - Notas',
      this.trackingService.getEmail()
    );
    
    const newRows = this.notas.filter(row => row.__isNew);
    const modifiedRows = this.notas.filter(row => row.__modified && !row.__isNew);
  /*const invalidNewRows = newRows.filter(item => !item.date || !item.supervisor);
  
  if (invalidNewRows.length > 0) {
    alerts.basicAlert('Añadir entrada', 'Debe introducir la fecha y supervisor antes de guardar.', 'error');
    return;
  }*/

  if (newRows.length === 0 && modifiedRows.length === 0) {
    alerts.basicAlert('Info', 'No hay cambios para guardar', 'info');
    return;
  }

  try {
    const addRequests = newRows.map((row, index) => {
      console.log(`=== FILA ORIGINAL ${index + 1} ===`, row);
      const cleanedData = this.cleanDataForServer(row);
      console.log(`=== DATOS LIMPIADOS ${index + 1} ===`, cleanedData);
      console.log(`JSON.stringify:`, JSON.stringify(cleanedData, null, 2));
      return this.logbookService.addDataForOt(cleanedData).toPromise();
    });

    const updateRequests = modifiedRows.map((row, index) => {
      const cleanedData = this.cleanDataForServer(row);
      console.log(`Datos limpiados para fila modificada ${index + 1}:`, cleanedData);
      return this.logbookService.updateDataForOt(Number(row.id), cleanedData).toPromise();
    });

    console.log(`Ejecutando ${addRequests.length} requests de creación`);
    console.log(`Ejecutando ${updateRequests.length} requests de actualización`);

    const responses = await Promise.all([...addRequests, ...updateRequests]);
    
    console.log('=== RESPUESTAS RECIBIDAS ===');
    console.log('Número de respuestas:', responses.length);
    responses.forEach((response, index) => {
      console.log(`Respuesta ${index + 1}:`, response);
      
      // Verificar estructura de la respuesta
      if (response && typeof response === 'object') {
        console.log(`- success: ${response.success}`);
        console.log(`- message: ${response.message}`);
        console.log(`- data: ${response.data ? 'SÍ' : 'NO'}`);
        
        if (response.data) {
          console.log(`- data.id: ${response.data.id}`);
        }
      }
    });

    // Verificar si las respuestas son exitosas
    const failedResponses = responses.filter(response => 
      !response || 
      (response.hasOwnProperty('success') && !response.success) ||
      (response.status && response.status >= 400)
    );

    if (failedResponses.length > 0) {
      console.error('Respuestas fallidas:', failedResponses);
      throw new Error(`${failedResponses.length} requests fallaron`);
    }

    console.log('=== GUARDADO EXITOSO ===');
    alerts.basicAlert('Datos actualizados', 'Se han actualizado los datos correctamente.', 'success');
    this.autoUpdatePdf()
    this.notSavedNoteChanges = false;
    this.notas.forEach(item => {
        delete item.__isNew;
        delete item.__modified;
      });

    // Recargar datos desde el servidor
    console.log('Recargando datos desde el servidor...');
    await this.loadDailyReports();
    console.log('Datos recargados exitosamente');

  } catch (error: any) {
    console.error('=== ERROR DETALLADO ===');
    console.error('Error completo:', error);
    
    // Log específico para errores de validación
    if (error.status === 400 && error.error && error.error.errors) {
      console.error('Errores de validación específicos:', error.error.errors);
    }
    
    let errorMessage = 'Ocurrió un error al actualizar los datos.';
    
    if (error.status === 400) {
      errorMessage = 'Datos inválidos. Verifique que todos los campos estén correctos.';
      
      // Mostrar errores específicos si están disponibles
      if (error.error && error.error.errors) {
        const validationErrors = Object.keys(error.error.errors).map(key => 
          `${key}: ${error.error.errors[key].join(', ')}`
        ).join('\n');
        errorMessage += '\n\nErrores específicos:\n' + validationErrors;
      }
    } else if (error.status === 401) {
      errorMessage = 'No autorizado. Por favor, vuelva a iniciar sesión.';
    } else if (error.status === 403) {
      errorMessage = 'No tiene permisos para realizar esta operación.';
    } else if (error.status === 404) {
      errorMessage = 'Recurso no encontrado. Verifique la URL del servicio.';
    } else if (error.status === 500) {
      errorMessage = 'Error interno del servidor. Contacte al administrador.';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    alerts.basicAlert('Error', errorMessage, 'error');
  }
  }
  revertNotas() {
    this.obtenerNotas(this.selectedReporteId);
    this.notSavedNoteChanges = false;
  }

  onNotasGridReady(params: any) {
    this.notasGridApi = params.api;
    console.log('Notes grid ready');
  }

  onCellValueChangedNota(event: any) {
    console.log('Cell value changed in notas:', event);
    event.data.__modified = true;
    this.notSavedNoteChanges = true;
  }

  deleteNota() {
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Eliminar Nota OT',
      'Modulo Proyectos - Ordenes de Trabajo - Notas',
      this.trackingService.getEmail()
    );
    
    if (!this.notasGridApi) {
      alerts.basicAlert('Error', 'Grid no disponible', 'error');
      return;
    }

    const selectedNodes = this.notasGridApi.getSelectedNodes();
    if (selectedNodes.length === 0) {
      alerts.basicAlert('Error', 'Seleccione una entrada de nota para eliminar', 'error');
      return;
    }

    const selectedData = selectedNodes[0].data;
    const id = selectedData.id;

    console.log('=== INTENTANDO ELIMINAR EQUIPO ===');
    console.log('Registro seleccionado para eliminar:', selectedData);
    console.log('ID a eliminar:', id);
    
    alerts.confirmAlert(
      'Eliminar nota',
      '¿Está seguro que desea eliminar este registro de nota?',
      'warning',
      'Sí, eliminar'
    ).then((value) => {
      if (value.isConfirmed) {
        console.log('=== CONFIRMACIÓN DE ELIMINACIÓN ===');
        
        if (selectedData.__isNew) {
          console.log('Eliminando registro nuevo (solo local)');
          this.notas = this.notas.filter(m => m.id !== id);
          this.notSavedNoteChanges = this.notas.some(m => m.__isNew);
          console.log('Notas después de eliminación local:', this.notas);
          alerts.basicAlert('Éxito', 'Nota eliminada correctamente', 'success');
        } else {
          console.log('Eliminando registro existente usando endpoint DELETE');
          console.log('Enviando DELETE para ID:', id);
          
          this.logbookService.deleteDataForOt(Number(id)).subscribe({
            next: (response) => {
              console.log('Respuesta del DELETE:', response);
              this.notas = this.notas.filter(m => m.id !== id);
              console.log('Notas después de eliminación del servidor:', this.notas);
              alerts.basicAlert('Éxito', 'Nota eliminada correctamente del servidor', 'success');
            },
            error: (error) => {
              console.error('Error al eliminar nota del servidor:', error);
              let errorMessage = 'Error al eliminar el registro de nota';
              if (error.status === 404) {
                errorMessage = 'El registro ya no existe en el servidor';
              } else if (error.status === 401) {
                errorMessage = 'No autorizado para eliminar este registro';
              }
              alerts.basicAlert('Error', errorMessage, 'error');
            }
          });
        }
      }
    });
  }

  private autoUpdatePdf() {
    // Debounce para evitar múltiples llamadas
    if (this.autoUpdateTimeout) {
      clearTimeout(this.autoUpdateTimeout);
    }
    
    this.autoUpdateTimeout = setTimeout(() => {
      console.log('Auto-actualizando PDF tras cambios guardados...');
      this.generatePdfPreview();
    }, 500); // Esperar 500ms antes de regenerar
  }

  private autoUpdateTimeout: any;

  ngOnDestroy() {
    // Limpiar el timeout si existe
    if (this.autoUpdateTimeout) {
      clearTimeout(this.autoUpdateTimeout);
    }
    
    // Limpiar el estado del modal cuando se destruye el componente
    // para evitar que aparezca en otros componentes
    try {
      if (this.modalServiceTable) {
        // Ocultar el modal y limpiar los datos
        this.modalServiceTable.hideModal();
        this.modalServiceTable.updateData(null);
      }
    } catch (error) {
      console.log('Error al limpiar modal state:', error);
    }
    
    // Cerrar conexión SignalR al destruir el componente
    this.signalrService.stopConnection();
    
    console.log('OrdenesComponent destruido - modal state limpiado');
  }
}
