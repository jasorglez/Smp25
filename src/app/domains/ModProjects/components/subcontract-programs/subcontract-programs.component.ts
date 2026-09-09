import { CommonModule, CurrencyPipe } from '@angular/common';
import { Component, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { CellClickedEvent, ColDef, GridApi } from 'ag-grid-enterprise';
import * as XLSX from 'xlsx';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { alerts } from 'app/helpers/alerts';
import { MaterialsService } from 'app/services/materials.service';
import { SignalsService } from 'app/services/signals.service';
import { SubcontractProgramService } from 'app/services/subcontract-program.service';
import { SubcontractorContextService } from 'app/services/subcontractor-context.service';

(pdfMake as any).vfs = (pdfFonts as any).pdfMake?.vfs || (pdfFonts as any).default?.pdfMake?.vfs;

@Component({
  selector: 'app-subcontract-programs', standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe, AgGridModule],
  templateUrl: './subcontract-programs.component.html', styleUrl: './subcontract-programs.component.scss'
})
export class SubcontractProgramsComponent {
  private programsService = inject(SubcontractProgramService);
  private materialsService = inject(MaterialsService);
  private signals = inject(SignalsService);
  context = inject(SubcontractorContextService);
  providers: any[] = [];
  programs: any[] = [];
  items: any[] = [];
  sheets: string[] = [];
  workbook: XLSX.WorkBook | null = null;
  selectedProgramId = 0;
  idRoot = 0;
  loading = false;
  program: any = this.emptyProgram();
  private gridApi?: GridApi;
  readonly AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;
  readonly defaultColDef: ColDef = {
    sortable: true,
    filter: true,
    resizable: true,
    flex: 1,
    minWidth: 110
  };
  readonly autoGroupColumnDef: ColDef = {
    headerName: 'FASE',
    minWidth: 240,
    flex: 1.2,
    cellRendererParams: { suppressCount: false }
  };
  readonly gridOptions: any = {
    animateRows: true,
    groupDefaultExpanded: 1,
    groupDisplayType: 'singleColumn',
    headerHeight: 38,
    rowHeight: 38,
    stopEditingWhenCellsLoseFocus: true
  };
  readonly columnDefs: ColDef[] = [
    { field: 'phase', headerName: 'Fase', rowGroup: true, hide: true, editable: true },
    { field: 'subphase', headerName: 'Subfase', editable: true, minWidth: 150 },
    { field: 'concept', headerName: 'Concepto', editable: true, minWidth: 330, flex: 2.5, cellEditor: 'agLargeTextCellEditor', cellEditorPopup: true },
    { field: 'unit', headerName: 'Unidad', editable: true, width: 95, maxWidth: 110, flex: 0 },
    { field: 'quantity', headerName: 'Cantidad', editable: true, width: 120, flex: 0, type: 'numericColumn', valueParser: params => this.number(params.newValue) },
    { field: 'unitPrice', headerName: 'P.U.', editable: true, width: 135, flex: 0, type: 'numericColumn', valueParser: params => this.number(params.newValue), valueFormatter: params => this.currency(params.value) },
    { colId: 'amount', headerName: 'Importe', width: 145, flex: 0, type: 'numericColumn', valueGetter: params => this.number(params.data?.quantity) * this.number(params.data?.unitPrice), valueFormatter: params => this.currency(params.value) },
    { colId: 'delete', headerName: '', width: 58, maxWidth: 58, flex: 0, sortable: false, filter: false, editable: false, cellRenderer: () => '<button class="btn btn-sm btn-outline-danger" title="Borrar concepto"><i class="bi bi-trash"></i></button>' }
  ];

  constructor() {
    effect(() => {
      this.idRoot = Number(this.signals.getRootSelectedBySidebar()()) || 0;
      if (this.idRoot) this.loadCatalogs();
      const provider = this.context.selected();
      if (provider && !this.program.id) { this.program.idProvider = provider.id; this.program.providerName = provider.name; }
    });
  }

  emptyProgram() { return { id: 0, idRoot: this.idRoot, idProvider: null, providerName: '', idProject: null, projectName: '', name: 'Programa de trabajo por subcontratista', startDate: null, endDate: null }; }
  loadCatalogs() {
    this.materialsService.getProvidersxmaterials(this.idRoot).subscribe({ next: (data: any) => this.providers = data || [], error: () => this.providers = [] });
    this.loadPrograms();
  }
  loadPrograms() {
    const providerId = Number(this.context.selected()?.id || this.program.idProvider) || undefined;
    console.log('[Programas x Subcontratista] Consultando programas', {
      idRoot: this.idRoot,
      idProvider: providerId,
      proveedor: this.context.selected()
    });
    if (this.idRoot && providerId) {
      this.programsService.get(this.idRoot, providerId).subscribe({
        next: (data: any) => {
          console.log('[Programas x Subcontratista] Respuesta de programas', data);
          this.programs = Array.isArray(data) ? data : (data?.data || []);
          console.log('[Programas x Subcontratista] Programas normalizados', this.programs);
          if (this.programs.length) {
            this.selectedProgramId = Number(this.programs[0].id);
            console.log('[Programas x Subcontratista] Abriendo programa', this.selectedProgramId);
            this.openProgram(this.selectedProgramId);
          }
        },
        error: error => {
          console.error('[Programas x Subcontratista] Error al consultar programas', error);
          this.programs = [];
        }
      });
    } else {
      this.programs = [];
    }
  }
  newProgram() { this.selectedProgramId = 0; this.program = this.emptyProgram(); this.items = []; }
  openProgram(id: number) {
    this.programsService.getById(id).subscribe({
      next: data => {
        console.log('[Programas x Subcontratista] Respuesta del programa y conceptos', data);
        this.selectedProgramId = id;
        this.program = data.program;
        this.items = data.items || [];
        console.log('[Programas x Subcontratista] Conceptos enviados al grid', this.items);
      },
      error: error => {
        console.error('[Programas x Subcontratista] Error al abrir el programa', { id, error });
        alerts.basicAlert('Programa', 'No fue posible abrir el programa.', 'error');
      }
    });
  }
  addItem() {
    this.items = [...this.items, { phase: 'SIN FASE', subphase: '', concept: '', unit: '', quantity: 0, unitPrice: 0 }];
  }
  selectProvider(id: number) {
    this.program.idProvider = id;
    this.program.providerName = this.providers.find(x => Number(x.id) === Number(id))?.name || '';
  }
  removeItem(index: number) { this.items = this.items.filter((_, itemIndex) => itemIndex !== index); }
  onGridReady(event: any) { this.gridApi = event.api; }
  onCellClicked(event: CellClickedEvent) {
    if (event.column.getColId() !== 'delete' || !event.data) return;
    this.items = this.items.filter(item => item !== event.data);
  }
  onCellValueChanged() { this.gridApi?.refreshCells({ columns: ['amount'], force: true }); }
  currency(value: any): string {
    return this.number(value).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
  }
  get total() { return this.items.reduce((sum, row) => sum + (Number(row.quantity) || 0) * (Number(row.unitPrice) || 0), 0); }
  async onExcelSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0]; if (!file) return;
    const data = await file.arrayBuffer(); this.workbook = XLSX.read(data, { type: 'array' });
    this.sheets = this.workbook.SheetNames.filter(name => /EST\.?\s*TORRE/i.test(name));
    if (!this.sheets.length) this.sheets = this.workbook.SheetNames;
    if (this.sheets.length) this.importSheet(this.sheets[0]);
  }
  importSheet(sheetName: string) {
    if (!this.workbook || !sheetName) return;
    const rows: any[][] = XLSX.utils.sheet_to_json(this.workbook.Sheets[sheetName], { header: 1, defval: '', raw: false });
    let phase = 'SIN FASE'; const imported: any[] = [];
    rows.forEach((row, index) => {
      const cells = row.map(x => String(x ?? '').trim());
      const first = cells[0] || ''; const concept = cells[1] || '';
      const unit = cells[2] || ''; const qty = this.number(cells[3]); const price = this.number(cells[4]);
      if (first && index > 3) phase = first.toUpperCase();
      if (first && !concept && !unit && !qty && !price && index > 3) return;
      if (concept && index > 3 && !/CONCEPTO|DESCRIPCI/i.test(concept)) imported.push({ phase, subphase: '', concept, unit, quantity: qty, unitPrice: price });
    });
    if (!imported.length) { alerts.basicAlert('Archivo', 'No se localizaron conceptos en esa hoja.', 'warning'); return; }
    this.items = imported;
    if (!this.program.projectName) this.program.projectName = sheetName.replace(/^EST\.?\s*/i, 'EST. ');
    alerts.basicAlert('Excel cargado', `${imported.length} conceptos con cantidades y precios fueron preparados.`, 'success');
  }
  number(value: any): number { const clean = String(value ?? '').replace(/[$,\s]/g, '').replace(/[^0-9.-]/g, ''); return Number(clean) || 0; }
  save() {
    if (!this.program.idProvider || !this.program.projectName?.trim()) { alerts.basicAlert('Datos requeridos', 'Selecciona el subcontratista y captura la torre/proyecto.', 'warning'); return; }
    this.loading = true; this.program.idRoot = this.idRoot;
    this.programsService.save(this.program).subscribe({ next: (saved: any) => {
      const id = saved.id || saved.program?.id || this.program.id;
      this.program.id = id;
      this.programsService.saveItems(id, this.items).subscribe({ next: data => { this.items = data; this.selectedProgramId = id; this.loading = false; this.loadPrograms(); alerts.basicAlert('Guardado', 'Programa y conceptos guardados correctamente.', 'success'); }, error: () => { this.loading = false; alerts.basicAlert('Error', 'No se guardaron los conceptos.', 'error'); } });
    }, error: () => { this.loading = false; alerts.basicAlert('Error', 'No se guardó el encabezado del programa.', 'error'); } });
  }
  downloadPdf() {
    const provider = this.program.providerName || this.providers.find(x => x.id === Number(this.program.idProvider))?.name || 'SUBCONTRATISTA';
    const body: any[] = [[{ text: 'SUBFASE', bold: true }, { text: 'CONCEPTO', bold: true }, { text: 'UNIDAD', bold: true }, { text: 'CANT.', bold: true }, { text: 'P.U.', bold: true }, { text: 'IMPORTE', bold: true }]];
    body.push([
      { text: `CONTRATISTA: ${provider}`, colSpan: 6, bold: true, color: '#ffffff', fillColor: '#173f67', margin: [4, 4, 4, 4] },
      {}, {}, {}, {}, {}
    ]);

    const phases = new Map<string, any[]>();
    this.items.forEach(item => {
      const phase = String(item.phase || 'SIN FASE').trim().toUpperCase();
      if (!phases.has(phase)) phases.set(phase, []);
      phases.get(phase)!.push(item);
    });

    phases.forEach((phaseItems, phase) => {
      body.push([
        { text: `FASE: ${phase} (${phaseItems.length} conceptos)`, colSpan: 6, bold: true, color: '#173f67', fillColor: '#dcebf5', margin: [8, 3, 4, 3] },
        {}, {}, {}, {}, {}
      ]);
      phaseItems.forEach(item => body.push([
        item.subphase || '',
        item.concept,
        item.unit || '',
        this.number(item.quantity).toLocaleString('es-MX'),
        this.currency(item.unitPrice),
        this.currency(this.number(item.quantity) * this.number(item.unitPrice))
      ]));
    });
    body.push([{ text: 'TOTAL', colSpan: 5, alignment: 'right', bold: true }, {}, {}, {}, {}, { text: this.total.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }), bold: true }]);
    pdfMake.createPdf({ pageOrientation: 'landscape', pageMargins: [24, 28, 24, 28], content: [{ text: 'PROGRAMA DE TRABAJO POR SUBCONTRATISTA', style: 'title' }, { columns: [{ text: `PROYECTO / TORRE: ${this.program.projectName}` }, { text: `SUBCONTRATISTA: ${provider}`, alignment: 'right' }] }, { text: `PROGRAMA: ${this.program.name}`, margin: [0, 4, 0, 12] }, { table: { headerRows: 1, widths: [72, '*', 42, 45, 62, 68], body }, layout: 'lightHorizontalLines', fontSize: 7 }], styles: { title: { bold: true, fontSize: 14, alignment: 'center', margin: [0, 0, 0, 12] } }, defaultStyle: { fontSize: 9 } } as any).download(`Programa_${this.program.projectName || 'Subcontratista'}.pdf`);
  }
}
