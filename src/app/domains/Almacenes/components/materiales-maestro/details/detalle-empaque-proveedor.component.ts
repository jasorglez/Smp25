import { CommonModule } from '@angular/common';
import { Component, inject, ChangeDetectorRef} from '@angular/core';
import { AgGridModule, ICellRendererAngularComp } from 'ag-grid-angular';
import { ColDef, GridApi, ICellRendererParams } from 'ag-grid-community';
import { alerts } from 'app/helpers/alerts';
import { DescripcionEmpaqueService, DescripcionEmpaque } from 'app/services/descripcion-empaque.service';
import { UnidadMedidaService } from 'app/services/unidad-medida.service';
import { DimensionService } from 'app/services/dimension.service';
import { PesoVolumenService } from 'app/services/peso-volumen.service';
import { EmpaqueDescripcionService } from 'app/services/empaque-descripcion.service';
import { EmpaqueMedidaService } from 'app/services/empaque-medida.service';
import { EmpaquePesoVolumenService } from 'app/services/empaque-peso-volumen.service';
import { SignalsService } from 'app/services/signals.service';
import { DetalleMedidasEmpaqueComponent } from './detalle-medidas-empaque.component';
import { DetallePesoVolumenEmpaqueComponent } from './detalle-peso-volumen-empaque.component';

/**
 * Nivel 4 — Descripción del Artículo (PRESENTACIONES) del Proveedor.
 *
 * Grid MULTIFILA con auto-fila: cada fila es una PRESENTACIÓN del artículo que vende el proveedor
 * (ej. 1L, 0.5L, 0.2L). Columnas:
 *  - Descripción Empaque (dropdown catálogo descripcion_empaque → idDescripcionEmpaque)
 *  - Peso/Volumen (master/detail anidado, 1 fila: medida + unidad)
 *  - Pieza x Paquete (entero)
 *  - Medidas (master/detail anidado, multifila: medida + unidad + dimensión)
 *
 * Las filas viven en params.data.__empaqueRows (proveedor). El Guardar único del Nivel 2 persiste
 * las presentaciones (empaque_descripcion) y, por cada una, sus medidas y peso/volumen.
 */
@Component({
  selector: 'app-detalle-empaque-proveedor',
  standalone: true,
  imports: [CommonModule, AgGridModule],
  template: `
    <div style="padding: 10px; background-color: #fff3e0; height: 100%; display: flex; flex-direction: column; box-sizing: border-box;">
      <div style="margin-bottom: 15px; flex-grow: 1; display: flex; flex-direction: column;">
        <div style="margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
          <strong>Descripción del Artículo (Presentaciones) — Proveedor: {{ providerName }}</strong>
          <div class="d-flex gap-2">
            <button class="btn btn-sm btn-warning" (click)="revertChanges()">
              <i class="bi bi-arrow-clockwise"></i> Deshacer
            </button>
            <button class="btn btn-sm btn-danger" (click)="deleteSelected()" [disabled]="!selectedRow">
              <i class="bi bi-trash"></i> Borrar fila
            </button>
          </div>
        </div>

        <ag-grid-angular
          style="width: 100%; flex-grow: 1;"
          class="ag-theme-quartz small-text-ag-grid"
          [columnDefs]="empaqueColumnDefs"
          [rowData]="rowData"
          [gridOptions]="empaqueGridOptions"
          (gridReady)="onGridReady($event)"
          (cellClicked)="onEmpaqueCellClicked($event)"
          (selectionChanged)="onSelectionChanged($event)"
          (cellValueChanged)="onCellValueChanged($event)">
        </ag-grid-angular>
      </div>
    </div>
  `,
})
export class DetalleEmpaqueProveedorComponent implements ICellRendererAngularComp {
  public params!: ICellRendererParams;
  public providerName: string = '';
  private gridApi!: GridApi;

  private empaqueSvc    = inject(DescripcionEmpaqueService);
  private readonly cdr = inject(ChangeDetectorRef);
  private unidadSvc     = inject(UnidadMedidaService);
  private dimensionSvc  = inject(DimensionService);
  private pesoVolSvc    = inject(PesoVolumenService);
  private empDescSvc    = inject(EmpaqueDescripcionService);
  private medidaSvc     = inject(EmpaqueMedidaService);
  private pesoVolEmpSvc = inject(EmpaquePesoVolumenService);
  private signals       = inject(SignalsService);

  private empaqueOptions: DescripcionEmpaque[] = [];
  private unidadMap = new Map<number, string>();
  private dimensionMap = new Map<number, string>();
  private pesoVolMap = new Map<number, string>();

  public rowData: any[] = [];
  public selectedRow: any = null;

  private gridContext: any = {
    unidadesOptions: [],
    dimensionesOptions: [],
    pesoVolumenOptions: [],
    onMedidasChanged: () => this.onDetailChanged(),
    onPesoVolumenChanged: () => this.onDetailChanged(),
  };

  public empaqueGridOptions: any = {
    headerHeight: 25,
    rowHeight: 24,
    suppressClickEdit: false,
    stopEditingWhenCellsLoseFocus: true,
    rowSelection: 'single',
    masterDetail: true,
    detailRowHeight: 200,
    isRowMaster: () => true,
    detailCellRendererSelector: (params: any) =>
      params.data?.__empaqueDetailType === 'pesovolumen'
        ? { component: 'pesoVolumenDetailRenderer' }
        : { component: 'medidasDetailRenderer' },
    components: {
      medidasDetailRenderer: DetalleMedidasEmpaqueComponent,
      pesoVolumenDetailRenderer: DetallePesoVolumenEmpaqueComponent,
    },
    context: this.gridContext,
    defaultColDef: { filter: false, suppressHeaderFilterButton: true, floatingFilter: false, sortable: false },
  };

  public empaqueColumnDefs: ColDef[] = [
    {
      colId: 'descEmpaque',
      headerName: 'Descripción Empaque',
      editable: false,
      flex: 1,
      minWidth: 200,
      cellRenderer: (p: any) => this.buildEmpaqueSelect(p),
    },
    {
      colId: 'pesoVolumenTrigger',
      headerName: 'Peso/Volumen',
      editable: false,
      flex: 1,
      minWidth: 160,
      cellRenderer: (p: any) => this.buildPesoVolumenCell(p),
    },
    {
      field: 'piezaXPaquete',
      headerName: 'Pieza x Paquete',
      editable: true,
      width: 140,
      cellEditor: 'agNumberCellEditor',
      cellEditorParams: { precision: 0, step: 1, min: 0 },
      valueFormatter: (p: any) => (p.value === null || p.value === undefined || p.value === '') ? '' : String(p.value),
      valueSetter: (p: any) => {
        const raw = p.newValue;
        if (raw === null || raw === undefined) return false;
        const s = String(raw).trim();
        if (s === '') { p.data.piezaXPaquete = null; return true; }
        if (!/^\d+$/.test(s)) {
          alerts.basicAlert('Pieza x Paquete', 'Solo se permiten números enteros.', 'warning');
          return false;
        }
        p.data.piezaXPaquete = Number(s);
        return true;
      }
    },
    {
      colId: 'medidasTrigger',
      headerName: 'Medidas',
      editable: false,
      flex: 1,
      minWidth: 220,
      cellRenderer: (p: any) => this.buildMedidasCell(p),
    },
  ];

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.providerName = params.data?.providerName || '—';

    const idCompany = this.signals.idCompany() ?? 9;

    this.empaqueSvc.getByCompany(idCompany).subscribe({
      next: (data) => { this.empaqueOptions = data.filter(d => d.active); this.refresh1(); },
    });
    this.unidadSvc.getByCompany(idCompany).subscribe({
      next: (data) => {
        const act = data.filter(u => u.active);
        this.gridContext.unidadesOptions = act;
        this.unidadMap.clear(); act.forEach(u => this.unidadMap.set(u.id!, u.abreviatura));
        this.refresh1();
      },
    });
    this.dimensionSvc.getByCompany(idCompany).subscribe({
      next: (data) => {
        const act = data.filter(d => d.active);
        this.gridContext.dimensionesOptions = act;
        this.dimensionMap.clear(); act.forEach(d => this.dimensionMap.set(d.id!, d.nombre));
        this.refresh1();
      },
    });
    this.pesoVolSvc.getByCompany(idCompany).subscribe({
      next: (data) => {
        const act = data.filter(p => p.active);
        this.gridContext.pesoVolumenOptions = act;
        this.pesoVolMap.clear(); act.forEach(p => this.pesoVolMap.set(p.id!, p.abreviatura));
        this.refresh1();
      },
    });

    // Presentaciones del proveedor (cache en params.data para sobrevivir colapsos).
    if (Array.isArray(params.data.__empaqueRows)) {
      this.rowData = params.data.__empaqueRows;
      this.ensureTrailingEmptyRow();
    } else {
      const idProv = Number(params.data?.id);
      if (idProv > 0 && !String(params.data.id).startsWith('temp_')) {
        this.empDescSvc.getByProveedor(idProv).subscribe({
          next: async (rows) => {
            const presentaciones = await Promise.all((rows ?? []).map(async (r) => {
              const [meds, pvs] = await Promise.all([
                this.medidaSvc.getByEmpaque(r.id!).toPromise().catch(() => []),
                this.pesoVolEmpSvc.getByEmpaque(r.id!).toPromise().catch(() => []),
              ]);
              return {
                id: r.id,
                idDescripcionEmpaque: r.idDescripcionEmpaque ?? null,
                piezaXPaquete: r.piezaXPaquete ?? null,
                __medidas: (meds ?? []).map((m: any) => ({ medida: m.medida, idUnidad: m.idUnidad, idDimension: m.idDimension })),
                __pesoVolumen: (pvs ?? []).map((p: any) => ({ medida: p.medida, idUnidad: p.idUnidad })),
              };
            }));
            params.data.__empaqueRows = presentaciones;
            this.rowData = presentaciones;
            this.ensureTrailingEmptyRow();
            this.refresh1();
          },
          error: () => { params.data.__empaqueRows = []; this.rowData = []; this.ensureTrailingEmptyRow(); }
        });
      } else {
        params.data.__empaqueRows = [];
        this.rowData = [];
        this.ensureTrailingEmptyRow();
      }
    }
  
    this.cdr.detectChanges();}

  refresh(): boolean { return false; }
  private refresh1(): void { if (this.gridApi) this.gridApi.refreshCells({ force: true }); }

  onGridReady(event: any) { this.gridApi = event.api; }

  onSelectionChanged(_: any) {
    const sel = this.gridApi.getSelectedRows();
    this.selectedRow = sel.length > 0 ? sel[0] : null;
  }

  // ── Auto-fila ──────────────────────────────────────────────────────────────
  private rowHasData(r: any): boolean {
    return !!r && (!!r.idDescripcionEmpaque || (r.piezaXPaquete !== null && r.piezaXPaquete !== undefined && r.piezaXPaquete !== '')
      || (Array.isArray(r.__medidas) && r.__medidas.length > 0)
      || (Array.isArray(r.__pesoVolumen) && r.__pesoVolumen.length > 0));
  }

  private ensureTrailingEmptyRow(): void {
    let added: any = null;
    if (this.rowData.length === 0) {
      added = this.newEmptyRow(); this.rowData.push(added);
    } else {
      const last = this.rowData[this.rowData.length - 1];
      if (this.rowHasData(last)) { added = this.newEmptyRow(); this.rowData.push(added); }
    }
    // Agregar SOLO la fila nueva por transacción (no resetea el grid → no colapsa los detalles abiertos).
    if (added && this.gridApi) this.gridApi.applyTransaction({ add: [added] });
    this.syncToParent();
  }

  private newEmptyRow(): any {
    return { id: null, idDescripcionEmpaque: null, piezaXPaquete: null, __medidas: [], __pesoVolumen: [] };
  }

  /** Vuelca las presentaciones con datos a params.data (la vacía final no se guarda). */
  private syncToParent(): void {
    if (!this.params?.data) return;
    this.params.data.__empaqueRows = this.rowData;     // objetos compartidos (los detalles mutan en sitio)
    this.params.data.__empaqueDirty = true;
    this.params.data.__modified = true;
  }

  private mutated(): void {
    this.ensureTrailingEmptyRow();
    this.refresh1();
    this.notifyParent();
  }

  // ── Descripción Empaque (dropdown) ──────────────────────────────────────────
  private buildEmpaqueSelect(p: any): HTMLElement {
    const select = document.createElement('select');
    select.style.cssText = 'width:100%;height:100%;border:none;background:transparent;cursor:pointer;outline:none;';
    const empty = document.createElement('option');
    empty.value = ''; empty.text = '— Seleccionar —';
    select.appendChild(empty);
    for (const o of this.empaqueOptions) {
      const opt = document.createElement('option');
      opt.value = String(o.id); opt.text = o.descripcion;
      select.appendChild(opt);
    }
    const cur = p.data?.idDescripcionEmpaque;
    select.value = (cur !== null && cur !== undefined) ? String(cur) : '';
    select.addEventListener('change', () => {
      p.data.idDescripcionEmpaque = select.value ? Number(select.value) : null;
      this.mutated();
    });
    return select;
  }

  // ── Triggers de detalle ─────────────────────────────────────────────────────
  private buildMedidasCell(p: any): HTMLElement {
    const div = document.createElement('div');
    div.style.cssText = 'cursor:pointer;color:#e65100;text-decoration:underline;width:100%;height:100%;';
    div.innerHTML = this.buildMedidasConcat(p.data) || '<span style="font-style:italic;color:#bf6b1f;">Ver / agregar ▾</span>';
    return div;
  }
  private buildPesoVolumenCell(p: any): HTMLElement {
    const div = document.createElement('div');
    div.style.cssText = 'cursor:pointer;color:#e65100;text-decoration:underline;width:100%;height:100%;';
    div.innerHTML = this.buildPesoVolumenConcat(p.data) || '<span style="font-style:italic;color:#bf6b1f;">Ver / agregar ▾</span>';
    return div;
  }

  private buildMedidasConcat(data: any): string {
    const rows = (Array.isArray(data?.__medidas) ? data.__medidas : []).filter((r: any) => this.medRow(r));
    const parts = rows.map((r: any) => {
      const medida = (r.medida !== null && r.medida !== undefined && r.medida !== '') ? Number(r.medida).toFixed(2) : '';
      const uni = r.idUnidad ? (this.unidadMap.get(Number(r.idUnidad)) ?? '') : '';
      const dim = r.idDimension ? (this.dimensionMap.get(Number(r.idDimension)) ?? '') : '';
      const left = [medida, uni].filter(Boolean).join(' ');
      return dim ? `${left} de ${dim}`.trim() : left;
    }).filter(Boolean);
    if (parts.length === 0) return '';
    if (parts.length === 1) return parts[0];
    return parts.slice(0, -1).join(', ') + ' y ' + parts[parts.length - 1];
  }
  private buildPesoVolumenConcat(data: any): string {
    const rows = (Array.isArray(data?.__pesoVolumen) ? data.__pesoVolumen : []).filter((r: any) => this.pvRow(r));
    if (rows.length === 0) return '';
    const r = rows[0];
    const medida = (r.medida !== null && r.medida !== undefined && r.medida !== '') ? Number(r.medida).toFixed(2) : '';
    const uni = r.idUnidad ? (this.pesoVolMap.get(Number(r.idUnidad)) ?? '') : '';
    return [medida, uni].filter(Boolean).join(' ');
  }
  private medRow(r: any): boolean { return !!r && ((r.medida !== null && r.medida !== undefined && r.medida !== '') || !!r.idUnidad || !!r.idDimension); }
  private pvRow(r: any): boolean { return !!r && ((r.medida !== null && r.medida !== undefined && r.medida !== '') || !!r.idUnidad); }

  /** Click en columna Medidas / Peso-Volumen → expande/colapsa el detail de ESA fila. */
  onEmpaqueCellClicked(event: any): void {
    const colId = event.column?.getColId();
    const type = colId === 'medidasTrigger' ? 'medidas'
               : colId === 'pesoVolumenTrigger' ? 'pesovolumen' : null;
    if (!type) return;
    const node = event.node;
    const sameOpen = node.expanded && node.data.__empaqueDetailType === type;
    // Cerrar otros detalles abiertos (acordeón).
    this.gridApi.forEachNode((n: any) => { if (n.id !== node.id && n.expanded) n.setExpanded(false); });
    if (sameOpen) {
      node.setExpanded(false);
      node.data.__empaqueDetailType = '';
    } else {
      if (node.expanded) node.setExpanded(false);
      node.data.__empaqueDetailType = type;
      setTimeout(() => node.setExpanded(true), 0);
    }
  }

  /** Lo invoca el detail renderer al cambiar medidas/peso de una presentación. */
  onDetailChanged(): void {
    this.ensureTrailingEmptyRow();   // por si una fila pasó a tener datos vía su detalle
    this.refresh1();
    this.notifyParent();
  }

  private notifyParent(): void {
    if (this.params?.data) { this.params.data.__empaqueDirty = true; this.params.data.__modified = true; }
    const parent = this.params?.context?.componentParent;
    if (parent && typeof parent.notifyChildChanged === 'function') parent.notifyChildChanged();
  }

  onCellValueChanged(_: any) { this.mutated(); }

  revertChanges(): void {
    // Recarga desde cache/backend: limpia el cache para forzar recarga al reabrir.
    if (this.params?.data) {
      delete this.params.data.__empaqueRows;
      delete this.params.data.__empaqueDirty;
    }
    this.gridApi?.forEachNode((n: any) => n.setExpanded(false));
    this.agInit(this.params);   // recarga
  }

  deleteSelected(): void {
    if (!this.selectedRow) return;
    // No borrar la fila vacía final.
    if (!this.rowHasData(this.selectedRow) && this.rowData[this.rowData.length - 1] === this.selectedRow) return;
    this.rowData = this.rowData.filter(r => r !== this.selectedRow);
    this.selectedRow = null;
    if (this.gridApi) this.gridApi.setGridOption('rowData', this.rowData);
    this.ensureTrailingEmptyRow();
    this.refresh1();
    this.notifyParent();
  }
}
