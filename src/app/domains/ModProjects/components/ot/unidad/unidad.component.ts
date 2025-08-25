import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgApexchartsModule } from 'ng-apexcharts';
import { DailyReportService } from 'app/services/daily-report.service';
import { SignalsService } from 'app/services/signals.service';

// Interfaces para los datos
interface CuadrillaData {
  projectName: string;
  otNumber: string;
  totalOt: number;
  totalProject: number;
}

interface CuadrillaGroup {
  projectName: string;
  ots: { otNumber: string; totalOt: number }[];
  totalProject: number;
}

interface ChartData {
  series: number[];
  labels: string[];
}

@Component({
  selector: 'app-unidad',
  standalone: true,
  imports: [CommonModule, NgApexchartsModule],
  templateUrl: './unidad.component.html',
  styleUrl: './unidad.component.scss'
})
export class UnidadComponent implements OnInit {

  // Servicios
  private dailyReportService = inject(DailyReportService);
  private signalsService = inject(SignalsService);

  // Variables de datos
  public rawData: CuadrillaData[] = [];
  public cuadrillasGrouped: CuadrillaGroup[] = [];
  public generalChartData: ChartData = { series: [], labels: [] };
  public isLoading: boolean = false;
  public error: string = '';

  // Configuración base de ApexCharts para gráficas circulares 3D
  public chartOptions: any = {
    chart: {
      type: 'donut',
      height: 300,
      animations: {
        enabled: true,
        easing: 'easeinout',
        speed: 800
      }
    },
    plotOptions: {
      pie: {
        donut: {
          size: '60%',
          labels: {
            show: true,
            total: {
              show: true,
              showAlways: true,
              label: 'Total',
              fontSize: '9px',
              fontWeight: 700,
              color: '#333',
              formatter: (w: any) => {
                const total = w.globals.seriesTotals.reduce((a: number, b: number) => a + b, 0);
                return '$' + total.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
              }
            }
          }
        }
      }
    },
    dataLabels: {
      enabled: true,
      formatter: (val: number) => {
        return val.toFixed(1) + '%';
      },
      style: {
        fontSize: '10px',
        fontWeight: 'bold'
      }
    },
    legend: {
      show: true,
      position: 'bottom',
      fontSize: '10px',
      formatter: (seriesName: string, opts: any) => {
        const value = opts.w.globals.series[opts.seriesIndex];
        return `${seriesName}: $${value.toLocaleString()}`;
      }
    },
    tooltip: {
      y: {
        formatter: (val: number) => {
          return '$' + val.toLocaleString();
        }
      }
    },
    colors: [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', 
      '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'
    ]
  };

  ngOnInit(): void {
    this.loadData();
  }

  // Cargar datos del servicio
  loadData(): void {
    this.isLoading = true;
    this.error = '';
    
    const idRoot = this.signalsService.getRootSelectedBySidebar()();
    
    if (!idRoot) {
      this.error = 'No hay empresa seleccionada';
      this.isLoading = false;
      return;
    }

    this.dailyReportService.getTotalxCost(idRoot).subscribe({
      next: (response: any) => {
        console.log('🔍 Datos recibidos del servicio:', response);
        
        if (response.success && response.data) {
          this.rawData = response.data;
          this.processData();
        } else {
          this.error = 'No se encontraron datos para la empresa seleccionada';
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('❌ Error al cargar datos:', error);
        this.error = 'Error al cargar los datos de costos';
        this.isLoading = false;
      }
    });
  }

  // Procesar y agrupar los datos
  processData(): void {
    // Agrupar por projectName
    const grouped = this.rawData.reduce((acc, item) => {
      const existing = acc.find(g => g.projectName === item.projectName);
      
      if (existing) {
        existing.ots.push({
          otNumber: item.otNumber,
          totalOt: item.totalOt
        });
      } else {
        acc.push({
          projectName: item.projectName,
          ots: [{
            otNumber: item.otNumber,
            totalOt: item.totalOt
          }],
          totalProject: item.totalProject
        });
      }
      
      return acc;
    }, [] as CuadrillaGroup[]);

    this.cuadrillasGrouped = grouped;
    
    // Preparar datos para gráfica general
    this.generalChartData = {
      series: grouped.map(g => g.totalProject),
      labels: grouped.map(g => g.projectName)
    };

    console.log('🔍 Datos procesados:', {
      gruposIndividuales: this.cuadrillasGrouped.length,
      datosGenerales: this.generalChartData
    });
  }

  // Obtener configuración específica para cada cuadrilla
  getCuadrillaChartOptions(cuadrilla: CuadrillaGroup): any {
    return {
      ...this.chartOptions,
      series: cuadrilla.ots.map(ot => ot.totalOt),
      labels: cuadrilla.ots.map(ot => ot.otNumber),
      title: {
        text: cuadrilla.projectName,
        align: 'center',
        style: {
          fontSize: '14px',
          fontWeight: 'bold',
          color: '#333'
        }
      }
    };
  }

  // Obtener configuración para gráfica general
  getGeneralChartOptions(): any {
    return {
      ...this.chartOptions,
      series: this.generalChartData.series,
      labels: this.generalChartData.labels,
      title: {
        text: 'Resumen General por Cuadrilla',
        align: 'center',
        style: {
          fontSize: '16px',
          fontWeight: 'bold',
          color: '#333'
        }
      },
      chart: {
        ...this.chartOptions.chart,
        height: 400
      }
    };
  }

  // Método para recargar datos
  reloadData(): void {
    this.loadData();
  }

  // Método para calcular total general
  getTotalGeneral(): string {
    const total = this.generalChartData.series.reduce((acc, curr) => acc + curr, 0);
    return total.toLocaleString();
  }
}