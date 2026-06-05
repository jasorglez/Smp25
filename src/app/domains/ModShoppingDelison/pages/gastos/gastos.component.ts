import { CommonModule } from '@angular/common';
import { Component, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-community';
import { lastValueFrom } from 'rxjs';
import { GastosService, ExpenseReport, ExpenseReportCell, PendingPayment, ConfirmPaymentPayload } from 'app/services/gastos.service';
import { SignalsService } from 'app/services/signals.service';
import { SetupService } from 'app/services/setup.service';
import { GridStatePersistenceService } from 'app/services/grid-state-persistence.service';
import { StyledTooltipComponent } from 'app/shared/styled-tooltip/styled-tooltip.component';
import { CustomersService } from 'app/services/customers.service';
import { ProvidersService } from 'app/services/providers.service';
import { SucursalByMaterialProveedorService } from 'app/services/sucursalByMaterialProveedor.service';
import { alerts } from 'app/helpers/alerts';
import { NgSelectModule } from '@ng-select/ng-select';
import { CrProveedorEditorComponent } from './cr-proveedor-editor.component';
import * as XLSX from 'xlsx';

type Lens = 'PAGADO' | 'COMPROMETIDO';
type Period = 'HOY' | 'SEMANA' | 'MES' | 'RANGO';
type Tab = 'captura' | 'historico' | 'reporte';

interface PivotAxis { id: number; name: string; total: number; }

@Component({
  selector: 'app-gastos',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, NgSelectModule, CrProveedorEditorComponent],
  templateUrl: './gastos.component.html',
  styleUrls: ['./gastos.component.scss'],
})
export class GastosComponent {
  private gastosService = inject(GastosService);
  private signalsService = inject(SignalsService);
  private setupService = inject(SetupService);
  private gridState = inject(GridStatePersistenceService);
  private customersService = inject(CustomersService);
  private providersService = inject(ProvidersService);
  private sucursalByMaterialService = inject(SucursalByMaterialProveedorService);

  // ── Dropdown de proveedor para filas CR ─────────────────────────────────────
  private readonly NEW_PROVIDER_SENTINEL = -1;
  principalProviderIds = new Set<number>();
  crProviders: any[] = [];          // lista completa con headers (para el ng-select modal si se usa en otro lado)
  crInactiveProviders: { id: number; name: string; raw: any }[] = [];  // externos inactivos (active=0) para validar duplicados / reactivar
  // Lista plana de nombres para agRichSelectCellEditor (sin headers ni "+ Nuevo Proveedor").
  get crProviderNames(): string[] {
    return this.crProviders
      .filter(p => !p.__isHeader && p.id !== this.NEW_PROVIDER_SENTINEL)
      .map(p => p.description);
  }
  crProviderRow: any = null;        // fila CR actualmente editando proveedor
  crProviderSelectedId: number | null = null;

  // Persistencia de columnas (por usuario, en BD) — clave única de este grid.
  private readonly CAPTURA_GRID_KEY = 'gastos-captura';
  private capturaHasSavedState = false; // hay estado guardado → no autoSize
  private capturaStateLoaded = false;   // ya cargó/aplicó → habilita guardar

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
    { field: 'folio', headerName: 'Folio entrega', width: 170 },
    {
      headerName: 'Tipo Req', width: 160,
      valueGetter: (p: any) => p.data?.docType === 'ANTICIPO' ? 'Anticipo'
        : (p.data?.docType === 'CR' ? 'Compra Rápida' : (p.data?.tipoOc || '—')),
    },
    {
      field: 'articulo', headerName: 'Artículo', width: 150,
      // Anticipo: la celda solo dice "Artículo" (subrayado punteado) y el desglose va en el tooltip.
      cellRenderer: (p: any) => p.data?.docType === 'ANTICIPO' ? 'Anticipo' : (p.value ?? ''),
      cellStyle: (p: any) => p.data?.docType === 'ANTICIPO'
        ? { textDecoration: 'underline dotted', cursor: 'help' } : null,
      tooltipComponent: StyledTooltipComponent,
      tooltipValueGetter: (p: any) => this.buildAnticipoTooltip(p.data),
    },
    { field: 'numArticulo', headerName: 'Num. Articulo', width: 130 },
    {
      field: 'proveedor', headerName: 'Proveedor', width: 170,
      editable: (p: any) => p.data?.docType === 'CR',
      singleClickEdit: true,
      cellEditor: 'crProveedorEditor',
      cellEditorPopup: true,
      cellEditorParams: (params: any) => ({
        providers: this.crProviders,
        inactiveProviders: this.crInactiveProviders,
        // Validación al seleccionar proveedor existente (Sin Código Externo + Sucursal).
        // Retorna el nombre si pasa, null si el usuario cancela → el editor no cierra.
        onProviderSelected: (id: number, name: string) =>
          this.validateCrProvider(id, name, params?.data),
        // Al crear un nuevo proveedor, recargar lista y marcar fila modificada.
        onNewProviderCreated: (name: string) => {
          if (params?.data) {
            params.data.proveedor = name;
            (params.data as any).__modified = true;
            this.hasUnsavedCaptura = true;
            this.capturaGridApi?.refreshCells({ force: true });
          }
          if (this.idCompany) this.loadCrProviders(this.idCompany);
        },
      }),
      valueSetter: (params: any) => {
        if (params.newValue == null) return false;
        params.data.proveedor = params.newValue;
        (params.data as any).__modified = true;
        this.hasUnsavedCaptura = true;
        return true;
      },
      cellStyle: (p: any) => p.data?.docType === 'CR' && !p.data?.proveedor
        ? { backgroundColor: '#ffe0b2', fontStyle: 'italic', color: '#e65100' }
        : (p.data?.docType === 'CR' ? { backgroundColor: '#fffde7' } : null),
      cellRenderer: (p: any) => p.data?.docType === 'CR' && !p.data?.proveedor
        ? '<span style="color:#e65100;font-style:italic;">Seleccionar proveedor ▾</span>'
        : (p.value || ''),
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
    {
      field: 'cantidad', headerName: 'Cant.', width: 90, type: 'numericColumn',
      // Un anticipo no tiene cantidad (es un monto único) → mostrar "—".
      valueFormatter: (p: any) => p.data?.docType === 'ANTICIPO' ? '—' : p.value,
      tooltipComponent: StyledTooltipComponent,
      tooltipValueGetter: (p: any) => {
        if (p.data?.docType === 'ANTICIPO') return null;
        const req = Number(p.data?.cantidadReq) || 0;
        const oc  = Number(p.data?.cantidadOc)  || 0;
        if (!req && !oc) return null;
        return `CANTIDAD\nCantidad Requisición: ${req}\nCantidad OC: ${oc}`;
      },
    },
    {
      field: 'precioUnitario', headerName: 'P. Unit.', width: 100, type: 'numericColumn',
      editable: (p: any) => p.data?.docType === 'CR',
      cellEditor: 'agNumberCellEditor',
      // Un anticipo no tiene precio unitario → mostrar "—".
      valueFormatter: (p: any) => p.data?.docType === 'ANTICIPO' ? '—' : this.money(p.value),
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
      cellStyle: (p: any) => p.data?.docType === 'ANTICIPO'
        ? { backgroundColor: '#eef2f6', fontWeight: '600', textDecoration: 'underline dotted', cursor: 'help' }
        : { backgroundColor: '#eef2f6', fontWeight: '600' },
      // Anticipo: tooltip con Costo total OC y % del anticipo.
      tooltipComponent: StyledTooltipComponent,
      tooltipValueGetter: (p: any) => this.buildAnticipoValorTooltip(p.data),
    },
    {
      field: 'fechaRecepcion', headerName: 'Fecha Recep.', width: 120,
      valueFormatter: (p: any) => this.fmtDate(p.value),
    },
    {
      headerName: 'Acción', width: 150, pinned: 'right', sortable: false, filter: false,
      // Tooltip estándar (StyledTooltipComponent): días de crédito en el botón Crédito,
      // o saldo de anticipo en el botón Pagar (crédito/anticipo son excluyentes por fila).
      tooltipComponent: StyledTooltipComponent,
      tooltipValueGetter: (p: any) => {
        const d = p.data || {};
        // Bloqueo secuencial → prioridad máxima
        if (this.isPagarBloqueadoPorSecuencia(d)) {
          return `PAGO BLOQUEADO\nDebes pagar primero la entrada anterior de este artículo`;
        }
        // Compra rápida sin proveedor
        if (d.docType === 'CR' && (!d.proveedor || String(d.proveedor).trim() === '')) {
          return `PAGO BLOQUEADO\nCaptura el proveedor antes de pagar`;
        }
        // Compra rápida sin precio unitario
        if (d.docType === 'CR' && !(Number(d.precioUnitario) > 0)) {
          return `PAGO BLOQUEADO\nCaptura el precio unitario antes de pagar`;
        }
        // Compra rápida con cambios sin guardar
        if (d.docType === 'CR' && d.__modified === true) {
          return `PAGO BLOQUEADO\nGuarda los cambios antes de pagar`;
        }
        // Anticipo requerido pero aún no PAGADO → bloquear la entrega hasta pagar el anticipo.
        if (d.calculoAnticipo === true && d.anticipoPagado !== true) {
          return `PAGO BLOQUEADO\nRegistra y paga el anticipo\nde esta OC antes de continuar.`;
        }
        // Crédito → botón Crédito
        if (d.calculoAnticipo === false && Number(d.condicionCantidad) > 0 && d.credito !== true) {
          const dias = Number(d.condicionCantidad) || 0;
          return `CRÉDITO\n${dias} días de crédito`;
        }
        // Anticipo (abono) → botón Pagar
        if (d.calculoAnticipo === true) {
          const monto = Number(d.anticipoMonto) || 0;
          const saldo = Number(d.anticipoSaldo) || 0;
          const pct   = Number(d.condicionCantidad) || 0;
          return d.anticipoPagado
            ? `ANTICIPO\nAnticipo: ${pct}% ${this.money(monto)}\nSaldo disponible: ${this.money(saldo)}`
            : `ANTICIPO\nAnticipo por registrar: ${pct}% ${this.money(monto)}`;
        }
        return null;
      },
      cellRenderer: (p: any) => {
        const esCredito = p.data?.calculoAnticipo === false && Number(p.data?.condicionCantidad) > 0;
        const yaCredito = p.data?.credito === true;
        const ghost = 'background:none;border:none;padding:2px 6px;font-size:0.74rem;font-weight:500;border-radius:4px;';
        // Si la entrada ya está a crédito, bloquear "Pagar" hasta que llegue la fecha de vencimiento.
        const vencDate = yaCredito ? this.computeVencimiento(p.data) : '';
        const hoy = this.toIso(new Date());
        const pagarBloqueadoVenc = yaCredito && !!vencDate && hoy < vencDate;
        // Bloqueo secuencial: si existe una entrada anterior (misma OC + mismo artículo) aún pendiente.
        const pagarBloqueadoSeq = this.isPagarBloqueadoPorSecuencia(p.data);
        // Compra rápida sin precio unitario o sin proveedor capturado → no se puede pagar.
        const esCR = p.data?.docType === 'CR';
        const pagarBloqueadoPrecio = esCR && !(Number(p.data?.precioUnitario) > 0);
        const pagarBloqueadoProv = esCR && (!p.data?.proveedor || String(p.data?.proveedor).trim() === '');
        // Cambios sin guardar en la fila → debe guardar antes de pagar.
        const pagarBloqueadoModif = esCR && p.data?.__modified === true;
        // Anticipo requerido pero no registrado (aplica a cualquier docType).
        const pagarBloqueadoAnticipo = p.data?.calculoAnticipo === true && p.data?.anticipoPagado !== true;
        const pagarBloqueado = pagarBloqueadoVenc || pagarBloqueadoSeq || pagarBloqueadoPrecio || pagarBloqueadoProv || pagarBloqueadoModif || pagarBloqueadoAnticipo;
        const btnPagar = pagarBloqueado
          ? `<button class="gx-pagar" disabled style="${ghost}color:#bbb;cursor:not-allowed;opacity:0.55;">Pagar</button>`
          : `<button class="gx-pagar" style="${ghost}color:#2e7d32;cursor:pointer;">Pagar</button>`;
        const btnCredito = (esCredito && !yaCredito)
          ? `<button class="gx-credito" style="${ghost}color:#ef6c00;cursor:pointer;">Crédito</button>`
          : '';
        const venceLbl = yaCredito
          ? `<span class="gx-vence-date" title="Click para editar fecha de vencimiento" style="font-size:0.68rem;color:#ef6c00;cursor:pointer;text-decoration:underline dotted;white-space:nowrap;">vence ${this.fmtDate(vencDate)} ✏️</span>`
          : '';
        return `<div style="display:flex;gap:2px;justify-content:center;align-items:center;height:100%;">${btnCredito}${btnPagar}${venceLbl}</div>`;
      },
      onCellClicked: (p: any) => {
        const target = p.event?.target as HTMLElement;
        if (target?.closest?.('.gx-credito')) { this.onCredito(p.data); return; }
        if (target?.closest?.('.gx-pagar')) {
          const btn = target.closest('.gx-pagar') as HTMLButtonElement;
          if (btn?.disabled) return;
          this.onPagar(p.data); return;
        }
        if (target?.closest?.('.gx-vence-date')) { this.editVenceDate(p.data); return; }
      },
      cellStyle: { textAlign: 'center', cursor: 'pointer' },
    },
  ];

  capturaGridOptions: any = {
    headerHeight: 30,
    rowHeight: 30,
    tooltipShowDelay: 300,
    defaultColDef: { resizable: true, sortable: true, filter: true },
    components: { crProveedorEditor: CrProveedorEditorComponent },
    // Color de fila según la condición de pago (ver leyenda):
    // azul=anticipo, naranja=crédito, verde=sin anticipo ni crédito (contado).
    rowClassRules: {
      // La fila de anticipo (gasto general) también va azul.
      'gx-row-anticipo': (p: any) => p.data?.calculoAnticipo === true || p.data?.docType === 'ANTICIPO',
      'gx-row-credito':  (p: any) => p.data?.docType !== 'ANTICIPO' && p.data?.calculoAnticipo === false && Number(p.data?.condicionCantidad) > 0,
      'gx-row-contado':  (p: any) => p.data?.docType !== 'ANTICIPO' && p.data?.calculoAnticipo !== true && !(Number(p.data?.condicionCantidad) > 0),
    },
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
        // Refrescar la fila para reevaluar el bloqueo del botón Pagar (precio/proveedor en CR).
        if (field === 'masIva' || field === 'precioUnitario' || field === 'proveedor') {
          event.api.refreshCells({ rowNodes: [event.node], force: true });
        }
      }
      this.hasUnsavedCaptura = true;
    },
    // Respeta el ancho guardado: solo autoajusta si NO hay estado persistido.
    onFirstDataRendered: (params: any) => { if (!this.capturaHasSavedState) params.api.autoSizeAllColumns(); },
    // Persistencia de columnas (visibilidad + orden + ancho) por usuario en BD.
    onColumnVisible: (e: any) => this.persistCapturaState(e),
    onColumnMoved: (e: any) => this.persistCapturaState(e),
    onColumnResized: (e: any) => this.persistCapturaState(e),
  };

  // Guarda el columnState actual (con debounce en el servicio). Ignora eventos
  // previos a la carga inicial y los pasos intermedios del redimensionado.
  private persistCapturaState(e: any): void {
    if (!this.capturaStateLoaded || !this.capturaGridApi) return;
    if (e?.type === 'columnResized' && e.finished === false) return;
    this.gridState.saveState(this.CAPTURA_GRID_KEY, this.capturaGridApi.getColumnState());
  }

  constructor() {
    effect(() => {
      const idCompany = this.signalsService.getRootSelectedBySidebar()();
      if (idCompany && idCompany !== this.idCompany) {
        this.idCompany = idCompany;
        this.loadReport();
        this.loadPending();
        this.loadCrProviders(idCompany);
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
    { field: 'folio', headerName: 'Folio entrega', width: 170 },
    { headerName: 'Tipo Req', width: 160, valueGetter: (p: any) => p.data?.docType === 'ANTICIPO' ? 'Anticipo' : (p.data?.docType === 'CR' ? 'Compra Rápida' : (p.data?.tipoOc || '—')) },
    {
      field: 'articulo', headerName: 'Artículo', width: 150,
      cellRenderer: (p: any) => p.data?.docType === 'ANTICIPO' ? 'Anticipo' : (p.value ?? ''),
      cellStyle: (p: any) => p.data?.docType === 'ANTICIPO'
        ? { textDecoration: 'underline dotted', cursor: 'help' } : null,
      tooltipComponent: StyledTooltipComponent,
      tooltipValueGetter: (p: any) => this.buildAnticipoTooltip(p.data),
    },
    { field: 'numArticulo', headerName: 'Num. Articulo', width: 130, hide: true },   // oculta solo en el histórico
    { field: 'proveedor', headerName: 'Proveedor', width: 150 },
    { field: 'notaFactura', headerName: 'Nota / Factura', width: 130 },
    { field: 'masIva', headerName: 'IVA', width: 70, cellRenderer: 'agCheckboxCellRenderer', cellStyle: { textAlign: 'center' } },
    { field: 'cantidad', headerName: 'Cant.', width: 90, type: 'numericColumn', valueFormatter: (p: any) => p.data?.docType === 'ANTICIPO' ? '—' : p.value },
    {
      headerName: 'P. Unit.', width: 100, type: 'numericColumn',
      // P. Unit. efectivo pagado = valor / cantidad (ya incluye IVA porque el pago lo incluye).
      valueGetter: (p: any) => {
        if (p.data?.docType === 'ANTICIPO') return null;   // anticipo: monto único, sin P. Unit.
        const q = Number(p.data?.cantidad) || 0;
        const v = Number(p.data?.valorPago) || 0;
        return q > 0 ? Math.round((v / q) * 100) / 100 : 0;
      },
      valueFormatter: (p: any) => p.data?.docType === 'ANTICIPO' ? '—' : this.money(p.value),
    },
    {
      field: 'valorPago', headerName: 'Valor', width: 110, type: 'numericColumn',
      // Entrega con anticipo aplicado → muestra el NETO (bruto − anticipo aplicado). Anticipo → su monto.
      valueFormatter: (p: any) => this.money(this.histValorNeto(p.data)),
      cellStyle: (p: any) => {
        const esAnticipo = p.data?.docType === 'ANTICIPO';
        const tieneDesc = !esAnticipo && (Number(p.data?.anticipoAplicado) || 0) > 0;
        return (esAnticipo || tieneDesc)
          ? { fontWeight: '600', textDecoration: 'underline dotted', cursor: 'help' }
          : { fontWeight: '600' };
      },
      // Anticipo → tooltip de consumo; entrega con descuento → tooltip Bruto/Anticipo/Neto.
      tooltipComponent: StyledTooltipComponent,
      tooltipValueGetter: (p: any) => p.data?.docType === 'ANTICIPO'
        ? this.buildAnticipoValorTooltip(p.data)
        : this.buildEntregaValorTooltip(p.data),
    },
  ];

  historicoGridOptions: any = {
    headerHeight: 30,
    rowHeight: 30,
    defaultColDef: { resizable: true, sortable: true, filter: true },
    // Anticipo (gasto general) → fila azul, consistente con la Captura.
    rowClassRules: {
      'gx-row-anticipo': (p: any) => p.data?.docType === 'ANTICIPO',
    },
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
    // Default al entrar: periodo "Semana" (solo si el usuario no ha elegido otro). Respeta su selección.
    if (!this.histPeriod) {
      this.histPeriod = 'SEMANA';
      const today = new Date();
      const monday = new Date(today); const day = (today.getDay() + 6) % 7;
      monday.setDate(today.getDate() - day);
      this.histStart = this.toIso(monday);
      this.histEnd = this.toIso(today);
    }
    this.histLoading = true;
    this.histError = '';
    this.gastosService.getPaidPayments(this.idCompany).subscribe({
      next: (rows) => {
        this.historicoRows = rows ?? [];
        this.histProveedores = [...new Set(this.historicoRows.map(r => r.proveedor || '').filter(Boolean))].sort();
        this.histSucursales = [...new Set(this.historicoRows.map(r => r.branchName || '').filter(Boolean))].sort();
        this.histLoading = false;
        setTimeout(() => { this.histGridApi?.autoSizeAllColumns(); this.applyHistFilters(); this.recomputeHistTotals(); }, 0);
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

  /** Construye el objeto del tooltip tabular (StyledTooltipComponent) para una fila de anticipo:
   *  columnas Artículo · Cantidad · P. Unit · Total x art., con divisor + suma. */
  buildAnticipoTooltip(row: any): any {
    if (!row || row.docType !== 'ANTICIPO') return null;
    const items = row.anticipoItems || [];
    if (!items.length) return null;
    const rows = items.map((it: any) => [
      it.articulo || '',
      String(it.cantidad ?? 0),
      this.money(Number(it.precioUnitario) || 0),
      this.money(Number(it.total) || 0),
    ]);
    const total = items.reduce((s: number, it: any) => s + (Number(it.total) || 0), 0);
    return {
      title: 'Artículos del anticipo',
      table: {
        headers: ['Artículo', 'Cantidad', 'P. Unit', 'Total x art.'],
        rows,
        totalFmt: this.money(total),
      },
    };
  }

  /** Tooltip de la columna Valor en la fila de ANTICIPO: total + % (una vez) y el consumo por entrega. */
  buildAnticipoValorTooltip(row: any): any {
    if (!row || row.docType !== 'ANTICIPO') return null;
    const total = Number(row.valorPago) || 0;   // total del anticipo
    // Porcentaje ORIGINAL (condiciones_pago.cantidad) que viene del backend; NO recalcular con IVA.
    const pct = Number(row.anticipoPorcentaje) || 0;
    const consumo = row.anticipoConsumo || [];
    let restante = total;
    const rows = consumo.map((c: any) => {
      const desc = Number(c.descuento) || 0;
      restante = restante - desc;
      return [c.folioEntrega || '', this.money(desc), this.money(restante)];
    });
    return {
      title: 'Anticipo',
      summary: [ ['Total anticipo', this.money(total)], ['Porcentaje', `${pct}%`] ],
      table: { headers: ['Folio entrega', 'Descuento', 'Restante'], rows },
    };
  }

  /** Tooltip de la columna Valor en una ENTREGA con anticipo aplicado: Bruto / Anticipo aplicado / Neto,
   *  más el estado del anticipo (Total → desglose por entrada hasta ésta → restante). */
  buildEntregaValorTooltip(row: any): any {
    if (!row || row.docType === 'ANTICIPO') return null;
    const aplicado = Number(row.anticipoAplicado) || 0;
    if (aplicado <= 0) return null;
    const bruto = Number(row.valorPago) || 0;
    const neto = bruto - aplicado;

    const result: any = {
      title: 'Pago de entrega',
      table: {
        headers: ['Concepto', 'Monto'],
        rows: [
          ['Bruto', this.money(bruto)],
          ['Anticipo aplicado', '-' + this.money(aplicado)],
        ],
        totalFmt: this.money(neto),
      },
    };

    // Estado del anticipo: total y desglose acumulado hasta ESTA entrada (incluida).
    const total = Number(row.anticipoMonto) || 0;
    const consumo = Array.isArray(row.anticipoConsumo) ? row.anticipoConsumo : [];
    if (total > 0 && consumo.length) {
      const folio = String(row.folio ?? '');
      const idx = consumo.findIndex((c: any) => String(c.folioEntrega ?? '') === folio);
      // Hasta la entrada actual (si está en el ledger); si no (pendiente), todas + ésta al final.
      const hasta = idx >= 0
        ? consumo.slice(0, idx + 1)
        : [...consumo, { folioEntrega: folio, descuento: aplicado }];

      let restante = total;
      const ledgerRows = hasta.map((c: any) => {
        const desc = Number(c.descuento) || 0;
        restante = restante - desc;
        return [c.folioEntrega || '', '-' + this.money(desc), this.money(restante)];
      });

      result.extra = {
        title: 'Anticipo',
        summary: [['Total anticipo', this.money(total)]],
        table: { headers: ['Entrada', 'Descuento', 'Restante'], rows: ledgerRows, totalFmt: this.money(restante) },
      };
    }

    return result;
  }

  /** Valor neto de una fila del histórico: entrega = bruto − anticipo aplicado; anticipo = su monto. */
  private histValorNeto(d: any): number {
    const v = Number(d?.valorPago) || 0;
    if (d?.docType === 'ANTICIPO') return v;
    return v - (Number(d?.anticipoAplicado) || 0);
  }

  private recomputeHistTotals(): void {
    let count = 0, total = 0;
    this.histGridApi?.forEachNodeAfterFilterAndSort((n: any) => {
      count++; total += this.histValorNeto(n.data);
    });
    this.histCount = count;
    this.histTotal = total;
  }

  /** Exporta a Excel las filas actualmente filtradas del histórico. */
  exportHistExcel(): void {
    const rows: any[] = [];
    this.histGridApi?.forEachNodeAfterFilterAndSort((n: any) => {
      const d = n.data;
      const esAnticipo = d.docType === 'ANTICIPO';
      const q = Number(d.cantidad) || 0; const v = Number(d.valorPago) || 0;
      rows.push({
        'Fecha Pago': this.fmtDate(d.fechaPago),
        'Sucursal': d.branchName,
        'Folio': d.folio,
        'Tipo Req': esAnticipo ? 'Anticipo' : (d.docType === 'CR' ? 'Compra Rápida' : (d.tipoOc || '')),
        'Artículo': d.articulo,
        'Num. Articulo': d.numArticulo || '',
        'Proveedor': d.proveedor || '',
        'Nota / Factura': d.notaFactura || '',
        'IVA': d.masIva ? 'Sí' : 'No',
        'Cantidad': esAnticipo ? '' : q,
        'P. Unit.': esAnticipo ? '' : (q > 0 ? Math.round((v / q) * 100) / 100 : 0),
        'Valor': this.histValorNeto(d),   // neto: entrega = bruto − anticipo aplicado
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
    // Restaura el estado de columnas guardado por el usuario (visibilidad/orden/ancho).
    this.gridState.loadState(this.CAPTURA_GRID_KEY).subscribe(state => {
      if (state && state.length) {
        this.capturaHasSavedState = true;
        e.api.applyColumnState({ state, applyOrder: true });
      }
      // Habilita el guardado DESPUÉS de aplicar (los eventos del apply no se persisten).
      this.capturaStateLoaded = true;
    });
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
          // Gastos generales (anticipo, etc.): su Valor es un monto único, NO cantidad×precio.
          // No recalcular por IVA (eso pondría valorPago=0). Se conserva el monto del backend.
          if (r.idGastoGeneral) { r.__precioBase = 0; return; }
          r.__precioBase = Number(r.precioUnitario) || 0;
          this.recalcRowIva(r);
        });
        this.capturaRows = list;
        this.capturaLoading = false;
        // Re-autoajustar columnas tras recargar (onFirstDataRendered solo dispara la 1ª vez).
        // Si el usuario tiene estado guardado, NO se reajusta (respeta sus anchos).
        setTimeout(() => { if (!this.capturaHasSavedState) this.capturaGridApi?.autoSizeAllColumns(); }, 0);
      },
      error: (err) => {
        console.error('Error cargando pendientes de pago:', err);
        this.capturaError = 'No se pudieron cargar las entradas pendientes de pago.';
        this.capturaRows = [];
        this.capturaLoading = false;
      }
    });
  }

  /** Paga una fila de gasto general (anticipo EN TRÁMITE) desde la Captura. */
  async onPagarAnticipo(row: PendingPayment): Promise<void> {
    if (!row?.idGastoGeneral) return;
    const confirm = await alerts.confirmAlert(
      'Confirmar pago de anticipo',
      `¿Confirmar el pago del anticipo de ${this.money(row.valorPago)} para "${row.folio}"? Se registrará con la fecha de hoy.`,
      'question', 'Sí, pagar'
    );
    if (!confirm.isConfirmed) return;
    try {
      const fechaPago = row.fechaPago ?? this.toIso(new Date());
      await lastValueFrom(this.gastosService.confirmAnticipo(row.idGastoGeneral, fechaPago, row.notaFactura ?? null));
      this.capturaRows = this.capturaRows.filter(r => r.idGastoGeneral !== row.idGastoGeneral);
      alerts.reqSuccessToast('Anticipo pagado', `${row.folio}: anticipo registrado como pagado.`);
      this.loadReport();
    } catch (err) {
      console.error('Error pagando anticipo:', err);
      alerts.reqErrorToast('Error', 'No se pudo registrar el pago del anticipo.');
    }
  }

  async onPagar(row: PendingPayment): Promise<void> {
    if (!row) return;
    // Fila de gasto general (anticipo, etc.): se paga por su propio flujo, no por entradas_molienda.
    if (row.idGastoGeneral) { await this.onPagarAnticipo(row); return; }
    if ((row as any).__venceModified) {
      alerts.basicAlert('Guarda primero', 'Modificaste la fecha de vencimiento. Debes guardar los cambios antes de continuar con el pago.', 'warning');
      return;
    }
    if (this.isPagarBloqueadoPorSecuencia(row)) {
      alerts.basicAlert('Pago bloqueado', 'Debes pagar primero la entrada anterior de este artículo antes de continuar.', 'warning');
      return;
    }
    if (row.docType === 'CR' && (!row.proveedor || String(row.proveedor).trim() === '')) {
      alerts.basicAlert('Falta proveedor', 'Captura el proveedor antes de pagar esta compra rápida.', 'warning');
      return;
    }
    if (row.docType === 'CR' && !(Number(row.precioUnitario) > 0)) {
      alerts.basicAlert('Falta precio unitario', 'Captura el precio unitario antes de pagar esta compra rápida.', 'warning');
      return;
    }
    if (row.docType === 'CR' && (row as any).__modified === true) {
      alerts.basicAlert('Guarda primero', 'Guarda los cambios antes de pagar esta compra rápida.', 'warning');
      return;
    }
    // Anticipo requerido pero aún no PAGADO → bloquear la entrega hasta pagar el anticipo.
    if (row.calculoAnticipo === true && row.anticipoPagado !== true) {
      alerts.basicAlert('Anticipo pendiente', 'Registra y paga el anticipo de esta OC antes de pagar esta entrega.', 'warning');
      return;
    }

    // Bloque ANTICIPO: si la OC tiene anticipo pagado con saldo disponible, SIEMPRE abrir el modal.
    // 1ª entrega → método editable. 2ª+ → modal de solo visualización (método fijo, deshabilitado).
    // El botón "Aplicar y pagar" del modal es la confirmación del pago en todos los casos.
    const tieneAnticipo = row.calculoAnticipo === true && row.anticipoPagado === true && Number(row.anticipoSaldo) > 0;
    if (tieneAnticipo) {
      this.openAnticipoModal(row);
      return;
    }

    // Flujo normal (contado / crédito ya recibido).
    const confirm = await alerts.confirmAlert(
      'Confirmar pago',
      `¿Confirmar el pago de ${this.money(row.valorPago)} para "${row.articulo}" (${row.folio})? Se liberará la entrada.`,
      'question', 'Sí, pagar'
    );
    if (!confirm.isConfirmed) return;
    await this.doPagar(row, 0, null, null);
  }

  /** Ejecuta el pago (confirmPayment), con o sin anticipo aplicado. */
  private async doPagar(row: PendingPayment, anticipoAplicado: number, metodo: string | null, numProrrateo: number | null): Promise<void> {
    const payload = this.buildPayload(row);
    if (anticipoAplicado > 0) {
      payload.anticipoAplicado = anticipoAplicado;
      payload.metodoAnticipo = metodo;
      payload.numProrrateo = numProrrateo;
    }
    try {
      await lastValueFrom(this.gastosService.confirmPayment(payload));
      this.capturaRows = this.capturaRows.filter(r => r.idEntrada !== row.idEntrada);
      // Placeholder almacén global: aún no persiste inventario, solo confirma que el flujo corre.
      alerts.reqSuccessToast('Insertado en almacén', `${row.folio} — material ingresado (placeholder almacén global).`);
      if (anticipoAplicado > 0) {
        const neto = Math.max(0, (Number(row.valorPago) || 0) - anticipoAplicado);
        alerts.reqSuccessToast('Anticipo aplicado', `Se aplicó ${this.money(anticipoAplicado)} de anticipo. Pago neto: ${this.money(neto)}.`);
      } else {
        alerts.reqSuccessToast('Pago confirmado', `${row.folio} liberado.`);
      }
      this.loadReport();
    } catch (err) {
      console.error('Error confirmando pago:', err);
      alerts.reqErrorToast('Error', 'No se pudo confirmar el pago.');
    }
  }

  /** Ingresa la entrada "a crédito": material disponible + pago pendiente a N días. */
  async onCredito(row: PendingPayment): Promise<void> {
    if (!row) return;
    const dias = Number(row.condicionCantidad) || 0;
    const vence = this.fmtDate(this.computeVencimiento(row));
    const confirm = await alerts.confirmAlert(
      'Ingresar a crédito',
      `El material de "${row.articulo}" (${row.folio}) entrará al almacén y quedará pendiente de pago a ${dias} días${vence ? ` (vence ${vence})` : ''}. ¿Continuar?`,
      'question', 'Sí, a crédito'
    );
    if (!confirm.isConfirmed) return;
    try {
      const fechaVenc = this.computeVencimiento(row);
      await lastValueFrom(this.gastosService.activarCredito(row.idEntrada, fechaVenc || null));
      row.credito = true;
      if (fechaVenc) row.fechaVencimiento = fechaVenc;
      // Placeholder almacén global.
      alerts.reqSuccessToast('Insertado en almacén', `${row.folio} ingresado a crédito (placeholder almacén global).`);
      this.capturaGridApi?.refreshCells({ force: true });
    } catch (err) {
      console.error('Error activando crédito:', err);
      alerts.reqErrorToast('Error', 'No se pudo ingresar a crédito.');
    }
  }

  /** Fecha de vencimiento del crédito.
   *  Prioridad: (1) fecha manual guardada en BD (row.fechaVencimiento),
   *             (2) calculada en runtime = fechaRecepcion + N días.  */
  private computeVencimiento(row: any): string {
    if (row?.fechaVencimiento) return row.fechaVencimiento.toString().substring(0, 10);
    const dias = Number(row?.condicionCantidad) || 0;
    const base = row?.fechaRecepcion ? new Date(row.fechaRecepcion) : new Date();
    if (isNaN(base.getTime())) return '';
    base.setDate(base.getDate() + dias);
    return this.toIso(base);
  }

  /** Monto de anticipo a aplicar a una entrada según el método elegido. */
  private calcAnticipoAplicado(row: PendingPayment, metodo: 'FIFO' | 'PRORRATEO', n: number): number {
    const saldo = Number(row.anticipoSaldo) || 0;
    const gross = Number(row.valorPago) || 0;
    if (metodo === 'PRORRATEO') {
      const porEntrega = this.round2((Number(row.anticipoMonto) || 0) / Math.max(1, n));
      return Math.min(saldo, porEntrega, gross);
    }
    // FIFO: consume el saldo hasta cubrir esta entrada.
    return Math.min(saldo, gross);
  }

  private round2(n: number): number { return Math.round((Number(n) || 0) * 100) / 100; }

  // ── Modal de aplicación de anticipo (FIFO vs Prorrateo, lado a lado) ──
  showAnticipoModal = false;
  anticipoRow: PendingPayment | null = null;
  anticipoMetodo: 'FIFO' | 'PRORRATEO' = 'FIFO';
  anticipoN = 1;
  // true = método ya fijado (2ª+ entrega) → modal de solo visualización (controles deshabilitados).
  anticipoMetodoFijo = false;

  openAnticipoModal(row: PendingPayment): void {
    this.anticipoRow = row;
    // Si el método ya quedó fijado por una entrega previa → preseleccionarlo y mostrar el modal
    // como SOLO VISUALIZACIÓN (radios + N visibles pero deshabilitados). Si no, editable (1ª entrega).
    this.anticipoMetodoFijo = !!row.metodoAnticipo;
    this.anticipoMetodo = (row.metodoAnticipo as 'FIFO' | 'PRORRATEO') || 'FIFO';
    // Prioridad: número de prorrateo ya fijado → entradas reales si > planeadas → planeadas si > 1 → 1
    const planN    = Number(row.numEntregasPlan)    || 0;
    const almacenN = Number(row.numEntradasAlmacen) || 0;
    const baseN    = almacenN > planN ? almacenN : planN;
    this.anticipoN = Number(row.numProrrateo) > 0
      ? Number(row.numProrrateo)
      : baseN > 1 ? baseN : 1;
    this.showAnticipoModal = true;
  }

  cancelAnticipoModal(): void {
    this.showAnticipoModal = false;
    this.anticipoRow = null;
  }

  async confirmAnticipoModal(): Promise<void> {
    const row = this.anticipoRow;
    if (!row) return;
    const metodo = this.anticipoMetodo;
    const n = metodo === 'PRORRATEO' ? Math.max(1, Number(this.anticipoN) || 1) : null;
    const aplicado = this.calcAnticipoAplicado(row, metodo, n ?? 1);
    this.showAnticipoModal = false;
    this.anticipoRow = null;
    await this.doPagar(row, aplicado, metodo, n);
  }

  // Previews del modal (getters)
  get anticipoGross(): number { return Number(this.anticipoRow?.valorPago) || 0; }
  get anticipoSaldoActual(): number { return Number(this.anticipoRow?.anticipoSaldo) || 0; }
  get anticipoMontoTotal(): number { return Number(this.anticipoRow?.anticipoMonto) || 0; }
  get anticipoFifoAplicado(): number { return this.anticipoRow ? this.calcAnticipoAplicado(this.anticipoRow, 'FIFO', 1) : 0; }
  get anticipoFifoNeto(): number { return Math.max(0, this.anticipoGross - this.anticipoFifoAplicado); }
  get anticipoFifoSaldoRestante(): number { return Math.max(0, this.anticipoSaldoActual - this.anticipoFifoAplicado); }
  get anticipoProrrateoPorEntrega(): number { return this.round2(this.anticipoMontoTotal / Math.max(1, this.anticipoN)); }
  get anticipoProrrateoAplicado(): number { return this.anticipoRow ? this.calcAnticipoAplicado(this.anticipoRow, 'PRORRATEO', this.anticipoN) : 0; }
  get anticipoProrrateoNeto(): number { return Math.max(0, this.anticipoGross - this.anticipoProrrateoAplicado); }
  get anticipoProrrateoSaldoRestante(): number { return Math.max(0, this.anticipoSaldoActual - this.anticipoProrrateoAplicado); }

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
      modificadas.forEach(r => { (r as any).__modified = false; (r as any).__venceModified = false; });
      this.hasUnsavedCaptura = false;
      // Refrescar para reevaluar el bloqueo del botón Pagar ahora que ya no hay cambios pendientes.
      this.capturaGridApi?.refreshCells({ force: true });
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
      fechaVencimiento: row.fechaVencimiento ?? null,
      proveedor: row.proveedor,
      // Opción B: se persiste el precio BASE (sin IVA) en detailsreqoc.price.
      precioUnitario: (row as any).__precioBase != null ? Number((row as any).__precioBase) : (row.precioUnitario != null ? Number(row.precioUnitario) : null),
      masIva: !!row.masIva,
      notaFactura: row.notaFactura,
      cantidad: Number(row.cantidad) || 0,
    };
  }

  // ── Validación de proveedor CR (igual que cotización) ─────────────────────────
  // Retorna el nombre del proveedor si la validación pasa, null si el usuario rechaza.
  async validateCrProvider(providerId: number, providerName: string, row: any): Promise<string | null> {
    const idMaterial = row?.idMaterial;
    const idBranch   = row?.idReference;
    const branchName = row?.branchName || 'esta sucursal';
    const articulo   = row?.articulo   || 'el artículo';

    // PASO 1: Vínculo artículo-proveedor (Sin Código Externo)
    let provXTablaId = 0;
    try {
      const assignments: any = await lastValueFrom(this.providersService.getProvidersXTable(providerId, 'MATERIAL'));
      const list: any[] = Array.isArray(assignments) ? assignments : [];
      const match = idMaterial ? list.find((a: any) => Number(a.campo1) === Number(idMaterial)) : null;
      if (match) {
        provXTablaId = match.id || 0;
      } else if (idMaterial) {
        const res = await alerts.confirmAlert(
          'Sin Código Externo',
          `El proveedor "${providerName}" no tiene Código Externo para:\n• ${articulo}\n\n¿Desea crear la vinculación artículo-proveedor ahora?`,
          'warning', 'Sí, vincular'
        );
        if (!res.isConfirmed) return null;  // usuario canceló → no seleccionar
        const branchId = this.signalsService.getBranchSelectedBySidebar()() || idBranch || 0;
        try {
          const created: any = await lastValueFrom(this.providersService.addProviderXTable({
            idTabla: providerId, campo1: idMaterial, campo2: 'NA', campo3: 'NA',
            campo4: 'NA', campo5: 'NA', campo6: 'NA',
            campo7: true, campo11: '', campo9: 0, campo10: branchId,
            type: 'MATERIAL', vigente: true, principal: false, active: true,
          }));
          provXTablaId = created?.id || 0;
        } catch { alerts.reqErrorToast('Error', 'No se pudo crear la vinculación'); return null; }
      }
    } catch { /* Si falla la consulta, continuamos sin bloquear */ }

    // PASO 2: Sucursal autorizada para el proveedor
    if (provXTablaId > 0 && idBranch) {
      try {
        const sucursales: any = await lastValueFrom(this.sucursalByMaterialService.getSucursalByMaterial(provXTablaId));
        const list: any[] = Array.isArray(sucursales) ? sucursales : [];
        const tiene = list.some((s: any) => Number(s.idSucursal) === Number(idBranch));
        if (!tiene) {
          const res = await alerts.confirmAlert(
            'Proveedor no autorizado para zona',
            `El proveedor "${providerName}" no tiene registrada la sucursal "${branchName}" para:\n\n• ${articulo}\n\n¿Deseas registrar esta sucursal ahora?`,
            'info', 'Sí, registrar'
          );
          if (res.isConfirmed) {
            try {
              await lastValueFrom(this.sucursalByMaterialService.addSucursalByMaterial({
                idMaterialByProveedor: provXTablaId, idSucursal: idBranch,
                fechaAlta: new Date().toISOString(),
                stockMinimo: 0, resurtido: 0, capacidadMaxAlmacen: 0,
                tiempoDeEntrega: 2, vigente: true, active: true,
              }));
              alerts.reqSuccessToast('Éxito', `Proveedor vinculado a "${branchName}" correctamente`);
            } catch { alerts.reqErrorToast('Error', 'No se pudo registrar la sucursal'); }
          }
        }
      } catch { /* Si falla la consulta de sucursales, continuamos */ }
    }

    return providerName;   // validación pasó → usar este proveedor
  }

  // ── Dropdown de proveedor para filas CR ───────────────────────────────────────
  // Carga la lista con el mismo formato que la cotización:
  // ⭐ principales → Header Compañía → compañías → Header Contacto → contactos.
  private async loadCrProviders(idCompany: number): Promise<void> {
    try {
      const allProviders: any = await lastValueFrom(this.customersService.getProvidersForGrid(idCompany));
      const externos = (allProviders || []).filter((p: any) => p.typeIntOrExt === 'Externo');
      const isActivo = (p: any) => p.vigente === true || p.active === true || p.Vigente === true;
      const filtered = externos.filter(isActivo);
      // Externos INACTIVOS → para detectar duplicados y ofrecer reactivar.
      this.crInactiveProviders = externos.filter((p: any) => !isActivo(p)).map((p: any) => ({
        id: p.id,
        name: ((p.company ?? p.name ?? '').trim()) || ((p.nameContact ?? p.namecontact ?? p.Description ?? p.description ?? '').trim()) || `Proveedor ${p.id}`,
        raw: p,
      }));
      const active = filtered.map((p: any) => {
        const company = (p.company ?? p.name ?? '').trim();
        const contact = (p.nameContact ?? p.namecontact ?? p.Description ?? p.description ?? '').trim();
        const isCompany = !!company;
        return {
          id: p.id,
          description: isCompany ? company : (contact || `Proveedor ${p.id}`),
          group: isCompany ? 'Compañía' : 'Contacto',
          sortKey: isCompany ? company : contact
        };
      }).sort((a: any, b: any) => {
        if (a.group !== b.group) return a.group === 'Compañía' ? -1 : 1;
        return a.sortKey.localeCompare(b.sortKey, 'es', { sensitivity: 'base' });
      });

      const companies = active.filter((p: any) => p.group === 'Compañía');
      const contacts  = active.filter((p: any) => p.group === 'Contacto');
      const result: any[] = [{ id: this.NEW_PROVIDER_SENTINEL, description: '+ Nuevo Proveedor' }];
      if (companies.length > 0) {
        result.push({ id: '__header_company__', description: 'Compañía', disabled: true, __isHeader: true });
        result.push(...companies);
      }
      if (contacts.length > 0) {
        result.push({ id: '__header_contact__', description: 'Contacto', disabled: true, __isHeader: true });
        result.push(...contacts);
      }
      this.crProviders = result;
    } catch {
      this.crProviders = [{ id: this.NEW_PROVIDER_SENTINEL, description: '+ Nuevo Proveedor' }];
    }
  }

  openCrProviderDropdown(row: any): void {
    this.crProviderRow = row;
    this.crProviderSelectedId = null;   // sin preselección → igual que la cotización
  }

  onCrProviderChange(): void {
    if (!this.crProviderRow || this.crProviderSelectedId == null) return;
    if (this.crProviderSelectedId === this.NEW_PROVIDER_SENTINEL) {
      this.crProviderSelectedId = null;
      return;
    }
    const found = this.crProviders.find(p => p.id === this.crProviderSelectedId);
    if (found) {
      this.crProviderRow.proveedor = found.description;
      (this.crProviderRow as any).__modified = true;
      this.hasUnsavedCaptura = true;
      this.capturaGridApi?.refreshCells({ force: true });
    }
    this.crProviderRow = null;
    this.crProviderSelectedId = null;
  }

  /** Bloquea "Pagar" si existe otra fila pendiente con el mismo folio base + artículo y número menor.
   *  Ejemplo: E2 queda bloqueada mientras E1 (misma OC, mismo artículo) siga sin pagarse. */
  private isPagarBloqueadoPorSecuencia(row: any): boolean {
    if (!row?.folio || !row?.articulo) return false;
    // Extraer base y número: "OC-BOD9-P1-ALE1418-E2" → base="OC-BOD9-P1-ALE1418", n=2
    const match = String(row.folio).match(/^(.+)-E(\d+)$/i);
    if (!match) return false;
    const base = match[1];
    const n    = Number(match[2]);
    if (n <= 1) return false; // E1 nunca se bloquea por secuencia
    // Buscar en capturaRows si hay alguna entrada con mismo base + mismo artículo + número menor
    return this.capturaRows.some(r => {
      if (r === row || !r.folio || !r.articulo) return false;
      if (r.articulo !== row.articulo) return false;
      const m = String(r.folio).match(/^(.+)-E(\d+)$/i);
      if (!m) return false;
      return m[1] === base && Number(m[2]) < n;
    });
  }

  // ── Editor de fecha de vencimiento vía SweetAlert2 ─────────
  async editVenceDate(row: any): Promise<void> {
    const current = this.computeVencimiento(row);
    const picked = await Swal.fire({
      title: 'Fecha de vencimiento',
      input: 'date',
      inputValue: current,
      showCancelButton: true,
      confirmButtonText: 'Continuar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      inputAttributes: { style: 'font-size:1rem;padding:6px 10px;border-radius:6px;' },
      preConfirm: (date) => {
        if (!date) return Swal.showValidationMessage('Selecciona una fecha válida');
        return date;
      }
    });
    if (!picked.isConfirmed || !picked.value) return;

    const fechaFmt = this.fmtDate(picked.value);
    const confirm = await alerts.confirmAlertHtml(
      'Modificar fecha de vencimiento',
      `¿Estás seguro que deseas cambiar la fecha de vencimiento a <b>${fechaFmt}</b>?<br><br><small style="color:#888;">Recuerda guardar para que el cambio se persista en la base de datos.</small>`,
      'question', 'Sí, cambiar'
    );
    if (!confirm.isConfirmed) return;

    row.fechaVencimiento = picked.value;
    (row as any).__modified = true;
    (row as any).__venceModified = true;
    this.hasUnsavedCaptura = true;
    this.capturaGridApi?.refreshCells({ rowNodes: undefined, force: true });
  }

  fmtDate(value: any): string {
    if (!value) return '';
    const str = value.toString().substring(0, 10);
    // Parsear YYYY-MM-DD directo para evitar el shift de timezone (new Date("YYYY-MM-DD") = UTC midnight → día anterior en hora local)
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      const [y, m, d] = str.split('-');
      return `${d}/${m}/${y}`;
    }
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
