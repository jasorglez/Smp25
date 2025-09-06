import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { EstimatesService } from 'app/services/estimates.service';
import { SignalsService } from 'app/services/signals.service';
import { TrackingService } from 'app/services/tracking.service';
import { alerts } from 'app/helpers/alerts';

@Component({
  selector: 'app-reportes-estimaciones',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  templateUrl: './reportes-estimaciones.component.html',
  styleUrl: './reportes-estimaciones.component.scss'
})
export class ReportesEstimacionesComponent {

  private estimatesService = inject(EstimatesService);
  private signalsService = inject(SignalsService);
  private trackingService = inject(TrackingService);

  // Variables del componente
  fechaInicio: string = '';
  fechaFin: string = '';
  estadoFiltro: string = '';
  
  reporteData: any[] = [];
  resumenEstadistico: any = null;
  
  private gridApi: GridApi;
  private contract = this.signalsService.getContractSelectedBySidebar()();

  // Configuración del grid
  defaultColDef = {
    sortable: true,
    filter: true,
    resizable: true,
    flex: 1
  };

  columnDefs: ColDef[] = [
    {
      field: 'number',
      headerName: 'No. Estimación',
      width: 140,
      pinned: 'left'
    },
    {
      field: 'dateStart',
      headerName: 'Fecha Inicio',
      width: 120,
      valueFormatter: (params) => {
        if (params.value) {
          return new Date(params.value).toLocaleDateString('es-ES');
        }
        return '';
      }
    },
    {
      field: 'dateEnd',
      headerName: 'Fecha Fin',
      width: 120,
      valueFormatter: (params) => {
        if (params.value) {
          return new Date(params.value).toLocaleDateString('es-ES');
        }
        return '';
      }
    },
    {
      field: 'dias',
      headerName: 'Días',
      width: 80,
      type: 'numericColumn'
    },
    {
      field: 'typeMoney',
      headerName: 'Moneda',
      width: 100
    },
    {
      field: 'amountMX',
      headerName: 'Monto MXN',
      width: 140,
      type: 'numericColumn',
      valueFormatter: (params) => {
        return new Intl.NumberFormat('es-MX', { 
          style: 'currency', 
          currency: 'MXN' 
        }).format(params.value);
      }
    },
    {
      field: 'amountDLL',
      headerName: 'Monto USD',
      width: 140,
      type: 'numericColumn',
      valueFormatter: (params) => {
        return new Intl.NumberFormat('en-US', { 
          style: 'currency', 
          currency: 'USD' 
        }).format(params.value);
      }
    },
    {
      field: 'acumulateMX',
      headerName: 'Acumulado MXN',
      width: 150,
      type: 'numericColumn',
      valueFormatter: (params) => {
        return new Intl.NumberFormat('es-MX', { 
          style: 'currency', 
          currency: 'MXN' 
        }).format(params.value);
      }
    },
    {
      field: 'acumulateDLL',
      headerName: 'Acumulado USD',
      width: 150,
      type: 'numericColumn',
      valueFormatter: (params) => {
        return new Intl.NumberFormat('en-US', { 
          style: 'currency', 
          currency: 'USD' 
        }).format(params.value);
      }
    },
    {
      field: 'type',
      headerName: 'Tipo',
      width: 120
    },
    {
      field: 'authorizeUser',
      headerName: 'Autorizado Por',
      width: 150
    },
    {
      field: 'comment',
      headerName: 'Comentarios',
      width: 200
    }
  ];

  constructor() {
    // Log de acceso al componente
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Acceso a Reportes de Estimaciones',
      'Modulo Proyectos - Estimaciones - Reportes',
      this.trackingService.getEmail()
    );

    // Inicializar fechas por defecto (último mes)
    const hoy = new Date();
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    
    this.fechaInicio = inicioMes.toISOString().split('T')[0];
    this.fechaFin = hoy.toISOString().split('T')[0];
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    this.generarReporte(); // Cargar datos iniciales
  }

  generarReporte() {
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Generar Reporte de Estimaciones',
      'Modulo Proyectos - Estimaciones - Reportes',
      this.trackingService.getEmail()
    );

    if (!this.contract) {
      alerts.basicAlert('Error', 'Debe seleccionar un contrato', 'error');
      return;
    }

    this.estimatesService.getEstimates(this.contract).subscribe({
      next: (data: any[]) => {
        // Aplicar filtros
        let datosFiltrados = [...data];

        // Filtro por fechas
        if (this.fechaInicio) {
          datosFiltrados = datosFiltrados.filter(item => 
            new Date(item.dateStart) >= new Date(this.fechaInicio)
          );
        }

        if (this.fechaFin) {
          datosFiltrados = datosFiltrados.filter(item => 
            new Date(item.dateEnd) <= new Date(this.fechaFin)
          );
        }

        // Filtro por estado
        if (this.estadoFiltro) {
          datosFiltrados = datosFiltrados.filter(item => 
            item.type === this.estadoFiltro
          );
        }

        this.reporteData = datosFiltrados;
        this.calcularResumenEstadistico();
        
        alerts.basicAlert('Reporte Generado', 
          `Se encontraron ${this.reporteData.length} registros`, 'success');
      },
      error: (error) => {
        console.error('Error al generar reporte:', error);
        alerts.basicAlert('Error', 'Error al generar el reporte', 'error');
      }
    });
  }

  private calcularResumenEstadistico() {
    if (this.reporteData.length === 0) {
      this.resumenEstadistico = null;
      return;
    }

    const totalMXN = this.reporteData.reduce((sum, item) => sum + (item.amountMX || 0), 0);
    const totalUSD = this.reporteData.reduce((sum, item) => sum + (item.amountDLL || 0), 0);
    const totalDias = this.reporteData.reduce((sum, item) => sum + (item.dias || 0), 0);

    this.resumenEstadistico = {
      totalEstimaciones: this.reporteData.length,
      totalMXN: totalMXN,
      totalUSD: totalUSD,
      promedioPorDia: totalDias > 0 ? totalMXN / totalDias : 0
    };
  }

  exportarExcel() {
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Exportar Reporte Estimaciones a Excel',
      'Modulo Proyectos - Estimaciones - Reportes',
      this.trackingService.getEmail()
    );

    if (this.gridApi) {
      this.gridApi.exportDataAsExcel({
        fileName: `Reporte_Estimaciones_${new Date().toISOString().split('T')[0]}.xlsx`
      });
    }
  }

  exportarPDF() {
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Exportar Reporte Estimaciones a PDF',
      'Modulo Proyectos - Estimaciones - Reportes',
      this.trackingService.getEmail()
    );

    alerts.basicAlert('Funcionalidad', 'Exportar PDF próximamente disponible', 'info');
  }

  imprimirReporte() {
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Imprimir Reporte Estimaciones',
      'Modulo Proyectos - Estimaciones - Reportes',
      this.trackingService.getEmail()
    );

    window.print();
  }
}