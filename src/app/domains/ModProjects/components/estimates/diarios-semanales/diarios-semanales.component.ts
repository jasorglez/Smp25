import { Component, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { EstimatesService } from 'app/services/estimates.service';
import { GeneratorsService } from 'app/services/generators.service';
import { EmployeesService } from 'app/services/employees.service';
import { DailyReportService } from 'app/services/daily-report.service';
import { SignalsService } from 'app/services/signals.service';
import { TrackingService } from 'app/services/tracking.service';
import { CatalogsService } from 'app/services/catalogs.service';
import { alerts } from 'app/helpers/alerts';

@Component({
  selector: 'app-diarios-semanales',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  templateUrl: './diarios-semanales.component.html',
  styleUrl: './diarios-semanales.component.scss'
})
export class DiariosSemánalesComponent {

  private estimatesService = inject(EstimatesService);
  private generatorsService = inject(GeneratorsService);
  private employeesService = inject(EmployeesService);
  private dailyReportService = inject(DailyReportService);
  private signalsService = inject(SignalsService);
  private trackingService = inject(TrackingService);
  private catalogService = inject(CatalogsService);

  // Variables del componente
  tipoReporte: string = 'diario';
  fechaSeleccionada: string = '';
  semanaSeleccionada: string = '';
  mesSeleccionado: string = '';
  estimacionSeleccionada: string = '';
  areaFiltro: string = '';
  estadoFiltro: string = '';
  empleadoFiltro: string = '';
  activeTab: string = 'resumen';
  idcompany: number = 0;
  estimaciones: any[] = [];
  empleados: any[] = [];
  areasDisponibles: any [] = [];  
  
  resumenData: any[] = [];
  detalladoData: any[] = [];
  
  metricas = {
    totalGeneradores: 0,
    totalItems: 0,
    horasTrabajadasTotal: 0,
    eficienciaPromedio: 0
  };
  
  private resumenGridApi: GridApi;
  private detalladoGridApi: GridApi;
  private contract = this.signalsService.getContractSelectedBySidebar()();

  // Configuración del grid
  defaultColDef = {
    sortable: true,
    filter: true,
    resizable: true,
    flex: 1
  };

  resumenColumnDefs: ColDef[] = [
    {
      field: 'fecha',
      headerName: 'Fecha/Período',
      width: 120,
      pinned: 'left'
    },
    {
      field: 'area',
      headerName: 'Área',
      width: 120
    },
    {
      field: 'generadoresActivos',
      headerName: 'Generadores',
      width: 100,
      type: 'numericColumn'
    },
    {
      field: 'itemsCompletados',
      headerName: 'Items Completados',
      width: 130,
      type: 'numericColumn'
    },
    {
      field: 'horasTrabajadas',
      headerName: 'Horas',
      width: 80,
      type: 'numericColumn',
      valueFormatter: (params) => params.value ? params.value.toFixed(1) : '0.0'
    },
    {
      field: 'eficiencia',
      headerName: 'Eficiencia %',
      width: 100,
      type: 'numericColumn',
      valueFormatter: (params) => params.value ? `${params.value.toFixed(1)}%` : '0.0%',
      cellStyle: (params) => {
        if (params.value >= 90) return { backgroundColor: '#d4edda', color: '#155724' };
        if (params.value >= 70) return { backgroundColor: '#fff3cd', color: '#856404' };
        return { backgroundColor: '#f8d7da', color: '#721c24' };
      }
    },
    {
      field: 'observaciones',
      headerName: 'Observaciones',
      width: 200
    }
  ];

  detalladoColumnDefs: ColDef[] = [
    {
      field: 'generador',
      headerName: 'Generador/Item',
      width: 200,
      cellRenderer: 'agGroupCellRenderer'
    },
    {
      field: 'fecha',
      headerName: 'Fecha',
      width: 100
    },
    {
      field: 'empleado',
      headerName: 'Empleado',
      width: 150
    },
    {
      field: 'horaInicio',
      headerName: 'Hora Inicio',
      width: 100
    },
    {
      field: 'horaFin',
      headerName: 'Hora Fin',
      width: 100
    },
    {
      field: 'horasTrabajadas',
      headerName: 'Horas',
      width: 80,
      type: 'numericColumn',
      valueFormatter: (params) => params.value ? params.value.toFixed(1) : '0.0'
    },
    {
      field: 'progreso',
      headerName: 'Progreso %',
      width: 100,
      type: 'numericColumn',
      valueFormatter: (params) => params.value ? `${params.value.toFixed(1)}%` : '0.0%'
    },
    {
      field: 'estado',
      headerName: 'Estado',
      width: 100,
      cellRenderer: (params) => {
        const estado = params.value;
        let badgeClass = 'badge ';
        switch (estado) {
          case 'completado': badgeClass += 'bg-success'; break;
          case 'en_progreso': badgeClass += 'bg-warning'; break;
          case 'pendiente': badgeClass += 'bg-secondary'; break;
          default: badgeClass += 'bg-light text-dark';
        }
        return `<span class="${badgeClass}">${estado}</span>`;
      }
    },
    {
      field: 'comentarios',
      headerName: 'Comentarios',
      width: 200
    }
  ];

  constructor() {
    // Log de acceso al componente
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Acceso a Reportes Diarios-Semanales',
      'Modulo Proyectos - Estimaciones - Diarios-Semanales',
      this.trackingService.getEmail()
    );

    // Effect para cargar datos cuando cambie el contrato
    effect(() => {
      const contractId = this.signalsService.getContractSelectedBySidebar()();
      this.idcompany = this.signalsService.getRootSelectedBySidebar()();
      if (contractId) {
        this.contract = contractId;
        this.cargarDatosIniciales();
        this.obternerArea();
      }
    });

    // Inicializar fechas por defecto
    const hoy = new Date();
    this.fechaSeleccionada = hoy.toISOString().split('T')[0];
    
    // Semana actual
    const inicioSemana = new Date(hoy);
    inicioSemana.setDate(hoy.getDate() - hoy.getDay() + 1); // Lunes
    const year = inicioSemana.getFullYear();
    const weekNumber = this.getWeekNumber(inicioSemana);
    this.semanaSeleccionada = `${year}-W${weekNumber.toString().padStart(2, '0')}`;
    
    // Mes actual
    this.mesSeleccionado = `${hoy.getFullYear()}-${(hoy.getMonth() + 1).toString().padStart(2, '0')}`;
  }

  private getWeekNumber(date: Date): number {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  }

  cargarDatosIniciales() {
    if (!this.contract) return;

    // Cargar estimaciones
    this.estimatesService.getEstimates(this.contract).subscribe({
      next: (data: any[]) => {
        this.estimaciones = data || [];
        this.cargarAreasDisponibles();
      },
      error: (error) => {
        console.error('Error al cargar estimaciones:', error);
        this.estimaciones = [];
      }
    });

    // Cargar empleados
    this.cargarEmpleados();
  }

  private cargarEmpleados() {
    const idRoot = this.signalsService.getRootSelectedBySidebar()();
    if (!idRoot) return;

    const idBranch = -idRoot;
    this.employeesService.getEmployees(idBranch).subscribe({
      next: (response: any) => {
        this.empleados = Array.isArray(response) ? response : response?.data || [];
      },
      error: (error) => {
        console.error('Error al cargar empleados:', error);
        this.empleados = [];
      }
    });
  }
  obternerArea(){
    return this.catalogService.getPhases(this.idcompany).subscribe(
      (data: any )=> {
        this.areasDisponibles = data
        console.log(this.areasDisponibles)
      },
      (error) => console.error('Error fetching conceptos:', error))
  }

  private cargarAreasDisponibles() {
    // Obtener áreas únicas de las estimaciones cargadas
    const areas = new Set<string>();
    
    this.estimaciones.forEach(est => {
      // Cargar generadores para obtener las áreas
      this.generatorsService.getGenerators(est.id).subscribe({
        next: (generadores: any[]) => {
          generadores.forEach(gen => {
            if (gen.fase) {
              areas.add(gen.fase);
            }
          });
          //this.areasDisponibles = Array.from(areas).sort();
        },
        error: (error) => {
          console.error('Error al cargar generadores:', error);
        }
      });
    });
  }

  onTipoReporteChange() {
    this.limpiarFiltros();
  }

  onResumenGridReady(params: GridReadyEvent) {
    this.resumenGridApi = params.api;
  }

  onDetalladoGridReady(params: GridReadyEvent) {
    this.detalladoGridApi = params.api;
  }

  getDataPath = (data: any) => {
    return data.orgHierarchy;
  };

  generarReporte() {
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      `Generar Reporte ${this.tipoReporte.charAt(0).toUpperCase() + this.tipoReporte.slice(1)}`,
      'Modulo Proyectos - Estimaciones - Diarios-Semanales',
      this.trackingService.getEmail()
    );

    // Validar que se haya seleccionado una fecha/período
    if (this.tipoReporte === 'diario' && !this.fechaSeleccionada) {
      alerts.basicAlert('Error', 'Debe seleccionar una fecha', 'error');
      return;
    }
    if (this.tipoReporte === 'semanal' && !this.semanaSeleccionada) {
      alerts.basicAlert('Error', 'Debe seleccionar una semana', 'error');
      return;
    }
    if (this.tipoReporte === 'mensual' && !this.mesSeleccionado) {
      alerts.basicAlert('Error', 'Debe seleccionar un mes', 'error');
      return;
    }

    // Simular datos para demostración
    this.generarDatosMockup();
  }

  private generarDatosMockup() {
    // Datos de ejemplo para el resumen
    this.resumenData = [
      {
        fecha: this.obtenerFechaPeriodo(),
        area: 'SUSPENSION',
        generadoresActivos: 5,
        itemsCompletados: 23,
        horasTrabajadas: 42.5,
        eficiencia: 87.3,
        observaciones: 'Buen progreso general'
      },
      {
        fecha: this.obtenerFechaPeriodo(),
        area: 'HUNDIMIENTO',
        generadoresActivos: 3,
        itemsCompletados: 15,
        horasTrabajadas: 28.0,
        eficiencia: 92.1,
        observaciones: 'Excelente rendimiento'
      },
      {
        fecha: this.obtenerFechaPeriodo(),
        area: 'MANTENIMIENTO',
        generadoresActivos: 2,
        itemsCompletados: 8,
        horasTrabajadas: 16.5,
        eficiencia: 68.7,
        observaciones: 'Requiere atención'
      }
    ];

    // Datos de ejemplo para vista detallada
    this.detalladoData = [
      {
        generador: 'GEN-001',
        fecha: this.fechaSeleccionada || new Date().toISOString().split('T')[0],
        empleado: 'Juan Pérez',
        horaInicio: '08:00',
        horaFin: '17:00',
        horasTrabajadas: 8.0,
        progreso: 75.0,
        estado: 'en_progreso',
        comentarios: 'Avance según programación',
        orgHierarchy: ['GEN-001']
      },
      {
        generador: 'Item #1',
        fecha: this.fechaSeleccionada || new Date().toISOString().split('T')[0],
        empleado: 'Juan Pérez',
        horaInicio: '08:00',
        horaFin: '12:00',
        horasTrabajadas: 4.0,
        progreso: 100.0,
        estado: 'completado',
        comentarios: 'Item completado exitosamente',
        orgHierarchy: ['GEN-001', 'Item #1']
      }
    ];

    // Calcular métricas
    this.metricas = {
      totalGeneradores: this.resumenData.reduce((sum, item) => sum + item.generadoresActivos, 0),
      totalItems: this.resumenData.reduce((sum, item) => sum + item.itemsCompletados, 0),
      horasTrabajadasTotal: this.resumenData.reduce((sum, item) => sum + item.horasTrabajadas, 0),
      eficienciaPromedio: this.resumenData.reduce((sum, item) => sum + item.eficiencia, 0) / this.resumenData.length
    };

    alerts.basicAlert('Reporte Generado', 
      `Reporte ${this.tipoReporte} generado exitosamente`, 'success');
  }

  private obtenerFechaPeriodo(): string {
    switch (this.tipoReporte) {
      case 'diario':
        return this.fechaSeleccionada ? new Date(this.fechaSeleccionada).toLocaleDateString('es-ES') : '';
      case 'semanal':
        return this.semanaSeleccionada ? `Semana ${this.semanaSeleccionada}` : '';
      case 'mensual':
        return this.mesSeleccionado ? new Date(this.mesSeleccionado + '-01').toLocaleDateString('es-ES', { year: 'numeric', month: 'long' }) : '';
      default:
        return '';
    }
  }

  limpiarFiltros() {
    this.estimacionSeleccionada = '';
    this.areaFiltro = '';
    this.estadoFiltro = '';
    this.empleadoFiltro = '';
  }

  exportarReporte() {
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      `Exportar Reporte ${this.tipoReporte.charAt(0).toUpperCase() + this.tipoReporte.slice(1)}`,
      'Modulo Proyectos - Estimaciones - Diarios-Semanales',
      this.trackingService.getEmail()
    );

    const gridApi = this.activeTab === 'resumen' ? this.resumenGridApi : this.detalladoGridApi;
    
    if (gridApi) {
      gridApi.exportDataAsExcel({
        fileName: `Reporte_${this.tipoReporte}_${this.obtenerFechaPeriodo()}_${new Date().toISOString().split('T')[0]}.xlsx`
      });
    }
  }
}