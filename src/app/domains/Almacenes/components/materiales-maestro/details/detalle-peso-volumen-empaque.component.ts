import { CommonModule } from '@angular/common';
import { inject, Component, ChangeDetectorRef} from '@angular/core';
import { AgGridModule, ICellRendererAngularComp } from 'ag-grid-angular';
import { ColDef, GridApi, ICellRendererParams } from 'ag-grid-community';

/**
 * Peso/Volumen del empaque (detail row anidado dentro del grid de empaque).
 * UNA SOLA FILA: Medida (2 decimales) + Unidad (dropdown nativo del catálogo peso_volumen).
 * Muta params.data.__pesoVolumen (array de 0 o 1 item) + __pesoVolumenDirty y avisa al
 * componente de empaque vía context.onPesoVolumenChanged() para refrescar la concatenación.
 */
@Component({
  selector: 'app-detalle-peso-volumen-empaque',
  standalone: true,
  imports: [CommonModule, AgGridModule],
  template: `
    <div style="padding: 8px; background-color: #fffaf2; height: 100%; display: flex; flex-direction: column; box-sizing: border-box;">
      <div style="font-weight: 600; margin-bottom: 6px; color: #e65100; flex: 0 0 auto;">
        <i class="bi bi-speedometer2"></i> Peso / Volumen
      </div>
      <ag-grid-angular
        style="width: 100%; flex-grow: 1;"
        class="ag-theme-quartz small-text-ag-grid"
        [columnDefs]="columnDefs"
        [rowData]="rowData"
        [gridOptions]="gridOptions"
        (gridReady)="onGridReady($event)"
        (cellValueChanged)="onCellChanged($event)">
      </ag-grid-angular>
    </div>
  `,
})
export class DetallePesoVolumenEmpaqueComponent implements ICellRendererAngularComp {
  private readonly cdr = inject(ChangeDetectorRef);
  private params!: ICellRendererParams;
  private gridApi!: GridApi;

  private unidadesOptions: any[] = [];
  public rowData: any[] = [];

  public gridOptions: any = {
    headerHeight: 25,
    rowHeight: 26,
    suppressClickEdit: false,
    stopEditingWhenCellsLoseFocus: true,
    defaultColDef: { filter: false, suppressHeaderFilterButton: true, floatingFilter: false, sortable: false },
  };

  public columnDefs: ColDef[] = [
    {
      field: 'medida',
      headerName: 'Cantidad',
      width: 150,
      editable: true,
      cellEditor: 'agNumberCellEditor',
      cellEditorParams: { precision: 2, min: 0 },
      valueFormatter: (p: any) => (p.value === null || p.value === undefined || p.value === '') ? '' : Number(p.value).toFixed(2),
    },
    {
      colId: 'unidad',
      headerName: 'Unidad',
      flex: 1,
      minWidth: 150,
      editable: false,
      cellRenderer: (p: any) => this.buildSelect(p),
    },
  ];

  agInit(params: ICellRendererParams): void {
    this.params = params;
    const ctx: any = params.context || {};
    this.unidadesOptions = ctx.pesoVolumenOptions || [];

    const cached = Array.isArray((params.data as any)?.__pesoVolumen) ? (params.data as any).__pesoVolumen : [];
    // Una sola fila: si hay dato lo muestra, si no una fila vacía editable.
    this.rowData = cached.length > 0
      ? [{ ...cached[0] }]
      : [{ medida: null, idUnidad: null }];
  
    this.cdr.detectChanges();}

  refresh(): boolean { return false; }

  onGridReady(event: any) { this.gridApi = event.api; }

  private buildSelect(params: any): HTMLElement {
    const select = document.createElement('select');
    select.style.cssText = 'width:100%;height:100%;border:none;background:transparent;cursor:pointer;outline:none;';
    const empty = document.createElement('option');
    empty.value = ''; empty.text = '—';
    select.appendChild(empty);
    for (const o of this.unidadesOptions) {
      const opt = document.createElement('option');
      opt.value = String(o.id);
      opt.text = o.abreviatura;                                    // celda: solo abreviatura
      (opt as any).dataset.abbr = o.abreviatura ?? '';
      (opt as any).dataset.full = `${o.nombre ?? ''} = ${o.abreviatura ?? ''}`.trim(); // dropdown: nombre = abrev
      select.appendChild(opt);
    }
    const current = params.data?.idUnidad;
    select.value = (current !== null && current !== undefined) ? String(current) : '';

    // Al abrir muestra el nombre completo; al cerrar/elegir vuelve a la abreviatura.
    const toFull = () => Array.from(select.options).forEach(op => { const f = (op as any).dataset.full; if (f) op.text = f; });
    const toAbbr = () => Array.from(select.options).forEach(op => { const a = (op as any).dataset.abbr; if (a) op.text = a; });
    select.addEventListener('mousedown', toFull);
    select.addEventListener('focus', toFull);
    select.addEventListener('blur', toAbbr);

    select.addEventListener('change', () => {
      params.data.idUnidad = select.value ? Number(select.value) : null;
      toAbbr();
      this.onMutated();
    });
    return select;
  }

  onCellChanged(_: any) { this.onMutated(); }

  private rowHasData(r: any): boolean {
    return !!r && ((r.medida !== null && r.medida !== undefined && r.medida !== '') || !!r.idUnidad);
  }

  private onMutated(): void {
    const r = this.rowData[0];
    const clean = this.rowHasData(r)
      ? [{
          medida: (r.medida === '' || r.medida === undefined || r.medida === null) ? null : Number(r.medida),
          idUnidad: r.idUnidad ? Number(r.idUnidad) : null,
        }]
      : [];
    (this.params.data as any).__pesoVolumen = clean;
    (this.params.data as any).__pesoVolumenDirty = true;
    (this.params.data as any).__modified = true;
    if (this.gridApi) this.gridApi.refreshCells({ force: true });
    const ctx: any = this.params.context || {};
    if (typeof ctx.onPesoVolumenChanged === 'function') ctx.onPesoVolumenChanged();
  }
}
