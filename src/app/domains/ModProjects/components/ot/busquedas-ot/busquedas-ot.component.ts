import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent, SelectionChangedEvent } from 'ag-grid-enterprise';
import { alerts } from 'app/helpers/alerts';
import { OtService } from 'app/services/ot.service';

@Component({
  selector: 'app-busquedas-ot',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  templateUrl: './busquedas-ot.component.html',
  styleUrl: './busquedas-ot.component.scss'
})
export class BusquedasOtComponent {
  private otService = inject(OtService);
  private gridApi: GridApi | null = null;

  cdc = '';
  otNumber = '';
  area = '';
  rowData: any[] = [];
  loading = false;
  searched = false;
  selectedOt: any = null;

  defaultColDef: ColDef = {
    sortable: true,
    filter: true,
    resizable: true,
    minWidth: 110
  };

  columnDefs: ColDef[] = [
    { field: 'id', headerName: 'ID', width: 90, pinned: 'left' },
    {
      field: 'active',
      headerName: 'Estado',
      width: 120,
      pinned: 'left',
      valueFormatter: ({ value }) => value === false ? 'BORRADA' : 'ACTIVA',
      cellClassRules: {
        'status-deleted': ({ value }) => value === false,
        'status-active': ({ value }) => value !== false
      }
    },
    {
      colId: 'logicalDeletion',
      headerName: 'Borrado lógico',
      width: 145,
      valueGetter: ({ data }) => data?.active === false ? 'Sí' : 'No'
    },
    {
      field: 'cuadrilla',
      headerName: 'Cuadrilla asignada',
      minWidth: 180,
      pinned: 'left',
      valueFormatter: ({ value }) => value || 'Sin asignar'
    },
    { field: 'closed', headerName: 'Cierre Web', width: 115, valueFormatter: ({ value }) => value ? 'Sí' : 'No' },
    { field: 'closedApp', headerName: 'Cierre App', width: 115, valueFormatter: ({ value }) => value ? 'Sí' : 'No' },
    { field: 'photoCount', headerName: 'Fotos', width: 105, valueFormatter: ({ value }) => this.formatContentCount(value) },
    { field: 'personalCount', headerName: 'Personal', width: 110, valueFormatter: ({ value }) => this.formatContentCount(value) },
    { field: 'materialCount', headerName: 'Material', width: 110, valueFormatter: ({ value }) => this.formatContentCount(value) },
    { field: 'equipmentCount', headerName: 'Equipos', width: 110, valueFormatter: ({ value }) => this.formatContentCount(value) },
    { field: 'cdc', headerName: 'CDC', width: 130, pinned: 'left' },
    { field: 'otNumber', headerName: 'Número OT', width: 150, pinned: 'left' },
    { field: 'area', headerName: 'Área', width: 140 },
    { field: 'idProject', headerName: 'ID Proyecto', width: 125 },
    { field: 'cuentaHoja', headerName: 'Hoja', width: 100 },
    { field: 'description', headerName: 'Descripción', minWidth: 260, flex: 1 },
    { field: 'assignedTo', headerName: 'Asignado a', minWidth: 170 },
    { field: 'nameConsumer', headerName: 'Usuario', minWidth: 190 },
    { field: 'propertyNumber', headerName: 'Cuenta/Predio', minWidth: 140 },
    { field: 'contractNumber', headerName: 'Contrato', minWidth: 130 },
    { field: 'phoneConsumer', headerName: 'Teléfono', minWidth: 140 },
    { field: 'address', headerName: 'Dirección', minWidth: 220 },
    { field: 'addressNumber', headerName: 'Número', width: 110 },
    { field: 'neighborhood', headerName: 'Colonia', minWidth: 180 },
    { field: 'chargePhase', headerName: 'Fase', width: 120 },
    { field: 'hydrometerNumber', headerName: 'Medidor', minWidth: 140 },
    { field: 'period', headerName: 'Periodo', width: 120 },
    { field: 'observations', headerName: 'Observaciones', minWidth: 240 },
    { field: 'results', headerName: 'Resultados', minWidth: 240 },
    { field: 'registerDate', headerName: 'Fecha de registro', minWidth: 175, valueFormatter: ({ value }) => this.formatDate(value) },
    { field: 'closedAt', headerName: 'Fecha de cierre', minWidth: 175, valueFormatter: ({ value }) => this.formatDate(value) }
  ];

  gridOptions = {
    pagination: true,
    paginationPageSize: 50,
    paginationPageSizeSelector: [25, 50, 100, 500],
    animateRows: true,
    rowSelection: 'single' as const,
    rowClassRules: {
      'deleted-row': ({ data }) => data?.active === false
    }
  };

  search(): void {
    this.loading = true;
    this.gridApi?.showLoadingOverlay();
    this.otService.searchOt(this.cdc, this.otNumber, this.area).subscribe({
      next: (data) => {
        this.rowData = Array.isArray(data) ? data : [];
        this.selectedOt = this.rowData.length === 1 ? this.rowData[0] : null;
        this.searched = true;
        this.loading = false;
        if (!this.rowData.length) {
          this.gridApi?.showNoRowsOverlay();
        }
      },
      error: (error) => {
        this.rowData = [];
        this.searched = true;
        this.loading = false;
        this.gridApi?.showNoRowsOverlay();
        const message = error?.error?.message || error?.error?.Message || error?.message
          || 'No fue posible consultar las órdenes de trabajo.';
        alerts.basicAlert('Error en la búsqueda', message, 'error');
      }
    });
  }

  clear(): void {
    this.cdc = '';
    this.otNumber = '';
    this.area = '';
    this.rowData = [];
    this.selectedOt = null;
    this.searched = false;
  }

  onGridReady(event: GridReadyEvent): void {
    this.gridApi = event.api;
  }

  onSelectionChanged(event: SelectionChangedEvent): void {
    this.selectedOt = event.api.getSelectedRows()[0] || null;
  }

  private formatDate(value: any): string {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('es-MX');
  }

  formatContentCount(value: any): string {
    const count = Number(value) || 0;
    return count > 0 ? `Sí (${count})` : 'No';
  }
}
