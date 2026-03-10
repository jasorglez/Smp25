import { Component, Input, Output, EventEmitter, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { RootService }          from 'app/services/root.service';
import { Base64EncodeService }  from 'app/services/base64encode.service';
import { DistributionService }  from 'app/services/distribution.service';
import { WorkprogramsService }  from 'app/services/workprograms.service';
import { lastValueFrom }        from 'rxjs';
import pdfMake   from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';

(pdfMake as any).vfs = (pdfFonts as any).pdfMake?.vfs ?? (pdfFonts as any).default?.pdfMake?.vfs;

// ─── Paleta ────────────────────────────────────────────────────────────────
const NAVY  = '#003366';
const BLUE  = '#1a5a9a';
const WHITE = '#ffffff';
const ALT   = '#f4f7fb';
const GRAY  = '#888888';

const MONTHS_NAMES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

const TBL_LAYOUT = {
  hLineWidth: (i: number, node: any) =>
    (i === 0 || i === node.table.body.length) ? 0.8 : (i === 1 ? 0.8 : 0.3),
  vLineWidth: () => 0.3,
  hLineColor: (i: number, node: any) =>
    (i === 0 || i === node.table.body.length || i === 1) ? NAVY : '#cccccc',
  vLineColor: () => '#cccccc',
  paddingLeft: () => 4, paddingRight: () => 4,
  paddingTop:  () => 3, paddingBottom: () => 3,
};

const hCell = (txt: string, align: 'left'|'center'|'right' = 'center'): any => ({
  text: txt, fontSize: 7, bold: true, color: WHITE, fillColor: BLUE, alignment: align,
});
const dCell = (txt: string, alt: boolean, align: 'left'|'center'|'right' = 'left'): any => ({
  text: String(txt ?? ''), fontSize: 7, fillColor: alt ? ALT : WHITE, alignment: align,
});
const nCell = (val: number | null, alt: boolean): any => ({
  text: val != null && val !== 0 ? Number(val).toFixed(3) : '',
  fontSize: 7, fillColor: alt ? ALT : WHITE, alignment: 'right',
});
const totalCell = (txt: string, align: 'left'|'center'|'right' = 'right'): any => ({
  text: txt, fontSize: 7, bold: true, color: WHITE, fillColor: NAVY, alignment: align,
});

// ────────────────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-pdf-workprogram-distribution',
  standalone: true,
  imports: [CommonModule],
  template: `
<div *ngIf="mode === 'embed'" style="padding:10px; background:#f8f9fa; border-radius:6px;">
  <div class="d-flex justify-content-between align-items-center mb-2">
    <div class="d-flex align-items-center gap-2">
      <i class="bi bi-file-earmark-pdf-fill text-danger" style="font-size:1.3rem;"></i>
      <span class="fw-bold" style="font-size:.9rem;">Distribución de Programa de Trabajo</span>
    </div>
    <div class="d-flex gap-1">
      <button class="btn btn-sm btn-success" (click)="downloadPdf()" [disabled]="isLoading || !pdfBlob">
        <i class="bi bi-download me-1"></i>Descargar
      </button>
      <button class="btn btn-sm btn-outline-secondary" (click)="onClose()">
        <i class="bi bi-x-lg"></i>
      </button>
    </div>
  </div>
  <div style="height:520px; border:1px solid #dee2e6; border-radius:6px; background:white; overflow:hidden;">
    <iframe *ngIf="pdfUrl" [src]="pdfUrl" style="width:100%; height:100%; border:none;"></iframe>
    <div *ngIf="!pdfUrl && !isLoading"
         class="d-flex flex-column justify-content-center align-items-center h-100 text-muted">
      <i class="bi bi-file-earmark-pdf" style="font-size:3rem;"></i>
      <p class="mt-2 mb-0">Sin datos</p>
    </div>
    <div *ngIf="isLoading"
         class="d-flex flex-column justify-content-center align-items-center h-100 px-4">
      <i class="bi bi-file-earmark-pdf text-primary mb-3" style="font-size:2.5rem;"></i>
      <div class="w-100">
        <div class="d-flex justify-content-between mb-1">
          <small class="text-muted">{{ loadingMsg }}</small>
          <small class="text-primary fw-bold">{{ loadingProgress }}%</small>
        </div>
        <div class="progress" style="height:8px;">
          <div class="progress-bar progress-bar-striped progress-bar-animated bg-primary"
               role="progressbar"
               [style.width.%]="loadingProgress"
               [attr.aria-valuenow]="loadingProgress"
               aria-valuemin="0" aria-valuemax="100">
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<div *ngIf="mode === 'newTab' && isLoading" style="padding:12px; min-width:280px;">
  <div class="d-flex align-items-center gap-2 mb-1">
    <i class="bi bi-file-earmark-pdf text-primary"></i>
    <small class="text-muted fw-semibold">{{ loadingMsg }}</small>
    <small class="text-primary fw-bold ms-auto">{{ loadingProgress }}%</small>
  </div>
  <div class="progress" style="height:6px;">
    <div class="progress-bar progress-bar-striped progress-bar-animated bg-primary"
         role="progressbar"
         [style.width.%]="loadingProgress">
    </div>
  </div>
</div>
  `,
})
export class PdfWorkprogramDistributionComponent implements OnInit {
  @Input() idCompany: number;
  @Input() idProject: number | null = null;
  @Input() idContract: number | null = null;
  @Input() idConvention: number | null = null;
  @Input() typeWorkProgram: string = 'Project';
  @Input() mode: 'embed' | 'newTab' = 'newTab';
  @Output() closed = new EventEmitter<void>();

  private rootService         = inject(RootService);
  private base64Service       = inject(Base64EncodeService);
  private distributionService = inject(DistributionService);
  private workprogramsService = inject(WorkprogramsService);
  private sanitizer           = inject(DomSanitizer);
  private cdr                 = inject(ChangeDetectorRef);

  pdfUrl:    SafeResourceUrl | null = null;
  pdfBlob:   Blob | null = null;
  isLoading      = false;
  loadingMsg     = 'Generando PDF...';
  loadingProgress = 0;

  ngOnInit(): void { this.generatePdf(); }

  onClose(): void { this.closed.emit(); }

  downloadPdf(): void {
    if (!this.pdfBlob) return;
    const url = URL.createObjectURL(this.pdfBlob);
    const a   = document.createElement('a');
    a.href     = url;
    a.download = `distribucion-programa-trabajo-${new Date().toISOString().substring(0,10)}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private async tryB64(url: string): Promise<string | null> {
    try { return await this.base64Service.convertImageToBase64(url); } catch { return null; }
  }

  private async generatePdf(): Promise<void> {
    this.isLoading = true;
    this.loadingProgress = 0;
    try {
      if (!this.idCompany) { this.isLoading = false; return; }

      this.loadingMsg = 'Cargando datos...';
      const safe = async (obs: any) => { try { return await lastValueFrom(obs); } catch { return null; } };

      const id = this.typeWorkProgram === 'Project' ? this.idProject : this.idContract;

      const [rootResp, tasksResp] = await Promise.all([
        safe(this.rootService.getRootbyId(this.idCompany)),
        this.idConvention
          ? safe(this.workprogramsService.getByConvention(this.idConvention, this.idProject ?? undefined))
          : safe(this.workprogramsService.getWorkPrograms(id, this.typeWorkProgram)),
      ]);
      this.loadingProgress = 20;

      const root  = rootResp as any;
      const tasks = (Array.isArray(tasksResp) ? tasksResp : []) as any[];

      // Reconstruir orden árbol (depth-first) igual que DHTMLX Gantt
      // usando parent + sortorder, sin depender de que sortorder esté en BD
      const allValid = tasks.filter(t => t.id && !isNaN(Number(t.id)));
      if (!allValid.length) { this.isLoading = false; return; }

      const byParent = new Map<number, any[]>();
      allValid.forEach(t => {
        const p = Number(t.parent) || 0;
        if (!byParent.has(p)) byParent.set(p, []);
        byParent.get(p).push(t);
      });
      // Ordenar hijos por sortorder dentro de cada padre
      byParent.forEach(children =>
        children.sort((a, b) => (Number(a.sortorder) || 0) - (Number(b.sortorder) || 0))
      );
      // Traversal depth-first = orden visual del Gantt
      const leafTasks: any[] = [];
      const traverse = (parentId: number) => {
        (byParent.get(parentId) ?? []).forEach(task => {
          leafTasks.push(task);
          traverse(Number(task.id));
        });
      };
      traverse(0);
      // Si el árbol quedó vacío (todos los padres son distintos de 0) usar orden plano
      if (!leafTasks.length) allValid.forEach(t => leafTasks.push(t));

      // Cargar distribuciones en paralelo
      this.loadingMsg = 'Cargando distribuciones...';
      const distMap = new Map<number, any[]>();
      let doneCount = 0;
      const totalCount = leafTasks.length;
      await Promise.all(leafTasks.map(async (t) => {
        const taskId = t.id; // id en la API es el idEntry
        const dists = await safe(this.distributionService.getByReference('WORKPROGRAM', taskId, this.idCompany));
        distMap.set(taskId, Array.isArray(dists) ? dists : []);
        doneCount++;
        this.loadingProgress = 20 + Math.round((doneCount / totalCount) * 45);
      }));

      // Meses únicos presentes (de todas las distribuciones)
      const monthSet = new Set<string>();
      distMap.forEach(dists => dists.forEach(d => {
        if (d.year && d.month) monthSet.add(`${d.year}-${String(d.month).padStart(2,'0')}`);
      }));
      const sortedMonths = Array.from(monthSet).sort();
      // Si no hay ningún mes distribuido, no hay nada que imprimir
      if (!sortedMonths.length) {
        this.isLoading = false;
        if (this.mode === 'newTab') { this.closed.emit(); return; }
        return;
      }

      // Logos
      this.loadingMsg = 'Cargando logos...';
      const logoB64  = root?.picture  ? await this.tryB64(root.picture)  : null;
      const logo2B64 = root?.picture2 ? await this.tryB64(root.picture2) : logoB64;
      const wmB64    = root?.picture3 ? await this.tryB64(root.picture3) : null;
      this.loadingProgress = 85;

      const imgs: Record<string, string> = {};
      if (logoB64)  imgs['logo']  = logoB64;
      if (logo2B64) imgs['logo2'] = logo2B64;
      if (wmB64)    imgs['wm']    = wmB64;

      const companyName = root?.name || 'EMPRESA';

      // ── HEADER ─────────────────────────────────────────────────────────────
      const headerRow: any = {
        columns: [
          logoB64 ? { image: 'logo', width: 80 } : { text: '', width: 80 },
          {
            stack: [
              { text: companyName.toUpperCase(), fontSize: 11, bold: true, color: NAVY, alignment: 'center' },
              { text: 'PROGRAMA DE DISTRIBUCIÓN CALENDARIZADO', fontSize: 9, bold: true, color: BLUE, alignment: 'center', margin: [0,2,0,0] },
              { text: 'CUANTIFICADO DE UTILIZACIÓN MENSUAL DE ACTIVIDADES DE TRABAJO', fontSize: 7, color: GRAY, alignment: 'center', margin: [0,1,0,0] },
            ],
            margin: [10,0,10,0],
          },
          logo2B64 ? { image: 'logo2', width: 80, alignment: 'right' } : { text: '', width: 80 },
        ],
        margin: [0,0,0,8],
      };

      // ── TABLA ──────────────────────────────────────────────────────────────
      const colWidths: any[] = ['*', 35, 40, 50, ...sortedMonths.map(() => 38)];

      const tableHeader: any[] = [
        hCell('Descripción / Actividad', 'left'),
        hCell('Unidad'),
        hCell('Cantidad'),
        hCell('Total'),
        ...sortedMonths.map(ym => {
          const [y, m] = ym.split('-');
          return hCell(`${MONTHS_NAMES[Number(m)-1]}\n${y}`);
        }),
      ];

      const tableBody: any[][] = [tableHeader];
      const monthTotals = new Array(sortedMonths.length).fill(0);
      let grandTotalQty = 0;

      leafTasks.forEach((task, idx) => {
        const alt      = idx % 2 === 1;
        const qty      = Number(task.quantity ?? 0);
        const dists    = distMap.get(task.id) ?? [];
        const distByMonth = new Map<string, number>();
        dists.forEach(d => {
          if (d.year && d.month) {
            const key = `${d.year}-${String(d.month).padStart(2,'0')}`;
            distByMonth.set(key, (distByMonth.get(key) ?? 0) + Number(d.quantity ?? 0));
          }
        });

        const distTotal = dists.reduce((s, d) => s + Number(d.quantity ?? 0), 0);
        grandTotalQty += distTotal;

        const monthCells = sortedMonths.map((ym, mi) => {
          const mQty = distByMonth.get(ym) ?? 0;
          monthTotals[mi] += mQty;
          return nCell(mQty || null, alt);
        });

        // Combinar actividad + texto
        const label = [task.activity, task.text].filter(Boolean).join(' — ');
        const measure = task.measure || '';

        tableBody.push([
          dCell(label, alt, 'left'),
          dCell(measure, alt, 'center'),
          { text: qty > 0 ? qty.toFixed(3) : '', fontSize: 7, fillColor: alt ? ALT : WHITE, alignment: 'right' },
          { text: distTotal > 0 ? distTotal.toFixed(3) : '', fontSize: 7, bold: true, fillColor: alt ? ALT : WHITE, alignment: 'right' },
          ...monthCells,
        ]);
      });

      // TOTAL PARCIAL
      tableBody.push([
        totalCell('TOTAL PARCIAL:', 'right'),
        totalCell(''), totalCell(''),
        totalCell(grandTotalQty > 0 ? grandTotalQty.toFixed(3) : ''),
        ...monthTotals.map(t => totalCell(t > 0 ? t.toFixed(3) : '')),
      ]);

      // TOTAL ACUMULADO
      let acum = 0;
      tableBody.push([
        totalCell('TOTAL ACUMULADO:', 'right'),
        totalCell(''), totalCell(''),
        totalCell(grandTotalQty > 0 ? grandTotalQty.toFixed(3) : ''),
        ...monthTotals.map(t => {
          acum += t;
          return totalCell(acum > 0 ? acum.toFixed(3) : '');
        }),
      ]);

      const mainTable: any = {
        table: { headerRows: 1, widths: colWidths, body: tableBody },
        layout: TBL_LAYOUT,
      };

      // ── DOCUMENTO ──────────────────────────────────────────────────────────
      const docDef: any = {
        pageSize:        'LEGAL',
        pageOrientation: 'landscape',
        pageMargins:     [20, 20, 20, 20],
        images:          imgs,
        content: [
          ...(wmB64 ? [{ image: 'wm', width: 500, opacity: 0.05, absolutePosition: { x: 170, y: 180 } }] : []),
          headerRow,
          mainTable,
        ],
        footer: (page: number, pages: number) => ({
          columns: [
            { text: `Generado: ${new Date().toLocaleDateString('es-MX')}`, fontSize: 6, color: GRAY, margin: [20,0,0,0] },
            { text: `Página ${page} de ${pages}`, fontSize: 6, color: GRAY, alignment: 'right', margin: [0,0,20,0] },
          ],
        }),
        defaultStyle: { font: 'Roboto' },
      };

      this.loadingMsg = 'Generando PDF...';
      this.loadingProgress = 95;
      const doc = pdfMake.createPdf(docDef);

      if (this.mode === 'newTab') {
        doc.open();
        this.loadingProgress = 100;
        this.isLoading = false;
        this.cdr.detectChanges();
        this.closed.emit();
      } else {
        doc.getBlob((blob: Blob) => {
          this.pdfBlob = blob;
          const url   = URL.createObjectURL(blob);
          this.pdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
          this.loadingProgress = 100;
          this.isLoading = false;
          this.cdr.detectChanges();
        });
      }

    } catch (err) {
      console.error('Error generando PDF de distribución de programa de trabajo:', err);
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }
}
