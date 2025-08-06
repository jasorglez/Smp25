
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
  ApexStroke, // Importamos ApexStroke para la gráfica de líneas
} from "ng-apexcharts";

// Definimos tipos para cada tipo de gráfica para un código más limpio y seguro
export type BarChartOptions = { series: ApexAxisChartSeries; chart: ApexChart; 
                                xaxis: ApexXAxis; yaxis: ApexYAxis; title: ApexTitleSubtitle; 
                                plotOptions: ApexPlotOptions; tooltip: ApexTooltip;   dataLabels: ApexDataLabels; };
export type LineChartOptions = { series: ApexAxisChartSeries; chart: ApexChart; xaxis: ApexXAxis; yaxis: ApexYAxis; title: ApexTitleSubtitle; stroke: ApexStroke; tooltip: ApexTooltip; };
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
    public timeRangeInMonths: number = 12; // 12 meses por defecto
    private allSalesData: any[] = [];
    
    // Propiedades para cada elemento del dashboard
    public totalSalesKpi: number = 0;
    public clientList: { name: string; total: number }[] = [];
  
    // Opciones para cada una de las gráficas
    public groupedAnnualChartOptions: Partial<BarChartOptions>;
    public currentYearChartOptions: Partial<BarChartOptions>;
    public salesTrendChartOptions: Partial<LineChartOptions>;
    public pieChartOptions: Partial<PieChartOptions>;
  
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
         this.allSalesData = data;
         this.processAllData(); // Punto de entrada inicial para procesar datos
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
  
      // 2. Calcular y actualizar cada parte del dashboard con los datos filtrados
      this.totalSalesKpi = filteredData.reduce((sum, sale) => sum + sale.totalincome, 0);
      this.clientList = this.calculateTopClients(filteredData);
      
      // 3. Preparar cada una de las gráficas
      this.prepareGroupedAnnualChart(this.allSalesData); // Usa TODOS los datos para comparar años
      this.prepareCurrentYearChart(this.allSalesData);   // Usa TODOS los datos para encontrar el año actual
      this.prepareSalesTrendChart(filteredData);         // Usa datos FILTRADOS
      this.prepareSalesByCustomerPieChart(filteredData); // Usa datos FILTRADOS
    }
  
    private filterDataByTimeRange(data: any[], months: number): any[] {
      const now = new Date();
      const pastDate = new Date(new Date().setMonth(now.getMonth() - months));
      return data.filter(sale => {
        const saleDate = new Date(sale.fechaingreso);
        return saleDate >= pastDate && saleDate <= now;
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
      chart: { type: 'bar', height: 250, width: 650, toolbar: { show: false } },

      plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: '185%',
        dataLabels: { // <-- 1. MOVEMOS dataLabels AQUÍ DENTRO
          position: 'top', // Posiciona la etiqueta encima de la barra
        },
      },
    },
      
      // ================================================================
      // INICIO DE LA MODIFICACIÓN PARA "COMPARATIVA ANUAL"
      // ================================================================
      dataLabels: { // <-- 2. LA CONFIGURACIÓN GENERAL VA AQUÍ
      enabled: true,
      formatter: (val) => (val as number / 1000).toFixed(1) + 'K',
      offsetY: -20,
      style: {
        fontSize: '10px',
        colors: ["#304758"]
      }
    },
      // ================================================================
      // FIN DE LA MODIFICACIÓN
      // ================================================================

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
      title: { text: 'COMPARATIVA ANUAL', align: 'left', style: { color: '#dc3545', fontSize: '14px' } }
    };
  }


  // --- MÉTODOS DE PREPARACIÓN DE GRÁFICAS --- Actual del año en Curso
private prepareCurrentYearChart(data: any[]): void {
  const currentYear = new Date().getFullYear();
  const currentYearData = data.filter(sale => new Date(sale.fechaingreso).getFullYear() === currentYear);
     
  const salesByMonth = currentYearData.reduce((acc, sale) => {
      const month = new Date(sale.fechaingreso).getMonth();
      acc[month] += sale.totalincome;
      return acc;
  }, Array(12).fill(0));

  this.currentYearChartOptions = {
      series: [{ name: `Ventas ${currentYear}`, data: salesByMonth }],
      chart: { type: 'bar', height: 250, width: 750, toolbar: { show: false } },
             
      plotOptions: {
          bar: {
              horizontal: false,
              columnWidth: '185%',
              dataLabels: {
                  position: 'top',
              },
          }
      },
             
     // ================================================================
      // CORRECCIÓN PARA EL FORMATO DE VALORES DENTRO DE LAS BARRAS
      // ================================================================
      dataLabels: {
        enabled: true,
        formatter: function (val: number) {
          // Si el valor es cero, no mostramos etiqueta
          if (val === 0) {
            return '';
          }
          // Convertir a miles y redondear (sin decimales)
          return Math.round(val / 1000) + 'K';
        },
        offsetY: -20, // Posición arriba de la barra
        style: {
          fontSize: '12px',
          fontWeight: 'bold',
          colors: ["#333"]
        }
      },
      // 
       
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

    
    private calculateTopClients(data: any[]): { name: string, total: number }[] {
      const salesByClient = data.reduce((acc, sale) => {
          const client = sale.company;
          if (!acc[client]) acc[client] = 0;
          acc[client] += sale.totalincome;
          return acc;
      }, {});
  
      return Object.entries(salesByClient)
        .map(([name, total]) => ({ name, total: total as number }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5); // Tomamos los 5 clientes principales
    }
    
    private prepareSalesTrendChart(data: any[]): void {
        const salesByMonth = data.reduce((acc, sale) => {
          const date = new Date(sale.fechaingreso);
          const key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
          if (!acc[key]) acc[key] = { total: 0, label: date.toLocaleString('es-MX', { month: 'short', year: '2-digit' }).replace('.','') };
          acc[key].total += sale.totalincome;
          return acc;
        }, {});
        
        const sortedKeys = Object.keys(salesByMonth).sort();
        const chartLabels = sortedKeys.map(key => salesByMonth[key].label);
        const chartData = sortedKeys.map(key => salesByMonth[key].total);
  
        this.salesTrendChartOptions = {
          series: [{ name: 'Ventas', data: chartData }],
          chart: { type: 'line', height: 250, toolbar: { show: false } },
          stroke: { curve: 'smooth', width: 3, colors: ['#28a745'] },
          xaxis: { categories: chartLabels },
          yaxis: { labels: { formatter: (val) => '$' + (val / 1000).toFixed(0) + 'K' } },
          title: { text: 'TENDENCIA DE VENTAS', align: 'left' },
          tooltip: { y: { formatter: (val) => `$${val.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}` } }
        };
    }
  
    private prepareSalesByCustomerPieChart(data: any[]): void {
      const salesByCustomer = data.reduce((acc, sale) => {
        const customer = sale.company;
        if (!acc[customer]) acc[customer] = 0;
        acc[customer] += sale.totalincome;
        return acc;
      }, {});
  
      this.pieChartOptions = {
        series: Object.values(salesByCustomer) as number[],
        chart: { type: 'donut', height: 250 },
        labels: Object.keys(salesByCustomer),
        title: { text: 'DISTRIBUCIÓN POR CLIENTE', align: 'left' },
        legend: { position: 'bottom' }
      };
    }

}
