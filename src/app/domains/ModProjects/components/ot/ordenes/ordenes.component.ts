import { Component, effect, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
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
  imports: [CommonModule, TranslateModule, AgGridModule],
  templateUrl: './ordenes.component.html',
  styleUrl: './ordenes.component.scss',
})
export class OrdenesComponent {
  private otService = inject(OtService);
  private dailyReportService = inject(DailyReportService);
  private logbookService = inject(LogbookService);
  private signalsService = inject(SignalsService);
  private trackingService = inject(TrackingService);
  private router = inject(Router);
  private sanitizer = inject(DomSanitizer);
  private pdfGeneratorService = inject(PdfGeneratorService);
  private employeesService = inject(EmployeesService);
  gestionarDatos: any[] = [];

  // Variables de control
  public isUploading: boolean = false;
  private idProject: number = 0;
  
  // Variables para el nuevo layout
  public selectedOt: OrdenesData | null = null;
  public activeTab: string = 'reportes';
  public selectedReporteFecha: string = '';
  public selectedReporteTipo: string = '';
  public selectedReporteHoraInicio: string = '';
  public selectedReporteHoraTermino: string = '';
  public selectedReporteId: number | string | null = null;
  public selectedFotografia: Fotografia | null = null;
  
  // Variables para el patrón CRUD
  public notSavedChanges: boolean = false;
  public notSavedPersonalChanges: boolean = false;
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
  gridWidth = '200%'; 
  isGeneratingPdf: boolean = false;
  isGeneratingPdfEmbed: boolean = false;
  pdfUrl: SafeResourceUrl | null = null;
  private originalUrl: string | null = null;
  showPdfEmbed: boolean = false;

  public  materiales: any[] = [];
  public equipos: any[] = [];
  public personal: any[] = [];
  public fotografias: any[] = [];

  /*public materiales: Material[] = [
    {
      id: 'MAT001',
      nombre: 'Cable eléctrico 12 AWG',
      cantidad: 50,
      unidad: 'metros',
      fechaUso: '2024-07-20'
    },
    {
      id: 'MAT002',
      nombre: 'Tubería PVC 1/2"',
      cantidad: 10,
      unidad: 'metros',
      fechaUso: '2024-07-20'
    },
    {
      id: 'MAT003',
      nombre: 'Tornillos 1/4"',
      cantidad: 25,
      unidad: 'piezas',
      fechaUso: '2024-07-20'
    },
    {
      id: 'MAT004',
      nombre: 'Conectores eléctricos',
      cantidad: 15,
      unidad: 'piezas',
      fechaUso: '2024-07-21'
    },
    {
      id: 'MAT005',
      nombre: 'Cinta aislante',
      cantidad: 5,
      unidad: 'rollos',
      fechaUso: '2024-07-21'
    }
  ];

  public equipos: Equipo[] = [
    {
      id: 'EQ001',
      nombre: 'Taladro percutor',
      tipoEquipo: 'Herramienta eléctrica',
      horasUso: 4.5,
      fechaUso: '2024-07-20'
    },
    {
      id: 'EQ002',
      nombre: 'Multímetro digital',
      tipoEquipo: 'Instrumento de medición',
      horasUso: 2.0,
      fechaUso: '2024-07-20'
    },
    {
      id: 'EQ003',
      nombre: 'Escalera 3 metros',
      tipoEquipo: 'Equipo de acceso',
      horasUso: 6.0,
      fechaUso: '2024-07-20'
    },
    {
      id: 'EQ004',
      nombre: 'Soldadora portátil',
      tipoEquipo: 'Herramienta eléctrica',
      horasUso: 3.5,
      fechaUso: '2024-07-21'
    }
  ];

  public personal: Personal[] = [];

  public fotografias: Fotografia[] = [
    {
      id: 'FOT001',
      nombre: 'inicio_trabajo_001.jpg',
      descripcion: 'Estado inicial del sitio de trabajo',
      fecha: '2024-07-20',
      url: 'https://images.unsplash.com/photo-1581094288338-2314dddb7ece?w=400&h=300&fit=crop'
    },
    {
      id: 'FOT002',
      nombre: 'progreso_001.jpg',
      descripcion: 'Avance a medio día - instalación en progreso',
      fecha: '2024-07-20',
      url: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400&h=300&fit=crop'
    },
    {
      id: 'FOT003',
      nombre: 'final_dia_001.jpg',
      descripcion: 'Estado final del trabajo al terminar la jornada',
      fecha: '2024-07-20',
      url: 'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=400&h=300&fit=crop'
    },
    {
      id: 'FOT004',
      nombre: 'inicio_dia2_001.jpg',
      descripcion: 'Inicio del segundo día de trabajo',
      fecha: '2024-07-21',
      url: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=400&h=300&fit=crop'
    }
  ];*/

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
    //console.log('=== PERSONAL FILTRADO ===');
    //console.log('selectedReporteFecha:', this.selectedReporteFecha);
    //console.log('personal array:', this.personal);
    
    if (!this.selectedReporteFecha) {
      //console.log('Sin fecha seleccionada, retornando todo el personal:', this.personal);
      return this.personal;
    }
    
    const filtered = this.personal.filter(p => p.date === this.selectedReporteFecha);
    //console.log('Personal filtrado por fecha:', filtered);
    return filtered;
  }

  get fotografiasFiltradas(): Fotografia[] {
    if (!this.selectedReporteFecha) return this.fotografias;
    return this.fotografias.filter(f => f.fecha === this.selectedReporteFecha);
  }

  // Configuraciones de columnas para AG-Grid
  public materialesColumnDefs: ColDef[] = [
    { field: 'id', headerName: 'ID', width: 80 },
    { field: 'nombre', headerName: 'Material', flex: 2 },
    { field: 'cantidad', headerName: 'Cantidad', width: 100 },
    { field: 'unidad', headerName: 'Unidad', width: 100 },
    //{ field: 'fechaUso', headerName: 'Fecha', width: 120 }
  ];

  public equiposColumnDefs: ColDef[] = [
    { field: 'id', headerName: 'ID', width: 80 },
    { field: 'nombre', headerName: 'Equipo', flex: 2 },
    { field: 'tipoEquipo', headerName: 'Tipo', flex: 1 },
    { field: 'horasUso', headerName: 'Horas', width: 100 },
    //{ field: 'fechaUso', headerName: 'Fecha', width: 120 }
  ];

  public personalColumnDefs: ColDef[] = [
    { field: 'id', headerName: 'ID', width: 80 },
    { 
      field: 'idResource', 
      headerName: 'Nombre', 
      flex: 2,
      editable: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: (params: any) => {
        return {
          values: this.employees.map(emp => emp.name)
        };
      },
      valueFormatter: (params: any) => {
        // Mostrar el nombre del empleado basado en el ID almacenado
        if (params.value && params.value !== '0') {
          const employee = this.employees.find(emp => emp.id.toString() === params.value.toString());
          return employee ? employee.name : '';
        }
        return '';
      },
      valueSetter: (params: any) => {
        // Almacenar el ID del empleado basado en el nombre seleccionado
        if (params.newValue) {
          const employee = this.employees.find(emp => emp.name === params.newValue);
          if (employee) {
            // Convertir a string para consistencia con la interface
            params.data[params.colDef.field] = employee.id.toString();
            console.log('ID del empleado seleccionado:', employee.id.toString());
            return true;
          }
        }
        params.data[params.colDef.field] = params.newValue;
        return true;
      }
    },
    { field: 'position', headerName: 'Cargo', flex: 1, editable: true },
    { field: 'quantity', headerName: 'Cantidad', width: 100, editable: true },
    /*{ field: 'start', headerName: 'Inicio', width: 100, editable: true },
    { field: 'end', headerName: 'Fin', width: 100, editable: true },
    { field: 'date', headerName: 'Fecha', width: 120 }*/
  ];

  public fotografiasColumnDefs: ColDef[] = [
    { field: 'id', headerName: 'ID', width: 80 },
    { field: 'nombre', headerName: 'Archivo', flex: 2 },
    { field: 'descripcion', headerName: 'Descripción', flex: 2 },
    //{ field: 'fecha', headerName: 'Fecha', width: 120 }
  ];

  // Configuración de columnas para reportes diarios con edición inline
  public reportesColumnDefs: ColDef[] = [
    { 
      field: 'date', 
      headerName: 'Fecha', 
      width: 80, 
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
      width: 50, 
      editable: true,
      cellEditor: 'timeEditor',
      valueFormatter: (params) => {
        return params.value ? params.value.substring(0, 5) : '';
      }
    },
    { 
      field: 'endTime', 
      headerName: 'Hora Término', 
      width: 50, 
      editable: true,
      cellEditor: 'timeEditor',
      valueFormatter: (params) => {
        return params.value ? params.value.substring(0, 5) : '';
      }
    },
    { 
      field: 'type', 
      headerName: 'Tipo', 
      width: 100, 
      editable: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: {
        values: ['SUSPENSION', 'HUNDIMIENT']
      }
    },
    { 
      field: 'supervisor', 
      headerName: 'Supervisor', 
      width: 100,
      editable: true
    },
    { 
      field: 'description', 
      headerName: 'Descripción', 
      editable: true,
      width: 100,
    }
  ];

  // Variables para el grid de reportes
  public reportesGridApi!: GridApi;
  
  // Variables para el grid de personal
  public personalGridApi!: GridApi;

  // Configuración del grid principal
  public gridApi!: GridApi;
  public gridOptions: any = {
    headerHeight: 35,
    rowHeight: 25,
    suppressDragLeaveHidesColumns: true,
    suppressHorizontalScroll: false,
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
    domLayout: 'autoHeight'
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

  // Definición de columnas
  public columnDefs: ColDef[] = [
    /*   {
      field: 'id',
      headerName: 'ID',
      sortable: true,
      filter: true,
      resizable: true,
      width: 77,
    }, */
    {
      field: 'otNumber',
      headerName: 'OT',
      sortable: true,
      filter: true,
      resizable: true,
      width: 30,
    },
    {
      field: 'description',
      headerName: 'Descripción del Servicio',
      sortable: true,
      filter: true,
      resizable: true,
      width: 80,
    },
 /*   {
      field: 'address',
      headerName: 'Dirección',
      sortable: true,
      filter: true,
      resizable: true,
      flex: 2,
    },*/

    {
      field: 'results',
      headerName: 'Resultados',
      sortable: true,
      filter: true,
      resizable: true,
      flex: 1,
    },

  ];

  // Datos del grid obtenidos del servicio
  public rowData: OrdenesData[] = [];

  constructor() {
    effect(() => {
      this.idProject =this.signalsService.getProjectSelectedBySidebar()();
      this.obtenerDatos();
      this.loadEmployees();
    });
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
    params.api.sizeColumnsToFit();
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
    this.obtenerMateriales(this.selectedReporteId);
    this.obtenerEquipos(this.selectedReporteId);
    this.obtenerPersonal(this.selectedReporteId);
    this.obtenerFotografias(this.selectedReporteId);

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

  selectFotografia(fotografia: Fotografia) {
    this.selectedFotografia = fotografia;
    //console.log('Fotografía seleccionada:', fotografia.nombre);
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
    params.api.sizeColumnsToFit();
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
  console.log('=== INICIO DEBUG SAVE CHANGES ===');
  
  const newRows = this.reportesDiarios.filter(row => row.__isNew);
  const modifiedRows = this.reportesDiarios.filter(row => row.__modified && !row.__isNew);
  
  console.log('Filas nuevas encontradas:', newRows.length);
  console.log('Filas modificadas encontradas:', modifiedRows.length);

  // Validación
  const invalidNewRows = newRows.filter(item => !item.date || !item.supervisor);
  
  if (invalidNewRows.length > 0) {
    alerts.basicAlert('Añadir entrada', 'Debe introducir la fecha y supervisor antes de guardar.', 'error');
    return;
  }

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


  revertReportes() {
    this.loadDailyReports();
    this.notSavedChanges = false;
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
            console.log('Personal mapeado:', this.personal);
            console.log('PersonalFiltrado después del mapeo:', this.personalFiltrado);
            
            // Forzar actualización del grid si ya está inicializado
            if (this.personalGridApi) {
              this.personalGridApi.refreshCells();
              this.personalGridApi.redrawRows();
              console.log('Grid actualizado manualmente con datos:', this.personalFiltrado);
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
      const inputData = {
        id: parseInt(this.selectedOt.id),
        date: this.selectedReporteFecha,
        description: this.selectedOt.description,
        personalData: this.personalFiltrado,
        materialesData: this.materialesFiltrados,
        equiposData: this.equiposFiltrados
      };

      console.log('Datos de entrada para PDF:', inputData);

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
        
        alerts.basicAlert('Éxito', 'PDF generado correctamente', 'success');
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
    
    return cleanedData;
  }

  // Método para limpiar datos de Personal antes de enviar al servidor
  private cleanPersonalDataForServer(data: any): any {
    const cleanedData = { ...data };
    
    // Eliminar propiedades temporales de control
    delete cleanedData.__isNew;
    delete cleanedData.__modified;
    
    // Eliminar date ya que el endpoint espera date
    delete cleanedData.date;
    
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

  // Grid ready para personal
  onPersonalGridReady(params: any) {
    this.personalGridApi = params.api;
    params.api.sizeColumnsToFit();
  }

  // Métodos CRUD para Personal
  addPersonal() {
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
      start: '08:00:00',
      end: '17:00:00',
      date: this.selectedReporteFecha,
      typeNote: 'PERSONAL',
      description: 'NOTAS',
      orden: 1,
      __isNew: true
    };

    console.log('Nuevo personal creado:', newPersonal);
    console.log('Personal antes de agregar:', this.personal);
    this.personal = [newPersonal, ...this.personal];
    console.log('Personal después de agregar:', this.personal);
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
    if (!this.selectedOt) {
      alerts.basicAlert('Error', 'Debe seleccionar una OT primero', 'error');
      return;
    }

    if (!this.selectedReporteFecha) {
      alerts.basicAlert('Error', 'Debe seleccionar una fecha de reporte primero', 'error');
      return;
    }

    const tempId = `temp_personal_${this.tempPersonalIdCounter++}`;
    const newMaterial = {
      id: 0,
      idOt: parseInt(this.selectedOt.id),
      idReporte: this.selectedReporteId,
      idResource: null, // Se almacenará el ID del empleado
      position: '', 
      quantity: 1,
      start: '08:00:00',
      end: '17:00:00',
      date: this.selectedReporteFecha,
      typeNote: 'MATERIAL',
      description: 'NOTAS',
      orden: 1,
      __isNew: true
    };

      this.materiales = [newMaterial, ...this.materiales];
    this.notSavedChangesMaster = true;

    setTimeout(() => {
      if (this.personalGridApi) {
        this.personalGridApi.startEditingCell({
          rowIndex: 0,
          colKey: 'nombre'
        });
      }
    }, 0);
  }

  addEquipos() {    
    if (!this.selectedOt) {
      alerts.basicAlert('Error', 'Debe seleccionar una OT primero', 'error');
      return;
    }

    if (!this.selectedReporteFecha) {
      alerts.basicAlert('Error', 'Debe seleccionar una fecha de reporte primero', 'error');
      return;
    }

    const tempId = `temp_personal_${this.tempPersonalIdCounter++}`;
    const newEquipo = {
      id: tempId,
      idOt: parseInt(this.selectedOt.id),
      idReporte: this.selectedReporteId,
      idResource: null, // Se almacenará el ID del empleado
      position: '', 
      quantity: 1,
      start: '08:00:00',
      end: '17:00:00',
      date: this.selectedReporteFecha,
      typeNote: 'PERSONAL',
      description: 'NOTAS',
      orden: 1,
      __isNew: true
    };

    this.equipos = [newEquipo, ...this.equipos];
    this.notSavedPersonalChanges = true;
    
    setTimeout(() => {
      if (this.personalGridApi) {
        this.personalGridApi.startEditingCell({
          rowIndex: 0,
          colKey: 'nombre'
        });
      }
    }, 0);
  }

  async savePersonalChanges() {
    console.log('=== GUARDANDO CAMBIOS DE PERSONAL ===');
    console.log('Array completo de personal:', this.personal);
    
    const newRows = this.personal.filter(row => row.__isNew);
    const modifiedRows = this.personal.filter(row => row.__modified && !row.__isNew);
    
    console.log('Personal nuevo:', newRows.length, newRows);
    console.log('Personal modificado:', modifiedRows.length, modifiedRows);

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
      this.notSavedPersonalChanges = false;
      
      // Limpiar flags de control
      this.personal.forEach(item => {
        delete item.__isNew;
        delete item.__modified;
      });

      // Recargar datos para reflejar cambios del servidor
      console.log('Recargando datos de personal...');
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
    console.log('=== REVIRTIENDO CAMBIOS DE PERSONAL ===');
    console.log('Personal antes de revertir:', this.personal);
    
    // Remover elementos nuevos y revertir modificados
    this.personal = this.personal.filter(item => !item.__isNew);
    this.personal.forEach(item => {
      delete item.__modified;
    });
    
    console.log('Personal después de revertir:', this.personal);
    this.notSavedPersonalChanges = false;
    alerts.basicAlert('Info', 'Cambios revertidos', 'info');
  }

  async deletePersonal() {
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
        console.log('=== CONFIRMACIÓN DE ELIMINACIÓN ===');
        
        if (selectedData.__isNew) {
          console.log('Eliminando registro nuevo (solo local)');
          this.personal = this.personal.filter(p => p.id !== id);
          this.notSavedPersonalChanges = this.personal.some(p => p.__isNew);
          console.log('Personal después de eliminación local:', this.personal);
          alerts.basicAlert('Éxito', 'Personal eliminado correctamente', 'success');
        } else {
          console.log('Eliminando registro existente usando endpoint DELETE');
          console.log('Enviando DELETE para ID:', id);
          
          this.logbookService.deleteDataForOt(Number(id)).subscribe({
            next: (response) => {
              console.log('Respuesta del DELETE:', response);
              this.personal = this.personal.filter(p => p.id !== id);
              console.log('Personal después de eliminación del servidor:', this.personal);
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

    console.log('Generando PDF automáticamente:', this.inputData);
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
    this.logbookService.getInfoByOt(selectedReporteId, "TRABAJO ANTECEDENTES").subscribe(
      (data: any) => {
        this.materiales = data.data;
        console.log('Datos de materiales obtenidos:', this.materiales);
      },
      (error) => console.error('Error fetching data:', error)
    );
  }
   obtenerEquipos(selectedReporteId: any) {
    // alert('this.branchs'+ this.idBranch)
    this.logbookService.getInfoByOt(selectedReporteId, "TIPORESULTADOSERVICIO").subscribe(
      (data: any) => {
        this.equipos = data.data;
        console.log('Datos de equipos obtenidos:', this.equipos);
      },
      (error) => console.error('Error fetching data:', error)
    );
  }
   obtenerPersonal(selectedReporteId: any) {
    // alert('this.branchs'+ this.idBranch)
    this.logbookService.getInfoByOt(selectedReporteId, "PERSONAL").subscribe(
      (data: any) => {
        this.personal = data.data;
        console.log('Datos de personal obtenidos:', this.personal);
      },
      (error) => console.error('Error fetching data:', error)
    );
  }
   obtenerFotografias(selectedReporteId: any) {
    // alert('this.branchs'+ this.idBranch)
    this.logbookService.getInfoByOt(selectedReporteId, "FOTO").subscribe(
      (data: any) => {
        this.fotografias = data.data;
        console.log('Datos de fotografías obtenidos:', this.fotografias);
      },
      (error) => console.error('Error fetching data:', error)
    );
  }
  


}
