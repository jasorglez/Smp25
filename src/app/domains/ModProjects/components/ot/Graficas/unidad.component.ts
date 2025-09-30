import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgApexchartsModule } from 'ng-apexcharts';
import { DailyReportService } from 'app/services/daily-report.service';
import { SignalsService } from 'app/services/signals.service';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

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
  imports: [CommonModule, NgApexchartsModule, ReactiveFormsModule],
  templateUrl: './unidad.component.html',
  styleUrl: './unidad.component.scss'
})
export class UnidadComponent implements OnInit {

  // Servicios
  private dailyReportService = inject(DailyReportService);
  private signalsService = inject(SignalsService);
  private fb = inject(FormBuilder);

  // Variables de datos
  public rawData: CuadrillaData[] = [];
  public cuadrillasGrouped: CuadrillaGroup[] = [];
  public generalChartData: ChartData = { series: [], labels: [] };
  public isLoading: boolean = false;
  public error: string = '';

  selectFechas!: FormGroup;
  fechaInicio: string = '';
  fechaFin: string = '';

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
    // Los colores se asignarán dinámicamente por gráfica
  };

  ngOnInit(): void {
    this.initializeDatesAndForm();
    this.loadData(this.fechaInicio, this.fechaFin);
  }

  private initializeDatesAndForm(): void {
    const today = new Date();
    const dayOfWeek = today.getDay(); // Domingo: 0, Lunes: 1, ..., Sábado: 6

    // Calcular el jueves de esta semana
    const thisThursday = new Date(today);
    thisThursday.setDate(today.getDate() - dayOfWeek + 4);

    // Calcular el miércoles de la semana anterior
    const previousWednesday = new Date(thisThursday);
    previousWednesday.setDate(thisThursday.getDate() - 8);

    // Formatear a YYYY-MM-DD
    this.fechaInicio = previousWednesday.toISOString().split('T')[0];
    this.fechaFin = thisThursday.toISOString().split('T')[0];

    this.selectFechas = this.fb.group({
      fechaInicio: [this.fechaInicio, Validators.required],
      fechaFin: [this.fechaFin, Validators.required]
    });

    // Suscribirse a los cambios en el formulario para recargar datos automáticamente
    this.selectFechas.valueChanges.subscribe(values => {
      if (this.selectFechas.valid && values.fechaInicio && values.fechaFin) {
        this.fechaInicio = values.fechaInicio;
        this.fechaFin = values.fechaFin;
        this.loadData(values.fechaInicio, values.fechaFin);
      }
    });
  }

  // Cargar datos del servicio
  loadData(fechaInicio: string, fechaFin: string): void {
    this.isLoading = true;
    this.error = '';
    
    const idRoot = this.signalsService.getRootSelectedBySidebar()();
    
    if (!idRoot) {
      this.error = 'No hay empresa seleccionada.';
      this.isLoading = false;
      return;
    }

    this.dailyReportService.getTotalxCost(idRoot, fechaInicio, fechaFin).subscribe({
      next: (response: any) => {
        console.log('🔍 Datos recibidos del servicio:', response);
        
        if (response.success && response.data) {
          this.rawData = response.data;
          this.processData();
        } else {
          this.error = response.message || 'No se encontraron datos para la empresa seleccionada en el rango de fechas.';
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('❌ Error al cargar datos:', error);
        this.error = 'Error al cargar los datos de costos. Intente de nuevo.';
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

  // Paleta de colores diferentes para cada gráfica
  private chartColorPalettes = [
    ['#FF4444', '#FF6B6B', '#FF8E8E', '#FFB1B1'], // Rojos
    ['#4ECDC4', '#6ED4CC', '#8EDCD5', '#AEE4DE'], // Verdes agua
    ['#45B7D1', '#67C5D9', '#89D3E1', '#ABE1E9'], // Azules
    ['#96CEB4', '#A8D6C2', '#BADED0', '#CCE6DE'], // Verde menta
    ['#FFEAA7', '#FFEFB8', '#FFF4C9', '#FFF9DA'], // Amarillos
    ['#DDA0DD', '#E4B3E4', '#EBC6EB', '#F2D9F2'], // Lilas
    ['#98D8C8', '#AAE0D0', '#BCE8D8', '#CEF0E0'], // Verde agua claro
    ['#F7DC6F', '#F9E489', '#FBECA3', '#FDF4BD']  // Dorados
  ];

  // Obtener configuración específica para cada cuadrilla
  getCuadrillaChartOptions(cuadrilla: CuadrillaGroup, index: number): any {
    const colorPalette = this.chartColorPalettes[index % this.chartColorPalettes.length];
    
    return {
      ...this.chartOptions,
      series: cuadrilla.ots.map(ot => ot.totalOt),
      labels: cuadrilla.ots.map(ot => ot.otNumber),
      colors: colorPalette,
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
    // Para la gráfica general, usar el primer color de cada paleta
    const generalColors = this.chartColorPalettes.map(palette => palette[0]);
    
    return {
      ...this.chartOptions,
      series: this.generalChartData.series,
      labels: this.generalChartData.labels,
      colors: generalColors,
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
    //this.loadData();
  }

  // Método para calcular total general
  getTotalGeneral(): string {
    const total = this.generalChartData.series.reduce((acc, curr) => acc + curr, 0);
    return total.toLocaleString();
  }

  Consultar(): void {
    if (this.selectFechas.invalid) {
      this.error = 'Por favor, seleccione una fecha de inicio y fin válidas.';
      return;
    }
    const { fechaInicio, fechaFin } = this.selectFechas.value;
    this.fechaInicio = fechaInicio;
    this.fechaFin = fechaFin;
    this.loadData(this.fechaInicio, this.fechaFin);
  }
}