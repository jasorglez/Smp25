import { Component, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { NgApexchartsModule } from 'ng-apexcharts';
import { EstimatesService } from 'app/services/estimates.service';
import { GeneratorsService } from 'app/services/generators.service';
import { EmployeesService } from 'app/services/employees.service';
import { DailyReportService } from 'app/services/daily-report.service';
import { SignalsService } from 'app/services/signals.service';
import { TrackingService } from 'app/services/tracking.service';
import { CatalogsService } from 'app/services/catalogs.service';
import { DatosXFechasService } from 'app/services/OtDatosXFechas.service';
import { OtService } from 'app/services/ot.service';
import { alerts } from 'app/helpers/alerts';

@Component({
  selector: 'app-diarios-semanales',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, NgApexchartsModule],
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
  private datosXFechasService = inject(DatosXFechasService);
  private otService = inject(OtService);

  // Variables del componente
  tipoReporte: string = 'diario';
  fechaSeleccionada: string = '';
  fechaDesde: string = '';
  fechaHasta: string = '';
  semanaSeleccionada: string = '';
  mesSeleccionado: string = '';
  estimacionSeleccionada: string = '';
  areaFiltro: string = '';
  estadoFiltro: string = '';
  empleadoFiltro: string = '';
  activeTab: string = 'resumen';
  chartStyle: 'bar' | 'pie' | 'donut' = 'bar';
  chartMetric: 'registered' | 'closed' | 'total' = 'total';
  crewChartOptions: any = null;
  crewEfficiencyData: Array<{ crew: string; registered: number; closed: number }> = [];
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
    this.fechaDesde = this.fechaSeleccionada;
    this.fechaHasta = this.fechaSeleccionada;
    
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

    const range = this.getSelectedDateRange();
    if (!range) return;

    // El endpoint compara la fecha final de forma inclusiva. Se solicita un día
    // adicional y se recorta localmente para incluir todas las horas del último día.
    const endForApi = new Date(`${range.to}T00:00:00`);
    endForApi.setDate(endForApi.getDate() + 1);

    this.datosXFechasService.getDailyReports(
      this.idcompany,
      new Date(`${range.from}T00:00:00`),
      endForApi
    ).subscribe({
      next: (response: any) => this.loadReportData(response, range.from, range.to),
      error: (error) => {
        console.error('Error al consultar reportes por rango:', error);
        this.resumenData = [];
        this.detalladoData = [];
        this.resetMetrics();
        alerts.basicAlert('Error', 'No fue posible consultar los reportes para el rango seleccionado.', 'error');
      }
    });
  }

  private getSelectedDateRange(): { from: string; to: string } | null {
    if (this.tipoReporte === 'diario') {
      return this.fechaSeleccionada ? { from: this.fechaSeleccionada, to: this.fechaSeleccionada } : null;
    }

    if (this.tipoReporte === 'personalizado') {
      if (!this.fechaDesde || !this.fechaHasta) {
        alerts.basicAlert('Error', 'Seleccione la fecha inicial y final.', 'error');
        return null;
      }
      if (this.fechaDesde > this.fechaHasta) {
        alerts.basicAlert('Error', 'La fecha inicial no puede ser mayor que la fecha final.', 'error');
        return null;
      }
      return { from: this.fechaDesde, to: this.fechaHasta };
    }

    if (this.tipoReporte === 'semanal') {
      if (!this.semanaSeleccionada) return null;
      const [year, week] = this.semanaSeleccionada.split('-W').map(Number);
      const januaryFourth = new Date(year, 0, 4);
      const monday = new Date(januaryFourth);
      monday.setDate(januaryFourth.getDate() - ((januaryFourth.getDay() + 6) % 7) + ((week - 1) * 7));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return { from: this.toDateInputValue(monday), to: this.toDateInputValue(sunday) };
    }

    if (this.tipoReporte === 'mensual') {
      if (!this.mesSeleccionado) return null;
      const [year, month] = this.mesSeleccionado.split('-').map(Number);
      return {
        from: `${this.mesSeleccionado}-01`,
        to: this.toDateInputValue(new Date(year, month, 0))
      };
    }

    return null;
  }

  private loadReportData(response: any, from: string, to: string): void {
    const reports = (Array.isArray(response) ? response : response?.data || [])
      .filter((item: any) => {
        const date = this.getDateKey(item?.date ?? item?.Date);
        const area = String(item?.area ?? item?.Area ?? item?.fase ?? item?.Fase ?? '');
        const status = String(item?.validado ?? item?.Validado ?? item?.close ?? item?.Close ?? '');
        return date >= from && date <= to
          && (!this.areaFiltro || area === this.areaFiltro)
          && (!this.estadoFiltro || status === this.estadoFiltro);
      });

    this.detalladoData = reports.map((item: any, index: number) => {
      const generador = item?.nombreConcepto ?? item?.NombreConcepto ?? item?.nombreMaterial
        ?? item?.NombreMaterial ?? item?.nombreEquipo ?? item?.NombreEquipo ?? item?.otNumber ?? item?.OtNumber ?? 'Sin concepto';
      const date = this.getDateKey(item?.date ?? item?.Date);
      return {
        generador,
        fecha: date,
        empleado: item?.nombreEmpleado ?? item?.NombreEmpleado ?? item?.nameCuadrilla ?? item?.NameCuadrilla ?? '',
        horaInicio: item?.start ?? item?.Start ?? '',
        horaFin: item?.end ?? item?.End ?? '',
        horasTrabajadas: Number(item?.quantity ?? item?.Quantity ?? 0),
        progreso: 0,
        estado: item?.validado ?? item?.Validado ?? item?.close ?? item?.Close ?? 'pendiente',
        comentarios: item?.description ?? item?.Description ?? '',
        area: item?.area ?? item?.Area ?? item?.fase ?? item?.Fase ?? 'Sin área',
        orgHierarchy: [String(item?.otNumber ?? item?.OtNumber ?? 'OT'), `${generador}-${index}`]
      };
    });

    const summary = new Map<string, any>();
    this.detalladoData.forEach((item: any) => {
      const area = item.area;
      const key = `${item.fecha}|${area}`;
      const row = summary.get(key) ?? { fecha: item.fecha, area, generadores: new Set<string>(), itemsCompletados: 0, horasTrabajadas: 0, observaciones: '' };
      row.generadores.add(item.generador);
      row.itemsCompletados++;
      row.horasTrabajadas += item.horasTrabajadas;
      summary.set(key, row);
    });

    this.resumenData = Array.from(summary.values()).map(row => ({
      fecha: row.fecha,
      area: row.area,
      generadoresActivos: row.generadores.size,
      itemsCompletados: row.itemsCompletados,
      horasTrabajadas: row.horasTrabajadas,
      eficiencia: 0,
      observaciones: row.observaciones
    }));

    this.metricas = {
      totalGeneradores: new Set(this.detalladoData.map(item => item.generador)).size,
      totalItems: this.detalladoData.length,
      horasTrabajadasTotal: this.detalladoData.reduce((sum, item) => sum + item.horasTrabajadas, 0),
      eficienciaPromedio: 0
    };

    this.loadCrewEfficiency(from, to);

    if (!reports.length) alerts.basicAlert('Sin resultados', 'No hay reportes para el rango seleccionado.', 'info');
  }

  private getDateKey(value: any): string {
    return value ? String(value).slice(0, 10) : '';
  }

  private toDateInputValue(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private resetMetrics(): void {
    this.metricas = { totalGeneradores: 0, totalItems: 0, horasTrabajadasTotal: 0, eficienciaPromedio: 0 };
  }

  onChartOptionsChanged(): void {
    this.buildCrewChart();
  }

  printCharts(): void {
    window.print();
  }

  private loadCrewEfficiency(from: string, to: string): void {
    this.otService.getCrewEfficiency(from, to).subscribe({
      next: (data) => {
        this.crewEfficiencyData = (data || []).map(item => ({
          crew: item.crew || 'SIN ASIGNAR',
          registered: Number(item.registered) || 0,
          closed: Number(item.closed) || 0
        }));
        this.buildCrewChart();
      },
      error: (error) => {
        console.error('Error al obtener eficiencia por cuadrilla:', error);
        this.crewEfficiencyData = [];
        this.crewChartOptions = null;
      }
    });
  }

  private buildCrewChart(): void {
    if (!this.crewEfficiencyData.length) {
      this.crewChartOptions = null;
      return;
    }

    const labels = this.crewEfficiencyData.map(item => item.crew);
    const period = this.getSelectedDateRange();
    const title = `Productividad por cuadrilla${period ? ` · ${period.from} al ${period.to}` : ''}`;

    if (this.chartStyle === 'bar') {
      this.crewChartOptions = {
        series: [
          { name: 'OT registradas', data: this.crewEfficiencyData.map(item => item.registered) },
          { name: 'OT cerradas', data: this.crewEfficiencyData.map(item => item.closed) }
        ],
        chart: { type: 'bar', height: 420, toolbar: { show: true } },
        title: { text: title, align: 'left' },
        xaxis: { categories: labels, title: { text: 'Cuadrilla' } },
        yaxis: { title: { text: 'OT' }, min: 0, forceNiceScale: true },
        plotOptions: { bar: { horizontal: false, columnWidth: '58%', borderRadius: 4 } },
        dataLabels: { enabled: true },
        colors: ['#2563eb', '#16a34a'],
        legend: { position: 'top' },
        tooltip: { shared: true, intersect: false }
      };
      return;
    }

    const metricLabels = { registered: 'OT registradas', closed: 'OT cerradas', total: 'OT atendidas (registradas + cerradas)' };
    const series = this.crewEfficiencyData.map(item => this.chartMetric === 'registered'
      ? item.registered
      : this.chartMetric === 'closed' ? item.closed : item.registered + item.closed);
    this.crewChartOptions = {
      series,
      chart: { type: this.chartStyle, height: 420, toolbar: { show: true } },
      labels,
      title: { text: `${metricLabels[this.chartMetric]} · ${title}`, align: 'left' },
      dataLabels: { enabled: true, formatter: (value: number) => `${value.toFixed(1)}%` },
      legend: { position: 'bottom' },
      tooltip: { y: { formatter: (value: number) => `${value} OT` } },
      responsive: [{ breakpoint: 768, options: { chart: { height: 350 }, legend: { position: 'bottom' } } }]
    };
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
