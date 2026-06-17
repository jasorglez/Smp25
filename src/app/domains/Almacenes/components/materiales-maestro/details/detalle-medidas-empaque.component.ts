import { CommonModule } from '@angular/common';
import { inject, Component, ChangeDetectorRef} from '@angular/core';
import { AgGridModule, ICellRendererAngularComp } from 'ag-grid-angular';
import { ColDef, GridApi, ICellRendererParams } from 'ag-grid-community';

/**
 * Nivel 5 — Medidas del empaque (detail row anidado dentro del grid de empaque).
 *
 * Grid multifila: Medida (2 decimales) + Unidad + Dimensión (dropdowns nativos).
 * Auto-fila: siempre hay una fila vacía al final que NO se guarda.
 * Muta params.data.__medidas (objeto compartido con la fila de proveedor) y avisa al
 * componente de empaque vía context.onMedidasChanged() para refrescar la concatenación.
 * Los catálogos llegan por context (unidadesOptions / dimensionesOptions).
 */
@Component({
  selector: 'app-detalle-medidas-empaque',
  standalone: true,
  imports: [CommonModule, AgGridModule],
  template: `
    <div style="padding: 8px; background-color: #fffaf2; height: 100%; display: flex; flex-direction: column; box-sizing: border-box;">
      <div style="font-weight: 600; margin-bottom: 6px; color: #e65100; flex: 0 0 auto;">
        <i class="bi bi-rulers"></i> Medidas
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
export class DetalleMedidasEmpaqueComponent implements ICellRendererAngularComp {
  private readonly cdr = inject(ChangeDetectorRef);
  private params!: ICellRendererParams;
  private gridApi!: GridApi;

  private unidadesOptions: any[] = [];
  private dimensionesOptions: any[] = [];

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
      headerName: 'Medida',
      width: 130,
      editable: true,
      cellEditor: 'agNumberCellEditor',
      cellEditorParams: { precision: 2, min: 0 },
      valueFormatter: (p: any) => (p.value === null || p.value === undefined || p.value === '') ? '' : Number(p.value).toFixed(2),
    },
    {
      colId: 'unidad',
      headerName: 'Unidad',
      width: 150,
      editable: false,
      cellRenderer: (p: any) => this.buildSelect(p, 'idUnidad', this.unidadesOptions, 'abreviatura'),
    },
    {
      colId: 'dimension',
      headerName: 'Dimensión',
      flex: 1,
      minWidth: 150,
      editable: false,
      cellRenderer: (p: any) => this.buildSelect(p, 'idDimension', this.dimensionesOptions, 'nombre'),
    },
  ];

  agInit(params: ICellRendererParams): void {
    this.params = params;
    const ctx: any = params.context || {};
    this.unidadesOptions = ctx.unidadesOptions || [];
    this.dimensionesOptions = ctx.dimensionesOptions || [];

    const cached = Array.isArray((params.data as any)?.__medidas) ? (params.data as any).__medidas : [];
    this.rowData = cached.map((r: any) => ({ ...r }));
    this.ensureTrailingEmptyRow();
  
    this.cdr.detectChanges();}

  refresh(): boolean { return false; }

  onGridReady(event: any) {
    this.gridApi = event.api;
    this.ensureTrailingEmptyRow();
  }

  private buildSelect(params: any, field: 'idUnidad' | 'idDimension', options: any[], labelField: string): HTMLElement {
    const select = document.createElement('select');
    select.style.cssText = 'width:100%;height:100%;border:none;background:transparent;cursor:pointer;outline:none;';
    const empty = document.createElement('option');
    empty.value = ''; empty.text = '—';
    select.appendChild(empty);
    for (const o of options) {
      const opt = document.createElement('option');
      opt.value = String(o.id);
      const abbr = o[labelField] ?? '';
      // Si la opción tiene nombre + abreviatura (unidades), el dropdown muestra "Nombre = Abrev".
      const full = (o.nombre && o.abreviatura) ? `${o.nombre} = ${o.abreviatura}` : abbr;
      opt.text = abbr;                          // celda: abreviatura/nombre corto
      (opt as any).dataset.abbr = abbr;
      (opt as any).dataset.full = full;
      select.appendChild(opt);
    }
    const current = params.data?.[field];
    select.value = (current !== null && current !== undefined) ? String(current) : '';

    const toFull = () => Array.from(select.options).forEach(op => { const f = (op as any).dataset.full; if (f) op.text = f; });
    const toAbbr = () => Array.from(select.options).forEach(op => { const a = (op as any).dataset.abbr; if (a) op.text = a; });
    select.addEventListener('mousedown', toFull);
    select.addEventListener('focus', toFull);
    select.addEventListener('blur', toAbbr);

    select.addEventListener('change', () => {
      params.data[field] = select.value ? Number(select.value) : null;
      toAbbr();
      this.onMutated();
    });
    return select;
  }

  onCellChanged(_: any) { this.onMutated(); }

  private rowHasData(r: any): boolean {
    return !!r && ((r.medida !== null && r.medida !== undefined && r.medida !== '') || !!r.idUnidad || !!r.idDimension);
  }

  private ensureTrailingEmptyRow(): void {
    if (this.rowData.length === 0) {
      this.rowData.push({ medida: null, idUnidad: null, idDimension: null });
    } else {
      const last = this.rowData[this.rowData.length - 1];
      if (this.rowHasData(last)) this.rowData.push({ medida: null, idUnidad: null, idDimension: null });
    }
    if (this.gridApi) this.gridApi.setGridOption('rowData', this.rowData);
  }

  private onMutated(): void {
    this.ensureTrailingEmptyRow();
    // Volcar filas con datos a la fila padre (la vacía final no se guarda).
    const clean = this.rowData
      .filter(r => this.rowHasData(r))
      .map(r => ({
        medida: (r.medida === '' || r.medida === undefined || r.medida === null) ? null : Number(r.medida),
        idUnidad: r.idUnidad ? Number(r.idUnidad) : null,
        idDimension: r.idDimension ? Number(r.idDimension) : null,
      }));
    (this.params.data as any).__medidas = clean;
    (this.params.data as any).__medidasDirty = true;
    (this.params.data as any).__modified = true;
    if (this.gridApi) this.gridApi.refreshCells({ force: true });
    // Avisar al componente de empaque (refresca concatenación) y a la cadena de Guardar.
    const ctx: any = this.params.context || {};
    if (typeof ctx.onMedidasChanged === 'function') ctx.onMedidasChanged();
  }
}
