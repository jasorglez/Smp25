
import { CommonModule } from '@angular/common';
import { Component, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IncomesAndExpensesService } from 'app/services/incomes-and-expenses.service';
import { ProjectsService } from 'app/services/projects.service';
import { SignalsService } from 'app/services/signals.service';
import { Iproject } from 'app/interface/iproject';
import { NgApexchartsModule } from 'ng-apexcharts';
import {
  ApexAxisChartSeries,
  ApexChart,
  ApexDataLabels,
  ApexPlotOptions,
  ApexXAxis,
  ApexTitleSubtitle,
  ApexLegend,
  ApexYAxis,
  ApexNonAxisChartSeries,
  ApexTooltip,
  ApexStroke,
} from "ng-apexcharts";

// Definimos tipos para cada tipo de gráfica
export type BarChartOptions = { series: ApexAxisChartSeries; chart: ApexChart;
                                xaxis: ApexXAxis; yaxis: ApexYAxis; title: ApexTitleSubtitle;
                                plotOptions: ApexPlotOptions; tooltip: ApexTooltip; dataLabels: ApexDataLabels; };
export type LineChartOptions = { series: ApexAxisChartSeries; chart: ApexChart; xaxis: ApexXAxis; yaxis: ApexYAxis; title: ApexTitleSubtitle; stroke: ApexStroke; tooltip: ApexTooltip; };
export type PieChartOptions = { series: ApexNonAxisChartSeries; chart: ApexChart; labels: any; title: ApexTitleSubtitle; legend: ApexLegend; };

@Component({
  selector: 'app-expensedashboard',
  standalone: true,
  imports: [CommonModule, NgApexchartsModule, FormsModule],
  templateUrl: './expensedashboard.component.html',
  styleUrl: './expensedashboard.component.scss'
})
export class ExpensedashboardComponent {

  private incomesAndExpensesService = inject(IncomesAndExpensesService);
  private projectsService = inject(ProjectsService);
  private signalsService = inject(SignalsService);

  // --- ESTADO DEL COMPONENTE ---
  public rootId: number;
  public startDate: string = '';
  public endDate: string = '';
  public selectedProjectId: number | null = null;
  private allExpensesData: any[] = [];
  public projectsList: Iproject[] = [];

  // Propiedades para cada elemento del dashboard
  public totalExpensesKpi: number = 0;
  public providerList: { name: string; total: number }[] = [];

  // Opciones para cada una de las gráficas
  public groupedAnnualChartOptions: Partial<BarChartOptions>;
  public currentYearChartOptions: Partial<BarChartOptions>;
  public expensesTrendChartOptions: Partial<BarChartOptions>;
  public pieChartOptions: Partial<PieChartOptions>;

  constructor() {
    // Inicializar fechas por defecto (últimos 12 meses)
    const today = new Date();
    const twelveMonthsAgo = new Date(new Date().setMonth(today.getMonth() - 12));
    this.endDate = today.toISOString().split('T')[0];
    this.startDate = twelveMonthsAgo.toISOString().split('T')[0];

    effect(() => {
      this.rootId = this.signalsService.getRootSelectedBySidebar()();
      if (this.rootId) {
        this.getExpenses(this.rootId);
        this.getProjects(this.rootId);
      }
    }, { allowSignalWrites: true });
  }

  // --- CONTROL DE LA INTERFAZ ---

  public onFilterChange(): void {
    this.processAllData(); // Procesar datos con los nuevos filtros
  }

  // --- LÓGICA DE DATOS ---

  private getExpenses(rootId: number): void {
    this.incomesAndExpensesService.getExpensesxroot(rootId).subscribe(data => {
      this.allExpensesData = data || [];
      this.processAllData();
    });
  }

  private getProjects(rootId: number): void {
    this.projectsService.getProjectListByCompany(rootId).subscribe(
      (resp: any) => {
        this.projectsList = resp;
      },
      (error) => {
        console.error('Error fetching projects', error);
        this.projectsList = [];
      }
    );
  }

  /**
   * Este método central orquesta toda la actualización del dashboard.
   * Se llama una vez que llegan los datos y cada vez que se cambia un filtro.
   */
  private processAllData(): void {
    if (!this.allExpensesData || this.allExpensesData.length === 0) return;

    // 1. Filtrar los datos según el rango de fechas y proyecto seleccionado
    let filteredData = this.filterDataByDateRange(this.allExpensesData, this.startDate, this.endDate);

    if (this.selectedProjectId !== null) {
      filteredData = this.filterDataByProject(filteredData, this.selectedProjectId);
    }

    // 2. Calcular y actualizar cada parte del dashboard con los datos filtrados
    this.totalExpensesKpi = filteredData.reduce((sum, expense) => sum + expense.total, 0);
    this.providerList = this.calculateTopProviders(filteredData);

    // 3. Preparar cada una de las gráficas
    this.prepareGroupedAnnualChart(this.allExpensesData);
    this.prepareCurrentYearChart(this.allExpensesData);
    this.prepareExpensesByDayStackedChart(this.allExpensesData);
    this.prepareExpensesByProviderPieChart(filteredData);
  }

  private filterDataByDateRange(data: any[], startDate: string, endDate: string): any[] {
    if (!startDate || !endDate) return data;

    const start = new Date(startDate);
    const end = new Date(endDate);

    return data.filter(expense => {
      const expenseDate = new Date(expense.date);
      return expenseDate >= start && expenseDate <= end;
    });
  }

  private filterDataByProject(data: any[], projectId: number): any[] {
    // Nota: Esto asume que el backend devuelve un campo id_project o similar
    // Si no existe, este filtro no aplicará
    return data.filter(expense => expense.id_project === projectId);
  }

  // --- MÉTODOS DE PREPARACIÓN DE GRÁFICAS --- Multianual
  private prepareGroupedAnnualChart(data: any[]): void {
    const expensesByYearMonth = data.reduce((acc, expense) => {
      const date = new Date(expense.date);
      const year = date.getFullYear();
      const month = date.getMonth();
      if (!acc[year]) acc[year] = Array(12).fill(0);
      acc[year][month] += expense.total;
      return acc;
    }, {});

    const series = Object.keys(expensesByYearMonth).map(year => ({
      name: year,
      data: expensesByYearMonth[year]
    }));

    this.groupedAnnualChartOptions = {
      series: series,
      chart: { type: 'bar', height: 250, width: 650, toolbar: { show: false } },
      plotOptions: {
        bar: {
          horizontal: false,
          columnWidth: '85%',
          dataLabels: {
            position: 'top',
          },
        },
      },
      dataLabels: {
        enabled: true,
        formatter: (val) => (val as number / 1000).toFixed(1) + 'K',
        offsetY: -20,
        style: {
          fontSize: '10px',
          colors: ["#304758"]
        }
      },
      xaxis: { categories: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'] },
      yaxis: {
        labels: {
          formatter: (val) => '$' + (val / 1000).toFixed(0) + 'K'
        }
      },
      tooltip: {
        y: {
          formatter: (val) => '$' + (val / 1000).toFixed(2) + 'K'
        }
      },
      title: { text: 'COMPARATIVA ANUAL DE EGRESOS', align: 'left', style: { color: '#ffc107', fontSize: '14px' } }
    };
  }

  // --- MÉTODOS DE PREPARACIÓN DE GRÁFICAS --- Actual del año en Curso
  private prepareCurrentYearChart(data: any[]): void {
    const currentYear = new Date().getFullYear();
    const currentYearData = data.filter(expense => new Date(expense.date).getFullYear() === currentYear);

    const expensesByMonth = currentYearData.reduce((acc, expense) => {
      const month = new Date(expense.date).getMonth();
      acc[month] += expense.total;
      return acc;
    }, Array(12).fill(0));

    this.currentYearChartOptions = {
      series: [{ name: `Egresos ${currentYear}`, data: expensesByMonth }],
      chart: { type: 'bar', height: 250, width: 750, toolbar: { show: false } },
      plotOptions: {
        bar: {
          horizontal: false,
          columnWidth: '85%',
          dataLabels: {
            position: 'top',
          },
        }
      },
      dataLabels: {
        enabled: true,
        formatter: function (val: number) {
          if (val === 0) {
            return '';
          }
          return Math.round(val / 1000) + 'K';
        },
        offsetY: -20,
        style: {
          fontSize: '12px',
          fontWeight: 'bold',
          colors: ["#333"]
        }
      },
      xaxis: { categories: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'] },
      yaxis: {
        labels: {
          formatter: (val) => '$' + (val / 1000).toFixed(0) + 'K'
        }
      },
      tooltip: {
        y: {
          formatter: (val) => '$' + (val / 1000).toFixed(2) + 'K'
        }
      },
      title: { text: `AÑO ACTUAL: ${currentYear}`, align: 'left', style: { color: '#28a745', fontSize: '14px' } },
    };
  }

  private calculateTopProviders(data: any[]): { name: string, total: number }[] {
    const expensesByProvider = data.reduce((acc, expense) => {
      const provider = expense.company || 'SIN PROVEEDOR';
      if (!acc[provider]) acc[provider] = 0;
      acc[provider] += expense.total;
      return acc;
    }, {});

    return Object.entries(expensesByProvider)
      .map(([name, total]) => ({ name, total: total as number }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5); // Tomamos los 5 proveedores principales
  }

  private prepareExpensesByDayStackedChart(data: any[]): void {
    if (!data || data.length === 0) {
      this.expensesTrendChartOptions = null;
      return;
    }

    const start = this.startDate ? new Date(this.startDate) : null;
    const end   = this.endDate   ? new Date(this.endDate)   : null;
    if (end) end.setHours(23, 59, 59, 999);

    // dateexpend = fecha real del concepto (view expensexroot, ya disponible en producción)
    const filtered = data.filter(c => {
      if (!c.dateexpend) return false;
      const d = new Date(c.dateexpend);
      if (start && d < start) return false;
      if (end   && d > end)   return false;
      return true;
    });

    if (filtered.length === 0) {
      this.expensesTrendChartOptions = null;
      return;
    }

    // day → entity(company/empleado) → total acumulado
    const dayMap = new Map<string, Map<string, number>>();
    const entityTotals = new Map<string, number>();

    filtered.forEach(c => {
      const day = String(c.dateexpend).substring(0, 10);
      const type = (c.typeexpense ?? '').toString().trim();
      const entity = type === 'EMPLEADOS'
        ? ((c.nameempleado ?? '').toString().trim() || 'SIN EMPLEADO')
        : ((c.company ?? '').toString().trim() || 'SIN PROVEEDOR');
      const amount = Number(c.totalconcepto ?? 0);

      // Acumular por día → entidad (Opción A: mismo proveedor mismo día = suma)
      if (!dayMap.has(day)) dayMap.set(day, new Map());
      const dm = dayMap.get(day)!;
      dm.set(entity, (dm.get(entity) || 0) + amount);

      // Total global por entidad (para ordenar colores: mayor gasto = primer color)
      entityTotals.set(entity, (entityTotals.get(entity) || 0) + amount);
    });

    const sortedDays = Array.from(dayMap.keys()).sort();

    // Ordenar entidades de mayor a menor gasto total → color más llamativo al top spender
    const sortedEntities = Array.from(entityTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);

    const series = sortedEntities.map(entity => ({
      name: entity,
      data: sortedDays.map(day => +(dayMap.get(day)?.get(entity) || 0).toFixed(2))
    }));

    const xLabels = sortedDays.map(d => {
      const parts = d.split('-');
      return `${parts[2]}/${parts[1]}`;
    });

    this.expensesTrendChartOptions = {
      series,
      chart: { type: 'bar', height: 250, stacked: true, toolbar: { show: false } } as any,
      plotOptions: { bar: { horizontal: false, columnWidth: '70%' } },
      dataLabels: { enabled: false },
      xaxis: { categories: xLabels, labels: { rotate: -45, style: { fontSize: '10px' } } },
      yaxis: { labels: { formatter: (val: number) => '$' + (val / 1000).toFixed(0) + 'K' } },
      title: { text: 'EGRESOS POR DÍA Y PROVEEDOR', align: 'left', style: { color: '#ffc107', fontSize: '14px' } },
      tooltip: {
        shared: true,
        intersect: false,
        y: {
          formatter: (val: number, opts: any) => {
            if (!val || val === 0) return null as any;
            const entity = opts?.w?.config?.series?.[opts.seriesIndex]?.name ?? '';
            return `${entity}: $${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
          }
        }
      }
    };
  }

  private prepareExpensesByProviderPieChart(data: any[]): void {
    const expensesByProvider = data.reduce((acc, expense) => {
      const provider = expense.company || 'SIN PROVEEDOR';
      if (!acc[provider]) acc[provider] = 0;
      acc[provider] += expense.total;
      return acc;
    }, {});

    this.pieChartOptions = {
      series: Object.values(expensesByProvider) as number[],
      chart: { type: 'donut', height: 250 },
      labels: Object.keys(expensesByProvider),
      title: { text: 'DISTRIBUCIÓN POR PROVEEDOR', align: 'left' },
      legend: { position: 'bottom' }
    };
  }

}
