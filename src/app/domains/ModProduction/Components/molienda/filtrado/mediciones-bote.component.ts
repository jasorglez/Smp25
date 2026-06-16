import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { lastValueFrom } from 'rxjs';
import { ProductionService } from 'app/services/production.service';
import { SignalsService } from 'app/services/signals.service';
import { alerts } from 'app/helpers/alerts';
import { ItemCommentsCellRendererComponent } from 'app/shared/item-comments-cell-renderer/item-comments-cell-renderer.component';
import { MedicionMatPrimaComponent } from './medicion-mat-prima.component';
import { SelectWithTooltipEditorV2Component } from 'app/shared/select-with-tooltip-editor-v2.component';
import { SelectOption } from 'app/shared/select-dropdown.service';
import { TimeEditorComponent } from 'app/domains/Indicadores/components/ind01/timeinactives/time-editor.component';

interface ParamCatalog {
  id: number;
  nombre: string;
  valorMin: number | null;
  valorMax: number | null;
}

@Component({
  selector: 'app-mediciones-bote',
  standalone: true,
  imports: [CommonModule, AgGridAngular, ItemCommentsCellRendererComponent, MedicionMatPrimaComponent, SelectWithTooltipEditorV2Component, TimeEditorComponent],
  styles: [':host { display: block; height: 100%; overflow: hidden; }'],
  template: `
    <div style="height:100%;display:flex;flex-direction:column;background:#fff8e1;border-top:2px solid #ffe0b2;">

      <!-- Toolbar -->
      <div style="padding:3px 8px;flex-shrink:0;border-bottom:1px solid #ffe0b2;display:flex;align-items:center;gap:6px;">
        <span style="font-size:0.78rem;color:#e65100;font-weight:600;flex:1;">
          <i class="bi bi-clipboard-data me-1"></i>
          Mediciones — <span style="font-weight:400;">{{ folioLabel }}</span>
          <span *ngIf="loading" class="ms-2 text-warning" style="font-size:0.75rem;">
            <i class="bi bi-hourglass-split"></i> Cargando…
          </span>
        </span>
        <div class="d-flex gap-1">
          <button class="btn btn-sm btn-success" (click)="addRow()" [disabled]="!gridApi">
            <i class="bi bi-plus-lg"></i> Agregar
          </button>
          <button class="btn btn-sm btn-primary position-relative"
                  (click)="saveChanges()" [disabled]="!hasChanges && !hasChildChanges()">
            <i class="bi bi-floppy"></i> Guardar
            <span *ngIf="hasChanges || hasChildChanges()"
                  class="position-absolute top-0 start-100 translate-middle p-2 bg-danger border border-light rounded-circle">
              <span class="visually-hidden">Cambios sin guardar</span>
            </span>
          </button>
          <button class="btn btn-sm btn-warning" (click)="revert()">
            <i class="bi bi-arrow-clockwise"></i> Deshacer
          </button>
          <button class="btn btn-sm btn-danger" (click)="deleteRow()" [disabled]="!selectedRow">
            <i class="bi bi-trash"></i> Borrar
          </button>
        </div>
      </div>

      <!-- Sin parámetros configurados -->
      <div *ngIf="!loading && colDefs.length === 0"
           style="flex:1;display:flex;align-items:center;justify-content:center;color:#9e9e9e;font-size:0.82rem;text-align:center;padding:16px;">
        <div>
          <i class="bi bi-sliders" style="font-size:1.8rem;display:block;opacity:0.3;margin-bottom:6px;"></i>
          Sin parámetros configurados para esta materia prima.
          <div style="font-size:0.76rem;margin-top:4px;">Ve a Catálogos → Parámetros para habilitarlos.</div>
        </div>
      </div>

      <!-- Grid -->
      <div *ngIf="colDefs.length > 0" style="flex:1 1 auto;min-height:0;">
        <ag-grid-angular
          class="ag-theme-quartz"
          style="width:100%;height:100%;"
          [rowData]="rowData"
          [columnDefs]="colDefs"
          [gridOptions]="gridOptions"
          [context]="medicionGridContext"
          (gridReady)="onGridReady($event)"
          (selectionChanged)="onSelectionChanged($event)"
          (cellValueChanged)="onCellValueChanged($event)">
        </ag-grid-angular>
      </div>

    </div>
  `,
})
export class MedicionesBoteComponent implements ICellRendererAngularComp {
  private productionService = inject(ProductionService);
  private signalsService = inject(SignalsService);

  loading = false;
  folioLabel = '';

  gridApi!: GridApi;
  rowData: any[] = [];
  private originalRowData: any[] = [];
  selectedRow: any = null;

  colDefs: ColDef[] = [];
  private params: ParamCatalog[] = [];
  private idMoliendaParams: number | null = null;
  private idArticulo: number | null = null;
  private matPrimaOptions: { id: number; name: string }[] = [];
  private fasesFEOptions: SelectOption[] = [];

  matPrimaCountMap: Record<number, number> = {};
  medicionGridContext: any = {};

  gridOptions: any = {
    getRowId: (p: any) => String(p.data.id ?? p.data.__tempId),
    headerHeight: 24,
    rowHeight: 22,
    rowSelection: 'single',
    stopEditingWhenCellsLoseFocus: true,
    masterDetail: true,
    isRowMaster: (data: any) => !!data?.id && !data?.__isNew,
    detailCellRenderer: MedicionMatPrimaComponent,
    // mediciones panel = 80vh-195; restar toolbar (36) + header ag-grid (24) + fila (22) + buffer (4)
    detailRowHeight: Math.max(120, window.innerHeight * 0.8 - 281),
    rowClassRules: { 'new-row-highlight': (p: any) => !!p.data?.__isNew },
    onRowGroupOpened: (e: any) => {
      this.gridApi?.refreshCells({ rowNodes: [e.node], columns: ['matPrima'], force: true });
    },
  };

  // ── ICellRendererAngularComp ──────────────────────────────────────────────

  private onCountChanged: ((id: number, count: number) => void) | null = null;
  private _hasChanges = false;

  get hasChanges() { return this._hasChanges; }
  set hasChanges(v: boolean) { this._hasChanges = v; }

  @Input() set agParams(p: any) { if (p) this.agInit(p); }

  agInit(params: any): void {
    this.idMoliendaParams = params.data?.id ?? null;
    this.folioLabel       = params.data?.folio ?? '';
    this.idArticulo       = params.context?.idArticulo ?? null;
    this.matPrimaOptions  = params.context?.matPrimaOptions ?? [];
    this.fasesFEOptions   = params.context?.fasesFEOptions ?? [];
    this.onCountChanged   = params.context?.onMedicionesCountChanged ?? null;
    this.matPrimaCountMap = {};
    const allArticuloOptions: { id: number; name: string }[] =
      params.context?.allArticuloOptions ?? this.matPrimaOptions;
    this.medicionGridContext = {
      matPrimaOptions:   this.matPrimaOptions,
      allArticuloOptions,
      idArticulo:        this.idArticulo,
      onMatPrimaCountChanged: (idMedicion: number, count: number) => {
        this.matPrimaCountMap[idMedicion] = count;
        this.gridApi?.refreshCells({ columns: ['matPrima'], force: true });
      },
      // Propagar modal de salida por lote al componente de mat prima
      idSucursal:      params.context?.idSucursal ?? null,
      openSalidaModal: params.context?.openSalidaModal ?? null,
      // articuloOptions doblemente filtrado (active=1 + inventario > 0)
      articuloOptions: params.context?.articuloOptions ?? [],
    };

    if (this.idMoliendaParams) this.loadAll();
  }

  refresh(): boolean { return false; }

  // ── Data loading ──────────────────────────────────────────────────────────

  reloadData() { if (this.idMoliendaParams) this.loadAll(); }

  private async loadAll() {
    this.loading = true;
    try {
      const [catalogItems, mediciones] = await Promise.all([
        lastValueFrom(
          this.idArticulo
            ? this.productionService.getMoliendaParamCatalogByArticulo(this.idArticulo)
            : this.productionService.getMoliendaParamCatalog()
        ).catch(() => [] as any[]),
        lastValueFrom(
          this.productionService.getMoliendaMedicionesByParams(this.idMoliendaParams!)
        ).catch(() => [] as any[]),
      ]);

      this.params = (catalogItems as any[]).map((c: any) => ({
        id: c.id, nombre: c.nombre,
        valorMin: c.valorMin ?? null,
        valorMax: c.valorMax ?? null,
      }));

      this.buildColDefs();
      this.buildRowData(mediciones as any[], true);
    } catch (e) {
      console.error('Error cargando mediciones:', e);
    } finally {
      this.loading = false;
    }
  }

  private buildColDefs() {
    const fixed: ColDef[] = [
      {
        field: 'fecha', headerName: 'Fecha', editable: true, width: 120,
        cellEditor: 'agDateCellEditor',
        valueGetter: (p: any) => {
          if (!p.data?.fecha) return null;
          const [y, m, d] = String(p.data.fecha).split('-').map(Number);
          return new Date(y, m - 1, d);
        },
        valueFormatter: (p: any) => {
          if (!p.value) return '';
          const d: Date = p.value instanceof Date ? p.value : new Date(p.value);
          if (isNaN(d.getTime())) return String(p.value ?? '');
          return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        },
        valueSetter: (p: any) => {
          if (!p.newValue) return false;
          let iso: string;
          if (p.newValue instanceof Date) {
            const d = p.newValue as Date;
            iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
          } else {
            const s = String(p.newValue);
            iso = s.includes('T') ? s.split('T')[0] : s;
          }
          p.data.fecha = iso; p.data.__modified = true; return true;
        },
      },
      {
        field: 'hora', headerName: 'Hora', editable: true, width: 88,
        cellEditor: TimeEditorComponent,
        valueSetter: (p: any) => { p.data.hora = p.newValue; p.data.__modified = true; return true; },
      },
      {
        field: 'faseFe', headerName: 'Fase FE', editable: true, width: 110,
        cellEditor: SelectWithTooltipEditorV2Component,
        cellEditorParams: (p: any) => {
          const usedByOthers = new Set(
            this.rowData.filter(r => r !== p.data && r.faseFe).map((r: any) => r.faseFe)
          );
          return { options: this.fasesFEOptions.filter(o => !usedByOthers.has(o.id)) };
        },
        valueFormatter: (p: any) => p.value ?? '',
        valueSetter: (p: any) => {
          const val = p.newValue ?? '';
          if (val) {
            const duplicate = this.rowData.some(r => r !== p.data && r.faseFe === val);
            if (duplicate) { alerts.basicAlert('Fase repetida', `La fase "${val}" ya existe en esta medición.`, 'warning'); return false; }
          }
          p.data.faseFe = val; p.data.__modified = true; return true;
        },
      },
      {
        field: 'matPrima', headerName: 'Mat. Prima', editable: false, width: 140,
        cellStyle: (p: any) => p.data?.id ? { backgroundColor: '#e8f5e9', cursor: 'pointer' } : {},
        cellRenderer: (p: any) => {
          if (!p.data?.id) return '—';
          const count = this.matPrimaCountMap[p.data.id];
          const badge = count != null ? ` (${count})` : '';
          const a = document.createElement('a');
          a.href = '#';
          a.style.cssText = 'color:#2e7d32;text-decoration:underline;font-size:0.78rem;';
          a.textContent = p.node?.expanded ? '▲ Ocultar' : `▼ Mat. Prima${badge}`;
          a.addEventListener('click', ev => { ev.preventDefault(); p.node.setExpanded(!p.node.expanded); });
          return a;
        },
      },
      {
        field: 'comentarios', headerName: '💬', width: 52, editable: false,
        cellRenderer: ItemCommentsCellRendererComponent,
        cellRendererParams: (p: any) => ({
          documentType: 'MEDICION',
          idDocument: this.idMoliendaParams ?? 0,
          numArticle: String(p.data?.id ?? p.data?.__tempId ?? ''),
          locked: !!p.data?.__isNew || !p.data?.id,
          articleName: [p.data?.fecha, p.data?.hora].filter(Boolean).join(' '),
        }),
      },
      {
        field: 'cerrarEntrada', headerName: '', width: 100, editable: false, sortable: false,
        cellRenderer: (p: any) => {
          if (!p.data?.id) return '';
          const btn = document.createElement('button');
          btn.style.cssText = 'padding:1px 6px;font-size:0.72rem;';
          if (p.data.__cerrado) {
            btn.className = 'btn btn-sm btn-outline-secondary';
            btn.disabled = true;
            btn.innerHTML = '<i class="bi bi-check-circle-fill"></i> Cerrado';
          } else {
            btn.className = 'btn btn-sm btn-outline-success';
            btn.innerHTML = '<i class="bi bi-x-circle"></i> Cerrar';
          }
          btn.addEventListener('click', (ev) => { ev.stopPropagation(); this.closeEntry(p.data, p); });
          return btn;
        },
      },
    ];

    const paramCols: ColDef[] = this.params.map(param => ({
      field: `param_${param.id}`,
      headerName: param.nombre,
      editable: true,
      width: 120,
      cellEditor: 'agNumberCellEditor',
      headerTooltip: [
        param.valorMin != null ? `Mín: ${param.valorMin}` : null,
        param.valorMax != null ? `Máx: ${param.valorMax}` : null,
      ].filter(Boolean).join(' | ') || undefined,
      valueFormatter: (p: any) => p.value != null ? Number(p.value).toFixed(2) : '',
      cellStyle: (p: any) => {
        const v = p.value;
        if (v == null) return null;
        const n = Number(v);
        if (param.valorMin != null && n < param.valorMin) return { backgroundColor: '#ffeeba', color: '#856404' };
        if (param.valorMax != null && n > param.valorMax) return { backgroundColor: '#f8d7da', color: '#721c24' };
        return null;
      },
      valueSetter: (p: any) => {
        p.data[`param_${param.id}`] = p.newValue ?? null;
        p.data.__modified = true; return true;
      },
    }));

    const [colFecha, colHora, colFaseFe, colMatPrima, colComentarios] = fixed;
    this.colDefs = [colFecha, colHora, colFaseFe, ...paramCols, colMatPrima, colComentarios];
  }

  buildRowData(mediciones: any[], notify = false) {
    const mapped = mediciones.map((m: any) => {
      const row: any = {
        id: m.id, fecha: m.fecha, hora: m.hora,
        faseFe: m.faseFe ?? '',
        __isNew: false, __modified: false,
      };
      for (const param of this.params) {
        const val = (m.valores ?? []).find((v: any) => v.idParamCatalog === param.id);
        row[`param_${param.id}`] = val?.valor ?? null;
      }
      return row;
    });
    this.originalRowData = JSON.parse(JSON.stringify(mapped));
    this.rowData = [...mapped];
    if (this.gridApi && !this.gridApi.isDestroyed())
      this.gridApi.setGridOption('rowData', this.rowData);
    if (notify && this.idMoliendaParams != null)
      this.onCountChanged?.(this.idMoliendaParams, mapped.length);
  }

  onGridReady(e: GridReadyEvent) {
    this.gridApi = e.api;
    if (this.rowData.length) this.gridApi.setGridOption('rowData', this.rowData);
  }

  onSelectionChanged(e: any) {
    const nodes = e.api.getSelectedNodes();
    this.selectedRow = nodes.length ? nodes[0].data : null;
  }

  onCellValueChanged(e: any) {
    this.hasChanges = true;
    if (e.colDef?.field?.startsWith('param_'))
      this.gridApi?.refreshCells({ rowNodes: [e.node], force: true });
  }

  addRow() {
    const today = new Date();
    const fecha = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const hora = `${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')}:00`;
    const newRow: any = {
      id: null, __tempId: `new_${Date.now()}`,
      __isNew: true, __modified: false,
      fecha, hora, faseFe: '',
    };
    for (const p of this.params) newRow[`param_${p.id}`] = null;
    this.rowData = [newRow, ...this.rowData];
    this.hasChanges = true;
    if (this.gridApi) {
      this.gridApi.setGridOption('rowData', this.rowData);
      setTimeout(() => this.gridApi.startEditingCell({ rowIndex: 0, colKey: 'fecha' }), 50);
    }
  }

  // ── Cerrar entrada de medición → enviar OH a Cantidad producida del bloque ──

  async closeEntry(row: any, cellParams: any) {
    if (row.__cerrado || !row.id) return;
    const ohParam = this.params.find(p => (p.nombre ?? '').trim().toUpperCase() === 'OH');
    if (!ohParam) {
      alerts.basicAlert('Sin parámetro OH', 'No hay un parámetro "OH" configurado para esta materia prima.', 'warning');
      return;
    }
    const rawOh = row[`param_${ohParam.id}`];
    if (rawOh == null) {
      alerts.basicAlert('Falta OH', 'Captura el valor de OH antes de cerrar la entrada.', 'warning');
      return;
    }
    const ohValue = Number(rawOh);
    if (!this.idArticulo) return;

    const idCompany = this.signalsService.getRootSelectedBySidebar()();
    if (!idCompany) return;

    try {
      const ohBloques = await lastValueFrom(this.productionService.getOhBloqueByCompany(idCompany)).catch(() => [] as any[]);

      for (const ohBloque of (ohBloques ?? [])) {
        let bloqueConfigs: { id: number; enabled: boolean; ohMin: number | null; ohMax: number | null }[] = [];
        try { bloqueConfigs = JSON.parse(ohBloque.bloqueIds ?? '[]'); } catch { continue; }

        const matchingBloqueIds = bloqueConfigs
          .filter(b => b.enabled && b.ohMin != null && b.ohMax != null && ohValue >= b.ohMin! && ohValue <= b.ohMax!)
          .map(b => b.id);
        if (!matchingBloqueIds.length) continue;

        const productos = await lastValueFrom(
          this.productionService.getOhBloqueProductosByOhBloque(ohBloque.id)
        ).catch(() => [] as any[]);

        const entry = (productos ?? []).find((pr: any) =>
          matchingBloqueIds.includes(pr.idBloqueEf) && pr.idProducto === this.idArticulo && pr.cantidad != null
        );

        if (entry) {
          await lastValueFrom(this.productionService.updateOhBloqueProductoCantidadProducida(entry.id, ohValue));
          row.__cerrado = true;
          this.gridApi?.refreshCells({ rowNodes: [cellParams?.node].filter(Boolean), columns: ['cerrarEntrada'], force: true });
          alerts.reqSuccessToast('Entrada cerrada', 'OH enviado a Cantidad producida del bloque.');
          return;
        }
      }

      alerts.basicAlert('Sin bloque coincidente', 'No se encontró un bloque habilitado con este producto para el OH capturado.', 'warning');
    } catch (e) {
      console.error('Error cerrando entrada:', e);
      alerts.reqErrorToast('Error al cerrar entrada');
    }
  }

  hasChildChanges(): boolean {
    return this.rowData.some(r => r.__matPrimaHasChanges?.() || !!r.__matPrimaHasDirty);
  }

  async saveChanges() {
    if (!this.idMoliendaParams) return;
    // Descartar filas en blanco (sin fecha ni hora)
    this.rowData = this.rowData.filter(r => !(r.__isNew && !r.fecha && !r.hora));
    const toDto = (row: any) => ({
      idMoliendaParams: this.idMoliendaParams!,
      fecha: row.fecha, hora: row.hora,
      faseFe: row.faseFe || undefined,
      valores: this.params.map(p => ({
        idParamCatalog: p.id,
        valor: row[`param_${p.id}`] ?? undefined,
      })),
    });
    try {
      for (const row of this.rowData.filter(r => r.__isNew))
        await lastValueFrom(this.productionService.createMoliendaMedicion(toDto(row)));
      for (const row of this.rowData.filter(r => r.__modified && !r.__isNew))
        await lastValueFrom(this.productionService.updateMoliendaMedicion(row.id, toDto(row)));

      // Guardar tablas hijas (mat prima por medición)
      for (const row of this.rowData) {
        const dirty = row.__matPrimaHasChanges?.() || !!row.__matPrimaHasDirty;
        if (dirty && row.__matPrimaSave) await row.__matPrimaSave();
      }

      this.hasChanges = false;
      const mediciones = await lastValueFrom(
        this.productionService.getMoliendaMedicionesByParams(this.idMoliendaParams!)
      ).catch(() => [] as any[]);
      this.buildRowData(mediciones as any[], true);
    } catch (e) {
      console.error('Error guardando mediciones:', e);
      alerts.reqErrorToast('Error al guardar');
    }
  }

  revert() {
    this.rowData = JSON.parse(JSON.stringify(this.originalRowData));
    this.hasChanges = false;
    this.selectedRow = null;
    if (this.gridApi) this.gridApi.setGridOption('rowData', this.rowData);
  }

  async deleteRow() {
    if (!this.selectedRow) return;
    if (this.selectedRow.__isNew) {
      this.rowData = this.rowData.filter(r => r !== this.selectedRow);
      this.selectedRow = null;
      this.hasChanges = this.rowData.some(r => r.__isNew || r.__modified);
      if (this.gridApi) this.gridApi.setGridOption('rowData', this.rowData);
      return;
    }
    try {
      await lastValueFrom(this.productionService.deleteMoliendaMedicion(this.selectedRow.id));
      this.rowData = this.rowData.filter(r => r.id !== this.selectedRow!.id);
      this.originalRowData = this.originalRowData.filter(r => r.id !== this.selectedRow!.id);
      this.selectedRow = null;
      if (this.gridApi) this.gridApi.setGridOption('rowData', this.rowData);
      if (this.idMoliendaParams != null)
        this.onCountChanged?.(this.idMoliendaParams, this.rowData.length);
    } catch (e) {
      console.error('Error eliminando medición:', e);
      alerts.reqErrorToast('Error al eliminar');
    }
  }
}
