import { CommonModule } from '@angular/common';
import { Component, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-community';
import { lastValueFrom } from 'rxjs';
import { GastosService, ExpenseReport, ExpenseReportCell, PendingPayment, ConfirmPaymentPayload } from 'app/services/gastos.service';
import { SignalsService } from 'app/services/signals.service';
import { SetupService } from 'app/services/setup.service';
import { StyledTooltipComponent } from 'app/shared/styled-tooltip/styled-tooltip.component';
import { alerts } from 'app/helpers/alerts';
import * as XLSX from 'xlsx';

type Lens = 'PAGADO' | 'COMPROMETIDO';
type Period = 'HOY' | 'SEMANA' | 'MES' | 'RANGO';
type Tab = 'captura' | 'historico' | 'reporte';

interface PivotAxis { id: number; name: string; total: number; }

@Component({
  selector: 'app-gastos',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  templateUrl: './gastos.component.html',
  styleUrls: ['./gastos.component.scss'],
})
export class GastosComponent {
  private gastosService = inject(GastosService);
  private signalsService = inject(SignalsService);
  private setupService = inject(SetupService);

  // IVA % por sucursal (mismo origen que la cotización: setup de almacén por branch)
  private ivaByBranch = new Map<number, number>();

  idCompany: number | null = null;

  // Pestaña activa
  activeTab: Tab = 'captura';

  // Filtros
  lens: Lens = 'PAGADO';
  period: Period = 'HOY';
  startDate: string = this.toIso(new Date());
  endDate: string = this.toIso(new Date());

  // Estado
  loading = false;
  errorMsg = '';
  report: ExpenseReport | null = null;

  // Pivote calculado
  branches: PivotAxis[] = [];   // filas
  departments: PivotAxis[] = []; // columnas
  matrix: Map<string, ExpenseReportCell> = new Map(); // key `${idBranch}_${idDept}`
  grandTotal = 0;
  totalTransacciones = 0;
  topDepartment: PivotAxis | null = null;
  topBranch: PivotAxis | null = null;
  maxCellValue = 0; // para el heatmap

  // ─── Captura (Parte A) ─────────────────────────────────────
  capturaLoading = false;
  capturaError = '';
  capturaRows: PendingPayment[] = [];
  hasUnsavedCaptura = false;
  private capturaGridApi?: GridApi;

  capturaColDefs: ColDef[] = [
    { field: 'branchName', headerName: 'Sucursal', width: 110, pinned: 'left' },
    {
      field: 'fechaPago', headerName: 'Fecha Pago', width: 140,
      editable: true, cellEditor: 'agDateStringCellEditor',
      cellStyle: { backgroundColor: '#fffde7' },
      valueFormatter: (p: any) => this.fmtDate(p.value),
    },
    { field: 'folio', headerName: 'Folio', width: 150 },
    {
      headerName: 'Tipo Req', width: 160,
      valueGetter: (p: any) => p.data?.docType === 'CR' ? 'Compra Rápida' : (p.data?.tipoOc || '—'),
    },
    { field: 'articulo', headerName: 'Artículo', width: 150 },
    { field: 'numArticulo', headerName: 'Num. Articulo', width: 130 },
    {
      field: 'proveedor', headerName: 'Proveedor', width: 150,
      editable: (p: any) => p.data?.docType === 'CR',
      cellStyle: (p: any) => p.data?.docType === 'CR' ? { backgroundColor: '#fffde7' } : null,
    },
    {
      field: 'notaFactura', headerName: 'Nota / Factura', width: 140,
      editable: true, cellStyle: { backgroundColor: '#fffde7' },
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: { values: ['Nota', 'Factura'] },
    },
    {
      field: 'masIva', headerName: 'IVA', width: 70,
      editable: true, cellRenderer: 'agCheckboxCellRenderer',
      cellStyle: { backgroundColor: '#fffde7', textAlign: 'center' },
    },
    { field: 'cantidad', headerName: 'Cant.', width: 90, type: 'numericColumn' },
    {
      field: 'precioUnitario', headerName: 'P. Unit.', width: 100, type: 'numericColumn',
      editable: (p: any) => p.data?.docType === 'CR',
      cellEditor: 'agNumberCellEditor',
      valueFormatter: (p: any) => this.money(p.value),
      cellStyle: (p: any) => p.data?.docType === 'CR' ? { backgroundColor: '#fffde7' } : null,
      // Cuando el IVA está aplicado, el tooltip muestra el P. Unit. original (sin IVA).
      tooltipComponent: StyledTooltipComponent,
      tooltipValueGetter: (p: any) =>
        p.data?.masIva && p.data?.__precioBase != null
          ? `P. Unit. original (sin IVA)\n${this.money(p.data.__precioBase)}`
          : null,
    },
    {
      field: 'valorPago', headerName: 'Valor', width: 110, type: 'numericColumn',
      editable: false,                       // calculado: P. Unit. × Cant. (con IVA si aplica)
      valueFormatter: (p: any) => this.money(p.value),
      cellStyle: { backgroundColor: '#eef2f6', fontWeight: '600' },
    },
    {
      field: 'fechaRecepcion', headerName: 'Fecha Recep.', width: 120,
      valueFormatter: (p: any) => this.fmtDate(p.value),
    },
    {
      headerName: 'Acción', width: 110, pinned: 'right', sortable: false, filter: false,
      cellRenderer: () =>
        `<button style="background:#2e7d32;color:#fff;border:none;border-radius:5px;padding:3px 12px;font-size:0.78rem;font-weight:600;cursor:pointer;">✓ Pagar</button>`,
      onCellClicked: (p: any) => this.onPagar(p.data),
      cellStyle: { textAlign: 'center', cursor: 'pointer' },
    },
  ];

  capturaGridOptions: any = {
    headerHeight: 30,
    rowHeight: 30,
    tooltipShowDelay: 300,
    defaultColDef: { resizable: true, sortable: true, filter: true },
    onCellValueChanged: (event: any) => {
      const field = event?.colDef?.field;
      const row = event?.data;
      if (row) {
        if (field === 'masIva') {
          // IVA toggled → recalcular precio/valor como en la cotización.
          this.recalcRowIva(row);
        } else if (field === 'precioUnitario') {
          // Editaron P. Unit. (CR): el valor capturado es el mostrado; recalcular base y valor.
          const iva = this.ivaByBranch.get(row.idReference) ?? 0;
          (row as any).__precioBase = row.masIva ? (Number(row.precioUnitario) || 0) / (1 + iva / 100) : (Number(row.precioUnitario) || 0);
          row.valorPago = (Number(row.precioUnitario) || 0) * (Number(row.cantidad) || 0);
        }
        (row as any).__modified = true;
        if (field === 'masIva' || field === 'precioUnitario') {
          event.api.refreshCells({ rowNodes: [event.node], force: true });
        }
      }
      this.hasUnsavedCaptura = true;
    },
    onFirstDataRendered: (params: any) => params.api.autoSizeAllColumns(),
  };

  constructor() {
    effect(() => {
      const idCompany = this.signalsService.getRootSelectedBySidebar()();
      if (idCompany && idCompany !== this.idCompany) {
        this.idCompany = idCompany;
        this.loadReport();
        this.loadPending();
      }
    });
  }

  // ─── Pestañas ──────────────────────────────────────────────
  setTab(tab: Tab): void {
    if (this.activeTab === tab) return;
    this.activeTab = tab;
    if (tab === 'historico') this.loadHistorico();
  }

  // ─── Histórico de Pagos (Parte C) ──────────────────────────
  histLoading = false;
  histError = '';
  historicoRows: PendingPayment[] = [];
  private histGridApi?: GridApi;

  // Buscador / filtros
  histSearch = '';                 // búsqueda global (quick filter)
  histPeriod: '' | Period = '';    // filtro por fecha de pago
  histStart = '';
  histEnd = '';
  histProveedor = '';              // '' = todos
  histSucursal = '';               // '' = todas
  histProveedores: string[] = [];
  histSucursales: string[] = [];

  // Totales vivos (sobre lo filtrado)
  histCount = 0;
  histTotal = 0;

  historicoColDefs: ColDef[] = [
    { field: 'fechaPago', headerName: 'Fecha Pago', width: 120, filter: 'agDateColumnFilter', valueFormatter: (p: any) => this.fmtDate(p.value) },
    { field: 'branchName', headerName: 'Sucursal', width: 110 },
    { field: 'folio', headerName: 'Folio', width: 150 },
    { headerName: 'Tipo Req', width: 160, valueGetter: (p: any) => p.data?.docType === 'CR' ? 'Compra Rápida' : (p.data?.tipoOc || '—') },
    { field: 'articulo', headerName: 'Artículo', width: 150 },
    { field: 'numArticulo', headerName: 'Num. Articulo', width: 130, hide: true },   // oculta solo en el histórico
    { field: 'proveedor', headerName: 'Proveedor', width: 150 },
    { field: 'notaFactura', headerName: 'Nota / Factura', width: 130 },
    { field: 'masIva', headerName: 'IVA', width: 70, cellRenderer: 'agCheckboxCellRenderer', cellStyle: { textAlign: 'center' } },
    { field: 'cantidad', headerName: 'Cant.', width: 90, type: 'numericColumn' },
    {
      headerName: 'P. Unit.', width: 100, type: 'numericColumn',
      // P. Unit. efectivo pagado = valor / cantidad (ya incluye IVA porque el pago lo incluye).
      valueGetter: (p: any) => {
        const q = Number(p.data?.cantidad) || 0;
        const v = Number(p.data?.valorPago) || 0;
        return q > 0 ? Math.round((v / q) * 100) / 100 : 0;
      },
      valueFormatter: (p: any) => this.money(p.value),
    },
    { field: 'valorPago', headerName: 'Valor', width: 110, type: 'numericColumn', valueFormatter: (p: any) => this.money(p.value), cellStyle: { fontWeight: '600' } },
  ];

  historicoGridOptions: any = {
    headerHeight: 30,
    rowHeight: 30,
    defaultColDef: { resizable: true, sortable: true, filter: true },
    onFirstDataRendered: (p: any) => { p.api.autoSizeAllColumns(); this.recomputeHistTotals(); },
    isExternalFilterPresent: () => this.histHasExternalFilter(),
    doesExternalFilterPass: (node: any) => this.histFilterPass(node),
    onFilterChanged: () => this.recomputeHistTotals(),
  };

  onHistGridReady(e: GridReadyEvent): void {
    this.histGridApi = e.api;
  }

  loadHistorico(): void {
    if (!this.idCompany) return;
    this.histLoading = true;
    this.histError = '';
    this.gastosService.getPaidPayments(this.idCompany).subscribe({
      next: (rows) => {
        this.historicoRows = rows ?? [];
        this.histProveedores = [...new Set(this.historicoRows.map(r => r.proveedor || '').filter(Boolean))].sort();
        this.histSucursales = [...new Set(this.historicoRows.map(r => r.branchName || '').filter(Boolean))].sort();
        this.histLoading = false;
        setTimeout(() => { this.histGridApi?.autoSizeAllColumns(); this.recomputeHistTotals(); }, 0);
      },
      error: (err) => {
        console.error('Error cargando histórico de pagos:', err);
        this.histError = 'No se pudo cargar el histórico de pagos.';
        this.historicoRows = [];
        this.histLoading = false;
      }
    });
  }

  // ─── Buscador del histórico ────────────────────────────────
  setHistPeriod(period: Period): void {
    this.histPeriod = period;
    const today = new Date();
    if (period === 'HOY') { this.histStart = this.toIso(today); this.histEnd = this.toIso(today); }
    else if (period === 'SEMANA') {
      const monday = new Date(today); const day = (today.getDay() + 6) % 7;
      monday.setDate(today.getDate() - day);
      this.histStart = this.toIso(monday); this.histEnd = this.toIso(today);
    } else if (period === 'MES') {
      this.histStart = this.toIso(new Date(today.getFullYear(), today.getMonth(), 1)); this.histEnd = this.toIso(today);
    }
    if (period !== 'RANGO') this.applyHistFilters();
  }

  onHistRangeChange(): void { this.histPeriod = 'RANGO'; this.applyHistFilters(); }

  applyHistFilters(): void {
    if (this.histGridApi) this.histGridApi.onFilterChanged(); // re-evalúa external filter + recalcula totales
  }

  clearHistFilters(): void {
    this.histSearch = ''; this.histPeriod = ''; this.histStart = ''; this.histEnd = '';
    this.histProveedor = ''; this.histSucursal = '';
    this.applyHistFilters();
  }

  private histHasExternalFilter(): boolean {
    return !!(this.histStart || this.histEnd || this.histProveedor || this.histSucursal);
  }

  private histFilterPass(node: any): boolean {
    const d = node?.data; if (!d) return true;
    if (this.histProveedor && (d.proveedor || '') !== this.histProveedor) return false;
    if (this.histSucursal && (d.branchName || '') !== this.histSucursal) return false;
    const fp = (d.fechaPago || '').toString().substring(0, 10);
    if (this.histStart && fp && fp < this.histStart) return false;
    if (this.histEnd && fp && fp > this.histEnd) return false;
    if ((this.histStart || this.histEnd) && !fp) return false;
    return true;
  }

  private recomputeHistTotals(): void {
    let count = 0, total = 0;
    this.histGridApi?.forEachNodeAfterFilterAndSort((n: any) => {
      count++; total += Number(n.data?.valorPago) || 0;
    });
    this.histCount = count;
    this.histTotal = total;
  }

  /** Exporta a Excel las filas actualmente filtradas del histórico. */
  exportHistExcel(): void {
    const rows: any[] = [];
    this.histGridApi?.forEachNodeAfterFilterAndSort((n: any) => {
      const d = n.data;
      const q = Number(d.cantidad) || 0; const v = Number(d.valorPago) || 0;
      rows.push({
        'Fecha Pago': this.fmtDate(d.fechaPago),
        'Sucursal': d.branchName,
        'Folio': d.folio,
        'Tipo Req': d.docType === 'CR' ? 'Compra Rápida' : (d.tipoOc || ''),
        'Artículo': d.articulo,
        'Num. Articulo': d.numArticulo || '',
        'Proveedor': d.proveedor || '',
        'Nota / Factura': d.notaFactura || '',
        'IVA': d.masIva ? 'Sí' : 'No',
        'Cantidad': q,
        'P. Unit.': q > 0 ? Math.round((v / q) * 100) / 100 : 0,
        'Valor': v,
      });
    });
    if (rows.length === 0) { alerts.basicAlert('Sin datos', 'No hay filas para exportar.', 'info'); return; }
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Histórico Pagos');
    XLSX.writeFile(wb, `historico_pagos_${this.toIso(new Date())}.xlsx`);
  }

  // ─── Captura: carga y acciones ─────────────────────────────
  onCapturaGridReady(e: GridReadyEvent): void {
    this.capturaGridApi = e.api;
  }

  loadPending(): void {
    if (!this.idCompany) return;
    this.capturaLoading = true;
    this.capturaError = '';
    this.gastosService.getPendingPayments(this.idCompany).subscribe({
      next: async (rows) => {
        const hoy = this.toIso(new Date());
        const list = (rows ?? []).map(r => ({ ...r, fechaPago: r.fechaPago ?? hoy }));
        // Pre-cargar IVA% de las sucursales presentes (mismo origen que la cotización).
        await this.preloadIvaForRows(list);
        // Opción B: detailsreqoc.price es SIEMPRE el precio BASE (sin IVA). No dividir.
        // El display (con IVA) y el Valor se recalculan a partir del base.
        list.forEach((r: any) => {
          r.__precioBase = Number(r.precioUnitario) || 0;
          this.recalcRowIva(r);
        });
        this.capturaRows = list;
        this.capturaLoading = false;
        // Re-autoajustar columnas tras recargar (onFirstDataRendered solo dispara la 1ª vez).
        setTimeout(() => this.capturaGridApi?.autoSizeAllColumns(), 0);
      },
      error: (err) => {
        console.error('Error cargando pendientes de pago:', err);
        this.capturaError = 'No se pudieron cargar las entradas pendientes de pago.';
        this.capturaRows = [];
        this.capturaLoading = false;
      }
    });
  }

  async onPagar(row: PendingPayment): Promise<void> {
    if (!row) return;
    if (row.docType === 'CR' && (!row.proveedor || String(row.proveedor).trim() === '')) {
      alerts.basicAlert('Falta proveedor', 'Captura el proveedor antes de pagar esta compra rápida.', 'warning');
      return;
    }

    const confirm = await alerts.confirmAlert(
      'Confirmar pago',
      `¿Confirmar el pago de ${this.money(row.valorPago)} para "${row.articulo}" (${row.folio})? Se liberará la entrada.`,
      'question', 'Sí, pagar'
    );
    if (!confirm.isConfirmed) return;

    this.gastosService.confirmPayment(this.buildPayload(row)).subscribe({
      next: () => {
        // La entrada quedó liberada → sale de la lista de pendientes.
        this.capturaRows = this.capturaRows.filter(r => r.idEntrada !== row.idEntrada);
        alerts.reqSuccessToast('Pago confirmado', `${row.folio} liberado.`);
        // Refrescar el reporte gerencial (cambió lo "Pagado/liberado").
        this.loadReport();
      },
      error: (err) => {
        console.error('Error confirmando pago:', err);
        alerts.reqErrorToast('Error', 'No se pudo confirmar el pago.');
      }
    });
  }

  /** Guarda los campos editables modificados SIN concluir el pago (no libera). */
  async saveCaptura(): Promise<void> {
    const modificadas = this.capturaRows.filter(r => (r as any).__modified);
    if (modificadas.length === 0) {
      alerts.basicAlert('Sin cambios', 'No hay cambios por guardar.', 'info');
      return;
    }
    try {
      await Promise.all(
        modificadas.map(r => lastValueFrom(this.gastosService.savePending(this.buildPayload(r))))
      );
      modificadas.forEach(r => { (r as any).__modified = false; });
      this.hasUnsavedCaptura = false;
      alerts.reqSuccessToast('Guardado', `${modificadas.length} fila(s) guardada(s).`);
    } catch (err) {
      console.error('Error guardando cambios de captura:', err);
      alerts.reqErrorToast('Error', 'No se pudieron guardar los cambios.');
    }
  }

  private buildPayload(row: PendingPayment): ConfirmPaymentPayload {
    return {
      idEntrada: row.idEntrada,
      idDetail: row.idDetail,
      idEntrega: row.idEntrega,
      docType: row.docType,
      closeSource: row.closeSource,
      valorPago: Number(row.valorPago) || 0,
      fechaPago: row.fechaPago ?? this.toIso(new Date()),
      proveedor: row.proveedor,
      // Opción B: se persiste el precio BASE (sin IVA) en detailsreqoc.price.
      precioUnitario: (row as any).__precioBase != null ? Number((row as any).__precioBase) : (row.precioUnitario != null ? Number(row.precioUnitario) : null),
      masIva: !!row.masIva,
      notaFactura: row.notaFactura,
      cantidad: Number(row.cantidad) || 0,
    };
  }

  fmtDate(value: any): string {
    if (!value) return '';
    const d = value instanceof Date ? value : new Date(value);
    if (isNaN(d.getTime())) return '';
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  }

  /** Carga el IVA% (setup de almacén) de las sucursales presentes que aún no estén en cache. */
  private async preloadIvaForRows(rows: any[]): Promise<void> {
    const branches = [...new Set(rows.map(r => r.idReference).filter(id => id && !this.ivaByBranch.has(id)))];
    await Promise.all(branches.map(async (idBranch) => {
      try {
        const setup: any = await lastValueFrom(this.setupService.getWarehouseSetupByBranch(idBranch));
        this.ivaByBranch.set(idBranch, Number(setup?.iva) || 0);
      } catch {
        this.ivaByBranch.set(idBranch, 0);
      }
    }));
  }

  /** Recalcula precio unitario y valor aplicando IVA igual que la cotización (precio = base*(1+iva%), valor = precio*cantidad). */
  private recalcRowIva(row: any): void {
    const iva = this.ivaByBranch.get(row.idReference) ?? 0;
    const base = Number(row.__precioBase ?? row.precioUnitario ?? 0);
    // Redondear el precio unitario con IVA a 2 dec ANTES de multiplicar (Opción A).
    const precio = Math.round((row.masIva ? base * (1 + iva / 100) : base) * 100) / 100;
    row.precioUnitario = precio;
    row.valorPago = precio * (Number(row.cantidad) || 0);
  }

  // ─── Filtros ───────────────────────────────────────────────

  setLens(lens: Lens): void {
    if (this.lens === lens) return;
    this.lens = lens;
    this.loadReport();
  }

  setPeriod(period: Period): void {
    this.period = period;
    const today = new Date();
    if (period === 'HOY') {
      this.startDate = this.toIso(today);
      this.endDate = this.toIso(today);
    } else if (period === 'SEMANA') {
      const monday = new Date(today);
      const day = (today.getDay() + 6) % 7; // lunes = 0
      monday.setDate(today.getDate() - day);
      this.startDate = this.toIso(monday);
      this.endDate = this.toIso(today);
    } else if (period === 'MES') {
      this.startDate = this.toIso(new Date(today.getFullYear(), today.getMonth(), 1));
      this.endDate = this.toIso(today);
    }
    if (period !== 'RANGO') {
      this.loadReport();
    }
  }

  onCustomDateChange(): void {
    this.period = 'RANGO';
    if (this.startDate && this.endDate && this.startDate <= this.endDate) {
      this.loadReport();
    }
  }

  // ─── Carga ─────────────────────────────────────────────────

  loadReport(): void {
    if (!this.idCompany) return;
    this.loading = true;
    this.errorMsg = '';

    this.gastosService.getExpenseReport(this.idCompany, this.startDate, this.endDate, this.lens).subscribe({
      next: (res) => {
        this.report = res;
        this.buildPivot(res);
        this.loading = false;
      },
      error: (err) => {
        console.error('Error cargando reporte de gastos:', err);
        this.errorMsg = 'No se pudo cargar el reporte de gastos.';
        this.report = null;
        this.resetPivot();
        this.loading = false;
      }
    });
  }

  private buildPivot(res: ExpenseReport): void {
    this.resetPivot();
    if (!res?.cells?.length) return;

    const branchMap = new Map<number, PivotAxis>();
    const deptMap = new Map<number, PivotAxis>();

    for (const c of res.cells) {
      this.matrix.set(`${c.idBranch}_${c.idDepartament}`, c);

      const b = branchMap.get(c.idBranch) ?? { id: c.idBranch, name: c.branchName, total: 0 };
      b.total += c.total;
      branchMap.set(c.idBranch, b);

      const d = deptMap.get(c.idDepartament) ?? { id: c.idDepartament, name: c.departmentName, total: 0 };
      d.total += c.total;
      deptMap.set(c.idDepartament, d);

      if (c.total > this.maxCellValue) this.maxCellValue = c.total;
    }

    this.branches = [...branchMap.values()].sort((a, b) => b.total - a.total);
    this.departments = [...deptMap.values()].sort((a, b) => b.total - a.total);
    this.grandTotal = res.grandTotal;
    this.totalTransacciones = res.totalTransacciones;
    this.topDepartment = this.departments.length ? this.departments[0] : null;
    this.topBranch = this.branches.length ? this.branches[0] : null;
  }

  private resetPivot(): void {
    this.branches = [];
    this.departments = [];
    this.matrix.clear();
    this.grandTotal = 0;
    this.totalTransacciones = 0;
    this.topDepartment = null;
    this.topBranch = null;
    this.maxCellValue = 0;
  }

  // ─── Helpers de plantilla ──────────────────────────────────

  cell(idBranch: number, idDept: number): ExpenseReportCell | null {
    return this.matrix.get(`${idBranch}_${idDept}`) ?? null;
  }

  cellValue(idBranch: number, idDept: number): number {
    return this.cell(idBranch, idDept)?.total ?? 0;
  }

  /** Intensidad 0–1 para el heatmap de la celda. */
  cellIntensity(idBranch: number, idDept: number): number {
    if (this.maxCellValue <= 0) return 0;
    const v = this.cellValue(idBranch, idDept);
    return v <= 0 ? 0 : v / this.maxCellValue;
  }

  cellBg(idBranch: number, idDept: number): string {
    const t = this.cellIntensity(idBranch, idDept);
    if (t <= 0) return 'transparent';
    // Verde claro → verde fuerte según intensidad (lente Pagado = dinero salido)
    const alpha = 0.08 + t * 0.42;
    return `rgba(46, 125, 50, ${alpha.toFixed(3)})`;
  }

  money(value: number): string {
    return (value ?? 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
  }

  get periodLabel(): string {
    if (this.startDate === this.endDate) return this.prettyDate(this.startDate);
    return `${this.prettyDate(this.startDate)} — ${this.prettyDate(this.endDate)}`;
  }

  private prettyDate(iso: string): string {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  private toIso(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}
