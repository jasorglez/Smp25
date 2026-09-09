import { CommonModule, CurrencyPipe } from '@angular/common';
import { Component, effect, inject, OnDestroy } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { CellValueChangedEvent, ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import * as XLSX from 'xlsx';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { alerts } from 'app/helpers/alerts';
import { SignalsService } from 'app/services/signals.service';
import { SubcontractProgramService } from 'app/services/subcontract-program.service';
import { SubcontractorContextService } from 'app/services/subcontractor-context.service';

(pdfMake as any).vfs = (pdfFonts as any).pdfMake?.vfs || (pdfFonts as any).default?.pdfMake?.vfs;

@Component({
  selector: 'app-subcontract-estimates',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, CurrencyPipe],
  templateUrl: './subcontract-estimates.component.html',
  styleUrl: './subcontract-estimates.component.scss'
})
export class SubcontractEstimatesComponent implements OnDestroy {
  private programsService = inject(SubcontractProgramService);
  private signals = inject(SignalsService);
  private sanitizer = inject(DomSanitizer);
  readonly context = inject(SubcontractorContextService);

  readonly AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;
  programs: any[] = [];
  rows: any[] = [];
  selectedProgramId = 0;
  idRoot = 0;
  loading = false;
  allowUnreported = false;
  estimateNumber = 1;
  dateStart = this.isoDate(new Date());
  dateEnd = this.isoDate(new Date());
  program: any = null;
  showPdfPreview = false;
  pdfPreviewUrl: SafeResourceUrl | null = null;
  private pdfObjectUrl = '';
  private pdfDefinition: any = null;
  private gridApi?: GridApi;
  private selectedProviderId = 0;

  readonly defaultColDef: ColDef = {
    sortable: true,
    filter: true,
    resizable: true,
    minWidth: 100
  };
  readonly autoGroupColumnDef: ColDef = {
    headerName: 'FASE',
    minWidth: 220,
    flex: 1,
    cellRendererParams: { suppressCount: false }
  };
  readonly gridOptions: any = {
    animateRows: true,
    groupDefaultExpanded: 1,
    groupDisplayType: 'singleColumn',
    headerHeight: 42,
    rowHeight: 38,
    stopEditingWhenCellsLoseFocus: true
  };
  readonly columnDefs: ColDef[] = [
    { field: 'phase', headerName: 'Fase', rowGroup: true, hide: true },
    { field: 'subphase', headerName: 'Subfase', minWidth: 140, flex: 1 },
    { field: 'concept', headerName: 'Concepto', minWidth: 320, flex: 2.4, tooltipField: 'concept' },
    { field: 'unit', headerName: 'Unidad', width: 90, maxWidth: 100 },
    { field: 'contractQuantity', headerName: 'Contratado', width: 120, type: 'numericColumn', valueFormatter: p => this.quantity(p.value) },
    { field: 'previousQuantity', headerName: 'Acum. anterior', width: 135, type: 'numericColumn', valueFormatter: p => this.quantity(p.value) },
    {
      field: 'reportedQuantity', headerName: 'Reportado', width: 120, type: 'numericColumn',
      valueFormatter: p => this.quantity(p.value),
      cellStyle: { backgroundColor: '#edf5fb', color: '#1d587d' }
    },
    {
      field: 'estimateQuantity', headerName: 'Esta estimación', width: 145, type: 'numericColumn',
      editable: () => this.allowUnreported,
      valueParser: p => this.number(p.newValue),
      valueFormatter: p => this.quantity(p.value),
      cellStyle: p => ({ backgroundColor: this.allowUnreported ? '#fff8dc' : '#f2f2f2', fontWeight: '600' })
    },
    { field: 'unitPrice', headerName: 'P.U.', width: 125, type: 'numericColumn', valueFormatter: p => this.currency(p.value) },
    {
      colId: 'amount', headerName: 'Importe', width: 140, type: 'numericColumn',
      valueGetter: p => this.number(p.data?.estimateQuantity) * this.number(p.data?.unitPrice),
      valueFormatter: p => this.currency(p.value),
      cellStyle: { fontWeight: '700', color: '#176a43' }
    },
    {
      colId: 'balance', headerName: 'Saldo cantidad', width: 135, type: 'numericColumn',
      valueGetter: p => Math.max(0, this.number(p.data?.contractQuantity) - this.number(p.data?.previousQuantity) - this.number(p.data?.estimateQuantity)),
      valueFormatter: p => this.quantity(p.value)
    }
  ];

  constructor() {
    effect(() => {
      const idRoot = Number(this.signals.getRootSelectedBySidebar()()) || 0;
      const providerId = Number(this.context.selected()?.id) || 0;
      if (this.idRoot === idRoot && this.selectedProviderId === providerId && this.programs.length) return;
      this.idRoot = idRoot;
      this.selectedProviderId = providerId;
      this.programs = [];
      this.rows = [];
      this.program = null;
      this.selectedProgramId = 0;
      if (idRoot && providerId) this.loadPrograms(providerId);
    });
  }

  ngOnDestroy() { this.releasePdfPreview(); }

  loadPrograms(providerId: number) {
    this.loading = true;
    this.programsService.get(this.idRoot, providerId).subscribe({
      next: (data: any) => {
        this.programs = Array.isArray(data) ? data : (data?.data || []);
        this.loading = false;
        if (this.programs.length) {
          this.selectedProgramId = Number(this.programs[0].id);
          this.selectProgram(this.selectedProgramId);
        }
      },
      error: () => {
        this.programs = [];
        this.rows = [];
        this.loading = false;
        alerts.basicAlert('Estimaciones', 'No fue posible consultar los programas del subcontratista.', 'error');
      }
    });
  }

  selectProgram(id: number) {
    this.selectedProgramId = Number(id) || 0;
    this.rows = [];
    this.program = null;
    if (!this.selectedProgramId) return;
    this.loading = true;
    this.programsService.getById(this.selectedProgramId).subscribe({
      next: (data: any) => {
        this.program = data?.program || null;
        this.rows = (data?.items || []).map((item: any) => ({
          idProgramItem: item.id,
          phase: item.phase || 'SIN FASE',
          subphase: item.subphase || '',
          concept: item.concept || '',
          unit: item.unit || '',
          contractQuantity: this.number(item.quantity),
          unitPrice: this.number(item.unitPrice),
          previousQuantity: 0,
          reportedQuantity: 0,
          estimateQuantity: 0
        }));
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        alerts.basicAlert('Estimaciones', 'No fue posible cargar los conceptos del programa.', 'error');
      }
    });
  }

  onGridReady(event: GridReadyEvent) { this.gridApi = event.api; }
  onCellValueChanged(_: CellValueChangedEvent) {
    this.rows = [...this.rows];
    this.gridApi?.refreshCells({ columns: ['amount', 'balance'], force: true });
  }
  onManualModeChanged() { this.gridApi?.refreshCells({ force: true }); }
  useReportedQuantities() {
    this.rows = this.rows.map(row => ({ ...row, estimateQuantity: this.number(row.reportedQuantity) }));
  }

  get contractTotal(): number {
    return this.rows.reduce((sum, row) => sum + this.number(row.contractQuantity) * this.number(row.unitPrice), 0);
  }
  get previousTotal(): number {
    return this.rows.reduce((sum, row) => sum + this.number(row.previousQuantity) * this.number(row.unitPrice), 0);
  }
  get estimateTotal(): number {
    return this.rows.reduce((sum, row) => sum + this.number(row.estimateQuantity) * this.number(row.unitPrice), 0);
  }
  get accumulatedTotal(): number { return this.previousTotal + this.estimateTotal; }
  get balanceTotal(): number { return this.contractTotal - this.accumulatedTotal; }
  get progress(): number { return this.contractTotal ? this.accumulatedTotal / this.contractTotal : 0; }

  previewPdf() {
    if (!this.validateEstimate()) return;
    this.releasePdfPreview();
    this.pdfDefinition = this.buildPdfDefinition();
    pdfMake.createPdf(this.pdfDefinition).getBlob((blob: Blob) => {
      this.pdfObjectUrl = URL.createObjectURL(blob);
      this.pdfPreviewUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.pdfObjectUrl);
      this.showPdfPreview = true;
    });
  }

  downloadPdf() {
    if (!this.pdfDefinition) this.pdfDefinition = this.buildPdfDefinition();
    const provider = this.context.selected()?.name || 'Subcontratista';
    const tower = this.towerName();
    pdfMake.createPdf(this.pdfDefinition).download(`Estimacion_${this.safeName(provider)}_${this.safeName(tower)}_${this.estimateNumber}.pdf`);
  }

  closePdfPreview() {
    this.showPdfPreview = false;
    this.releasePdfPreview();
  }

  private buildPdfDefinition(): any {
    const provider = this.context.selected()?.name || 'SUBCONTRATISTA';
    const tower = this.towerName();
    const detailBody: any[] = [[
      { text: 'SUBFASE', style: 'tableHeader' },
      { text: 'CONCEPTO', style: 'tableHeader' },
      { text: 'UNIDAD', style: 'tableHeader' },
      { text: 'CONTRATADO', style: 'tableHeader' },
      { text: 'ACUM. ANT.', style: 'tableHeader' },
      { text: 'ESTA EST.', style: 'tableHeader' },
      { text: 'P.U.', style: 'tableHeader' },
      { text: 'IMPORTE', style: 'tableHeader' }
    ]];
    const phases = new Map<string, any[]>();
    this.rows.forEach(row => {
      const phase = String(row.phase || 'SIN FASE').trim().toUpperCase();
      if (!phases.has(phase)) phases.set(phase, []);
      phases.get(phase)!.push(row);
    });
    phases.forEach((items, phase) => {
      detailBody.push([
        { text: `FASE: ${phase} (${items.length} conceptos)`, colSpan: 8, style: 'phase' },
        {}, {}, {}, {}, {}, {}, {}
      ]);
      items.forEach(item => detailBody.push([
        item.subphase || '',
        item.concept || '',
        item.unit || '',
        { text: this.quantity(item.contractQuantity), alignment: 'right' },
        { text: this.quantity(item.previousQuantity), alignment: 'right' },
        { text: this.quantity(item.estimateQuantity), alignment: 'right', bold: true },
        { text: this.currency(item.unitPrice), alignment: 'right' },
        { text: this.currency(this.number(item.estimateQuantity) * this.number(item.unitPrice)), alignment: 'right', bold: true }
      ]));
    });
    detailBody.push([
      { text: 'TOTAL DE ESTA ESTIMACIÓN', colSpan: 7, alignment: 'right', bold: true, fillColor: '#e8f4ed', margin: [2, 4] },
      {}, {}, {}, {}, {}, {},
      { text: this.currency(this.estimateTotal), alignment: 'right', bold: true, color: '#176a43', fillColor: '#e8f4ed', margin: [2, 4] }
    ]);

    return {
      pageSize: 'LETTER',
      pageOrientation: 'landscape',
      pageMargins: [28, 30, 28, 30],
      header: (currentPage: number) => currentPage > 1 ? { text: `${provider} · ${tower} · Estimación ${this.estimateNumber}`, alignment: 'right', margin: [0, 12, 28, 0], fontSize: 7, color: '#6d7f8b' } : null,
      footer: (currentPage: number, pageCount: number) => ({ text: `Página ${currentPage} de ${pageCount}`, alignment: 'center', margin: [0, 8, 0, 0], fontSize: 7, color: '#7a8993' }),
      content: [
        { text: 'ESTIMACIÓN DE SUBCONTRATISTA', style: 'title' },
        { text: provider, style: 'contractor' },
        {
          columns: [
            { stack: [{ text: 'PROGRAMA / TORRE', style: 'label' }, { text: this.program?.projectName || tower, style: 'value' }] },
            { stack: [{ text: 'ESTIMACIÓN', style: 'label' }, { text: String(this.estimateNumber), style: 'value' }], alignment: 'center' },
            { stack: [{ text: 'PERIODO', style: 'label' }, { text: `${this.displayDate(this.dateStart)} al ${this.displayDate(this.dateEnd)}`, style: 'value' }], alignment: 'right' }
          ],
          margin: [0, 16, 0, 18]
        },
        {
          table: {
            widths: ['*', '*', '*'],
            body: [
              [this.summaryCell('IMPORTE DEL PROGRAMA', this.contractTotal), this.summaryCell('ACUMULADO ANTERIOR', this.previousTotal), this.summaryCell('ESTA ESTIMACIÓN', this.estimateTotal, true)],
              [this.summaryCell('ACUMULADO TOTAL', this.accumulatedTotal), this.summaryCell('SALDO POR EJERCER', this.balanceTotal), this.summaryCell('AVANCE TOTAL', this.progress, false, true)]
            ]
          },
          layout: { hLineColor: '#cbd8e0', vLineColor: '#cbd8e0', paddingLeft: () => 12, paddingRight: () => 12, paddingTop: () => 10, paddingBottom: () => 10 }
        },
        { text: 'RESUMEN DE ESTIMACIÓN', style: 'section', margin: [0, 20, 0, 8] },
        {
          table: {
            widths: ['*', 130],
            body: [
              [{ text: 'Importe bruto', bold: true }, { text: this.currency(this.estimateTotal), alignment: 'right' }],
              [{ text: 'Importe neto de esta estimación', bold: true, fillColor: '#e8f4ed' }, { text: this.currency(this.estimateTotal), alignment: 'right', bold: true, color: '#176a43', fillColor: '#e8f4ed' }]
            ]
          },
          layout: 'lightHorizontalLines'
        },
        { text: 'DETALLE DE CONCEPTOS', style: 'section', pageBreak: 'before', margin: [0, 0, 0, 8] },
        { text: `CONTRATISTA: ${provider}`, style: 'providerGroup' },
        {
          table: { headerRows: 1, widths: [70, '*', 38, 54, 54, 54, 62, 68], body: detailBody },
          layout: { hLineColor: '#d7e0e6', vLineColor: '#d7e0e6', paddingLeft: () => 3, paddingRight: () => 3, paddingTop: () => 3, paddingBottom: () => 3 },
          fontSize: 6.8
        }
      ],
      styles: {
        title: { fontSize: 18, bold: true, alignment: 'center', color: '#173f67', margin: [0, 8, 0, 5] },
        contractor: { fontSize: 13, bold: true, alignment: 'center', color: '#176a43' },
        label: { fontSize: 7, bold: true, color: '#6d7f8b' },
        value: { fontSize: 10, bold: true, color: '#173f67', margin: [0, 3, 0, 0] },
        section: { fontSize: 10, bold: true, color: '#173f67' },
        providerGroup: { fontSize: 9, bold: true, color: '#ffffff', fillColor: '#173f67', margin: [6, 5, 6, 5] },
        phase: { fontSize: 7.5, bold: true, color: '#173f67', fillColor: '#dcebf5', margin: [5, 3, 2, 3] },
        tableHeader: { fontSize: 6.5, bold: true, color: '#ffffff', fillColor: '#246b9b', alignment: 'center', margin: [1, 3] }
      },
      defaultStyle: { fontSize: 8 }
    };
  }

  private summaryCell(label: string, value: number, highlight = false, percent = false): any {
    return {
      stack: [
        { text: label, fontSize: 7, bold: true, color: '#6d7f8b' },
        { text: percent ? `${(value * 100).toFixed(2)}%` : this.currency(value), fontSize: 12, bold: true, color: highlight ? '#176a43' : '#173f67', margin: [0, 4, 0, 0] }
      ],
      fillColor: highlight ? '#e8f4ed' : '#f7fafc'
    };
  }

  private validateEstimate(): boolean {
    if (!this.context.selected() || !this.program || !this.rows.length) {
      alerts.basicAlert('Estimación', 'Selecciona un programa con conceptos.', 'warning');
      return false;
    }
    if (!this.dateStart || !this.dateEnd || this.dateStart > this.dateEnd) {
      alerts.basicAlert('Periodo', 'Captura un rango de fechas válido.', 'warning');
      return false;
    }
    return true;
  }

  private releasePdfPreview() {
    if (this.pdfObjectUrl) URL.revokeObjectURL(this.pdfObjectUrl);
    this.pdfObjectUrl = '';
    this.pdfPreviewUrl = null;
  }

  private towerName(): string {
    return String(this.program?.projectName || 'PROYECTO').replace(/^EST\.\s*TORRE\s*/i, '');
  }

  private displayDate(value: string): string {
    if (!value) return '';
    const [year, month, day] = value.split('-');
    return `${day}/${month}/${year}`;
  }

  private safeName(value: string): string { return value.replace(/[^a-zA-Z0-9_-]+/g, '_'); }

  exportExcel() {
    const provider = this.context.selected();
    if (!provider || !this.program || !this.rows.length) {
      alerts.basicAlert('Estimación', 'Selecciona un programa con conceptos.', 'warning');
      return;
    }

    const tower = String(this.program.projectName || 'PROYECTO').replace(/^EST\.\s*TORRE\s*/i, '');
    const coverRows: any[][] = [
      ['', '', 'CARÁTULA DE ESTIMACIÓN DE SUBCONTRATISTA'],
      ['', '', 'OBRA:', this.program.projectName || ''],
      ['', '', 'CONTRATISTA:', provider.name],
      ['', '', 'PERIODO:', 'DEL', this.dateStart, 'AL', this.dateEnd],
      ['', '', 'FECHA DE ENTREGA:', this.dateEnd],
      [],
      ['', 'ESTADO DE CUENTA DEL PROGRAMA', '', '', '', '', 'TORRE:', tower],
      ['', '', '', '', '', '', 'No. ESTIMACIÓN:', this.estimateNumber],
      [],
      ['', 'IMPORTE TOTAL DEL PROGRAMA', '', '', this.contractTotal],
      ['', 'IMPORTE ACUMULADO ANTERIOR', '', '', this.previousTotal],
      ['', 'ESTA ESTIMACIÓN', '', '', this.estimateTotal],
      ['', 'IMPORTE ACUMULADO TOTAL', '', '', this.accumulatedTotal],
      ['', 'SALDO POR EJERCER', '', '', this.balanceTotal],
      [],
      ['', '% AVANCE HASTA ESTA ESTIMACIÓN', '', '', this.progress],
      ['', 'IMPORTE NETO', '', '', this.estimateTotal]
    ];
    const detailRows: any[][] = [
      ['', 'ESTIMACIÓN DE SUBCONTRATISTA', '', '', '', 'TORRE:', tower],
      ['', '', 'PROVEEDOR:', provider.name, '', 'ESTIMACIÓN No.:', this.estimateNumber],
      ['', '', 'PERIODO:', 'DEL', this.dateStart, 'AL', this.dateEnd],
      [],
      ['FASE', 'CONCEPTO', 'UNIDAD', 'PRESUPUESTO', 'P.U.', 'IMPORTE PRESUPUESTO', 'ACUM. ANTERIOR', 'ESTA ESTIMACIÓN', 'IMPORTE ESTIMACIÓN', 'ACUMULADO', 'SALDO']
    ];
    this.rows.forEach(row => detailRows.push([
      row.phase,
      row.concept,
      row.unit,
      this.number(row.contractQuantity),
      this.number(row.unitPrice),
      this.number(row.contractQuantity) * this.number(row.unitPrice),
      this.number(row.previousQuantity),
      this.number(row.estimateQuantity),
      this.number(row.estimateQuantity) * this.number(row.unitPrice),
      this.number(row.previousQuantity) + this.number(row.estimateQuantity),
      Math.max(0, this.number(row.contractQuantity) - this.number(row.previousQuantity) - this.number(row.estimateQuantity))
    ]));
    detailRows.push(['', 'TOTALES', '', '', '', this.contractTotal, '', '', this.estimateTotal, '', this.balanceTotal]);

    const workbook = XLSX.utils.book_new();
    const cover = XLSX.utils.aoa_to_sheet(coverRows);
    const detail = XLSX.utils.aoa_to_sheet(detailRows);
    cover['!cols'] = [{ wch: 3 }, { wch: 34 }, { wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 12 }, { wch: 20 }, { wch: 18 }];
    detail['!cols'] = [{ wch: 22 }, { wch: 48 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 16 }, { wch: 17 }, { wch: 19 }, { wch: 14 }, { wch: 14 }];
    cover['!merges'] = [XLSX.utils.decode_range('C1:H1'), XLSX.utils.decode_range('B7:E7')];
    detail['!merges'] = [XLSX.utils.decode_range('B1:E1')];
    this.applyFormats(cover, ['E10', 'E11', 'E12', 'E13', 'E14', 'E17']);
    if (cover['E16']) cover['E16'].z = '0.00%';
    for (let row = 6; row <= detailRows.length; row++) {
      ['E', 'F', 'I'].forEach(column => { const cell = detail[`${column}${row}`]; if (cell) cell.z = '$#,##0.00'; });
      ['D', 'G', 'H', 'J', 'K'].forEach(column => { const cell = detail[`${column}${row}`]; if (cell) cell.z = '#,##0.0000'; });
    }
    XLSX.utils.book_append_sheet(workbook, cover, `CARÁTULA ${tower}`.substring(0, 31));
    XLSX.utils.book_append_sheet(workbook, detail, `EST. ${tower}`.substring(0, 31));
    XLSX.writeFile(workbook, `Estimacion_${provider.name}_${tower}_${this.estimateNumber}.xlsx`);
  }

  private applyFormats(sheet: XLSX.WorkSheet, cells: string[]) {
    cells.forEach(address => { if (sheet[address]) sheet[address].z = '$#,##0.00'; });
  }
  private number(value: any): number {
    const clean = String(value ?? '').replace(/[$,\s]/g, '').replace(/[^0-9.-]/g, '');
    return Number(clean) || 0;
  }
  private quantity(value: any): string { return this.number(value).toLocaleString('es-MX', { maximumFractionDigits: 4 }); }
  private currency(value: any): string { return this.number(value).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }); }
  private isoDate(date: Date): string { return date.toISOString().substring(0, 10); }
}
