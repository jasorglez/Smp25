import { CommonModule } from '@angular/common';
import { Component, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IncomesAndExpensesService } from 'app/services/incomes-and-expenses.service';
import { SignalsService } from 'app/services/signals.service';
import { CuentasContablesService } from 'app/services/cuentas-contables.service';
import { ICuentaContable } from 'app/interface/icuentas-contables';
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
  ApexFill,
} from "ng-apexcharts";

// Tipos para las gráficas
export type BarChartOptions = {
  series: ApexAxisChartSeries;
  chart: ApexChart;
  xaxis: ApexXAxis;
  yaxis: ApexYAxis;
  title: ApexTitleSubtitle;
  plotOptions: ApexPlotOptions;
  tooltip: ApexTooltip;
  dataLabels: ApexDataLabels;
};

export type LineChartOptions = {
  series: ApexAxisChartSeries;
  chart: ApexChart;
  xaxis: ApexXAxis;
  yaxis: ApexYAxis;
  title: ApexTitleSubtitle;
  stroke: ApexStroke;
  tooltip: ApexTooltip;
  fill: ApexFill;
  legend: ApexLegend;
};

export type PieChartOptions = {
  series: ApexNonAxisChartSeries;
  chart: ApexChart;
  labels: any;
  title: ApexTitleSubtitle;
  legend: ApexLegend;
  colors: string[];
};

// Interfaz para clasificación de gastos (basada en cuentas contables)
export interface ClasificacionContable {
  codigo: string;
  nombre: string;
  gastoAnterior: number;
  gastoMesActual: number;
  gastoAcumulado: number;
  tipo: 'INGRESO' | 'EGRESO' | 'OTRO';
}

// Interfaz para flujo mensual
export interface FlujoMensual {
  mes: string;
  anio: number;
  egresoMensual: number;
  ingresoMensual: number;
  flujoMensual: number;
  flujoAcumulado: number;
}

@Component({
  selector: 'app-dashboard-hco',
  standalone: true,
  imports: [CommonModule, NgApexchartsModule, FormsModule],
  templateUrl: './dashboard-hco.component.html',
  styleUrl: './dashboard-hco.component.scss'
})
export class DashboardHcoComponent {
  private incomesAndExpensesService = inject(IncomesAndExpensesService);
  private cuentasContablesService = inject(CuentasContablesService);
  private signalsService = inject(SignalsService);

  // Estado del componente
  public rootId: number;
  public startDate: string = '';
  public endDate: string = '';
  public selectedYear: number | null = null;
  public availableYears: number[] = [];

  // Datos crudos - separados por tipo
  private egresosData: any[] = [];
  private ingresosData: any[] = [];
  private cuentasContablesNivel2: ICuentaContable[] = [];

  // KPIs
  public totalEgresos: number = 0;
  public totalIngresos: number = 0;
  public flujoNeto: number = 0;
  public margenPorcentaje: number = 0;

  // Datos para tablas - Solo clasificación de EGRESOS
  public clasificacionEgresos: ClasificacionContable[] = [];
  public flujoMensual: FlujoMensual[] = [];
  public totalesPorAnio: { anio: number; egreso: number; ingreso: number; flujo: number }[] = [];

  // Opciones de gráficas
  public pieChartOptions: Partial<PieChartOptions>;
  public lineChartOptions: Partial<LineChartOptions>;
  public barChartOptions: Partial<BarChartOptions>;

  constructor() {
    // Inicializar fechas por defecto (últimos 24 meses para tener histórico)
    const today = new Date();
    const twentyFourMonthsAgo = new Date(new Date().setMonth(today.getMonth() - 24));
    this.endDate = today.toISOString().split('T')[0];
    this.startDate = twentyFourMonthsAgo.toISOString().split('T')[0];

    // Generar años disponibles para el filtro
    const currentYear = new Date().getFullYear();
    for (let i = currentYear - 5; i <= currentYear; i++) {
      this.availableYears.push(i);
    }

    effect(() => {
      this.rootId = this.signalsService.getRootSelectedBySidebar()();
      if (this.rootId) {
        this.loadData(this.rootId);
      }
    }, { allowSignalWrites: true });
  }

  public onFilterChange(): void {
    this.processAllData();
  }

  private loadData(rootId: number): void {
    // Cargar catálogo de cuentas contables para clasificar tipo de gasto
    this.cuentasContablesService.getAll(rootId).subscribe(data => {
      this.cuentasContablesNivel2 = data || [];
      console.log('✅ Cuentas contables cargadas:', this.cuentasContablesNivel2.length);
      this.processAllData();
    });

    // Cargar ingresos y egresos desde la misma fuente que income/expenditure
    this.incomesAndExpensesService.getIncomesAndExpenses(rootId).subscribe(data => {
      const rows = Array.isArray(data) ? data : [];
      this.egresosData = rows.filter(item => String(item?.type ?? '').toUpperCase() === 'GASTO');
      this.ingresosData = rows.filter(item => String(item?.type ?? '').toUpperCase() === 'DEPOSITO');

      console.log('✅ Egresos cargados (GASTO):', this.egresosData.length);
      console.log('✅ Ingresos cargados (DEPOSITO):', this.ingresosData.length);
      this.processAllData();
    });
  }

  private processAllData(): void {
    // Filtrar por rango de fechas
    let filteredExpenseData = this.filterByDateRange(this.egresosData, false);
    let filteredIncomeData = this.filterByDateRange(this.ingresosData, true);

    // Filtrar por año si está seleccionado
    if (this.selectedYear) {
      filteredExpenseData = filteredExpenseData.filter(item => this.getItemDate(item, false)?.getFullYear() === this.selectedYear);
      filteredIncomeData = filteredIncomeData.filter(item => this.getItemDate(item, true)?.getFullYear() === this.selectedYear);
    }

    // Para KPIs usar datos por endpoint, sin depender del mapeo contable 4xxx/5xxx/6xxx.
    const egresosReales = filteredExpenseData;
    const ingresosReales = filteredIncomeData;

    console.log(`📊 Datos: ${egresosReales.length} egresos, ${ingresosReales.length} ingresos`);

    // Calcular KPIs
    this.totalEgresos = egresosReales.reduce((sum, e) => sum + this.getMonto(e), 0);
    this.totalIngresos = ingresosReales.reduce((sum, i) => sum + this.getMonto(i), 0);
    this.flujoNeto = this.totalIngresos - this.totalEgresos;
    this.margenPorcentaje = this.totalIngresos > 0 ? (this.flujoNeto / this.totalIngresos) * 100 : 0;

    // Preparar datos para tablas y gráficas
    this.prepareClasificacionEgresos(filteredExpenseData);
    this.prepareFlujoMensual(egresosReales, ingresosReales);
    this.preparePieChart();
    this.prepareLineChart();
    this.prepareBarChart();
  }

  private getIdExpend(item: any): number | null {
    const candidates = [
      item?.idExpend,
      item?.id_expend,
      item?.idCuentaContable,
      item?.id_cuenta_contable,
      item?.idExpense
    ];

    for (const candidate of candidates) {
      const numeric = Number(candidate);
      if (Number.isFinite(numeric) && numeric > 0) {
        return numeric;
      }
    }
    return null;
  }

  private parseTipoGastoTexto(value: any): { codigo: string; nombre: string } | null {
    const text = String(value ?? '').trim();
    if (!text) return null;

    const parts = text.split('-').map(part => part.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const codigo = parts[0];
      const nombre = parts.slice(1).join(' - ');
      return { codigo, nombre };
    }

    return { codigo: text, nombre: 'Tipo de gasto' };
  }

  private getTipoGasto(item: any): { codigo: string; nombre: string } {
    const idExpend = this.getIdExpend(item);
    if (idExpend) {
      const cuenta = this.cuentasContablesNivel2.find(c => c.id === idExpend);
      if (cuenta) {
        return {
          codigo: String(cuenta.codigo ?? idExpend),
          nombre: cuenta.nombre || cuenta.descripcion || 'Cuenta contable'
        };
      }
    }

    const fromText = this.parseTipoGastoTexto(
      item?.expenseTypeText ?? item?.tipoGastoTexto ?? item?.tipoGasto ?? item?.cuentaContableTexto
    );
    if (fromText) {
      return fromText;
    }

    if (idExpend) {
      return { codigo: String(idExpend), nombre: 'Cuenta contable' };
    }

    return { codigo: 'SIN-CLASIFICAR', nombre: 'Sin clasificar' };
  }

  private filterByDateRange(data: any[], usePaymentDate: boolean): any[] {
    if (!this.startDate || !this.endDate) return data;
    const start = this.parseDateValue(this.startDate);
    const end = this.parseDateValue(this.endDate);
    if (!start || !end) return data;
    end.setHours(23, 59, 59, 999);

    return data.filter(item => {
      const itemDate = this.getItemDate(item, usePaymentDate);
      if (!itemDate) return false;
      return itemDate >= start && itemDate <= end;
    });
  }

  private parseDateValue(value: any): Date | null {
    if (!value) return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

    const asString = String(value).trim();
    if (!asString) return null;

    const isoDate = new Date(asString);
    if (!Number.isNaN(isoDate.getTime())) return isoDate;

    // Formato dd-MM-yyyy o dd/MM/yyyy
    const match = asString.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
    if (match) {
      const day = Number(match[1]);
      const month = Number(match[2]);
      const year = Number(match[3]);
      const parsed = new Date(year, month - 1, day);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    return null;
  }

  private getItemDate(item: any, usePaymentDate: boolean): Date | null {
    const rawDate = usePaymentDate
      ? (item?.date ?? item?.paymentDate ?? item?.fechaPago ?? item?.dateStamped ?? item?.datestamped)
      : (item?.date ?? item?.dateStamped ?? item?.datestamped);

    return this.parseDateValue(rawDate);
  }

  private getMonto(item: any): number {
    const value = Number(item?.total);
    return Number.isFinite(value) ? value : 0;
  }

  private prepareClasificacionEgresos(egresos: any[]): void {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const grouped = new Map<string, ClasificacionContable>();

    egresos.forEach(item => {
      const tipoGasto = this.getTipoGasto(item);
      const key = `${tipoGasto.codigo}|${tipoGasto.nombre}`;
      const itemDate = this.getItemDate(item, false);
      if (!itemDate) return;

      if (!grouped.has(key)) {
        grouped.set(key, {
          codigo: tipoGasto.codigo,
          nombre: tipoGasto.nombre,
          gastoAnterior: 0,
          gastoMesActual: 0,
          gastoAcumulado: 0,
          tipo: 'EGRESO'
        });
      }

      const registro = grouped.get(key)!;
      const monto = this.getMonto(item);
      if (itemDate.getFullYear() === currentYear && itemDate.getMonth() === currentMonth) {
        registro.gastoMesActual += monto;
      } else {
        registro.gastoAnterior += monto;
      }
      registro.gastoAcumulado = registro.gastoAnterior + registro.gastoMesActual;
    });

    this.clasificacionEgresos = Array.from(grouped.values())
      .filter(item => item.gastoAcumulado > 0)
      .sort((a, b) => a.codigo.localeCompare(b.codigo, 'es', { numeric: true }));

    console.log(`📊 Egresos clasificados por tipo de gasto: ${this.clasificacionEgresos.length} tipos`);
  }

  private prepareFlujoMensual(egresos: any[], ingresos: any[]): void {
    const monthMap = new Map<string, { egreso: number; ingreso: number }>();
    const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

    // Procesar egresos (5xxx, 6xxx)
    egresos.forEach(item => {
      const date = this.getItemDate(item, false);
      if (!date) return;
      const key = `${date.getFullYear()}-${String(date.getMonth()).padStart(2, '0')}`;
      const current = monthMap.get(key) || { egreso: 0, ingreso: 0 };
      current.egreso += this.getMonto(item);
      monthMap.set(key, current);
    });

    // Procesar ingresos (fecha de pago)
    ingresos.forEach(item => {
      const date = this.getItemDate(item, true);
      if (!date) return;
      const key = `${date.getFullYear()}-${String(date.getMonth()).padStart(2, '0')}`;
      const current = monthMap.get(key) || { egreso: 0, ingreso: 0 };
      current.ingreso += this.getMonto(item);
      monthMap.set(key, current);
    });

    // Convertir a array ordenado
    const sortedKeys = Array.from(monthMap.keys()).sort();
    let flujoAcumulado = 0;
    const totalesPorAnioMap = new Map<number, { egreso: number; ingreso: number; flujo: number }>();

    this.flujoMensual = sortedKeys.map(key => {
      const [year, month] = key.split('-').map(Number);
      const data = monthMap.get(key)!;
      const flujoMes = data.ingreso - data.egreso;
      flujoAcumulado += flujoMes;

      // Acumular totales por año
      const anioData = totalesPorAnioMap.get(year) || { egreso: 0, ingreso: 0, flujo: 0 };
      anioData.egreso += data.egreso;
      anioData.ingreso += data.ingreso;
      anioData.flujo += flujoMes;
      totalesPorAnioMap.set(year, anioData);

      return {
        mes: monthNames[month],
        anio: year,
        egresoMensual: data.egreso,
        ingresoMensual: data.ingreso,
        flujoMensual: flujoMes,
        flujoAcumulado: flujoAcumulado
      };
    });

    // Convertir totales por año
    this.totalesPorAnio = Array.from(totalesPorAnioMap.entries())
      .map(([anio, data]) => ({ anio, ...data }))
      .sort((a, b) => a.anio - b.anio);
  }

  private preparePieChart(): void {
    // Filtrar solo egresos con valor > 0
    const egresosConValor = this.clasificacionEgresos.filter(e => e.gastoAcumulado > 0);

    if (egresosConValor.length === 0) {
      this.pieChartOptions = null;
      return;
    }

    const labels = egresosConValor.map(e => `${e.codigo} - ${e.nombre}`);
    const series = egresosConValor.map(e => e.gastoAcumulado);

    this.pieChartOptions = {
      series: series,
      chart: { type: 'donut', height: 320 },
      labels: labels,
      title: { text: 'GASTO TOTAL ACUMULADO', align: 'center', style: { fontSize: '14px', fontWeight: 'bold', color: '#1a365d' } },
      legend: { position: 'bottom', fontSize: '10px' },
      colors: ['#1e3a5f', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#dbeafe', '#7c3aed', '#a78bfa', '#c4b5fd']
    };
  }

  private prepareLineChart(): void {
    if (this.flujoMensual.length === 0) {
      this.lineChartOptions = null;
      return;
    }

    const categories = this.flujoMensual.map(f => `${f.mes.substring(0, 3)} ${f.anio.toString().substring(2)}`);
    const egresoData = this.flujoMensual.map(f => f.egresoMensual);
    const ingresoData = this.flujoMensual.map(f => f.ingresoMensual);
    const flujoData = this.flujoMensual.map(f => f.flujoAcumulado);

    this.lineChartOptions = {
      series: [
        { name: 'EGRESO MENSUAL S/IVA', data: egresoData },
        { name: 'INGRESO S/IVA', data: ingresoData },
        { name: 'FLUJO ACUMULADO', data: flujoData }
      ],
      chart: { type: 'area', height: 350, toolbar: { show: false }, zoom: { enabled: false } },
      stroke: { curve: 'smooth', width: [2, 2, 3] },
      fill: {
        type: 'gradient',
        gradient: {
          shadeIntensity: 1,
          opacityFrom: 0.4,
          opacityTo: 0.1,
          stops: [0, 90, 100]
        }
      },
      xaxis: {
        categories: categories,
        labels: { rotate: -45, style: { fontSize: '10px' } }
      },
      yaxis: {
        labels: {
          formatter: (val) => '$' + (val / 1000).toFixed(1) + 'K'
        }
      },
      title: { text: 'COMPORTAMIENTO DEL NEGOCIO', align: 'left', style: { fontSize: '14px', fontWeight: 'bold', color: '#1a365d' } },
      tooltip: {
        y: {
          formatter: (val) => `$${val.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        }
      },
      legend: { position: 'top', horizontalAlign: 'center' }
    };
  }

  private prepareBarChart(): void {
    if (this.totalesPorAnio.length === 0) {
      this.barChartOptions = null;
      return;
    }

    const categories = this.totalesPorAnio.map(t => `Total ${t.anio}`);
    const egresoData = this.totalesPorAnio.map(t => t.egreso);
    const ingresoData = this.totalesPorAnio.map(t => t.ingreso);

    this.barChartOptions = {
      series: [
        { name: 'Egresos', data: egresoData },
        { name: 'Ingresos', data: ingresoData }
      ],
      chart: { type: 'bar', height: 280, toolbar: { show: false } },
      plotOptions: {
        bar: {
          horizontal: false,
          columnWidth: '55%',
          dataLabels: { position: 'top' }
        }
      },
      dataLabels: {
        enabled: true,
        formatter: (val) => '$' + ((val as number) / 1000).toFixed(0) + 'K',
        offsetY: -20,
        style: { fontSize: '10px', colors: ['#304758'] }
      },
      xaxis: { categories: categories },
      yaxis: {
        labels: {
          formatter: (val) => '$' + (val / 1000).toFixed(0) + 'K'
        }
      },
      title: { text: 'RESUMEN ANUAL', align: 'left', style: { fontSize: '14px', fontWeight: 'bold', color: '#1a365d' } },
      tooltip: {
        y: {
          formatter: (val) => `$${val.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
        }
      }
    };
  }

  // Helpers para la vista - EGRESOS
  public getTotalEgresoAnterior(): number {
    return this.clasificacionEgresos.reduce((sum, c) => sum + c.gastoAnterior, 0);
  }

  public getTotalEgresoMesActual(): number {
    return this.clasificacionEgresos.reduce((sum, c) => sum + c.gastoMesActual, 0);
  }

  public getTotalEgresoAcumulado(): number {
    return this.clasificacionEgresos.reduce((sum, c) => sum + c.gastoAcumulado, 0);
  }

  public getTotalGeneral(): { egreso: number; ingreso: number; flujo: number } {
    return {
      egreso: this.totalesPorAnio.reduce((sum, t) => sum + t.egreso, 0),
      ingreso: this.totalesPorAnio.reduce((sum, t) => sum + t.ingreso, 0),
      flujo: this.totalesPorAnio.reduce((sum, t) => sum + t.flujo, 0)
    };
  }

  public getTotalAnio(anio: number, tipo: 'egreso' | 'ingreso' | 'flujo'): number {
    const anioData = this.totalesPorAnio.find(t => t.anio === anio);
    if (!anioData) return 0;
    return anioData[tipo];
  }

  // Obtener el nombre del mes actual
  public getMesActualNombre(): string {
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return monthNames[new Date().getMonth()];
  }
}
