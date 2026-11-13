import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, inject } from '@angular/core';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { firstValueFrom } from 'rxjs';
import { CustomersService } from 'app/services/customers.service';
import { alerts } from 'app/helpers/alerts';

@Component({
  selector: 'app-clientes-cobranzas-pagos',
  standalone: true,
  imports: [CommonModule, AgGridAngular],
  template: `
    <section class="p-3 border-top bg-light">
      <div class="d-flex justify-content-between align-items-center gap-2 mb-2 flex-wrap">
        <div class="d-flex align-items-center gap-2">
          <strong>Pagos — {{ customer?.nameContact || customer?.company }}</strong>
          <span class="badge bg-success">Total abonado: {{ totalAbonado | currency:'MXN' }}</span>
        </div>
        <div class="d-flex gap-2 ms-auto">
          <button class="btn btn-sm btn-primary" (click)="addRow()" title="Agregar pago"><i class="bi bi-plus-lg"></i> Agregar</button>
          <button class="btn btn-sm btn-success position-relative" (click)="saveChanges()" [disabled]="!hasChanges || saving"><i class="bi bi-floppy"></i> Guardar
            <span *ngIf="hasChanges" class="position-absolute top-0 start-100 translate-middle p-2 bg-danger border border-light rounded-circle"></span>
          </button>
          <button class="btn btn-sm btn-warning" (click)="revertChanges()" [disabled]="!hasChanges"><i class="bi bi-arrow-clockwise"></i> Deshacer</button>
          <button class="btn btn-sm btn-danger" (click)="deleteSelected()" [disabled]="!selectedPayment"><i class="bi bi-trash"></i> Borrar</button>
        </div>
      </div>
      <ag-grid-angular class="ag-theme-quartz" style="width:100%;height:260px" [rowData]="rowData" [columnDefs]="columnDefs" [defaultColDef]="defaultColDef" [gridOptions]="gridOptions" rowSelection="single" (gridReady)="onGridReady($event)" (selectionChanged)="onSelectionChanged()"></ag-grid-angular>
      <div *ngIf="!loading && !rowData.length" class="text-center text-muted small py-2">Sin pagos registrados. Agrega una fila para capturar el primer abono.</div>
    </section>
  `
})
export class ClientesCobranzasPagosComponent implements OnChanges {
  @Input() customer: any;
  private customersService = inject(CustomersService);
  gridApi?: GridApi;
  rowData: any[] = [];
  loading = false;
  saving = false;
  hasChanges = false;
  selectedPayment: any = null;
  private tempId = 0;

  columnDefs: ColDef[] = [
    { field: 'fechaPago', headerName: 'Fecha de pago', editable: true, width: 150, cellDataType: 'dateString' },
    { field: 'comentario', headerName: 'Comentario', editable: true, flex: 1, minWidth: 200, cellEditor: 'agLargeTextCellEditor', cellEditorPopup: true, cellEditorParams: { maxLength: 500, rows: 3, cols: 50 } },
    { field: 'monto', headerName: 'Monto', editable: true, width: 160, cellDataType: 'number', valueFormatter: p => p.value == null || p.value === '' ? '' : Number(p.value).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }) },
    { field: 'inicio', headerName: 'Registrado', editable: false, width: 170, valueFormatter: p => p.value ? new Date(p.value).toLocaleString('es-MX') : '' }
  ];
  defaultColDef: ColDef = { sortable: true, resizable: true, filter: true };
  gridOptions: any = {
    headerHeight: 30,
    rowHeight: 32,
    getRowId: p => String(p.data.id),
    onCellValueChanged: (event: any) => { event.data.__modified = true; this.hasChanges = true; }
  };

  get totalAbonado(): number { return this.rowData.reduce((sum, item) => sum + (item.__delete ? 0 : Number(item.monto || 0)), 0); }
  ngOnChanges(): void { this.loadPayments(); }
  onGridReady(event: GridReadyEvent): void { this.gridApi = event.api; }
  onSelectionChanged(): void { this.selectedPayment = this.gridApi?.getSelectedRows()?.[0] || null; }

  private today(): string { return new Date().toISOString().slice(0, 10); }

  loadPayments(): void {
    if (!this.customer?.id) { this.rowData = []; return; }
    this.loading = true;
    this.customersService.getCobranzaPayments(this.customer.id).subscribe({
      next: (rows: any[]) => { this.rowData = (rows || []).map(p => ({ ...p, fechaPago: String(p.fechaPago || '').slice(0, 10) })); this.loading = false; this.hasChanges = false; },
      error: error => { console.error(error); this.loading = false; alerts.basicAlert('Error', 'No se pudo cargar el historial de pagos.', 'error'); }
    });
  }

  addRow(): void {
    if (!this.customer?.id) return;
    const row = { id: `tmp-${this.tempId++}`, idCustomer: this.customer.id, fechaPago: this.today(), comentario: '', monto: null, __new: true };
    this.rowData = [row, ...this.rowData];
    this.hasChanges = true;
    setTimeout(() => { this.gridApi?.startEditingCell({ rowIndex: 0, colKey: 'monto' }); }, 50);
  }

  async saveChanges(): Promise<void> {
    this.gridApi?.stopEditing();
    const rows = this.rowData.filter(r => r.__new || r.__modified);
    if (!rows.length) return;
    const invalid = rows.find(r => !r.fechaPago || !Number.isFinite(Number(r.monto)) || Number(r.monto) <= 0);
    if (invalid) { alerts.basicAlert('Datos requeridos', 'Cada pago necesita fecha y un monto mayor a cero.', 'warning'); return; }
    this.saving = true;
    try {
      for (const row of rows) {
        const payload = { idCustomer: this.customer.id, fechaPago: row.fechaPago, comentario: row.comentario || '', monto: Number(row.monto) };
        if (row.__new) await firstValueFrom(this.customersService.addCobranzaPayment(payload));
        else await firstValueFrom(this.customersService.updateCobranzaPayment(row.id, payload));
      }
      this.saving = false;
      this.loadPayments();
      alerts.basicAlert('Éxito', 'Pagos guardados correctamente.', 'success');
    } catch (error) { console.error(error); this.saving = false; alerts.basicAlert('Error', 'No se pudieron guardar los pagos.', 'error'); }
  }

  revertChanges(): void { this.loadPayments(); }

  async deleteSelected(): Promise<void> {
    if (!this.selectedPayment) return;
    const payment = this.selectedPayment;
    const confirm = await alerts.confirmAlert('Quitar pago', 'El pago se conservará en el historial como inactivo.', 'warning', 'Sí, quitar');
    if (!confirm.isConfirmed) return;
    if (payment.__new) {
      this.rowData = this.rowData.filter(row => row !== payment);
      this.hasChanges = this.rowData.some(row => row.__new || row.__modified);
      this.selectedPayment = null;
      return;
    }
    this.customersService.deactivateCobranzaPayment(payment.id).subscribe({ next: () => this.loadPayments(), error: error => { console.error(error); alerts.basicAlert('Error', 'No se pudo quitar el pago.', 'error'); } });
  }
}
