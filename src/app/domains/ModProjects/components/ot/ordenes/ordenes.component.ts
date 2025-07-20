import { Component, effect, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { Router } from '@angular/router';
import { OtService } from 'app/services/ot.service';
import { DailyReportService } from 'app/services/daily-report.service';
import { SignalsService } from 'app/services/signals.service';
import { TrackingService } from 'app/services/tracking.service';
import { alerts } from 'app/helpers/alerts';
import { environment } from '@env/environment';
import { TimeEditorComponent } from 'app/domains/Indicadores/components/ind01/timeinactives/time-editor.component';

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
  nombre: string;
  cargo: string;
  cantidad: number;
  horaInicio: string;
  horaFin: string;
  fechaTrabajo: string;
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
  private signalsService = inject(SignalsService);
  private trackingService = inject(TrackingService);
  private router = inject(Router);

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
  public selectedFotografia: Fotografia | null = null;
  
  // Variables para el patrón CRUD
  public notSavedChanges: boolean = false;
  private tempIdCounter: number = 1;
  private currentEditingRow: number = -1;
  private currentEditingCol: string = '';
  
  // Reportes diarios obtenidos de la API
  public reportesDiarios: ReporteDiario[] = [];

  // Componentes personalizados para AG-Grid
  components = {
    timeEditor: TimeEditorComponent
  };

  public materiales: Material[] = [
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

  public personal: Personal[] = [
    {
      id: 'PER001',
      nombre: 'Carlos Rodríguez',
      cargo: 'Técnico Electricista',
      cantidad: 1,
      horaInicio: '08:00',
      horaFin: '17:00',
      fechaTrabajo: '2024-07-20'
    },
    {
      id: 'PER002',
      nombre: 'María González',
      cargo: 'Ayudante General',
      cantidad: 1,
      horaInicio: '08:00',
      horaFin: '17:00',
      fechaTrabajo: '2024-07-20'
    },
    {
      id: 'PER003',
      nombre: 'Juan Pérez',
      cargo: 'Supervisor',
      cantidad: 1,
      horaInicio: '07:30',
      horaFin: '17:30',
      fechaTrabajo: '2024-07-20'
    },
    {
      id: 'PER004',
      nombre: 'Ana López',
      cargo: 'Técnico Soldador',
      cantidad: 1,
      horaInicio: '08:00',
      horaFin: '16:00',
      fechaTrabajo: '2024-07-21'
    }
  ];

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
  ];

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
    if (!this.selectedReporteFecha) return this.personal;
    return this.personal.filter(p => p.fechaTrabajo === this.selectedReporteFecha);
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
    { field: 'fechaUso', headerName: 'Fecha', width: 120 }
  ];

  public equiposColumnDefs: ColDef[] = [
    { field: 'id', headerName: 'ID', width: 80 },
    { field: 'nombre', headerName: 'Equipo', flex: 2 },
    { field: 'tipoEquipo', headerName: 'Tipo', flex: 1 },
    { field: 'horasUso', headerName: 'Horas', width: 100 },
    { field: 'fechaUso', headerName: 'Fecha', width: 120 }
  ];

  public personalColumnDefs: ColDef[] = [
    { field: 'id', headerName: 'ID', width: 80 },
    { field: 'nombre', headerName: 'Nombre', flex: 2 },
    { field: 'cargo', headerName: 'Cargo', flex: 1 },
    { field: 'cantidad', headerName: 'Cantidad', width: 100 },
    { field: 'horaInicio', headerName: 'Inicio', width: 100 },
    { field: 'horaFin', headerName: 'Fin', width: 100 },
    { field: 'fechaTrabajo', headerName: 'Fecha', width: 120 }
  ];

  public fotografiasColumnDefs: ColDef[] = [
    { field: 'id', headerName: 'ID', width: 80 },
    { field: 'nombre', headerName: 'Archivo', flex: 2 },
    { field: 'descripcion', headerName: 'Descripción', flex: 2 },
    { field: 'fecha', headerName: 'Fecha', width: 120 }
  ];

  // Configuración de columnas para reportes diarios con edición inline
  public reportesColumnDefs: ColDef[] = [
    { 
      field: 'fecha', 
      headerName: 'Fecha', 
      width: 120, 
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
          // Si viene del date picker (formato YYYY-MM-DD)
          if (params.newValue.includes('-')) {
            dateValue = params.newValue.split('T')[0];
          } else {
            // Si viene escrito manualmente (formato DD/MM/YYYY)
            const [day, month, year] = params.newValue.split('/');
            dateValue = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          }
          params.data[params.colDef.field] = dateValue;
        } else {
          params.data[params.colDef.field] = '';
        }
        return true;
      }
    },
    { 
      field: 'horaInicio', 
      headerName: 'Inicio', 
      width: 100, 
      editable: true,
      cellEditor: 'timeEditor',
      valueFormatter: (params) => {
        return params.value ? params.value.substring(0, 5) : '';
      }
    },
    { 
      field: 'horaTermino', 
      headerName: 'Hora Término', 
      width: 100, 
      editable: true,
      cellEditor: 'timeEditor',
      valueFormatter: (params) => {
        return params.value ? params.value.substring(0, 5) : '';
      }
    },
    { 
      field: 'tipoNota', 
      headerName: 'Tipo', 
      width: 120, 
      editable: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: {
        values: ['SUSPENSION', 'HUNDIMIENT']
      }
    },
    { 
      field: 'supervisor', 
      headerName: 'Supervisor', 
      flex: 1, 
      editable: true
    },
    { 
      field: 'descripcion', 
      headerName: 'Descripción', 
      flex: 2, 
      editable: true
    }
  ];

  // Variables para el grid de reportes
  public reportesGridApi!: GridApi;

  // Configuración del grid principal
  public gridApi!: GridApi;
  public gridOptions: any = {
    headerHeight: 35,
    rowHeight: 30,
    suppressDragLeaveHidesColumns: true,
    suppressHorizontalScroll: false,
    animateRows: true,
    pagination: false,
    domLayout: 'autoHeight',
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
      width: 80,
    },
    {
      field: 'description',
      headerName: 'Descripción del Servicio',
      sortable: true,
      filter: true,
      resizable: true,
      flex: 2,
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
      flex: 2,
    },

  ];

  // Datos del grid obtenidos del servicio
  public rowData: OrdenesData[] = [];

  constructor() {
    effect(() => {
      this.idProject =this.signalsService.getProjectSelectedBySidebar()();
      this.obtenerDatos();
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
      
      console.log('OT seleccionada:', this.selectedOt);
      
      // Cargar reportes diarios para esta OT
      this.loadDailyReports();
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
    console.log('Reporte seleccionado:', this.selectedReporteFecha, this.selectedReporteTipo);
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
    console.log('Fotografía seleccionada:', fotografia.nombre);
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
    console.log('Iniciando edición de fila:', event.data);
  }

  onRowEditingStopped(event: any) {
    console.log('Finalizando edición de fila:', event.data);
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
      supervisor: '',
      type: 'SUSPENSION',
      description: '',
      active: true,
      // Propiedades computadas para el grid
      fecha: '',
      horaInicio: '',
      horaTermino: '',
      tipoNota: 'SUSPENSION',
      descripcion: '',
      __isNew: true
    };

    this.reportesDiarios = [newReporte, ...this.reportesDiarios];
    this.notSavedChanges = true;
    
    setTimeout(() => {
      if (this.reportesGridApi) {
        this.reportesGridApi.startEditingCell({
          rowIndex: 0,
          colKey: 'fecha'
        });
      }
    }, 0);
  }

  async saveChanges() {
    // Solo validar los reportes nuevos
    const newRows = this.reportesDiarios.filter(row => row.__isNew);
    const isValid = newRows.every(
      (item) => item.fecha && item.supervisor
    );

    if (newRows.length > 0 && !isValid) {
      alerts.basicAlert(
        'Añadir entrada',
        'Debe introducir la fecha y supervisor antes de guardar.',
        'error'
      );
      return;
    }

    const modifiedRows = this.reportesDiarios.filter(row => row.__modified && !row.__isNew);

    try {
      const addRequests = newRows.map(row => {
        const cleanedData = this.cleanDataForServer(row);
        return this.dailyReportService.addDailyReport(cleanedData);
      });

      const updateRequests = modifiedRows.map(row => {
        const cleanedData = this.cleanDataForServer(row);
        return this.dailyReportService.updateDailyReport(Number(row.id), cleanedData);
      });

      await Promise.all([...addRequests, ...updateRequests]);

      alerts.basicAlert(
        'Datos actualizados',
        'Se han actualizado los datos correctamente.',
        'success'
      );

      this.notSavedChanges = false;
      this.loadDailyReports();
    } catch (error) {
      console.error('Error al guardar:', error);
      alerts.basicAlert(
        'Error',
        'Ocurrió un error al actualizar los datos. Por favor, intente nuevamente.',
        'error'
      );
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


  // Método para cargar reportes diarios desde el servidor
  loadDailyReports() {
    if (this.selectedOt) {
      const otId = parseInt(this.selectedOt.id);
      
      this.dailyReportService.getDailyReportsByOt(otId).subscribe({
        next: (response) => {
          if (response.success && response.data) {
            // Mapear los datos de la API al formato del grid
            this.reportesDiarios = response.data.map((item: any) => {
              return {
                ...item,
                // Propiedades computadas para compatibilidad con el grid
                fecha: item.date.split('T')[0], // "2025-07-20"
                horaInicio: item.startTime.substring(0, 5), // "08:00"
                horaTermino: item.endTime.substring(0, 5), // "12:00"
                tipoNota: item.type,
                descripcion: item.description || '', // Solo usar description
                report: item.report || 'Reporte' // Asegurar campo report
              };
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

  generatePdfPreview() {
    if (this.selectedOt) {
      console.log('Generando vista previa PDF para OT:', this.selectedOt.otNumber);
      // Aquí implementaremos la generación del PDF con PDFMake
      alert(`Generando vista previa del reporte para OT: ${this.selectedOt.otNumber}`);
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
    const cleanedData: any = {
      idOt: data.idOt,
      date: data.fecha ? data.fecha + 'T00:00:00' : data.date,
      startTime: data.horaInicio ? data.horaInicio + ':00' : (data.startTime || '00:00:00'),
      endTime: data.horaTermino ? data.horaTermino + ':00' : (data.endTime || '00:00:00'),
      supervisor: data.supervisor || '',
      type: data.tipoNota || data.type || 'SUSPENSION',
      description: data.descripcion || data.description || '',
      report: 'Reporte creado',
      active: true
    };

    // Solo incluir ID si no es temporal
    if (data.id && !data.id.toString().startsWith('temp_')) {
      cleanedData.id = data.id;
    }

    // Eliminar propiedades temporales de control
    delete cleanedData.__isNew;
    delete cleanedData.__modified;
    
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
}
