import { Component, effect, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent ,CellDoubleClickedEvent, ICellRendererParams,} from 'ag-grid-enterprise';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { OtService } from 'app/services/ot.service';
import { DailyReportService } from 'app/services/daily-report.service';
import { LogbookService } from 'app/services/logbook.service';
import pdfMake from 'pdfmake/build/pdfmake';
import { SignalsService } from 'app/services/signals.service';
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
import * as bootstrap from 'bootstrap';

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

@Component({
  selector: 'app-ordenes',
  standalone: true,
  imports: [CommonModule, TranslateModule, AgGridModule, ReactiveFormsModule],
  templateUrl: './ordenes.component.html',
  styleUrl: './ordenes.component.scss',
})
export class OrdenesComponent implements OnDestroy {
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
    public conceptos  : any[] = [];
  public notas        : any[] = [];

  // Variables para el nuevo layout
  public selectedOt: OrdenesData | null = null;
  public activeTab: string = 'reportes';
  public selectedReporteFecha: string = '';
  public selectedReporteTipo: string = '';
  public selectedReporteHoraInicio: string = '';
  public selectedReporteHoraTermino: string = '';
  public selectedReporteId: number | string | null = null;
  public selectedFotografia: Fotografia | null = null;
  public selectedStatusReport: boolean = false;
  

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
  gridHeight = '50vh';
  gridWidth = '100%';
  gridWidthDetail = '100%'; 
  isGeneratingPdf: boolean = false;
  isGeneratingPdfEmbed: boolean = false;
  pdfUrl: SafeResourceUrl | null = null;
  private originalUrl: string | null = null;
  showPdfEmbed: boolean = false;
  fechaInicio: string = '';
  fechaFin: string = '';
  projet: number = 0;
  myForm;
  isGeneratingReport: boolean = false;
  private modalInstance: any = null;

  public  materiales: any[] = [];
  public equipos: any[] = [];
  public personal: any[] = [];
  public fotografias: any[] = [];

  
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
  excel() {
    // Reset form to initial state
    this.myForm.reset();
    this.fechaInicio = '';
    this.fechaFin = '';
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
  onSubmit() {
    if (this.myForm.invalid) {
      alerts.basicAlert('Info', 'Por favor, completa todos los campos requeridos.','info' );
      return;
    }

    const formValues = this.myForm.value;
    this.fechaInicio = formValues.fechaInicio;
    this.fechaFin = formValues.fechaFin;

    if (this.fechaInicio > this.fechaFin) {
      alert('La fecha de inicio no puede ser mayor que la fecha de fin.');
      return;
    }

    // Set loading state
    this.isGeneratingReport = true;

    this.updateExcelService.processAndDownload(this.fechaInicio, this.fechaFin).subscribe({
      next: (blob: Blob) => {
        this.isGeneratingReport = false;
        
        // Create download link
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `FORMATO_GENERADOR_${new Date().getTime()}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        console.log('Excel generado y descargado exitosamente');
        alerts.basicAlert('Éxito',`Excel generado desde ${this.fechaInicio} hasta ${this.fechaFin}`, 'success');
        this.closeModal();
      },
      error: (error) => {
        this.isGeneratingReport = false;
        console.error('Error al generar Excel:', error);
        alerts.basicAlert('Error','Error al generar el Excel. Inténtalo de nuevo.', 'error');
      }
    });
  }

  cancelar() {
    this.fechaInicio = '';
    this.fechaFin = '';
  }

  closeModal() {
    if (this.modalInstance) {
      this.modalInstance.hide();
    }
  }

  // Configuraciones de columnas para AG-Grid
  // Definición de columnas
  public oTcolumnDefs: ColDef[] = [
    /*   {
      field: 'id',
      headerName: 'ID',
      sortable: true,
      filter: true,
      resizable: true,
      width: 77,
    }, 
        {
      field: 'description',
      headerName: 'Descripción del Servicio',
      sortable: true,
      filter: true,
      resizable: true,
      width: 1,
      hide: true
    },
    {
      field: 'address',
      headerName: 'Dirección',
      sortable: true,
      filter: true,
      resizable: true,
      flex: 2,
    },
   */

    {
      field: 'otNumber',
      headerName: 'OT',
      sortable: true,
      filter: true,
      resizable: true,
      flex: 1
    },
     {
      field: 'results',
      headerName: 'Resultados',
      sortable: true,
      filter: true,
      resizable: true,
      flex: 2,
    },

  ];

 public get materialesColumnDefs(): ColDef[] {
  return [
  {
  field: 'idResource',
  headerName: 'Material',
  flex: 2,
  editable: () => !this.signalsService.getClosedReport()(),
  cellEditor: 'agSelectCellEditor',
  cellEditorParams: {
    values: this.catalogMateriales?.map((item) => item.description) || [],
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
    console.log('=== VALUE SETTER MATERIALES ===');
    console.log('Nuevo valor (descripción):', params.newValue);
    console.log('Valor anterior:', params.oldValue);
    console.log('Data antes:', params.data.idResource);
    
    if (!params.newValue) {
      params.data.idResource = null;
      return true;
    }
    
    const foundItem = this.catalogMateriales?.find(item => item.description === params.newValue);
    if (foundItem) {
      console.log('Material encontrado, asignando ID:', foundItem.id);
      params.data.idResource = foundItem.id;
      console.log('Data después:', params.data.idResource);
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
    cellEditorParams: (params: any) => ({
      values: this.catalogEquipos?.map((item) => item.description) || [],
    }),
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
      console.log('=== VALUE SETTER EQUIPOS ===');
      console.log('Nuevo valor (descripción):', params.newValue);
      console.log('Valor anterior:', params.oldValue);
      console.log('Data antes:', params.data.idResource);

      if (!params.newValue) {
        params.data.idResource = null;
        console.log('Data después (null):', params.data.idResource);
        return true;
      }

      const foundItem = this.catalogEquipos?.find(item => item.description === params.newValue);
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
    { field: 'quantity', headerName: 'Cantidad', flex: 1, editable: this.signalsService.getClosedReport()()? false : true },
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
          values: this.employees.map(emp => emp.name)
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
        if (params.newValue) {
          const employee = this.employees.find(emp => emp.name === params.newValue);
          if (employee) {
            // Establecer el ID del empleado
            params.data[params.colDef.field] = employee.id.toString();
            const depto = this.catalogDepartamentos.find(d => d.id === +employee.idPosition);
          
            // 🟢 Establecer automáticamente la posición (o cualquier otro campo que quieras)
            params.data['position'] = depto ? depto.description : ''; // o employee.position si tienes ese campo
            //params.data['cuadrilla'] = 'Cuadrilla'; // si quieres poner un valor por defecto también
          
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
      editable: false
    },

    { 
      field: 'cuadrilla', 
      headerName: 'Cuadrilla', 
      flex: 1, editable:() => !this.signalsService.getClosedReport()(), 
      valueGetter: (params) => {
        return params.data.cuadrilla || 'Cuadrilla ';
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
    { field: 'description', headerName: 'Descripción', flex: 1, editable: this.signalsService.getClosedReport()()? false : true },
    //{ field: 'fecha', headerName: 'Fecha', width: 120 }
  ];

 public notasColumnDefs: ColDef[] = [
  {
    field: 'idResource',
    headerName: 'Equipo',
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



  public conceptosColumnDefs: ColDef[] = [
    {
    field: 'idResource',
    headerName: 'Trabajo realizado',
    flex: 2,
    editable: () => !this.signalsService.getClosedReport()(),
    cellEditor: 'agSelectCellEditor',
    cellEditorParams: (params: any) => ({
      values: this.catalogConcepto?.map((item) => item.actandNom) || [],
    }),
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
      console.log('=== VALUE SETTER EQUIPOS ===');
      console.log('Nuevo valor (descripción):', params.newValue);
      console.log('Valor anterior:', params.oldValue);
      console.log('Data antes:', params.data.idResource);

      if (!params.newValue) {
        params.data.idResource = null;
        console.log('Data después (null):', params.data.idResource);
        return true;
      }

      const foundItem = this.catalogConcepto?.find(item => item.actandNom === params.newValue);
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
  { field: 'quantity', headerName: 'Cantidad', flex: 1, editable: this.signalsService.getClosedReport()()? false : true },
  ]

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
      orden: 1,
      __isNew: true
    };

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

  async saveFotografiasChanges() {
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Guardar Cambios Fotografías OT',
      'Modulo Proyectos - Ordenes de Trabajo - Fotografías',
      this.trackingService.getEmail()
    );
    
    const newRows = this.fotografias.filter(row => row.__isNew);
    const modifiedRows = this.fotografias.filter(row => row.__modified && !row.__isNew);

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

  revertFotografias() {
    this.obtenerFotografias(this.selectedReporteId);
    this.notSavedFotografiaChanges = false;
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

  // Configuración de columnas para reportes diarios con edición inline
  public reportesColumnDefs: ColDef[] = [
    { 
      field: 'date', 
      headerName: 'Fecha', 
      width: 90, 
      editable: () => !this.signalsService.getClosedReport()(),
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
      width: 85, 
      editable: () => !this.signalsService.getClosedReport()(),
      cellEditor: 'timeEditor',
      valueFormatter: (params) => {
        return params.value ? params.value.substring(0, 5) : '';
      }
    },
    { 
      field: 'endTime', 
      headerName: 'Término', 
      width: 105, 
      editable: () => !this.signalsService.getClosedReport()(),
      cellEditor: 'timeEditor',
      valueFormatter: (params) => {
        return params.value ? params.value.substring(0, 5) : '';
      }
    },
    /*{ 
      field: 'type', 
      headerName: 'Area', 
      width: 90, 
      editable: () => !this.signalsService.getClosedReport()(),
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: {
        values: ['CORTES', 'RECONEXIONES', 'MEDIDORES', 'INSPECCIONES']
      }
    },
    { 
      field: 'supervisor', 
      headerName: 'Supervisor', 
      width: 120,
      editable: true
    },*/
    { 
      field: 'description', 
      headerName: 'Comentario', 
      editable: () => !this.signalsService.getClosedReport()(),
      width: 120,
    },
    { 
      field: 'close', 
      headerName: 'Cerrado', 
      editable: () => !this.signalsService.getClosedReport()(),
      width: 120,
    }
  ];

  // Variables para el grid de reportes
  public reportesGridApi!: GridApi;
  
  // Variables para el grid de personal
  public personalGridApi!: GridApi;
  
  // Variables para el grid de materiales
  public materialesGridApi!: GridApi;

  public fotografiaGridApi!: GridApi;

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
    onRowDoubleClicked: (event: any) => this.onRowDoubleClicked(event),
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
    this.myForm = this.formBuilder.group({
      fechaInicio: ['', Validators.required],
      fechaFin: ['', Validators.required]
    });

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
      this.obtenerDatos();
      this.loadEmployees();
      this.getDeptoandPosition();
      this.obtenerUnidades();
    });

    // Effect para auto-actualizar PDF cuando se guarden cambio

    this.loadColumnSizes();
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

  obtenerDatos() {
    this.otService.getOtListByProject(this.idProject).subscribe({
      next: (data: any) => {
        console.log('Datos obtenidos del servicio OT:', data);
        this.rowData = data;
        this.trackingService.addLog(
          this.trackingService.getnameComp(),
          'Get Lista de OT',
          'Menu Proyectos Ordenes de Trabajo',
          this.trackingService.getEmail()
        );
      },
      error: (error) => {
        console.error('Error al obtener datos de OT:', error);
        this.rowData = [];
      },
    });
  }

  // Métodos del grid
  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    // Remover sizeColumnsToFit para que funcione el flex
    // params.api.sizeColumnsToFit();
  }

  onSelectionChanged(event: any) {
    const selectedRows = this.gridApi.getSelectedRows();
    console.log('Fila seleccionada:', selectedRows);
    
    // Actualizar la OT seleccionada para mostrar en la vista previa
    if (selectedRows.length > 0) {
      this.selectedOt = selectedRows[0];
      this.activeTab = 'reportes'; // Resetear a la primera pestaña
      
      // Limpiar selección de reporte anterior
      this.selectedReporteFecha = '';
      this.selectedReporteTipo = '';
      this.selectedReporteHoraInicio = '';
      this.selectedReporteHoraTermino = '';
      this.selectedReporteId = null;
      
      // Resetear vista previa del PDF
      this.showPdfEmbed = false;
      this.pdfUrl = null;
      if (this.originalUrl) {
        URL.revokeObjectURL(this.originalUrl);
        this.originalUrl = null;
      }
      
      console.log('OT seleccionada:', this.selectedOt);
      
      // Cargar reportes diarios para esta OT
      this.loadDailyReports();
      
      // Cargar datos de Personal para esta OT
      this.loadPersonalData();
    } else {
      this.selectedOt = null;
    }
  }

  onRowDoubleClicked(event: any) {
    const rowData = event.data;
    if (rowData && rowData.id) {
      this.router.navigate(['/projects/ot/details', rowData.id]);
    }
  }

  // Métodos para pestañas y vista previa
  setActiveTab(tab: string) {
    this.activeTab = tab;
    console.log('Pestaña activa:', tab);
  }

  selectReporte(reporte: ReporteDiario) {
    this.selectedReporteFecha = reporte.fecha || reporte.date.split('T')[0];
    this.selectedReporteTipo = reporte.tipoNota || reporte.type;
    this.selectedReporteHoraInicio = reporte.horaInicio || reporte.startTime.substring(0, 5);
    this.selectedReporteHoraTermino = reporte.horaTermino || reporte.endTime.substring(0, 5);
    this.selectedReporteId = reporte.id;
    const id: number = Number(this.selectedReporteId);
    //this.updateExcelService.UpdateOT(id)
    this.signalsService.setClosedReport(reporte.close)
    this.obtenerMateriales(this.selectedReporteId);
    this.obtenerEquipos(this.selectedReporteId);
    this.obtenerPersonal(this.selectedReporteId);
    this.obtenerFotografias(this.selectedReporteId);
    this.obtenerNotas(this.selectedReporteId);
    this.obtenerConcep(this.selectedReporteId);

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
      date: '',
      startTime: '',
      endTime: '',
      supervisor: 'SIN SUPERVISOR',
      type: 'SUSPENSION',
      description: 'SIN DESCRIPCIÓN',
      result: 'SIN RESULTADO',
      active: true,
      close: false,
      __isNew: true
    };

    console.log('Agregando nuevo reporte:', newReporte);
    this.reportesDiarios = [newReporte, ...this.reportesDiarios];
    this.notSavedChanges = true;
    
    setTimeout(() => {
      if (this.reportesGridApi) {
        this.reportesGridApi.startEditingCell({
          rowIndex: 0,
          colKey: 'date'
        });
      }
    }, 0);
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
      alerts.basicAlert('Error', 'Debe seleccionar una OT primero', 'error');
      return;
    }

    if (!this.selectedReporteId || !this.selectedReporteFecha) {
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
      const inputData = {
        id: parseInt(this.selectedOt.id),
        date: this.selectedReporteFecha,
        description: this.selectedOt.description,
        personalData: this.personal, // Usar directamente this.personal ya que está filtrado por idReporte
        materialesData: this.materiales,
        equiposData: this.equipos,
        fotografiasData: this.fotografias, // Agregar fotografías de la pestaña
        notasData: this.notas, // Agregar notas de la pestaña
        idReport: typeof this.selectedReporteId === 'string' ? parseInt(this.selectedReporteId) : this.selectedReporteId, // Agregar idReport para obtener notas de TRABAJO ANTECEDENTES
        typeNotesCatalog: this.typeNotesCatalog, // Agregar catálogo de tipos de notas
        conceptosData: this.conceptos,
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

        console.log('PDF generado exitosamente para vista previa');
        
        //alerts.basicAlert('Éxito', 'PDF generado correctamente', 'success');
      });

    } catch (error) {
      console.error('Error al generar PDF:', error);
      this.isGeneratingPdf = false;
      
      let errorMessage = 'No se pudo generar el PDF del reporte';
      if (error instanceof Error) {
        errorMessage = error.message;
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

      this.uploadPdf(file);
    }

    // Limpiar el input para permitir seleccionar el mismo archivo nuevamente
    input.value = '';
  }

  uploadPdf(file: File) {
    this.isUploading = true;

    console.log('=== PDF Upload Process Started ===');
    console.log('File details:', {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: new Date(file.lastModified),
    });
    console.log('Project ID being sent:', 760);
    console.log('Calling OtService.addOtViaPdf with parameters:', {
      projectId: 760,
      file: file,
    });

    this.otService.addOtViaPdf(760, file).subscribe({
      next: (response: any) => {
        console.log('=== PDF Upload Success ===');
        console.log('Response received:', response);

        this.isUploading = false;

        this.trackingService.addLog(
          this.trackingService.getnameComp(),
          `Upload PDF OT - ID: ${response.otId}`,
          'Menu Proyectos Ordenes de Trabajo',
          this.trackingService.getEmail()
        );

        // Mostrar alerta de éxito personalizada
        alerts.basicAlert(
          'PDF Procesado Exitosamente',
          `El PDF ha sido cargado y se han obtenido algunos datos. Será redirigido al formulario de OT para que corrobore los datos.\n\nNúmero OT: ${response.otNumber}`,
          'success'
        );

        // Redirigir a la página de detalles después de un breve delay
        console.log('Navigating to details page with otId:', response.otId);
        setTimeout(() => {
          this.router.navigate(['/projects/ot/details', response.otId]);
        }, 2000);
      },
      error: (error) => {
        console.log('=== PDF Upload Error ===');
        console.error('Complete error object:', error);
        console.error('Error status:', error.status);
        console.error('Error statusText:', error.statusText);
        console.error('Error headers:', error.headers);
        console.error('Error body:', error.error);

        this.isUploading = false;

        let errorMessage = 'Error al procesar el archivo PDF.';
        if (error.error?.message) {
          errorMessage = error.error.message;
        } else if (error.message) {
          errorMessage = error.message;
        }

        alert(errorMessage);
      },
    });
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
    
    // Si hay idResource pero no Description, agregar la descripción del equipo
    /*if (cleanedData.idResource && !cleanedData.Description) {
      const foundEquipo = this.catalogEquipos?.find(item => item.id == cleanedData.idResource);
      if (foundEquipo) {
        cleanedData.Description = foundEquipo.description;
      } else {
        // Si no se encuentra el equipo, usar un valor por defecto
        cleanedData.Description = `Equipo ID: ${cleanedData.idResource}`;
      }
    }*/
    
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
      typeNote: 'PERSONAL',
      description: 'NOTAS',
      imageazure: 'NO FILE',
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
      id: 0,
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
        this.materialesGridApi.setGridOption('rowData', this.materiales);
        setTimeout(() => {
          this.materialesGridApi.startEditingCell({
            rowIndex: 0,
            colKey: 'idResource'
          });
        }, 100);
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
      id: 0,
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
        this.equiposGridApi.setGridOption('rowData', this.equipos);
        setTimeout(() => {
          this.equiposGridApi.startEditingCell({
            rowIndex: 0,
            colKey: 'description'
          });
        }, 100);
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
        this.materiales = data.data;
      },
      (error) => console.error('Error fetching data:', error)
    );
  }
   obtenerEquipos(selectedReporteId: any) {
    // alert('this.branchs'+ this.idBranch)
    console.log('Obteniendo equipos para reporte ID:', selectedReporteId);
    this.logbookService.getInfoByReporte(selectedReporteId, "EQUIPMENT").subscribe(
      (data: any) => {
        this.equipos = data.data;
      },
      (error) => console.error('Error fetching data:', error)
    );
  }
   obtenerPersonal(selectedReporteId: any) {
    this.logbookService.getInfoByReporte(selectedReporteId, "PERSONAL").subscribe(
      (data: any) => {
        this.personal = data.data;
        //console.log(this.personal)
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

  obtenerNotas(selectedReporteId: any) {
    this.logbookService.getInfoByReporte(selectedReporteId, "NOTE").subscribe(
      (data: any) => {
        this.notas = data.data;
      },
      (error) => console.error('Error fetching data:', error)
    );
  }

  obtenerConcep(selectedReporteId: any) {
    this.logbookService.getInfoByReporte(selectedReporteId, "CONCEPT").subscribe(
      (data: any) => {
        this.conceptos = data.data;
        
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
    return this.workprogramsService.getActivities(this.idProject).subscribe(
      (data: any) => {
        this.catalogConcepto = data;
        console.log('Catálogo de conceptos obtenido:', this.catalogConcepto);
      },
      (error) => console.error('Error fetching conceptos:', error)
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

    const newEquipo = {
      id: 0,
      idOt: parseInt(this.selectedOt.id),
      idReporte: this.selectedReporteId,
      idResource: null, // Se almacenará el ID del equipo
      position: '', 
      quantity: 1,
      start: this.selectedReporteHoraInicio + ':00',
      end: this.selectedReporteHoraTermino + ':00',
      date: this.selectedReporteFecha,
      typeNote: 'CONCEPT',
      description: 'NOTAS',
      orden: 1,
      __isNew: true
    };

    this.conceptos = [newEquipo, ...this.conceptos];
    this.notSavedConceptoChanges = true;
    
    setTimeout(() => {
      if (this.conceptosGridApi) {
        this.conceptosGridApi.setGridOption('rowData', this.conceptos);
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
        this.notasGridApi.setGridOption('rowData', this.notas);
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
    
    console.log('OrdenesComponent destruido - modal state limpiado');
  }
}
