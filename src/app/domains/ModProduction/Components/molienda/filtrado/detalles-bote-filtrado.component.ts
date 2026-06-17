import { Component, inject, ChangeDetectorRef} from '@angular/core';
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
import { BranchsService } from 'app/services/branchs.service';

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
           style="position:absolute;inset:0;z-index:100;display:flex;flex-direction:column;background:#fff;border-radius:8px;overflow:hidden;">
        <div style="display:flex;flex-direction:column;height:100%;overflow:hidden;">

          <!-- Header -->
          <div class="d-flex align-items-center justify-content-between px-3 py-2 border-bottom"
               [style.background]="lockedViewMode ? '#f8f9fa' : '#fff3e0'" style="flex-shrink:0;">
            <span style="font-weight:600;font-size:0.92rem;" [style.color]="lockedViewMode ? '#495057' : '#e65100'">
              <i *ngIf="lockedViewMode" class="bi bi-lock-fill me-1"></i>
              {{ lockedViewMode ? 'Botes asignados' : 'Asignar botes' }}
              <span *ngIf="matPrimaName" style="font-weight:400;">— {{ matPrimaName }}</span>
              <span *ngIf="modalRow?.fecha" style="font-weight:400; font-size:0.82rem; margin-left:6px; opacity:0.75;">
                {{ modalRow!.fecha | date:'dd/MM/yyyy' }}
              </span>
            </span>
            <button class="btn-close btn-sm" (click)="closeModal()"></button>
          </div>

          <!-- Lock (solo en modo edición y cuando resta = 0) -->
          <div *ngIf="!lockedViewMode && (modalRow?.resta ?? 1) === 0"
               class="px-3 pt-2 pb-1 border-bottom d-flex align-items-center gap-2"
               style="flex-shrink:0; background:#fff8e1;">
            <input type="checkbox" id="modalLock" style="width:1rem;height:1rem;margin:0;cursor:pointer;"
                   [ngModel]="modalLocked" (click)="onLockCheckboxClick($event)">
            <label for="modalLock" class="mb-0" style="font-size:0.82rem; cursor:pointer; user-select:none;">
              <i class="bi bi-lock-fill me-1" style="color:#e65100;"></i> Bloquear cambios
            </label>
          </div>

          <!-- Info de jugo (solo en modo edición) -->
          <div *ngIf="!lockedViewMode" class="px-3 pt-2 pb-1 border-bottom" style="font-size:0.8rem;color:#5d4037;flex-shrink:0;">
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

          <!-- Área central: botes + panel historial -->
          <div style="display:flex;flex:1;overflow:hidden;gap:0;">

            <!-- Izquierda: tarjetas de botes (se encoge al bote seleccionado cuando hay uno) -->
            <div style="overflow-y:auto;padding:16px;"
                 [style.flex]="selectedEntry ? '0 0 auto' : '1 1 auto'">
              <div *ngIf="!modalEntries.length" class="text-center text-muted py-4" style="font-size:0.85rem;">
                Sin botes asignados
              </div>
              <div style="display:flex;flex-wrap:wrap;gap:0;justify-content:flex-start;">
                <ng-container *ngFor="let entry of modalEntries">
                  <div class="bote-card"
                       [class.bote-card--hidden]="selectedEntry && selectedEntry !== entry"
                       [class.bote-card--full]="fillPct(entry.espacioUtilizadoExterno + baseMine(entry), entry.opt.volumen) >= 100"
                       [class.bote-card--empty]="baseMine(entry) === 0 && entry.espacioUtilizadoExterno === 0"
                       [class.bote-card--partial]="(baseMine(entry) > 0 || entry.espacioUtilizadoExterno > 0) && fillPct(entry.espacioUtilizadoExterno + baseMine(entry), entry.opt.volumen) < 100"
                       [class.bote-card--selected]="!lockedViewMode && selectedEntry === entry"
                       (click)="lockedViewMode ? selectLockedEntry(entry) : (selectedEntry ? null : selectEntry(entry))">

                    <!-- Barril con nivel de llenado -->
                    <div class="bote-barrel"
                         [class.bote-barrel--full]="fillPct(entry.espacioUtilizadoExterno + baseMine(entry), entry.opt.volumen) >= 100"
                         [class.bote-barrel--empty]="baseMine(entry) === 0 && entry.espacioUtilizadoExterno === 0"
                         [class.bote-barrel--partial]="(baseMine(entry) > 0 || entry.espacioUtilizadoExterno > 0) && fillPct(entry.espacioUtilizadoExterno + baseMine(entry), entry.opt.volumen) < 100">
                      <!-- Nivel: externo (otras filas) -->
                      <div class="bote-fill bote-fill--external"
                           [class.bote-fill--external-locked]="lockedViewMode"
                           [style.height.%]="fillPct(entry.espacioUtilizadoExterno, entry.opt.volumen)"
                           [class.bote-fill--red]="!lockedViewMode && fillPct(entry.espacioUtilizadoExterno + baseMine(entry), entry.opt.volumen) >= 100">
                      </div>
                      <!-- Nivel: ya asignado de esta fila -->
                      <div class="bote-fill bote-fill--mine"
                           [class.bote-fill--mine-locked]="lockedViewMode"
                           [style.height.%]="fillPct(baseMine(entry), entry.opt.volumen)"
                           [style.bottom.%]="fillPct(entry.espacioUtilizadoExterno, entry.opt.volumen)"
                           [class.bote-fill--red]="!lockedViewMode && fillPct(entry.espacioUtilizadoExterno + baseMine(entry), entry.opt.volumen) >= 100">
                      </div>
                      <!-- Nivel: nueva adición (solo modo edición) -->
                      <div *ngIf="selectedEntry === entry"
                           class="bote-fill bote-fill--new"
                           [style.height.%]="fillPct(+(entry.inputValue ?? 0), entry.opt.volumen)"
                           [style.bottom.%]="fillPct(entry.espacioUtilizadoExterno + baseMine(entry), entry.opt.volumen)">
                      </div>
                      <i class="bi bi-bucket-fill bote-icon"
                         [style.color]="baseMine(entry) === 0 && entry.espacioUtilizadoExterno === 0 ? '#0a6640' : '#843f00'"></i>
                      <span class="bote-pct"
                            [style.color]="baseMine(entry) === 0 && entry.espacioUtilizadoExterno === 0 ? '#0a6640' : '#843f00'">
                        {{ lockedViewMode
                             ? ((entry.asignacion?.cantidad ?? 0) | number:'1.0-0') + ' L'
                             : (disponible(entry) | number:'1.0-0') + ' L' }}
                      </span>
                    </div>

                    <!-- Etiqueta -->
                    <div class="bote-label" [title]="entry.opt.description">
                      {{ entry.opt.description }}
                    </div>

                    <!-- Modo edición: agregar o retirar -->
                    <ng-container *ngIf="!lockedViewMode && selectedEntry === entry">

                      <!-- Toggle Agregar / Retirar (solo si ya tiene jugo asignado) -->
                      <div *ngIf="entry.asignacion !== null" class="d-flex gap-1 mt-1"
                           (click)="$event.stopPropagation()">
                        <button class="btn flex-fill"
                                style="font-size:0.72rem;padding:2px 4px;"
                                [class.btn-success]="!retiroMode"
                                [class.btn-outline-success]="retiroMode"
                                (click)="retiroMode = false; retiroValue = null; retiroComent = ''">
                          <i class="bi bi-plus-lg"></i> Agregar
                        </button>
                        <button class="btn flex-fill"
                                style="font-size:0.72rem;padding:2px 4px;"
                                [class.btn-danger]="retiroMode"
                                [class.btn-outline-danger]="!retiroMode"
                                (click)="retiroMode = true; entry.inputValue = null">
                          <i class="bi bi-dash-lg"></i> Retirar
                        </button>
                      </div>

                      <!-- Formulario agregar -->
                      <ng-container *ngIf="!retiroMode">
                        <input
                          type="number"
                          class="form-control form-control-sm text-center bote-input mt-1"
                          [class.is-invalid]="isInputInvalid(entry)"
                          [class.bote-input--active]="(entry.inputValue ?? 0) > 0"
                          [(ngModel)]="entry.inputValue"
                          [min]="0"
                          [max]="maxInput(entry)"
                          [disabled]="(entry.lleno && entry.asignacion === null) || modalLocked"
                          placeholder="0 L"
                          (ngModelChange)="onInputChange()"
                          (click)="$event.stopPropagation()">
                        <input type="text" class="form-control form-control-sm bote-input mt-1"
                               [(ngModel)]="entryComentario"
                               placeholder="Comentario (opcional)"
                               (click)="$event.stopPropagation()" maxlength="500">
                        <div class="d-flex gap-1 mt-1">
                          <button class="btn btn-sm btn-success flex-fill"
                                  (click)="confirmEntry(); $event.stopPropagation()"
                                  [disabled]="isInputInvalid(entry)">
                            <i class="bi bi-check-lg"></i>
                          </button>
                          <button class="btn btn-sm btn-outline-secondary flex-fill"
                                  (click)="cancelEntry(); $event.stopPropagation()">
                            <i class="bi bi-x-lg"></i>
                          </button>
                        </div>
                      </ng-container>

                      <!-- Formulario retirar -->
                      <ng-container *ngIf="retiroMode">
                        <input
                          type="number"
                          class="form-control form-control-sm text-center bote-input mt-1"
                          [class.is-invalid]="(retiroValue ?? 0) > (entry.asignacion?.cantidad ?? 0) || (retiroValue ?? 0) <= 0"
                          [(ngModel)]="retiroValue"
                          [min]="1"
                          [max]="entry.asignacion?.cantidad ?? 0"
                          placeholder="Litros a retirar"
                          (click)="$event.stopPropagation()">
                        <div *ngIf="(retiroValue ?? 0) > (entry.asignacion?.cantidad ?? 0)"
                             style="font-size:0.68rem;color:#dc3545;text-align:center;"
                             (click)="$event.stopPropagation()">
                          Máx. {{ entry.asignacion?.cantidad ?? 0 | number:'1.0-0' }} L
                        </div>
                        <input type="text" class="form-control form-control-sm bote-input mt-1"
                               [(ngModel)]="retiroComent"
                               placeholder="Motivo (requerido)"
                               (click)="$event.stopPropagation()" maxlength="500">
                        <div class="d-flex gap-1 mt-1">
                          <button class="btn btn-sm btn-danger flex-fill"
                                  (click)="confirmRetiro(entry); $event.stopPropagation()"
                                  [disabled]="!retiroValue || (retiroValue ?? 0) <= 0 || (retiroValue ?? 0) > (entry.asignacion?.cantidad ?? 0) || !retiroComent.trim()">
                            <i class="bi bi-check-lg"></i>
                          </button>
                          <button class="btn btn-sm btn-outline-secondary flex-fill"
                                  (click)="cancelEntry(); $event.stopPropagation()">
                            <i class="bi bi-x-lg"></i>
                          </button>
                        </div>
                      </ng-container>

                    </ng-container>

                  </div>
                </ng-container>
              </div>
            </div>

            <!-- Derecha: panel historial — flex:1 llena todo el espacio restante -->
            <div *ngIf="selectedEntry" class="historial-panel" style="flex:1;">
              <div class="historial-panel__header">
                <i class="bi bi-clock-history me-1"></i>
                Historial — {{ selectedEntry.opt.description }}
              </div>
              <ng-container *ngIf="selectedEntryHistorial.length; else sinHistorial">
                <ag-grid-angular
                  class="ag-theme-quartz"
                  [rowData]="selectedEntryHistorial"
                  [columnDefs]="historialColDefs"
                  [gridOptions]="historialGridOptions"
                  style="width:100%; height:100%; flex:1; min-height:0;">
                </ag-grid-angular>
              </ng-container>
              <ng-template #sinHistorial>
                <div class="historial-panel__empty">Sin registros</div>
              </ng-template>
            </div>

          </div>

          <!-- Prompt de bloqueo (solo modo edición) -->
          <div *ngIf="showLockPrompt && !lockedViewMode"
               class="d-flex align-items-center justify-content-between px-3 py-2 border-top"
               style="flex-shrink:0; background:#fff3e0;">
            <span style="font-size:0.82rem; color:#e65100;">
              <i class="bi bi-lock-fill me-1"></i>
              Todos los litros asignados. ¿Bloquear este registro?
            </span>
            <div class="d-flex gap-2">
              <button class="btn btn-sm btn-outline-secondary" (click)="dismissLock()">No</button>
              <button class="btn btn-sm btn-warning" (click)="confirmLock()">
                <i class="bi bi-lock-fill me-1"></i> Bloquear
              </button>
            </div>
          </div>

          <!-- Footer: solo mensaje de validación (sin Cancelar/Guardar) -->
          <div *ngIf="!lockedViewMode && modalValidationMsg"
               class="px-3 py-2 border-top" style="flex-shrink:0;">
            <span style="font-size:0.78rem;color:#c62828;">{{ modalValidationMsg }}</span>
          </div>

        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; height: 100%; overflow: hidden; }
    :host ::ng-deep .locked-row { background: #e9ecef !important; color: #6c757d !important; }
    :host ::ng-deep .locked-row .ag-cell { color: #6c757d !important; }

    .bote-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 203px;
      background: #fff;
      border: 1.5px solid #dee2e6;
      border-radius: 10px;
      padding: 12px 10px 10px;
      gap: 5px;
      margin: 0 12px 12px 0;
      transition: opacity 0.28s ease, transform 0.28s ease, box-shadow 0.15s, border-color 0.15s,
                  max-width 0.28s ease, width 0.28s ease, padding 0.28s ease, margin 0.28s ease;
      overflow: hidden;
      max-width: 252px;
    }
    .bote-card--hidden {
      opacity: 0;
      transform: scale(0.82);
      max-width: 0;
      width: 0;
      flex-basis: 0 !important;
      padding-left: 0;
      padding-right: 0;
      margin: 0;
      pointer-events: none;
    }
    .bote-card:not(.bote-card--selected):not(.bote-card--hidden) { cursor: pointer; }
    .bote-card:not(.bote-card--selected):not(.bote-card--hidden):hover { box-shadow: 0 2px 8px rgba(0,0,0,0.12); }
    .bote-card--selected { order: -1; width: 250px; box-shadow: 0 0 0 3px rgba(13,110,253,0.35), 0 3px 10px rgba(0,0,0,0.15); }
    .bote-card--full    { border-color: #dc3545; background: #fff5f5; }
    .bote-card--empty   {
      border-color: #198754;
      border-width: 2.5px;
      background: #c8f7dc;
      box-shadow: 0 0 0 3px rgba(25,135,84,0.2), 0 2px 8px rgba(25,135,84,0.18);
    }
    .bote-card--partial { border-color: #fd7e14; background: #fff3e0; }

    .bote-barrel {
      position: relative;
      width: 100px;
      height: 113px;
      border: 2px solid #adb5bd;
      border-radius: 10px;
      overflow: hidden;
      background: #f1f3f5;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: border-color 0.2s;
    }
    .bote-barrel--full    { border-color: #dc3545; }
    .bote-barrel--empty   { border-color: #198754; background: #e6faf0; }
    .bote-barrel--partial { border-color: #fd7e14; }
    .bote-fill {
      position: absolute;
      left: 0; right: 0; bottom: 0;
      transition: height 0.35s ease;
    }
    .bote-fill--external        { background: rgba(108,117,125,0.28); }
    .bote-fill--external-locked { background: rgba(108,117,125,0.10) !important; }
    .bote-fill--mine             { background: rgba(253,126,20,0.55); }
    .bote-fill--mine-locked      { background: rgba(25,135,84,0.60) !important; }
    .bote-fill--new      { background: rgba(13,110,253,0.40); }
    .bote-fill--red      { background: rgba(220,53,69,0.45) !important; }
    .bote-fill--green    { background: rgba(25,135,84,0.35) !important; }

    .bote-icon {
      position: relative;
      z-index: 2;
      font-size: 2.1rem;
      filter: drop-shadow(0 1px 1px rgba(255,255,255,0.7));
    }
    .bote-pct {
      position: absolute;
      bottom: 2px;
      right: 4px;
      font-size: 0.62rem;
      font-weight: 700;
      color: #343a40;
      z-index: 3;
      line-height: 1;
    }

    .bote-label {
      font-size: 0.75rem;
      font-weight: 600;
      color: #343a40;
      text-align: center;
      white-space: normal;
      word-break: break-word;
      max-width: 190px;
    }
    .bote-capacity {
      font-size: 0.7rem;
      color: #6c757d;
      text-align: center;
    }

    .bote-input {
      width: 100%;
      font-size: 0.78rem;
      border-radius: 6px;
      border-color: #ced4da;
    }
    .bote-input--active {
      border-color: #fd7e14;
      background: #fff3e0;
    }

    .historial-panel {
      display: flex;
      flex-direction: column;
      border-left: 1px solid #dee2e6;
      background: #f8f9fa;
      overflow: hidden;
      min-width: 0;
    }
    .historial-panel__header {
      padding: 8px 12px;
      font-size: 0.78rem;
      font-weight: 600;
      color: #495057;
      border-bottom: 1px solid #dee2e6;
      flex-shrink: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .historial-panel__empty {
      padding: 16px 12px;
      font-size: 0.78rem;
      color: #adb5bd;
    }
    .historial-panel ::ng-deep .ag-root-wrapper { border: none; }
    .historial-panel ::ng-deep .ag-header { background: #f0f0f0; }
    .historial-panel ::ng-deep .ag-cell { font-size: 0.72rem; padding: 0 6px; line-height: 18px; }
    .historial-panel ::ng-deep .ag-header-cell-label { font-size: 0.68rem; }
  `]
})
export class DetallesBoteFiltradoComponent {
  private productionService = inject(ProductionService);
  private readonly cdr = inject(ChangeDetectorRef);
  private signalsService    = inject(SignalsService);
  private catalogService    = inject(ExtractionFermentationCatalogService);
  private mxmService        = inject(MaterialXModuloService);
  private branchsService    = inject(BranchsService);

  private branchPrefijoMap = new Map<number, string>();

  private idMolienda:   number | null = null;
  private matPrimaId:   number | null = null;
  private rowBranchId:  number | null = null;
  matPrimaName: string = '';
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
  selectedEntry: ModalEntry | null = null;
  private selectedEntryOriginalValue: number | null = null;
  selectedEntryHistorial: any[] = [];
  entryComentario: string = '';
  showLockPrompt = false;
  lockedViewMode = false;
  retiroMode     = false;
  retiroValue:   number | null = null;
  retiroComent   = '';

  get totalInputModal(): number {
    return this.modalEntries.reduce((s, e) => {
      const base = this.selectedEntry === e
        ? (Number(this.selectedEntryOriginalValue) || 0) + (Number(e.inputValue) || 0)
        : (Number(e.inputValue) || 0);
      return s + base;
    }, 0);
  }

// ── Historial grid ────────────────────────────────────────────────────────

  readonly historialColDefs: ColDef[] = [
    {
      field: 'fecha',
      headerName: 'Fecha',
      width: 120,
      valueFormatter: (p: any) => {
        if (!p.value) return '';
        const d = new Date(p.value);
        return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getFullYear()).slice(2)} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
      },
    },
    {
      field: 'usuario',
      headerName: 'Usuario',
      width: 140,
    },
    {
      field: 'cantidad',
      headerName: 'Litros',
      width: 75,
      type: 'numericColumn',
      valueFormatter: (p: any) => {
        if (p.value == null) return '';
        const v = Number(p.value);
        return v < 0 ? `−${Math.abs(v).toFixed(0)}` : `+${v.toFixed(0)}`;
      },
      cellStyle: (p: any) => ({
        fontWeight: '600',
        color: Number(p.value) < 0 ? '#dc3545' : '#198754',
      }),
    },
    {
      field: 'comentario',
      headerName: 'Comentario',
      flex: 1,
      wrapText: true,
      autoHeight: true,
      cellStyle: {
        'white-space': 'normal',
        'word-break': 'break-word',
        'line-height': '1.45',
        'padding': '3px 8px',
        'font-size': '0.72rem',
        'color': '#495057',
      },
      cellRenderer: (p: any) => p.value
        ? `<span>${String(p.value).replace(/</g, '&lt;')}</span>`
        : `<span style="color:#ced4da;">—</span>`,
    },
  ];

  readonly historialGridOptions: any = {
    headerHeight: 22,
    rowHeight: 22,
    defaultColDef: { resizable: true, sortable: false },
    suppressCellFocus: true,
    suppressMovableColumns: true,
    getRowHeight: (p: any) => p.data?.comentario ? undefined : 22,
  };

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
    rowClassRules: {
      'locked-row': (p: any) => !!p.data?.locked,
    },
  };

  // ── Init ──────────────────────────────────────────────────────────────────

  agInit(params: any) {
    this.idMolienda  = params?.data?.id ?? null;
    this.matPrimaId  = params?.data?.matPrima ?? null;
    this.rowBranchId = params?.data?.sucursal ?? null;
    const opts: { id: number; name: string }[] = params?.context?.articuloOptions ?? [];
    this.matPrimaName = opts.find(o => o.id === this.matPrimaId)?.name ?? '';
    this.init();
  
    this.cdr.detectChanges();}

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
      const [catalogs, prefijosData, matData, branchesData] = await Promise.all([
        lastValueFrom(this.catalogService.getAll(idCompany)),
        lastValueFrom(this.productionService.getMoliendaPrefijos(idCompany)),
        lastValueFrom(this.mxmService.getByType(idCompany, 'MOLIENDA')),
        lastValueFrom(this.branchsService.getBranches(idCompany)),
      ]);

      this.branchPrefijoMap = new Map<number, string>(
        ((branchesData ?? []) as any[]).map((b: any) => [b.id as number, (b.prefix ?? '') as string])
      );

      // Mapa idPrefijoFase → prefijo string
      const fajePrefijoMap = new Map<number, string>(
        (prefijosData ?? []).map((p: any) => [p.id, p.prefijo ?? ''])
      );
      // Mapa idArticulo → prefijo del material
      const artPrefijoMap = new Map<number, string>(
        (matData ?? []).filter((m: any) => m.idArticulo != null)
          .map((m: any) => [m.idArticulo, m.prefijo ?? ''])
      );

      const botesCatalog = (catalogs ?? []).find(c => {
        const d = (c.description || '').trim().toLowerCase()
          .normalize('NFD').replace(/[̀-ͯ]/g, '');
        return d.startsWith('botes molienda') || d.startsWith('botes');
      });
      if (!botesCatalog) return;

      const items = await lastValueFrom(this.mxmService.getByCatalog(idCompany, botesCatalog.id));
      const allActive = (items ?? [])
        .filter((m: any) => m.active !== false)
        .sort((a: any, b: any) => (a.id ?? 0) - (b.id ?? 0));

      const moFaseId = (prefijosData ?? []).find((p: any) => p.prefijo === 'MO')?.id ?? null;

      const sorted = allActive
        .filter((m: any) => {
          if (moFaseId != null && m.idPrefijoFase !== moFaseId) return false;
          if (this.matPrimaId  != null && m.idMatPrima  !== this.matPrimaId)  return false;
          if (this.rowBranchId != null && m.idBranch    !== this.rowBranchId) return false;
          return true;
        });

      this.boteOptions = sorted.map((item: any) => {
        const fasePrefijo = item.idPrefijoFase != null ? (fajePrefijoMap.get(item.idPrefijoFase) ?? '') : '';
        const artPrefijo  = item.idMatPrima    != null ? (artPrefijoMap.get(item.idMatPrima)     ?? '') : '';
        const branchPref  = item.idBranch      != null ? (this.branchPrefijoMap.get(item.idBranch) ?? '') : '';
        const year     = String(item.anio ?? new Date().getFullYear()).slice(-2);
        const num      = item.numBote  ?? '';
        const contador = item.contador ?? 1;
        return {
          id: item.id,
          description: `${branchPref}${fasePrefijo}${artPrefijo}${year}/${item.cantidad ?? ''}-${num}/${contador}`,
          volumen: Number(item.cantidad ?? 0),
        };
      });
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

    // Jugo ya distribuido en TODOS los botes de esta fila
    const totalAsignadoEnFila = row.botes.reduce((s, b) => s + b.cantidad, 0);
    const jugoRestante = Math.max(0, (row.jugo ?? 0) - totalAsignadoEnFila);

    this.modalEntries = this.boteOptions.map(opt => {
      const asignacion = row.botes.find(b => b.idBoteCatalog === opt.id) ?? null;
      // Espacio utilizado por otros (excluye la asignación de ESTA fila)
      const totalUsed = this.usageMap[opt.id] ?? 0;
      const externo   = totalUsed - (asignacion?.cantidad ?? 0);
      const disponible = opt.volumen - externo;
      const lleno      = disponible <= 0;

      // Ocultar: bote lleno sin asignación, o sin jugo restante sin asignación
      if ((lleno || jugoRestante <= 0) && asignacion === null) return null;

      return {
        opt,
        espacioUtilizadoExterno: externo,
        asignacion,
        inputValue: asignacion?.cantidad ?? null,
        lleno,
      } as ModalEntry;
    }).filter((e): e is ModalEntry => e !== null);

    this.modalValidationMsg = '';
    this.modalLocked    = row.locked;
    this.lockedViewMode = row.locked;
    // En modo bloqueado solo mostramos botes con jugo efectivamente asignado
    if (row.locked) {
      this.modalEntries = this.modalEntries.filter(e => e.asignacion !== null && (e.asignacion.cantidad ?? 0) > 0);
    }
    this.modalOpen = true;
  }

  async onLockCheckboxClick(event: Event) {
    event.preventDefault(); // No cambiar visualmente hasta confirmar
    const confirm = await alerts.confirmAlert(
      'Bloquear asignación',
      '¿Confirmas bloquear los cambios de esta asignación?<br>Una vez bloqueada no podrá modificarse.',
      'warning',
      'Sí, bloquear'
    );
    if (!confirm.isConfirmed) return;
    await this.onLockChange(true);
    await this.doConfirmLock();
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
      this.modalLocked = !locked;
    }
  }

  selectEntry(entry: ModalEntry) {
    if ((entry.lleno && entry.asignacion === null) || this.modalLocked) return;
    if (entry.asignacion === null) {
      const totalAsignado = (this.modalRow?.botes ?? []).reduce((s, b) => s + b.cantidad, 0);
      if (totalAsignado >= (this.modalRow?.jugo ?? 0)) return;
    }
    // Guardamos el total actual como base; el input arranca vacío (nueva adición)
    this.selectedEntryOriginalValue = entry.inputValue ?? 0;
    entry.inputValue = null;
    this.selectedEntry = entry;
    this.selectedEntryHistorial = [];
    this.entryComentario = '';
    if (entry.asignacion?.id) {
      lastValueFrom(this.productionService.getMoliendaBoteHistorialByBote(entry.asignacion.id))
        .then(h => this.selectedEntryHistorial = h ?? [])
        .catch(() => {});
    }
  }

  async confirmEntry() {
    if (!this.selectedEntry || !this.modalRow) return;
    const entry   = this.selectedEntry;
    const newVal  = Number(entry.inputValue) || 0;
    const usuario = this.signalsService.getDisplayName()() ?? '';

    // newVal = adición nueva; newTotal = lo que quedará en DB
    const existingTotal = Number(this.selectedEntryOriginalValue) || 0;
    const newTotal = existingTotal + newVal;

    // Validar capacidad del bote
    const capacidadParaEstaFila = entry.opt.volumen - entry.espacioUtilizadoExterno;
    if (newTotal > capacidadParaEstaFila) {
      this.modalValidationMsg =
        `Excede la capacidad del bote: máximo ${capacidadParaEstaFila.toFixed(0)} L (ya asignado: ${existingTotal.toFixed(0)} L).`;
      return;
    }

    // Validar jugo disponible de la fila
    const jugoRow = this.modalRow.jugo ?? 0;
    const asignadoEnOtros = this.modalRow.botes
      .filter(b => b.idBoteCatalog !== entry.opt.id)
      .reduce((s, b) => s + b.cantidad, 0);
    if (asignadoEnOtros + newTotal > jugoRow) {
      const disponibleParaEste = Math.max(0, jugoRow - asignadoEnOtros - existingTotal);
      this.modalValidationMsg =
        `Solo quedan ${disponibleParaEste.toFixed(0)} L de jugo disponibles en esta fila.`;
      return;
    }

    this.modalValidationMsg = '';

    // Confirmar con el usuario
    const confirmAdd = await alerts.confirmAlert(
      'Confirmar asignación',
      `¿Confirmas agregar <strong>${newVal.toFixed(0)} L</strong> al bote <strong>${entry.opt.description}</strong>?<br>Total quedará en <strong>${newTotal.toFixed(0)} L</strong>.`,
      'question',
      'Sí, confirmar'
    );
    if (!confirmAdd.isConfirmed) return;

    // Guardar bote (crear/patch)
    try {
      if (newVal > 0) {
        if (entry.asignacion === null) {
          const created = await lastValueFrom(
            this.productionService.createMoliendaBote({
              idMatDetalle: this.modalRow.id,
              idBoteCatalog: entry.opt.id,
              cantidad: newTotal,
            })
          );
          entry.asignacion = { id: created.id, idBoteCatalog: entry.opt.id, cantidad: newTotal };
          this.modalRow.botes.push(entry.asignacion);
        } else {
          await lastValueFrom(this.productionService.patchMoliendaBoteCantidad(entry.asignacion.id, newTotal));
          entry.asignacion.cantidad = newTotal;
          const b = this.modalRow.botes.find(b => b.id === entry.asignacion!.id);
          if (b) b.cantidad = newTotal;
        }

        // Historial: registrar solo la adición nueva
        await lastValueFrom(this.productionService.createMoliendaBoteHistorial({
          idMoliendaBote: entry.asignacion!.id,
          cantidad: newVal,
          usuario,
          comentario: this.entryComentario.trim() || undefined,
        }));
      }
    } catch (e) {
      console.error('Error guardando bote:', e);
    }

    // Restaurar inputValue al nuevo total para visualización
    entry.inputValue = newTotal > 0 ? newTotal : null;

    // Recalcular resta en la fila
    const volAsignado = this.modalRow.botes.reduce((s, b) => s + b.cantidad, 0);
    this.modalRow.resta = this.modalRow.jugo != null ? this.modalRow.jugo - volAsignado : null;
    this.modalRow.boteDisplay = this.buildBoteDisplay(this.modalRow.botes);
    if (this.gridApi && !this.gridApi.isDestroyed()) {
      const node = this.gridApi.getRowNode(String(this.modalRow.id));
      if (node) { node.setData({ ...this.modalRow }); this.gridApi.refreshCells({ rowNodes: [node], force: true }); }
    }

    this.selectedEntry = null;
    this.selectedEntryOriginalValue = null;
    this.selectedEntryHistorial = [];
    this.entryComentario = '';
    this.onInputChange();

    // Si resta = 0, preguntar por bloqueo
    if (this.modalRow.resta === 0 && !this.modalRow.locked) {
      this.showLockPrompt = true;
    }
  }

  cancelEntry() {
    if (this.selectedEntry) {
      this.selectedEntry.inputValue = this.selectedEntryOriginalValue;
    }
    this.selectedEntry = null;
    this.selectedEntryOriginalValue = null;
    this.selectedEntryHistorial = [];
    this.entryComentario = '';
    this.retiroMode  = false;
    this.retiroValue = null;
    this.retiroComent = '';
    this.onInputChange();
  }

  async confirmRetiro(entry: ModalEntry) {
    if (!entry.asignacion || !this.retiroValue || !this.retiroComent.trim() || !this.modalRow) return;

    const amount       = Math.abs(Number(this.retiroValue));
    const existingTotal = Number(entry.asignacion.cantidad) || 0;
    const newTotal      = existingTotal - amount;

    if (newTotal < 0) {
      this.modalValidationMsg = `No puedes retirar más de ${existingTotal.toFixed(0)} L asignados.`;
      return;
    }
    this.modalValidationMsg = '';

    // Confirmar con el usuario
    const confirmRet = await alerts.confirmAlert(
      'Confirmar retiro',
      `¿Confirmas retirar <strong>${amount.toFixed(0)} L</strong> del bote <strong>${entry.opt.description}</strong>?<br>Motivo: <em>${this.retiroComent}</em>`,
      'warning',
      'Sí, retirar'
    );
    if (!confirmRet.isConfirmed) return;

    const usuario = this.signalsService.getDisplayName()() ?? '';

    try {
      await lastValueFrom(this.productionService.patchMoliendaBoteCantidad(entry.asignacion.id, newTotal));
      entry.asignacion.cantidad = newTotal;

      await lastValueFrom(this.productionService.createMoliendaBoteHistorial({
        idMoliendaBote: entry.asignacion.id,
        cantidad: -amount,          // negativo = retiro
        usuario,
        comentario: this.retiroComent.trim(),
      }));

      // Recargar historial del panel
      this.selectedEntryHistorial = await lastValueFrom(
        this.productionService.getMoliendaBoteHistorialByBote(entry.asignacion.id)
      );

      // Actualizar inputValue visual
      entry.inputValue = newTotal > 0 ? newTotal : null;

      // Recalcular bote en la fila
      const b = this.modalRow.botes.find(b => b.id === entry.asignacion!.id);
      if (b) b.cantidad = newTotal;
      const volAsignado = this.modalRow.botes.reduce((s, b) => s + b.cantidad, 0);
      this.modalRow.resta       = this.modalRow.jugo != null ? this.modalRow.jugo - volAsignado : null;
      this.modalRow.boteDisplay = this.buildBoteDisplay(this.modalRow.botes);
      if (this.gridApi && !this.gridApi.isDestroyed()) {
        const node = this.gridApi.getRowNode(String(this.modalRow.id));
        if (node) { node.setData({ ...this.modalRow }); this.gridApi.refreshCells({ rowNodes: [node], force: true }); }
      }

      // Salir del modo retiro pero mantener el bote seleccionado (para ver historial)
      this.retiroMode   = false;
      this.retiroValue  = null;
      this.retiroComent = '';
      this.selectedEntry = null;
      this.selectedEntryOriginalValue = null;
      this.onInputChange();
    } catch (e) {
      console.error('Error retirando jugo:', e);
      this.modalValidationMsg = 'Error al retirar jugo.';
    }
  }

  async confirmLock() {
    const confirm = await alerts.confirmAlert(
      'Bloquear asignación',
      '¿Confirmas bloquear los cambios de esta asignación?<br>Una vez bloqueada no podrá modificarse.',
      'warning',
      'Sí, bloquear'
    );
    if (!confirm.isConfirmed) return;

    this.showLockPrompt = false;
    await this.onLockChange(true);
    await this.doConfirmLock();
  }

  private async doConfirmLock() {
    // Cancelar edición activa si la hay
    if (this.selectedEntry) {
      this.selectedEntry.inputValue   = this.selectedEntryOriginalValue;
      this.selectedEntry              = null;
      this.selectedEntryOriginalValue = null;
      this.selectedEntryHistorial     = [];
      this.entryComentario            = '';
      this.retiroMode                 = false;
      this.retiroValue                = null;
      this.retiroComent               = '';
    }

    // Cambiar a vista bloqueada
    this.modalLocked    = true;
    this.lockedViewMode = true;
    this.modalEntries   = this.modalEntries.filter(e => e.asignacion !== null && (e.asignacion.cantidad ?? 0) > 0);
  }

  dismissLock() {
    this.showLockPrompt = false;
  }

  closeModal() {
    this.modalOpen              = false;
    this.modalLocked            = false;
    this.lockedViewMode         = false;
    this.modalRow               = null;
    this.saving                 = false;
    this.modalEntries           = [];
    this.selectedEntry          = null;
    this.selectedEntryHistorial = [];
    this.showLockPrompt         = false;
  }

  selectLockedEntry(entry: ModalEntry) {
    if (this.selectedEntry === entry) {
      this.selectedEntry          = null;
      this.selectedEntryHistorial = [];
      return;
    }
    this.selectedEntry          = entry;
    this.selectedEntryHistorial = [];
    if (entry.asignacion?.id) {
      lastValueFrom(this.productionService.getMoliendaBoteHistorialByBote(entry.asignacion.id))
        .then(h => this.selectedEntryHistorial = h ?? [])
        .catch(() => {});
    }
  }

  maxInput(entry: ModalEntry): number {
    // Espacio en el bote disponible para nuevas adiciones de esta fila
    const capacidadParaEstaFila = entry.opt.volumen - entry.espacioUtilizadoExterno;
    const yaAsignado = Number(this.selectedEntryOriginalValue) || 0;
    const espacioEnBote = Math.max(0, capacidadParaEstaFila - yaAsignado);

    // Jugo disponible: total - lo ya distribuido en OTROS botes - lo ya guardado en este
    const jugoRow = this.modalRow?.jugo ?? 0;
    const asignadoEnOtros = (this.modalRow?.botes ?? [])
      .filter(b => b.idBoteCatalog !== entry.opt.id)
      .reduce((s, b) => s + b.cantidad, 0);
    const jugoDisponible = Math.max(0, jugoRow - asignadoEnOtros - yaAsignado);

    return Math.min(espacioEnBote, jugoDisponible);
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

  // Retorna el total "base" para visualización: si está en modo edición usa el valor previo guardado
  baseMine(entry: ModalEntry): number {
    if (!this.lockedViewMode && this.selectedEntry === entry) {
      // En edición: mostrar lo ya guardado (base) antes de la nueva adición
      return Number(this.selectedEntryOriginalValue) || 0;
    }
    // Fuera de edición: usar siempre el valor confirmado en BD
    return Number(entry.asignacion?.cantidad) || 0;
  }

  disponible(entry: ModalEntry): number {
    const mine = this.baseMine(entry) + (this.selectedEntry === entry ? Number(entry.inputValue) || 0 : 0);
    return Math.max(0, entry.opt.volumen - entry.espacioUtilizadoExterno - mine);
  }

  fillPct(used: number, total: number): number {
    if (!total) return 0;
    return Math.min(100, Math.max(0, (used / total) * 100));
  }

  totalFillPct(entry: ModalEntry): number {
    const used = entry.espacioUtilizadoExterno + (Number(entry.inputValue) || 0);
    return this.fillPct(used, entry.opt.volumen);
  }

  private sortRows() {
    this.rowData.sort((a, b) => {
      const aPos = (a.resta ?? 0) > 0 ? 0 : 1;
      const bPos = (b.resta ?? 0) > 0 ? 0 : 1;
      if (aPos !== bPos) return aPos - bPos;
      return (a.fecha ?? '').localeCompare(b.fecha ?? '');
    });
  }

  private buildBoteDisplay(botes: BoteAsignacion[]): string {
    const activos = botes.filter(b => (b.cantidad ?? 0) > 0);
    if (!activos.length) return '';
    return activos
      .map(b => {
        const opt = this.boteOptions.find(o => o.id === b.idBoteCatalog);
        return opt ? `${opt.description} (${b.cantidad})` : `#${b.idBoteCatalog}`;
      })
      .join(', ');
  }
}
