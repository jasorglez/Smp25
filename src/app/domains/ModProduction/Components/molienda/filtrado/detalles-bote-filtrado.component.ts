import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { lastValueFrom } from 'rxjs';
import { ProductionService } from 'app/services/production.service';
import { alerts } from 'app/helpers/alerts';
import { SignalsService } from 'app/services/signals.service';
import { ExtractionFermentationCatalogService } from 'app/services/extraction-fermentation-catalog.service';
import { MaterialXModuloService } from 'app/services/materialxmodulo.service';

interface BoteOption {
  id: number;
  description: string;
  volumen: number;
}

interface BoteAsignacion {
  id: number;         // MoliendaBote.id (DB record)
  idBoteCatalog: number;
  cantidad: number;
}

interface MatDetalleRow {
  id: number;
  fecha: string | null;
  jugo: number | null;
  boteDisplay: string;
  resta: number | null;
  botes: BoteAsignacion[];
  locked: boolean;
  __modified: boolean;
}

// Entrada en el modal para cada bote del catálogo
interface ModalEntry {
  opt: BoteOption;
  espacioUtilizadoExterno: number; // usado por OTROS matdetalles (excluye este)
  asignacion: BoteAsignacion | null; // asignación actual de ESTE matdetalle (si existe)
  inputValue: number | null;         // valor que el usuario escribe
  lleno: boolean;                    // true si no hay espacio disponible para nuevas asignaciones
}

@Component({
  selector: 'app-detalles-bote-filtrado',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridAngular],
  template: `
    <div style="padding: 6px; height: 100%; display: flex; flex-direction: column; box-sizing: border-box; overflow: hidden; background-color: #fff8e1; position: relative;">

      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 5px; flex-shrink: 0;">
        <strong style="font-size: 0.85rem; color: #e65100;">Asignar botes</strong>
      </div>

      <div style="flex: 1 1 auto; min-height: 0; position: relative; overflow: hidden;">
        <ag-grid-angular
          class="ag-theme-quartz small-text-ag-grid"
          [rowData]="rowData"
          [columnDefs]="colDefs"
          [gridOptions]="gridOptions"
          (gridReady)="onGridReady($event)"
          style="width: 100%; height: 100%; position: absolute; top: 0; left: 0; right: 0; bottom: 0;">
        </ag-grid-angular>
      </div>

      <!-- Modal de asignación -->
      <div *ngIf="modalOpen"
           style="position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:9000;display:flex;align-items:center;justify-content:center;">
        <div class="bg-white rounded shadow-lg" style="width:520px;max-height:90vh;display:flex;flex-direction:column;overflow:hidden;">

          <!-- Header -->
          <div class="d-flex align-items-center justify-content-between px-3 py-2 border-bottom" style="background:#fff3e0; flex-shrink:0;">
            <span style="font-weight:600;color:#e65100;font-size:0.92rem;">Asignar botes</span>
            <button class="btn-close btn-sm" (click)="closeModal()"></button>
          </div>

          <!-- Lock -->
          <div class="px-3 pt-2 pb-1 border-bottom d-flex align-items-center gap-2" style="flex-shrink:0; background:#fff8e1;">
            <input type="checkbox" class="form-check-input mt-0" id="modalLock"
                   [(ngModel)]="modalLocked" (ngModelChange)="onLockChange($event)">
            <label for="modalLock" class="mb-0" style="font-size:0.82rem; cursor:pointer; user-select:none;">
              <i class="bi bi-lock-fill me-1" style="color:#e65100;"></i> Bloquear cambios
            </label>
          </div>

          <!-- Info de jugo -->
          <div class="px-3 pt-2 pb-1 border-bottom" style="font-size:0.8rem;color:#5d4037;flex-shrink:0;">
            <span>Jugo disponible en fila: <strong>{{ modalRow?.jugo ?? 0 | number:'1.0-2' }}</strong> L</span>
            &nbsp;|&nbsp;
            <span>Asignado en este registro:
              <strong [style.color]="totalInputModal > (modalRow?.jugo ?? 0) ? '#c62828' : '#2e7d32'">
                {{ totalInputModal | number:'1.0-2' }}
              </strong> L
            </span>
            &nbsp;|&nbsp;
            <span>Restante:
              <strong [style.color]="(modalRow?.jugo ?? 0) - totalInputModal < 0 ? '#c62828' : '#1565c0'">
                {{ (modalRow?.jugo ?? 0) - totalInputModal | number:'1.0-2' }}
              </strong> L
            </span>
          </div>

          <!-- Tabla de botes -->
          <div style="overflow-y:auto;flex:1;">
            <table class="table table-sm table-hover mb-0" style="font-size:0.82rem;">
              <thead style="position:sticky;top:0;background:#fff8e1;z-index:1;">
                <tr>
                  <th>Código bote</th>
                  <th class="text-center">Capacidad</th>
                  <th class="text-center">Espacio utilizado</th>
                  <th class="text-center">Disponible</th>
                  <th class="text-center" style="min-width:110px;">Cantidad a añadir</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let entry of modalEntries"
                    [class.table-warning]="entry.asignacion !== null"
                    [class.table-secondary]="entry.lleno && entry.asignacion === null">
                  <td>{{ entry.opt.description }}</td>
                  <td class="text-center">{{ entry.opt.volumen }}</td>
                  <td class="text-center">
                    <span [style.color]="entry.espacioUtilizadoExterno >= entry.opt.volumen ? '#c62828' : 'inherit'">
                      {{ entry.espacioUtilizadoExterno | number:'1.0-2' }}
                    </span>
                  </td>
                  <td class="text-center">
                    <span [style.color]="entry.opt.volumen - entry.espacioUtilizadoExterno <= 0 ? '#c62828' : '#2e7d32'">
                      {{ entry.opt.volumen - entry.espacioUtilizadoExterno | number:'1.0-2' }}
                    </span>
                  </td>
                  <td class="text-center">
                    <input
                      type="number"
                      class="form-control form-control-sm text-end"
                      style="width:100px;display:inline-block;"
                      [class.is-invalid]="isInputInvalid(entry)"
                      [(ngModel)]="entry.inputValue"
                      [min]="0"
                      [max]="maxInput(entry)"
                      [disabled]="(entry.lleno && entry.asignacion === null) || modalLocked"
                      placeholder="0"
                      (ngModelChange)="onInputChange()">
                  </td>
                </tr>
                <tr *ngIf="!modalEntries.length">
                  <td colspan="5" class="text-center text-muted">Sin botes en catálogo</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Footer -->
          <div class="d-flex align-items-center justify-content-between px-3 py-2 border-top" style="flex-shrink:0;">
            <span *ngIf="modalValidationMsg" style="font-size:0.78rem;color:#c62828;">
              {{ modalValidationMsg }}
            </span>
            <span *ngIf="!modalValidationMsg"></span>
            <div class="d-flex gap-2">
              <button class="btn btn-sm btn-secondary" (click)="closeModal()">Cancelar</button>
              <button class="btn btn-sm btn-primary" (click)="confirmModal()"
                      [disabled]="saving || !!modalValidationMsg">
                <span *ngIf="saving" class="spinner-border spinner-border-sm me-1"></span>
                Guardar
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  `,
  styles: [`:host { display: block; height: 100%; overflow: hidden; }`]
})
export class DetallesBoteFiltradoComponent {
  private productionService = inject(ProductionService);
  private signalsService    = inject(SignalsService);
  private catalogService    = inject(ExtractionFermentationCatalogService);
  private mxmService        = inject(MaterialXModuloService);

  private idMolienda: number | null = null;
  private matPrimaId: number | null = null;
  boteOptions: BoteOption[] = [];
  // usageMap: idBoteCatalog → suma total de cantidad en todos los matdetalles
  private usageMap: Record<number, number> = {};

  rowData: MatDetalleRow[] = [];
  gridApi!: GridApi;

  // Modal
  modalOpen    = false;
  modalLocked  = false;
  saving       = false;
  modalRow:    MatDetalleRow | null = null;
  modalEntries: ModalEntry[] = [];
  modalValidationMsg = '';

  get totalInputModal(): number {
    return this.modalEntries.reduce((s, e) => s + (Number(e.inputValue) || 0), 0);
  }

  // ── Grid ──────────────────────────────────────────────────────────────────

  colDefs: ColDef[] = [
    {
      field: 'fecha',
      headerName: 'Fecha',
      editable: false,
      cellStyle: { backgroundColor: '#f8f9fa', color: '#495057' },
      valueFormatter: (p: any) => {
        if (!p.value) return '';
        const [y, m, d] = String(p.value).split('-');
        return d && m && y ? `${d}/${m}/${y}` : p.value;
      },
    },
    {
      field: 'jugo',
      headerName: 'Cantidad (Jugo)',
      editable: false,
      cellStyle: { backgroundColor: '#f8f9fa', color: '#495057' },
      valueFormatter: (p: any) => p.value != null ? String(p.value) : '—',
    },
    {
      field: 'boteDisplay',
      headerName: 'Bote',
      flex: 1,
      editable: false,
      cellStyle: { cursor: 'pointer', color: '#e65100', textDecoration: 'underline' },
      cellRenderer: (p: any) => `<span title="Click para asignar botes">${p.value || 'Sin asignar'}</span>`,
      onCellClicked: (event: any) => { if (event.data) this.openModal(event.data); },
    },
    {
      field: 'resta',
      headerName: 'Resta',
      editable: false,
      cellStyle: (p: any) => ({
        backgroundColor: '#f8f9fa',
        color: p.value != null && p.value < 0 ? '#dc3545' : '#495057',
      }),
      valueFormatter: (p: any) => p.value != null ? Number(p.value).toFixed(2) : '—',
    },
  ];

  gridOptions: any = {
    getRowId: (params: any) => String(params.data.id),
    headerHeight: 25,
    rowHeight: 22,
    autoSizeStrategy: { type: 'fitCellContents' },
    defaultColDef: { resizable: true },
  };

  // ── Init ──────────────────────────────────────────────────────────────────

  agInit(params: any) {
    this.idMolienda = params?.data?.id ?? null;
    this.matPrimaId = params?.data?.matPrima ?? null;
    this.init();
  }

  refresh(): boolean { return false; }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    if (this.boteOptions.length) this.loadData();
  }

  private async init() {
    await this.loadBoteOptions();
    await this.refreshUsage();
    if (this.gridApi && !this.gridApi.isDestroyed()) this.loadData();
  }

  private async loadBoteOptions() {
    const idCompany = this.signalsService.getRootSelectedBySidebar()();
    if (!idCompany) return;
    try {
      const catalogs = await lastValueFrom(this.catalogService.getAll(idCompany));
      const botesCatalog = (catalogs ?? []).find(c => {
        const d = (c.description || '').trim().toLowerCase()
          .normalize('NFD').replace(/[̀-ͯ]/g, '');
        return d.startsWith('botes molienda') || d.startsWith('botes');
      });
      if (!botesCatalog) return;

      const items = await lastValueFrom(this.mxmService.getByCatalog(idCompany, botesCatalog.id));
      // Numerar globalmente (todos los activos del catálogo, ordenados por id)
      const allActive = (items ?? [])
        .filter((m: any) => m.active !== false)
        .sort((a: any, b: any) => (a.id ?? 0) - (b.id ?? 0));

      const globalNumMap = new Map<number, number>();
      allActive.forEach((item: any, i: number) => globalNumMap.set(item.id, i + 1));

      // Filtrar por mat prima pero conservar el número global
      const sorted = allActive
        .filter((m: any) => this.matPrimaId == null || m.idMatPrima === this.matPrimaId);

      this.boteOptions = sorted.map((item: any) => ({
        id: item.id,
        description: `/ ${item.cantidad ?? ''} - ${globalNumMap.get(item.id)}`,
        volumen: Number(item.cantidad ?? 0),
      }));
    } catch (e) {
      console.error('Error cargando opciones de bote:', e);
    }
  }

  private async refreshUsage() {
    try {
      const usage = await lastValueFrom(this.productionService.getMoliendaBoteUsage());
      this.usageMap = usage ?? {};
    } catch (e) {
      console.error('Error cargando usage:', e);
    }
  }

  async loadData() {
    if (!this.idMolienda) { this.rowData = []; return; }
    try {
      const items = await lastValueFrom(this.productionService.getMoliendaMatDetalleByMolienda(this.idMolienda));
      const matDetalles = Array.isArray(items) ? items : [];

      const botesPerRow = await Promise.all(
        matDetalles.map(i =>
          lastValueFrom(this.productionService.getMoliendaBoteByMatDetalle(i.id))
            .then(b => Array.isArray(b) ? b : [])
            .catch(() => [] as any[])
        )
      );

      this.rowData = matDetalles.map((i, idx) => {
        const botes: BoteAsignacion[] = botesPerRow[idx].map((b: any) => ({
          id: b.id,
          idBoteCatalog: b.idBoteCatalog,
          cantidad: Number(b.cantidad ?? 0),
        }));
        const volAsignado = botes.reduce((s, b) => s + b.cantidad, 0);
        return {
          id: i.id,
          fecha: i.fechaMolienda ? String(i.fechaMolienda).split('T')[0] : null,
          jugo: i.jugo != null ? Number(i.jugo) : null,
          boteDisplay: this.buildBoteDisplay(botes),
          resta: i.jugo != null ? Number(i.jugo) - volAsignado : null,
          botes,
          locked: !!i.locked,
          __modified: false,
        };
      });

      this.sortRows();
      if (this.gridApi && !this.gridApi.isDestroyed())
        this.gridApi.setGridOption('rowData', this.rowData);
    } catch (e) {
      console.error('Error cargando matdetalles:', e);
    }
  }

  // ── Modal ──────────────────────────────────────────────────────────────────

  openModal(row: MatDetalleRow) {
    this.modalRow = row;

    this.modalEntries = this.boteOptions.map(opt => {
      const asignacion = row.botes.find(b => b.idBoteCatalog === opt.id) ?? null;
      // Espacio utilizado por otros (excluye la asignación de ESTA fila)
      const totalUsed = this.usageMap[opt.id] ?? 0;
      const externo   = totalUsed - (asignacion?.cantidad ?? 0);
      const disponible = opt.volumen - externo;
      const lleno      = disponible <= 0;

      // Mostrar: botes con espacio disponible O botes ya asignados en esta fila
      if (lleno && asignacion === null) return null;

      return {
        opt,
        espacioUtilizadoExterno: externo,
        asignacion,
        inputValue: asignacion?.cantidad ?? null,
        lleno,
      } as ModalEntry;
    }).filter((e): e is ModalEntry => e !== null);

    this.modalValidationMsg = '';
    this.modalLocked = row.locked;
    this.modalOpen = true;
  }

  async onLockChange(locked: boolean) {
    if (!this.modalRow) return;
    try {
      await lastValueFrom(this.productionService.patchMoliendaMatDetalleLocked(this.modalRow.id, locked));
      this.modalRow.locked = locked;
      if (this.gridApi && !this.gridApi.isDestroyed()) {
        const node = this.gridApi.getRowNode(String(this.modalRow.id));
        if (node) node.setData({ ...this.modalRow });
      }
    } catch (e) {
      console.error('Error guardando lock:', e);
      this.modalLocked = !locked; // revertir si falla
    }
  }

  closeModal() {
    this.modalOpen   = false;
    this.modalLocked = false;
    this.modalRow    = null;
    this.saving      = false;
    this.modalEntries = [];
  }

  maxInput(entry: ModalEntry): number {
    const disponible = entry.opt.volumen - entry.espacioUtilizadoExterno;
    const jugoRow    = this.modalRow?.jugo ?? 0;
    return Math.min(disponible, jugoRow);
  }

  isInputInvalid(entry: ModalEntry): boolean {
    const v = Number(entry.inputValue) || 0;
    if (v < 0) return true;
    if (v > this.maxInput(entry)) return true;
    return false;
  }

  onInputChange() {
    const jugoRow = this.modalRow?.jugo ?? 0;
    const total   = this.totalInputModal;

    if (this.modalEntries.some(e => this.isInputInvalid(e))) {
      this.modalValidationMsg = 'Algún valor excede la capacidad disponible del bote.';
      return;
    }
    if (jugoRow > 0 && total > jugoRow) {
      this.modalValidationMsg = `La suma (${total.toFixed(2)}) excede el jugo de la fila (${jugoRow.toFixed(2)} L).`;
      return;
    }
    this.modalValidationMsg = '';
  }

  async confirmModal() {
    if (!this.modalRow || this.modalValidationMsg) return;
    this.saving = true;
    const row = this.modalRow;

    try {
      for (const entry of this.modalEntries) {
        const newVal = Number(entry.inputValue) || 0;

        if (entry.asignacion === null) {
          // No había asignación → crear si tiene valor
          if (newVal > 0) {
            const created = await lastValueFrom(
              this.productionService.createMoliendaBote({
                idMatDetalle: row.id,
                idBoteCatalog: entry.opt.id,
                cantidad: newVal,
              })
            );
            row.botes.push({ id: created.id, idBoteCatalog: entry.opt.id, cantidad: newVal });
          }
        } else if (newVal === 0) {
          // Tenía asignación, ahora 0 → eliminar
          await lastValueFrom(this.productionService.deleteMoliendaBote(entry.asignacion.id));
          row.botes = row.botes.filter(b => b.id !== entry.asignacion!.id);
        } else if (newVal !== entry.asignacion.cantidad) {
          // Cambió la cantidad → patch
          await lastValueFrom(
            this.productionService.patchMoliendaBoteCantidad(entry.asignacion.id, newVal)
          );
          entry.asignacion.cantidad = newVal;
          const b = row.botes.find(b => b.id === entry.asignacion!.id);
          if (b) b.cantidad = newVal;
        }
      }

      // Recalcular display y resta
      const volAsignado = row.botes.reduce((s, b) => s + b.cantidad, 0);
      row.boteDisplay = this.buildBoteDisplay(row.botes);
      row.resta = row.jugo != null ? row.jugo - volAsignado : null;

      // Refrescar usage map y fila en grid
      await this.refreshUsage();
      if (this.gridApi && !this.gridApi.isDestroyed()) {
        const node = this.gridApi.getRowNode(String(row.id));
        if (node) {
          node.setData({ ...row });
          this.gridApi.refreshCells({ rowNodes: [node], force: true });
        }
      }

      alerts.reqSuccessToast('Botes guardados');
      this.closeModal();
    } catch (e) {
      console.error('Error guardando botes:', e);
      alerts.reqErrorToast('Error al guardar');
      this.saving = false;
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private sortRows() {
    this.rowData.sort((a, b) => {
      const aPos = (a.resta ?? 0) > 0 ? 0 : 1;
      const bPos = (b.resta ?? 0) > 0 ? 0 : 1;
      if (aPos !== bPos) return aPos - bPos;
      return (a.fecha ?? '').localeCompare(b.fecha ?? '');
    });
  }

  private buildBoteDisplay(botes: BoteAsignacion[]): string {
    if (!botes.length) return '';
    return botes
      .map(b => {
        const opt = this.boteOptions.find(o => o.id === b.idBoteCatalog);
        return opt ? `${opt.description} (${b.cantidad})` : `#${b.idBoteCatalog}`;
      })
      .join(', ');
  }
}
