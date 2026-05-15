import { Component, HostListener, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, ICellRendererParams, GridApi } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { PedimentoModificationService } from 'app/services/pedimento-modification.service';
import { ComparacionOverlayService } from 'app/services/comparacion-overlay.service';
import { OcAndReqsService } from 'app/services/ocandreqs.service';
import { UnsavedChangesTrackerService } from 'app/services/unsaved-changes-tracker.service';
import { Subscription } from 'rxjs';
import { ButtonCellRendererComponent } from './button-cell-renderer.component';
import { PdfButtonCellRendererPedimentosComponent } from './pdf-button-cell-renderer-pedimentos.component';
import { DetalleItemsPedimentosComponent } from './detalle-items-pedimentos.component';
import { DetalleItemsProveedorComponent } from './detalle-items-proveedor.component';
import { DetailCellRendererPedimentoReportComponent } from './detail-cell-renderer-pedimento-report.component';

/** Snapshot del detalle expandido (nivel 3); debe ir solo como `type` y antes del decorador @Component. */
type ExpandedPedimentoDetailState = {
  cotizacionId: number;
  detailType: 'articulos' | 'proveedor' | 'report';
  providerField?: string;
  providerLabel?: string;
  reportProviderField?: string;
  reportProviderLabel?: string;
};

@Component({
  selector: 'app-detail-cell-renderer-pedimentos',
  standalone: true,
  imports: [CommonModule, AgGridModule, ButtonCellRendererComponent, PdfButtonCellRendererPedimentosComponent, DetalleItemsPedimentosComponent, DetalleItemsProveedorComponent, DetailCellRendererPedimentoReportComponent],
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
  private comparacionOverlayService = inject(ComparacionOverlayService);
  private ocAndReqsService = inject(OcAndReqsService);
  private unsavedTracker = inject(UnsavedChangesTrackerService);
  private modificationSub?: Subscription;
  rowData: any[] = [];
  pedimentosWithOcIds: Set<number> = new Set();
  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;
  private expandedRowId: string | null = null;

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
      error: () => {}
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

      this.rowData.push({
        pedimento: pedimentoFormateado,
        folio: pedimento.folio || '',
        articulos: pedimento.items,
        cotizacionId: pedimento.id,
        requisitionId: this.params.data.id,
        idBranch: this.params.data.idReference, // ✅ ID de la sucursal (Nivel 1)
        branchName: this.params.data.branch,   // ✅ Nombre de la sucursal (Nivel 1)
        numeroPedimentoRaw: numeroPedimento,
        idProvider: pedimento.idProvider || 0,
        idProvider2: pedimento.idProvider2 || 0,
        idProvider3: pedimento.idProvider3 || 0,
        name_idProvider: pedimento.name_idProvider || '',
        name_idProvider2: pedimento.name_idProvider2 || '',
        name_idProvider3: pedimento.name_idProvider3 || '',
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
      }
      this.gridOptions.context.providerField = s.providerField;
      this.gridOptions.context.providerLabel = s.providerLabel;
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

    /*  {
        field: 'folio',
        headerName: 'FOLIO COT',
        width: 120
      },*/

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
          // Filtrar solo artículos externos (excluir internos)
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
        field: 'idProvider',
        headerName: 'PROVEEDOR 1',
        width: 220,
        flex: 0,
        suppressSizeToFit: true,
        cellRenderer: ButtonCellRendererComponent,
        cellRendererParams: {
          onClick: (node: any) => this.toggleProviderCascade(node, 'idProvider', 'Proveedor 1'),
          icon: 'bi-person-badge',
          title: 'Ver/Editar Proveedor 1'
        },
        valueGetter: (params: any) => this.providerCellLabel(params.data?.name_idProvider, params.data?.idProvider, 'Proveedor 1'),
        cellStyle: { backgroundColor: '#e3f2fd', cursor: 'pointer' }
      },

      {
        field: 'idProvider2',
        headerName: 'PROVEEDOR 2',
        width: 220,
        flex: 0,
        suppressSizeToFit: true,
        cellRenderer: ButtonCellRendererComponent,
        cellRendererParams: {
          onClick: (node: any) => this.toggleProviderCascade(node, 'idProvider2', 'Proveedor 2'),
          icon: 'bi-person-badge',
          title: 'Ver/Editar Proveedor 2'
        },
        valueGetter: (params: any) => this.providerCellLabel(params.data?.name_idProvider2, params.data?.idProvider2, 'Proveedor 2'),
        cellStyle: { backgroundColor: '#fff3e0', cursor: 'pointer' }
      },

      {
        field: 'idProvider3',
        headerName: 'PROVEEDOR 3',
        width: 220,
        flex: 0,
        suppressSizeToFit: true,
        cellRenderer: ButtonCellRendererComponent,
        cellRendererParams: {
          onClick: (node: any) => this.toggleProviderCascade(node, 'idProvider3', 'Proveedor 3'),
          icon: 'bi-person-badge',
          title: 'Ver/Editar Proveedor 3'
        },
        valueGetter: (params: any) => this.providerCellLabel(params.data?.name_idProvider3, params.data?.idProvider3, 'Proveedor 3'),
        cellStyle: { backgroundColor: '#f3e5f5', cursor: 'pointer' }
      },

      {
        field: 'comparacion',
        headerName: 'COMPARACIÓN',
        width: 200,
        flex: 0,
        suppressSizeToFit: true,
        cellRenderer: ButtonCellRendererComponent,
        cellRendererParams: {
          onClick: (node: any) => this.toggleComparacionCascade(node),
          icon: 'bi-scale-balanced',
          title: 'Comparar Precios de Proveedores'
        },
        valueGetter: () => 'Comparar',
        cellStyle: { backgroundColor: '#e8eef5', cursor: 'pointer' }
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
      if (params.data.detailType === 'proveedor') {
        return {
          component: DetalleItemsProveedorComponent,
          params: {
            providerField: params.data.providerField,
            providerLabel: params.data.providerLabel
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

  /** Verifica si hay cambios sin guardar en cualquier detalle de proveedor abierto.
   *  Si los hay, pide confirmación al usuario; si confirma, limpia el flag global. */
  private async ensureNoUnsavedChangesBeforeNav(): Promise<boolean> {
    if (!this.unsavedTracker.hasAnyDirty()) return true;
    const allowed = await this.unsavedTracker.confirmExitIfAny();
    if (allowed) this.unsavedTracker.clearAll();
    return allowed;
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
  }

  async toggleProviderCascade(node: any, providerField: string, providerLabel: string) {
    if (!await this.ensureNoUnsavedChangesBeforeNav()) return;
    node.setSelected(true);

    // Verificar si ya está expandido con el mismo proveedor
    const isCurrentlyExpanded = node.expanded &&
      node.data.detailType === 'proveedor' &&
      node.data.providerField === providerField &&
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

      // Establecer el tipo de detalle y los parámetros del proveedor
      node.data.detailType = 'proveedor';
      node.data.providerField = providerField;
      node.data.providerLabel = providerLabel;

      // Guardar el ID de la fila expandida
      this.expandedRowId = node.id;
      node.data.isExpanded = true;
      this.activeDetailType = 'proveedor';
      this.activeProviderField = providerField;
      this.activeProviderLabel = providerLabel;

      // Mutar el contexto existente (no reemplazar) para que AG Grid mantenga la referencia
      this.gridOptions.context.providerField = providerField;
      this.gridOptions.context.providerLabel = providerLabel;

      // Aplicar los cambios de altura
      this.gridApi.onRowHeightChanged();
      this.gridApi.redrawRows();

      // Expandir con el detalle correspondiente
      setTimeout(() => {
        node.setExpanded(true);
      }, 0);
    }
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
  }

  async toggleComparacionCascade(node: any) {
    if (!await this.ensureNoUnsavedChangesBeforeNav()) return;
    this.comparacionOverlayService.open({
      cotizacionId: node.data.cotizacionId,
      cotizacionFolio: node.data.pedimento || '',
      requisitionId: node.data.requisitionId,
      requisitionFolio: this.params.data.requisition || '',
      selectedProviderIds: [node.data.idProvider, node.data.idProvider2, node.data.idProvider3].filter((id: number) => id > 0),
      idBranchFromReq: this.params.data.idReference || 0,
      idDepartamentFromReq: this.params.data.idDepartament || 0,
      departmentName: this.params.data.department || ''
    });
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
