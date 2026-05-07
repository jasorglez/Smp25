import { Component, inject, ChangeDetectionStrategy, ChangeDetectorRef, effect, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-community';
import { FallasService, FallaIncidencia, FallaHistorial, UpdateStatusDto } from '../../../../services/fallas.service';
import { SignalsService } from '../../../../services/signals.service';
import { SignalrService } from '../../../../services/signalr.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-fallas-incidencias',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, AgGridAngular],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fallas-incidencias.component.html',
  styleUrl: './fallas-incidencias.component.scss'
})
export class FallasIncidenciasComponent implements OnDestroy {
  private fallasService = inject(FallasService);
  private signalsService = inject(SignalsService);
  private signalRService = inject(SignalrService);
  private cdr = inject(ChangeDetectorRef);

  private gridApi!: GridApi;
  private signalRSub!: Subscription;

  constructor() {
    effect(() => {
      const id = this.signalsService.getRootSelectedBySidebar()();
      if (id) this.loadData();
    });

    // Escucha notificaciones en tiempo real del bot / operadores
    this.signalRSub = this.signalRService.admonUpdate$.subscribe(data => {
      if (data?.type === 'FALLA_NUEVA' || data?.type === 'FALLA_UPDATE') {
        if (data.idRoot === this.idCompany) this.loadData();
      }
    });
  }

  ngOnDestroy(): void {
    this.signalRSub?.unsubscribe();
  }

  rowData: FallaIncidencia[] = [];
  selectedFalla: FallaIncidencia | null = null;
  historial: FallaHistorial[] = [];
  showHistorial = false;
  showUpdateModal = false;

  statusOptions = ['NUEVO', 'EN_PROCESO', 'RESUELTO', 'CERRADO', 'CANCELADO'];
  statusColors: Record<string, string> = {
    'NUEVO': 'bg-primary',
    'EN_PROCESO': 'bg-warning text-dark',
    'RESUELTO': 'bg-success',
    'CERRADO': 'bg-secondary',
    'CANCELADO': 'bg-danger'
  };

  updateDto: UpdateStatusDto = { status: '', notas: '' };

  columnDefs: ColDef[] = [
    { field: 'folio', headerName: 'Folio', width: 130, pinned: 'left' },
    {
      field: 'status', headerName: 'Status', width: 130,
      cellRenderer: (p: any) => {
        const color = this.statusColors[p.value] ?? 'bg-secondary';
        return `<span class="badge ${color}">${p.value ?? ''}</span>`;
      }
    },
    { field: 'tipoFalla', headerName: 'Tipo', width: 140 },
    { field: 'severidadIa', headerName: 'Severidad', width: 100 },
    { field: 'departamento', headerName: 'Departamento', width: 140 },
    { field: 'canal', headerName: 'Canal', width: 100 },
    { field: 'ciudadanoNombre', headerName: 'Ciudadano', width: 160 },
    { field: 'descripcionCiudadano', headerName: 'Descripción', flex: 1, minWidth: 200 },
    {
      field: 'fechaReporte', headerName: 'Fecha', width: 130,
      valueFormatter: p => p.value ? new Date(p.value).toLocaleDateString('es-MX') : ''
    },
    {
      headerName: 'Acciones', width: 140, pinned: 'right',
      cellRenderer: (p: any) => {
        return `<div class="d-flex gap-1 align-items-center h-100">
          <button class="btn btn-sm btn-warning py-0 px-1 btn-actualizar">
            <i class="bi bi-pencil-fill"></i>
          </button>
          <button class="btn btn-sm btn-info py-0 px-1 btn-historial">
            <i class="bi bi-clock-history"></i>
          </button>
          <button class="btn btn-sm btn-danger py-0 px-1 btn-eliminar">
            <i class="bi bi-trash-fill"></i>
          </button>
        </div>`;
      },
      onCellClicked: (event: any) => {
        const target = event.event.target as HTMLElement;
        if (target.closest('.btn-actualizar')) this.openUpdateModal(event.data);
        if (target.closest('.btn-historial')) this.openHistorial(event.data);
        if (target.closest('.btn-eliminar')) this.deleteFalla(event.data);
      }
    }
  ];

  defaultColDef: ColDef = { sortable: true, resizable: true, filter: true };

  onGridReady(event: GridReadyEvent): void {
    this.gridApi = event.api;
  }

  get idCompany(): number {
    return +(this.signalsService.getRootSelectedBySidebar()() ?? 0);
  }

  loadData(): void {
    if (!this.idCompany) return;
    this.fallasService.getByCompany(this.idCompany).subscribe({
      next: data => {
        this.rowData = data;
        this.cdr.markForCheck();
      },
      error: err => console.error('Error cargando fallas', err)
    });
  }

  openUpdateModal(falla: FallaIncidencia): void {
    this.selectedFalla = falla;
    this.updateDto = { status: falla.status ?? 'NUEVO', notas: '' };
    this.showUpdateModal = true;
    this.cdr.markForCheck();
  }

  saveStatus(): void {
    if (!this.selectedFalla?.id) return;
    this.fallasService.updateStatus(this.selectedFalla.id, this.updateDto).subscribe({
      next: () => {
        this.showUpdateModal = false;
        this.selectedFalla = null;
        this.loadData();
      },
      error: err => console.error('Error actualizando status', err)
    });
  }

  openHistorial(falla: FallaIncidencia): void {
    this.selectedFalla = falla;
    this.historial = [];
    this.showHistorial = true;
    this.cdr.markForCheck();

    if (falla.id) {
      this.fallasService.getHistorial(falla.id).subscribe({
        next: data => {
          this.historial = data;
          this.cdr.markForCheck();
        },
        error: err => console.error('Error cargando historial', err)
      });
    }
  }

  deleteFalla(falla: FallaIncidencia): void {
    if (!falla.id || !confirm(`¿Eliminar el reporte ${falla.folio}?`)) return;
    this.fallasService.delete(falla.id).subscribe({
      next: () => this.loadData(),
      error: err => console.error('Error eliminando falla', err)
    });
  }

  closeModals(): void {
    this.showHistorial = false;
    this.showUpdateModal = false;
    this.selectedFalla = null;
    this.cdr.markForCheck();
  }

  getSeveridadClass(s?: string): string {
    const map: Record<string, string> = { 'ALTA': 'bg-danger', 'MEDIA': 'bg-warning text-dark', 'BAJA': 'bg-success' };
    return map[s ?? ''] ?? 'bg-secondary';
  }
}
