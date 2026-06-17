import { inject, Component, OnDestroy, ChangeDetectorRef} from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, ICellRendererParams, GridApi } from 'ag-grid-enterprise';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { ButtonCellRendererComponent } from './button-cell-renderer.component';

const PROV_PASTEL_COLORS = ['#e3f2fd', '#fff3e0', '#f3e5f5', '#e8f5e9', '#fce4ec', '#fffde7', '#e0f7fa', '#fff9c4', '#f1f8e9', '#fbe9e7'];
const MAX_PROVIDER_SLOTS = 26;

/**
 * Sub-cascada de proveedores por pedimento.
 *
 * Se renderiza al expandir COTIZACIÓN PROVEEDOR en el master grid.
 * Muestra UNA fila con N columnas de proveedor (solo los reales del pedimento) + "+" + COMPARAR.
 *
 * Cada acción (click proveedor, +, comparar) llama al padre via context.componentParent
 * para reutilizar la lógica existente: toggleProviderCascade, addProviderSlot, toggleComparacionCascade.
 */
@Component({
  selector: 'app-detalle-providers-list',
  standalone: true,
  imports: [CommonModule, AgGridModule, ButtonCellRendererComponent],
  template: `
    <div class="providers-list-container">
      <ag-grid-angular
        class="ag-theme-quartz small-text-ag-grid"
        [rowData]="rowData"
        [columnDefs]="colDefs"
        [gridOptions]="gridOptions"
        [localeText]="AG_GRID_LOCALE_ES"
        (gridReady)="onGridReady($event)"
        style="width: 100%; height: 100%;">
      </ag-grid-angular>
    </div>
  `,
  styles: [`
    .providers-list-container {
      padding: 8px;
      background-color: #e8f5e9;
      border-radius: 8px;
      height: 100%;
      max-height: 100%;
      box-sizing: border-box;
      overflow: auto;
    }
  `]
})
export class DetalleProvidersListComponent implements ICellRendererAngularComp, OnDestroy {
  private readonly cdr = inject(ChangeDetectorRef);
  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;
  public rowData: any[] = [];
  public colDefs: ColDef[] = [];
  private parentComponent: any = null;
  private masterNode: any = null;
  /** ID del MASTER row del pedimento. params.node es el detail node (detail_XXX),
   *  por eso lo derivamos de cotizacionId, que es como el grid genera getRowId. */
  private masterNodeId: string | null = null;
  private params!: ICellRendererParams;
  private gridApi!: GridApi;

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.parentComponent = params.context?.componentParent || null;
    this.masterNode = params.node;
    this.masterNodeId = params.data?.cotizacionId != null ? String(params.data.cotizacionId) : null;
    // Una sola fila — los proveedores son COLUMNAS, no filas
    this.rowData = [params.data];
    this.colDefs = this.buildColDefs(params.data?.providerSlots || []);
    // ✅ Registrarse en el padre para poder refrescar tras guardar un proveedor en el modal
    if (this.parentComponent) {
      this.parentComponent.activeProvidersListDetail = this;
    }
  
    this.cdr.detectChanges();}

  refresh(params: ICellRendererParams): boolean {
    this.params = params;
    this.rowData = [params.data];
    this.colDefs = this.buildColDefs(params.data?.providerSlots || []);
    if (this.gridApi) {
      this.gridApi.setGridOption('columnDefs', this.colDefs);
      this.gridApi.setGridOption('rowData', this.rowData);
    }
    return true;
  }

  /**
   * ✅ Reconstruye las columnas desde providerSlots actualizados. Lo invoca el padre
   * (onSlotSaved) tras guardar un proveedor en el modal, para que la cascada refleje
   * el nuevo proveedor sin necesidad de cerrarla y reabrirla.
   */
  public rebuildIfMatches(nodeId: any): void {
    if (this.masterNodeId !== String(nodeId) || !this.params) return;
    this.rowData = [this.params.data];
    this.colDefs = this.buildColDefs(this.params.data?.providerSlots || []);
    if (this.gridApi) {
      this.gridApi.setGridOption('columnDefs', this.colDefs);
      this.gridApi.setGridOption('rowData', this.rowData);
    }
  }

  ngOnDestroy(): void {
    // Solo desregistrar si seguimos siendo la instancia activa (evita borrar una más nueva)
    if (this.parentComponent?.activeProvidersListDetail === this) {
      this.parentComponent.activeProvidersListDetail = null;
    }
  }

  onGridReady(ev: any) {
    this.gridApi = ev.api;
  }

  /**
   * Construye columnas dinámicas: 1 por cada proveedor del pedimento + "+" + COMPARAR.
   * Sin slots vacíos: solo se renderizan los slots que existen en providerSlots.
   */
  private buildColDefs(providerSlots: any[]): ColDef[] {
    const cols: ColDef[] = [];

    for (let i = 0; i < providerSlots.length; i++) {
      const slotIdx = i;
      const colorBg = PROV_PASTEL_COLORS[slotIdx % PROV_PASTEL_COLORS.length];
      cols.push({
        field: `slot_${slotIdx}`,
        headerName: `PROVEEDOR ${slotIdx + 1}`,
        width: 220,
        flex: 0,
        suppressSizeToFit: true,
        sortable: false,
        filter: false,
        cellRenderer: ButtonCellRendererComponent,
        cellRendererParams: {
          onClick: () => {
            const slot = this.params.data?.providerSlots?.[slotIdx];
            if (slot && this.parentComponent?.toggleProviderCascade) {
              // ✅ Deferir: el click viene DESDE DENTRO de un detail row.
              // Si llamamos directamente, AG Grid se confunde al cerrar/reabrir el detail
              // mientras todavía está procesando el evento de click. setTimeout(0) deja
              // que el event loop termine antes de mutar el detailType y reabrir.
              // ✅ IMPORTANTE: Pasar el ID del nodo (no la ref), el padre lo lookup actual
              const masterNodeId = this.masterNodeId;
              setTimeout(() => this.parentComponent.toggleProviderCascade(masterNodeId, slot), 0);
            }
          },
          icon: 'bi-person-badge',
          title: `Ver/Editar Proveedor ${slotIdx + 1}`
        },
        valueGetter: (p: any) => {
          const slot = p.data?.providerSlots?.[slotIdx];
          if (!slot) return '';
          const n = slot.name && String(slot.name).trim() !== '' ? String(slot.name).trim() : '';
          if (n && n.toLowerCase() !== 'sin seleccionar') return n;
          const id = Number(slot.idProvider);
          return Number.isFinite(id) && id > 0 ? `Prov. ${id}` : `Proveedor ${slotIdx + 1}`;
        },
        cellStyle: { backgroundColor: colorBg, cursor: 'pointer' }
      });
    }

    // ✅ Botón "+ Agregar Proveedor"
    cols.push({
      field: 'addProvider',
      headerName: '',
      width: 60,
      flex: 0,
      suppressSizeToFit: true,
      sortable: false,
      filter: false,
      cellRenderer: ButtonCellRendererComponent,
      cellRendererParams: {
        onClick: () => {
          const slotCount = this.params.data?.providerSlots?.length || 0;
          if (slotCount < MAX_PROVIDER_SLOTS && this.parentComponent?.addProviderSlot) {
            // ✅ Deferir igual que toggleProviderCascade, pasar node ID (no ref)
            const masterNodeId = this.masterNodeId;
            setTimeout(() => this.parentComponent.addProviderSlot(masterNodeId), 0);
          }
        },
        icon: 'bi-plus-lg',
        title: 'Agregar Proveedor'
      },
      valueGetter: () => ' ',
      cellStyle: { backgroundColor: '#c8e6c9', cursor: 'pointer', textAlign: 'center' }
    });

    // ✅ Botón COMPARAR
    cols.push({
      field: 'comparar',
      headerName: 'COMPARACIÓN',
      width: 200,
      flex: 0,
      suppressSizeToFit: true,
      sortable: false,
      filter: false,
      cellRenderer: ButtonCellRendererComponent,
      cellRendererParams: {
        onClick: () => {
          if (this.parentComponent?.toggleComparacionCascade) {
            // ✅ Deferir igual que toggleProviderCascade, pasar node ID (no ref)
            const masterNodeId = this.masterNodeId;
            setTimeout(() => this.parentComponent.toggleComparacionCascade(masterNodeId), 0);
          }
        },
        icon: 'bi-scale-balanced',
        title: 'Comparar Precios de Proveedores'
      },
      valueGetter: () => 'Comparar',
      cellStyle: { backgroundColor: '#e8eef5', cursor: 'pointer' }
    });

    return cols;
  }

  public gridOptions: any = {
    headerHeight: 35,
    rowHeight: 38,
    animateRows: false,
    suppressCellFocus: true,
    domLayout: 'autoHeight',
    defaultColDef: {
      resizable: true,
      sortable: false,
      filter: false
    }
  };
}
