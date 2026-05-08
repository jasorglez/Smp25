
import { CommonModule } from '@angular/common';
import { Component, effect, inject } from '@angular/core';
import { IncomesAndExpensesService } from 'app/services/incomes-and-expenses.service';
import { SignalsService } from 'app/services/signals.service';
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
  ApexFill
} from "ng-apexcharts";

// Definimos tipos para cada tipo de gráfica para un código más limpio y seguro
export type BarChartOptions = { series: ApexAxisChartSeries; chart: ApexChart; 
                                xaxis: ApexXAxis; yaxis: ApexYAxis; title: ApexTitleSubtitle; 
                                plotOptions: ApexPlotOptions; tooltip: ApexTooltip;   dataLabels: ApexDataLabels; };
export type LineChartOptions = { series: ApexAxisChartSeries; chart: ApexChart; xaxis: ApexXAxis; yaxis: ApexYAxis; title: ApexTitleSubtitle; stroke: ApexStroke; tooltip: ApexTooltip; fill?: ApexFill; };
export type PieChartOptions = { series: ApexNonAxisChartSeries; chart: ApexChart; labels: any; title: ApexTitleSubtitle; legend: ApexLegend; };

@Component({
  selector: 'app-salesdashboard',
  standalone: true,
  imports: [CommonModule, NgApexchartsModule],
  templateUrl: './salesdashboard.component.html',
  styleUrl: './salesdashboard.component.scss'
})
export class SalesdashboardComponent {

  private incomesAndExpensesService = inject(IncomesAndExpensesService);
  private signalsService = inject(SignalsService);

  // --- ESTADO DEL COMPONENTE ---
  public rootId: number;
  public timeRangeInMonths: number = 60; // 60 meses (5 años) por defecto
  public allSalesData: any[] = [];
    
    // Propiedades para cada elemento del dashboard
    public totalSalesKpi: number = 0;
    public clientList: { name: string; total: number }[] = [];
  
    // Opciones para cada una de las gráficas
    public groupedAnnualChartOptions: Partial<BarChartOptions>;
    public currentYearChartOptions: any = {}; // Gráfica combinada barras + línea
    public pieChartOptions: Partial<PieChartOptions>;
    public branchPieChartOptions: Partial<PieChartOptions>; // Nueva gráfica por sucursales
  
    constructor() { 
      effect(() => {
        this.rootId = this.signalsService.getRootSelectedBySidebar()();
        if (this.rootId) {
          this.getIncomes(this.rootId);
        }
      }, { allowSignalWrites: true });
    }
  
    // --- CONTROL DE LA INTERFAZ ---
    
    public setTimeRange(months: number): void {
      this.timeRangeInMonths = months;
      this.processAllData(); // Volvemos a procesar todos los datos con el nuevo rango
    }
    
    // --- LÓGICA DE DATOS ---
  
    private getIncomes(rootId: number): void {
       this.incomesAndExpensesService.getIncomesxroot(rootId).subscribe(data => {
         const seen = new Set<number>();
         this.allSalesData = (data || []).filter((row: any) => {
           if (seen.has(row.idIncome)) return false;
           seen.add(row.idIncome);
           return true;
         });
         this.processAllData();
       });
    }
  
    /**
     * Este método central orquesta toda la actualización del dashboard.
     * Se llama una vez que llegan los datos y cada vez que se cambia un filtro.
     */
    private processAllData(): void {
      if (!this.allSalesData || this.allSalesData.length === 0) return;
  
      // 1. Filtrar los datos según el rango de tiempo seleccionado
      const filteredData = this.filterDataByTimeRange(this.allSalesData, this.timeRangeInMonths);
  
      // 2. Calcular y actualizar cada parte del dashboard
      this.totalSalesKpi = filteredData.reduce((sum, sale) => sum + sale.totalincome, 0);
      // El listado de clientes usa TODOS los datos para incluir 2026
      this.clientList = this.calculateTopClients(this.allSalesData);
      
      // 3. Preparar cada una de las gráficas
      this.prepareGroupedAnnualChart(this.allSalesData); // Usa TODOS los datos para comparar años
      this.prepareSalesTrendChart(this.allSalesData);    // Tendencia de ventas por año
      this.prepareSalesByCustomerPieChart(this.allSalesData); // Distribución por cliente
      this.prepareSalesByBranchPieChart(this.allSalesData);   // Distribución por sucursal
    }
  
    private filterDataByTimeRange(data: any[], months: number): any[] {
      const now = new Date();
      // Calcular fecha pasada de forma más robusta
      const pastDate = new Date(now.getFullYear(), now.getMonth() - months, 1);
      // Incluir hasta el final del año actual para no excluir ventas del año en curso
      const endOfYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59);

      return data.filter(sale => {
        const saleDate = new Date(sale.fechaingreso);
        return saleDate >= pastDate && saleDate <= endOfYear;
      });
    }
  
    // --- MÉTODOS DE PREPARACIÓN DE GRÁFICAS --- Multianual  
 private prepareGroupedAnnualChart(data: any[]): void {
    // ... (la lógica para agrupar los datos no cambia)
    const salesByYearMonth = data.reduce((acc, sale) => {
      const date = new Date(sale.fechaingreso);
      const year = date.getFullYear();
      const month = date.getMonth();
      if (!acc[year]) acc[year] = Array(12).fill(0);
      acc[year][month] += sale.totalincome;
      return acc;
    }, {});

    const series = Object.keys(salesByYearMonth).map(year => ({
      name: year,
      data: salesByYearMonth[year]
    }));

    this.groupedAnnualChartOptions = {
      series: series,
      chart: {
        type: 'bar',
        height: 320,
        width: '100%',
        toolbar: { show: false },
        fontFamily: 'Inter, system-ui, sans-serif'
      },
      plotOptions: {
        bar: {
          horizontal: false,
          columnWidth: '70%',
          borderRadius: 4,
          dataLabels: {
            position: 'top',
          },
        },
      },
      dataLabels: {
        enabled: true,
        formatter: (val) => (val as number) > 0 ? ((val as number) / 1000).toFixed(0) + 'K' : '',
        offsetY: -20,
        style: {
          fontSize: '10px',
          colors: ["#64748b"]
        }
      },
      xaxis: {
        categories: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
        labels: { style: { colors: '#64748b', fontSize: '11px' } }
      },
      yaxis: {
        labels: {
          formatter: (val) => '$' + (val / 1000).toFixed(0) + 'K',
          style: { colors: '#64748b', fontSize: '11px' }
        }
      },
      tooltip: {
        y: {
          formatter: (val) => '$' + val.toLocaleString('es-MX', { minimumFractionDigits: 2 })
        }
      },
      title: { text: '' }
    };
  }


  // --- MÉTODOS DE PREPARACIÓN DE GRÁFICAS --- Tendencia de ventas mes a mes (todos los años)
  private prepareSalesTrendChart(data: any[]): void {
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const yearColors: { [year: number]: string } = {
      2022: '#9ca3af',  // Gris
      2023: '#f59e0b',  // Amarillo/Naranja
      2024: '#3b82f6',  // Azul
      2025: '#10b981',  // Verde
      2026: '#8b5cf6',  // Morado
      2027: '#ec4899',  // Rosa
    };

    // Agrupar ventas por año-mes
    const salesByYearMonth: { [key: string]: { year: number, month: number, total: number } } = {};
    data.forEach(sale => {
      const date = new Date(sale.fechaingreso);
      const year = date.getFullYear();
      const month = date.getMonth();
      const key = `${year}-${month.toString().padStart(2, '0')}`;
      if (!salesByYearMonth[key]) salesByYearMonth[key] = { year, month, total: 0 };
      salesByYearMonth[key].total += sale.totalincome;
    });

    // Ordenar las claves cronológicamente
    const sortedKeys = Object.keys(salesByYearMonth).sort();
    const allSalesData = sortedKeys.map(key => salesByYearMonth[key].total);

    // Crear etiquetas legibles (Ene'24, Feb'24, etc.)
    const labels = sortedKeys.map(key => {
      const [year, month] = key.split('-');
      return `${monthNames[parseInt(month)]}'${year.slice(2)}`;
    });

    // Obtener años únicos ordenados
    const uniqueYears = [...new Set(sortedKeys.map(k => parseInt(k.split('-')[0])))].sort();

    // Crear una serie de barras por cada año
    const barSeries = uniqueYears.map(year => {
      const yearData = sortedKeys.map(key => {
        const keyYear = parseInt(key.split('-')[0]);
        if (keyYear === year) {
          return salesByYearMonth[key].total;
        }
        return null; // null para que no dibuje barra
      });
      return {
        name: String(year),
        type: 'bar',
        data: yearData
      };
    });

    // Calcular línea de tendencia (regresión lineal simple)
    const n = allSalesData.length;
    if (n < 2) return;

    const sumX = allSalesData.reduce((a, _, i) => a + i, 0);
    const sumY = allSalesData.reduce((a, b) => a + b, 0);
    const sumXY = allSalesData.reduce((a, b, i) => a + (i * b), 0);
    const sumX2 = allSalesData.reduce((a, _, i) => a + (i * i), 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    const trendData = allSalesData.map((_, i) => Math.max(0, Math.round(intercept + slope * i)));

    // Colores: uno por año + rojo para tendencia
    const colors = [...uniqueYears.map(y => yearColors[y] || '#64748b'), '#ff6b6b'];

    // Stroke widths: 0 para barras, 3 para línea
    const strokeWidths = [...uniqueYears.map(() => 0), 3];

    this.currentYearChartOptions = {
        series: [
          ...barSeries,
          {
            name: 'Tendencia',
            type: 'line',
            data: trendData
          }
        ],
        chart: {
          type: 'line',
          height: 380,
          width: '100%',
          stacked: true,
          toolbar: { show: false },
          fontFamily: 'Inter, system-ui, sans-serif',
          zoom: { enabled: true }
        },
        stroke: {
          width: strokeWidths,
          curve: 'straight'
        },
        plotOptions: {
            bar: {
                horizontal: false,
                columnWidth: '70%',
                borderRadius: 3,
            }
        },
        colors: colors,
        fill: {
          opacity: 1
        },
        markers: {
          size: 0
        },
        dataLabels: {
          enabled: false
        },
        xaxis: {
          categories: labels,
          labels: {
            rotate: -45,
            rotateAlways: true,
            style: { colors: '#64748b', fontSize: '10px' }
          },
          tickPlacement: 'on'
        },
        yaxis: {
            labels: {
              formatter: (val) => {
                if (val >= 1000000) return '$' + (val / 1000000).toFixed(1) + 'M';
                return '$' + (val / 1000).toFixed(0) + 'K';
              },
              style: { colors: '#64748b', fontSize: '11px' }
            }
        },
        tooltip: {
            shared: true,
            intersect: false,
            y: {
              formatter: (val) => val ? '$' + val.toLocaleString('es-MX', { minimumFractionDigits: 2 }) : ''
            }
        },
        legend: {
          show: true,
          position: 'top',
          horizontalAlign: 'right',
          fontSize: '12px'
        },
        title: { text: '' }
    };
  }

    
    private calculateTopClients(data: any[]): { name: string, total: number }[] {
      const salesByClient = data.reduce((acc, sale) => {
          // Normalizar nombre: trim y quitar espacios múltiples
          const client = (sale.company || 'Sin cliente').trim().replace(/\s+/g, ' ').toUpperCase();
          if (!acc[client]) acc[client] = 0;
          acc[client] += Number(sale.totalincome) || 0;
          return acc;
      }, {} as { [key: string]: number });

      return Object.entries(salesByClient)
        .map(([name, total]) => ({ name, total: total as number }))
        .sort((a, b) => b.total - a.total); // Todos los clientes ordenados por ventas
    }
    
    private prepareSalesByCustomerPieChart(data: any[]): void {
      const salesByCustomer = data.reduce((acc, sale) => {
        // Normalizar nombre: trim y quitar espacios múltiples (igual que en calculateTopClients)
        const customer = (sale.company || 'Sin cliente').trim().replace(/\s+/g, ' ').toUpperCase();
        if (!acc[customer]) acc[customer] = 0;
        acc[customer] += Number(sale.totalincome) || 0;
        return acc;
      }, {} as { [key: string]: number });
  
      this.pieChartOptions = {
        series: Object.values(salesByCustomer) as number[],
        chart: {
          type: 'donut',
          height: 350,
          width: '100%',
          fontFamily: 'Inter, system-ui, sans-serif'
        },
        labels: Object.keys(salesByCustomer),
        title: { text: '' },
        legend: {
          position: 'bottom',
          fontSize: '11px'
        }
      };
    }

    // Gráfica de distribución por sucursales - PENDIENTE: necesita endpoint para nombres
    private prepareSalesByBranchPieChart(data: any[]): void {
      // Por ahora agrupa por idBranch, pendiente mapear a nombres
      const salesByBranch = data.reduce((acc, sale) => {
        const branchId = sale.idBranch || 0;
        if (!acc[branchId]) acc[branchId] = 0;
        acc[branchId] += Number(sale.totalincome) || 0;
        return acc;
      }, {} as { [key: number]: number });

      this.branchPieChartOptions = {
        series: Object.values(salesByBranch) as number[],
        chart: {
          type: 'pie',
          height: 350,
          width: '100%',
          fontFamily: 'Inter, system-ui, sans-serif'
        },
        labels: Object.keys(salesByBranch).map(id => `Sucursal ID: ${id}`),
        title: { text: '' },
        legend: {
          position: 'bottom',
          fontSize: '11px'
        }
      };
    }

}
