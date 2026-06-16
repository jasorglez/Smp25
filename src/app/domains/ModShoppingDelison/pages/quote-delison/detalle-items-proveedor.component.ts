import { Component, inject, Renderer2, RendererFactory2, OnDestroy, HostListener, Input, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, ICellRendererParams, GridApi } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { CustomersService } from 'app/services/customers.service';
import { SignalsService } from 'app/services/signals.service';
import { OcAndReqsService } from 'app/services/ocandreqs.service';
import { PedimentoModificationService } from 'app/services/pedimento-modification.service';
import { ProvidersService } from 'app/services/providers.service';
import { SucursalByMaterialProveedorService } from 'app/services/sucursalByMaterialProveedor.service';
import { CatalogadmonService } from 'app/services/catalogadmon.service';
import { MaterialsService } from 'app/services/materials.service';
import { CatalogsService } from 'app/services/catalogs.service';
import { UnsavedChangesTrackerService } from 'app/services/unsaved-changes-tracker.service';
import { alerts } from 'app/helpers/alerts';
import { NgSelectModule } from '@ng-select/ng-select';
import { lastValueFrom } from 'rxjs';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import { ItemCommentsCellRendererComponent } from 'app/shared/item-comments-cell-renderer/item-comments-cell-renderer.component';
import { ItemCommentsService } from 'app/services/item-comments.service';
import { ProveedorItemsOverlayData } from 'app/services/proveedor-items-overlay.service';
import { ClasificacionCascadaComponent } from './clasificacion-cascada.component';
import { CostoIvaTooltipService } from './costo-iva-tooltip.service';
import { SetupService } from 'app/services/setup.service';
import { CondicionesPagoService, CondicionPagoDto } from 'app/services/condiciones-pago.service';
import { CurrencyService } from 'app/services/currency.service';
import { PrecioMonedaEditorComponent } from 'app/domains/Almacenes/components/materiales-maestro/editors/precio-moneda-editor.component';

pdfMake.vfs = pdfFonts.vfs;

@Component({
  selector: 'app-detalle-items-proveedor',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, NgSelectModule, ItemCommentsCellRendererComponent, ClasificacionCascadaComponent],
  template: `
    <div class="detail-grid-container">
      <!-- Banner de candado cuando ya existe OC -->
      <div *ngIf="ocGenerated"
           style="background:#fff3cd; border:1px solid #ffc107; border-radius:6px; padding:5px 12px; margin-bottom:5px; flex-shrink:0; display:flex; align-items:center; gap:8px;">
        <i class="bi bi-lock-fill text-warning" style="font-size:1.1rem;"></i>
        <span class="small fw-semibold text-dark">OC generada — esta cotización está bloqueada y no puede modificarse.</span>
        <span class="badge bg-warning text-dark ms-auto">{{ savedCotizFolio }}</span>
      </div>

      <!-- Header con controles -->
      <div style="margin-bottom: 5px; padding: 6px 10px; flex-shrink: 0;">
        <!-- Fila 1: Proveedor + botones -->
        <div style="display: flex; align-items: center;">
          <label class="form-label small mb-0 me-1" style="white-space: nowrap;">Proveedor:</label>
          <ng-select
            [items]="filteredProviders"
            bindValue="id"
            bindLabel="description"
            [(ngModel)]="selectedProviderId"
            [clearable]="true"
            [disabled]="ocGenerated"
            placeholder="Seleccione proveedor"
            (ngModelChange)="onProviderChange()"
            style="width: 50%; min-width: 150px;">
            <ng-template ng-option-tmp let-item="item">
              <span *ngIf="item.__isHeader" style="font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; width: 100%; text-align: center; display: inline-block; color: #6c757d; background-color: #f5f5f5;">
                {{ item.description }}
              </span>
              <ng-container *ngIf="!item.__isHeader">
                <span *ngIf="item.isPrincipal" title="Proveedor principal de los artículos">⭐ </span><span *ngIf="item.isSugerido" title="Sugerido por la requisición" style="color:#1565c0;font-weight:700;">💡 </span>{{ item.description }}<span *ngIf="item.isSugerido" style="color:#1565c0;font-size:11px;font-weight:700;"> · Sugerido por requisición</span>
              </ng-container>
            </ng-template>
            <ng-template ng-label-tmp let-item="item">
              <span *ngIf="item.isPrincipal">⭐ </span><span *ngIf="item.isSugerido" title="Sugerido por la requisición">💡 </span>{{ item.description }}
            </ng-template>
          </ng-select>
          <input type="file" #fileInput accept=".pdf" style="display: none;" (change)="onFileSelected($event)">
          <button class="btn btn-sm btn-outline-secondary" type="button" (click)="fileInput.click()" [disabled]="ocGenerated" title="Cargar PDF">
            <i class="bi bi-upload"></i>
          </button>
          <button class="btn btn-sm btn-outline-secondary" type="button" (click)="generatePlaceholderPdf()" [disabled]="ocGenerated" title="Ver PDF">
            <i class="bi bi-file-earmark-pdf text-danger"></i>
          </button>
          <button type="button" class="btn btn-sm btn-success position-relative" (click)="saveChanges()" [disabled]="savingChanges || ocGenerated || !allCostosValid" title="Guardar cotización">
            <span *ngIf="savingChanges" class="spinner-border spinner-border-sm"></span>
            <i *ngIf="!savingChanges" class="bi bi-floppy"></i>
            <span class="position-absolute top-0 start-100 translate-middle p-2 bg-danger border border-light rounded-circle" *ngIf="hasUnsavedChanges && !savingChanges && !ocGenerated">
              <span class="visually-hidden">Cambios sin guardar</span>
            </span>
          </button>
          <button type="button" class="btn btn-sm btn-warning" (click)="revertChanges()" [disabled]="ocGenerated" title="Deshacer">
            <i class="bi bi-arrow-clockwise"></i>
          </button>
          <button type="button" class="btn btn-sm btn-danger" (click)="deleteItem()" [disabled]="ocGenerated" title="Eliminar">
            <i class="bi bi-trash"></i>
          </button>
        </div>

        <!-- Fila 2: Datos de la cotización del proveedor -->
        <div style="display: flex; align-items: center; gap: 10px; margin-top: 6px;">
          <label class="form-label small mb-0" style="white-space: nowrap;">Fecha de Cotización:</label>
          <input type="date" class="form-control form-control-sm" style="width: 150px;"
                 [(ngModel)]="fechaCotizacion" [disabled]="ocGenerated"
                 (ngModelChange)="onHeaderFieldChanged()">

          <label class="form-label small mb-0" style="white-space: nowrap;"># Cotización:</label>
          <input type="text" class="form-control form-control-sm" style="width: 150px;"
                 [(ngModel)]="numCotizacion" [disabled]="ocGenerated"
                 (ngModelChange)="onHeaderFieldChanged()" placeholder="Ej: 12345">

          <label class="form-label small mb-0" style="white-space: nowrap;">Condiciones Pago:</label>
          <select class="form-select form-select-sm" style="width: 220px;"
                  [(ngModel)]="idCondicionPago" [disabled]="ocGenerated"
                  (ngModelChange)="onHeaderFieldChanged()">
            <option [ngValue]="null">-- seleccione --</option>
            <option *ngFor="let opt of condicionesPagoOpts" [ngValue]="opt.id">
              {{ opt.descripcion }} - {{ opt.cantidad }}
            </option>
          </select>

          <label class="form-label small mb-0" style="white-space: nowrap;">Vigencia (días):</label>
          <input type="number" class="form-control form-control-sm" style="width: 90px;" min="0"
                 [(ngModel)]="vigenciaCotizacion" [disabled]="ocGenerated"
                 (ngModelChange)="onHeaderFieldChanged()">
        </div>
      </div>

      <!-- Grid con tamaño completo -->
      <div #gridWrapper style="flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column;">
        <ag-grid-angular
          class="ag-theme-quartz small-text-ag-grid"
          [rowData]="rowData"
          [columnDefs]="colDefs"
          [gridOptions]="gridOptions"
          [localeText]="AG_GRID_LOCALE_ES"
          (gridReady)="onGridReady($event)"
          (cellValueChanged)="onCellValueChanged($event)"
          style="width: 100%; flex: 1 1 auto; min-height: 0;">
        </ag-grid-angular>
      </div>

      <!-- Total Cotización -->
      <div style="flex-shrink: 0; display: flex; justify-content: flex-end; align-items: center;
                  background: #c8e6c9; border-top: 2px solid #388e3c; padding: 4px 12px;">
        <span style="font-weight: bold; font-size: 0.85rem; color: #1b5e20;">Total Cotización:&nbsp;</span>
        <span style="font-weight: bold; font-size: 0.9rem; color: #1b5e20;">
          {{ totalCotizacionDisplay }}
        </span>
      </div>
    </div>

    <!-- Modal Nuevo Proveedor: ahora se renderiza global (en document.body) -->
  `,
  styles: [`
    .detail-grid-container {
      padding: 5px;
      background-color: #e3f2fd;
      border-radius: 8px;
      height: 100%;
      max-height: 100%;
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
      overflow: hidden;
      position: relative;
    }
    .form-label {
      margin-bottom: 2px;
      font-weight: 500;
    }
  `]
})
export class DetalleItemsProveedorComponent {
  private customersService = inject(CustomersService);
  private signalsService = inject(SignalsService);
  private ocandreqsService = inject(OcAndReqsService);
  private pedimentoModificationService = inject(PedimentoModificationService);
  private providersService = inject(ProvidersService);
  private sucursalByMaterialProveedorService = inject(SucursalByMaterialProveedorService);
  private catalogadmonService = inject(CatalogadmonService);
  private itemCommentsService = inject(ItemCommentsService);
  private materialsService = inject(MaterialsService);
  private catalogsService = inject(CatalogsService);
  private unsavedTracker = inject(UnsavedChangesTrackerService);
  private costoIvaTooltip = inject(CostoIvaTooltipService);
  private setupService    = inject(SetupService);
  private condicionesPagoService = inject(CondicionesPagoService);
  private currencyService = inject(CurrencyService);

  // Fase 2: catálogo de monedas para mostrar la abreviatura junto a Costo Unit/Total (Opción A, sin convertir).
  private monedasMap = new Map<number, string>();
  // Lista para el editor compuesto monto+moneda en Costo Unit.
  monedasList: { id: number; abreviatura: string; nombre: string }[] = [];
  private defaultCurrencyId: number | null = null;
  private ivaPercent: number = 0;
  private ivaConfigurado: boolean = false;
  condicionesPagoOpts: CondicionPagoDto[] = [];

  private params!: ICellRendererParams;
  private gridApi!: GridApi;
  @ViewChild('gridWrapper') private gridWrapper!: ElementRef;
  private renderer: Renderer2;
  private newProviderOverlayEl: HTMLElement | null = null;
  private newProviderOverlayUnlisteners: Array<() => void> = [];

  constructor(rendererFactory: RendererFactory2) {
    this.renderer = rendererFactory.createRenderer(null, null);
  }

  rowData: any[] = [];
  providers: any[] = [];
  filteredProviders: any[] = [];
  selectedProviderId: number | null = null;
  selectedProviderObj: any = null;
  /** Snapshot del último proveedor "persistido" (params.data o BD o tras save) — usado por revertChanges. */
  private originalProviderId: number | null = null;
  // Datos de la cotización del proveedor (cabecera, viven en ocandreq, no en cada item)
  fechaCotizacion: string = new Date().toISOString().split('T')[0];
  numCotizacion: string = '';
  condicionesPago: string = '';
  idCondicionPago: number | null = null;
  vigenciaCotizacion: number | null = null;
  private originalFechaCotizacion: string = new Date().toISOString().split('T')[0];
  private originalNumCotizacion: string = '';
  private originalCondicionesPago: string = '';
  private originalIdCondicionPago: number | null = null;
  private originalVigenciaCotizacion: number | null = null;

  /** Slot dinámico: contiene cotizId, slotIndex, idProvider, folio, name. */
  private slotInfo: any = null;
  /** Prefijo de sucursal (ej: "BOD15") extraído del folio de la requisición. */
  private branchPrefix: string = 'NOPREF';
  /** Prefijo del departamento (ej: "EF") para el folio COTIZ/OC. Si está vacío, se bloquea el guardado. */
  private deptPrefijo: string = '';
  /** Nombre del departamento (para mensajes de validación). */
  private departmentName: string = '';
  /** Número de pedimento (1, 2, 3...) usado en el folio: ${type}-{branchPrefix}-P{pedimentoNum}-PRO{idProvider}. */
  private pedimentoNum: number = 0;
  /** Slots hermanos (proveedores ya asignados al mismo pedimento, excepto este slot) — para evitar duplicados. */
  private siblingSlots: any[] = [];
  /** Callback al padre cuando se guarda un slot (para refrescar UI sin recargar). */
  private onSlotSavedCallback: ((savedSlot: any) => void) | null = null;
  private _hasUnsavedChanges: boolean = false;
  private _trackerKey: string = '';
  get hasUnsavedChanges(): boolean {
    return this._hasUnsavedChanges;
  }
  set hasUnsavedChanges(value: boolean) {
    this._hasUnsavedChanges = value;
    if (this._trackerKey) {
      this.unsavedTracker.setDirty(this._trackerKey, value);
    }
  }
  totalCostoTotal: number = 0;
  totalCotizacionDisplay: string = '$0.00 MXN';
  providerLabel: string = '';
  providerField: string = '';
  private _colDefs: ColDef[] | null = null;

  requisitionId: number | null = null;
  idBranch: number | null = null;
  branchName: string = '';

  cotizacionSaved: boolean = false;
  savedCotizFolio: string = '';
  savedOcId: number = 0;
  savingChanges: boolean = false;
  generatingOC: boolean = false;
  ocGenerated: boolean = false;
  hasRowsWithTypeOC: boolean = false;

  // Modal global (se renderiza en document.body para no quedar atrapado por transforms de AG Grid)
  showNewProviderModal: boolean = false;
  savingProvider: boolean = false;
  newProvider = { company: '', nameContact: '', phone: '', email: '' };

  companySuggestions: string[] = [];
  showCompanySuggestions: boolean = false;
  companyDuplicateWarning: string = '';
  emailInvalid: boolean = false;

  typeocValues: string[] = [];
  private readonly AUTHORIZED_TYPES = ['COMPRA INMEDIATA', 'COMPRA AUTORIZADA', 'COMPRA AUTORIZADA EN OTRA FECHA'];
  private readonly NEW_PROVIDER_SENTINEL = -1;
  private rowsMissingProvider: any[] = [];
  private principalProviderIds = new Set<number>();
  // Proveedores sugeridos por la requisición (panel de presentaciones) para los artículos del slot.
  private sugeridoProviderIds = new Set<number>();
  private inactiveProviders: { id: number; name: string; raw: any }[] = [];  // externos inactivos para validar duplicados / reactivar

  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  // ===== Cascada de clasificación (artículos NUPNPN sin clasificar) =====
  // Catálogos consumidos por el detail renderer (ClasificacionCascadaComponent) vía context.
  catCategorias: any[] = [];
  catFamilias: any[] = [];
  catSubfamilias: any[] = [];

  /**
   * ✅ Vía de entrada cuando el componente se usa como MODAL (no como cell renderer de AG Grid).
   * Construye un objeto params-like y reutiliza la MISMA lógica de agInit(), por lo que el
   * comportamiento es idéntico a cuando AG Grid lo monta. No afecta el uso como cell renderer.
   */
  @Input() set modalInit(data: ProveedorItemsOverlayData | null) {
    if (!data) return;
    const fakeParams: any = {
      data: data.pedimentoData,
      node: { data: data.pedimentoData },
      context: {},
      providerLabel: data.providerLabel,
      providerField: data.providerField,
      slotInfo: data.slotInfo,
      branchPrefix: data.branchPrefix,
      pedimentoNum: data.pedimentoNum,
      siblingSlots: data.siblingSlots,
      onSlotSaved: data.onSlotSaved
    };
    this.agInit(fakeParams);
  }

  /** Fase 2: carga catálogo de monedas (type=CURRENCY) y resuelve la default (MXN). */
  private loadMonedas(): void {
    const idCompany = this.signalsService.getRootSelectedBySidebar()();
    if (!idCompany) return;
    this.currencyService.getCurrencies(idCompany).subscribe({
      next: (data: any) => {
        const list = Array.isArray(data) ? data : (data?.catalog ?? []);
        this.monedasMap = new Map<number, string>();
        this.monedasList = [];
        let mxnId: number | null = null;
        (list || []).forEach((c: any) => {
          const id = Number(c.id);
          const abrev = (c.valueAddition || '').toString().trim();
          const nombre = c.description || '';
          this.monedasMap.set(id, abrev || nombre);
          this.monedasList.push({ id, abreviatura: abrev, nombre });
          if (mxnId === null && (abrev.toUpperCase() === 'MXN' || /peso|mexic/i.test(nombre))) mxnId = id;
        });
        this.defaultCurrencyId = mxnId ?? (list?.[0]?.id != null ? Number(list[0].id) : null);
        this.gridApi?.refreshCells({ columns: ['costoUnitario', 'costoTotal'], force: true });
      },
      error: () => { this.monedasMap = new Map(); this.defaultCurrencyId = null; }
    });
  }

  /** Abreviatura de la moneda de una fila (o 'MXN' si no resuelve). */
  private currencyAbbr(idCurrency: any): string {
    const id = (idCurrency !== undefined && idCurrency !== null) ? Number(idCurrency) : this.defaultCurrencyId;
    return (id != null ? this.monedasMap.get(Number(id)) : '') || 'MXN';
  }

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.providerLabel = (params as any).providerLabel || params.data?.providerLabel || params.context?.providerLabel || 'Proveedor';
    this.providerField = (params as any).providerField || params.data?.providerField || params.context?.providerField || 'idProvider';
    this.slotInfo = (params as any).slotInfo || params.data?.slotInfo || params.context?.slotInfo || null;
    this.branchPrefix = (params as any).branchPrefix || params.data?.branchPrefix || 'NOPREF';
    this.pedimentoNum = (params as any).pedimentoNum || params.data?.numeroPedimentoRaw || 0;
    this.deptPrefijo = ((params as any).deptPrefijo || params.data?.deptPrefijo || '').trim().toUpperCase();
    this.departmentName = (params as any).departmentName || params.data?.departmentName || '';
    this.siblingSlots = (params as any).siblingSlots || [];
    this.onSlotSavedCallback = (params as any).onSlotSaved || null;
    this.requisitionId = params.data?.requisitionId || null;
    this.idBranch = params.data?.idBranch || null;
    this.branchName = params.data?.branchName || '';
    const slotKeyForTracker = this.slotInfo?.idProvider != null
      ? `pro_${this.slotInfo.idProvider}`
      : `new_${this.slotInfo?.slotIndex ?? 'x'}`;
    this._trackerKey = `detalle-items-proveedor:${params.data?.cotizacionId ?? 'x'}:${slotKeyForTracker}`;

    // ✅ Inicializar provider desde slotInfo (no desde providerField legacy)
    const currentProviderId = this.slotInfo?.idProvider ?? null;
    if (currentProviderId && Number(currentProviderId) > 0) {
      this.selectedProviderId = Number(currentProviderId);
      this.originalProviderId = Number(currentProviderId);
    } else {
      this.originalProviderId = null;
    }

    this.catalogadmonService.getCatalogs(9, 'TYPEOC').subscribe({
      next: (items: any[]) => {
        this.typeocValues = items.filter(i => i.active).map(i => i.description as string);
        if (this.gridApi) {
          this.gridApi.setGridOption('columnDefs', this.colDefs);
        }
      },
      error: () => { this.typeocValues = []; }
    });

    this.buildRowData();
    this.cargarCatalogosClasificacion();
    this.loadMonedas();
    const idCompany = this.signalsService.getRootSelectedBySidebar()();
    // IVA viene del setup de la sucursal de la REQ que se está cotizando
    if (this.idBranch) {
      this.setupService.getWarehouseSetupByBranch(this.idBranch).subscribe({
        next: (data: any) => {
          this.ivaConfigurado = data?.iva !== null && data?.iva !== undefined;
          this.ivaPercent = data?.iva ?? 0;
        },
        error: () => { this.ivaConfigurado = false; this.ivaPercent = 0; }
      });
    }
    if (idCompany) {
      this.condicionesPagoService.getByCompany(idCompany).subscribe({
        next: (data) => {
          this.condicionesPagoOpts = (data || []).filter(c => c.active);
        },
        error: () => { this.condicionesPagoOpts = []; }
      });
    }
    this.loadProviders().then(() => {
      if (this.selectedProviderId) {
        this.selectedProviderObj = this.providers.find(p => p.id === this.selectedProviderId) || null;
      }
      this.refreshFilteredProviders();
      this.loadExistingCotiz();
      this.loadPrincipalProviders();
    });
  }

  onGridReady(params: any) {
    this.gridApi = params.api;
    if (this.ocGenerated) this.lockGrid();
  }


  async loadProviders(): Promise<void> {
    try {
      const idRoot = this.signalsService.getRootSelectedBySidebar()();
      const allProviders: any = await this.customersService.getProvidersForGrid(idRoot).toPromise();
      const isActive = (p: any) => p.vigente === true || p.active === true || p.Vigente === true;
      const externos = (allProviders || []).filter((p: any) => p.typeIntOrExt === 'Externo');
      const filtered = externos.filter(isActive);
      // Externos INACTIVOS → para detectar duplicados y ofrecer reactivar.
      this.inactiveProviders = externos.filter((p: any) => !isActive(p)).map((p: any) => ({
        id: p.id,
        name: ((p.company ?? p.name ?? '').trim()) || ((p.nameContact ?? p.namecontact ?? p.Description ?? p.description ?? '').trim()) || `Proveedor ${p.id}`,
        raw: p,
      }));
      const active = filtered.map((p: any) => {
        const company = (p.company ?? p.name ?? '').trim();
        const contact = (p.nameContact ?? p.namecontact ?? p.Description ?? p.description ?? '').trim();
        const isCompany = !!company;
        return {
          id: p.id,
          description: isCompany ? company : (contact || `Proveedor ${p.id}`),
          group: isCompany ? 'Compañía' : 'Contacto',
          sortKey: isCompany ? company : contact
        };
      }).sort((a: any, b: any) => {
        if (a.group !== b.group) return a.group === 'Compañía' ? -1 : 1;
        return a.sortKey.localeCompare(b.sortKey, 'es', { sensitivity: 'base' });
      });

      const companies = active.filter((p: any) => p.group === 'Compañía');
      const contacts = active.filter((p: any) => p.group === 'Contacto');
      const result: any[] = [{ id: this.NEW_PROVIDER_SENTINEL, description: '+ Nuevo Proveedor' }];
      if (companies.length > 0) {
        result.push({ id: '__header_company__', description: 'Compañía', disabled: true, __isHeader: true });
        result.push(...companies);
      }
      if (contacts.length > 0) {
        result.push({ id: '__header_contact__', description: 'Contacto', disabled: true, __isHeader: true });
        result.push(...contacts);
      }
      this.providers = result;
      this.refreshFilteredProviders();
    } catch (error) {
      this.providers = [{ id: this.NEW_PROVIDER_SENTINEL, description: '+ Nuevo Proveedor' }];
      this.refreshFilteredProviders();
    }
  }

  buildRowData() {
    const articulos = (this.params.data.articulos || []).filter((item: any) => !!item.pedimento);
    console.log('🔨 buildRowData: Construyendo datos iniciales con', articulos.length, 'artículos');
    // Proveedores sugeridos (panel de requisición) de los artículos de este slot.
    this.sugeridoProviderIds.clear();
    articulos.forEach((item: any) => {
      const idSug = Number(item.idProveedorSugerido);
      if (idSug > 0) this.sugeridoProviderIds.add(idSug);
    });
    this.rowData = articulos.map((item: any, index: number) => ({
      id: item.id || 0,
      active: true,
      idSupplie: item.idSupplie || 0,
      recurrent: item.recurrent || 'Recurrente',
      numArticulo: item.numarticle || item.numArticle || (item.recurrent === 'Nuevo' ? '' : (index + 1)),
      articulo: item.article || '',
      codigoExterno: '',
      proveedorXTablaId: 0,
      costoUnitario: item.price || 0,
      compraMinima: 1,
      tiempoEntrega: 1,
      cantidadConfirmada: item.quantity || 0,
      costoTotal: (item.price || 0) * (item.quantity || 0),
      autorizado: false,
      oc: '',
      typeOC: '',
      comment: '',
      datePostpone: '',
      masIva: false
    }));
    console.log('✅ buildRowData: rowData inicial:', this.rowData);
    this.updateTotal();
    this.updateHasRowsWithTypeOC();
    this.refrescarNumArticuloDesdeBD();
  }

  // ===== Cascada de clasificación (artículos NUPNPN) =====

  private cargarCatalogosClasificacion(): void {
    const idCompany = this.signalsService.getRootSelectedBySidebar()();
    if (!idCompany) return;
    // Se muestra si está marcado como MATERIA PRIMA o como BIENES Y SERVICIOS
    // (solo se oculta cuando ambos son false)
    const tieneBits = (x: any) =>
      (x?.valueAdditionBit === true || x?.valueAdditionBit === 1) ||
      (x?.valueAdditionBit3 === true || x?.valueAdditionBit3 === 1);
    this.catalogsService.getCatalogs(idCompany, 'CATEGORY').subscribe({
      next: (d: any[]) => this.catCategorias = (Array.isArray(d) ? d : []).filter(tieneBits),
      error: () => this.catCategorias = []
    });
    this.catalogsService.getCatalogs(idCompany, 'FAM-CAT').subscribe({
      next: (d: any[]) => this.catFamilias = (Array.isArray(d) ? d : []).filter(tieneBits),
      error: () => this.catFamilias = []
    });
    this.catalogsService.getCatalogs(idCompany, 'SUB-FAM').subscribe({
      next: (d: any[]) => this.catSubfamilias = (Array.isArray(d) ? d : []).filter(tieneBits),
      error: () => this.catSubfamilias = []
    });
  }

  // Llamado por el detail renderer cuando el usuario edita la clasificación.
  marcarClasifModificado(): void {
    this.hasUnsavedChanges = true;
  }

  // Refresca numArticulo de filas NUPNPN consultando el insumo real del material en BD.
  // params.data.articulos es un snapshot: si el material ya se clasificó en otro
  // proveedor, este slot debe mostrar el código real y no volver a abrir la cascada.
  private async refrescarNumArticuloDesdeBD(): Promise<void> {
    const hayPendientes = this.rowData.some(
      r => r.idSupplie > 0 && String(r?.numArticulo || '').toUpperCase().startsWith('NUPNPN')
    );
    if (!hayPendientes) return;
    const idRoot = this.signalsService.getRootSelectedBySidebar()();
    if (!idRoot) return;
    try {
      const materiales: any[] = await lastValueFrom(this.materialsService.getMaterialsxview(idRoot));
      const insumoPorId = new Map<number, string>();
      (materiales || []).forEach((m: any) => {
        const insumo = m?.insumo ?? m?.Insumo;
        if (m?.id != null && insumo) insumoPorId.set(Number(m.id), String(insumo));
      });
      let cambios = false;
      this.rowData.forEach(row => {
        if (!(row.idSupplie > 0)) return;
        if (!String(row?.numArticulo || '').toUpperCase().startsWith('NUPNPN')) return;
        const insumoReal = insumoPorId.get(Number(row.idSupplie));
        if (insumoReal && insumoReal !== row.numArticulo) {
          row.numArticulo = insumoReal;
          cambios = true;
        }
      });
      // Re-set rowData para que AG Grid re-evalúe isRowMaster (oculta la cascada)
      if (cambios && this.gridApi) {
        this.gridApi.setGridOption('rowData', this.rowData);
      }
    } catch (e) {
      console.error('Error refrescando numArticulo desde BD', e);
    }
  }

  // Alto del detail = alto del área del grid menos el header y la fila maestra visible.
  private computeDetailHeight(): number {
    const h = this.gridWrapper?.nativeElement?.clientHeight || 0;
    return Math.max(200, h - 30 - 28);
  }

  // Reclasifica los materiales con cascada pendiente; el backend regenera el num-mat (insumo).
  private async guardarClasificaciones(): Promise<void> {
    const rows = this.rowData.filter(r => r.__clasifPendiente && r.idSupplie > 0);
    for (const row of rows) {
      try {
        const resp: any = await lastValueFrom(this.materialsService.updateMaterial(String(row.idSupplie), {
          idCategory: row.clasifCategoria,
          idFamilia: row.clasifFamilia,
          idSubfamilia: row.clasifSubfamilia
        }));
        const nuevoInsumo = resp?.insumo || resp?.Insumo;
        if (nuevoInsumo) row.numArticulo = nuevoInsumo;
        delete row.__clasifPendiente;
      } catch (e) {
        console.error('Error reclasificando material', row.idSupplie, e);
      }
    }
    if (rows.length > 0 && this.gridApi) {
      this.gridApi.refreshCells({ force: true, columns: ['numArticulo'] });
    }
  }

  async onProviderChange() {
    if (this.selectedProviderId === this.NEW_PROVIDER_SENTINEL) {
      this.selectedProviderId = null;
      this.selectedProviderObj = null;
      this.newProvider = { company: '', nameContact: '', phone: '', email: '' };
      this.openNewProviderOverlay();
      return;
    }

    this.selectedProviderObj = this.providers.find(p => p.id === this.selectedProviderId) || null;
    this.hasUnsavedChanges = true;

    if (!this.selectedProviderId) return;

    try {
      // --- PASO 1: VALIDAR RELACIÓN MATERIAL-PROVEEDOR ---
      const assignments: any = await lastValueFrom(this.providersService.getProvidersXTable(this.selectedProviderId, 'MATERIAL'));
      const list: any[] = Array.isArray(assignments) ? assignments : [];

      const missingCodes: any[] = [];
      this.rowData.forEach(row => {
        const match = list.find((a: any) => Number(a.campo1) === Number(row.idSupplie));
        if (match) {
          row.codigoExterno = match.campo11 || '';
          row.compraMinima = match.minCompra || 0;
          row.costoUnitario = match.campo9 || 0;
          // Hereda la moneda del proveedor (NULL = MXN). Solo viaja; se convierte hasta el pago.
          row.idCurrency = match.idCurrency ?? null;
          row.costoTotal = (Math.round((row.costoUnitario || 0) * (row.masIva ? (1 + this.ivaPercent / 100) : 1) * 100) / 100) * (row.cantidadConfirmada || 0);
          row.proveedorXTablaId = match.id || 0;
          row.proveedorXTablaObj = match;
        } else {
          row.codigoExterno = '';
          row.compraMinima = 0;
          row.proveedorXTablaId = 0;
          row.proveedorXTablaObj = null;
          if (row.idSupplie) missingCodes.push(row);
        }
      });
      this.updateTotal();

      // ALERTA 1: Vínculo Artículo-Proveedor
      if (missingCodes.length > 0) {
        const nombres = missingCodes.map((r: any) => `• ${r.articulo}`).join('\n');
        const result = await alerts.confirmAlert('Sin Código Externo', `Este proveedor no tiene Código Externo para:\n${nombres}\n\n¿Desea crear la vinculación artículo-proveedor ahora?`, 'warning', 'Sí, vincular');
        if (result.isConfirmed) {
          this.rowsMissingProvider = missingCodes;
          await this.createMissingProviderAssignments();
        } else {
          this.selectedProviderId = null;
          this.selectedProviderObj = null;
          this.rowData.forEach(row => { row.codigoExterno = ''; row.proveedorXTablaId = 0; });
          this.gridApi?.setGridOption('rowData', this.rowData);
          this.refreshFilteredProviders();
          return;
        }
      }

      // --- PASO 2: VALIDAR AUTORIZACIÓN DE SUCURSAL Y CARGAR TIEMPO DE ENTREGA ---
      const unauthorizedForBranch: any[] = [];
      for (const row of this.rowData) {
        if (row.proveedorXTablaId > 0 && this.idBranch) {
          try {
            const sucursales: any = await lastValueFrom(this.sucursalByMaterialProveedorService.getSucursalByMaterial(row.proveedorXTablaId));
            const listSuc = Array.isArray(sucursales) ? sucursales : [];
            const sucursal = listSuc.find((s: any) => Number(s.idSucursal) === Number(this.idBranch));
            if (!sucursal) {
              unauthorizedForBranch.push(row);
            } else {
              row.tiempoEntrega = sucursal.tiempoDeEntrega || row.tiempoEntrega || 1;
            }
          } catch (err) { console.warn(`Error validando sucursal para ${row.articulo}`, err); }
        }
      }

      if (unauthorizedForBranch.length > 0) {
        const nombres = unauthorizedForBranch.map(r => `• ${r.articulo}`).join('\n');
        const result = await alerts.confirmAlert('Proveedor no autorizado para zona', `El proveedor "${this.getSelectedProviderName()}" no tiene registrada la sucursal "${this.branchName}" para:\n\n${nombres}\n\n¿Deseas registrar esta sucursal ahora?`, 'info', 'Sí, registrar');
        if (result.isConfirmed) await this.registerMissingBranchAssignments(unauthorizedForBranch);
      }

      this.gridApi?.setGridOption('rowData', this.rowData);
    } catch (error) { console.error('Error en onProviderChange', error); }
  }

  private async registerMissingBranchAssignments(rows: any[]) {
    if (!this.idBranch || !this.selectedProviderId) return;
    alerts.showLoading('Registrando sucursal...', 'Asociando proveedor a la zona de entrega');
    try {
      for (const row of rows) {
        let materialProviderId = row.proveedorXTablaId;
        if (!materialProviderId || materialProviderId === 0) {
          const provPayload = {
            idTabla: this.selectedProviderId, campo1: row.idSupplie, campo2: 'NA', campo3: 'NA', campo4: 'NA', campo5: 'NA', campo6: 'NA',
            campo7: true, campo11: row.codigoExterno || '', campo9: row.costoUnitario || 0, campo10: this.idBranch, minCompra: row.compraMinima || 0, type: 'MATERIAL', vigente: true, principal: false, active: true
          };
          const createdProv: any = await lastValueFrom(this.providersService.addProviderXTable(provPayload));
          materialProviderId = createdProv?.id ?? createdProv?.ID ?? 0;
          row.proveedorXTablaId = materialProviderId;
        }
        if (materialProviderId > 0) {
          const sucursalPayload = {
            idMaterialByProveedor: materialProviderId, idSucursal: this.idBranch, fechaAlta: new Date().toISOString(),
            stockMinimo: 0, resurtido: 0, capacidadMaxAlmacen: 0, tiempoDeEntrega: 2, vigente: true, active: true
          };
          await lastValueFrom(this.sucursalByMaterialProveedorService.addSucursalByMaterial(sucursalPayload));
        }
      }
      alerts.closeLoading();
      alerts.reqSuccessToast('Éxito', `Proveedor vinculado a "${this.branchName}" correctamente`);
    } catch (error) {
      alerts.closeLoading();
      alerts.reqErrorToast('Error', 'No se pudo completar el registro automático');
    }
  }

  private async createMissingProviderAssignments(): Promise<void> {
    const branchId = this.signalsService.getBranchSelectedBySidebar()() || 0;
    for (const row of this.rowsMissingProvider) {
      const provPayload = {
        idTabla: this.selectedProviderId, campo1: row.idSupplie, campo2: 'NA', campo3: 'NA', campo4: 'NA', campo5: 'NA', campo6: 'NA',
        campo7: true, campo11: '', campo9: 0, campo10: branchId, type: 'MATERIAL', vigente: true, principal: false, active: true
      };
      try {
        const created: any = await lastValueFrom(this.providersService.addProviderXTable(provPayload));
        row.proveedorXTablaId = created?.id || 0;
        row.proveedorXTablaObj = created || null;
        await lastValueFrom(
          this.ocandreqsService.patchProveedorXTablaCampo7(row.idSupplie, this.selectedProviderId, true)
        ).catch(() => {});
      } catch (error) { console.error(`Error creando asignación para ${row.articulo}`, error); }
    }
    this.rowsMissingProvider = [];
  }

  async saveChanges() {
    if (!this.selectedProviderId) { alert('Seleccione un proveedor.'); return; }
    if (this.savingChanges) return;
    this.gridApi?.stopEditing();
    const rowsInvalid = this.rowData.filter(r => !(r.costoUnitario > 0));
    if (rowsInvalid.length > 0) {
      const nombres = rowsInvalid.map((r: any) => `• ${r.articulo}`).join('\n');
      alerts.reqErrorToast('Costo requerido', `Los siguientes artículos no tienen costo unitario:\n${nombres}`);
      return;
    }
    const rowsInvalidTiempo = this.rowData.filter(r => !(r.tiempoEntrega > 0));
    if (rowsInvalidTiempo.length > 0) {
      const nombres = rowsInvalidTiempo.map((r: any) => `• ${r.articulo}`).join('\n');
      alerts.reqErrorToast('T. Entrega requerido', `Los siguientes artículos no tienen tiempo de entrega:\n${nombres}`);
      return;
    }
    const rowsInvalidCompra = this.rowData.filter(r => !(r.compraMinima > 0));
    if (rowsInvalidCompra.length > 0) {
      const nombres = rowsInvalidCompra.map((r: any) => `• ${r.articulo}`).join('\n');
      alerts.reqErrorToast('Compra Mín. requerida', `Los siguientes artículos no tienen compra mínima:\n${nombres}`);
      return;
    }
    // Bloqueo duro: no se puede guardar con artículos de clase nueva sin clasificar (# interno NUPNPN).
    const rowsSinClasificar = this.rowData.filter(
      r => String(r?.numArticulo || '').toUpperCase().startsWith('NUPNPN')
    );
    if (rowsSinClasificar.length > 0) {
      const nombres = rowsSinClasificar.map((r: any) => `• ${r.articulo}`).join('\n');
      await alerts.basicAlert(
        'Artículos sin clasificar',
        `No puedes guardar: los siguientes artículos tienen clase nueva sin clasificar (# interno NUPNPN). Asigna su categoría antes de guardar:\n${nombres}`,
        'warning'
      );
      return;
    }
    // Bloqueo duro: el departamento debe tener prefijo asignado (se concatena en el folio COTIZ/OC).
    if (!this.deptPrefijo) {
      await alerts.basicAlert(
        'Departamento sin prefijo',
        `El departamento '${this.departmentName || ''}' no tiene prefijo asignado. Asígnalo en el catálogo de Departamentos antes de continuar.`,
        'warning'
      );
      return;
    }
    this.savingChanges = true;
    try {
      await this.guardarClasificaciones();
      await this.saveCotizOrOC('COTIZ');
      this.setArticulosPedimentoLocked(true);
      if (this.rowsMissingProvider.length > 0) await this.createMissingProviderAssignments();

      this.cotizacionSaved = true;
      this.hasUnsavedChanges = false;
      this.originalProviderId = this.selectedProviderId;
      // Snapshot de los datos de cotización del proveedor (cabecera)
      this.originalFechaCotizacion = this.fechaCotizacion;
      this.originalNumCotizacion = this.numCotizacion;
      this.originalCondicionesPago = this.condicionesPago;
      this.originalIdCondicionPago = this.idCondicionPago;
      this.originalVigenciaCotizacion = this.vigenciaCotizacion;
      const providerName = this.getSelectedProviderName();

      // ✅ Notificar al padre que el slot quedó guardado (actualiza providerSlots y UI)
      const savedSlot = {
        slotIndex: this.slotInfo?.slotIndex,
        cotizId: this.savedOcId,
        folio: this.savedCotizFolio,
        idProvider: this.selectedProviderId,
        name: providerName
      };
      // Actualizar slotInfo local (para futuras operaciones en este mismo detalle)
      this.slotInfo = { ...this.slotInfo, ...savedSlot };
      if (this.onSlotSavedCallback) {
        try { this.onSlotSavedCallback(savedSlot); } catch (e) { console.warn('onSlotSaved error', e); }
      }
      this.refreshFilteredProviders();
      const cotizId = this.params.data.cotizacionId;
      const maestro: any = await lastValueFrom(this.ocandreqsService.getDetailedReq(cotizId));
      if (maestro) {
        maestro.dateModified = new Date().toISOString();
        await lastValueFrom(this.ocandreqsService.updateOcAndReq(cotizId, maestro));
        // Se elimina la notificación global para evitar el cierre de tablas por reordenamiento
        // this.pedimentoModificationService.pedimentoModified$.next(cotizId);
      }
      await alerts.ocCotizSaved(this.savedCotizFolio);

      // (El bloqueo de artículos sin clasificar NUPNPN ahora ocurre ANTES de guardar, en saveChanges.)

      const hasAuthorized = this.rowData.some(row => this.AUTHORIZED_TYPES.includes(row.typeOC));
      if (hasAuthorized) { this.savingChanges = false; await this.generateOC(); }
    } catch (error) { alert('Error al guardar.'); } finally { this.savingChanges = false; }
  }

  private async saveCotizOrOC(type: 'COTIZ' | 'OC'): Promise<string> {
    const idRoot = this.signalsService.getRootSelectedBySidebar()();
    const idBranch = this.signalsService.getBranchSelectedBySidebar()();
    // ✅ Nueva nomenclatura de folio: ${type}-{branchPrefix}-{deptPrefijo}-P{pedimentoNum}-PRO{idProvider}
    // Ejemplo: COTIZ-BOD15-EF-P1-PRO1414  /  OC-BOD15-EF-P1-PRO1414
    const deptSeg = (this.deptPrefijo || '').trim().toUpperCase();
    const folio = `${type}-${this.branchPrefix || 'NOPREF'}-${deptSeg ? deptSeg + '-' : ''}P${this.pedimentoNum || 0}-PRO${this.selectedProviderId}`;
    const providerName = this.getSelectedProviderName();
    const dateCreate = new Date().toISOString().split('T')[0];
    // Derivar el string de condiciones desde el DTO seleccionado (backward compat).
    const selectedCond = this.condicionesPagoOpts.find(o => o.id === this.idCondicionPago);
    const condicionesPagoStr = selectedCond
      ? `${selectedCond.descripcion} - ${selectedCond.cantidad}`
      : '';
    this.condicionesPago = condicionesPagoStr;
    const ocPayload = {
      idRoot, folio, typeReference: type === 'OC' ? 'branch' : 'delison', idReference: type === 'OC' ? (idBranch || 0) : (this.params.data.cotizacionId || 0),
      idReq: this.params.data.requisitionId || 0, dateCreate, idProvider: this.selectedProviderId, solicit: providerName.substring(0, 50),
      idDepartament: 0, delivery: 'NO APLICA', deliveryTime: '1 DAY', typeOc: 'INSUMOS', idPayment: 0, idCurrency: 0, type, datesupply: this.fechaCotizacion, active: true,
      // Datos de la cotización del proveedor (cabecera)
      numCotizacion: this.numCotizacion || '',
      condicionesPago: condicionesPagoStr,
      idCondicionPago: this.idCondicionPago,
      vigenciaCotizacion: this.vigenciaCotizacion ?? null
    };
    let newOcId: number;
    if (type === 'COTIZ' && this.savedOcId > 0) {
      // UPDATE: GET del registro completo, fusionar cambios y PUT
      const existing: any = await lastValueFrom(this.ocandreqsService.getDetailedReq(this.savedOcId));
      const merged = {
        ...existing,
        folio,
        idProvider: this.selectedProviderId,
        solicit: providerName.substring(0, 50),
        datesupply: this.fechaCotizacion,
        dateModified: new Date().toISOString(),
        // Datos de la cotización del proveedor (cabecera)
        numCotizacion: this.numCotizacion || '',
        condicionesPago: condicionesPagoStr,
        idCondicionPago: this.idCondicionPago,
        vigenciaCotizacion: this.vigenciaCotizacion ?? null,
      };
      await lastValueFrom(this.ocandreqsService.updateOcAndReq(this.savedOcId, merged));
      newOcId = this.savedOcId;
    } else {
      // INSERT: primera vez, crea registro nuevo
      const created: any = await lastValueFrom(this.ocandreqsService.addOcAndReq(ocPayload));
      console.log('🔑 Respuesta addOcAndReq:', JSON.stringify(created));
      newOcId = Number(created?.id ?? created?.data?.id ?? created?.project?.id);
      console.log('🔑 newOcId calculado:', newOcId);
    }
    const gridRows: any[] = [];
    this.gridApi.forEachNode((node: any) => gridRows.push(node.data));
    const rowsForDetails = type === 'OC' ? gridRows.filter((row: any) => this.AUTHORIZED_TYPES.includes(row.typeOC)) : gridRows;
    const details = rowsForDetails.map((row: any) => {
      const weeks = parseInt(String(row.tiempoEntrega)) || 0;
      const d = new Date(dateCreate);
      if (weeks > 0) d.setDate(d.getDate() + weeks * 7);
      const datePostpone = weeks > 0 ? d.toISOString().split('T')[0] : '';
      return {
        idMovement: newOcId, idSupplie: row.idSupplie || 0, idProvider: this.selectedProviderId, nameProvider: providerName, quantity: parseFloat(row.cantidadConfirmada) || 0,
        price: parseFloat(row.costoUnitario) || 0, type, recurrent: row.recurrent || 'Recurrente', nameArticle: row.articulo || '', numArticle: String(row.numArticulo || ''), observation: String(row.codigoExterno ?? '').trim(), typeOc: row.typeOC || '', comment: row.comment || '', tiempoEntrega: row.tiempoEntrega > 0 ? String(row.tiempoEntrega) : '0', compraMinima: isNaN(parseFloat(String(row.compraMinima))) ? 0 : parseFloat(String(row.compraMinima)), caducidadMinimaRequerida: row.caducidadMinimaRequerida || '', datePostpone,
        masIva: row.masIva ?? false,
        idCurrency: row.idCurrency ?? null
      };
    });
    // Fetch current DB items to update in place (prevents delete+reinsert duplication)
    const dbItemsBySupplieId = new Map<number, any>();
    if (type === 'COTIZ' && this.savedOcId > 0) {
      const currentDbItems: any[] = await lastValueFrom(this.ocandreqsService.getReqItems(this.savedOcId));
      currentDbItems.forEach(item => dbItemsBySupplieId.set(item.idSupplie, item));
    }
    console.log('📝 saveCotizOrOC: Guardando', details.length, 'items, existentes en BD:', dbItemsBySupplieId.size);
    for (const d of details) {
      try {
        const existingDbItem = dbItemsBySupplieId.get(d.idSupplie);
        if (existingDbItem) {
          await lastValueFrom(this.ocandreqsService.updateReqItem(String(existingDbItem.id), d));
          dbItemsBySupplieId.delete(d.idSupplie);
          console.log('✅ saveCotizOrOC: Item actualizado id:', existingDbItem.id);
        } else {
          await lastValueFrom(this.ocandreqsService.addReqItem(d));
          console.log('✅ saveCotizOrOC: Item nuevo insertado');
        }
      } catch (err) {
        console.error('❌ saveCotizOrOC: Error guardando item:', err);
      }
    }
    // Soft-delete DB items that were removed from the grid
    if (dbItemsBySupplieId.size > 0) {
      await Promise.all([...dbItemsBySupplieId.values()].map(item =>
        lastValueFrom(this.ocandreqsService.deleteReqItem(item.id)).catch(() => {})
      ));
    }

    // Refrescar proveedorXTablaObj desde BD antes del PUT para preservar active/campo7 ya modificados
    if (this.selectedProviderId && type === 'COTIZ') {
      await this.syncProveedorXTablaFields(this.selectedProviderId);
    }

    // Sincronizar codigoExterno (campo11), compraMinima (minima_compra) y costoUnitario (campo9) → proveedorxtablas en un solo PUT
    if (this.selectedProviderId) {
      for (const row of rowsForDetails) {
        if (row.proveedorXTablaId > 0 && row.proveedorXTablaObj) {
          const updatedProv = {
            ...row.proveedorXTablaObj,
            campo11: String(row.codigoExterno ?? '').trim(),
            minCompra: isNaN(parseFloat(String(row.compraMinima))) ? 0 : parseFloat(String(row.compraMinima)),
            campo9: isNaN(parseFloat(String(row.costoUnitario))) ? 0 : parseFloat(String(row.costoUnitario))
          };
          this.providersService.updateProviderXTable(row.proveedorXTablaId, updatedProv)
            .subscribe({ error: e => console.warn(`⚠️ No se pudo sincronizar proveedorxtabla para ${row.articulo}:`, e) });
        }
      }
    }

    if (type === 'COTIZ') {
      this.savedCotizFolio = folio;
      this.savedOcId = newOcId;
      await this.loadSavedItems(newOcId);
      if (this.selectedProviderId) {
        await this.syncProveedorXTablaFields(this.selectedProviderId);
        // Sincronizar tiempoEntrega DESPUÉS de obtener proveedorXTablaId
        await this.syncTiempoEntregaFields(rowsForDetails);
      }
    }
    return folio;
  }

  private async syncProveedorXTablaFields(idProvider: number): Promise<void> {
    try {
      const assignments: any = await lastValueFrom(this.providersService.getProvidersXTable(idProvider, 'MATERIAL'));
      const list: any[] = Array.isArray(assignments) ? assignments : [];
      this.rowData.forEach(row => {
        const match = list.find((a: any) => Number(a.campo1) === Number(row.idSupplie));
        if (match) {
          // codigoExterno NO se sobreescribe: cada cotización conserva su propio valor de detailsreqoc
          // compraMinima NO se sobreescribe: cada cotización conserva su propio valor de detailsreqoc
          row.proveedorXTablaId = match.id || 0;
          row.proveedorXTablaObj = match;
        }
      });
      if (this.gridApi) this.gridApi.setGridOption('rowData', this.rowData);
    } catch (e) {
      console.warn('⚠️ syncProveedorXTablaFields: Error cargando proveedorxtablas', e);
    }
  }

  private async syncTiempoEntregaFields(rowsForDetails: any[]): Promise<void> {
    try {
      for (const row of rowsForDetails) {
        if (this.idBranch > 0 && row.proveedorXTablaId > 0 && row.tiempoEntrega !== undefined && row.tiempoEntrega !== null && row.tiempoEntrega > 0) {
          await lastValueFrom(
            this.sucursalByMaterialProveedorService.patchTiempoDeEntrega(row.proveedorXTablaId, this.selectedProviderId, this.idBranch, row.tiempoEntrega)
          ).catch(e => console.warn(`⚠️ No se pudo sincronizar tiempo de entrega para ${row.articulo}:`, e));
        }
      }
    } catch (e) {
      console.warn('⚠️ syncTiempoEntregaFields: Error sincronizando tiempoEntrega', e);
    }
  }

  async loadExistingCotiz(): Promise<void> {
    const cotizacionId = this.params.data.cotizacionId;
    console.log('🔍 loadExistingCotiz: Iniciando con cotizacionId:', cotizacionId, 'slotInfo:', this.slotInfo);
    if (!cotizacionId) { console.log('⚠️ loadExistingCotiz: No hay cotizacionId'); return; }

    // Slot nuevo (sin cotizId): no hay nada que cargar todavía
    if (!this.slotInfo?.cotizId || this.slotInfo.cotizId === 0) {
      console.log('🆕 loadExistingCotiz: Slot nuevo (sin guardar), nada que cargar');
      return;
    }

    try {
      const idBranch = this.signalsService.getBranchSelectedBySidebar()();
      const reqId = this.params.data.requisitionId || 0;
      const slotProviderId = Number(this.slotInfo.idProvider);
      const [cotizData, ocData] = await Promise.all([
        lastValueFrom(this.ocandreqsService.getOcAndReqs('delison', cotizacionId, 'COTIZ')),
        lastValueFrom(this.ocandreqsService.getOcAndReqs('branch', idBranch, 'OC'))
      ]);
      // Detectar OC ya generada para ESTE slot (mismo idProvider, mismo cotizacion padre)
      const ocList = (Array.isArray(ocData) ? ocData : []).filter((c: any) => Number(c.idReq) === Number(reqId));
      const ocForThisProvider = ocList.find((c: any) =>
        Number(c.idProvider) === slotProviderId && (c.folio || '').includes(`PRO${slotProviderId}`)
      );
      if (ocForThisProvider) {
        console.log('⚠️ loadExistingCotiz: OC ya generada para este slot, bloqueando grid');
        this.ocGenerated = true; this.cotizacionSaved = true; this.lockGrid(); this.setArticulosPedimentoLocked(true);
      }
      // Cargar el COTIZ específico del slot (por cotizId directo, sin filtrar por folio)
      const existing = (Array.isArray(cotizData) ? cotizData : []).find(
        (c: any) => Number(c.id) === Number(this.slotInfo.cotizId)
      );
      console.log('🔎 loadExistingCotiz: Cotización del slot encontrada:', existing);
      if (existing) {
        this.savedOcId = existing.id; this.cotizacionSaved = true; this.savedCotizFolio = existing.folio;
        if (existing.idProvider) {
          this.selectedProviderId = existing.idProvider;
          this.selectedProviderObj = this.providers.find(p => p.id === existing.idProvider) || null;
          this.originalProviderId = existing.idProvider;
        }
        if (existing.datesupply) this.fechaCotizacion = String(existing.datesupply).substring(0, 10);
        // Cargar datos de la cotización del proveedor (cabecera de ocandreq)
        this.numCotizacion = existing.numCotizacion ?? '';
        this.condicionesPago = existing.condicionesPago ?? '';
        this.idCondicionPago = existing.idCondicionPago ?? null;
        this.vigenciaCotizacion = existing.vigenciaCotizacion ?? null;
        this.originalFechaCotizacion = this.fechaCotizacion;
        this.originalNumCotizacion = this.numCotizacion;
        this.originalCondicionesPago = this.condicionesPago;
        this.originalIdCondicionPago = this.idCondicionPago;
        this.originalVigenciaCotizacion = this.vigenciaCotizacion;
        await this.loadSavedItems(existing.id);
        if (existing.idProvider) await this.syncProveedorXTablaFields(existing.idProvider);
        this.setArticulosPedimentoLocked(true);
      }
    } catch (err) { console.error('❌ Error loadExistingCotiz:', err); }
  }

  async loadSavedItems(ocId: number): Promise<void> {
    try {
      console.log('🔍 loadSavedItems: Cargando items para ocId:', ocId);
      const items: any = await lastValueFrom(this.ocandreqsService.getReqItems(ocId));
      console.log('📦 loadSavedItems: Items recibidos del servidor:', items);

      // Si no hay items guardados, mantener los datos originales de buildRowData
      if (!Array.isArray(items) || items.length === 0) {
        console.warn('⚠️ loadSavedItems: No hay items guardados para ocId:', ocId, '- Manteniendo datos originales de buildRowData');
        console.log('📊 loadSavedItems: rowData original (sin cambios):', this.rowData);
        return; // No sobrescribir, mantener datos originales
      }

      const mappedData = items.map((item: any) => ({
        id: item.id || 0, idSupplie: item.id_supplie || item.idSupplie || 0, recurrent: item.recurrent || 'Recurrente', active: item.active !== false, numArticulo: item.numarticle || item.numArticle || '', articulo: item.namearticle || item.description || item.nameArticle || '',
        codigoExterno: item.observation ?? '', proveedorXTablaId: 0, costoUnitario: item.price || 0, compraMinima: item.compraMinima ?? item.compraminima ?? 0, tiempoEntrega: parseInt(item.tiempoentrega ?? item.tiempoEntrega ?? '0') || 0,
        cantidadConfirmada: item.quantity || 0,
        costoTotal: (item.masIva ?? false) ? (Math.round((item.price || 0) * (1 + this.ivaPercent / 100) * 100) / 100) * (item.quantity || 0) : (item.total || 0),
        autorizado: item.autorizado || false, oc: '', typeOC: item.typeoc || item.typeOc || '', comment: item.comment || '',
        masIva: item.masIva ?? false,
        idCurrency: item.idCurrency ?? item.id_currency ?? null
      }));

      console.log('✅ loadSavedItems: Datos mapeados:', mappedData);
      this.rowData = mappedData;
      console.log('📊 loadSavedItems: rowData asignado:', this.rowData);

      if (this.gridApi) {
        this.gridApi.setGridOption('rowData', this.rowData);
        console.log('✅ loadSavedItems: Grid actualizado');
      } else {
        console.warn('⚠️ loadSavedItems: gridApi no disponible');
      }
      this.updateTotal();
      this.updateHasRowsWithTypeOC();
      this.refrescarNumArticuloDesdeBD();
    } catch (err) { console.error('❌ Error loadSavedItems:', err); }
  }

  revertChanges() {
    this.buildRowData();
    this.updateTotal();
    // Restaurar selección de proveedor al último estado "persistido"
    this.selectedProviderId = this.originalProviderId;
    this.selectedProviderObj = this.originalProviderId
      ? (this.providers.find(p => p.id === this.originalProviderId) || null)
      : null;
    // Restaurar datos de la cotización del proveedor (cabecera)
    this.fechaCotizacion = this.originalFechaCotizacion;
    this.numCotizacion = this.originalNumCotizacion;
    this.condicionesPago = this.originalCondicionesPago;
    this.idCondicionPago = this.originalIdCondicionPago;
    this.vigenciaCotizacion = this.originalVigenciaCotizacion;
    this.refreshFilteredProviders();
    this.hasUnsavedChanges = false;
    this.gridApi?.setGridOption('rowData', this.rowData);
  }

  onHeaderFieldChanged(): void {
    this.hasUnsavedChanges = true;
  }

  deleteItem() { alert('Eliminación no implementada.'); }

  get colDefs(): ColDef[] {
    if (this._colDefs && this._colDefs.length > 0) return this._colDefs;

    this._colDefs = [
      { field: 'active', headerName: 'Activo', width: 120, cellRenderer: 'agCheckboxCellRenderer', cellEditor: 'agCheckboxCellEditor', editable: !this.ocGenerated },
      {
        field: 'numArticulo', headerName: '# interno de articulo', width: 169,
        cellStyle: (p: any) => String(p.value || '').toUpperCase().startsWith('NUPNPN')
          ? { cursor: 'pointer', backgroundColor: '#fff9e6', textDecoration: 'underline', color: '#b8860b' }
          : null,
        cellRenderer: (p: any) => {
          const val = String(p.value ?? '');
          if (val.toUpperCase().startsWith('NUPNPN')) {
            const chevron = p.node?.expanded ? '▼' : '▶';
            return `<span style="margin-right:4px;">${chevron}</span>${val}`;
          }
          return val;
        },
        onCellClicked: (e: any) => {
          const val = String(e.data?.numArticulo || '').toUpperCase();
          if (!val.startsWith('NUPNPN') || this.ocGenerated) return;
          const willExpand = !e.node.expanded;
          if (willExpand) {
            // Acordeón: ocultar las demás filas, solo queda visible la fila enfocada + su detalle.
            // El detail toma su alto vía getRowHeight (computeDetailHeight) al expandirse.
            this.gridApi.forEachNode((other: any) => {
              if (other.id !== e.node.id) other.setRowHeight(0);
            });
            e.node.setExpanded(true);
          } else {
            e.node.setExpanded(false);
            // Restaurar la altura de todas las filas
            this.gridApi.forEachNode((other: any) => other.setRowHeight(undefined));
          }
          this.gridApi.onRowHeightChanged();
          this.gridApi.refreshCells({ rowNodes: [e.node], columns: ['numArticulo'], force: true });
        }
      },
      { field: 'articulo', headerName: 'Artículo', width: 260 },
      { field: 'codigoExterno', headerName: 'Cód. Externo', width: 140, editable: !this.ocGenerated,
        valueFormatter: (params: any) => {
          if (!this.selectedProviderId) return '-';
          return params.value ?? '';
        }
      },
      { field: 'tiempoEntrega', headerName: 'T. Entrega x Semanas', width: 170, editable: !this.ocGenerated,
        cellEditor: 'agNumberCellEditor', cellEditorParams: { precision: 0, min: 0 },
        valueFormatter: (params: any) => {
          if (!this.selectedProviderId) return '-';
          return params.value > 0 ? String(params.value) : '';
        },
        valueSetter: (params: any) => {
          const n = parseInt(String(params.newValue));
          if (isNaN(n) || n <= 0) { alerts.reqErrorToast('T. Entrega inválido', 'El tiempo de entrega debe ser mayor que cero'); return false; }
          params.data.tiempoEntrega = n;
          return true;
        }
      },
      { field: 'compraMinima', headerName: 'Compra Mín.', width: 145, editable: !this.ocGenerated,
        cellEditor: 'agNumberCellEditor', cellEditorParams: { min: 0, precision: 1 },
        valueFormatter: (params: any) => {
          if (!this.selectedProviderId) return '-';
          const n = Number(params.value);
          if (!(n > 0)) return '';
          const r = Math.round(n * 10) / 10;   // 1 decimal; sin ceros sobrantes (2 → "2", 1.5 → "1.5")
          return String(r);
        },
        valueSetter: (params: any) => {
          const n = parseFloat(String(params.newValue));
          if (isNaN(n) || n <= 0) { alerts.reqErrorToast('Compra Mín. inválida', 'La compra mínima debe ser mayor que cero'); return false; }
          params.data.compraMinima = Math.round(n * 10) / 10;   // máximo 1 decimal
          return true;
        }
      },
      { field: 'cantidadConfirmada', headerName: 'Cantidad Requerida', width: 150, editable: false,
        cellStyle: { textAlign: 'right' },
        valueFormatter: (params: any) => {
          if (params.value === null || params.value === undefined || params.value === '') return '';
          return String(params.value);
        }
      },
      { field: 'costoUnitario', headerName: 'Costo Unit.', width: 140, editable: !this.ocGenerated,
        // Editor compuesto monto + moneda (igual que Gastos/COTIZ): permite capturar costo y elegir
        // la moneda cuando el artículo es nuevo para el proveedor (o cambiarla en cualquier fila).
        cellEditor: PrecioMonedaEditorComponent,
        cellEditorParams: () => ({ monedas: this.monedasList, defaultCurrencyId: this.defaultCurrencyId }),
        valueFormatter: (params: any) => {
          if (!this.selectedProviderId) return '-';
          // Se muestra el costo CON IVA (round2) cuando la fila tiene + IVA; el original va en el tooltip.
          const base = Number(params.value) || 0;
          const shown = params.data?.masIva ? Math.round(base * (1 + this.ivaPercent / 100) * 100) / 100 : base;
          const abbr = this.currencyAbbr(params.data?.idCurrency);
          return `$${(shown || 0).toFixed(2)} ${abbr}`;
        },
        valueSetter: (params: any) => {
          const val = parseFloat(params.newValue);
          if (isNaN(val) || val <= 0) { alerts.reqErrorToast('Costo inválido', 'El costo unitario debe ser mayor que cero'); return false; }
          params.data.costoUnitario = val;
          const unit = params.data.masIva ? Math.round(val * (1 + this.ivaPercent / 100) * 100) / 100 : val;
          params.data.costoTotal = unit * (params.data.cantidadConfirmada || 0);
          // El editor pudo cambiar la moneda (idCurrency) → refrescar la moneda mostrada en Costo Total.
          setTimeout(() => this.gridApi?.refreshCells({ rowNodes: [params.node], columns: ['costoUnitario', 'costoTotal'], force: true }), 0);
          return true;
        } },
      { field: 'masIva', headerName: '+ IVA', width: 100, cellRenderer: 'agCheckboxCellRenderer', cellEditor: 'agCheckboxCellEditor', editable: !this.ocGenerated },
      { field: 'costoTotal', headerName: 'Costo Total', width: 170,
        valueFormatter: (params: any) => {
          if (!this.selectedProviderId) return '-';
          const abbr = this.currencyAbbr(params.data?.idCurrency);
          return `$${(Number(params.value) || 0).toFixed(2)} ${abbr}`;
        }
      },
      { headerName: 'Comentarios💬', width: 170, sortable: false, filter: false,
        cellRenderer: ItemCommentsCellRendererComponent,
        cellRendererParams: (params: any) => ({
          documentType: 'REQ',
          idDocument: this.requisitionId,
          numArticle: params.data?.numArticulo || (params.data?.idSupplie ? `SUPP-${params.data.idSupplie}` : ''),
          idProvider: Number(this.selectedProviderId ?? 0),
          locked: this.ocGenerated
        }),
        onCellClicked: (params: any) => {
          if (this.ocGenerated) return;
          const numArticle = params.data?.numArticulo || (params.data?.idSupplie ? `SUPP-${params.data.idSupplie}` : '');
          if (!numArticle || !this.requisitionId) return;
          const providerId = Number(this.selectedProviderId ?? 0);
          this.itemCommentsService.openChatFor$.next({
            documentType: 'REQ',
            idDocument: this.requisitionId,
            numArticle,
            articleName: String(params.data?.articulo ?? ''),
            providerMessages: providerId
              ? { idProvider: providerId, providerName: this.getSelectedProviderName() }
              : undefined
          });
        }
      },
      { field: 'typeOC', headerName: 'Tipo OC', width: 130, editable: !this.ocGenerated, hide: true, cellEditor: 'agRichSelectCellEditor', cellEditorParams: () => ({ values: this.typeocValues }), cellEditorPopup: true },
      { field: 'oc', headerName: 'OC', width: 100, editable: !this.ocGenerated, hide: true }
    ];
    return this._colDefs;
  }

  public gridOptions: any = {
    headerHeight: 30, rowHeight: 28, animateRows: true, suppressCellFocus: false, stopEditingWhenCellsLoseFocus: true, tooltipShowDelay: 400,
    autoSizeStrategy: {
      type: 'fitCellContents',
    },
    defaultColDef: { resizable: true, sortable: true, filter: true },
    onCellEditingStarted: () => { if (this.ocGenerated) this.gridApi?.stopEditing(true); },
    onCellMouseOver: (event: any) => {
      if (event.colDef?.field === 'costoUnitario' && event.data?.masIva) {
        const cellEl = event.event?.target as HTMLElement;
        if (cellEl) {
          // La columna muestra el costo CON IVA; el tooltip muestra el ORIGINAL sin IVA.
          this.costoIvaTooltip.show(cellEl.getBoundingClientRect(), event.data?.costoUnitario ?? 0);
        }
      }
    },
    onCellMouseOut: (event: any) => {
      if (event.colDef?.field === 'costoUnitario') this.costoIvaTooltip.hide();
    },
    // Master-detail: solo los artículos nuevos (NUPNPN) se expanden con la cascada de clasificación
    masterDetail: true,
    isRowMaster: (dataItem: any) =>
      String(dataItem?.numArticulo || '').toUpperCase().startsWith('NUPNPN'),
    detailCellRenderer: ClasificacionCascadaComponent,
    // El detail ocupa todo el alto disponible del grid (getRowHeight se evalúa al expandir)
    getRowHeight: (p: any) => p?.node?.detail ? this.computeDetailHeight() : undefined,
    context: { componentParent: this }
  };

  private setArticulosPedimentoLocked(locked: boolean): void {
    const d = this.params?.node?.data as { articulosPedimentoLocked?: boolean } | undefined;
    if (d) d.articulosPedimentoLocked = locked;
  }

  private lockGrid() {
    if (!this.gridApi) return;
    this.gridApi.setGridOption('columnDefs', this.colDefs);
    this.gridApi.setGridOption('suppressClickEdit', true);
    this.gridApi.refreshCells({ force: true });
  }

  private getSelectedProviderName(): string { return this.selectedProviderObj?.description || 'Sin seleccionar'; }
  updateTotal() {
    this.totalCostoTotal = this.rowData.reduce((sum, row) => sum + (row.costoTotal || 0), 0);
    this.totalCotizacionDisplay = this.buildTotalsByCurrencyDisplay(this.rowData);
  }

  /**
   * "Total Cotización" por moneda (Opción A, sin convertir). Agrupa costoTotal por moneda;
   * 1 moneda → "$X.XX MXN"; varias → "$X.XX MXN / $Y.YY USD" (default/MXN primero).
   */
  private buildTotalsByCurrencyDisplay(rows: any[]): string {
    const sums = new Map<number, number>();
    for (const r of (rows || [])) {
      const id = (r?.idCurrency !== undefined && r?.idCurrency !== null)
        ? Number(r.idCurrency)
        : (this.defaultCurrencyId ?? -1);
      sums.set(id, (sums.get(id) || 0) + (Number(r?.costoTotal) || 0));
    }
    if (sums.size === 0) return `$0.00 ${this.currencyAbbr(this.defaultCurrencyId)}`;
    const entries = Array.from(sums.entries()).sort((a, b) => {
      if (a[0] === this.defaultCurrencyId) return -1;
      if (b[0] === this.defaultCurrencyId) return 1;
      return this.currencyAbbr(a[0]).localeCompare(this.currencyAbbr(b[0]));
    });
    return entries.map(([id, sum]) =>
      `$${sum.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${this.currencyAbbr(id)}`
    ).join(' / ');
  }
  updateHasRowsWithTypeOC() { this.hasRowsWithTypeOC = this.rowData.some(row => !!(row.typeOC && row.typeOC.trim() !== '')); }
  get allCostosValid(): boolean { return !!this.selectedProviderId; }

  private async loadPrincipalProviders(): Promise<void> {
    this.principalProviderIds.clear();
    const uniqueIds = [...new Set(
      this.rowData.filter(r => r.idSupplie > 0).map(r => r.idSupplie as number)
    )];
    await Promise.all(uniqueIds.map(async (idSupplie) => {
      try {
        const relations: any = await lastValueFrom(this.providersService.getMaterXTable(idSupplie, 'MATERIAL'));
        const principal = (Array.isArray(relations) ? relations : [])
          .find((rel: any) => rel.principal === true && rel.active === true);
        if (principal?.idTabla) {
          this.principalProviderIds.add(principal.idTabla);
        }
      } catch { /* silencioso */ }
    }));
    this.refreshFilteredProviders();
  }

  private refreshFilteredProviders(): void {
    // ✅ Slots hermanos vienen del padre (todos menos este), N proveedores soportados
    const usedIds = new Set(
      (this.siblingSlots || [])
        .map((s: any) => Number(s?.idProvider))
        .filter((id: number) => Number.isFinite(id) && id > 0)
    );
    const base = usedIds.size === 0
      ? this.providers
      : this.providers.filter(p => p.id === this.NEW_PROVIDER_SENTINEL || !usedIds.has(p.id));

    // Construir orden manual: + Nuevo → ⭐ Principales → 💡 Sugerido → Header Compañía → Compañías → Header Contacto → Contactos
    const withFlag = base.map(p => ({ ...p, isPrincipal: this.principalProviderIds.has(p.id), isSugerido: this.sugeridoProviderIds.has(p.id) }));
    const newProvider = withFlag.find(p => p.id === this.NEW_PROVIDER_SENTINEL);
    const headerCompany = withFlag.find(p => p.__isHeader && p.id === '__header_company__');
    const headerContact = withFlag.find(p => p.__isHeader && p.id === '__header_contact__');
    const realProviders = withFlag.filter(p => !p.__isHeader && p.id !== this.NEW_PROVIDER_SENTINEL);
    const principals = realProviders
      .filter(p => p.isPrincipal)
      .sort((a, b) => (a.sortKey || '').localeCompare(b.sortKey || '', 'es', { sensitivity: 'base' }));
    // Sugeridos por la requisición que NO son principales → se muestran justo debajo de los
    // principales (estrella), fuera de su grupo Compañía/Contacto para no duplicarlos.
    const sugeridos = realProviders
      .filter(p => p.isSugerido && !p.isPrincipal)
      .sort((a, b) => (a.sortKey || '').localeCompare(b.sortKey || '', 'es', { sensitivity: 'base' }));
    const companies = realProviders
      .filter(p => !p.isPrincipal && !p.isSugerido && p.group === 'Compañía')
      .sort((a, b) => (a.sortKey || '').localeCompare(b.sortKey || '', 'es', { sensitivity: 'base' }));
    const contacts = realProviders
      .filter(p => !p.isPrincipal && !p.isSugerido && p.group === 'Contacto')
      .sort((a, b) => (a.sortKey || '').localeCompare(b.sortKey || '', 'es', { sensitivity: 'base' }));

    const result: any[] = [];
    if (newProvider) result.push(newProvider);
    if (principals.length > 0) result.push(...principals);
    if (sugeridos.length > 0) result.push(...sugeridos);   // 💡 justo debajo de la estrella
    if (companies.length > 0 && headerCompany) {
      result.push(headerCompany);
      result.push(...companies);
    }
    if (contacts.length > 0 && headerContact) {
      result.push(headerContact);
      result.push(...contacts);
    }
    this.filteredProviders = result;
  }
  onCellValueChanged(event: any) {
    // Validación: si marca +IVA pero la sucursal no tiene IVA configurado, revertir y alertar
    if (event.column.getColId() === 'masIva' && event.newValue === true && !this.ivaConfigurado) {
      alerts.basicAlert(
        'IVA no configurado',
        `Para aplicar IVA necesitas definirlo en configuración para la sucursal "${this.branchName}".`,
        'warning'
      );
      event.data.masIva = false;
      this.gridApi.refreshCells({ rowNodes: [event.node], force: true });
      return;
    }
    this.hasUnsavedChanges = true;
    if (event.column.getColId() === 'costoUnitario' || event.column.getColId() === 'cantidadConfirmada' || event.column.getColId() === 'masIva') {
      const row = event.data; row.costoTotal = (Math.round((row.costoUnitario || 0) * (row.masIva ? (1 + this.ivaPercent / 100) : 1) * 100) / 100) * (row.cantidadConfirmada || 0);
      // Usar force: false para actualizar datos sin destruir el editor (evita perder el focus)
      this.gridApi.refreshCells({ rowNodes: [event.node], force: false });
    }
    this.updateTotal(); this.updateHasRowsWithTypeOC();
  }
  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
      alerts.reqSuccessToast('PDF Cargado', file.name);
    }
  }
  generatePlaceholderPdf() { alerts.basicAlert('PDF', 'Abriendo vista previa...', 'info'); }
  async generateOC() { this.generatingOC = true; setTimeout(() => { this.generatingOC = false; alerts.ocGenerated('OC-TEMP-123'); }, 1000); }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this._hasUnsavedChanges) {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  /** Llamado por el componente padre antes de colapsar/cambiar la cascada. */
  async canCloseDetail(): Promise<boolean> {
    if (!this._hasUnsavedChanges) return true;
    return this.unsavedTracker.confirmExitIfAny();
  }

  ngOnDestroy(): void {
    this.closeNewProviderOverlay();
    if (this._trackerKey) {
      this.unsavedTracker.unregister(this._trackerKey);
    }
  }

  cancelNewProvider() {
    this.closeNewProviderOverlay();
  }
  onCompanyInput(value: string) {
    if (!value) { this.companySuggestions = []; this.showCompanySuggestions = false; return; }
    const term = value.toLowerCase();
    this.companySuggestions = this.providers.filter(p => p.id !== this.NEW_PROVIDER_SENTINEL && !p.__isHeader && p.description.toLowerCase().includes(term)).map(p => p.description);
    this.showCompanySuggestions = this.companySuggestions.length > 0;
  }
  hideCompanySuggestionsDelayed() { setTimeout(() => { this.showCompanySuggestions = false; }, 200); }
  selectCompanySuggestion(name: string) { this.newProvider.company = name; this.showCompanySuggestions = false; }
  async confirmNewProvider() {
    if (!this.newProvider.company.trim() && !this.newProvider.nameContact.trim()) {
      alerts.reqErrorToast('Requerido', 'Ingresa la compañía y/o el contacto principal');
      return;
    }

    // Validación de duplicados: bloquear si ya existe un proveedor con el mismo nombre.
    const norm = (s: string) => String(s || '').trim().toUpperCase().replace(/\s+/g, ' ');
    const existentes = new Set(
      this.providers
        .filter(p => !p.__isHeader && p.id !== this.NEW_PROVIDER_SENTINEL)
        .map(p => norm(p.description))
    );
    const companyN = norm(this.newProvider.company);
    const contactN = norm(this.newProvider.nameContact);
    if ((companyN && existentes.has(companyN)) || (contactN && existentes.has(contactN))) {
      const dup = (companyN && existentes.has(companyN)) ? this.newProvider.company.trim() : this.newProvider.nameContact.trim();
      alerts.basicAlert(
        'Proveedor duplicado',
        `Ya existe un proveedor registrado como "${dup}". No se puede registrar de nuevo; selecciónalo de la lista.`,
        'warning'
      );
      return;   // mantiene el formulario abierto, no crea nada
    }

    // Duplicado entre INACTIVOS → ofrecer reactivar en vez de crear otro.
    const inactivo = this.inactiveProviders.find(p => {
      const n = norm(p.name);
      return (companyN && n === companyN) || (contactN && n === contactN);
    });
    if (inactivo) {
      const res = await alerts.confirmAlert(
        'Proveedor inactivo',
        `El proveedor "${inactivo.name}" ya está registrado pero está inactivo. ¿Te gustaría activarlo?`,
        'question', 'Sí, activar'
      );
      if (!res.isConfirmed) return;   // no crea ni activa
      this.savingProvider = true;
      try {
        // Reactivar PUT con el objeto que ya tenemos (no usar getCustomerById: GET /Customer/{id} da 404).
        await lastValueFrom(this.customersService.updateCustomer(inactivo.id, { ...(inactivo.raw || {}), active: true, vigente: true }));
        await this.loadProviders();
        this.selectedProviderId = inactivo.id;
        this.closeNewProviderOverlay();
        alerts.reqSuccessToast('Reactivado', `Proveedor "${inactivo.name}" activado`);
        await this.onProviderChange();
      } catch {
        alerts.reqErrorToast('Error', 'No se pudo activar el proveedor');
      } finally {
        this.savingProvider = false;
      }
      return;
    }

    this.savingProvider = true;
    try {
      const idRoot = this.signalsService.getRootSelectedBySidebar()();

      // 1. Crear el objeto del proveedor (Customer)
      const payload = {
        idRoot: idRoot,
        company: this.newProvider.company.trim().toUpperCase(),
        nameContact: (this.newProvider.nameContact || '').trim().toUpperCase(),
        phone: (this.newProvider.phone || '').trim(),
        email: (this.newProvider.email || '').trim(),
        type: 'PROVIDERS',
        typeIntOrExt: 'Externo', // Por defecto externo para nuevos desde compras
        active: true,
        vigente: true,
        autorizacion: true,
        position: 'GERENCIA'
      };

      // 2. Guardar en el microservicio de Administración
      const createdProvider: any = await lastValueFrom(this.customersService.addCustomer(payload));
      const newId = createdProvider?.id || createdProvider?.ID;

      if (!newId) throw new Error('No se obtuvo el ID del nuevo proveedor');

      // 3. Crear registro técnico inicial en ProveedorXTabla (CONTACT)
      const contactPayload = {
        campo1: 0,
        campo2: payload.nameContact || payload.company,
        campo3: payload.position,
        campo4: payload.phone,
        campo5: payload.email,
        campo6: 'NA',
        campo7: true,
        idTabla: newId,
        type: 'CONTACT'
      };
      await lastValueFrom(this.providersService.addProviderXTable(contactPayload)).catch(() => {});

      // 4. Actualizar interfaz
      await this.loadProviders(); // Recargar catálogo
      this.selectedProviderId = newId; // Seleccionar el nuevo
      
      this.closeNewProviderOverlay();
      alerts.reqSuccessToast('Éxito', `Proveedor "${payload.company}" creado y seleccionado`);

      // 5. Disparar lógica de vinculación (Artículos y Sucursal)
      await this.onProviderChange();

    } catch (error) {
      console.error('❌ Error al crear proveedor:', error);
      alerts.reqErrorToast('Error', 'No se pudo crear el proveedor en el servidor');
    } finally {
      this.savingProvider = false;
    }
  }

  private openNewProviderOverlay(): void {
    this.closeNewProviderOverlay();
    this.showNewProviderModal = true;

    const backdrop = this.renderer.createElement('div') as HTMLElement;
    this.renderer.setStyle(backdrop, 'position', 'fixed');
    this.renderer.setStyle(backdrop, 'inset', '0');
    this.renderer.setStyle(backdrop, 'background', 'rgba(0,0,0,0.55)');
    this.renderer.setStyle(backdrop, 'z-index', '999999');
    this.renderer.setStyle(backdrop, 'display', 'flex');
    this.renderer.setStyle(backdrop, 'align-items', 'center');
    this.renderer.setStyle(backdrop, 'justify-content', 'center');

    const modal = this.renderer.createElement('div') as HTMLElement;
    this.renderer.setStyle(modal, 'width', '420px');
    this.renderer.setStyle(modal, 'max-width', '95vw');
    this.renderer.setStyle(modal, 'background', '#fff');
    this.renderer.setStyle(modal, 'border-radius', '10px');
    this.renderer.setStyle(modal, 'box-shadow', '0 18px 55px rgba(0,0,0,0.45)');
    this.renderer.setStyle(modal, 'overflow', 'hidden');
    this.renderer.setStyle(modal, 'position', 'relative');

    // header
    const header = this.renderer.createElement('div') as HTMLElement;
    this.renderer.setStyle(header, 'background', '#0d6efd');
    this.renderer.setStyle(header, 'color', '#fff');
    this.renderer.setStyle(header, 'padding', '12px 16px');
    this.renderer.setStyle(header, 'display', 'flex');
    this.renderer.setStyle(header, 'align-items', 'center');
    this.renderer.setStyle(header, 'justify-content', 'space-between');

    const title = this.renderer.createElement('div') as HTMLElement;
    this.renderer.setStyle(title, 'font-weight', '700');
    this.renderer.setStyle(title, 'display', 'flex');
    this.renderer.setStyle(title, 'align-items', 'center');
    this.renderer.setStyle(title, 'gap', '8px');
    const icon = this.renderer.createElement('i');
    this.renderer.addClass(icon, 'bi');
    this.renderer.addClass(icon, 'bi-building-add');
    this.renderer.appendChild(title, icon);
    this.renderer.appendChild(title, this.renderer.createText('Nuevo Proveedor'));

    const closeBtn = this.renderer.createElement('button') as HTMLButtonElement;
    this.renderer.setAttribute(closeBtn, 'type', 'button');
    this.renderer.addClass(closeBtn, 'btn-close');
    this.renderer.addClass(closeBtn, 'btn-close-white');
    this.renderer.appendChild(header, title);
    this.renderer.appendChild(header, closeBtn);

    // body
    const body = this.renderer.createElement('div') as HTMLElement;
    this.renderer.setStyle(body, 'padding', '16px');

    const mkField = (labelText: string, placeholder: string, value: string, onChange: (v: string) => void, type: string = 'text') => {
      const wrap = this.renderer.createElement('div') as HTMLElement;
      this.renderer.setStyle(wrap, 'margin-bottom', '10px');
      const label = this.renderer.createElement('label') as HTMLElement;
      this.renderer.setStyle(label, 'font-size', '12px');
      this.renderer.setStyle(label, 'font-weight', '700');
      this.renderer.setStyle(label, 'margin-bottom', '4px');
      this.renderer.setStyle(label, 'display', 'block');
      this.renderer.appendChild(label, this.renderer.createText(labelText));
      const input = this.renderer.createElement('input') as HTMLInputElement;
      this.renderer.setAttribute(input, 'type', type);
      this.renderer.addClass(input, 'form-control');
      this.renderer.addClass(input, 'form-control-sm');
      this.renderer.setProperty(input, 'value', value || '');
      this.renderer.setAttribute(input, 'placeholder', placeholder);
      this.renderer.appendChild(wrap, label);
      this.renderer.appendChild(wrap, input);
      const un = this.renderer.listen(input, 'input', (ev: any) => onChange(String(ev?.target?.value ?? '')));
      this.newProviderOverlayUnlisteners.push(un);
      return wrap;
    };

    const msg = this.renderer.createElement('div') as HTMLElement;
    this.renderer.setStyle(msg, 'font-size', '13px');
    this.renderer.setStyle(msg, 'color', '#856404');
    this.renderer.setStyle(msg, 'margin-bottom', '12px');
    this.renderer.setStyle(msg, 'padding', '10px');
    this.renderer.setStyle(msg, 'background', '#fff3cd');
    this.renderer.setStyle(msg, 'border', '1px solid #ffc107');
    this.renderer.setStyle(msg, 'border-radius', '4px');
    this.renderer.setStyle(msg, 'font-weight', '600');
    this.renderer.appendChild(msg, this.renderer.createText('⚠ Ingresa la compañía y/o el contacto principal'));
    body.appendChild(msg);

    body.appendChild(mkField('Compañía *', 'Nombre de la empresa', this.newProvider.company, (v) => {
      this.newProvider.company = v;
      this.companyDuplicateWarning = '';
    }));
    body.appendChild(mkField('Contacto principal', 'Nombre del contacto', this.newProvider.nameContact, (v) => this.newProvider.nameContact = v));
    body.appendChild(mkField('Teléfono', '10 dígitos', this.newProvider.phone, (v) => this.newProvider.phone = v));
    body.appendChild(mkField('Correo', 'correo@ejemplo.com', this.newProvider.email, (v) => { this.newProvider.email = v; this.emailInvalid = false; }, 'email'));

    // footer
    const footer = this.renderer.createElement('div') as HTMLElement;
    this.renderer.setStyle(footer, 'padding', '10px 16px');
    this.renderer.setStyle(footer, 'border-top', '1px solid #dee2e6');
    this.renderer.setStyle(footer, 'display', 'flex');
    this.renderer.setStyle(footer, 'justify-content', 'flex-end');
    this.renderer.setStyle(footer, 'gap', '8px');

    const cancel = this.renderer.createElement('button') as HTMLButtonElement;
    this.renderer.setAttribute(cancel, 'type', 'button');
    this.renderer.addClass(cancel, 'btn');
    this.renderer.addClass(cancel, 'btn-sm');
    this.renderer.addClass(cancel, 'btn-secondary');
    this.renderer.appendChild(cancel, this.renderer.createText('Cancelar'));

    const create = this.renderer.createElement('button') as HTMLButtonElement;
    this.renderer.setAttribute(create, 'type', 'button');
    this.renderer.addClass(create, 'btn');
    this.renderer.addClass(create, 'btn-sm');
    this.renderer.addClass(create, 'btn-primary');
    this.renderer.appendChild(create, this.renderer.createText('Crear Proveedor'));

    // listeners
    this.newProviderOverlayUnlisteners.push(this.renderer.listen(closeBtn, 'click', () => this.closeNewProviderOverlay()));
    this.newProviderOverlayUnlisteners.push(this.renderer.listen(cancel, 'click', () => this.closeNewProviderOverlay()));
    this.newProviderOverlayUnlisteners.push(this.renderer.listen(backdrop, 'click', () => this.closeNewProviderOverlay()));
    this.newProviderOverlayUnlisteners.push(this.renderer.listen(modal, 'click', (e: Event) => e.stopPropagation()));
    this.newProviderOverlayUnlisteners.push(this.renderer.listen(create, 'click', () => {
      const hasCompany = String(this.newProvider.company || '').trim();
      const hasContact = String(this.newProvider.nameContact || '').trim();
      if (!hasCompany && !hasContact) return;
      void this.confirmNewProvider();
    }));

    this.renderer.appendChild(footer, cancel);
    this.renderer.appendChild(footer, create);

    this.renderer.appendChild(modal, header);
    this.renderer.appendChild(modal, body);
    this.renderer.appendChild(modal, footer);

    this.renderer.appendChild(backdrop, modal);
    this.renderer.appendChild(document.body, backdrop);
    this.newProviderOverlayEl = backdrop;
  }

  private closeNewProviderOverlay(): void {
    this.showNewProviderModal = false;
    this.newProviderOverlayUnlisteners.forEach(fn => {
      try { fn(); } catch {}
    });
    this.newProviderOverlayUnlisteners = [];
    if (this.newProviderOverlayEl) {
      try { this.renderer.removeChild(document.body, this.newProviderOverlayEl); } catch {}
      this.newProviderOverlayEl = null;
    }
  }
}
