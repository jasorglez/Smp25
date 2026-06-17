import { Component, inject, ChangeDetectorRef} from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { lastValueFrom, Observable, Subscription, take } from 'rxjs';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { MoliendaService } from '../../../../../services/molienda.service';
import { OcAndReqsService } from '../../../../../services/ocandreqs.service';
import { CustomersService } from '../../../../../services/customers.service';
import { SignalsService } from '../../../../../services/signals.service';
import { TrackingService } from '../../../../../services/tracking.service';
import { EntradaMoliendaService, EntradaMolienda, EntradaResumen } from '../../../../../services/entrada-molienda.service';
import { DatosExternosMoliendaService, DatosExternosMolienda } from '../../../../../services/datos-externos-molienda.service';
import { SetupService } from 'app/services/setup.service';
import { EntregaOc, EntregaOcService } from '../../../../../services/entrega-oc.service';
import { CaracteristicasEntradaService } from '../../../../../services/caracteristicas-entrada.service';
import { CaracteristicasMateriaPrimaService } from 'app/services/caracteristicas-materia-prima.service';
import { RevisionCaracteristicasEntradaService, RevisionCaracteristicaEntrada } from 'app/services/revision-caracteristicas-entrada.service';
import { EmployeesService } from 'app/services/employees.service';
import { SalidasMpService } from 'app/services/salidas-mp.service';
import { FormsModule } from '@angular/forms';
import { IntandoutDocumentsService } from 'app/services/intandoutDocuments.service';
import { EntradaDocumentsOverlayService } from 'app/services/entrada-documents-overlay.service';
import { alerts } from 'app/helpers/alerts';
import { PrefixSetupService } from 'app/services/prefix-setup.service';
import { ProductionService } from 'app/services/production.service';
import { ExtractionFermentationCatalogService } from 'app/services/extraction-fermentation-catalog.service';
import { MaterialXModuloService } from 'app/services/materialxmodulo.service';
import { Router } from '@angular/router';
import { DetailEntradaDocumentsComponent } from './detail-entrada-documents/detail-entrada-documents.component';
import { CustomOcTooltipComponent } from './custom-oc-tooltip.component';
import { StyledTooltipComponent } from 'app/shared/styled-tooltip/styled-tooltip.component';

interface ReqOption {
  id: number;
  folio: string;
  cantidadReq: number;
  numCantidadOc: number;
}

@Component({
  selector: 'app-detalle-almmolienda',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridAngular],
  template: `
    <div style="padding: 6px; height: 100%; display: flex; flex-direction: column; box-sizing: border-box; overflow: hidden;"
         [style.backgroundColor]="detailType === 'entradas' ? '#e8f5e9' : '#fce4ec'">

      <!-- Título -->
      <div style="margin-bottom: 4px; flex-shrink: 0;">
        <strong style="font-size: 0.85rem;">{{ detailType === 'entradas' ? 'Entradas' : 'Salidas' }}</strong>
      </div>

      <!-- Grid nivel 2 (requisiciones) -->
      <div [style.flex]="selectedReqRow ? '0 0 58px' : '1 1 auto'"
           style="min-height: 58px; position: relative; overflow: hidden;">
        <ag-grid-angular
          class="ag-theme-quartz small-text-ag-grid"
          [rowData]="rowData"
          [columnDefs]="colDefs"
          [gridOptions]="gridOptions"
          [localeText]="localeText"
          (gridReady)="onGridReady($event)"
          (firstDataRendered)="onFirstDataRenderedReq($event)"
          (cellClicked)="onCellClicked($event)"
          style="width: 100%; height: 100%; position: absolute; top: 0; left: 0; right: 0; bottom: 0;">
        </ag-grid-angular>
      </div>

      <!-- Cascade 3–4: OCs + entradas por OC -->
      <div *ngIf="selectedReqRow"
           style="flex: 1 1 auto; min-height: 0; border-top: 2px solid #1565c0; background: #e3f2fd;
                  padding: 4px; display: flex; flex-direction: column; overflow: hidden;">
        <div style="font-size: 0.78rem; font-weight: bold; color: #1565c0; margin-bottom: 3px; flex-shrink: 0;">
          OC de {{ selectedReqRow.folio }}
        </div>

        <div [style.flex]="(selectedOcRow || selectedOcMultiRow) ? '0 0 74px' : '1 1 auto'"
             style="min-height: 58px; position: relative; overflow: hidden;">
          <ag-grid-angular
            class="ag-theme-quartz small-text-ag-grid"
            [rowData]="cascadeOcData"
            [columnDefs]="cascadeOcColDefs"
            [gridOptions]="cascadeOcGridOptions"
            (gridReady)="onCascadeOcGridReady($event)"
            (firstDataRendered)="onFirstDataRenderedOc($event)"
            (cellClicked)="onCascadeOcCellClicked($event)"
            style="width: 100%; height: 100%; position: absolute; top: 0; left: 0; right: 0; bottom: 0;">
          </ag-grid-angular>
        </div>

        <!-- Acordeón nivel 4 (múltiples entregas, diasCondicionCompra ≠ 1): Detalle de entregas -->
        <div *ngIf="selectedOcMultiRow"
             [style.flex]="selectedMultiEntregaCaratRow ? '0 0 112px' : '1 1 auto'"
             style="min-height: 0; border-top: 2px solid #2e7d32; background: #f1f8e9;
                    padding: 4px; display: flex; flex-direction: column; overflow: hidden;">
          <div style="display: flex; align-items: center; margin-bottom: 3px; flex-shrink: 0;">
            <span style="font-size: 0.78rem; font-weight: bold; color: #2e7d32;">
              Detalle de {{ materialNombre || selectedOcMultiRow.folio }}
            </span>
          </div>
          <div [style.flex]="selectedMultiEntregaCaratRow ? '0 0 74px' : '1 1 auto'"
               style="min-height: 58px; position: relative; overflow: hidden;">
            <ag-grid-angular
              class="ag-theme-quartz small-text-ag-grid"
              [rowData]="multiEntregasData"
              [columnDefs]="multiEntregasColDefs"
              [gridOptions]="multiEntregasGridOptions"
              (gridReady)="onMultiEntregasGridReady($event)"
              (cellClicked)="onMultiEntregaCellClicked($event)"
              style="width: 100%; height: 100%; position: absolute; top: 0; left: 0; right: 0; bottom: 0;">
            </ag-grid-angular>
          </div>
        </div>

        <div *ngIf="selectedOcRow"
             style="flex: 0 0 400px; min-height: 0; border-top: 2px solid #0d47a1; background: #eceff1;
                    padding: 4px; display: flex; flex-direction: column; overflow: hidden;">
          <!-- Título + Botones CRUD Entradas -->
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-bottom: 3px; flex-shrink: 0;">
            <div style="font-size: 0.76rem; font-weight: bold; color: #0d47a1;">
              Entradas — {{ selectedOcRow.folio }}
            </div>
            <div style="display: flex; gap: 4px; flex-shrink: 0;">
              <button *ngIf="selectedOcRow?.type !== 'CR' && !selectedOcMultiRow" class="btn btn-sm btn-success" (click)="addEntrada()" [disabled]="!nivel4GridApi || selectedOcRow?.close === true || selectedMultiEntregaIsClosed" title="Agregar entrada" style="padding: 2px 8px; font-size: 0.7rem;">
                <i class="bi bi-plus-lg" style="margin-right: 2px; font-size: 0.7rem;"></i>Agregar
              </button>
              <button class="btn btn-sm btn-primary position-relative" (click)="saveEntradas()" [disabled]="!(hasUnsavedChangesEntradas || hasUnsavedChangesCaracteristicas) || selectedOcRow?.close === true || selectedMultiEntregaIsClosed" title="Guardar cambios" style="padding: 2px 8px; font-size: 0.7rem;">
                <i class="bi bi-floppy" style="margin-right: 2px; font-size: 0.7rem;"></i>Guardar
                <span *ngIf="hasUnsavedChangesEntradas || hasUnsavedChangesCaracteristicas"
                      class="position-absolute top-0 start-100 translate-middle p-2 bg-danger border border-light rounded-circle"
                      style="width: 10px; height: 10px; padding: 0 !important;">
                </span>
              </button>
              <button class="btn btn-sm btn-warning" (click)="revertEntradas()" [disabled]="selectedOcRow?.close === true || selectedMultiEntregaIsClosed" title="Deshacer cambios" style="padding: 2px 8px; font-size: 0.7rem;">
                <i class="bi bi-arrow-clockwise" style="margin-right: 2px; font-size: 0.7rem;"></i>Deshacer
              </button>
              <button class="btn btn-sm btn-danger" (click)="deleteEntrada()" [disabled]="!selectedEntradaRow || selectedOcRow?.close === true || selectedMultiEntregaIsClosed" title="Eliminar entrada" style="padding: 2px 8px; font-size: 0.7rem;">
                <i class="bi bi-trash" style="margin-right: 2px; font-size: 0.7rem;"></i>Eliminar
              </button>
            </div>
          </div>
          <div [style.flex]="(selectedEntradaCaratRow || selectedEntradaDatosRow) ? '0 0 85px' : '1 1 auto'"
               style="min-height: 58px; position: relative; overflow: hidden;">
            <ag-grid-angular
              class="ag-theme-quartz small-text-ag-grid"
              [rowData]="cascadeEntradaData"
              [columnDefs]="nivel4ColDefs"
              [gridOptions]="nivel4GridOptions"
              (gridReady)="onNivel4GridReady($event)"
              (firstDataRendered)="onFirstDataRenderedEntrada($event)"
              style="width: 100%; height: 100%; position: absolute; top: 0; left: 0; right: 0; bottom: 0;">
            </ag-grid-angular>
          </div>

          <!-- Level 5: Datos externos (versión gasto: lotes por entrada) -->
          <div *ngIf="selectedEntradaDatosRow"
               style="flex: 0 0 135px; min-height: 0; border-top: 2px solid #2e7d32; background: #e8f5e9;
                      padding: 4px; display: flex; flex-direction: column; overflow: hidden;">
            <div style="margin-bottom: 3px; flex-shrink: 0;">
              <span style="font-size: 0.76rem; font-weight: bold; color: #2e7d32;">
                Datos externos — Entrada {{ selectedEntradaDatosRow.idEntrada || 'nueva' }}
              </span>
            </div>
            <div style="flex: 1 1 auto; min-height: 0; position: relative; overflow: hidden;">
              <ag-grid-angular
                class="ag-theme-quartz small-text-ag-grid"
                [rowData]="cascadeDatosData"
                [columnDefs]="datosExternosColDefs"
                [gridOptions]="datosExternosGridOptions"
                (gridReady)="onDatosExternosGridReady($event)"
                style="width: 100%; height: 100%; position: absolute; top: 0; left: 0; right: 0; bottom: 0;">
              </ag-grid-angular>
            </div>
          </div>

          <!-- Level 5: Características — Entrada (2 pestañas) -->
          <div *ngIf="selectedEntradaCaratRow"
               style="flex: 0 0 150px; min-height: 0; border-top: 2px solid #558b2f; background: #f1f8e9;
                      padding: 4px; display: flex; flex-direction: column; overflow: hidden;">
            <!-- Encabezado: título + pestañas + revisor -->
            <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:4px; flex-shrink:0;">
              <div style="display:flex; align-items:center; gap:6px;">
                <span style="font-size: 0.76rem; font-weight: bold; color: #558b2f;">
                  Características — Entrada {{ selectedEntradaCaratRow.idEntrada }}
                </span>
                <button type="button" (click)="caractActiveTab = 'mp'"
                        [style.background]="caractActiveTab === 'mp' ? '#2e7d32' : '#e0e0e0'"
                        [style.color]="caractActiveTab === 'mp' ? '#fff' : '#555'"
                        style="border:0; border-radius:4px; padding:2px 8px; font-size:0.7rem; font-weight:600; cursor:pointer;">
                  Características de materia prima
                </button>
                <button type="button" *ngIf="hasOrganolepticas" (click)="caractActiveTab = 'organolepticas'"
                        [style.background]="caractActiveTab === 'organolepticas' ? '#2e7d32' : '#e0e0e0'"
                        [style.color]="caractActiveTab === 'organolepticas' ? '#fff' : '#555'"
                        style="border:0; border-radius:4px; padding:2px 8px; font-size:0.7rem; font-weight:600; cursor:pointer;">
                  Características organolépticas
                </button>
              </div>
              <div *ngIf="caractActiveTab === 'mp'" style="display:flex; align-items:center; gap:4px;">
                <span style="font-size:0.7rem; color:#37474f; font-weight:600;">Revisó:</span>
                <select [(ngModel)]="selectedRevisorId" (ngModelChange)="onRevisorChange()"
                        [disabled]="selectedOcRow?.close || selectedMultiEntregaIsClosed"
                        style="padding:2px 6px; border:1px solid #b0bec5; border-radius:4px; font-size:0.72rem; max-width:220px;">
                  <option [ngValue]="null">— Selecciona —</option>
                  <option *ngFor="let e of revisorOptions" [ngValue]="e.id">{{ e.name }}</option>
                </select>
              </div>
            </div>

            <!-- Pestaña: Características de materia prima -->
            <div *ngIf="caractActiveTab === 'mp'" style="flex: 1 1 auto; min-height: 0; position: relative; overflow: hidden;">
              <div *ngIf="!cascadeMpCaractData.length"
                   style="padding:6px; font-size:0.74rem; color:#6b7280;">
                Este material no tiene características activas registradas en Materia Prima.
              </div>
              <ag-grid-angular *ngIf="cascadeMpCaractData.length"
                class="ag-theme-quartz small-text-ag-grid"
                [rowData]="cascadeMpCaractData"
                [columnDefs]="mpCaractColDefs"
                [gridOptions]="mpCaractGridOptions"
                (gridReady)="onMpCaractGridReady($event)"
                style="width: 100%; height: 100%; position: absolute; top: 0; left: 0; right: 0; bottom: 0;">
              </ag-grid-angular>
            </div>

            <!-- Pestaña: Características organolépticas (dinámica existente) -->
            <div *ngIf="caractActiveTab === 'organolepticas'" style="flex: 1 1 auto; min-height: 0; position: relative; overflow: hidden;">
              <ag-grid-angular
                class="ag-theme-quartz small-text-ag-grid"
                [rowData]="cascadeCaratData"
                [columnDefs]="nivel5ColDefs"
                [gridOptions]="nivel5GridOptions"
                (gridReady)="onNivel5GridReady($event)"
                style="width: 100%; height: 100%; position: absolute; top: 0; left: 0; right: 0; bottom: 0;">
              </ag-grid-angular>
            </div>
          </div>
        </div>
      </div>

    </div>

  `,
  styles: [`
    :host { display: block; height: 100%; overflow: hidden; }
    :host ::ng-deep .selected-oc-highlight { background-color: #bbdefb !important; }
    :host ::ng-deep .multi-entrega-locked { opacity: 0.4; pointer-events: none; }
    :host ::ng-deep .multi-entrega-closed { background-color: #eceff1 !important; color: #607d8b !important; }
    :host ::ng-deep .multi-entrega-closed .ag-cell { color: #607d8b !important; }
  `]
})
export class DetalleMoliendaComponent {
  private moliendaService = inject(MoliendaService);
  private readonly cdr = inject(ChangeDetectorRef);
  private ocAndReqsService = inject(OcAndReqsService);
  private customersService = inject(CustomersService);
  private signalsService = inject(SignalsService);
  private trackingService = inject(TrackingService);
  private entradaService = inject(EntradaMoliendaService);
  private datosExternosService = inject(DatosExternosMoliendaService);
  private setupService = inject(SetupService);
  private ivaPercent = 0;   // IVA% de la sucursal (setup almacén); precio guardado = BASE (Opción B)
  private entregaOcService = inject(EntregaOcService);
  private caracteristicasService = inject(CaracteristicasEntradaService);
  private caracteristicasMpService = inject(CaracteristicasMateriaPrimaService);
  private revisionService = inject(RevisionCaracteristicasEntradaService);
  private employeesService = inject(EmployeesService);
  private salidasMpService = inject(SalidasMpService);
  private intandoutDocumentsService = inject(IntandoutDocumentsService);
  private entradaDocumentsOverlayService = inject(EntradaDocumentsOverlayService);
  private prefixSetupService = inject(PrefixSetupService);
  private productionService = inject(ProductionService);
  private catalogService = inject(ExtractionFermentationCatalogService);
  private mxmService = inject(MaterialXModuloService);
  private router = inject(Router);
  // Prefijo "Identificador Entregas" de la sucursal (config Órdenes de Compra). Se usa
  // para armar el Folio de entrega: {folioOC}-{prefixEntrega}{N}. Vacío = sin sufijo.
  private prefixEntrega = '';

  private internalParams: any;
  private gridApi!: GridApi;
  private cascadeOcGridApi!: GridApi;
  nivel4GridApi!: GridApi;
  private nivel5GridApi!: GridApi;
  private countSub?: Subscription;
  private entradasDataSub?: Subscription;
  private deptsCsv: string = '';
  private initCompleted = false;
  private providersMap: Map<number, string> | null = null;
  private boteDescMap: Map<number, string> | null = null;

  detailType: 'entradas' | 'salidas' = 'entradas';
  entradasSimple = false;
  readonly localeText = AG_GRID_LOCALE_ES;
  rowData: any[] = [];
  reqOptions: ReqOption[] = [];

  selectedReqRow: any = null;
  cascadeOcData: any[] = [];
  selectedOcRow: any = null;
  selectedOcMultiRow: any = null;
  multiEntregasData: any[] = [];
  private multiEntregasGridApi!: GridApi;
  selectedMultiEntregaCaratRow: any = null;
  selectedMultiEntregaIsClosed = false;
  cascadeEntradaData: any[] = [];
  private originalCascadeEntradaData: any[] = [];
  hasUnsavedChangesEntradas = false;
  selectedEntradaRow: any = null;
  selectedEntradaCaratRow: any = null;
  cascadeCaratData: any[] = [];
  hasUnsavedChangesCaracteristicas = false;
  private originalCaracteristicasData: any[] = [];
  private existingCaratIds = new Map<number, number>(); // categoryId → recordId en BD
  // ── Características — Entrada con 2 pestañas ──
  caractActiveTab: 'mp' | 'organolepticas' = 'mp';
  cascadeMpCaractData: any[] = [];          // filas por característica (Característica/Revisó/Comentarios)
  private mpCaractGridApi!: GridApi;
  revisorOptions: { id: number; name: string }[] = [];   // empleados Extracción y Fermentación
  selectedRevisorId: number | null = null;  // revisor de la entrada (uno por entrada)
  /** ¿Este material tiene catálogo organoléptico? (caracteristicasCategories no vacío). */
  get hasOrganolepticas(): boolean {
    return Array.isArray(this.caracteristicasCategories) && this.caracteristicasCategories.length > 0;
  }
  // ── Nivel 5 "Datos externos" (versión gasto: lotes por entrada) ──
  selectedEntradaDatosRow: any = null;
  cascadeDatosData: any[] = [];
  private datosExternosGridApi!: GridApi;
  private editableEntradaColumnOrder = ['fechaRecepcion', 'bultos', 'revisionConfigu', 'comentario', 'liberacion'];
  private enterPressed = false;
  bultosCantidad: number | null = null;
  bultosCantidadARevisar: number | null = null;
  proporcionRevision: number | null = null;
  editBultos = false;
  caracteristicasCategories: any[] = [];
  caracteristicasFamilies: any[] = [];

  // ── Nivel 2: Requisiciones ────────────────────────────────────────
  colDefs: ColDef[] = [
    {
      headerName: '#',
      width: 45,
      valueGetter: (p) => (p.node?.rowIndex ?? 0) + 1,
      cellStyle: { fontWeight: 'bold' },
    },
    {
  field: 'folio',
  headerName: 'Folio / Req',
  width: 160,
  editable: false,

  cellRenderer: (params: any) => {
    const val = params.value ?? '';

    const div = document.createElement('div');

    div.style.cssText = val
      ? `
        cursor:pointer;
        color:#2e7d32;
        text-decoration:underline;
        font-weight:600;
      `
      : 'color:#999;';

    div.textContent = val || '—';

    return div;
  },
  cellStyle: {
    backgroundColor: '#e8f5e9'
  },
  tooltipValueGetter: (p: any) => p.data?.ocs || [],
  tooltipComponent: 'customOcTooltip'
},
    {
      field: 'cantidadReq',
      headerName: 'Cant Req',
      width: 150,
      editable: false,
      type: 'numericColumn',
      valueFormatter: (p: any) => {
        const req = Number(p.value ?? 0);
        const suma = Number(p.data?.__sumaCantidadRecibir ?? 0);
        if (suma > 0) return `${req} / ${suma}`;
        return String(req);
      },
      tooltipValueGetter: (p) => `Cantidad requisitada: ${p.value ?? 0}`,
    },
    {
      field: 'numCantidadOc',
      headerName: '# OC',
      width: 80,
      editable: false,
      type: 'numericColumn',
      tooltipValueGetter: (p) => `Órdenes de compra: ${p.value ?? 0}`,
    },
    {
      field: 'resta',
      headerName: 'Resta Requerimiento',
      width: 160,
      editable: false,
      type: 'numericColumn',
      valueGetter: (p) => p.data?.resta ?? 0,
    },
  ];

  gridOptions: any = {
    components: {
      customOcTooltip: CustomOcTooltipComponent
    },
    headerHeight: 25,
    rowHeight: 25,
    rowClassRules: {
      'new-row-highlight': (p: any) => !!p.data?.__isNew,
      'selected-row-highlight': (p: any) => p.data === this.selectedReqRow,
    },
    tooltipShowDelay: 300,
    popupParent: document.body,
    defaultColDef: { resizable: true, sortable: true, textAlign: 'center' },
    onFirstDataRendered: (params: any) => params.api.autoSizeAllColumns(),
  };

  // ── Nivel 3: OCs ──────────────────────────────────────────────────
  cascadeOcColDefs: ColDef[] = [
    {
      field: 'entregasCount',
      headerName: 'Cantidad Entregas',
      width: 140,
      editable: false,
      cellStyle: { backgroundColor: '#f8f9fa', fontWeight: '600' },
      // Espejo del mismo cálculo de la tabla "Ítems de OC-…" en purchaseorderdelison:
      // planned = diasCondicionCompra; real = entregasCount; muestra delta cuando hay entregas.
      valueFormatter: (p: any) => {
        // Multi-entrega (N definido), SIN importar el Tipo OC: muestra "cerradas / N"
        // (ej. 0/5, 1/5 … 5/5). N = total de entregas; cerradas = entregas con "Cerrado Entrega".
        const N = Number(p.data?.entregasPlaneadas ?? 0);
        if (N > 1) {
          const cerradas = Number(p.data?.entregasCerradas ?? 0);
          return `${cerradas}/${N}`;
        }
        // SIN LÍMITE / COMPRA INMEDIATA de una sola entrega: conteo real de recepciones (Nivel 4).
        const t = String(p.data?.tipoOc ?? '').toUpperCase();
        if (t === 'COMPRA AUTORIZADA SIN LIMITE' || t === 'COMPRA INMEDIATA') {
          return String(Number(p.data?.entradasCount ?? 0));
        }
        const planned = Number(p.data?.diasCondicionCompra ?? 0);
        const real = Number(p.data?.entregasCount ?? 0);
        if (real === 0) return String(planned);
        const delta = real - planned;
        if (delta > 0) return `${planned} + ${delta}`;
        if (delta < 0) return `${planned} - ${Math.abs(delta)}`;
        return String(planned);
      },
    },
    {
      field: 'tipoOc',
      headerName: 'Tipo Req',
      width: 200,
      editable: false,
      // Las compras rápidas (type='CR') se muestran como "Compra Rápida" en lugar del typeoc.
      valueFormatter: (p: any) => (p.data?.type === 'CR' ? 'Compra Rápida' : (p.value || '—')),
      tooltipValueGetter: (p: any) => (p.data?.type === 'CR' ? 'Compra Rápida' : (p.value || 'Sin tipo OC')),
    },
    {
      field: 'folio',
      headerName: 'Nomenclatura Req',
      width: 110,
      editable: false,
      cellStyle: (params: any) => {
        const isClosed = params.data?.close === true;
        return isClosed
          ? { color: '#b71c1c', backgroundColor: '#ffebee' } // Rojo oscuro sobre fondo rosado
          : { color: '#2e7d32', backgroundColor: '#e8f5e9' }; // Verde original
      },
      cellRenderer: (params: any) => {
        const val = params.value ?? '';
        const isClosed = params.data?.close === true;
        const isMulti = Number(params.data?.diasCondicionCompra ?? 0) > 1;
        const allEntradasClosed = params.data?.__allEntradasClosed === true;
        const color = isClosed ? '#b71c1c' : '#2e7d32';

        const div = document.createElement('div');
        div.style.cssText = `display:flex;align-items:center;gap:5px;${
          val ? `cursor:pointer;color:${color};text-decoration:underline;` : 'color:#999;'
        }`;

        let content = val || '—';
        if (isClosed) {
          content += ` <i class="bi bi-lock-fill" style="color:#b71c1c; font-size:0.85rem; flex-shrink:0;" title="Orden de Compra cerrada"></i>`;
        } else if (isMulti) {
          if (allEntradasClosed) {
            content += ` <i class="bi bi-lock-fill" style="color:#e65100; font-size:0.85rem; flex-shrink:0;" title="Todas las entregas cerradas"></i>`;
          } else {
            content += ` <i class="bi bi-unlock-fill" style="color:#f57c00; font-size:0.85rem; flex-shrink:0;" title="Entregas pendientes de cerrar"></i>`;
          }
        }

        div.innerHTML = content;
        return div;
      },
      tooltipValueGetter: (p) => {
        if (!p.data) return null;
        // Generar dinámicamente el tooltip con todas las propiedades del objeto OC (cascadeOcData)
        return Object.entries(p.data)
          .filter(([key, val]) => 
            val !== null && val !== undefined && val !== '' && 
            !['id', 'idRoot', 'idReference', 'active', 'type', 'resta', '__modified', '__isNew'].includes(key)
          )
          .map(([key, val]) => {
            const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
            return `${label}: ${val}`;
          })
          .join('\n');
      },
    },
    { field: 'proveedor', headerName: 'Proveedor', flex: 2, minWidth: 140 },
    {
      field: 'cantidad',
      headerName: 'Cantidad',
      width: 150,
      type: 'numericColumn',
      valueFormatter: (p: any) => {
        const qty = Number(p.value ?? 0);
        const suma = Number(p.data?.__sumaCantidadRecibir ?? 0);
        if (suma > 0) return `${qty} / ${suma}`;
        return String(qty);
      },
    },
    {
      field: 'price', headerName: 'Precio unitario', width: 130, type: 'numericColumn',
      // Fase 4: muestra el precio de la ÚLTIMA entrada PAGADA (ya convertido a MXN); si ninguna está
      // pagada, el precio original. El tooltip lista el histórico de entradas (precio/total por entrada).
      valueGetter: (p: any) => this.nivel3PrecioCelda(p.data),
      valueFormatter: (p: any) => {
        const mon = this.ultimaEntradaPagada(p.data) ? 'MXN' : this.ocMonedaOriginal(p.data);
        return `${this.fmtMoneda(p.value)} ${mon}`;
      },
      tooltipComponent: StyledTooltipComponent,
      tooltipValueGetter: (p: any) => this.buildNivel3PrecioTooltip(p.data),
    },
    { field: 'condEspecial', headerName: 'Cond. Especial', flex: 2, minWidth: 130, hide: true },
    {
      field: 'cantidadMinimaRequerida',
      headerName: 'Cad. Mín. Requerida',
      flex: 2,
      minWidth: 150,
      valueFormatter: (p: any) => p.value ?? '—',
    },
    {
      field: 'fechaXEntrega',
      headerName: 'Fecha x Entrega',
      width: 130,
      valueFormatter: (p: any) => {
        if (!p.value) return '—';
        const iso = String(p.value).match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
        const d = new Date(p.value);
        return isNaN(d.getTime()) ? '—' : `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
      },
    },
    {
      field: 'resta', headerName: 'Resta OC', width: 90, type: 'numericColumn',
      cellStyle: { backgroundColor: '#fff9c4' }
    },
    {
      field: 'close',
      headerName: 'Cerrar OC',
      width: 100,
      editable: false,
      cellRenderer: (params: any) => {
        const planned = Number(params.data?.diasCondicionCompra ?? 0);
        if (planned > 1) {
          const span = document.createElement('span');
          span.style.cssText = 'display:block; text-align:center; color:#bdbdbd;';
          span.textContent = '—';
          return span;
        }
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'display:flex; justify-content:center; align-items:center; height:100%;';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = params.value === true;
        cb.disabled = params.value === true;
        cb.style.cursor = params.value === true ? 'not-allowed' : 'pointer';
        cb.addEventListener('change', () => {
          if (!cb.disabled) params.setValue(cb.checked);
        });
        wrapper.appendChild(cb);
        return wrapper;
      },
      onCellValueChanged: async (params: any) => {
        const oldValue = params.oldValue === true;
        const newValue = params.newValue === true;

        // Si ya estaba cerrada, forzamos que se mantenga cerrada (seguridad extra).
        // Mutación directa (no setDataValue) para no re-disparar onCellValueChanged.
        if (oldValue) {
          params.data.close = true;
          params.api.refreshCells({ rowNodes: [params.node], columns: ['close'], force: true });
          return;
        }

        // Si el usuario intentó desmarcar un checkbox que estaba en false, no hacemos nada
        if (!newValue) return;

        // Validar que existan entradas registradas antes de cerrar la OC.
        // Mutación directa al revertir (no setDataValue) para no re-disparar el handler.
        const idMaterial = this.internalParams?.data?.idMaterial;
        const entradas = idMaterial
          ? await lastValueFrom(this.entradaService.getByOcAndMaterial(params.data.id, idMaterial)).catch(() => [])
          : await lastValueFrom(this.entradaService.getByOc(params.data.id)).catch(() => []);
        if (!Array.isArray(entradas) || entradas.length === 0) {
          params.data.close = false;
          params.api.refreshCells({ rowNodes: [params.node], columns: ['close'], force: true });
          await alerts.basicAlert('Cerrar Orden de Compra', 'No se puede cerrar esta orden de compra porque aún no hay datos registrados.', 'warning');
          return;
        }

        // Validar que CADA entrada tenga "Datos externos" (lotes) capturados; si alguna está vacía
        // (null), no se permite cerrar la OC.
        const lotesPorEntrada = await Promise.all((entradas as any[]).map(async (e: any) => {
          const lotes = await lastValueFrom(this.datosExternosService.getByEntrada(e.id)).catch(() => []);
          return { id: e.id, count: Array.isArray(lotes) ? lotes.length : 0 };
        }));
        const sinDatos = lotesPorEntrada.filter(r => r.count === 0).map(r => r.id);
        if (sinDatos.length) {
          params.data.close = false;
          params.api.refreshCells({ rowNodes: [params.node], columns: ['close'], force: true });
          await alerts.basicAlert(
            'Cerrar Orden de Compra',
            `No se puede cerrar la OC: falta capturar Datos externos en la(s) entrada(s): ${sinDatos.join(', ')}.`,
            'warning'
          );
          return;
        }

        // Alerta si aún no se alcanza la cantidad objetivo. El umbral depende del Tipo OC:
        //  · SIN LÍMITE → cantidad REQUERIDA de la requisición (Nivel 2, cantidadReq).
        //  · otros tipos → "Cantidad" de la OC (por proveedor).
        const sumEntradas = (entradas as any[])
          .reduce((acc: number, e: any) => acc + Number(e?.cantidadEntrada ?? 0), 0);
        const esSinLimite = String(params.data?.tipoOc ?? '').toUpperCase() === 'COMPRA AUTORIZADA SIN LIMITE';
        const umbral = esSinLimite
          ? Number(this.selectedReqRow?.cantidadReq ?? 0)
          : Number(params.data?.cantidad ?? 0);
        const noAlcanza = umbral > 0 && sumEntradas < umbral;

        const confirm = await alerts.confirmAlert(
          'Cerrar Orden de Compra',
          noAlcanza
            ? `¿Está seguro de que quiere cerrar la OC "${params.data.folio}"? No ha llegado a la cantidad requerida del artículo (recibido ${sumEntradas} de ${umbral}).`
            : `¿Está seguro que desea cerrar la OC "${params.data.folio}"?`,
          noAlcanza ? 'warning' : 'question',
          'Sí, cerrar'
        );

        if (confirm.isConfirmed) {
          try {
            // CIERRE POR ARTÍCULO (no por OC): el artículo de 1 entrega se cierra creando/cerrando
            // SU entrega en entregas_oc (igual que multi-entrega), para NO bloquear los demás
            // artículos de la misma OC. ocandreq.close ya NO se toca aquí.
            const idDetail = Number(params.data.idDetail);
            const existing: any = await lastValueFrom(this.entregaOcService.getByDetail(idDetail)).catch(() => []);
            const ent = Array.isArray(existing) && existing.length > 0 ? existing[0] : null;
            if (ent && ent.id) {
              await lastValueFrom(this.entregaOcService.update(ent.id, { ...ent, close: true }));
            } else {
              // FechaEntrega en backend es DateOnly → enviar 'yyyy-MM-dd' (no datetime) para evitar 400.
              const fechaEntregaIso = params.data.fechaXEntrega
                ? String(params.data.fechaXEntrega).substring(0, 10)
                : null;
              await lastValueFrom(this.entregaOcService.create({
                idDetailsreqoc: idDetail,
                fechaEntrega: fechaEntregaIso,
                cantidadRecibir: params.data.cantidad ?? null,
                notaFactura: null,
                totalEntrega: null,
                fechaEntradaAlmacen: null,
                close: true,
              } as any));
            }

            params.data.close = true;

            // Si es la OC/artículo actualmente seleccionado, refrescar niveles 4 y 5 para bloquear edición
            if (this.selectedOcRow === params.data) {
              if (this.nivel4GridApi) this.nivel4GridApi.refreshCells({ force: true });
              if (this.nivel5GridApi) this.nivel5GridApi.refreshCells({ force: true });
            }
            params.api.refreshCells({ rowNodes: [params.node], force: true });

            alerts.reqSuccessToast('Éxito', `El artículo de la OC ${params.data.folio} ha sido cerrado.`);
          } catch (error) {
            console.error('Error al cerrar el artículo:', error);
            alerts.reqErrorToast('Error', 'Ocurrió un error al intentar cerrar el artículo.');
            params.data.close = false;
            params.api.refreshCells({ rowNodes: [params.node], columns: ['close'], force: true });
          }
        } else {
          // Cancelar: revertir el checkbox sin re-disparar onCellValueChanged (evita loop del confirm).
          params.data.close = false;
          params.api.refreshCells({ rowNodes: [params.node], columns: ['close'], force: true });
        }
      }
    },
  ];

  cascadeOcGridOptions: any = {
    headerHeight: 25,
    rowHeight: 25,
    rowClassRules: {
      'selected-oc-highlight': (p: any) => p.data === this.selectedOcRow || p.data === this.selectedOcMultiRow,
    },
    defaultColDef: { resizable: true, sortable: true, textAlign: 'center' },
    tooltipShowDelay: 300,
    // Renderiza los popups/tooltips a nivel body para que el tooltip histórico no se recorte
    // por la baja altura/overflow del grid del Nivel 3.
    popupParent: typeof document !== 'undefined' ? document.body : null,
    onFirstDataRendered: (params: any) => params.api.autoSizeAllColumns(),
  };

  // ── Nivel 4 (múltiples entregas): Detalle de entregas (solo lectura) ──
  multiEntregasColDefs: ColDef[] = [
    {
      headerName: '# Entrega',
      width: 80,
      valueGetter: (p) => (p.node?.rowIndex ?? 0) + 1,
      cellStyle: { backgroundColor: '#f8f9fa', fontWeight: 'bold' },
    },
    {
      field: 'fechaEntrega',
      headerName: 'Fecha Entrega',
      width: 130,
      valueFormatter: (p) => this.formatFechaDmy(p.value),
    },
    { field: 'folioEntrega', headerName: 'Folio entrega', width: 180, editable: false, cellStyle: { color: '#0d47a1', fontWeight: '600' } },
    {
      field: 'cantidadRecibir',
      headerName: 'Cantidad a Recibir',
      width: 150,
      type: 'numericColumn',
      cellStyle: { backgroundColor: '#c8e6c9', color: '#1b5e20', fontWeight: '600', cursor: 'pointer' },
    },
    {
      field: 'notaFactura',
      headerName: 'Nota / Factura',
      flex: 1,
      minWidth: 140,
    },
    {
      headerName: 'PDF',
      width: 60,
      sortable: false,
      hide: true,
      cellRenderer: (_params: any) => {
        const div = document.createElement('div');
        div.style.cssText = 'text-align: center; cursor: pointer;';
        div.innerHTML = '<i class="bi bi-file-pdf" style="color: #d32f2f; font-size: 1.2rem;" title="Descargar PDF"></i>';
        return div;
      },
    },
    {
      field: 'fechaEntradaAlmacen',
      headerName: 'Fecha Entrada Almacén',
      width: 160,
      valueFormatter: (p) => this.formatFechaDmy(p.value),
    },
    {
      field: 'close',
      headerName: 'Cerrado Entrega',
      width: 130,
      editable: false,
      cellRenderer: (params: any) => {
        const rowIndex = params.node?.rowIndex ?? 0;
        const isLocked = !params.data?.close && !this.isEntregaRowUnlocked(rowIndex);
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'display:flex; justify-content:center; align-items:center; height:100%;';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = params.value === true;
        cb.disabled = params.value === true || isLocked;
        cb.style.cursor = cb.disabled ? 'not-allowed' : 'pointer';
        cb.addEventListener('change', () => {
          if (!cb.disabled) this.closeEntrega(params);
        });
        wrapper.appendChild(cb);
        return wrapper;
      },
    },
    {
      field: 'resta',
      headerName: 'Resta Entrega',
      width: 120,
      type: 'numericColumn',
      editable: false,
      valueFormatter: (p) => {
        const v = Number(p.value ?? 0);
        return Number.isFinite(v) ? v.toLocaleString('es-MX') : '';
      },
      cellStyle: (params: any) => {
        const v = Number(params.value ?? 0);
        if (v > 0) return { backgroundColor: '#fff9c4', color: '#f57f17', fontWeight: '600' };
        if (v === 0) return { backgroundColor: '#c8e6c9', color: '#1b5e20', fontWeight: '600' };
        return { backgroundColor: '#ffcdd2', color: '#c62828', fontWeight: '600' };
      },
    },
  ];

  multiEntregasGridOptions: any = {
    headerHeight: 28,
    rowHeight: 25,
    defaultColDef: { resizable: true, sortable: true, editable: false },
    onFirstDataRendered: (params: any) => params.api.autoSizeAllColumns(),
    rowClassRules: {
      'multi-entrega-locked': (params: any) =>
        !params.data?.close && !this.isEntregaRowUnlocked(params.node?.rowIndex ?? 0),
      'multi-entrega-closed': (params: any) => params.data?.close === true,
    },
  };

  // ── Nivel 4: Entradas por OC (demo local; sustituir por API cuando exista) ──
  nivel4ColDefs: ColDef[] = [
    { field: 'folioEntrega', headerName: 'Folio Entrada', width: 200, editable: false, cellStyle: { color: '#0d47a1', fontWeight: '600' } },
    { field: 'idEntrada', headerName: 'ID Entrada', width: 95, type: 'numericColumn', filter: 'agNumberColumnFilter', hide: true },
    {
      field: 'fechaRecepcion',
      headerName: 'Fecha recepción',
      filter: 'agDateColumnFilter',
      filterParams: {
        defaultToNothingSelected: true,
      },
      width: 150,
      editable: (p: any) => !this.selectedOcRow?.close && !this.selectedMultiEntregaIsClosed && !p?.data?.close,
      cellEditor: 'agDateCellEditor',
      valueGetter: (params) => {
        if (!params.data?.fechaRecepcion) {
          return new Date();
        }

        return params.data.fechaRecepcion instanceof Date
          ? params.data.fechaRecepcion
          : new Date(params.data.fechaRecepcion);
      },
      valueSetter: (params) => {
        if (!params.newValue) {
          params.data.fechaRecepcion = new Date();
          this.onEntradaCellValueChanged(params);
          return true;
        }

        const date = params.newValue instanceof Date
          ? params.newValue
          : new Date(params.newValue);

        if (isNaN(date.getTime())) {
          void alerts.basicAlert('Error', 'Fecha inválida', 'error');
          return false;
        }

        params.data.fechaRecepcion = date;
        this.onEntradaCellValueChanged(params);
        return true;
      },
      valueFormatter: (params) => {
        try {
          if (!params.value) return '';

          const date = params.value instanceof Date ? params.value : new Date(params.value);
          if (isNaN(date.getTime())) return '';

          return `${('0' + date.getDate()).slice(-2)}/${('0' + (date.getMonth() + 1)).slice(-2)}/${date.getFullYear()}`;
        } catch {
          return '';
        }
      },
    },
    {
      // VERDE: abre el Nivel 5 "Datos externos" (lotes). Lote/Caducidad/Cantidad x Lote viven ahí.
      field: 'datosExternosCell',
      headerName: 'Datos externos',
      width: 120,
      sortable: false,
      cellStyle: () => ({ backgroundColor: '#c8e6c9', textAlign: 'center' }),
      cellRenderer: (params: any) => {
        const nLotes = Array.isArray(params.data?.datosExternos)
          ? params.data.datosExternos.filter((d: any) => this.datoExternoTieneDatos(d)).length
          : 0;
        const container = document.createElement('div');
        container.style.cssText = 'display:flex;align-items:center;justify-content:center;height:100%;cursor:pointer;';
        if (nLotes > 0) {
          container.style.cssText += 'font-size:0.68rem;font-weight:600;color:#1b5e20;';
          container.textContent = `${nLotes} lote(s)`;
        } else {
          container.style.cssText += 'color:#2e7d32;font-weight:500;font-size:1.2rem;';
          container.textContent = '↓';
        }
        container.addEventListener('click', (ev) => {
          ev.stopPropagation();
          this.toggleDatosExternos(params.data);
        });
        return container;
      },
    },
    {
      // No-CR: solo-lectura = suma de "Cantidad x Lote" del Nivel 5 (Datos externos).
      // CR: editable a mano (CR no tiene Datos externos).
      field: 'cantidadEntrada',
      headerName: 'Cantidad Entrada',
      width: 130,
      type: 'numericColumn',
      editable: (p: any) => this.selectedOcRow?.type === 'CR'
        && !this.selectedOcRow?.close && !this.selectedMultiEntregaIsClosed && !p?.data?.close,
      valueFormatter: (p) => this.fmtEntero(p.value),
      onCellValueChanged: (event: any) => this.onEntradaCellValueChanged(event),
      cellStyle: () => this.selectedOcRow?.type === 'CR'
        ? null
        : { backgroundColor: '#f5f5f5', color: '#37474f' },
    },
    {
      field: 'bultos',
      headerName: 'Bultos',
      width: 85,
      type: 'numericColumn',
      // Compra Rápida: Bultos siempre deshabilitado.
      editable: (p: any) => this.editBultos && this.selectedOcRow?.type !== 'CR' && !this.selectedOcRow?.close && !this.selectedMultiEntregaIsClosed && !p?.data?.close,
      valueSetter: (params) => {
        const newVal = params.newValue;
        if (newVal === null || newVal === undefined || newVal === '') {
          params.data.bultos = 0;
        } else {
          const numVal = parseInt(String(newVal), 10);
          params.data.bultos = isNaN(numVal) ? (params.oldValue ?? 0) : numVal;
        }
        // Recalcular revisionConfigu: ceil(bultos × proporcionRevision)
        if (this.proporcionRevision !== null && this.proporcionRevision > 0) {
          params.data.revisionConfigu = Math.ceil(params.data.bultos * this.proporcionRevision);
        }
        this.onEntradaCellValueChanged(params);
        return true;
      },
      onCellValueChanged: (event: any) => this.onEntradaCellValueChanged(event),
      cellStyle: () => (this.editBultos && this.selectedOcRow?.type !== 'CR')
        ? {}
        : { backgroundColor: '#f0f0f0', color: '#6c757d' },
    },
    {
      field: 'revisionConfigu',
      headerName: 'Revisión Configu.',
      width: 125,
      editable: false,
      cellEditor: 'agNumberCellEditor',
      cellEditorParams: {
        min: 0,
        max: 999999,
      },
      valueFormatter: (p) => {
        const val = p.value ?? 0;
        return String(Math.ceil(val));
      },
      valueSetter: (params) => {
        let newVal = params.newValue;
        if (newVal === null || newVal === undefined || newVal === '') {
          newVal = 0;
        } else {
          newVal = parseInt(String(newVal), 10);
          if (isNaN(newVal)) newVal = params.oldValue ?? 0;
        }
        params.data.revisionConfigu = newVal;
        this.onEntradaCellValueChanged(params);
        return true;
      },
      cellStyle: { backgroundColor: '#fff9c4' },
    },
    {
      field: 'carat',
      headerName: 'Características',
      width: 100,
      sortable: false,
      cellStyle: () => ({ backgroundColor: '#c8e6c9', textAlign: 'center' }),
      cellRenderer: (params: any) => {
        const carat = params.data?.carat;
        const hasData = carat && typeof carat === 'string' && carat.trim().length > 0;

        const container = document.createElement('div');
        container.style.cssText = 'display:flex;align-items:center;justify-content:center;height:100%;cursor:pointer;';

        if (hasData) {
          container.style.cssText += 'font-size:0.68rem;font-weight:600;color:#1b5e20;flex-wrap:wrap;gap:2px;';
          container.textContent = carat;
        } else {
          container.style.cssText += 'color:#2e7d32;font-weight:500;font-size:1.2rem;';
          container.textContent = '↓';
        }

        container.addEventListener('click', async (ev) => {
          ev.stopPropagation();
          if (this.selectedEntradaCaratRow === params.data) {
            this.selectedEntradaCaratRow = null;
            this.cascadeCaratData = [];
            this.cascadeMpCaractData = [];
            this.existingCaratIds.clear();
            this.hasUnsavedChangesCaracteristicas = false;
          } else {
            // Cierra el modal PDF si está abierto
            this.closeDocumentsModal();
            this.selectedEntradaCaratRow = params.data;
            this.hasUnsavedChangesCaracteristicas = false;
            this.existingCaratIds.clear();
            this.caractActiveTab = 'mp';

            const idEntrada = params.data.idEntrada;
            let row: any = { idEntrada };
            const savedCategoryIds = new Set<number>();

            try {
              const existing = await lastValueFrom(this.caracteristicasService.getByEntrada(idEntrada));
              if (existing && existing.length > 0) {
                existing.forEach((item: any) => {
                  row[`cat_${item.idCategory}`] = item.familySelected;
                  this.existingCaratIds.set(item.idCategory, item.id);
                  savedCategoryIds.add(item.idCategory);
                });
              } else {
                row.__isNew = true;
              }
            } catch {
              row.__isNew = true;
            }

            // Reconstruir columnas incluyendo categorías inactivas con datos guardados
            this.buildNivel5ColumnDefs(savedCategoryIds);
            if (this.nivel5GridApi && !this.nivel5GridApi.isDestroyed()) {
              this.nivel5GridApi.setGridOption('columnDefs', this.nivel5ColDefs);
            }

            this.cascadeCaratData = [row];
            this.originalCaracteristicasData = JSON.parse(JSON.stringify(this.cascadeCaratData));
            if (this.nivel5GridApi && !this.nivel5GridApi.isDestroyed()) {
              this.nivel5GridApi.setGridOption('rowData', this.cascadeCaratData);
            }

            // Pestaña "Características de materia prima": filas por característica + revisión.
            await this.loadMpCaracteristicas(idEntrada);
          }
        });
        return container;
      },
    },
    {
      // Precio unitario POR ENTREGA: precio base del ítem OC × IVA propio de la entrega (round2).
      colId: 'precioUnitarioEntrega',
      headerName: 'Precio unitario',
      width: 130,
      type: 'numericColumn',
      valueGetter: (p: any) => {
        const base = Number(this.selectedOcRow?.price) || 0;
        const v = p.data?.masIva ? base * (1 + this.ivaPercent / 100) : base;
        return Math.round(v * 100) / 100;
      },
      valueFormatter: (p) => `${this.fmtMoneda(this.toMxnIfPaid(p.data, p.value))} ${this.nivel4Moneda(p.data)}`,
      // Tooltip: valor ORIGINAL (moneda extranjera) cuando ya se convirtió a MXN.
      tooltipComponent: StyledTooltipComponent,
      tooltipValueGetter: (p: any) => this.nivel4OriginalTooltip(p.data, p.value),
      cellRenderer: (p: any) => {
        // Almacén: si la entrada ya se pagó, se muestra en MXN (convertido en seco); si no, original.
        const shown = this.toMxnIfPaid(p.data, p.value);
        const formatted = `${this.fmtMoneda(shown)} ${this.nivel4Moneda(p.data)}`;
        if (p.data?.masIva !== true) {
          const span = document.createElement('span');
          span.textContent = formatted;
          span.style.cssText = 'display:block; text-align:right; width:100%;';
          return span;
        }
        // Precio con IVA + badge "+IVA". El valor original (extranjera) va en el tooltip de la columna.
        const div = document.createElement('div');
        div.style.cssText = 'display:flex; align-items:center; justify-content:flex-end; gap:4px; width:100%;';
        const span = document.createElement('span');
        span.textContent = formatted;
        div.appendChild(span);
        const badge = document.createElement('span');
        badge.textContent = '+IVA';
        badge.style.cssText = 'font-size:0.6rem; background:#e3f2fd; color:#1565c0; border-radius:3px; padding:0 3px; font-weight:700; line-height:1.5; flex-shrink:0;';
        div.appendChild(badge);
        return div;
      },
    },
    {
      field: 'pago',
      headerName: 'Total x entrega',
      width: 140,
      type: 'numericColumn',
      valueGetter: (params) => {
        const qty = Number(params.data?.cantidadEntrada) || 0;
        const price = Number(this.selectedOcRow?.price) || 0;
        // Precio = BASE (Opción B). Aplica IVA de LA ENTREGA (params.data.masIva) para que cada una
        // sea independiente, REDONDEANDO el precio unitario a 2 dec ANTES de multiplicar.
        const factor = params.data?.masIva ? (1 + this.ivaPercent / 100) : 1;
        const unit = Math.round(price * factor * 100) / 100;
        return unit * qty;
      },
      valueFormatter: (p) => `${this.fmtMoneda(this.toMxnIfPaid(p.data, p.value))} ${this.nivel4Moneda(p.data)}`,
      // Tooltip: total ORIGINAL (moneda extranjera) cuando ya se convirtió a MXN.
      tooltipComponent: StyledTooltipComponent,
      tooltipValueGetter: (p: any) => this.nivel4OriginalTooltip(p.data, p.value),
    },
    {
      // Fecha en que se confirmó el pago desde la Hoja de Gastos (read-only aquí).
      field: 'fechaPago',
      headerName: 'Fecha Pago',
      width: 120,
      editable: false,
      valueFormatter: (p: any) => {
        if (!p.value) return '';
        const d = p.value instanceof Date ? p.value : new Date(p.value);
        if (isNaN(d.getTime())) return '';
        return `${('0' + d.getDate()).slice(-2)}/${('0' + (d.getMonth() + 1)).slice(-2)}/${d.getFullYear()}`;
      },
    },
    {
      field: 'pdfCount',
      headerName: '📤 PDF',
      editable: false,
      suppressMovable: true,
      width: 90,
      flex: 0,
      cellRenderer: (params: any) => {
        const count = Number(params.value ?? 0);
        const color = count > 0 ? '#0d6efd' : '#6c757d';

        const container = document.createElement('div');
        container.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:4px;cursor:pointer;width:100%;height:100%;';

        const icon = document.createElement('i');
        icon.className = 'bi bi-file-earmark-text';
        icon.title = 'Ver documentos de la entrada';
        icon.style.color = color;

        const badge = document.createElement('span');
        badge.textContent = String(count);
        badge.style.cssText = 'font-size:0.72rem;font-weight:700;color:#0d3b66;line-height:1;';

        
        container.appendChild(badge);
        container.appendChild(icon);

        return container;
      },
      cellStyle: { backgroundColor: '#cce5ff', textAlign: 'center' },
      onCellClicked: (params) => this.toggleDetailColumn(params, 'documents'),
    },
    {
      // Cierre por ENTRADA. Visible solo para OCs "COMPRA AUTORIZADA SIN LIMITE"
      // (se controla con setColumnVisible en loadEntradasForOc). Al marcarse, bloquea la fila.
      field: 'close',
      headerName: 'Cerrar Entrega',
      width: 130,
      hide: true,
      // El checkbox de cierre sí permanece editable (para poder reabrir), salvo cierre a nivel OC/entrega.
      editable: () => !this.selectedOcRow?.close && !this.selectedMultiEntregaIsClosed,
      cellRenderer: 'agCheckboxCellRenderer',
      cellStyle: { textAlign: 'center', backgroundColor: '#fff3e0' },
      onCellValueChanged: (event: any) => {
        this.hasUnsavedChangesEntradas = true;
        // Re-renderiza la fila para que el lock de las demás celdas tome efecto visual/funcional.
        if (this.nivel4GridApi && event.node) {
          this.nivel4GridApi.redrawRows({ rowNodes: [event.node] });
        }
      },
    },
    {
      field: 'liberacion',
      headerName: 'Liberación',
      width: 100,
      // Opción A: una entrada a CRÉDITO ya está liberada en el almacén → checkbox marcado y no editable.
      editable: (p: any) => !this.selectedOcRow?.close && !this.selectedMultiEntregaIsClosed && !p?.data?.close && !p?.data?.credito,
      cellRenderer: 'agCheckboxCellRenderer',
      valueGetter: (p: any) => !!(p.data?.liberacion || p.data?.credito),
      valueSetter: (p: any) => { p.data.liberacion = p.newValue === true; return true; },
    },
    {
      field: 'comentario',
      headerName: 'Comentario',
      minWidth: 180,
      flex: 1,
      editable: (p: any) => !this.selectedOcRow?.close && !this.selectedMultiEntregaIsClosed && !p?.data?.close,
      valueSetter: (params) => {
        params.data.comentario = params.newValue ?? '';
        this.onEntradaCellValueChanged(params);
        return true;
      },
    },
    { field: 'usuario', headerName: 'Usuario', width: 100 },
  ];

  nivel4GridOptions: any = {
    headerHeight: 25,
    rowHeight: 25,
    rowSelection: 'single',
    onSelectionChanged: (event: any) => {
      const selectedRows = event.api.getSelectedRows();
      this.selectedEntradaRow = selectedRows.length > 0 ? selectedRows[0] : null;
    },
    onCellValueChanged: (event: any) => {
      this.hasUnsavedChangesEntradas = true;
      // Marca la fila como modificada para que saveEntradas la incluya en el payload.
      // Cubre columnas con handler propio que no pasan por onEntradaCellValueChanged (close, liberacion).
      if (event?.data && !event.data.__isNew) event.data.__modified = true;
    },
    rowClassRules: {
      'new-row-highlight': (p: any) => !!p.data?.__isNew,
    },
    defaultColDef: {
      resizable: true,
      sortable: true,
      textAlign: 'center',
      suppressKeyboardEvent: (params: any) => {
        if (params.event.key === 'Enter' && params.editing) {
          this.enterPressed = true;
          setTimeout(() => {
            if (this.nivel4GridApi) this.nivel4GridApi.stopEditing();
          }, 0);
          return true;
        }
        return false;
      },
    },
    onCellEditingStopped: (event: any) => this.onEntradaCellEditingStopped(event),
    tooltipShowDelay: 300,
    // Tooltips a nivel body para que no los recorte el contenedor del grid.
    popupParent: typeof document !== 'undefined' ? document.body : null,
    onFirstDataRendered: (params: any) => params.api.autoSizeAllColumns(),
  };

  // ── Nivel 5: Características ───────────────────────────────────────
  nivel5ColDefs: ColDef[] = [];

  nivel5GridOptions: any = {
    headerHeight: 25,
    rowHeight: 25,
    popupParent: document.body,
    rowClassRules: {
      'new-row-highlight': (p: any) => !!p.data?.__isNew,
    },
    onCellValueChanged: () => {
      this.hasUnsavedChangesCaracteristicas = true;
    },
    singleClickEdit: false,
    suppressClickEdit: false,
    defaultColDef: {
      resizable: true,
      sortable: true,
      textAlign: 'center',
      suppressKeyboardEvent: (params: any) => {
        if (params.event.key === 'Enter' && params.editing) {
          setTimeout(() => {
            if (this.nivel5GridApi) this.nivel5GridApi.stopEditing();
          }, 0);
          return true;
        }
        return false;
      },
    },
    tooltipShowDelay: 300,
    onFirstDataRendered: (params: any) => params.api.autoSizeAllColumns(),
  };

  // ── Pestaña "Características de materia prima" (filas por característica) ──
  private readonly EXTRACCION_FERMENTACION_DEPT_ID = 62;

  mpCaractColDefs: ColDef[] = [
    { field: 'caracteristica', headerName: 'Característica', flex: 1, minWidth: 180, editable: false,
      cellStyle: { fontWeight: '600', color: '#1b5e20' } },
    {
      field: 'reviso', headerName: 'Revisó', width: 90,
      editable: (p: any) => !this.selectedOcRow?.close && !this.selectedMultiEntregaIsClosed,
      cellRenderer: 'agCheckboxCellRenderer',
      cellEditor: 'agCheckboxCellEditor',
    },
    {
      field: 'comentarios', headerName: 'Comentarios', flex: 1, minWidth: 200,
      editable: (p: any) => !this.selectedOcRow?.close && !this.selectedMultiEntregaIsClosed,
      valueSetter: (params: any) => {
        params.data.comentarios = (params.newValue ?? '').toString().toUpperCase();
        return true;
      },
    },
  ];

  mpCaractGridOptions: any = {
    headerHeight: 25,
    rowHeight: 24,
    popupParent: typeof document !== 'undefined' ? document.body : null,
    onCellValueChanged: () => { this.hasUnsavedChangesCaracteristicas = true; },
    defaultColDef: { resizable: true, sortable: false },
    onFirstDataRendered: (params: any) => params.api.autoSizeAllColumns(),
  };

  // ── Nivel 5: Datos externos (versión gasto) ───────────────────────
  // Sin botones Agregar/Guardar; auto-append al escribir en la última fila; la última fila
  // vacía no se persiste. La SUMA de "Cantidad x Lote" alimenta "Cantidad Entrada" (Nivel 4).
  datosExternosColDefs: ColDef[] = [
    {
      headerName: '#',
      width: 45,
      valueGetter: (p) => (p.node?.rowIndex ?? 0) + 1,
      cellStyle: { fontWeight: 'bold' },
    },
    {
      field: 'lote',
      headerName: 'Lote',
      flex: 1,
      minWidth: 130,
      editable: (p: any) => !this.selectedOcRow?.close && !this.selectedMultiEntregaIsClosed,
      valueSetter: (params) => {
        params.data.lote = params.newValue ?? '';
        return true;
      },
    },
    {
      field: 'caducidadMeses',
      headerName: 'Caducidad en meses',
      width: 160,
      type: 'numericColumn',
      editable: (p: any) => !this.selectedOcRow?.close && !this.selectedMultiEntregaIsClosed,
      valueSetter: (params) => {
        const v = params.newValue;
        if (v === null || v === undefined || v === '') {
          params.data.caducidadMeses = null;
        } else {
          const n = parseInt(String(v), 10);
          params.data.caducidadMeses = (isNaN(n) || n < 0) ? (params.oldValue ?? null) : n;
        }
        return true;
      },
      valueFormatter: (p) => this.fmtEntero(p.value),
    },
    {
      field: 'cantidadXLote',
      headerName: 'Cantidad x Lote',
      width: 140,
      type: 'numericColumn',
      editable: (p: any) => !this.selectedOcRow?.close && !this.selectedMultiEntregaIsClosed,
      valueSetter: (params) => {
        const v = params.newValue;
        if (v === null || v === undefined || v === '') {
          params.data.cantidadXLote = null;
        } else {
          const n = Number(v);
          params.data.cantidadXLote = (isNaN(n) || n < 0) ? (params.oldValue ?? null) : n;
        }
        return true;
      },
      valueFormatter: (p) => this.fmtEntero(p.value),
    },
  ];

  datosExternosGridOptions: any = {
    headerHeight: 25,
    rowHeight: 25,
    popupParent: typeof document !== 'undefined' ? document.body : null,
    rowClassRules: {
      'new-row-highlight': (p: any) => !!p.data?.__isNew,
    },
    onCellValueChanged: (event: any) => this.onDatoExternoEdited(event),
    singleClickEdit: false,
    defaultColDef: {
      resizable: true,
      sortable: false,
      textAlign: 'center',
      suppressKeyboardEvent: (params: any) => {
        if (params.event.key === 'Enter' && params.editing) {
          setTimeout(() => { if (this.datosExternosGridApi) this.datosExternosGridApi.stopEditing(); }, 0);
          return true;
        }
        return false;
      },
    },
    tooltipShowDelay: 300,
    onFirstDataRendered: (params: any) => params.api.autoSizeAllColumns(),
  };

  // ── Lifecycle ─────────────────────────────────────────────────────
  async agInit(params: any) { await this.init(params); 
    this.cdr.detectChanges();}
  refresh(params: any): boolean { this.internalParams = params; return true; }

  private async init(params: any) {
    this.initCompleted = false;
    this.internalParams = params;

    // IVA% de la sucursal (setup almacén) — el precio guardado es BASE (Opción B); se aplica al mostrar.
    const idBranchIva = params?.data?.sucursal;
    if (idBranchIva) {
      this.setupService.getWarehouseSetupByBranch(Number(idBranchIva)).subscribe({
        next: (d: any) => {
          this.ivaPercent = Number(d?.iva) || 0;
          if (this.cascadeOcGridApi && !this.cascadeOcGridApi.isDestroyed()) {
            this.cascadeOcGridApi.refreshCells({ force: true });
          }
        },
        error: () => { this.ivaPercent = 0; }
      });

      // Prefijo "Identificador Entregas" de la sucursal (para el Folio de entrega).
      this.prefixSetupService.getPrefixSetup('branch', Number(idBranchIva)).subscribe({
        next: (ps: any) => { this.prefixEntrega = ps?.prefixEntrega || ''; },
        error: () => { this.prefixEntrega = ''; }
      });
    }

    // Actualizar pdfCount en tiempo real cuando otro componente guarda documentos
    this.countSub?.unsubscribe();
    this.countSub = this.entradaDocumentsOverlayService.countUpdated$.subscribe(({ idEntrada, count }) => {
      // Compra Rápida: los documentos son a nivel del CR → todas las entradas comparten el conteo.
      if (this.selectedOcRow?.type === 'CR' && this.selectedOcRow?.id === idEntrada) {
        this.cascadeEntradaData.forEach((r: any) => { r.pdfCount = count; });
        if (this.nivel4GridApi && !this.nivel4GridApi.isDestroyed()) {
          this.nivel4GridApi.refreshCells({ columns: ['pdfCount'], force: true });
        }
        return;
      }
      const row = this.cascadeEntradaData.find(
        (r: any) => (r.idEntrega ?? r.idEntrada) === idEntrada
      );
      if (row) {
        row.pdfCount = count;
        if (this.nivel4GridApi && !this.nivel4GridApi.isDestroyed()) {
          this.nivel4GridApi.refreshCells({ columns: ['pdfCount'], force: true });
        }
      }
    });
    this.detailType    = params?.data?.detailType ?? 'entradas';
    this.entradasSimple = !!(params?.entradasSimple) && this.detailType === 'entradas';
    if (this.detailType === 'salidas' || this.entradasSimple) {
      this.colDefs = this.buildSalidasColDefs(this.entradasSimple ? 'Quien generó' : 'Quien utilizó');
    }
    this.bultosCantidad = params?.bultosCantidad ?? null;
    this.bultosCantidadARevisar = params?.bultosCantidadARevisar ?? null;
    this.proporcionRevision = params?.proporcionRevision ?? null;
    this.editBultos = !!params?.editBultos;
    this.caracteristicasCategories = params?.caracteristicasCategories ?? [];
    this.caracteristicasFamilies = params?.caracteristicasFamilies ?? [];
    this.buildNivel5ColumnDefs();
    const departmentOptions = params?.departmentOptions ?? [];
    this.deptsCsv = departmentOptions
      .map((d: any) => d.id)
      .filter((id: any) => id)
      .join(',');

    // Flujo async: padre abre la cascada inmediatamente y sincroniza en background.
    // Mostrar loading hasta que lleguen los datos. Solo aplica para entradas normales.
    const entradasData$ = (this.detailType !== 'salidas' && !this.entradasSimple)
      ? params?.entradasData$ as Observable<any> | null
      : null;
    if (entradasData$) {
      if (this.gridApi && !this.gridApi.isDestroyed()) this.gridApi.showLoadingOverlay();
      this.entradasDataSub?.unsubscribe();
      this.entradasDataSub = entradasData$.pipe(take(1)).subscribe(async (data: any) => {
        this.bultosCantidad            = data.bultosCantidad ?? null;
        this.bultosCantidadARevisar    = data.bultosCantidadARevisar ?? null;
        this.proporcionRevision        = data.proporcionRevision ?? null;
        this.caracteristicasCategories = data.caracteristicasCategories ?? [];
        this.caracteristicasFamilies   = data.caracteristicasFamilies ?? [];
        this.buildNivel5ColumnDefs();
        this.reqOptions = data.reqs ?? [];
        this.rowData = (data.details ?? []).map((d: any) => {
          const req = this.reqOptions.find((r: any) => r.id === d.idRequisition);
          return {
            id:            d.id,
            idRequisition: d.idRequisition ?? null,
            folio:         req?.folio ?? '',
            cantidadReq:   d.cantidadReq ?? 0,
            numCantidadOc: d.numCantidadOc ?? 0,
            cantidad:      d.cantidad ?? 0,
            idCatalog:     d.idCatalog ?? null,
          };
        });
        this.rowData = await this.enrichReqRowsWithResta(this.rowData);
        this.initCompleted = true;
        if (this.gridApi && !this.gridApi.isDestroyed()) {
          this.gridApi.setGridOption('rowData', this.rowData);
          this.gridApi.hideOverlay();
          this.updateParentCount();
        }
        this.loadReqEntregasSums();
        this.loadCompraRapidaRows();
      });
      return;
    }

    // Flujo precargado: el padre ya tenía los datos del ciclo anterior (solo entradas).
    const preloadedReqs = params?.preloadedReqs as any[] | undefined;
    const preloadedDetails = params?.preloadedDetails as any[] | undefined;

    if (this.detailType !== 'salidas' && !this.entradasSimple && preloadedReqs?.length && preloadedDetails !== undefined) {
      this.reqOptions = preloadedReqs;
      this.rowData = preloadedDetails.map((d: any) => {
        const req = this.reqOptions.find((r: any) => r.id === d.idRequisition);
        return {
          id:            d.id,
          idRequisition: d.idRequisition ?? null,
          folio:         req?.folio ?? '',
          cantidadReq:   d.cantidadReq ?? 0,
          numCantidadOc: d.numCantidadOc ?? 0,
          cantidad:      d.cantidad ?? 0,
          idCatalog:     d.idCatalog ?? null,
        };
      });
      this.rowData = await this.enrichReqRowsWithResta(this.rowData);
      this.initCompleted = true;
      if (this.gridApi && !this.gridApi.isDestroyed()) {
        this.gridApi.setGridOption('rowData', this.rowData);
        this.updateParentCount();
      }
      this.loadReqEntregasSums();
      this.loadCompraRapidaRows();
      return;
    }

    // Flujo normal
    if (this.detailType !== 'salidas') {
      await this.loadReqOptions();
    }
    this.initCompleted = true;
    if (this.gridApi && !this.gridApi.isDestroyed()) this.loadData();
  
    this.cdr.detectChanges();}

  private async loadReqOptions() {
    const idBranch = this.internalParams?.data?.sucursal;
    const idMaterial = this.internalParams?.data?.idMaterial;
    if (!idBranch || !idMaterial) { this.reqOptions = []; return; }
    try {
      this.reqOptions = await lastValueFrom(
        this.ocAndReqsService.getReqsByBranchMaterial(idBranch, idMaterial, this.deptsCsv)
      );
    } catch (err) {
      console.error('Error cargando requisiciones:', err);
      this.reqOptions = [];
    }
  
    this.cdr.detectChanges();}

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    if (!this.initCompleted) {
      // Datos aún cargando (flujo async o normal): mostrar overlay
      this.gridApi.showLoadingOverlay();
      return;
    }
    if (this.rowData.length) {
      this.gridApi.setGridOption('rowData', this.rowData);
      this.updateParentCount();
    } else {
      this.loadData();
    }
  }

  onCascadeOcGridReady(params: GridReadyEvent) {
    this.cascadeOcGridApi = params.api;
    //console.log(this.cascadeOcGridApi);
    //console.log( params.api);
    if (this.cascadeOcData.length)
      this.cascadeOcGridApi.setGridOption('rowData', this.cascadeOcData);
  }

  onNivel4GridReady(params: GridReadyEvent) {
    this.nivel4GridApi = params.api;
    if (this.cascadeEntradaData.length)
      this.nivel4GridApi.setGridOption('rowData', this.cascadeEntradaData);
  }

  onNivel5GridReady(params: GridReadyEvent) {
    this.nivel5GridApi = params.api;
    if (this.nivel5ColDefs.length > 0) {
      this.nivel5GridApi.setGridOption('columnDefs', this.nivel5ColDefs);
    }
    if (this.cascadeCaratData.length)
      this.nivel5GridApi.setGridOption('rowData', this.cascadeCaratData);
  }

  // ── Pestaña "Características de materia prima" ──────────────────────
  onMpCaractGridReady(params: GridReadyEvent) {
    this.mpCaractGridApi = params.api;
    if (this.cascadeMpCaractData.length)
      this.mpCaractGridApi.setGridOption('rowData', this.cascadeMpCaractData);
  }

  onRevisorChange() {
    this.hasUnsavedChangesCaracteristicas = true;
  }

  /** Carga las características Activo del material + su revisión guardada para la entrada. */
  private async loadMpCaracteristicas(idEntrada: number): Promise<void> {
    this.cascadeMpCaractData = [];
    this.selectedRevisorId = null;
    const idMaterial = this.internalParams?.data?.idMaterial;
    if (!idMaterial) return;

    await this.loadRevisorOptions();

    try {
      const [caracts, revisiones] = await Promise.all([
        lastValueFrom(this.caracteristicasMpService.getByMaterial(Number(idMaterial))).catch(() => []),
        idEntrada ? lastValueFrom(this.revisionService.getByEntrada(idEntrada)).catch(() => []) : Promise.resolve([]),
      ]);
      const activos = (Array.isArray(caracts) ? caracts : []).filter((c: any) => c.activo !== false);
      const revByCaract = new Map<number, any>(
        (Array.isArray(revisiones) ? revisiones : []).map((r: any) => [r.idCaracteristica, r])
      );
      // Revisor de la entrada: el de cualquier revisión existente.
      const anyRev = (Array.isArray(revisiones) ? revisiones : []).find((r: any) => r.idTrabajador != null);
      this.selectedRevisorId = anyRev?.idTrabajador ?? null;

      this.cascadeMpCaractData = activos.map((c: any) => {
        const rev = revByCaract.get(c.id);
        return {
          idCaracteristica: c.id,
          caracteristica: c.caracteristica ?? '',
          reviso: rev?.reviso ?? false,
          comentarios: rev?.comentarios ?? '',
          revisionId: rev?.id ?? null,
        };
      });
      if (this.mpCaractGridApi && !this.mpCaractGridApi.isDestroyed()) {
        this.mpCaractGridApi.setGridOption('rowData', this.cascadeMpCaractData);
      }
    } catch (e) {
      console.error('Error cargando características de materia prima:', e);
      this.cascadeMpCaractData = [];
    }
  
    this.cdr.detectChanges();}

  /** Empleados del depto Extracción y Fermentación (sucursal del Nivel 1) para el dropdown revisor. */
  private async loadRevisorOptions(): Promise<void> {
    if (this.revisorOptions.length) return;   // ya cargados
    const idBranch = this.internalParams?.data?.sucursal;
    if (!idBranch) { this.revisorOptions = []; return; }
    try {
      const emps: any = await lastValueFrom(this.employeesService.getEmployees(Number(idBranch)));
      this.revisorOptions = (Array.isArray(emps) ? emps : [])
        .filter((e: any) => Number(e.idDepto) === this.EXTRACCION_FERMENTACION_DEPT_ID)
        .map((e: any) => ({ id: e.id, name: (e.name ?? e.fullName ?? `Empleado ${e.id}`).toString() }))
        .sort((a: any, b: any) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
    } catch { this.revisorOptions = []; }
  
    this.cdr.detectChanges();}

  /** Persiste la revisión de características de materia prima de la entrada abierta. */
  private async saveMpRevision(idEntrada: number): Promise<void> {
    if (!idEntrada || !this.cascadeMpCaractData.length) return;
    const ops: Promise<any>[] = [];
    for (const r of this.cascadeMpCaractData) {
      const payload: RevisionCaracteristicaEntrada = {
        idEntrada,
        idCaracteristica: r.idCaracteristica,
        reviso: r.reviso === true,
        comentarios: (r.comentarios ?? '').toString().toUpperCase() || null,
        idTrabajador: this.selectedRevisorId ?? null,
      };
      if (r.revisionId) {
        ops.push(lastValueFrom(this.revisionService.update(r.revisionId, payload)));
      } else {
        ops.push(lastValueFrom(this.revisionService.create(payload)).then((created: any) => { r.revisionId = created?.id ?? null; }));
      }
    }
    await Promise.all(ops);
  
    this.cdr.detectChanges();}

  // ── Nivel 5 "Datos externos" (versión gasto) ──────────────────────
  onDatosExternosGridReady(params: GridReadyEvent) {
    this.datosExternosGridApi = params.api;
    if (this.cascadeDatosData.length)
      this.datosExternosGridApi.setGridOption('rowData', this.cascadeDatosData);
  }

  /** ¿La fila de dato externo tiene algún dato capturado? (las 3 vacías = fila trailing). */
  datoExternoTieneDatos(d: any): boolean {
    if (!d) return false;
    const lote = (d.lote ?? '').toString().trim();
    const tieneCad = d.caducidadMeses != null && d.caducidadMeses !== '';
    const tieneCant = d.cantidadXLote != null && d.cantidadXLote !== '';
    return lote !== '' || tieneCad || tieneCant;
  }

  private buildBlankDatoExterno(): any {
    return { id: null, lote: '', caducidadMeses: null, cantidadXLote: null, __isNew: true };
  }

  /** Abre/cierra el acordeón Datos externos para una entrada (excluyente con Características). */
  toggleDatosExternos(entradaRow: any): void {
    if (this.selectedEntradaDatosRow === entradaRow) {
      this.selectedEntradaDatosRow = null;
      this.cascadeDatosData = [];
      return;
    }
    // Excluyente con Características
    this.selectedEntradaCaratRow = null;
    this.cascadeCaratData = [];
    this.closeDocumentsModal();

    this.selectedEntradaDatosRow = entradaRow;
    // Trabaja sobre la copia almacenada en la entrada; siempre con una fila vacía al final.
    const base = Array.isArray(entradaRow.datosExternos) ? [...entradaRow.datosExternos] : [];
    base.push(this.buildBlankDatoExterno());
    this.cascadeDatosData = base;
    if (this.datosExternosGridApi && !this.datosExternosGridApi.isDestroyed()) {
      this.datosExternosGridApi.setGridOption('rowData', this.cascadeDatosData);
    }
  }

  /** Edición en el grid Datos externos: auto-append, recálculo de Cantidad Entrada y badge. */
  private onDatoExternoEdited(params: any): void {
    if (params?.data && !params.data.__isNew) params.data.__modified = true;

    // Auto-append: si la última fila ya tiene datos, agrega otra vacía.
    const last = this.cascadeDatosData[this.cascadeDatosData.length - 1];
    if (last && this.datoExternoTieneDatos(last)) {
      this.cascadeDatosData = [...this.cascadeDatosData, this.buildBlankDatoExterno()];
      if (this.datosExternosGridApi && !this.datosExternosGridApi.isDestroyed()) {
        this.datosExternosGridApi.setGridOption('rowData', this.cascadeDatosData);
      }
    }

    // Persistir el set en la entrada (sin la(s) trailing vacía(s) se filtra al guardar).
    if (this.selectedEntradaDatosRow) {
      this.selectedEntradaDatosRow.datosExternos = this.cascadeDatosData;
      this.recomputeCantidadEntrada(this.selectedEntradaDatosRow);
      // Marca la entrada modificada para que saveEntradas la incluya y persista cantidadEntrada.
      if (!this.selectedEntradaDatosRow.__isNew) this.selectedEntradaDatosRow.__modified = true;
    }
    this.hasUnsavedChangesEntradas = true;
  }

  /** Cantidad Entrada (Nivel 4) = suma de Cantidad x Lote de los datos externos de la entrada. */
  private recomputeCantidadEntrada(entradaRow: any): void {
    const lotes = Array.isArray(entradaRow?.datosExternos) ? entradaRow.datosExternos : [];
    const suma = lotes.reduce((acc: number, d: any) => acc + (Number(d?.cantidadXLote) || 0), 0);
    entradaRow.cantidadEntrada = suma;
    if (this.nivel4GridApi && !this.nivel4GridApi.isDestroyed()) {
      this.nivel4GridApi.refreshCells({ columns: ['cantidadEntrada', 'datosExternosCell', 'pago', 'precioUnitarioEntrega'], force: true });
    }
    this.syncSelectedOcRestaFromEntradas();
  }

  /** Persiste los lotes (datos externos) de una entrada: crea/actualiza con datos, borra los vaciados. */
  private async syncDatosExternosForEntrada(entradaRow: any): Promise<void> {
    if (!entradaRow?.id) return;
    const lotes: any[] = Array.isArray(entradaRow.datosExternos) ? entradaRow.datosExternos : [];

    // Filas con datos → upsert; filas con id pero ya vacías → borrar.
    const conDatos = lotes.filter((d) => this.datoExternoTieneDatos(d));
    const aBorrar  = lotes.filter((d) => d.id && !this.datoExternoTieneDatos(d));

    await Promise.all(aBorrar.map((d) => lastValueFrom(this.datosExternosService.delete(d.id))));

    for (const d of conDatos) {
      const payload: DatosExternosMolienda = {
        idEntrada: entradaRow.id,
        lote: (d.lote ?? '').toString().trim() || null,
        caducidadMeses: d.caducidadMeses != null && d.caducidadMeses !== '' ? Number(d.caducidadMeses) : null,
        cantidadXLote: d.cantidadXLote != null && d.cantidadXLote !== '' ? Number(d.cantidadXLote) : null,
      };
      if (d.id) {
        await lastValueFrom(this.datosExternosService.update(d.id, payload));
      } else {
        const created = await lastValueFrom(this.datosExternosService.create(payload));
        d.id = created?.id ?? null;
      }
      delete d.__isNew;
      delete d.__modified;
    }

    // Conservar solo las filas con datos (sin trailing/vaciadas) y refrescar el acordeón si está abierto.
    entradaRow.datosExternos = conDatos;
    this.recomputeCantidadEntrada(entradaRow);
    if (this.selectedEntradaDatosRow === entradaRow) {
      this.cascadeDatosData = [...conDatos, this.buildBlankDatoExterno()];
      if (this.datosExternosGridApi && !this.datosExternosGridApi.isDestroyed()) {
        this.datosExternosGridApi.setGridOption('rowData', this.cascadeDatosData);
      }
    }
  
    this.cdr.detectChanges();}

  onFirstDataRenderedReq(params: any) {
    if (this.gridApi && !this.gridApi.isDestroyed()) {
      this.gridApi.autoSizeAllColumns();
    }
  }

  onFirstDataRenderedOc(params: any) {
    if (this.cascadeOcGridApi && !this.cascadeOcGridApi.isDestroyed()) {
      this.cascadeOcGridApi.autoSizeAllColumns();
    }
  }

  onFirstDataRenderedEntrada(params: any) {
    if (this.nivel4GridApi && !this.nivel4GridApi.isDestroyed()) {
      this.nivel4GridApi.autoSizeAllColumns();
    }
  }

  private buildNivel5ColumnDefs(savedCategoryIds: Set<number> = new Set()): void {
    const colDefs: ColDef[] = [
      {
        headerName: '#',
        width: 45,
        valueGetter: (p) => (p.node?.rowIndex ?? 0) + 1,
        cellStyle: { fontWeight: 'bold' },
      },
    ];

    // Incluir categorías activas + categorías inactivas que ya tienen registro guardado
    if (Array.isArray(this.caracteristicasCategories) && this.caracteristicasCategories.length > 0) {
      this.caracteristicasCategories
        .filter((category: any) => {
          const id = category.id || category.originalId;
          const isActive = category.active && category.vigente !== false;
          return isActive || savedCategoryIds.has(id);
        })
        .forEach((category: any) => {
          const categoryId = category.id || category.originalId;
          const categoryName = category.description || `Categoría ${categoryId}`;

          // Familias activas (active=1 y vigente≠false) para este categoría
          const activeFamilies = this.caracteristicasFamilies
            .filter((family: any) => family.parentId === categoryId && family.active && family.vigente !== false)
            .map((family: any) => family.description);

          const fieldName = `cat_${categoryId}`;

          colDefs.push({
            field: fieldName,
            headerName: categoryName,
            flex: 1,
            minWidth: 150,
            editable: (p: any) => !this.selectedOcRow?.close && !this.selectedMultiEntregaIsClosed && !p?.data?.close,
            cellEditor: 'agRichSelectCellEditor',
            cellEditorParams: (params: any) => {
              const savedValue = params.data?.[fieldName];
              // Si hay un valor guardado que ya no está entre los activos, incluirlo igual
              const values = savedValue && !activeFamilies.includes(savedValue)
                ? [savedValue, ...activeFamilies]
                : activeFamilies;
              return { values, allowTyping: false };
            },
            cellEditorPopup: true,
            cellStyle: { backgroundColor: '#fff9c4' },
          });
        });
    }

    this.nivel5ColDefs = colDefs;
  }

  /** Click en columna OC: comprime otras filas y muestra nivel 4 (entradas) o acordeón multi. */
  async onCascadeOcCellClicked(event: any): Promise<void> {
    if (event.column?.getColId() !== 'folio') return;

    const row = event.data;
    if (!row?.folio) {
      this.clearOcSelection();
      return;
    }

    if (this.selectedOcRow === row || this.selectedOcMultiRow === row) {
      this.clearOcSelection();
      return;
    }

    this.cascadeEntradaData = [];
    this.originalCascadeEntradaData = [];
    this.hasUnsavedChangesEntradas = false;
    this.selectedEntradaRow = null;
    this.resetNivel5Panels();

    if (this.cascadeOcGridApi && !this.cascadeOcGridApi.isDestroyed()) {
      this.cascadeOcGridApi.forEachNode((node: any) => {
        if (node.data === row) node.setRowHeight(undefined);
        else node.setRowHeight(0);
      });
      this.cascadeOcGridApi.onRowHeightChanged();
      this.cascadeOcGridApi.refreshCells({ force: true });
    }

    // Cuando diasCondicionCompra ≠ 1, múltiples entregas → grid Detalle de entregas
    const isMulti = Number(row.diasCondicionCompra ?? 1) !== 1;
    if (isMulti) {
      this.selectedOcRow = null;
      this.selectedOcMultiRow = row;
      if (this.nivel4GridApi && !this.nivel4GridApi.isDestroyed())
        this.nivel4GridApi.setGridOption('rowData', []);
      this.loadMultiEntregas(row);
      return;
    }

    this.selectedOcMultiRow = null;
    this.selectedOcRow = row;

    if (this.nivel4GridApi && !this.nivel4GridApi.isDestroyed())
      this.nivel4GridApi.setGridOption('rowData', []);

    await this.loadEntradasForOc(row);
  
    this.cdr.detectChanges();}

  /** Número efectivo de entregas de una OC (Nivel 3). SIN LÍMITE/COMPRA INMEDIATA → entradas reales;
   *  multi-entrega → entregas reales o el planeado (diasCondicionCompra). */
  private ocEntregasCount(data: any): number {
    const t = String(data?.tipoOc ?? '').toUpperCase();
    if (t === 'COMPRA AUTORIZADA SIN LIMITE' || t === 'COMPRA INMEDIATA') {
      return Number(data?.entradasCount ?? 0);
    }
    const real = Number(data?.entregasCount ?? 0);
    return real > 0 ? real : (Number(data?.diasCondicionCompra ?? 0) || 1);
  }

  /** Carga las entradas (recepciones) de una OC + material en el grid nivel 4. */
  private async loadEntradasForOc(row: any): Promise<void> {
    this.cascadeEntradaData = [];
    this.originalCascadeEntradaData = [];
    this.hasUnsavedChangesEntradas = false;
    this.selectedEntradaRow = null;
    this.resetNivel5Panels();

    try {
      const idMaterial = this.internalParams?.data?.idMaterial;
      const entradas = idMaterial
        ? await lastValueFrom(this.entradaService.getByOcAndMaterial(row.id, idMaterial))
        : await lastValueFrom(this.entradaService.getByOc(row.id));

      const tipoOcNorm = String(row?.tipoOc ?? '').toUpperCase();
      const isSinLimite = tipoOcNorm === 'COMPRA AUTORIZADA SIN LIMITE' || tipoOcNorm === 'COMPRA INMEDIATA';
      this.cascadeEntradaData = (Array.isArray(entradas) ? entradas : []).map((e: EntradaMolienda, i: number) => ({
        id: e.id,
        idEntrada: e.id,
        idEntrega: e.idEntrega ?? null,
        fechaRecepcion: e.fechaRecepcion ? this.isoToLocalDate(String(e.fechaRecepcion)) : null,
        datosExternos: [],   // Nivel 5: lotes (se cargan después y recalculan cantidadEntrada)
        cantidadEntrada: e.cantidadEntrada ?? 0,
        bultos: e.bultos ?? 0,
        revisionConfigu: e.revisionConfigu ?? 0,
        pago: e.pago ?? 0,
        fechaPago: e.fechaPago ? this.isoToLocalDate(String(e.fechaPago)) : null,
        notaFactura: e.notaFactura ?? '',
        // SIN LIMITE: folio secuencial por índice (E1, E2, E3…). Otros tipos: siempre E1.
        folioEntrega: (e.folioEntrega && String(e.folioEntrega).trim())
          ? e.folioEntrega
          : this.buildFolioEntrega(isSinLimite ? i + 1 : 1),
        pdfCount: 0,
        usuario: e.usuario ?? '',
        liberacion: e.liberacion ?? false,
        tipoCambio: e.tipoCambio ?? null,   // Fase 4: TC con que se pagó (para mostrar en MXN)
        moneda: e.moneda ?? null,           // Fase 4: moneda original (para el tooltip del valor original)
        montoMxn: e.montoMxn ?? null,
        credito: e.credito ?? false,
        close: e.close ?? false,
        carat: '',
        comentario: e.comentario ?? '',
      }));
      console.log('Entradas cargadas para OC', row.folio, this.cascadeEntradaData);

      // IVA por entrega: mapear entregas_oc.mas_iva sobre cada entrada (vía idEntrega). Para entradas
      // sin entrega (sin límite/inmediata directa) se usa el IVA de la OC (selectedOcRow/row).
      try {
        const entregas: any[] = await lastValueFrom(this.entregaOcService.getByDetail(row.id)).catch(() => []);
        const masIvaByEntrega = new Map<number, boolean>(
          (Array.isArray(entregas) ? entregas : []).map((g: any) => [g.id, g.masIva === true])
        );
        this.cascadeEntradaData.forEach((entradaRow: any) => {
          entradaRow.masIva = (entradaRow.idEntrega != null && masIvaByEntrega.has(entradaRow.idEntrega))
            ? masIvaByEntrega.get(entradaRow.idEntrega)
            : (row?.masIva === true);
        });
      } catch { /* si falla, las entradas quedan sin IVA por entrega (cae al base) */ }

      // Cargar abreviaciones de características para cada entrada en paralelo
      const familyAbrevMap = new Map<string, string>();
      this.caracteristicasFamilies.forEach((f: any) =>
        familyAbrevMap.set(f.description, f.valueAddition2 ?? f.description)
      );

      await Promise.all(this.cascadeEntradaData.map(async (entradaRow: any) => {
        // Compra Rápida: documentos a nivel del documento CR (compartidos con la sección Compra Rápida).
        const isCR = this.selectedOcRow?.type === 'CR';
        const docParent = isCR ? this.selectedOcRow?.id : (entradaRow.idEntrega ?? entradaRow.idEntrada);
        const docType = isCR ? 'compra_rapida' : (entradaRow.idEntrega != null ? 'entrega' : 'entrada_molienda');
        const documents = await lastValueFrom(
          this.intandoutDocumentsService.getIntandoutDocumentsById(docParent, docType)
        ).catch(() => []);
        entradaRow.pdfCount = Array.isArray(documents) ? documents.length : 0;
        try {
          const carats = await lastValueFrom(this.caracteristicasService.getByEntrada(entradaRow.idEntrada));
          if (carats && carats.length > 0) {
            const parts = carats.map((c: any) => {
              const cat = this.caracteristicasCategories.find((x: any) => (x.id || x.originalId) === c.idCategory);
              const catAbrev = cat?.valueAddition2 || c.categoryName || '';
              const famAbrev = familyAbrevMap.get(c.familySelected) ?? c.familySelected ?? '';
              return `${catAbrev}-${famAbrev}`;
            });
            entradaRow.carat = parts.join(' / ');
          }
        } catch { /* sin características, carat queda vacío */ }

        // Datos externos (Nivel 5): lotes de esta entrada. La suma de cantidad_x_lote
        // recalcula Cantidad Entrada (Nivel 4) para reflejar el valor real guardado.
        if (entradaRow.idEntrada) {
          try {
            const lotes = await lastValueFrom(this.datosExternosService.getByEntrada(entradaRow.idEntrada));
            entradaRow.datosExternos = (Array.isArray(lotes) ? lotes : []).map((d: DatosExternosMolienda) => ({
              id: d.id,
              lote: d.lote ?? '',
              caducidadMeses: d.caducidadMeses ?? null,
              cantidadXLote: d.cantidadXLote ?? null,
            }));
            const suma = entradaRow.datosExternos.reduce((acc: number, d: any) => acc + (Number(d?.cantidadXLote) || 0), 0);
            if (entradaRow.datosExternos.length > 0) entradaRow.cantidadEntrada = suma;
          } catch { entradaRow.datosExternos = []; }
        }
      }));

      this.originalCascadeEntradaData = JSON.parse(JSON.stringify(this.cascadeEntradaData));

      // Compra Rápida: es de UNA sola entrada. Si no hay ninguna registrada, generar
      // una fila por default lista para capturar (sin botón Agregar). Si ya existe, se muestra.
      if (row?.type === 'CR' && this.cascadeEntradaData.length === 0) {
        this.cascadeEntradaData = [this.makeBlankCrEntradaRow()];
      }

      this.syncSelectedOcRestaFromEntradas();
      if (this.nivel4GridApi && !this.nivel4GridApi.isDestroyed()) {
        this.nivel4GridApi.setGridOption('rowData', this.cascadeEntradaData);
        // Columna "Cerrar Entrega" para OCs "COMPRA AUTORIZADA SIN LIMITE" y "COMPRA INMEDIATA".
        const tipoOcUp = String(row?.tipoOc ?? '').toUpperCase();
        const showClose = tipoOcUp === 'COMPRA AUTORIZADA SIN LIMITE' || tipoOcUp === 'COMPRA INMEDIATA';
        this.nivel4GridApi.setColumnVisible('close', showClose);
      }
      // Compra Rápida: posicionar el cursor en "Fecha recepción" de la fila auto-generada.
      if (row?.type === 'CR') this.focusNuevaEntradaFecha();
    } catch (err) {
      console.error('Error cargando entradas:', err);
    }
  
    this.cdr.detectChanges();}

  /**
   * Posiciona el cursor y deja en edición la celda "Fecha recepción" de la fila auto-generada.
   * Con cuidado: solo actúa si la primera fila es la fila NUEVA (__isNew) y nada está cerrado.
   */
  private focusNuevaEntradaFecha(): void {
    setTimeout(() => {
      if (!this.nivel4GridApi || this.nivel4GridApi.isDestroyed()) return;
      if (this.selectedOcRow?.close === true || this.selectedMultiEntregaIsClosed) return;
      const firstNode = this.nivel4GridApi.getDisplayedRowAtIndex(0);
      if (!firstNode?.data?.__isNew) return;
      this.nivel4GridApi.startEditingCell({ rowIndex: 0, colKey: 'fechaRecepcion' });
    }, 60);
  }

  /** Fila vacía por default para una entrada de Compra Rápida (fecha = hoy). */
  /** Arma el Folio de entrega: {folioOC}-{prefixEntrega}{N}. Vacío si es Compra Rápida,
   *  no hay prefijo configurado o no hay folio de OC. N = número de entrega (single = 1). */
  private buildFolioEntrega(n: number): string {
    const folioOc = this.selectedOcRow?.folio ?? '';
    if (this.selectedOcRow?.type === 'CR' || !this.prefixEntrega || !folioOc) return '';
    return `${folioOc}-${this.prefixEntrega}${n}`;
  }

  private makeBlankCrEntradaRow(): any {
    return {
      idEntrada: null,
      fechaRecepcion: new Date(),
      datosExternos: [],
      cantidadEntrada: 0,
      bultos: 0,
      revisionConfigu: 0,
      carat: '',
      pago: 0,
      fechaPago: null,
      notaFactura: '',
      pdfCount: 0,
      usuario: this.signalsService.getDisplayName()() || 'Usuario',
      comentario: '',
      liberacion: false,
      close: false,
      __isNew: true,
    };
  }

  /** Carga las entradas de una ENTREGA específica (multi-entrega) filtradas por material. */
  private async loadEntradasForEntrega(entregaRow: any, ocRow: any): Promise<void> {
    this.cascadeEntradaData = [];
    this.originalCascadeEntradaData = [];
    this.hasUnsavedChangesEntradas = false;
    this.selectedEntradaRow = null;
    this.resetNivel5Panels();

    try {
      const idMaterial = this.internalParams?.data?.idMaterial;
      const idEntrega  = entregaRow?.id;
      // N de entrega = posición de esta entrega (1-based) en multiEntregasData. Fallback = 1.
      const nEntrega = Math.max(1, this.multiEntregasData.indexOf(entregaRow) + 1);

      const entradas = idEntrega && idMaterial
        ? await lastValueFrom(this.entradaService.getByEntregaAndMaterial(idEntrega, idMaterial))
        : await lastValueFrom(this.entradaService.getByOc(ocRow.id));

      this.cascadeEntradaData = (Array.isArray(entradas) ? entradas : []).map((e: EntradaMolienda) => ({
        id: e.id,
        idEntrada: e.id,
        idEntrega: e.idEntrega ?? null,
        fechaRecepcion: e.fechaRecepcion ? this.isoToLocalDate(String(e.fechaRecepcion)) : null,
        datosExternos: [],   // Nivel 5: lotes (se cargan después y recalculan cantidadEntrada)
        cantidadEntrada: e.cantidadEntrada ?? 0,
        bultos: e.bultos ?? 0,
        revisionConfigu: e.revisionConfigu ?? 0,
        pago: e.pago ?? 0,
        fechaPago: e.fechaPago ? this.isoToLocalDate(String(e.fechaPago)) : null,
        notaFactura: e.notaFactura ?? '',
        // Folio de entrega: stored si existe; si no, se calcula con el N de esta entrega.
        folioEntrega: (e.folioEntrega && String(e.folioEntrega).trim()) ? e.folioEntrega : this.buildFolioEntrega(nEntrega),
        pdfCount: 0,
        usuario: e.usuario ?? '',
        liberacion: e.liberacion ?? false,
        tipoCambio: e.tipoCambio ?? null,   // Fase 4: TC con que se pagó (para mostrar en MXN)
        moneda: e.moneda ?? null,           // Fase 4: moneda original (para el tooltip del valor original)
        montoMxn: e.montoMxn ?? null,
        credito: e.credito ?? false,
        close: e.close ?? false,
        carat: '',
        comentario: e.comentario ?? '',
      }));

      const familyAbrevMap = new Map<string, string>();
      this.caracteristicasFamilies.forEach((f: any) =>
        familyAbrevMap.set(f.description, f.valueAddition2 ?? f.description)
      );

      await Promise.all(this.cascadeEntradaData.map(async (entradaRow: any) => {
        // Compra Rápida: documentos a nivel del documento CR (compartidos con la sección Compra Rápida).
        const isCR = this.selectedOcRow?.type === 'CR';
        const docParent = isCR ? this.selectedOcRow?.id : (entradaRow.idEntrega ?? entradaRow.idEntrada);
        const docType = isCR ? 'compra_rapida' : (entradaRow.idEntrega != null ? 'entrega' : 'entrada_molienda');
        const documents = await lastValueFrom(
          this.intandoutDocumentsService.getIntandoutDocumentsById(docParent, docType)
        ).catch(() => []);
        entradaRow.pdfCount = Array.isArray(documents) ? documents.length : 0;
        try {
          const carats = await lastValueFrom(this.caracteristicasService.getByEntrada(entradaRow.idEntrada));
          if (carats && carats.length > 0) {
            const parts = carats.map((c: any) => {
              const cat = this.caracteristicasCategories.find((x: any) => (x.id || x.originalId) === c.idCategory);
              const catAbrev = cat?.valueAddition2 || c.categoryName || '';
              const famAbrev = familyAbrevMap.get(c.familySelected) ?? c.familySelected ?? '';
              return `${catAbrev}-${famAbrev}`;
            });
            entradaRow.carat = parts.join(' / ');
          }
        } catch { /* sin características */ }

        // Datos externos (Nivel 5): lotes de esta entrada; recalculan Cantidad Entrada.
        if (entradaRow.idEntrada) {
          try {
            const lotes = await lastValueFrom(this.datosExternosService.getByEntrada(entradaRow.idEntrada));
            entradaRow.datosExternos = (Array.isArray(lotes) ? lotes : []).map((d: DatosExternosMolienda) => ({
              id: d.id,
              lote: d.lote ?? '',
              caducidadMeses: d.caducidadMeses ?? null,
              cantidadXLote: d.cantidadXLote ?? null,
            }));
            const suma = entradaRow.datosExternos.reduce((acc: number, d: any) => acc + (Number(d?.cantidadXLote) || 0), 0);
            if (entradaRow.datosExternos.length > 0) entradaRow.cantidadEntrada = suma;
          } catch { entradaRow.datosExternos = []; }
        }
      }));

      this.originalCascadeEntradaData = JSON.parse(JSON.stringify(this.cascadeEntradaData));

      // Multi-entrega: cada entrega = 1 recepción. Si no hay entrada registrada, generar
      // 1 fila por default (fecha = la de la entrega). Si ya existe, se muestra esa.
      if (this.cascadeEntradaData.length === 0) {
        const blank = this.makeBlankCrEntradaRow();
        if (entregaRow?.fechaEntrega) blank.fechaRecepcion = this.isoToLocalDate(String(entregaRow.fechaEntrega));
        blank.folioEntrega = this.buildFolioEntrega(nEntrega);
        this.cascadeEntradaData = [blank];
      }

      this.syncSelectedOcRestaFromEntradas();
      if (this.nivel4GridApi && !this.nivel4GridApi.isDestroyed()) {
        this.nivel4GridApi.setGridOption('rowData', this.cascadeEntradaData);
        // En multi-entregas no aplica el cierre por entrada → ocultar la columna.
        this.nivel4GridApi.setColumnVisible('close', false);
      }
      // Nivel 5 multi-entrega: posicionar el cursor en "Fecha recepción" de la fila auto-generada.
      this.focusNuevaEntradaFecha();
    } catch (err) {
      console.error('Error cargando entradas por entrega:', err);
    }
  
    this.cdr.detectChanges();}

  private clearOcSelection(): void {
    this.selectedOcRow = null;
    this.selectedOcMultiRow = null;
    this.cascadeEntradaData = [];
    this.multiEntregasData = [];
    this.selectedMultiEntregaCaratRow = null;
    this.resetNivel5Panels();
    if (this.cascadeOcGridApi && !this.cascadeOcGridApi.isDestroyed()) {
      this.cascadeOcGridApi.forEachNode((node: any) => node.setRowHeight(undefined));
      this.cascadeOcGridApi.onRowHeightChanged();
      this.cascadeOcGridApi.refreshCells({ force: true });
    }
  }

  /** Cierra/reinicia los paneles de Nivel 5 (Datos externos + Características) para que NO queden
   *  "pegados" mostrando la entrada anterior al cambiar de OC, requisición o entrada. */
  private resetNivel5Panels(): void {
    this.selectedEntradaDatosRow = null;
    this.cascadeDatosData = [];
    this.selectedEntradaCaratRow = null;
    this.cascadeCaratData = [];
    this.cascadeMpCaractData = [];
    this.selectedRevisorId = null;
    this.existingCaratIds.clear();
    this.hasUnsavedChangesCaracteristicas = false;
  }

  // ── Nivel 4 múltiples entregas: carga + CRUD ──────────────────────
  get materialNombre(): string {
    return this.internalParams?.data?.id_articulo ?? '';
  }

  onMultiEntregasGridReady(params: GridReadyEvent) {
    this.multiEntregasGridApi = params.api;
    if (this.multiEntregasData.length)
      this.multiEntregasGridApi.setGridOption('rowData', this.multiEntregasData);
  }

  async onMultiEntregaCellClicked(event: any): Promise<void> {
    if (event.column?.getColId() !== 'cantidadRecibir') return;
    const row = event.data;
    const closing = this.selectedMultiEntregaCaratRow === row;
    this.selectedMultiEntregaCaratRow = closing ? null : row;
    this.selectedMultiEntregaIsClosed = !closing && (row.close === true);

    if (this.multiEntregasGridApi && !this.multiEntregasGridApi.isDestroyed()) {
      this.multiEntregasGridApi.forEachNode((node: any) => {
        node.setRowHeight(closing || node.data === row ? undefined : 0);
      });
      this.multiEntregasGridApi.onRowHeightChanged();
      this.multiEntregasGridApi.refreshCells({ force: true });
    }

    // Abre/cierra el grid de Entradas (nivel 5) apuntando a la entrega seleccionada.
    if (closing) {
      this.selectedOcRow = null;
      this.cascadeEntradaData = [];
      this.hasUnsavedChangesEntradas = false;
      this.selectedEntradaRow = null;
      this.resetNivel5Panels();
      return;
    }

    this.resetNivel5Panels();
    this.selectedOcRow = this.selectedOcMultiRow;
    await this.loadEntradasForEntrega(row, this.selectedOcMultiRow);
  
    this.cdr.detectChanges();}

  private loadMultiEntregas(ocRow: any): void {
    this.multiEntregasData = [];
    this.selectedMultiEntregaCaratRow = null;
    const idDetail = Number(ocRow?.idDetail);
    if (!idDetail) {
      if (this.multiEntregasGridApi && !this.multiEntregasGridApi.isDestroyed())
        this.multiEntregasGridApi.setGridOption('rowData', []);
      return;
    }

    this.entregaOcService.getByDetail(idDetail).subscribe({
      next: (saved) => {
        const list = Array.isArray(saved) ? saved : [];
        // Para armar el Folio de entrega cuando la entrega aún no tiene entrada vinculada:
        // {folioOC}-{prefijo}{N}. Se sobreescribe más abajo con el folio real de la entrada si existe.
        const folioOc = ocRow?.folio ?? '';
        const canBuildFolio = ocRow?.type !== 'CR' && !!this.prefixEntrega && !!folioOc;
        this.multiEntregasData = list.map((s, idx) => ({
          id: s.id ?? null,
          idDetailsreqoc: s.idDetailsreqoc,
          fechaEntrega: s.fechaEntrega ?? '',
          cantidadRecibir: s.cantidadRecibir ?? null,
          notaFactura: s.notaFactura ?? '',
          totalEntrega: s.totalEntrega ?? null,
          folioEntrega: canBuildFolio ? `${folioOc}-${this.prefixEntrega}${idx + 1}` : '',
          fechaEntradaAlmacen: s.fechaEntradaAlmacen ?? '',
          close: s.close ?? false,
        }));

        // Poblar fechaEntradaAlmacen y Resta agrupando entradas por id_entrega
        const idMaterial = this.internalParams?.data?.idMaterial;
        if (ocRow?.id && idMaterial) {
          this.entradaService.getByOcAndMaterial(ocRow.id, idMaterial).subscribe({
            next: (entradas) => {
              const list2 = Array.isArray(entradas) ? entradas : [];

              // Agrupar entradas por idEntrega
              const byEntrega = new Map<number, any[]>();
              list2.forEach((e: any) => {
                const key = e.idEntrega ?? null;
                if (key !== null) {
                  if (!byEntrega.has(key)) byEntrega.set(key, []);
                  byEntrega.get(key)!.push(e);
                }
              });

              this.multiEntregasData.forEach((entregaRow: any) => {
                const group = byEntrega.get(entregaRow.id) ?? [];
                // fechaEntradaAlmacen: primera entrada con fecha
                const conFecha = group.find((e: any) => e.fechaRecepcion);
                if (conFecha) {
                  const iso = String(conFecha.fechaRecepcion).match(/^(\d{4})-(\d{2})-(\d{2})/);
                  if (iso) entregaRow.fechaEntradaAlmacen = `${iso[1]}-${iso[2]}-${iso[3]}`;
                }
                // Folio de entrega real: el de la entrada vinculada (entradas_molienda.folio_entrega).
                const conFolio = group.find((e: any) => e.folioEntrega && String(e.folioEntrega).trim());
                if (conFolio) entregaRow.folioEntrega = conFolio.folioEntrega;
                // Resta: cantidadRecibir - suma de cantidadEntrada
                const sumRecibido = group.reduce((acc: number, e: any) => acc + Number(e.cantidadEntrada ?? 0), 0);
                entregaRow.resta = Number(entregaRow.cantidadRecibir ?? 0) - sumRecibido;
              });

              if (this.multiEntregasGridApi && !this.multiEntregasGridApi.isDestroyed()) {
                this.multiEntregasGridApi.setGridOption('rowData', this.multiEntregasData);
              }
            },
            error: () => {}
          });
        }

        if (this.multiEntregasGridApi && !this.multiEntregasGridApi.isDestroyed()) {
          this.multiEntregasGridApi.setGridOption('rowData', this.multiEntregasData);
          setTimeout(() => { if (!this.multiEntregasGridApi.isDestroyed()) this.multiEntregasGridApi.autoSizeAllColumns(); });
        }
        this.refreshOcLockIcon();
      },
      error: () => {
        this.multiEntregasData = [];
        if (this.multiEntregasGridApi && !this.multiEntregasGridApi.isDestroyed())
          this.multiEntregasGridApi.setGridOption('rowData', []);
      },
    });
  }

  private isoToLocalDate(isoStr: string): Date {
    const m = isoStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(isoStr);
  }

  private formatFechaDmy(value: any): string {
    if (!value) return '';
    const str = String(value).trim();
    const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
    return str;
  }

  /** Datos demo nivel 4 — reemplazar por GET entradas por OC cuando exista backend. */
  private buildMockEntradasForOc(oc: any): any[] {
    const seed = String(oc?.folio ?? oc?.id ?? 'x');
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;

    const usuarios = ['Pedro', 'Juan', 'María'];
    const base = [
      { dias: 0, cant: 10000, bultos: 120, rev: 12, pago: 15000, u: 0, lib: true },
      { dias: 2, cant: 5000, bultos: 60, rev: 6, pago: 7500, u: 1, lib: true },
      { dias: 3, cant: 1000, bultos: 12, rev: 2, pago: 1500, u: 0, lib: false },
    ];

    const y = 2026;
    const m = 4;
    return base.map((b, idx) => {
      const day = 1 + ((h + idx * 7) % 28);
      const idEntrada = ((h >>> 0) % 9000) + idx + 1;
      return {
        idEntrada,
        fechaRecepcion: new Date(y, m, Math.min(day, 28)),
        cantidadEntrada: b.cant,
        bultos: b.bultos,
        revisionConfigu: b.rev,
        carat: true,
        pago: b.pago,
        pdfCount: 1,
        usuario: usuarios[b.u % usuarios.length],
        comentario: '',
        liberacion: b.lib,
      };
    });
  }

  private fmtEntero(v: any): string {
    if (v == null || v === '') return '';
    return Number(v).toLocaleString('es-MX');
  }

  /**
   * Fase 4 (almacén): convierte un valor a MXN SOLO si la entrada ya está pagada (liberacion=true)
   * y trae tipo de cambio. Mientras no se pague, se muestra el valor en su moneda original.
   * El almacén siempre ve el monto "en seco" (sin abreviatura ni TC), ya en pesos una vez pagado.
   */
  private toMxnIfPaid(row: any, val: any): number {
    const v = Number(val) || 0;
    const tc = Number(row?.tipoCambio) || 0;
    return (row?.liberacion && tc > 0) ? v * tc : v;
  }

  // ── Fase 4: precio/total por entrada para el almacén (convertido a MXN solo si la entrada está pagada). ──

  /** Precio unitario base de la OC (con IVA si aplica), en moneda ORIGINAL. */
  private ocPrecioBase(oc: any): number {
    const base = Number(oc?.price) || 0;
    return Math.round((oc?.masIva ? base * (1 + this.ivaPercent / 100) : base) * 100) / 100;
  }

  /** ¿La entrada ya se pagó y convirtió a MXN? */
  private entradaEsMxn(e: any): boolean { return !!(e?.liberacion && Number(e?.tipoCambio) > 0); }

  /** Precio unitario a mostrar de una entrada: MXN (monto_mxn/cant) si pagada; original si no. */
  private entradaUnit(oc: any, e: any): number {
    const cant = Number(e?.cantidadEntrada) || 0;
    if (this.entradaEsMxn(e) && Number(e?.montoMxn) > 0 && cant > 0) {
      return Math.round((Number(e.montoMxn) / cant) * 100) / 100;
    }
    return this.ocPrecioBase(oc);
  }

  /** Total a mostrar de una entrada: monto_mxn si pagada; precio×cant original si no. */
  private entradaTotal(oc: any, e: any): number {
    const cant = Number(e?.cantidadEntrada) || 0;
    if (this.entradaEsMxn(e) && Number(e?.montoMxn) > 0) return Number(e.montoMxn);
    return this.ocPrecioBase(oc) * cant;
  }

  /** Última entrada PAGADA de la OC (la que define el precio convertido del Nivel 3). */
  private ultimaEntradaPagada(oc: any): any {
    const arr = Array.isArray(oc?.__entradas) ? oc.__entradas : [];
    let last: any = null;
    for (const e of arr) if (this.entradaEsMxn(e)) last = e;
    return last;
  }

  /** Etiqueta de moneda de la moneda original de la OC (USD/EUR/MXN). */
  private ocMonedaOriginal(oc: any): string {
    return (String(oc?.moneda || '').trim().toUpperCase()) || 'MXN';
  }

  /** Precio unitario que muestra la celda de Nivel 3: última entrada pagada (MXN) o el original. */
  private nivel3PrecioCelda(oc: any): number {
    const last = this.ultimaEntradaPagada(oc);
    return last ? this.entradaUnit(oc, last) : this.ocPrecioBase(oc);
  }

  /** Tooltip histórico del Nivel 3: una fila por entrada [Entrada, Cantidad, Precio, Total] + suma. */
  buildNivel3PrecioTooltip(oc: any): any {
    const arr = Array.isArray(oc?.__entradas) ? oc.__entradas : [];
    if (!arr.length) return null;
    let suma = 0;
    const rows = arr.map((e: any, i: number) => {
      const cant = Number(e?.cantidadEntrada) || 0;
      const unit = this.entradaUnit(oc, e);
      const total = this.entradaTotal(oc, e);
      suma += total;
      const mon = this.entradaEsMxn(e) ? 'MXN' : (String(e?.moneda || oc?.moneda || '').toUpperCase() || 'MXN');
      const etiqueta = e?.folioEntrega || ('E' + (i + 1));
      return [etiqueta, this.fmtEntero(cant), `${this.fmtMoneda(unit)} ${mon}`, `${this.fmtMoneda(total)} ${mon}`];
    });
    return {
      title: 'Histórico de entradas',
      table: { headers: ['Entrada', 'Cantidad', 'Precio', 'Total'], rows, totalFmt: this.fmtMoneda(suma) },
    };
  }

  /** Etiqueta de moneda para una fila de entrada (Nivel 4): MXN si pagada, original si no. */
  private nivel4Moneda(e: any): string {
    if (this.entradaEsMxn(e)) return 'MXN';
    return (String(e?.moneda || this.selectedOcRow?.moneda || '').toUpperCase()) || 'MXN';
  }

  /** Tooltip con el valor ORIGINAL (moneda extranjera) de una entrada ya convertida a MXN. null si no aplica. */
  private nivel4OriginalTooltip(e: any, originalVal: any): string | null {
    if (!this.entradaEsMxn(e)) return null;                 // aún no convertida → nada que mostrar
    // Moneda original: la de la entrada; si faltara, la de la OC (selectedOcRow).
    const orig = (String(e?.moneda || this.selectedOcRow?.moneda || '').toUpperCase());
    if (!orig || orig === 'MXN') return null;               // era MXN → no hay original distinto
    return `Original: ${this.fmtMoneda(originalVal)} ${orig}`;
  }

  private fmtMoneda(v: any): string {
    if (v == null || v === '') return '';
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(Number(v));
  }

  async loadData() {
    if (this.detailType === 'salidas') {
      await this.loadSalidasData();
      return;
    }
    if (this.entradasSimple) {
      await this.loadEntradasSimpleData();
      return;
    }

    const idMolienda = this.internalParams?.data?.id;
    if (!idMolienda || typeof idMolienda === 'string') {
      this.rowData = [];
      if (this.gridApi && !this.gridApi.isDestroyed())
        this.gridApi.setGridOption('rowData', []);
      return;
    }

    try {
      const type = 'ENTRADA';
      const items = await lastValueFrom(this.moliendaService.getDetails(idMolienda, type));
      this.rowData = (Array.isArray(items) ? items : []).map((d: any) => {
        const req = this.reqOptions.find(r => r.id === d.idRequisition);
        return {
          id: d.id,
          idRequisition: d.idRequisition ?? null,
          folio: req?.folio ?? '',
          cantidadReq: d.cantidadReq ?? 0,
          numCantidadOc: req?.numCantidadOc ?? 0,
          cantidad: d.cantidad ?? 0,
          idCatalog: d.idCatalog ?? null,
        };
      });
      this.rowData = await this.enrichReqRowsWithResta(this.rowData);
      if (this.gridApi && !this.gridApi.isDestroyed())
        this.gridApi.setGridOption('rowData', this.rowData);
      this.updateParentCount();
      this.loadReqEntregasSums();
      this.loadCompraRapidaRows();
    } catch (error) {
      console.error('Error loading details molienda:', error);
    }
  
    this.cdr.detectChanges();}

  private buildSalidasColDefs(usuarioHeader: string = 'Quien utilizó'): ColDef[] {
    return [
      {
        field: 'fecha',
        headerName: 'Fecha',
        width: 110,
        editable: false,
        valueFormatter: (p) => {
          if (!p.value) return '—';
          const d = new Date(p.value);
          if (isNaN(d.getTime())) return String(p.value);
          const dd = String(d.getDate()).padStart(2, '0');
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          return `${dd}/${mm}/${d.getFullYear()}`;
        },
      },

      {
        field: 'lote',
        headerName: 'Lote',
        width: 130,
        editable: false,
        valueFormatter: (p) => (p.value ?? '').toUpperCase(),
      },
      {
        field: 'cantidad',
        headerName: 'Cantidad',
        width: 100,
        editable: false,
        type: 'numericColumn',
      },
      {
        field: 'usuario',
        headerName: usuarioHeader,
        flex: 1,
        minWidth: 140,
        editable: false,
        valueFormatter: (p) => (p.value ?? '').toUpperCase(),
      },
    ];
  }

  private async ensureBoteDescMap(idCompany: number): Promise<void> {
    if (this.boteDescMap) return;
    this.boteDescMap = new Map();
    try {
      const catalogs = await lastValueFrom(this.catalogService.getAll(idCompany));
      const botesCatalog = (catalogs ?? []).find((c: any) => {
        const d = (c.description || '').trim().toLowerCase()
          .normalize('NFD').replace(/[̀-ͯ]/g, '');
        return d.startsWith('botes molienda') || d.startsWith('botes');
      });
      if (!botesCatalog) return;
      const items = await lastValueFrom(this.mxmService.getByCatalog(idCompany, botesCatalog.id));
      for (const item of (items ?? [])) {
        const year = String(item.anio ?? new Date().getFullYear()).slice(-2);
        const num = item.numBote ?? '';
        const contador = item.contador ?? 1;
        this.boteDescMap.set(item.id, `${year}/${item.cantidad ?? ''}-${num}/${contador}`);
      }
    } catch (e) {
      console.error('Error cargando catálogo de botes:', e);
    }
  }

  private async loadEntradasSimpleData() {
    const idMaterial = this.internalParams?.data?.idMaterial;
    const idSucursal = this.internalParams?.data?.sucursal;
    const idCompany  = this.signalsService.getRootSelectedBySidebar()();
    if (!idMaterial || !idSucursal || !idCompany) {
      this.rowData = [];
      if (this.gridApi && !this.gridApi.isDestroyed())
        this.gridApi.setGridOption('rowData', []);
      return;
    }
    try {
      await this.ensureBoteDescMap(idCompany);

      const moliendas = await lastValueFrom(
        this.productionService.getMoliendaByCompanyAndSucursal(idCompany, idSucursal)
      );
      const matching = (Array.isArray(moliendas) ? moliendas : [])
        .filter(m => m.idMatPrima === idMaterial && m.active !== false);

      if (!matching.length) {
        this.rowData = [];
        if (this.gridApi && !this.gridApi.isDestroyed())
          this.gridApi.setGridOption('rowData', []);
        this.updateParentCount();
        return;
      }

      const allDetallesArrays = await Promise.all(
        matching.map(m => lastValueFrom(this.productionService.getMoliendaMatDetalleByMolienda(m.id!)))
      );
      const allDetalles: any[] = allDetallesArrays.flat();

      const botesPerDetalle = await Promise.all(
        allDetalles.map(d => lastValueFrom(this.productionService.getMoliendaBoteByMatDetalle(d.id)))
      );

      this.rowData = allDetalles.map((d: any, idx: number) => {
        const botes: any[] = botesPerDetalle[idx] ?? [];
        const activos = botes.filter(b => (b.cantidad ?? 0) > 0);
        const lote = activos.length
          ? activos.map(b => {
              const desc = this.boteDescMap?.get(b.idBoteCatalog);
              return desc ? `${desc} (${b.cantidad})` : `BOTE #${b.idBoteCatalog} (${b.cantidad})`;
            }).join(', ')
          : 'SIN ASIGNAR';

        return {
          fecha:    d.fechaMolienda ? String(d.fechaMolienda).split('T')[0] : null,
          lote,
          cantidad: d.jugo ?? 0,
          usuario:  (d.usuario ?? '').toUpperCase(),
        };
      });

      if (this.gridApi && !this.gridApi.isDestroyed()) {
        this.gridApi.setGridOption('rowData', this.rowData);
        setTimeout(() => { if (this.gridApi && !this.gridApi.isDestroyed()) this.gridApi.autoSizeAllColumns(); });
      }
      this.updateParentCount();
    } catch (error) {
      console.error('Error loading entradas simple (produccion):', error);
      this.rowData = [];
      if (this.gridApi && !this.gridApi.isDestroyed())
        this.gridApi.setGridOption('rowData', []);
    }
  
    this.cdr.detectChanges();}

  private async loadSalidasData() {
    const idMaterial = this.internalParams?.data?.idMaterial;
    const idSucursal = this.internalParams?.data?.sucursal;
    if (!idMaterial || !idSucursal) {
      this.rowData = [];
      if (this.gridApi && !this.gridApi.isDestroyed())
        this.gridApi.setGridOption('rowData', []);
      return;
    }
    try {
      const items = await lastValueFrom(this.salidasMpService.getResumen(idMaterial, idSucursal));
      this.rowData = (Array.isArray(items) ? items : []).map((s: any) => ({
        folioEntrada: s.folioEntrada ?? '',
        lote:         (s.lote ?? '').toUpperCase(),
        fecha:        s.fecha ?? null,
        cantidad:     s.cantidad ?? 0,
        usuario:      (s.usuario ?? '').toUpperCase(),
      }));
      if (this.gridApi && !this.gridApi.isDestroyed()) {
        this.gridApi.setGridOption('rowData', this.rowData);
        setTimeout(() => { if (this.gridApi && !this.gridApi.isDestroyed()) this.gridApi.autoSizeAllColumns(); });
      }
      this.updateParentCount();
    } catch (error) {
      console.error('Error loading salidas MP:', error);
    }
  
    this.cdr.detectChanges();}

  /** Fase 1: agrega filas de Compra Rápida (del material+sucursal) al nivel 2, junto a las OCs.
   *  Cada fila CR agrupa los items de compra rápida de una requisición para ese material. */
  private async loadCompraRapidaRows(): Promise<void> {
    const idBranch = this.internalParams?.data?.sucursal;
    const idMaterial = this.internalParams?.data?.idMaterial;
    // Las compras rápidas son entradas; no aplican en el detalle de salidas.
    if (this.detailType !== 'entradas' || !idBranch || !idMaterial) return;
    try {
      const items = await lastValueFrom(
        this.ocAndReqsService.getCompraRapidaItems(idBranch, idMaterial)
      ).catch(() => []);
      const list = Array.isArray(items) ? items : [];
      if (!list.length) return;

      const byReq = new Map<number, any>();
      for (const it of list) {
        const key = it.reqId;
        if (!byReq.has(key)) {
          byReq.set(key, {
            __isCompraRapida: true,
            id: null,
            idRequisition: it.reqId,
            folio: it.reqFolio || '',
            cantidadReq: 0,
            numCantidadOc: 0,
            requestDate: it.requestDate || null,
            crItems: [],
          });
        }
        const r = byReq.get(key);
        r.cantidadReq += Number(it.quantity ?? 0);
        r.numCantidadOc += 1;
        r.crItems.push(it);
      }

      const crRows = Array.from(byReq.values());
      crRows.forEach((r: any) => { r.resta = r.cantidadReq; }); // Fase 1: sin entradas aún

      this.rowData = [...this.rowData, ...crRows];
      if (this.gridApi && !this.gridApi.isDestroyed()) {
        this.gridApi.setGridOption('rowData', this.rowData);
      }
      // Recontar "Entradas" del nivel 1 incluyendo ahora las filas de compra rápida.
      this.updateParentCount();
    } catch (err) {
      console.error('Error cargando compras rápidas:', err);
    }
  
    this.cdr.detectChanges();}

  async onCellClicked(event: any) {
    if (event.column?.getColId() !== 'folio') return;

    const row = event.data;
    if (!row?.idRequisition) {
      this.selectedReqRow = null;
      this.cascadeOcData = [];
      this.clearOcSelection();
      if (this.gridApi) {
        this.gridApi.forEachNode((node: any) => node.setRowHeight(undefined));
        this.gridApi.onRowHeightChanged();
      }
      return;
    }

    if (this.selectedReqRow === row) {
      this.selectedReqRow = null;
      this.cascadeOcData = [];
      this.clearOcSelection();
      if (this.gridApi) {
        this.gridApi.forEachNode((node: any) => node.setRowHeight(undefined));
        this.gridApi.onRowHeightChanged();
        this.gridApi.refreshCells({ force: true });
      }
      return;
    }

    this.clearOcSelection();
    this.selectedReqRow = row;

    if (this.gridApi) {
      this.gridApi.forEachNode((node: any) => {
        if (node.data === row) {
          node.setRowHeight(undefined);
        } else {
          node.setRowHeight(0);
        }
      });
      this.gridApi.onRowHeightChanged();
    }

    try {
      // OCs + Compras Rápidas (getOcsByReqMaterial ya incluye type='CR') filtradas por requisición + material.
      const idMaterial = this.internalParams?.data?.idMaterial;
      const matchedOcs: any = idMaterial
        ? await lastValueFrom(
            this.ocAndReqsService.getOcsByReqMaterial(row.idRequisition, idMaterial, this.deptsCsv)
          ).catch(() => [])
        : [];

      this.cascadeOcData = await this.enrichOcsWithResta(Array.isArray(matchedOcs) ? matchedOcs : [], idMaterial);
      this.loadOcEntregasSums(idMaterial);
    } catch (err) {
      console.error('Error cargando OCs:', err);
      this.cascadeOcData = [];
    }

    if (this.cascadeOcGridApi && !this.cascadeOcGridApi.isDestroyed())
      this.cascadeOcGridApi.setGridOption('rowData', this.cascadeOcData);
    if (this.gridApi) this.gridApi.refreshCells({ force: true });
  
    this.cdr.detectChanges();}

  private async enrichOcsWithResta(ocs: any[], idMaterial: number | null | undefined): Promise<any[]> {
    if (!Array.isArray(ocs) || ocs.length === 0) return [];

    return Promise.all(
      ocs.map(async (oc: any) => {
        try {
          const entradas = idMaterial
            ? await lastValueFrom(this.entradaService.getByOcAndMaterial(oc.id, idMaterial))
            : await lastValueFrom(this.entradaService.getByOc(oc.id));

          const arr = Array.isArray(entradas) ? entradas : [];
          const sumaEntradas = arr
            .reduce((acc: number, entrada: any) => acc + Number(entrada?.cantidadEntrada ?? 0), 0);

          return {
            ...oc,
            resta: Number(oc?.cantidad ?? 0) - sumaEntradas,
            // Conteo real de entradas (usado por "Cantidad Entregas" en OCs SIN LÍMITE).
            entradasCount: arr.length,
            // Fase 4: entradas de la OC (para convertir el precio del Nivel 3 + tooltip histórico).
            __entradas: arr,
          };
        } catch (error) {
          console.error(`Error cargando entradas para la OC ${oc?.id}:`, error);
          return {
            ...oc,
            resta: Number(oc?.cantidad ?? 0),
            entradasCount: 0,
          };
        }
      })
    );
  
    this.cdr.detectChanges();}

  private async loadOcEntregasSums(idMaterial: number | null | undefined): Promise<void> {
    if (!idMaterial || !this.cascadeOcData.length) return;
    await Promise.all(this.cascadeOcData.map(async (oc: any) => {
      try {
        const items: any[] = await lastValueFrom(
          this.ocAndReqsService.getReqItems(oc.id)
        ).catch(() => []);
        const materialItem = items.find((it: any) =>
          Number(it.idSupplie ?? it.idsupplie ?? 0) === Number(idMaterial)
        );
        if (materialItem?.id) {
          const entregas: any[] = await lastValueFrom(
            this.entregaOcService.getByDetail(materialItem.id)
          ).catch(() => []);
          const suma = entregas.reduce((acc: number, e: any) => acc + Number(e.cantidadRecibir ?? 0), 0);
          oc.__sumaCantidadRecibir = suma > 0 ? suma : null;
          // "Cantidad Entregas": N = total de entregas (filas del Detalle de entregas);
          // cerradas = entregas con "Cerrado Entrega" (entregas_oc.close = true).
          const arrEntregas = Array.isArray(entregas) ? entregas : [];
          oc.entregasPlaneadas = arrEntregas.length;
          oc.entregasCerradas = arrEntregas.filter((e: any) => e?.close === true).length;
        } else {
          oc.__sumaCantidadRecibir = null;
          oc.entregasPlaneadas = 0;
          oc.entregasCerradas = 0;
        }
      } catch { oc.__sumaCantidadRecibir = null; oc.entregasPlaneadas = 0; oc.entregasCerradas = 0; }
    }));
    if (this.cascadeOcGridApi && !this.cascadeOcGridApi.isDestroyed())
      this.cascadeOcGridApi.refreshCells({ columns: ['cantidad', 'entregasCount'], force: true });
  
    this.cdr.detectChanges();}

  private async loadReqEntregasSums(): Promise<void> {
    const idMaterial = Number(this.internalParams?.data?.idMaterial ?? 0);
    await Promise.all(this.rowData.map(async (row: any) => {
      if (!Array.isArray(row.ocs) || row.ocs.length === 0) { row.__sumaCantidadRecibir = null; return; }
      try {
        let suma = 0;
        let hayDelta = false;
        for (const oc of row.ocs) {
          const items: any[] = await lastValueFrom(
            this.ocAndReqsService.getReqItems(oc.id)
          ).catch(() => []);
          const materialItem = items.find((it: any) =>
            Number(it.idSupplie ?? it.idsupplie ?? 0) === idMaterial
          );
          if (materialItem?.id) {
            const entregas: any[] = await lastValueFrom(
              this.entregaOcService.getByDetail(materialItem.id)
            ).catch(() => []);
            const sumEntregas = entregas.reduce((acc: number, e: any) => acc + Number(e.cantidadRecibir ?? 0), 0);
            if (sumEntregas > 0) hayDelta = true;
            // Si tiene entregas usa el delta (suma cantidadRecibir), si no usa la cantidad del ítem
            suma += sumEntregas > 0 ? sumEntregas : Number(materialItem.quantity ?? materialItem.cantidad ?? 0);
          }
        }
        // Solo mostrar denominador si al menos un proveedor tiene delta
        row.__sumaCantidadRecibir = hayDelta ? suma : null;
      } catch { row.__sumaCantidadRecibir = null; }
    }));
    if (this.gridApi && !this.gridApi.isDestroyed())
      this.gridApi.refreshCells({ columns: ['cantidadReq'], force: true });
  
    this.cdr.detectChanges();}

  private async enrichReqRowsWithResta(rows: any[]): Promise<any[]> {
    if (!Array.isArray(rows) || rows.length === 0) return [];

    const idMaterial = this.internalParams?.data?.idMaterial;
    if (!idMaterial) {
      return rows.map((row: any) => ({ ...row, resta: 0 }));
    }

    return Promise.all(
      rows.map(async (row: any) => {
        if (!row?.idRequisition) {
          return { ...row, resta: 0 };
        }

        try {
          const matchedOcs: any = await lastValueFrom(
            this.ocAndReqsService.getOcsByReqMaterial(row.idRequisition, idMaterial, this.deptsCsv)
          ).catch(() => []);

          const ocsWithResta = await this.enrichOcsWithResta(
            Array.isArray(matchedOcs) ? matchedOcs : [],
            idMaterial
          );

          const resta = ocsWithResta.reduce((acc: number, oc: any) => acc + Number(oc?.resta ?? 0), 0);
          return { ...row, resta, ocs: ocsWithResta };
        } catch (error) {
          console.error(`Error calculando resta para la requisición ${row?.idRequisition}:`, error);
          return { ...row, resta: 0 };
        }
      })
    );
  
    this.cdr.detectChanges();}

  private updateParentCount() {
    if (!this.internalParams?.node) return;
    const data = this.internalParams.node.data;
    const countField = this.detailType === 'entradas' ? 'entradas' : 'salidas';
    data[countField] = this.rowData.length;

    if (this.internalParams.api) {
      this.internalParams.api.refreshCells({
        rowNodes: [this.internalParams.node],
        columns: [countField],
        force: true,
      });
    }
  }

  // ── CRUD Methods para tabla Entradas (Nivel 4) ──

  addEntrada() {
    if (!this.nivel4GridApi) return;

    const usuarioLogueado = this.signalsService.getDisplayName()() || 'Usuario';

    // Compra Rápida: la fecha de recepción por default es HOY (día de captura).
    // OC: fecha de la entrega seleccionada, o la de la OC, o la fecha actual.
    const fechaDefault = this.selectedOcRow?.type === 'CR'
      ? new Date()
      : this.selectedMultiEntregaCaratRow?.fechaEntrega
      ? this.isoToLocalDate(String(this.selectedMultiEntregaCaratRow.fechaEntrega))
      : this.selectedOcRow?.fechaXEntrega
      ? this.isoToLocalDate(String(this.selectedOcRow.fechaXEntrega))
      : new Date();

    // N de entrega: secuencial para SIN LIMITE, índice multi-entrega, o 1 para single-entrega.
    const tipoOcAdd = String(this.selectedOcRow?.tipoOc ?? '').toUpperCase();
    const isSinLimiteAdd = tipoOcAdd === 'COMPRA AUTORIZADA SIN LIMITE' || tipoOcAdd === 'COMPRA INMEDIATA';
    const nEntrega = isSinLimiteAdd
      ? this.cascadeEntradaData.length + 1
      : this.selectedMultiEntregaCaratRow
        ? (this.multiEntregasData.indexOf(this.selectedMultiEntregaCaratRow) + 1)
        : 1;

    const newRow = {
      idEntrada: null,
      fechaRecepcion: fechaDefault,
      datosExternos: [],   // Nivel 5: lotes (Cantidad Entrada = suma de Cantidad x Lote)
      cantidadEntrada: 0,
      bultos: 0,
      revisionConfigu: 0,
      carat: false,
      pago: 0,
      fechaPago: null,
      notaFactura: '',
      folioEntrega: this.buildFolioEntrega(nEntrega),
      pdfCount: 0,
      usuario: usuarioLogueado,
      comentario: '',
      liberacion: false,
      close: false,
      __isNew: true,
    };

    this.cascadeEntradaData = [newRow, ...this.cascadeEntradaData];
    this.syncSelectedOcRestaFromEntradas();
    this.nivel4GridApi.setGridOption('rowData', this.cascadeEntradaData);
    this.hasUnsavedChangesEntradas = true;

    setTimeout(() => {
      this.nivel4GridApi.startEditingCell({ rowIndex: 0, colKey: 'fechaRecepcion' });
    }, 0);
  }

  async saveEntradas() {
    if ((!this.hasUnsavedChangesEntradas && !this.hasUnsavedChangesCaracteristicas) || !this.selectedOcRow) return;

    // Validar que no haya dos entradas con la misma fecha de recepción.
    const toKeyFecha = (f: any): string => {
      if (!f) return '';
      if (f instanceof Date) return `${f.getFullYear()}-${String(f.getMonth()+1).padStart(2,'0')}-${String(f.getDate()).padStart(2,'0')}`;
      const m = String(f).match(/^(\d{4})-(\d{2})-(\d{2})/);
      return m ? `${m[1]}-${m[2]}-${m[3]}` : String(f).substring(0, 10);
    };
    const fechasVistas = new Set<string>();
    for (const r of this.cascadeEntradaData) {
      const key = toKeyFecha(r.fechaRecepcion);
      if (!key) continue;
      if (fechasVistas.has(key)) {
        await alerts.basicAlert('Fecha duplicada', 'No puede haber dos entradas con la misma fecha de recepción.', 'warning');
        return;
      }
      fechasVistas.add(key);
    }

    const toSave = this.cascadeEntradaData.filter(r => r.__isNew || r.__modified);

    // Validar Datos externos (Nivel 5): cada fila de lote con datos debe traer Lote + Caducidad
    // + Cantidad x Lote completos (la última fila vacía se ignora). Aplica a las entradas por guardar.
    for (const r of toSave) {
      const lotes = Array.isArray(r.datosExternos) ? r.datosExternos : [];
      const incompleta = lotes.some((d: any) => {
        if (!this.datoExternoTieneDatos(d)) return false; // fila vacía → se ignora
        const loteOk = (d.lote ?? '').toString().trim() !== '';
        const cadOk = d.caducidadMeses != null && d.caducidadMeses !== '' && !isNaN(Number(d.caducidadMeses));
        const cantOk = d.cantidadXLote != null && d.cantidadXLote !== '' && !isNaN(Number(d.cantidadXLote));
        return !(loteOk && cadOk && cantOk);
      });
      if (incompleta) {
        await alerts.basicAlert('Datos externos incompletos', 'Cada lote debe tener Lote, Caducidad en meses y Cantidad x Lote.', 'warning');
        return;
      }
    }

    // Validar Características (panel abierto): todas las características de materia prima deben estar
    // REVISADAS (+ revisor) y, si el material tiene organolépticas, esa pestaña también llena.
    if (this.selectedEntradaCaratRow) {
      if (this.cascadeMpCaractData.length) {
        const faltaReviso = this.cascadeMpCaractData.some((r: any) => r.reviso !== true);
        if (faltaReviso || !this.selectedRevisorId) {
          await alerts.basicAlert('Características incompletas', 'Necesitas llenar características del producto para poder guardar su entrada.', 'warning');
          return;
        }
      }
      if (this.hasOrganolepticas) {
        const row0 = this.cascadeCaratData?.[0] ?? {};
        const faltaOrg = this.caracteristicasCategories.some((cat: any) => {
          const id = cat.id || cat.originalId;
          const v = row0[`cat_${id}`];
          return v == null || String(v).trim() === '';
        });
        if (faltaOrg) {
          await alerts.basicAlert('Características incompletas', 'Necesitas llenar características del producto para poder guardar su entrada.', 'warning');
          return;
        }
      }
    }

    // N de entrega para el Folio (misma entrega/single para todas las filas de esta vista).
    const nEntregaSave = this.selectedMultiEntregaCaratRow
      ? Math.max(1, this.multiEntregasData.indexOf(this.selectedMultiEntregaCaratRow) + 1)
      : 1;

    // Bloqueo: hay entrada(s) nueva(s) de OC pero la sucursal no tiene prefijo de entrega
    // configurado → no se puede generar el Folio de entrega. Alertar + redirigir a configuración.
    const requiereFolio = this.selectedOcRow?.type !== 'CR' && toSave.some(r => r.__isNew);
    if (requiereFolio && !this.prefixEntrega) {
      const res = await alerts.confirmAlert(
        'Falta el identificador de entregas',
        'No se puede generar el Folio de entrega porque esta sucursal no tiene configurado el "Identificador Entregas". ¿Quieres ir a configurarlo ahora?',
        'warning',
        'Ir a configuración'
      );
      if (res.isConfirmed) {
        this.router.navigate(['/shoppingDelison/configuracion'], { queryParams: { tab: 'ordenes-compra' } });
      }
      return;
    }

    try {
      const idMaterial = this.internalParams?.data?.idMaterial;
      for (const row of toSave) {
        const payload: EntradaMolienda = {
          idOc: this.selectedOcRow.id,
          idEntrega: this.selectedMultiEntregaCaratRow?.id ?? null,
          idMaterial: idMaterial ?? null,
          fechaRecepcion: row.fechaRecepcion instanceof Date
            ? `${row.fechaRecepcion.getFullYear()}-${String(row.fechaRecepcion.getMonth()+1).padStart(2,'0')}-${String(row.fechaRecepcion.getDate()).padStart(2,'0')}`
            : (row.fechaRecepcion ?? null),
          cantidadEntrada: row.cantidadEntrada ?? 0,
          bultos: row.bultos ?? 0,
          revisionConfigu: row.revisionConfigu ?? 0,
          pago: row.pago ?? 0,
          fechaPago: row.fechaPago instanceof Date
            ? `${row.fechaPago.getFullYear()}-${String(row.fechaPago.getMonth()+1).padStart(2,'0')}-${String(row.fechaPago.getDate()).padStart(2,'0')}`
            : (row.fechaPago ?? null),
          notaFactura: row.notaFactura ?? null,
          // Folio de entrega: usa el ya generado; si falta (y hay prefijo), se regenera.
          folioEntrega: (row.folioEntrega && String(row.folioEntrega).trim())
            ? row.folioEntrega
            : (this.buildFolioEntrega(nEntregaSave) || null),
          usuario: row.usuario ?? '',
          comentario: row.comentario ?? '',
          liberacion: row.liberacion ?? false,
          close: row.close ?? false,
        };
        // Reflejar en la fila el folio efectivamente guardado (para el grid).
        row.folioEntrega = payload.folioEntrega ?? '';

        if (row.__isNew) {
          const created = await lastValueFrom(this.entradaService.create(payload));
          row.id = created.id;
          row.idEntrada = created.id;
          row.__isNew = false;
        } else {
          await lastValueFrom(this.entradaService.update(row.id, payload));
          row.__modified = false;
        }

        // Datos externos (Nivel 5): sincronizar lotes de esta entrada (ya tiene id).
        await this.syncDatosExternosForEntrada(row);
      }

      this.hasUnsavedChangesEntradas = false;
      this.originalCascadeEntradaData = JSON.parse(JSON.stringify(this.cascadeEntradaData));
      if (this.nivel4GridApi) this.nivel4GridApi.setGridOption('rowData', this.cascadeEntradaData);

      // Sincronizar fechaEntradaAlmacen y Resta de la entrega activa
      if (this.selectedOcMultiRow && this.selectedMultiEntregaCaratRow && this.multiEntregasData.length > 0) {
        const entregaRow = this.multiEntregasData.find((r: any) => r.id === this.selectedMultiEntregaCaratRow.id);
        if (entregaRow) {
          // fechaEntradaAlmacen: primera entrada con fecha
          const conFecha = this.cascadeEntradaData.find((e: any) => e.fechaRecepcion instanceof Date);
          if (conFecha) {
            const d = conFecha.fechaRecepcion as Date;
            entregaRow.fechaEntradaAlmacen =
              `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
          }
          // Resta actualizada
          const sumRecibido = this.cascadeEntradaData.reduce((acc: number, e: any) => acc + Number(e.cantidadEntrada ?? 0), 0);
          entregaRow.resta = Number(entregaRow.cantidadRecibir ?? 0) - sumRecibido;
        }
        if (this.multiEntregasGridApi && !this.multiEntregasGridApi.isDestroyed()) {
          this.multiEntregasGridApi.refreshCells({ columns: ['fechaEntradaAlmacen', 'resta'], force: true });
        }
      }

      if (this.hasUnsavedChangesCaracteristicas) {
        if (this.hasOrganolepticas) await this.saveCaracteristicas(true);
        // Revisión de características de materia prima de la entrada abierta.
        if (this.selectedEntradaCaratRow?.idEntrada) {
          await this.saveMpRevision(this.selectedEntradaCaratRow.idEntrada);
        }
        this.hasUnsavedChangesCaracteristicas = false;
      }
      await alerts.basicAlert('Éxito', 'Cambios guardados.', 'success');
    } catch (err) {
      console.error('Error guardando entradas:', err);
      await alerts.basicAlert('Error', 'No se pudieron guardar los cambios.', 'error');
    }
  
    this.cdr.detectChanges();}

  revertEntradas() {
    // Compra Rápida y multi-entrega (Nivel 5, 1 recepción por entrega): "Deshacer" NO revierte ni
    // elimina la fila; solo LIMPIA sus casillas (vuelve la única fila a blanco). Conserva id/idEntrada.
    if (this.selectedOcRow?.type === 'CR' || this.selectedOcMultiRow) {
      const usuario = this.signalsService.getDisplayName()() || 'Usuario';
      this.cascadeEntradaData = this.cascadeEntradaData.map((r: any) => ({
        ...r,
        fechaRecepcion: new Date(),
        cantidadEntrada: 0,
        bultos: 0,
        revisionConfigu: 0,
        pago: 0,
        comentario: '',
        liberacion: false,
        carat: '',
        usuario,
      }));
      this.syncSelectedOcRestaFromEntradas();
      this.hasUnsavedChangesEntradas = true;
      this.selectedEntradaRow = null;
      if (this.nivel4GridApi) {
        this.nivel4GridApi.setGridOption('rowData', this.cascadeEntradaData);
      }
      return;
    }

    this.cascadeEntradaData = JSON.parse(JSON.stringify(this.originalCascadeEntradaData));
    this.syncSelectedOcRestaFromEntradas();
    this.hasUnsavedChangesEntradas = false;
    this.selectedEntradaRow = null;
    if (this.nivel4GridApi) {
      this.nivel4GridApi.setGridOption('rowData', this.cascadeEntradaData);
    }
  }

  async deleteEntrada() {
    if (!this.selectedEntradaRow) {
      await alerts.basicAlert('Eliminar', 'Seleccione una fila.', 'warning');
      return;
    }

    const r = await alerts.confirmAlert(
      'Confirmar eliminación',
      `¿Eliminar esta entrada?`,
      'warning',
      'Sí, eliminar'
    );
    if (!r.isConfirmed) return;

    try {
      if (this.selectedEntradaRow.__isNew) {
        this.cascadeEntradaData = this.cascadeEntradaData.filter(row => row !== this.selectedEntradaRow);
      } else {
        await lastValueFrom(this.entradaService.delete(this.selectedEntradaRow.id));
        this.cascadeEntradaData = this.cascadeEntradaData.filter(row => row !== this.selectedEntradaRow);
        this.originalCascadeEntradaData = JSON.parse(JSON.stringify(this.cascadeEntradaData));
      }

      this.selectedEntradaRow = null;
      this.syncSelectedOcRestaFromEntradas();
      if (this.nivel4GridApi) this.nivel4GridApi.setGridOption('rowData', this.cascadeEntradaData);
      await alerts.basicAlert('Éxito', 'Entrada eliminada.', 'success');
    } catch (err) {
      console.error('Error eliminando entrada:', err);
      await alerts.basicAlert('Error', 'No se pudo eliminar la entrada.', 'error');
    }
  
    this.cdr.detectChanges();}

  private onEntradaCellValueChanged(event: any) {
    const row = event.data;

    // Auto-calcular pago si cambia cantidadEntrada
    if (event.colDef.field === 'cantidadEntrada') {
      const cantidadCapturada = Number(row.cantidadEntrada ?? 0);
      const cantidadActual = Number.isFinite(cantidadCapturada) ? cantidadCapturada : 0;
      const maxPermitido = this.getCantidadRestanteParaEntrada(row);
      // OC sin límite → cantidad de la OC es 0 (ilimitada); no aplica el tope ni el aviso.
      const ocSinLimite = Number(this.selectedOcRow?.cantidad ?? 0) === 0;

      if (cantidadActual < 0) {
        row.cantidadEntrada = 0;
      } else if (!ocSinLimite && cantidadActual > maxPermitido) {
        row.cantidadEntrada = cantidadActual;
        void alerts.basicAlert('Aviso', 'La suma de las entrada es mayor a la requerida en la oc está seguro de guardar.', 'warning');
      } else {
        row.cantidadEntrada = cantidadActual;
      }

      const price = this.selectedOcRow?.price ?? 0;
      row.pago = (row.cantidadEntrada ?? 0) * price;

      if (this.nivel4GridApi) {
        this.nivel4GridApi.refreshCells({
          rowNodes: [event.node],
          columns: ['cantidadEntrada', 'pago'],
          force: true
        });
      }
    }

    this.syncSelectedOcRestaFromEntradas();

    if (!row.__isNew) {
      row.__modified = true;
    }
    this.hasUnsavedChangesEntradas = true;
  }

  private getCantidadRestanteParaEntrada(currentRow: any): number {
    const cantidadOc = Number(this.selectedOcRow?.cantidad ?? 0);
    const sumaOtrasEntradas = this.cascadeEntradaData
      .filter(row => row !== currentRow)
      .reduce((acc, row) => acc + Number(row?.cantidadEntrada ?? 0), 0);

    return cantidadOc - sumaOtrasEntradas;
  }

  private getSumaEntradasActual(): number {
    return this.cascadeEntradaData.reduce((acc, row) => acc + Number(row?.cantidadEntrada ?? 0), 0);
  }

  private syncSelectedOcRestaFromEntradas(): void {
    if (!this.selectedOcRow) return;

    const cantidadOc = Number(this.selectedOcRow.cantidad ?? 0);
    this.selectedOcRow.resta = cantidadOc - this.getSumaEntradasActual();
    this.syncSelectedReqRestaFromOcs();

    // SIN LÍMITE: "Cantidad Entregas" = número de filas del grid de Entradas (Nivel 4), en vivo.
    const cols = ['resta'];
    if (String(this.selectedOcRow.tipoOc ?? '').toUpperCase() === 'COMPRA AUTORIZADA SIN LIMITE') {
      this.selectedOcRow.entradasCount = this.cascadeEntradaData.length;
      cols.push('entregasCount');
    }

    if (this.cascadeOcGridApi && !this.cascadeOcGridApi.isDestroyed()) {
      this.cascadeOcGridApi.refreshCells({
        force: true,
        columns: cols,
      });
    }
  }

  private syncSelectedReqRestaFromOcs(): void {
    if (!this.selectedReqRow) return;

    this.selectedReqRow.resta = this.cascadeOcData
      .reduce((acc: number, oc: any) => acc + Number(oc?.resta ?? 0), 0);

    if (this.gridApi && !this.gridApi.isDestroyed()) {
      this.gridApi.refreshCells({
        columns: ['resta'],
        force: true,
      });
    }
  }

  private onEntradaCellEditingStopped(event: any) {
    if (!this.enterPressed) return;
    this.enterPressed = false;

    const currentColKey = event.colDef.field;
    const currentRowIndex = event.rowIndex;
    const currentColIndex = this.editableEntradaColumnOrder.indexOf(currentColKey);

    if (currentColIndex === -1) return;

    let nextRowIndex = currentRowIndex;
    let nextColIndex = currentColIndex + 1;

    if (nextColIndex >= this.editableEntradaColumnOrder.length) {
      nextRowIndex++;
      nextColIndex = 0;
    }

    if (nextRowIndex >= this.cascadeEntradaData.length) {
      return;
    }

    const nextColKey = this.editableEntradaColumnOrder[nextColIndex];

    setTimeout(() => {
      if (this.nivel4GridApi) {
        this.nivel4GridApi.startEditingCell({
          rowIndex: nextRowIndex,
          colKey: nextColKey,
        });
      }
    }, 0);
  }

  private isEntregaRowUnlocked(rowIndex: number): boolean {
    if (rowIndex === 0) return true;
    return this.multiEntregasData[rowIndex - 1]?.close === true;
  }

  async closeEntrega(params: any): Promise<void> {
    // Validar que existan entradas registradas para esta entrega antes de cerrarla
    const idMaterial = this.internalParams?.data?.idMaterial;
    const idEntrega = params.data?.id;
    if (idEntrega && idMaterial) {
      const entradas = await lastValueFrom(
        this.entradaService.getByEntregaAndMaterial(idEntrega, idMaterial)
      ).catch(() => []);
      if (!Array.isArray(entradas) || entradas.length === 0) {
        params.api.refreshCells({ rowNodes: [params.node], columns: ['close'], force: true });
        await alerts.basicAlert('Cerrar Entrega', 'No se puede cerrar esta entrega porque aún no hay datos registrados.', 'warning');
        return;
      }

      // Validar que CADA entrada de la entrega tenga "Datos externos" (lotes); si alguna está
      // vacía (null), no se permite cerrar la entrega.
      const lotesPorEntrada = await Promise.all((entradas as any[]).map(async (e: any) => {
        const lotes = await lastValueFrom(this.datosExternosService.getByEntrada(e.id)).catch(() => []);
        return { id: e.id, count: Array.isArray(lotes) ? lotes.length : 0 };
      }));
      const sinDatos = lotesPorEntrada.filter(r => r.count === 0).map(r => r.id);
      if (sinDatos.length) {
        params.api.refreshCells({ rowNodes: [params.node], columns: ['close'], force: true });
        await alerts.basicAlert(
          'Cerrar Entrega',
          `No se puede cerrar la entrega: falta capturar Datos externos en la(s) entrada(s): ${sinDatos.join(', ')}.`,
          'warning'
        );
        return;
      }
    }

    const confirm = await alerts.confirmAlert(
      'Cerrar Entrega',
      `¿Está seguro de que quiere cerrar la entrega? Ya no se podrán hacer modificaciones posteriores.`,
      'question',
      'Sí, cerrar'
    );
    if (!confirm.isConfirmed) {
      params.api.refreshCells({ rowNodes: [params.node], columns: ['close'], force: true });
      return;
    }
    try {
      const payload: EntregaOc = {
        idDetailsreqoc: params.data.idDetailsreqoc,
        fechaEntrega: params.data.fechaEntrega || null,
        cantidadRecibir: params.data.cantidadRecibir ?? null,
        notaFactura: params.data.notaFactura || null,
        totalEntrega: params.data.totalEntrega ?? null,
        fechaEntradaAlmacen: params.data.fechaEntradaAlmacen || null,
        close: true,
      };
      await lastValueFrom(this.entregaOcService.update(params.data.id, payload));
      params.data.close = true;
      params.api.redrawRows();
      this.refreshOcLockIcon();
      alerts.reqSuccessToast('Éxito', 'Entrega cerrada correctamente.');
    } catch (err) {
      console.error('Error cerrando entrega:', err);
      params.api.refreshCells({ rowNodes: [params.node], columns: ['close'], force: true });
      alerts.reqErrorToast('Error', 'No se pudo cerrar la entrega.');
    }
  
    this.cdr.detectChanges();}

  private refreshOcLockIcon(): void {
    if (!this.selectedOcMultiRow || !this.cascadeOcGridApi || this.cascadeOcGridApi.isDestroyed()) return;
    const allClosed = this.multiEntregasData.length > 0 &&
                      this.multiEntregasData.every((r: any) => r.close === true);
    this.selectedOcMultiRow.__allEntradasClosed = allClosed;
    // "Cantidad Entregas" en vivo: recuenta entregas y cerradas tras cerrar una (0/N → 1/N → …).
    this.selectedOcMultiRow.entregasPlaneadas = this.multiEntregasData.length;
    this.selectedOcMultiRow.entregasCerradas =
      this.multiEntregasData.filter((r: any) => r.close === true).length;
    this.cascadeOcGridApi.refreshCells({ columns: ['folio', 'entregasCount'], force: true });
  }

  async saveCaracteristicas(silent = false) {
    if (!this.hasUnsavedChangesCaracteristicas || this.cascadeCaratData.length === 0) {
      return;
    }

    // selectedEntradaCaratRow es la misma referencia que el objeto en cascadeEntradaData,
    // por lo que su idEntrada ya fue actualizado por saveEntradas si era fila nueva.
    const idEntrada = this.selectedEntradaCaratRow?.idEntrada ?? this.cascadeCaratData[0]?.idEntrada;
    if (!idEntrada) {
      if (!silent) await alerts.basicAlert('Error', 'No se pudo determinar la entrada para guardar características.', 'error');
      return;
    }

    // Sincronizar idEntrada en el objeto de cascadeCaratData por si acaso
    this.cascadeCaratData[0].idEntrada = idEntrada;

    try {
      const row = this.cascadeCaratData[0];
      const savePromises: any[] = [];
      const abrevParts: string[] = [];

      // Mapa de nombre de familia → abreviatura para búsqueda rápida
      const familyAbrevMap = new Map<string, string>();
      this.caracteristicasFamilies.forEach((f: any) => {
        familyAbrevMap.set(f.description, f.valueAddition2 ?? f.description);
      });

      // Guardar una característica por cada categoría y construir el string de abreviaturas
      this.caracteristicasCategories.forEach((category: any) => {
        const categoryId = category.id || category.originalId;
        const categoryName = category.description || '';
        const categoryAbrev = category.valueAddition2 || categoryName;
        const fieldName = `cat_${categoryId}`;
        const familySelected = row[fieldName] ?? null;

        if (familySelected) {
          const familyAbrev = familyAbrevMap.get(familySelected) ?? familySelected;
          abrevParts.push(`${categoryAbrev}-${familyAbrev}`);

          const payload = {
            idEntrada: idEntrada,
            idCategory: categoryId,
            categoryName: categoryName,
            familySelected: familySelected,
            active: true,
          };

          const existingId = this.existingCaratIds.get(categoryId);
          if (existingId) {
            savePromises.push(lastValueFrom(this.caracteristicasService.update(existingId, payload)));
          } else if (this.existingCaratIds.size === 0) {
            // Solo crear si no hay ningún registro previo para esta entrada
            savePromises.push(
              lastValueFrom(this.caracteristicasService.create(payload)).then((created: any) => {
                if (created?.id) this.existingCaratIds.set(categoryId, created.id);
              })
            );
          }
        }
      });

      if (savePromises.length > 0) {
        await Promise.all(savePromises);
      }

      // Actualizar el campo carat de la fila en Level 4 con las abreviaturas
      const caratString = abrevParts.join(' / ');
      if (this.selectedEntradaCaratRow && caratString) {
        this.selectedEntradaCaratRow.carat = caratString;
        if (this.nivel4GridApi && !this.nivel4GridApi.isDestroyed()) {
          this.nivel4GridApi.refreshCells({ columns: ['carat'], force: true });
        }
      }

      this.hasUnsavedChangesCaracteristicas = false;
      this.originalCaracteristicasData = JSON.parse(JSON.stringify(this.cascadeCaratData));
      if (!silent) await alerts.basicAlert('Éxito', 'Características guardadas.', 'success');
    } catch (err) {
      console.error('Error guardando características:', err);
      if (!silent) await alerts.basicAlert('Error', 'No se pudieron guardar las características.', 'error');
      throw err;
    }
  
    this.cdr.detectChanges();}

  private toggleDetailColumn(params: any, _detailType: string): void {
    // Cierra el panel de Características si está abierto
    this.selectedEntradaCaratRow = null;
    this.cascadeCaratData = [];
    this.existingCaratIds.clear();
    this.hasUnsavedChangesCaracteristicas = false;
    const readOnly = this.selectedOcRow?.close === true || this.selectedMultiEntregaIsClosed;

    // Compra Rápida: documentos a nivel del documento CR (compartidos con la columna PDF
    // del nivel 2 de la sección Compra Rápida). Misma llave: CR.id + 'compra_rapida'.
    if (this.selectedOcRow?.type === 'CR') {
      const crId = this.selectedOcRow?.id;
      if (!crId) return;
      this.entradaDocumentsOverlayService.open({ idEntrada: crId, docType: 'compra_rapida', readOnly });
      return;
    }

    // Con entrega → docs por entrega_oc.id (type 'entrega', compartido con purchaseorderdelison).
    // Sin entrega → docs por entradas_molienda.id (type 'entrada_molienda', namespace propio).
    const hasEntrega = params.data?.idEntrega != null;
    const idEntrada: number | null = hasEntrega ? params.data.idEntrega : (params.data?.idEntrada ?? null);
    if (!idEntrada) return;
    const docType = hasEntrega ? 'entrega' : 'entrada_molienda';
    this.entradaDocumentsOverlayService.open({ idEntrada, docType, readOnly });
  }

  closeDocumentsModal(): void {
    this.entradaDocumentsOverlayService.close();
  }
}
