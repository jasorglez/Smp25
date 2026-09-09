import { CommonModule, CurrencyPipe } from '@angular/common';
import { Component, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import * as XLSX from 'xlsx';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import { alerts } from 'app/helpers/alerts';
import { CustomersService } from 'app/services/customers.service';
import { SignalsService } from 'app/services/signals.service';
import { SubcontractProgramService } from 'app/services/subcontract-program.service';

(pdfMake as any).vfs = (pdfFonts as any).pdfMake?.vfs || (pdfFonts as any).default?.pdfMake?.vfs;

@Component({
  selector: 'app-subcontract-programs', standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe],
  templateUrl: './subcontract-programs.component.html', styleUrl: './subcontract-programs.component.scss'
})
export class SubcontractProgramsComponent {
  private programsService = inject(SubcontractProgramService);
  private customersService = inject(CustomersService);
  private signals = inject(SignalsService);
  providers: any[] = [];
  programs: any[] = [];
  items: any[] = [];
  sheets: string[] = [];
  workbook: XLSX.WorkBook | null = null;
  selectedProgramId = 0;
  idRoot = 0;
  idBranch = 0;
  loading = false;
  program: any = this.emptyProgram();

  constructor() {
    effect(() => {
      this.idRoot = Number(this.signals.getRootSelectedBySidebar()()) || 0;
      this.idBranch = Number(this.signals.getBranchSelectedBySidebar()()) || 0;
      if (this.idRoot) this.loadCatalogs();
    });
  }

  emptyProgram() { return { id: 0, idRoot: this.idRoot, idProvider: null, providerName: '', idProject: null, projectName: '', name: 'Programa de trabajo por subcontratista', startDate: null, endDate: null }; }
  loadCatalogs() {
    if (this.idBranch) this.customersService.getCustomers(this.idBranch, 'PROVIDERS').subscribe({ next: (data: any) => this.providers = data || [], error: () => this.providers = [] });
    this.loadPrograms();
  }
  loadPrograms() { if (this.idRoot) this.programsService.get(this.idRoot).subscribe({ next: data => this.programs = data || [], error: () => this.programs = [] }); }
  newProgram() { this.selectedProgramId = 0; this.program = this.emptyProgram(); this.items = []; }
  openProgram(id: number) {
    this.programsService.getById(id).subscribe({ next: data => { this.selectedProgramId = id; this.program = data.program; this.items = data.items || []; }, error: () => alerts.basicAlert('Programa', 'No fue posible abrir el programa.', 'error') });
  }
  addItem() { this.items.push({ phase: 'SIN FASE', subphase: '', concept: '', unit: '', quantity: 0, unitPrice: 0 }); }
  selectProvider(id: number) {
    this.program.idProvider = id;
    this.program.providerName = this.providers.find(x => Number(x.id) === Number(id))?.name || '';
  }
  removeItem(index: number) { this.items.splice(index, 1); }
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
      if (first && !concept && !unit && !qty && !price && index > 3) { phase = first.toUpperCase(); return; }
      if (concept && index > 3 && !/CONCEPTO|DESCRIPCI/i.test(concept)) imported.push({ phase, subphase: first && first !== phase ? first : '', concept, unit, quantity: qty, unitPrice: price });
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
    const body: any[] = [[{ text: 'FASE', bold: true }, { text: 'CONCEPTO', bold: true }, { text: 'UNIDAD', bold: true }, { text: 'CANT.', bold: true }, { text: 'P.U.', bold: true }, { text: 'IMPORTE', bold: true }]];
    this.items.forEach(x => body.push([x.phase, x.concept, x.unit || '', this.number(x.quantity).toLocaleString('es-MX'), this.number(x.unitPrice).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }), (this.number(x.quantity) * this.number(x.unitPrice)).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })]));
    body.push([{ text: 'TOTAL', colSpan: 5, alignment: 'right', bold: true }, {}, {}, {}, {}, { text: this.total.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }), bold: true }]);
    pdfMake.createPdf({ pageOrientation: 'landscape', pageMargins: [24, 28, 24, 28], content: [{ text: 'PROGRAMA DE TRABAJO POR SUBCONTRATISTA', style: 'title' }, { columns: [{ text: `PROYECTO / TORRE: ${this.program.projectName}` }, { text: `SUBCONTRATISTA: ${provider}`, alignment: 'right' }] }, { text: `PROGRAMA: ${this.program.name}`, margin: [0, 4, 0, 12] }, { table: { headerRows: 1, widths: [72, '*', 42, 45, 62, 68], body }, layout: 'lightHorizontalLines', fontSize: 7 }], styles: { title: { bold: true, fontSize: 14, alignment: 'center', margin: [0, 0, 0, 12] } }, defaultStyle: { fontSize: 9 } } as any).download(`Programa_${this.program.projectName || 'Subcontratista'}.pdf`);
  }
}
