import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent, SelectionChangedEvent } from 'ag-grid-enterprise';
import { alerts } from 'app/helpers/alerts';
import { OtSearchRequest, OtSearchResponse, OtService } from 'app/services/ot.service';

@Component({
  selector: 'app-busquedas-ot',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  templateUrl: './busquedas-ot.component.html',
  styleUrl: './busquedas-ot.component.scss'
})
export class BusquedasOtComponent implements OnInit {
  private otService = inject(OtService);
  private router = inject(Router);
  private gridApi: GridApi | null = null;

  cdc = '';
  otNumber = '';
  area = '';
  cuadrilla = '';
  status = '';
  closedWeb = '';
  closedApp = '';
  hasPhotos = '';
  hasPersonal = '';
  hasMaterial = '';
  hasEquipment = '';
  dateFrom = '';
  dateTo = '';
  pageSize = 25;
  currentPage = 1;
  totalRecords = 0;
  totalPages = 0;
  areaOptions: string[] = [];
  cuadrillaOptions: string[] = [];
  rowData: any[] = [];
  loading = false;
  loadingOptions = false;
  searched = false;
  selectedOt: any = null;

  defaultColDef: ColDef = {
    sortable: false,
    filter: false,
    resizable: true,
    minWidth: 110
  };

  columnDefs: ColDef[] = [
    { field: 'id', headerName: 'ID', width: 90, pinned: 'left', suppressMenu: true },
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
    {
      field: 'closed',
      headerName: 'Cierre Web',
      width: 115,
      valueFormatter: ({ value }) => value ? 'Sí' : 'No',
      cellClassRules: {
        'semaphore-good': ({ value }) => value === true,
        'semaphore-warn': ({ value }) => value === false
      }
    },
    {
      field: 'closedApp',
      headerName: 'Cierre App',
      width: 115,
      valueFormatter: ({ value }) => value ? 'Sí' : 'No',
      cellClassRules: {
        'semaphore-good': ({ value }) => value === true,
        'semaphore-warn': ({ value }) => value === false
      }
    },
    {
      field: 'photoCount',
      headerName: 'Fotos',
      width: 105,
      valueFormatter: ({ value }) => this.formatContentCount(value),
      cellClassRules: {
        'semaphore-good': ({ value }) => Number(value) > 0,
        'semaphore-bad': ({ value }) => Number(value) <= 0
      }
    },
    {
      field: 'personalCount',
      headerName: 'Personal',
      width: 110,
      valueFormatter: ({ value }) => this.formatContentCount(value),
      cellClassRules: {
        'semaphore-good': ({ value }) => Number(value) > 0,
        'semaphore-bad': ({ value }) => Number(value) <= 0
      }
    },
    {
      field: 'materialCount',
      headerName: 'Material',
      width: 110,
      valueFormatter: ({ value }) => this.formatContentCount(value),
      cellClassRules: {
        'semaphore-good': ({ value }) => Number(value) > 0,
        'semaphore-bad': ({ value }) => Number(value) <= 0
      }
    },
    {
      field: 'equipmentCount',
      headerName: 'Equipos',
      width: 110,
      valueFormatter: ({ value }) => this.formatContentCount(value),
      cellClassRules: {
        'semaphore-good': ({ value }) => Number(value) > 0,
        'semaphore-bad': ({ value }) => Number(value) <= 0
      }
    },
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
    { field: 'lastActivity', headerName: 'Última actividad', minWidth: 175, valueFormatter: ({ value }) => this.formatDate(value) },
    { field: 'observations', headerName: 'Observaciones', minWidth: 240 },
    { field: 'results', headerName: 'Resultados', minWidth: 240 },
    { field: 'registerDate', headerName: 'Fecha de registro', minWidth: 175, valueFormatter: ({ value }) => this.formatDate(value) },
    { field: 'closedAt', headerName: 'Fecha de cierre', minWidth: 175, valueFormatter: ({ value }) => this.formatDate(value) }
  ];

  gridOptions = {
    animateRows: true,
    rowSelection: 'single' as const,
    rowClassRules: {
      'deleted-row': ({ data }) => data?.active === false
    }
  };

  ngOnInit(): void {
    this.loadSearchOptions();
  }

  search(page = 1): void {
    this.currentPage = page;
    this.loading = true;
    this.gridApi?.showLoadingOverlay();
    const request: OtSearchRequest = {
      cdc: this.cdc.trim(),
      otNumber: this.otNumber.trim(),
      area: this.area.trim(),
      cuadrilla: this.cuadrilla.trim(),
      status: this.status,
      closedWeb: this.closedWeb,
      closedApp: this.closedApp,
      hasPhotos: this.hasPhotos,
      hasPersonal: this.hasPersonal,
      hasMaterial: this.hasMaterial,
      hasEquipment: this.hasEquipment,
      dateFrom: this.dateFrom,
      dateTo: this.dateTo,
      page: this.currentPage,
      pageSize: this.pageSize
    };

    this.otService.searchOt(request).subscribe({
      next: (data) => {
        const response = data as OtSearchResponse | any[];
        if (Array.isArray(response)) {
          this.rowData = response;
          this.totalRecords = response.length;
          this.totalPages = response.length > 0 ? 1 : 0;
          this.currentPage = response.length > 0 ? 1 : 0;
        } else {
          this.rowData = Array.isArray(response?.data) ? response.data : [];
          this.totalRecords = Number(response?.total) || 0;
          this.totalPages = Number(response?.totalPages) || 0;
          this.currentPage = Number(response?.page) || this.currentPage;
          this.pageSize = Number(response?.pageSize) || this.pageSize;
        }
        this.selectedOt = this.rowData.length === 1 ? this.rowData[0] : null;
        this.searched = true;
        this.loading = false;
        this.gridApi?.hideOverlay();
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
        alerts.basicAlert('Error en Búsquedas OT', message, 'error');
      }
    });
  }

  onPrimarySearchChanged(field: 'cdc' | 'otNumber' | 'area', value: string): void {
    const text = value ?? '';

    if (field === 'cdc') {
      this.cdc = text;
      if (text.trim()) {
        this.otNumber = '';
        this.area = '';
      }
      return;
    }

    if (field === 'otNumber') {
      this.otNumber = text;
      if (text.trim()) {
        this.cdc = '';
        this.area = '';
      }
      return;
    }

    this.area = text;
    if (text.trim()) {
      this.cdc = '';
      this.otNumber = '';
    }
  }

  onCuadrillaChanged(value: string): void {
    this.cuadrilla = value ?? '';
    if (this.cuadrilla.trim()) {
      this.cdc = '';
      this.otNumber = '';
    }
  }

  clear(): void {
    this.cdc = '';
    this.otNumber = '';
    this.area = '';
    this.cuadrilla = '';
    this.status = '';
    this.closedWeb = '';
    this.closedApp = '';
    this.hasPhotos = '';
    this.hasPersonal = '';
    this.hasMaterial = '';
    this.hasEquipment = '';
    this.dateFrom = '';
    this.dateTo = '';
    this.pageSize = 25;
    this.currentPage = 1;
    this.totalRecords = 0;
    this.totalPages = 0;
    this.rowData = [];
    this.selectedOt = null;
    this.searched = false;
    this.gridApi?.hideOverlay();
    this.gridApi?.showNoRowsOverlay();
  }

  private loadSearchOptions(): void {
    this.loadingOptions = true;
    this.otService.getOtSearchOptions().subscribe({
      next: (response) => {
        this.areaOptions = Array.isArray(response?.areas) ? response.areas : [];
        this.cuadrillaOptions = Array.isArray(response?.cuadrillas) ? response.cuadrillas : [];
        this.loadingOptions = false;
      },
      error: () => {
        this.areaOptions = [];
        this.cuadrillaOptions = [];
        this.loadingOptions = false;
      }
    });
  }

  onGridReady(event: GridReadyEvent): void {
    this.gridApi = event.api;
    this.gridApi.sizeColumnsToFit();
  }

  onSelectionChanged(event: SelectionChangedEvent): void {
    this.selectedOt = event.api.getSelectedRows()[0] || null;
  }

  previousPage(): void {
    if (this.currentPage > 1 && !this.loading) {
      this.search(this.currentPage - 1);
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages && !this.loading) {
      this.search(this.currentPage + 1);
    }
  }

  refresh(): void {
    this.search(this.currentPage || 1);
  }

  exportPage(): void {
    if (!this.rowData.length) {
      alerts.basicAlert('Sin datos', 'No hay resultados para exportar en la página actual.', 'warning');
      return;
    }

    this.gridApi?.exportDataAsCsv({
      fileName: `busqueda-ot-pagina-${this.currentPage}.csv`
    });
  }

  openSelectedOt(): void {
    if (!this.selectedOt?.id) {
      alerts.basicAlert('Sin selección', 'Selecciona una OT para abrir su detalle.', 'warning');
      return;
    }

    this.router.navigate(['/projects/ot/details', this.selectedOt.id]);
  }

  get pageStart(): number {
    if (!this.totalRecords || !this.rowData.length) {
      return 0;
    }
    return ((this.currentPage - 1) * this.pageSize) + 1;
  }

  get pageEnd(): number {
    if (!this.totalRecords || !this.rowData.length) {
      return 0;
    }
    return this.pageStart + this.rowData.length - 1;
  }

  get missingContentLabel(): string {
    if (!this.selectedOt) {
      return 'Sin selección';
    }

    const missing: string[] = [];
    if (!this.selectedOt.photoCount) missing.push('Fotos');
    if (!this.selectedOt.personalCount) missing.push('Personal');
    if (!this.selectedOt.materialCount) missing.push('Material');
    if (!this.selectedOt.equipmentCount) missing.push('Equipos');

    return missing.length ? `Faltan: ${missing.join(', ')}` : 'Contenido completo';
  }

  semaphoreStatusClass(value: any): string {
    return value === false ? 'semaphore-bad' : 'semaphore-good';
  }

  semaphoreClosureClass(value: any): string {
    if (value === true) {
      return 'semaphore-good';
    }

    if (value === false) {
      return 'semaphore-warn';
    }

    return 'semaphore-neutral';
  }

  semaphoreContentClass(value: any): string {
    return Number(value) > 0 ? 'semaphore-good' : 'semaphore-bad';
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
