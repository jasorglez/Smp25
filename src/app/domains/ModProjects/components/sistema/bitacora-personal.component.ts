import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef } from 'ag-grid-enterprise';
import { BitacoraBaseComponent, BITACORA_STYLES, fmtDate } from './bitacora-base.component';
import { alerts } from 'app/helpers/alerts';
import { CatalogadmonService } from 'app/services/catalogadmon.service';
import { EmployeesService } from 'app/services/employees.service';
import { RootService } from 'app/services/root.service';
import { Base64EncodeService } from 'app/services/base64encode.service';
import { TrackingService } from 'app/services/tracking.service';
import { lastValueFrom } from 'rxjs';
import pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';
(pdfMake as any).vfs = (pdfFonts as any).pdfMake?.vfs ?? (pdfFonts as any).default?.pdfMake?.vfs;

const NAVY  = '#003366';
const BLUE  = '#1a5a9a';
const LBLUE = '#e8f0f8';
const WHITE = '#ffffff';
const ALT   = '#f4f7fb';
const GRAY  = '#888888';

const TBL_LAYOUT = {
  hLineWidth: (i: number, node: any) => (i === 0 || i === node.table.body.length) ? 0.8 : (i === 1 ? 0.8 : 0.3),
  vLineWidth: () => 0.3,
  hLineColor: (i: number, node: any) => (i === 0 || i === node.table.body.length || i === 1) ? NAVY : '#cccccc',
  vLineColor: () => '#cccccc',
  paddingLeft: () => 6, paddingRight: () => 6, paddingTop: () => 3, paddingBottom: () => 3,
};
const hCell = (txt: string, align: 'left'|'center'|'right' = 'left'): any =>
  ({ text: txt, fontSize: 8, bold: true, color: WHITE, fillColor: BLUE, alignment: align });
const dCell = (txt: string, alt: boolean, align: 'left'|'center'|'right' = 'left'): any =>
  ({ text: String(txt ?? ''), fontSize: 8, fillColor: alt ? ALT : WHITE, alignment: align });

@Component({
  selector: 'app-bitacora-personal',
  standalone: true,
  imports: [CommonModule, AgGridModule],
  template: `
<div class="detail-grid-container">
  <div class="detail-actions d-flex align-items-center mb-2 gap-1">
    <button class="btn btn-outline-secondary btn-sm" (click)="closeDetail()">
      <i class="bi bi-x-lg"></i>
    </button>
    <button class="btn btn-primary btn-sm" (click)="addRow()">
      <i class="bi bi-plus-lg"></i>
    </button>
    <button class="btn btn-warning btn-sm" (click)="discardChanges()">
      <i class="bi bi-arrow-counterclockwise"></i>
    </button>
    <button class="btn btn-danger btn-sm" (click)="deleteSelected()">
      <i class="bi bi-trash"></i>
    </button>
    <button class="btn btn-success btn-sm position-relative" (click)="saveChanges()">
      <i class="bi bi-floppy"></i>
      <span class="position-absolute top-0 start-100 translate-middle p-2 bg-danger border border-light rounded-circle"
        *ngIf="hasUnsavedChanges"></span>
    </button>
    <button class="btn btn-danger btn-sm" (click)="generarPdf()" title="Reporte PDF Personal">
      <i class="bi bi-file-earmark-pdf-fill"></i>
    </button>
  </div>
  <ag-grid-angular
    class="ag-theme-quartz small-text-ag-grid"
    [rowData]="rowData"
    [columnDefs]="colDefs"
    [defaultColDef]="defaultColDef"
    [gridOptions]="gridOptions"
    (gridReady)="onGridReady($event)"
    (cellValueChanged)="onCellValueChanged($event)"
    (cellEditingStopped)="onCellEditingStopped($event)"
    (cellClicked)="onCellClicked($event)"
    (cellDoubleClicked)="onCellDoubleClicked($event)"
    (selectionChanged)="onSelectionChanged($event)"
    style="height: 300px; width: 100%;">
  </ag-grid-angular>
</div>`,
  styles: BITACORA_STYLES,
})
export class BitacoraPersonalComponent extends BitacoraBaseComponent {
  private catalogAdmonService = inject(CatalogadmonService);
  private employeesService    = inject(EmployeesService);
  private rootService         = inject(RootService);
  private base64Service       = inject(Base64EncodeService);
  private trackingService     = inject(TrackingService);

  readonly bitacoraType  = 'personal';
  readonly typeNoteValue = 'PERSONAL';
  readonly editableCols  = ['position', 'empleado', 'quantity', 'start', 'end', 'asistencia', 'description'];
  readonly requiredFields = [
    { field: 'position', label: 'Puesto'   },
    { field: 'quantity', label: 'Cantidad' },
  ];

  asistenciaValues: string[] = [];
  empleadosCatalog: any[]    = [];
  empleadosValues:  string[] = [];

  protected override onLoadCatalogs(idRoot: number): void {
    this.catalogAdmonService.getCatalogs(idRoot, 'ASISTENCIA').subscribe({
      next: (r: any[]) => { this.asistenciaValues = r.map(a => a.description); },
      error: () => {},
    });
    this.employeesService.getEmployees(-idRoot).subscribe({
      next: (r: any) => {
        this.empleadosCatalog = Array.isArray(r) ? r : (r?.data ?? []);
        this.empleadosValues  = this.empleadosCatalog.map((e: any) => e.name);
      },
      error: () => {},
    });
  }

  get colDefs(): ColDef[] {
    return [
      { headerName: '#', width: 45, valueGetter: (p) => p.node!.rowIndex! + 1, pinned: 'left', editable: false },
      {
        field: 'position', headerName: 'Puesto', editable: true, width: 220,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: () => ({ values: this.posicionesValues }),
        valueFormatter: (p) => p.value || '',
      },
      {
        field: 'empleado', headerName: 'Empleado', editable: true, width: 220,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: () => ({ values: this.empleadosValues }),
        valueGetter: (p: any) => p.data?.empleado ?? '',
        valueSetter: (p: any) => { p.data.empleado = p.newValue ?? null; return true; },
      },
      { field: 'quantity', headerName: 'Cantidad', editable: true, width: 100, type: 'numericColumn' },
      { field: 'start',    headerName: 'Inicio',   editable: true, width: 120 },
      { field: 'end',      headerName: 'Término',  editable: true, width: 120 },
      {
        field: 'asistencia', headerName: 'Asistencia', editable: true, width: 150,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: () => ({ values: this.asistenciaValues }),
        valueFormatter: (p) => p.value || '',
      },
    ];
  }

  override addRow(): void {
    const newRow = {
      id: `temp_${this.tempIdCounter++}`,
      idReporte: this.reportData?.id,
      date: this.reportData?.date ? String(this.reportData.date).substring(0, 10) : new Date().toISOString().split('T')[0],
      empleado: null,
      quantity: 1,
      start: null,
      end: null,
      asistencia: null,
      description: null,
      active: true, __isNew: true, __modified: false,
    };
    this.rowData = [newRow, ...this.rowData];
    this.hasUnsavedChanges = true;
    setTimeout(() => {
      this.gridApi?.setGridOption('rowData', this.rowData);
      this.gridApi?.startEditingCell({ rowIndex: 0, colKey: this.editableCols[0] });
    }, 50);
  }

  override onCellValueChanged(event: any): void {
    if (event.colDef.field === 'quantity') {
      const qty = Number(event.newValue);
      if (!qty || qty < 1) {
        event.data.quantity = 1;
        this.gridApi.refreshCells({ rowNodes: [event.node], columns: ['quantity'], force: true });
      }
    }

    if (event.colDef.field === 'position' && event.newValue) {
      const duplicateExists = this.rowData.some((row, index) =>
        index !== event.rowIndex &&
        row.position === event.newValue
      );

      if (duplicateExists) {
        alerts.basicAlert(
          'Puesto duplicado',
          `El puesto "${event.newValue}" ya está agregado. No se permiten puestos repetidos.`,
          'warning'
        );
        event.node.setDataValue('position', event.oldValue);
        return;
      }
    }

    if (!event.data.__isNew) event.data.__modified = true;
    this.hasUnsavedChanges = true;
  }

  async generarPdf(): Promise<void> {
    const idRoot = this.signalsService.getRootSelectedBySidebar()();
    if (!idRoot) return;

    const safe = async (obs: any) => { try { return await lastValueFrom(obs); } catch { return null; } };
    const root: any = await safe(this.rootService.getRootbyId(idRoot));

    const tryB64 = async (url: string): Promise<string | null> => {
      try { return await this.base64Service.convertImageToBase64(url); } catch { return null; }
    };

    const logoB64  = root?.picture  ? await tryB64(root.picture)  : null;
    const logo2B64 = root?.picture2 ? await tryB64(root.picture2) : logoB64;
    const wmB64    = root?.picture3 ? await tryB64(root.picture3)  : null;

    const imgs: Record<string, string> = {};
    if (logoB64)  imgs['logo']  = logoB64;
    if (logo2B64) imgs['logo2'] = logo2B64;
    if (wmB64)    imgs['wm']    = wmB64;

    const fecha    = fmtDate(this.reportData?.date);
    const compName = root?.name || '';

    // ── Header logos ──────────────────────────────────────────────────────
    const logoLeft  = logoB64  ? { image: 'logo',  width: 80, alignment: 'left'  as const } : { text: compName, bold: true, fontSize: 11 };
    const logoRight = logo2B64 ? { image: 'logo2', width: 80, alignment: 'right' as const } : { text: '' };

    const header = {
      table: {
        widths: ['*', '*', '*'],
        body: [[
          logoLeft,
          { text: compName, bold: true, fontSize: 12, color: NAVY, alignment: 'center' as const, margin: [0, 10, 0, 0] },
          logoRight,
        ]],
      },
      layout: 'noBorders', margin: [0, 0, 0, 8],
    };

    // ── Título ────────────────────────────────────────────────────────────
    const titulo = {
      table: { widths: ['*'], body: [[{
        text: `BITÁCORA DE PERSONAL — ${fecha}`,
        color: WHITE, fillColor: NAVY, bold: true, fontSize: 11,
        alignment: 'center' as const, margin: [10, 7, 10, 7],
      }]] },
      layout: 'noBorders', margin: [0, 0, 0, 10],
    };

    // ── Tabla de datos ────────────────────────────────────────────────────
    const rows = this.rowData;
    const bodyRows: any[][] = rows.length
      ? rows.map((r, i) => [
          dCell(r.empleado   ?? '', i % 2 === 1),
          dCell(r.position   ?? '', i % 2 === 1),
          dCell(String(r.quantity ?? ''), i % 2 === 1, 'center'),
          dCell(r.asistencia ?? '', i % 2 === 1),
        ])
      : [[{ text: 'Sin registros', fontSize: 8, color: GRAY, colSpan: 4, alignment: 'center', italics: true, margin: [0, 5, 0, 5] }, '', '', '']];

    const tabla = {
      table: {
        widths: ['*', 160, 60, 100],
        body: [
          [hCell('EMPLEADO'), hCell('POSICIÓN'), hCell('CANT.', 'center'), hCell('ASISTENCIA')],
          ...bodyRows,
        ],
      },
      layout: TBL_LAYOUT,
    };

    // ── Marca de agua ─────────────────────────────────────────────────────
    const background = wmB64
      ? (currentPage: number, pageSize: any) => ({
          image: 'wm', width: 400,
          absolutePosition: { x: (pageSize.width - 400) / 2, y: (pageSize.height - 400) / 2 },
          opacity: 0.05,
        })
      : undefined;

    const docDef: any = {
      pageSize: 'LETTER', pageOrientation: 'portrait',
      pageMargins: [40, 50, 40, 40],
      images: imgs,
      ...(background ? { background } : {}),
      content: [header, titulo, tabla],
      defaultStyle: { font: 'Roboto', fontSize: 8 },
    };

    this.trackingService.addLog(this.trackingService.getnameComp(), 'Generó PDF bitácora personal', 'Proyectos / Bitácora', this.trackingService.getEmail());
    pdfMake.createPdf(docDef).open();
  }

  protected override remapFromDb(item: any): any {
    return { ...item, empleado: item.descriptionconcept ?? null, asistencia: item.supervisor ?? null };
  }

  buildPayload(item: any): any {
    return {
      ...this.basePayload(item),
      description:       item.description?.trim() || null,
      position:          item.position     ?? null,
      start:             item.start        ?? null,
      end:               item.end          ?? null,
      supervisor:        item.asistencia   ?? null,
      descriptionconcept: item.empleado    ?? null,
      idResource:        item.idResource   ?? null,
    };
  }
}
