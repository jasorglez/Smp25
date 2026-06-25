import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { PdfShareButtonsComponent } from 'app/shared/components/pdf-share-buttons/pdf-share-buttons.component';

@Component({
  selector: 'app-detalles-remisiones',
  standalone: true,
  imports: [CommonModule, FormsModule, PdfShareButtonsComponent],
  template: `
    <div class="p-2" *ngIf="detailType === 'detalle'">
      <div class="d-flex justify-content-end mb-2">
        <button class="btn btn-sm btn-outline-secondary me-2" type="button" (click)="closeDetail()">
          <i class="bi bi-x-lg me-1"></i> Cerrar
        </button>
        <button class="btn btn-sm btn-outline-danger" type="button" (click)="showPdfInCascade()">
          <i class="bi bi-file-earmark-pdf-fill me-1"></i> Ver PDF
        </button>
      </div>

      <div class="table-responsive">
        <table class="table table-sm table-striped table-bordered align-middle mb-0">
          <thead class="table-light">
            <tr>
              <th class="text-center" style="width: 56px;">PDF</th>
              <th>Pedido</th>
              <th>Detalle</th>
              <th>Producto</th>
              <th>Cant. pedido</th>
              <th>Cant. remitida</th>
              <th class="text-center" style="width: 150px;">Acciones</th>
              <th>Venta</th>
              <th>Impuesto</th>
              <th>Total</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let row of rows">
              <td class="text-center">
                <i
                  class="bi bi-file-earmark-pdf-fill text-danger"
                  title="Imprimir ticket del pedido"
                  style="font-size:1.1rem; cursor:pointer;"
                  (click)="printPedido(row)">
                </i>
              </td>
              <td>{{ getPedidoNumber(row) }}</td>
              <td>{{ row.idDetallePedido }}</td>
              <td>{{ row.producto }}</td>
              <td>{{ formatNumber(row.cantidad) }}</td>
              <td>
                <input
                  class="form-control form-control-sm"
                  type="number"
                  min="0.01"
                  step="0.01"
                  [max]="row?.cantidad || 0"
                  [(ngModel)]="row.__editCantidadRemitida"
                  (keydown.enter)="saveCantidad(row)"
                />
              </td>
              <td class="text-center">
                <div class="d-flex justify-content-center gap-1">
                  <button
                    class="btn btn-sm btn-success"
                    type="button"
                    title="Guardar cantidad remitida"
                    [disabled]="isBusy(row)"
                    (click)="saveCantidad(row)">
                    <i class="bi bi-floppy"></i>
                  </button>
                  <button
                    class="btn btn-sm btn-danger"
                    type="button"
                    title="Eliminar detalle de la remisión"
                    [disabled]="isBusy(row)"
                    (click)="deleteDetalle(row)">
                    <i class="bi bi-trash"></i>
                  </button>
                </div>
              </td>
              <td>{{ formatCurrency(row.venta) }}</td>
              <td>{{ formatCurrency(row.impuesto) }}</td>
              <td>{{ formatCurrency(row.totalLinea) }}</td>
              <td>{{ row.estado }}</td>
            </tr>
            <tr *ngIf="rows.length === 0">
              <td colspan="11" class="text-center text-muted">Sin renglones en esta remisión.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="p-2" *ngIf="detailType === 'pdf'">
      <div class="d-flex justify-content-between align-items-center mb-2">
        <div class="fw-semibold text-secondary">Vista previa PDF - Remisión {{ remision?.folio || remision?.id }}</div>
        <div class="d-flex align-items-center gap-2">
          <app-pdf-share-buttons
            [getPdfBlob]="getPdfBlobFn"
            [fileName]="'Remision_' + (remision?.folio || remision?.id) + '.pdf'"
            [subject]="'Remisión ' + (remision?.folio || remision?.id)">
          </app-pdf-share-buttons>
          <button class="btn btn-sm btn-outline-secondary" type="button" (click)="closePdfView()">
            <i class="bi bi-x-lg me-1"></i> Cerrar
          </button>
        </div>
      </div>
      <div style="height: 560px; border: 1px solid #dee2e6; border-radius: 0.375rem; overflow: hidden;">
        <iframe *ngIf="pdfUrl" [src]="pdfUrl" style="width: 100%; height: 100%; border: none;"></iframe>
        <div *ngIf="!pdfUrl && loadingPdf" class="d-flex justify-content-center align-items-center h-100 text-muted">
          Generando vista previa del PDF...
        </div>
        <div *ngIf="!pdfUrl && !loadingPdf" class="d-flex justify-content-center align-items-center h-100 text-muted">
          No se pudo generar la vista previa del PDF.
        </div>
      </div>
    </div>
  `,
})
export class DetallesRemisionesComponent implements ICellRendererAngularComp {
  private sanitizer = inject(DomSanitizer);
  private params!: ICellRendererParams;
  remision: any = null;
  rows: any[] = [];
  detailType: 'detalle' | 'pdf' = 'detalle';
  pdfUrl: SafeResourceUrl | null = null;
  loadingPdf = false;
  private busyMap: Record<string, boolean> = {};

  getPdfBlobFn = (): Promise<Blob> => {
    const url = this.remision?.detailPdfUrl;
    if (!url) return Promise.reject('No hay PDF generado');
    return fetch(url).then(r => r.blob());
  };

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.remision = params?.data || null;
    this.rows = Array.isArray(this.remision?.detailData) ? this.remision.detailData : [];
    this.detailType = (this.remision?.detailType === 'pdf') ? 'pdf' : 'detalle';
    this.loadingPdf = !!this.remision?.detailPdfLoading;
    this.prepareEditableRows();
    this.pdfUrl = this.remision?.detailPdfUrl
      ? this.sanitizer.bypassSecurityTrustResourceUrl(this.remision.detailPdfUrl)
      : null;
  }

  refresh(params: ICellRendererParams): boolean {
    this.params = params;
    this.remision = params?.data || null;
    this.rows = Array.isArray(this.remision?.detailData) ? this.remision.detailData : [];
    this.detailType = (this.remision?.detailType === 'pdf') ? 'pdf' : 'detalle';
    this.loadingPdf = !!this.remision?.detailPdfLoading;
    this.prepareEditableRows();
    this.pdfUrl = this.remision?.detailPdfUrl
      ? this.sanitizer.bypassSecurityTrustResourceUrl(this.remision.detailPdfUrl)
      : null;
    return true;
  }

  private prepareEditableRows(): void {
    this.rows = (this.rows || []).map((row: any) => ({
      ...row,
      __editCantidadRemitida:
        Number(row?.__editCantidadRemitida ?? row?.cantidadRemitida ?? row?.CantidadRemitida ?? 0),
    }));
  }

  showPdfInCascade(): void {
    this.params?.context?.componentParent?.toggleDetallePdfById?.(this.remision?.id);
  }

  printPedido(row: any): void {
    this.params?.context?.componentParent?.printPedidoTicketFromCascade?.(this.remision, row, this.rows);
  }

  formatCurrency(value: unknown): string {
    const numericValue = Number(value) || 0;
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(numericValue);
  }

  formatNumber(value: unknown): string {
    const numericValue = Number(value) || 0;
    return new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 }).format(numericValue);
  }

  getPedidoNumber(row: any): string {
    return this.params?.context?.componentParent?.getPedidoNumber?.(row) ?? String(row?.idPedido ?? '-');
  }

  private getRowKey(row: any): string {
    return String(
      row?.id ??
      row?.Id ??
      row?.idRemisionDetalle ??
      row?.IdRemisionDetalle ??
      row?.idDetalleRemision ??
      row?.IdDetalleRemision ??
      row?.idDetallePedido ??
      row?.IdDetallePedido ??
      Math.random()
    );
  }

  isBusy(row: any): boolean {
    return !!this.busyMap[this.getRowKey(row)];
  }

  async saveCantidad(row: any): Promise<void> {
    if (!this.remision?.id || !row) return;
    const key = this.getRowKey(row);
    if (this.busyMap[key]) return;

    const cantidadNueva = Number(row?.__editCantidadRemitida ?? 0);
    const cantidadPedido = Number(row?.cantidad ?? 0);
    if (!Number.isFinite(cantidadNueva) || cantidadNueva <= 0) return;
    if (cantidadPedido > 0 && cantidadNueva > cantidadPedido) return;

    this.busyMap[key] = true;
    try {
      await this.params?.context?.componentParent?.updateDetalleCantidadById?.(this.remision.id, row, cantidadNueva);
    } finally {
      this.busyMap[key] = false;
    }
  }

  async deleteDetalle(row: any): Promise<void> {
    if (!this.remision?.id || !row) return;
    const key = this.getRowKey(row);
    if (this.busyMap[key]) return;

    this.busyMap[key] = true;
    try {
      await this.params?.context?.componentParent?.deleteDetalleById?.(this.remision.id, row);
    } finally {
      this.busyMap[key] = false;
    }
  }

  closePdfView(): void {
    this.params?.context?.componentParent?.closeDetallePdfById?.(this.remision?.id);
  }

  closeDetail(): void {
    this.params?.context?.componentParent?.closeFocusedDetalleById?.(this.remision?.id);
  }
}
