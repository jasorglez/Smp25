import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { SignalsService } from 'app/services/signals.service';
import { alerts } from 'app/helpers/alerts';

// Importar los servicios que vamos a necesitar
import { OtService } from 'app/services/ot.service';
import { LogbookService } from 'app/services/logbook.service';
import { WorkprogramsService } from 'app/services/workprograms.service';

@Component({
  selector: 'app-reportes-estimaciones',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  templateUrl: './reportes-estimaciones.component.html',
  styleUrl: './reportes-estimaciones.component.scss'
})
export class ReportesEstimacionesComponent {

  // Inyectar servicios
  private otService = inject(OtService);
  private logbookService = inject(LogbookService);
  private workprogramsService = inject(WorkprogramsService);
  private signalsService = inject(SignalsService);

  // Propiedades para los filtros
  fechaInicio: string = '';
  fechaFin: string = '';
  isLoading: boolean = false;
  
  // Propiedades para el grid
  private gridApi: GridApi;
  public rowData: any[] = [];
  public defaultColDef: ColDef = {
    sortable: true,
    filter: true,
    resizable: true,
    flex: 1,
    minWidth: 150, // Ancho mínimo para evitar que las columnas se aplasten
    cellStyle: { 'vertical-align': 'middle' }
  };

  columnDefs: ColDef[] = [
    { headerName: 'Numero OS', field: 'otNumber', pinned: 'left' },
    { headerName: 'INMUEBLE', field: 'cdc', pinned: 'left' },
    { headerName: 'Nombre del servicio', field: 'description', width: 300 },
    { headerName: 'Equipo Ejecutor', field: 'equipoEjecutor', valueGetter: () => 'N/A' }, // Placeholder
    { headerName: 'Colonia', field: 'neighborhood' },
    { headerName: 'Calle', field: 'address' },
    { headerName: 'Número', field: 'oldAddressNumber' },
    { headerName: 'Trabajo realizado', field: 'trabajoRealizado', valueGetter: () => 'N/A' }, // Placeholder
    { headerName: 'Resultado del Trabajo', field: 'results' },
    { headerName: 'Cantidad', field: 'quantity', type: 'numericColumn' },
    { 
      headerName: 'Fecha de Asignacion', 
      field: 'registerDate',
      valueFormatter: (params) => {
        if (params.value) {
          // Asume que la fecha viene en un formato que JS puede parsear
          return new Date(params.value).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
        }
        return '';
      }
    },
    { 
      headerName: 'Fecha de Ejecucion', 
      field: 'executionDate', // Este campo deberá venir del logbook
      valueFormatter: (params) => {
        if (params.value) {
          return new Date(params.value).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
        }
        return '';
      }
    },
    { headerName: 'Dias', field: 'dias', valueGetter: () => 0 }, // Placeholder
    { headerName: 'Area', field: 'area' },
    { headerName: 'Validado', field: 'validado', valueGetter: () => 'PAGO' }, // Valor estático
    { headerName: 'Observaciones', field: 'observations', width: 300 }
  ];

  constructor() { 
    // Inicializar fechas por defecto (último mes)
    const hoy = new Date();
    const haceUnMes = new Date();
    haceUnMes.setMonth(hoy.getMonth() - 1);
    
    this.fechaInicio = haceUnMes.toISOString().split('T')[0];
    this.fechaFin = hoy.toISOString().split('T')[0];
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    this.gridApi.setGridOption('rowHeight', 35);
    this.gridApi.setGridOption('headerHeight', 40);
  }

  /**
   * Método principal que se llamará al presionar el botón "Consultar".
   * Orquestará la carga de datos y la construcción de la grilla.
   */
  consultarEstimaciones() {
    if (!this.fechaInicio || !this.fechaFin) {
      alerts.basicAlert('Error', 'Por favor, seleccione un rango de fechas válido.', 'error');
      return;
    }
    console.log(`Consultando datos desde ${this.fechaInicio} hasta ${this.fechaFin}`);
    this.isLoading = true;
    
    // Lógica de consulta (actualmente simulada)
    setTimeout(() => {
      this.isLoading = false;
      alerts.basicAlert('Info', 'Funcionalidad de consulta en desarrollo.', 'info');
    }, 1000);
  }

  exportarExcel() {
    if (this.gridApi) {
      this.gridApi.exportDataAsExcel({
        fileName: `Reporte_Estimaciones_${new Date().toISOString().split('T')[0]}.xlsx`
      });
    }
  }
}