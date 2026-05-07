import { Component, inject, ChangeDetectionStrategy, ChangeDetectorRef, effect, OnDestroy, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-community';
import { FallasService, FallaIncidencia, FallaHistorial, UpdateStatusDto } from '../../../../services/fallas.service';
import { SignalsService } from '../../../../services/signals.service';
import { SignalrService } from '../../../../services/signalr.service';
import { Subscription } from 'rxjs';
import * as L from 'leaflet';

@Component({
  selector: 'app-fallas-incidencias',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, AgGridAngular],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fallas-incidencias.component.html',
  styleUrl: './fallas-incidencias.component.scss'
})
export class FallasIncidenciasComponent implements OnDestroy, AfterViewInit {
  private fallasService = inject(FallasService);
  private signalsService = inject(SignalsService);
  private signalRService = inject(SignalrService);
  private cdr = inject(ChangeDetectorRef);

  @ViewChild('mapContainer') mapContainer!: ElementRef;

  private gridApi!: GridApi;
  private signalRSub!: Subscription;
  private leafletMap!: L.Map;
  private fallaMarker?: L.Marker;

  private readonly mapIcon = L.icon({
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    shadowSize: [41, 41]
  });

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

  ngAfterViewInit(): void {
    this.leafletMap = L.map(this.mapContainer.nativeElement, { zoomControl: true })
      .setView([23.6345, -102.5528], 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap'
    }).addTo(this.leafletMap);
  }

  ngOnDestroy(): void {
    this.signalRSub?.unsubscribe();
    this.leafletMap?.remove();
  }

  rowData: FallaIncidencia[] = [];
  selectedFalla: FallaIncidencia | null = null;
  mapFalla: FallaIncidencia | null = null;
  selectedFotoUrl: string | null = null;
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
      headerName: 'Acciones', width: 200, pinned: 'right',
      cellRenderer: (p: any) => {
        const hasLocation = p.data.latitud && p.data.longitud;
        const hasFoto = !!p.data.fotoUrl;
        const mapaBtn = hasLocation
          ? `<button class="btn btn-sm btn-success py-0 px-1 btn-mapa" title="Ver en mapa"><i class="bi bi-geo-alt-fill"></i></button>`
          : `<button class="btn btn-sm btn-outline-secondary py-0 px-1" disabled title="Sin ubicación"><i class="bi bi-geo-alt"></i></button>`;
        const fotoBtn = hasFoto
          ? `<button class="btn btn-sm btn-primary py-0 px-1 btn-foto" title="Ver foto"><i class="bi bi-image-fill"></i></button>`
          : `<button class="btn btn-sm btn-outline-secondary py-0 px-1" disabled title="Sin foto"><i class="bi bi-image"></i></button>`;
        return `<div class="d-flex gap-1 align-items-center h-100">
          <button class="btn btn-sm btn-warning py-0 px-1 btn-actualizar">
            <i class="bi bi-pencil-fill"></i>
          </button>
          <button class="btn btn-sm btn-info py-0 px-1 btn-historial">
            <i class="bi bi-clock-history"></i>
          </button>
          ${mapaBtn}
          ${fotoBtn}
          <button class="btn btn-sm btn-danger py-0 px-1 btn-eliminar">
            <i class="bi bi-trash-fill"></i>
          </button>
        </div>`;
      },
      onCellClicked: (event: any) => {
        const target = event.event.target as HTMLElement;
        if (target.closest('.btn-actualizar')) this.openUpdateModal(event.data);
        if (target.closest('.btn-historial')) this.openHistorial(event.data);
        if (target.closest('.btn-mapa')) this.openMapa(event.data);
        if (target.closest('.btn-foto')) this.openFoto(event.data);
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

  openMapa(falla: FallaIncidencia): void {
    if (!falla.latitud || !falla.longitud) return;
    this.mapFalla = falla;
    this.cdr.markForCheck();
    setTimeout(() => {
      this.leafletMap.invalidateSize();
      this.leafletMap.setView([falla.latitud!, falla.longitud!], 15);
      if (this.fallaMarker) this.leafletMap.removeLayer(this.fallaMarker);
      this.fallaMarker = L.marker([falla.latitud!, falla.longitud!], { icon: this.mapIcon })
        .addTo(this.leafletMap)
        .bindPopup(`<b>${falla.folio}</b><br>${falla.tipoFalla ?? ''}<br>${falla.descripcionCiudadano ?? ''}`)
        .openPopup();
    }, 50);
  }

  closeMapa(): void {
    this.mapFalla = null;
    this.cdr.markForCheck();
  }

  openFoto(falla: FallaIncidencia): void {
    if (!falla.fotoUrl) return;
    this.selectedFotoUrl = falla.fotoUrl;
    this.cdr.markForCheck();
  }

  closeFoto(): void {
    this.selectedFotoUrl = null;
    this.cdr.markForCheck();
  }

  getSeveridadClass(s?: string): string {
    const map: Record<string, string> = { 'ALTA': 'bg-danger', 'MEDIA': 'bg-warning text-dark', 'BAJA': 'bg-success' };
    return map[s ?? ''] ?? 'bg-secondary';
  }
}
