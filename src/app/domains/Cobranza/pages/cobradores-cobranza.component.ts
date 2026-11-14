import { CommonModule } from '@angular/common';
import { Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef } from 'ag-grid-enterprise';
import { catchError, forkJoin, of, switchMap, throwError } from 'rxjs';
import { CatalogsService } from 'app/services/catalogs.service';
import { RootService } from 'app/services/root.service';
import { Base64EncodeService } from 'app/services/base64encode.service';
import { PdfPreviewService } from 'app/services/pdf-preview.service';
import { alerts } from 'app/helpers/alerts';
import { firstValueFrom } from 'rxjs';
import { CustomersService } from 'app/services/customers.service';
import { SignalsService } from 'app/services/signals.service';
import { UsersService } from 'app/services/users.service';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { CobradoresCobranzaDetailComponent } from './cobradores-cobranza-detail.component';

@Component({
  selector: 'app-cobradores-cobranza',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  template: `
    <section class="card border-0 shadow-sm">
      <div class="card-body p-3 p-md-4">
        <div class="d-flex align-items-center justify-content-between gap-3 flex-wrap mb-4">
          <div><small class="text-primary fw-bold">COBRANZA</small><h4 class="mb-1">Cobradores</h4><small class="text-muted">Usuarios activos registrados en esta empresa.</small></div>
          <button class="btn btn-outline-primary btn-sm" type="button" (click)="refresh()" [disabled]="loading"><i class="bi bi-arrow-clockwise me-1"></i>Actualizar</button>
        </div>
        <div class="report-toolbar row g-2 align-items-end mb-3">
          <div class="col-12 col-sm-4 col-md-3"><label class="form-label small fw-semibold mb-1" for="cobradores-desde">Desde</label><input id="cobradores-desde" type="date" class="form-control form-control-sm" [(ngModel)]="desde"></div>
          <div class="col-12 col-sm-4 col-md-3"><label class="form-label small fw-semibold mb-1" for="cobradores-hasta">Hasta</label><input id="cobradores-hasta" type="date" class="form-control form-control-sm" [(ngModel)]="hasta"></div>
          <div class="col-12 col-sm-4 col-md-auto"><button class="btn btn-primary btn-sm w-100" type="button" (click)="printReport()" [disabled]="loading || printingPdf || !!error || !users.length"><i class="bi bi-file-earmark-pdf me-1"></i>{{ printingPdf ? 'Generando…' : 'Reporte PDF por vendedor' }}</button></div>
          <div class="col-12"><small class="text-muted">El PDF agrupa los cobros realizados dentro del período seleccionado.</small></div>
        </div>
        <div *ngIf="loading" class="text-center text-muted py-5" role="status"><span class="spinner-border spinner-border-sm text-primary me-2" aria-hidden="true"></span>Cargando cobradores…</div>
        <div *ngIf="error" class="alert alert-warning mb-0" role="alert"><i class="bi bi-exclamation-circle me-2"></i>{{ error }}</div>
        <div *ngIf="!loading && !error && users.length" class="grid-shell">
          <ag-grid-angular class="ag-theme-quartz small-text-ag-grid d-block" style="width:100%;height: min(55vh, 520px);min-height:280px"
            [rowData]="users" [columnDefs]="columns" [defaultColDef]="defaultColDef" [localeText]="localeText" [gridOptions]="gridOptions">
          </ag-grid-angular>
        </div>
        <div *ngIf="!loading && !error && !users.length" class="empty-state text-center py-5 px-3">
          <i class="bi bi-person-badge fs-2 text-primary" aria-hidden="true"></i>
          <h6 class="mt-3 mb-1">No hay usuarios activos</h6>
          <p class="text-muted small mb-0">Los usuarios activos de la empresa aparecerán aquí.</p>
        </div>
      </div>
    </section>
  `,
  styles: [':host { display:block; } .card { border-radius:12px; } .report-toolbar { padding:12px; border:1px solid #dce8f5; border-radius:10px; background:#f7faff; } .grid-shell { overflow:hidden; border:1px solid #e5eaf0; border-radius:10px; } .empty-state { border:1px dashed #cbd8e6; border-radius:10px; background:#f8fbff; }']
})
export class CobradoresCobranzaComponent {
  private signalsService = inject(SignalsService);
  private usersService = inject(UsersService);
  private customersService = inject(CustomersService);
  private catalogsService = inject(CatalogsService);
  private rootService = inject(RootService);
  private base64EncodeService = inject(Base64EncodeService);
  private pdfPreview = inject(PdfPreviewService);
  private refreshVersion = signal(0);

  users: any[] = [];
  desde = this.localDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  hasta = this.localDate(new Date());
  loading = false;
  printingPdf = false;
  error = '';
  readonly localeText = AG_GRID_LOCALE_ES;
  readonly defaultColDef: ColDef = { sortable: true, filter: true, floatingFilter: true, resizable: true, flex: 1, minWidth: 180, suppressHeaderMenuButton: true };
  readonly gridOptions: any = { animateRows: true, rowHeight: 38, masterDetail: true, detailRowHeight: 310, isRowMaster: (user: any) => (user?.cobros?.length || 0) > 0, detailCellRenderer: CobradoresCobranzaDetailComponent };
  readonly columns: ColDef[] = [
    { headerName: 'Nombre', valueGetter: params => params.data?.displayName || params.data?.usersmall || '', minWidth: 180 },
    { field: 'email', headerName: 'Correo', minWidth: 220 },
    { colId: 'detalleCobros', headerName: 'Pagos', valueGetter: params => `${params.data?.cobros?.length || 0} cobros · ver detalle`, cellRenderer: 'agGroupCellRenderer', cellRendererParams: { suppressCount: true }, minWidth: 190, sortable: false, filter: false },
    { headerName: 'Total cobrado', valueGetter: params => (params.data?.cobros || []).reduce((sum: number, payment: any) => sum + Number(payment.monto || 0), 0), valueFormatter: params => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(params.value || 0)), minWidth: 150 }
  ];

  constructor() {
    effect(onCleanup => {
      const companyId = Number(this.signalsService.getRootSelectedBySidebar()()) || 0;
      this.refreshVersion();
      this.users = [];
      this.error = '';
      if (companyId <= 0) { this.loading = false; this.error = 'Selecciona una empresa para consultar sus cobradores.'; return; }

      this.loading = true;
      const subscription = forkJoin({
        users: this.usersService.get2fieldsUsers(companyId),
        loans: this.customersService.getCobranzaDashboard(companyId),
        paymentTypes: this.catalogsService.getCatalogsFromAdmon(companyId, 'COBRO_PAGO').pipe(catchError(() => of([])))
      }).pipe(
        switchMap(({ users, loans, paymentTypes }: any) => users?.status === false || !Array.isArray(loans)
          ? throwError(() => new Error('No se pudo consultar la lista de usuarios y cobros de la empresa.'))
          : of({ users: Array.isArray(users?.data) ? users.data : [], loans, paymentTypes }))
      ).subscribe({
        next: ({ users, loans, paymentTypes }) => {
          const paymentTypeNames = new Map<number, string>((paymentTypes || []).map((type: any) => [Number(type.id), type.description]));
          const paymentsByUser = new Map<number, any[]>();
          for (const loan of loans) {
            for (const installment of loan.cuotas || []) {
              for (const payment of installment.abonos || []) {
                if (payment.active === false || !payment.idUsuarioCobrador) continue;
                const userId = Number(payment.idUsuarioCobrador);
                const payments = paymentsByUser.get(userId) || [];
                payments.push({ ...payment, cliente: loan.cliente || `Cliente #${loan.idCustomer}`, prestamo: loan.id, cuota: installment.numeroCuota, tipoPago: paymentTypeNames.get(Number(payment.idTipoPago)) || '—', origen: payment.origenCobro === 'NEGOCIO' ? 'Caja del negocio' : 'Domicilio del cliente' });
                paymentsByUser.set(userId, payments);
              }
            }
          }
          this.users = users.map((user: any) => ({ ...user, cobros: (paymentsByUser.get(Number(user.id)) || []).sort((a, b) => String(b.fechaPago).localeCompare(String(a.fechaPago))) }))
            .sort((a: any, b: any) => String(a.displayName || a.usersmall || a.email || '').localeCompare(String(b.displayName || b.usersmall || b.email || ''), 'es'));
          this.loading = false;
        },
        error: error => { console.error('Error al cargar cobradores:', error); this.error = 'No se pudieron cargar los cobradores. Intenta actualizar.'; this.loading = false; }
      });
      onCleanup(() => subscription.unsubscribe());
    });
  }

  refresh(): void { this.refreshVersion.update(value => value + 1); }

  private localDate(value: Date): string {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }

  private paymentDate(value: any): string {
    const raw = String(value || '').slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw);
    return match ? `${match[3]}-${match[2]}-${match[1]}` : '';
  }

  async printReport(): Promise<void> {
    if (this.loading || this.printingPdf || this.error || !this.users.length) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(this.desde) || !/^\d{4}-\d{2}-\d{2}$/.test(this.hasta) || this.desde > this.hasta) {
      alerts.basicAlert('Período inválido', 'Selecciona una fecha inicial y final válidas.', 'warning');
      return;
    }
    this.printingPdf = true;
    try {
      const companyId = Number(this.signalsService.getRootSelectedBySidebar()()) || 0;
      const response: any = await firstValueFrom(this.rootService.getRootbyId(companyId));
      const root = response?.data ?? response;
      let logo: string | null = null;
      for (const url of [root?.picture, root?.picture2]) {
        if (!url) continue;
        const image = await this.base64EncodeService.convertImageToBase64(url);
        if (/^data:image\/(png|jpeg);base64,/i.test(image)) { logo = image; break; }
      }
      if (!logo) throw new Error('No se pudo cargar el logo de la empresa.');

      const groups = this.users.map(user => ({
        name: user.displayName || user.usersmall || user.email || `Usuario #${user.id}`,
        payments: (user.cobros || []).filter((payment: any) => {
          const date = this.paymentDate(payment.fechaPago);
          return date >= this.desde && date <= this.hasta;
        })
      })).filter(group => group.payments.length);
      const money = (value: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value);
      const date = (value: any) => this.paymentDate(value).split('-').reverse().join('/') || '—';
      const total = groups.reduce((sum, group) => sum + group.payments.reduce((amount: number, payment: any) => amount + Number(payment.monto || 0), 0), 0);
      const count = groups.reduce((sum, group) => sum + group.payments.length, 0);
      const content: any[] = [
        { columns: [{ image: logo, fit: [80, 55] }, { text: root?.name || 'Cobranza', alignment: 'center', bold: true, fontSize: 14, margin: [0, 16, 0, 0] }], margin: [0, 0, 0, 12] },
        { text: 'COBROS POR VENDEDOR', style: 'title' },
        { text: `Período: ${date(this.desde)} al ${date(this.hasta)}`, margin: [0, 0, 0, 8] },
        { columns: [{ text: `Total cobrado: ${money(total)}`, bold: true }, { text: `Cobros: ${count}   Vendedores: ${groups.length}`, alignment: 'right', bold: true }], margin: [0, 0, 0, 12] }
      ];
      for (const group of groups) {
        const subtotal = group.payments.reduce((sum: number, payment: any) => sum + Number(payment.monto || 0), 0);
        content.push({ text: `${group.name} · ${group.payments.length} cobros · ${money(subtotal)}`, style: 'section', keepWithNext: true });
        content.push({ table: { headerRows: 1, widths: [65, '*', 60, 42, 82, 75, 80], body: [
          [...['Fecha', 'Cliente', 'Préstamo', 'Letra', 'Tipo de pago', 'Recibido en'].map(value => ({ text: value, bold: true })), { text: 'Monto', bold: true, alignment: 'right' }],
          ...group.payments.map((payment: any) => [date(payment.fechaPago), payment.cliente || '—', String(payment.prestamo ?? ''), String(payment.cuota ?? ''), payment.tipoPago || '—', payment.origen || '—', { text: money(Number(payment.monto || 0)), alignment: 'right' }]),
          [{ text: 'Subtotal', colSpan: 6, bold: true }, {}, {}, {}, {}, {}, { text: money(subtotal), alignment: 'right', bold: true }]
        ] }, layout: 'lightHorizontalLines', fontSize: 8, margin: [0, 0, 0, 10] });
      }
      if (!groups.length) content.push({ text: 'No hay cobros registrados en el período seleccionado.', italics: true, color: '#666' });
      const pdfMake = (await import('pdfmake/build/pdfmake')).default;
      const pdfFonts = await import('pdfmake/build/vfs_fonts');
      (pdfMake as any).vfs = (pdfFonts as any).pdfMake?.vfs || (pdfFonts as any).default?.pdfMake?.vfs;
      const doc: any = {
        pageSize: 'LETTER', pageOrientation: 'landscape', pageMargins: [32, 30, 32, 34], content,
        styles: { title: { fontSize: 15, bold: true, margin: [0, 0, 0, 8] }, section: { fontSize: 11, bold: true, color: '#155795', margin: [0, 8, 0, 5] } },
        defaultStyle: { fontSize: 9 },
        footer: (page: number, pages: number) => ({ text: `Cobros por vendedor · ${page} de ${pages}`, alignment: 'center', fontSize: 8, margin: [0, 12, 0, 0] })
      };
      await this.pdfPreview.show((pdfMake as any).createPdf(doc), 'Cobros por vendedor', `cobros-por-vendedor-${this.desde}-al-${this.hasta}.pdf`);
    } catch (error) {
      console.error('No se pudo generar el reporte de cobros por vendedor:', error);
      alerts.basicAlert('Error', error instanceof Error ? error.message : 'No se pudo generar el reporte PDF.', 'error');
    } finally {
      this.printingPdf = false;
    }
  }
}
