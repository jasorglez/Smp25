import { CommonModule, CurrencyPipe } from '@angular/common';
import { Component, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { CellValueChangedEvent, ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import * as XLSX from 'xlsx';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { alerts } from 'app/helpers/alerts';
import { SignalsService } from 'app/services/signals.service';
import { SubcontractProgramService } from 'app/services/subcontract-program.service';
import { SubcontractorContextService } from 'app/services/subcontractor-context.service';

@Component({
  selector: 'app-subcontract-estimates',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, CurrencyPipe],
  templateUrl: './subcontract-estimates.component.html',
  styleUrl: './subcontract-estimates.component.scss'
})
export class SubcontractEstimatesComponent {
  private programsService = inject(SubcontractProgramService);
  private signals = inject(SignalsService);
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
