import { Component, HostListener, inject, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, ICellRendererParams, GridApi } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { PedimentoModificationService } from 'app/services/pedimento-modification.service';
import { ComparacionOverlayService } from 'app/services/comparacion-overlay.service';
import { ProveedorItemsOverlayService } from 'app/services/proveedor-items-overlay.service';
import { OcAndReqsService } from 'app/services/ocandreqs.service';
import { UnsavedChangesTrackerService } from 'app/services/unsaved-changes-tracker.service';
import { Subscription } from 'rxjs';
import { ButtonCellRendererComponent } from './button-cell-renderer.component';
import { PdfButtonCellRendererPedimentosComponent } from './pdf-button-cell-renderer-pedimentos.component';
import { DetalleItemsPedimentosComponent } from './detalle-items-pedimentos.component';
import { DetalleItemsProveedorComponent } from './detalle-items-proveedor.component';
import { DetailCellRendererPedimentoReportComponent } from './detail-cell-renderer-pedimento-report.component';
import { DetalleProvidersListComponent } from './detalle-providers-list.component';
import { CotizProvButtonCellRendererComponent } from './cotiz-prov-button-cell-renderer.component';

/** Snapshot del detalle expandido (nivel 3); debe ir solo como `type` y antes del decorador @Component. */
type ExpandedPedimentoDetailState = {
  cotizacionId: number;
  detailType: 'articulos' | 'proveedor' | 'report' | 'providers-list';
  providerField?: string;
  providerLabel?: string;
  slotInfo?: ProviderSlotInfo;
  reportProviderField?: string;
  reportProviderLabel?: string;
};

/** Información de un slot de proveedor (un registro ocandreq tipo COTIZ por proveedor). */
export type ProviderSlotInfo = {
  slotIndex: number;       // 1..N (orden visual)
  cotizId: number;         // id del registro ocandreq (0 si aún no se guarda)
  folio: string;           // folio actual ("" si nuevo)
  idProvider: number | null; // null si es slot nuevo sin proveedor seleccionado
  name: string;            // nombre del proveedor ("" si nuevo)
};

const PROV_PASTEL_COLORS = ['#e3f2fd', '#fff3e0', '#f3e5f5', '#e8f5e9', '#fce4ec', '#fffde7', '#e0f7fa', '#fff9c4', '#f1f8e9', '#fbe9e7'];
const MAX_PROVIDER_SLOTS = 26;

@Component({
  selector: 'app-detail-cell-renderer-pedimentos',
  standalone: true,
  imports: [CommonModule, AgGridModule, ButtonCellRendererComponent, CotizProvButtonCellRendererComponent, PdfButtonCellRendererPedimentosComponent, DetalleItemsPedimentosComponent, DetalleItemsProveedorComponent, DetailCellRendererPedimentoReportComponent, DetalleProvidersListComponent],
  template: `
    <div class="detail-grid-container">
      <!-- Grid con tamaño completo -->
      <div style="flex: 1 1 auto; min-height: 0; overflow: auto;">
        <ag-grid-angular
          #agGrid
          class="ag-theme-quartz small-text-ag-grid"
          [rowData]="rowData"
          [columnDefs]="colDefs"
          [gridOptions]="gridOptions"
          [localeText]="AG_GRID_LOCALE_ES"
          (gridReady)="onGridReady($event)"
          style="width: 100%; height: 100%;">
        </ag-grid-angular>
      </div>
    </div>

  `,
  styles: [`
    .detail-grid-container {
      padding: 5px;
      background-color: #f8f9fa;
      border-radius: 8px;
      margin-bottom: 0;
      height: 100%;
      max-height: 100%;
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
      overflow: auto;
    }
  `]
})
export class DetailCellRendererPedimentosComponent implements OnInit, OnDestroy {
  private params!: ICellRendererParams;
  private gridApi!: GridApi;
  private context: any;
  private pedimentoModificationService = inject(PedimentoModificationService);
  private readonly cdr = inject(ChangeDetectorRef);
  private comparacionOverlayService = inject(ComparacionOverlayService);
  private proveedorItemsOverlayService = inject(ProveedorItemsOverlayService);
  private ocAndReqsService = inject(OcAndReqsService);
  private unsavedTracker = inject(UnsavedChangesTrackerService);
  private modificationSub?: Subscription;
  rowData: any[] = [];
  pedimentosWithOcIds: Set<number> = new Set();
  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;
  private expandedRowId: string | null = null;
  /** Cascada providers-list actualmente abierta (la registra el propio detail) — null si ninguna. */
  public activeProvidersListDetail: any = null;

  ngOnInit() {
  }

  ngOnDestroy() {
    this.modificationSub?.unsubscribe();
  }

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.context = params.context;
    this.buildRowData();
    this.loadPedimentosWithOc();

    this.cdr.detectChanges();
  }

  private loadPedimentosWithOc(): void {
    const idReq = this.params.data?.id;
    if (!idReq) return;
    this.ocAndReqsService.getPedimentosByRequisicion(idReq).subscribe({
      next: (pedimentos: any[]) => {
        this.pedimentosWithOcIds = new Set((pedimentos || []).map((p: any) => p.id));
        if (this.gridApi) {
          this.gridApi.refreshCells({ columns: ['pedimento'], force: true });
        }
      },
      error: () => { }
    });
  }

  onGridReady(params: any) {
    this.gridApi = params.api;
    this.autoAdjustColumns();

    // Suscribirse a cambios de pedimentos cuando el grid esté listo
    this.modificationSub?.unsubscribe();
    this.modificationSub = this.pedimentoModificationService.pedimentoModified$.subscribe((cotizacionId: number) => {
      console.log('🔔 Nivel 2 recibió notificación de reorden para cotizacionId:', cotizacionId);
      this.reorderPedimentos(cotizacionId);
    });
  }

  @HostListener('window:resize')
  onWindowResize() {
    this.autoAdjustColumns();
  }

  private autoAdjustColumns() {
    if (!this.gridApi) return;
    const apiAny = this.gridApi as any;
    if (typeof apiAny.autoSizeAllColumns === 'function') {
      apiAny.autoSizeAllColumns(true);
      return;
    }
    if (typeof apiAny.sizeColumnsToFit === 'function') {
      apiAny.sizeColumnsToFit();
    }
  }

  buildRowData() {
    const pedimentos = this.params.data.pedimentos || [];
    this.rowData = [];

    pedimentos.forEach((pedimento: any) => {
      const fechaPedimento = pedimento.createdAt ? pedimento.createdAt.split('T')[0] : '';

      // ✅ Usar el número de pedimento secuencial (1, 2, 3, etc.) en lugar del folio
      const numeroPedimento = pedimento.pedimento || 0;
      const pedimentoFormateado = `Pedimento-${numeroPedimento}`;

      // ✅ Inicializar providerSlots: si BD no tiene proveedores, crear slot 1 vacío default
      // (siempre debe haber al menos 1 columna PROVEEDOR 1 visible para que el usuario pueda
      // seleccionar el primer proveedor sin necesitar el botón "+")
      const slotsFromBd = Array.isArray(pedimento.providerSlots) ? [...pedimento.providerSlots] : [];
      const providerSlots = slotsFromBd.length > 0
        ? slotsFromBd
        : [{ slotIndex: 1, cotizId: 0, folio: '', idProvider: null, name: '' }];

      this.rowData.push({
        pedimento: pedimentoFormateado,
        folio: pedimento.folio || '',
        articulos: pedimento.items,
        cotizacionId: pedimento.id,
        requisitionId: this.params.data.id,
        idBranch: this.params.data.idReference, // ✅ ID de la sucursal (Nivel 1)
        branchName: this.params.data.branch,   // ✅ Nombre de la sucursal (Nivel 1)
        numeroPedimentoRaw: numeroPedimento,
        // ✅ Slots dinámicos de proveedores (mín 1 default, máx 26 por pedimento)
        providerSlots,
        branchPrefix: pedimento.branchPrefix || '',
        // ✅ Prefijo del departamento (para folio COTIZ/OC) + nombre (para mensajes de validación)
        deptPrefijo: this.params.data.deptPrefijo || '',
        departmentName: this.params.data.department || '',
        pdf: 'PDF',
        creo: pedimento.createdBy || 'N/A',
        createdBy: pedimento.createdBy || 'N/A',
        fechaPedimento: fechaPedimento,
        createdAt: pedimento.createdAt,
        lastModified: pedimento.dateModified || pedimento.createdAt // Usar dateModified para ordenar
      });
    });

    // ✅ Ordenar por lastModified (más reciente primero)
    this.rowData.sort((a, b) => {
      const dateA = a.lastModified ? new Date(a.lastModified).getTime() : 0;
      const dateB = b.lastModified ? new Date(b.lastModified).getTime() : 0;
      return dateB - dateA; // DESC: más reciente primero
    });
  }

  private captureExpandedDetailState(): ExpandedPedimentoDetailState | null {
    if (!this.gridApi) return null;
    let found: ExpandedPedimentoDetailState | null = null;
    this.gridApi.forEachNode((n: any) => {
      if (n.expanded && n.data?.cotizacionId) {
        const d = n.data;
        found = {
          cotizacionId: d.cotizacionId,
          detailType: d.detailType || 'articulos',
          providerField: d.providerField,
          providerLabel: d.providerLabel,
          slotInfo: d.slotInfo,
          reportProviderField: d.reportProviderField,
          reportProviderLabel: d.reportProviderLabel
        };
      }
    });
    return found;
  }

  private restoreExpandedDetailState(s: ExpandedPedimentoDetailState): void {
    if (!this.gridApi) return;
    let target: any = null;
    this.gridApi.forEachNode((n: any) => {
      if (n.data?.cotizacionId === s.cotizacionId) {
        target = n;
      }
    });
    if (!target) return;

    this.gridApi.forEachNode((otherNode: any) => {
      if (otherNode.expanded) {
        otherNode.setExpanded(false);
        if (otherNode.data) {
          otherNode.data.isExpanded = false;
        }
      }
    });

    this.gridApi.forEachNode((otherNode: any) => {
      if (otherNode.id !== target.id) {
        otherNode.setRowHeight(0);
      } else {
        otherNode.setRowHeight(undefined);
      }
    });

    if (target.data) {
      target.data.isExpanded = true;
      target.data.detailType = s.detailType;
    }

    if (s.detailType === 'proveedor') {
      if (target.data) {
        target.data.providerField = s.providerField;
        target.data.providerLabel = s.providerLabel;
        target.data.slotInfo = s.slotInfo;
      }
      this.gridOptions.context.providerField = s.providerField;
      this.gridOptions.context.providerLabel = s.providerLabel;
      this.gridOptions.context.slotInfo = s.slotInfo;
      this.activeProviderField = s.providerField || '';
      this.activeProviderLabel = s.providerLabel || '';
    } else if (s.detailType === 'report' && target.data) {
      target.data.reportProviderField = s.reportProviderField;
      target.data.reportProviderLabel = s.reportProviderLabel;
    }

    this.expandedRowId = target.id;
    this.activeDetailType = s.detailType;
    this.gridApi.onRowHeightChanged();
    this.gridApi.redrawRows();
    setTimeout(() => {
      if (!target) return;
      try {
        target.setExpanded(true);
      } catch {
        /* nodo pudo desmontarse en carrera */
      }
    }, 0);
  }

  private reorderPedimentos(cotizacionId: number) {
    console.log('🔄 reorderPedimentos() llamado con cotizacionId:', cotizacionId);
    console.log('📊 ANTES - rowData:', this.rowData.map((r, i) => `[${i}] ID: ${r.cotizacionId}, nombre: ${r.pedimento}, lastModified: ${r.lastModified}`));

    const wasExpanded = this.captureExpandedDetailState();
    console.log('📍 Expansión capturada:', wasExpanded ? `ID ${wasExpanded.cotizacionId}` : 'ninguna');

    // Actualizar lastModified en memoria del pedimento que fue modificado
    const now = new Date().toISOString();
    console.log('⏱️ NOW (tiempo actual):', now);
    const pedimento = this.rowData.find(row => row.cotizacionId === cotizacionId);
    console.log('🔍 Pedimento encontrado:', pedimento ? `SÍ - ${pedimento.pedimento}` : 'NO');
    if (pedimento) {
      console.log('⏰ ANTES de actualizar:', pedimento.lastModified);
      pedimento.lastModified = now;
      console.log('✅ DESPUÉS de actualizar:', pedimento.lastModified);
    }

    // Reordenar: mover el pedimento modificado al inicio
    const modifiedIndex = this.rowData.findIndex(r => r.cotizacionId === cotizacionId);
    if (modifiedIndex > 0) {
      const modified = this.rowData.splice(modifiedIndex, 1)[0];
      this.rowData.unshift(modified);
      console.log('✨ Pedimento movido al inicio mediante splice/unshift');
    }

    console.log('📋 DESPUÉS - rowData:', this.rowData.map((r, i) => `[${i}] ID: ${r.cotizacionId}, nombre: ${r.pedimento}, lastModified: ${r.lastModified}`));

    // ✅ Sincronizar el orden también en params.data.pedimentos para que cuando
    // el nivel 1 recree la grid, el nivel 2 se reinicialice con el nuevo orden
    if (this.params?.data?.pedimentos) {
      const pedimentoIds = new Set(this.rowData.map(r => r.cotizacionId));
      this.params.data.pedimentos.sort((a: any, b: any) => {
        const aIndex = this.rowData.findIndex(r => r.cotizacionId === a.id);
        const bIndex = this.rowData.findIndex(r => r.cotizacionId === b.id);
        return aIndex - bIndex;
      });
    }

    if (this.gridApi) {
      console.log('🎬 Actualizando grid con vaciar→repoblar');
      // Patrón vaciar→repoblar para forzar reordenamiento visual con getRowId
      this.gridApi.setGridOption('rowData', []);
      setTimeout(() => {
        this.gridApi.setGridOption('rowData', [...this.rowData]);
        if (wasExpanded) {
          setTimeout(() => this.restoreExpandedDetailState(wasExpanded), 0);
        }
      }, 0);
    } else {
      console.log('⚠️ gridApi NO está disponible!');
    }
  }

  /**
   * `solicit` en COTIZ a veces llega como "Sin seleccionar" aunque `idProvider` sea válido;
   * si no, el valueGetter prefería ese texto sobre el fallback por id.
   */
  private providerCellLabel(name: unknown, id: number | undefined, emptyLabel: string): string {
    const n = name != null && String(name).trim() !== '' ? String(name).trim() : '';
    const bad = !n || n.toLowerCase() === 'sin seleccionar';
    if (!bad) {
      return n;
    }
    const num = Number(id);
    return Number.isFinite(num) && num > 0 ? `Prov. ${num}` : emptyLabel;
  }

  get colDefs(): ColDef[] {
    // ✅ Master grid simplificado: la columna COTIZACIÓN PROVEEDOR contiene la sub-cascada
    // con los proveedores reales del pedimento (sin columnas vacías cuando otros pedimentos
    // tienen más proveedores).
    return [
      {
        field: 'pedimento',
        headerName: 'PEDIMENTO #',
        width: 160,
        flex: 0,
        suppressSizeToFit: true,
        cellRenderer: (params: any) => {
          const label = params.value || '';
          const hasOc = this.pedimentosWithOcIds.has(params.data?.cotizacionId);
          if (!hasOc) return label;
          const wrap = document.createElement('span');
          wrap.style.cssText = 'display:flex;align-items:center;gap:5px;';
          wrap.innerHTML = `${label} <i class="bi bi-lock-fill" style="color:#b71c1c;font-size:0.8rem;flex-shrink:0;" title="OC generada"></i>`;
          return wrap;
        }
      },
      {
        field: 'articulos',
        headerName: 'ARTICULOS',
        width: 140,
        flex: 0,
        suppressSizeToFit: true,
        cellRenderer: ButtonCellRendererComponent,
        cellRendererParams: {
          onClick: (node: any) => this.toggleArticulosCascade(node),
        },
        valueGetter: params => {
          const articulos = params.data.articulos || [];
          const articulosExternos = articulos.filter(
            (item: any) => (item.intorext || item.tipo || '').toLowerCase() !== 'interno'
          );
          const solicitados = articulosExternos.filter((item: any) => item.pedimento === true).length;
          const total = articulosExternos.length;
          return `${solicitados}/${total}`;
        },
        editable: false,
        cellStyle: { backgroundColor: '#e8f5e9', cursor: 'pointer' }
      },
      {
        field: 'pdf',
        headerName: 'PDF',
        width: 50,
        flex: 0,
        suppressSizeToFit: true,
        cellRenderer: PdfButtonCellRendererPedimentosComponent,
        cellRendererParams: {
          onClick: (node: any) => this.toggleReportCascade(node),
          icon: 'bi-file-earmark-pdf',
          iconColor: '#dc3545',
          title: 'Generar reporte PDF del Pedimento'
        },
        editable: false,
        cellStyle: { backgroundColor: '#fff3e0', textAlign: 'center' }
      },
      {
        // ✅ Nueva columna: cascada con los proveedores del pedimento (+ "+" + Comparar)
        field: 'cotizacionProveedor',
        headerName: 'COTIZACIÓN PROVEEDOR',
        width: 220,
        flex: 0,
        suppressSizeToFit: true,
        // Componente Angular estable (no parpadea, click OK). El tooltip azul flotante con
        // Artículo/Cant. Requerida lo maneja el propio componente (panel fixed sobre document.body).
        cellRenderer: CotizProvButtonCellRendererComponent,
        editable: false,
        cellStyle: { backgroundColor: '#e8f5e9', cursor: 'pointer' }
      },
      {
        field: 'creo',
        headerName: 'QUIEN LO CREÓ',
        width: 200,
        flex: 0,
        suppressSizeToFit: true
      },
      {
        field: 'fechaPedimento',
        headerName: 'FECHA PEDIMENTO',
        width: 200,
        flex: 0,
        suppressSizeToFit: true
      },
      {
        field: 'createdBy',
        headerName: 'CREÓ',
        width: 250,
        flex: 0,
        suppressSizeToFit: true
      }
    ];
  }

  // Tipo de detalle activo: 'articulos' o 'proveedor'
  private activeDetailType: string = 'articulos';
  private activeProviderField: string = '';
  private activeProviderLabel: string = '';

  public gridOptions: any = {
    headerHeight: 35,
    rowHeight: 35,
    animateRows: true,
    masterDetail: true,
    detailRowHeight: 460,
    autoSizeStrategy: {
      type: 'fitCellContents',
    },
    getRowId: (params: any) => String(params.data.cotizacionId),
    defaultColDef: {
      resizable: true,
      sortable: true,
      filter: true,
      flex: 1,
      minWidth: 120,
    },
    detailCellRendererSelector: (params: any) => {
      if (params.data.detailType === 'providers-list') {
        return { component: DetalleProvidersListComponent };
      }
      if (params.data.detailType === 'proveedor') {
        return {
          component: DetalleItemsProveedorComponent,
          params: {
            providerField: params.data.providerField,
            providerLabel: params.data.providerLabel,
            slotInfo: params.data.slotInfo,
            branchPrefix: params.data.branchPrefix,
            pedimentoNum: params.data.numeroPedimentoRaw,
            deptPrefijo: params.data.deptPrefijo || '',
            departmentName: params.data.departmentName || '',
            // ✅ Para validación de duplicados: slots hermanos (excepto el activo)
            siblingSlots: (params.data.providerSlots || []).filter(
              (s: ProviderSlotInfo) => s.slotIndex !== params.data.slotInfo?.slotIndex
            ),
            onSlotSaved: (savedSlot: ProviderSlotInfo) => this.onSlotSaved(params.node, savedSlot)
          }
        };
      }
      if (params.data.detailType === 'report') {
        return {
          component: DetailCellRendererPedimentoReportComponent,
          params: {
            reportProviderField: params.data.reportProviderField,
            reportProviderLabel: params.data.reportProviderLabel
          }
        };
      }
      // Por defecto, mostrar artículos
      return { component: DetalleItemsPedimentosComponent };
    },
    embedFullWidthRows: true,
    suppressCellFocus: true,
    getRowClass: (params: any) => {
      if (params.data.isExpanded) {
        return 'expanded-row';
      }
      return '';
    },
    context: {
      componentParent: this,
      providerField: '',
      providerLabel: '',
      reorderRequisition: (cotizacionId: number) => this.context?.reorderRequisition?.(cotizacionId),
      filterToEditingRequisition: (requisitionId: number) => this.context?.filterToEditingRequisition?.(requisitionId),
      restoreAllRequisitions: () => this.context?.restoreAllRequisitions?.()
    }
  };

  /**
   * Callback invocado por DetalleItemsProveedorComponent cuando se guarda un slot
   * (nuevo o existente). Actualiza el providerSlots del padre, la etiqueta del slot
   * y refresca la celda visualmente sin necesidad de recargar todo el grid.
   */
  onSlotSaved(node: any, savedSlot: ProviderSlotInfo) {
    if (!node?.data) return;
    const slots: ProviderSlotInfo[] = node.data.providerSlots || [];
    const idx = slots.findIndex((s: ProviderSlotInfo) => s.slotIndex === savedSlot.slotIndex);
    if (idx >= 0) {
      slots[idx] = { ...slots[idx], ...savedSlot };
    } else {
      slots.push(savedSlot);
    }
    node.data.providerSlots = [...slots];
    node.data.slotInfo = { ...savedSlot };
    if (this.gridApi) {
      this.gridApi.setGridOption('columnDefs', this.colDefs);
      this.gridApi.refreshCells({ rowNodes: [node], force: true });
    }
    // ✅ Refrescar la cascada providers-list abierta para que muestre el proveedor recién guardado
    if (this.activeProvidersListDetail) {
      this.activeProvidersListDetail.rebuildIfMatches(node.id);
    }
  }

  /** Verifica si hay cambios sin guardar en cualquier detalle de proveedor abierto.
   *  Si los hay, pide confirmación al usuario; si confirma, limpia el flag global. */
  private async ensureNoUnsavedChangesBeforeNav(): Promise<boolean> {
    if (!this.unsavedTracker.hasAnyDirty()) return true;
    const allowed = await this.unsavedTracker.confirmExitIfAny();
    if (allowed) this.unsavedTracker.clearAll();
    return allowed;

    this.cdr.detectChanges();
  }

  async toggleArticulosCascade(node: any) {
    if (!await this.ensureNoUnsavedChangesBeforeNav()) return;
    // Establecer el tipo de detalle como artículos
    node.data.detailType = 'articulos';
    node.setSelected(true);

    const isCurrentlyExpanded = node.expanded && this.activeDetailType === 'articulos' && this.expandedRowId === node.id;

    if (isCurrentlyExpanded) {
      // Si ya está expandido, colapsarlo y restaurar todas las filas
      node.setExpanded(false);
      this.expandedRowId = null;
      node.data.isExpanded = false;

      // Restaurar alturas de todas las filas
      this.gridApi.forEachNode((otherNode: any) => {
        otherNode.setRowHeight(undefined);
      });
      this.gridApi.onRowHeightChanged();
      this.gridApi.redrawRows();
    } else {
      // Colapsar cualquier otra fila expandida
      if (this.expandedRowId) {
        this.gridApi.forEachNode((otherNode: any) => {
          if (otherNode.id === this.expandedRowId) {
            otherNode.setExpanded(false);
            otherNode.data.isExpanded = false;
          }
        });
      }

      // Ocultar todas las demás filas (altura 0)
      this.gridApi.forEachNode((otherNode: any) => {
        if (otherNode.id !== node.id) {
          otherNode.setRowHeight(0);
        }
      });

      // Guardar el ID de la fila expandida
      this.expandedRowId = node.id;
      node.data.isExpanded = true;
      this.activeDetailType = 'articulos';

      // Aplicar los cambios de altura
      this.gridApi.onRowHeightChanged();
      this.gridApi.redrawRows();

      // Expandir con el detalle correspondiente
      setTimeout(() => {
        node.setExpanded(true);
      }, 0);
    }

    this.cdr.detectChanges();
  }

  /**
   * ✅ Abre la tabla de items por proveedor como MODAL a nivel raíz.
   * Antes intentaba transicionar detail-row → detail-row (providers-list → proveedor), lo que
   * AG Grid no maneja bien (la fila desaparecía / no re-montaba el componente). El modal evita
   * por completo el ciclo de vida del master-detail de AG Grid.
   */
  async toggleProviderCascade(nodeOrId: any, slot: ProviderSlotInfo) {
    if (!await this.ensureNoUnsavedChangesBeforeNav()) return;

    // ✅ Si recibimos un ID, lookup el nodo actual del grid; si es ref, usarla directa
    let node: any = null;
    if (typeof nodeOrId === 'string' || typeof nodeOrId === 'number') {
      this.gridApi.forEachNode((n: any) => {
        if (n.id === nodeOrId) {
          node = n;
        }
      });
      if (!node) {
        console.warn('⚠️ toggleProviderCascade: nodo no encontrado con ID:', nodeOrId);
        return;
      }
    } else {
      node = nodeOrId;
    }

    const providerLabel = `Proveedor ${slot.slotIndex}`;
    const slotKey = slot.idProvider != null ? `pro_${slot.idProvider}` : `new_${slot.slotIndex}`;

    // Breadcrumb de cabecera: "BOD-1 > P1 > Proveedor 1" (requisición > pedimento > proveedor).
    const reqFolio = this.params.data?.requisition || '';
    const pedNum = node.data.numeroPedimentoRaw || 0;
    const headerTitle = [reqFolio, `P${pedNum}`, providerLabel].filter(Boolean).join(' > ');

    this.proveedorItemsOverlayService.open({
      pedimentoData: node.data,
      providerLabel,
      headerTitle,
      providerField: slotKey,
      slotInfo: { ...slot },
      branchPrefix: node.data.branchPrefix || 'NOPREF',
      pedimentoNum: node.data.numeroPedimentoRaw || 0,
      siblingSlots: (node.data.providerSlots || []).filter(
        (s: ProviderSlotInfo) => s.slotIndex !== slot.slotIndex
      ),
      onSlotSaved: (savedSlot: ProviderSlotInfo) => this.onSlotSaved(node, savedSlot)
    });

    this.cdr.detectChanges();
  }

  /**
   * ✅ Cascada nivel 3 — sub-grid con los proveedores dinámicos del pedimento + "+" + Comparar.
   * Reemplaza las columnas dinámicas hardcoded en el master grid (que generaban huecos cuando
   * pedimentos distintos tienen distinto número de proveedores).
   */
  async toggleProvidersListCascade(node: any) {
    if (!await this.ensureNoUnsavedChangesBeforeNav()) return;
    node.setSelected(true);

    const isCurrentlyExpanded = node.expanded &&
      node.data.detailType === 'providers-list' &&
      this.expandedRowId === node.id;

    if (isCurrentlyExpanded) {
      // Colapsar
      node.setExpanded(false);
      this.expandedRowId = null;
      node.data.isExpanded = false;
      this.gridApi.forEachNode((otherNode: any) => {
        otherNode.setRowHeight(undefined);
      });
      this.gridApi.onRowHeightChanged();
      this.gridApi.redrawRows();
    } else {
      // ✅ Mismo patrón que toggleProviderCascade
      const wasSameRowExpanded = node.expanded && this.expandedRowId === node.id;

      node.data.detailType = 'providers-list';
      this.expandedRowId = node.id;
      node.data.isExpanded = true;
      this.activeDetailType = 'providers-list';

      this.gridApi.forEachNode((otherNode: any) => {
        if (otherNode.expanded) {
          otherNode.setExpanded(false);
          if (otherNode.data) otherNode.data.isExpanded = false;
        }
      });

      this.gridApi.forEachNode((otherNode: any) => {
        if (otherNode.id !== node.id) {
          otherNode.setRowHeight(0);
        } else {
          otherNode.setRowHeight(undefined);
        }
      });
      this.gridApi.onRowHeightChanged();

      setTimeout(() => {
        node.setExpanded(true);
      }, wasSameRowExpanded ? 50 : 0);
    }

    this.cdr.detectChanges();
  }

  /**
   * Crea un nuevo slot temporal (sin proveedor seleccionado todavía) y abre la cascada
   * para que el usuario seleccione el proveedor. Cuando se guarda, el slot persiste
   * con su nuevo idProvider en la BD (formato folio: COTIZ-{branchPrefix}-P{ped}-PRO{idProv}).
   */
  async addProviderSlot(nodeOrId: any) {
    if (!await this.ensureNoUnsavedChangesBeforeNav()) return;

    // ✅ Lookup del nodo actual por ID si es necesario
    let node: any = null;
    if (typeof nodeOrId === 'string' || typeof nodeOrId === 'number') {
      this.gridApi.forEachNode((n: any) => {
        if (n.id === nodeOrId) {
          node = n;
        }
      });
      if (!node) {
        console.warn('⚠️ addProviderSlot: nodo no encontrado con ID:', nodeOrId);
        return;
      }
    } else {
      node = nodeOrId;
    }

    const slots: ProviderSlotInfo[] = node.data.providerSlots || [];
    if (slots.length >= MAX_PROVIDER_SLOTS) return;
    const newSlot: ProviderSlotInfo = {
      slotIndex: slots.length + 1,
      cotizId: 0,
      folio: '',
      idProvider: null,
      name: ''
    };
    node.data.providerSlots = [...slots, newSlot];

    // Refrescar columnDefs: si el max aumenta, se renderiza una nueva columna PROVEEDOR N
    if (this.gridApi) {
      this.gridApi.setGridOption('columnDefs', this.colDefs);
      this.gridApi.refreshCells({ force: true });
    }

    // ✅ Refrescar la cascada providers-list para que el nuevo PROVEEDOR N aparezca
    // de inmediato (antes solo se veía al cerrar y reabrir la cascada).
    if (this.activeProvidersListDetail) {
      this.activeProvidersListDetail.rebuildIfMatches(node.id);
    }

    // Abrir cascada para el nuevo slot (pasar node, ya que es el actual)
    await this.toggleProviderCascade(node, newSlot);

    this.cdr.detectChanges();
  }

  async toggleReportCascade(node: any) {
    if (!await this.ensureNoUnsavedChangesBeforeNav()) return;
    node.setSelected(true);

    // Verificar si ya está expandido con reporte
    const isCurrentlyExpanded = node.expanded &&
      node.data.detailType === 'report' &&
      this.expandedRowId === node.id;

    if (isCurrentlyExpanded) {
      // Si ya está expandido, colapsarlo y restaurar todas las filas
      node.setExpanded(false);
      this.expandedRowId = null;
      node.data.isExpanded = false;

      // Restaurar alturas de todas las filas
      this.gridApi.forEachNode((otherNode: any) => {
        otherNode.setRowHeight(undefined);
      });
      this.gridApi.onRowHeightChanged();
      this.gridApi.redrawRows();
    } else {
      // Colapsar cualquier otra fila expandida
      if (this.expandedRowId) {
        this.gridApi.forEachNode((otherNode: any) => {
          if (otherNode.id === this.expandedRowId) {
            otherNode.setExpanded(false);
            otherNode.data.isExpanded = false;
          }
        });
      }

      // Ocultar todas las demás filas (altura 0)
      this.gridApi.forEachNode((otherNode: any) => {
        if (otherNode.id !== node.id) {
          otherNode.setRowHeight(0);
        }
      });

      // Establecer el tipo de detalle como reporte
      // Por defecto usamos idProvider (Proveedor 1), pero se puede modificar
      node.data.detailType = 'report';
      node.data.reportProviderField = 'idProvider';
      node.data.reportProviderLabel = 'Proveedor 1';

      // Guardar el ID de la fila expandida
      this.expandedRowId = node.id;
      node.data.isExpanded = true;
      this.activeDetailType = 'report';

      // Aplicar los cambios de altura
      this.gridApi.onRowHeightChanged();
      this.gridApi.redrawRows();

      // Expandir con el detalle del reporte
      setTimeout(() => {
        node.setExpanded(true);
      }, 0);
    }

    this.cdr.detectChanges();
  }

  async toggleComparacionCascade(nodeOrId: any) {
    if (!await this.ensureNoUnsavedChangesBeforeNav()) return;

    // ✅ Lookup del nodo actual por ID si es necesario
    let node: any = null;
    if (typeof nodeOrId === 'string' || typeof nodeOrId === 'number') {
      this.gridApi.forEachNode((n: any) => {
        if (n.id === nodeOrId) {
          node = n;
        }
      });
      if (!node) {
        console.warn('⚠️ toggleComparacionCascade: nodo no encontrado con ID:', nodeOrId);
        return;
      }
    } else {
      node = nodeOrId;
    }

    const slots: ProviderSlotInfo[] = node.data.providerSlots || [];
    const selectedProviderIds = slots
      .map((s: ProviderSlotInfo) => Number(s.idProvider))
      .filter((id: number) => id > 0);
    this.comparacionOverlayService.open({
      cotizacionId: node.data.cotizacionId,
      cotizacionFolio: node.data.pedimento || '',
      requisitionId: node.data.requisitionId,
      requisitionFolio: this.params.data.requisition || '',
      selectedProviderIds,
      idBranchFromReq: this.params.data.idReference || 0,
      idDepartamentFromReq: this.params.data.idDepartament || 0,
      departmentName: this.params.data.department || '',
      deptPrefijoFromReq: this.params.data.deptPrefijo || ''
    });

    this.cdr.detectChanges();
  }

  collapseReportDetail() {
    if (this.expandedRowId && this.gridApi) {
      this.gridApi.forEachNode((node: any) => {
        if (node.id === this.expandedRowId) {
          node.setExpanded(false);
          node.data.isExpanded = false;
          node.data.detailType = null;
        }
        node.setRowHeight(undefined);
      });
      this.expandedRowId = null;
      this.gridApi.onRowHeightChanged();
      this.gridApi.redrawRows();
    }
  }
}
