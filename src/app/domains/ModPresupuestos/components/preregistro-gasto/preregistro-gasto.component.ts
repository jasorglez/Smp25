import { Component, OnInit, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent, ICellRendererParams } from 'ag-grid-community';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { PresupuestoService } from 'app/services/presupuesto.service';
import { CuentasContablesService } from 'app/services/cuentas-contables.service';
import { SignalsService } from 'app/services/signals.service';
import { TrackingService } from 'app/services/tracking.service';
import { alerts } from 'app/helpers/alerts';
import { IPreregistroGasto } from 'app/interface/ipresupuesto';
import { ICuentaContable } from 'app/interface/icuentas-contables';
import { catchError, EMPTY, concat, lastValueFrom, toArray } from 'rxjs';

@Component({
  selector: 'app-preregistro-gasto',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  templateUrl: './preregistro-gasto.component.html',
  styleUrl: './preregistro-gasto.component.scss'
})
export class PreregistroGastoComponent implements OnInit {

  private presupuestoService = inject(PresupuestoService);
  private cuentasService = inject(CuentasContablesService);
  private signalsService = inject(SignalsService);
  private trackingService = inject(TrackingService);

  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  idCompany = 0;
  idProject = 0;
  loading = false;
  hasUnsaved = false;

  rowData: IPreregistroGasto[] = [];
  selectedRow: IPreregistroGasto | null = null;
  cuentasFlat: ICuentaContable[] = [];
  private gridApi!: GridApi;
  private tempCounter = 0;

  public defaultColDef: ColDef = { sortable: true, filter: true, resizable: true };

  public columnDefs: ColDef[] = [
    {
      headerName: 'Cuenta',
      field: 'id_cuenta',
      width: 220,
      editable: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: () => ({
        values: this.cuentasFlat.filter(c => c.esHoja && c.activo).map(c => c.id),
      }),
      valueFormatter: (p) => {
        const c = this.cuentasFlat.find(x => x.id === p.value);
        return c ? `${c.codigo} — ${c.nombre}` : (p.value ?? '');
      },
      onCellValueChanged: (p) => { p.data.__modified = true; this.hasUnsaved = true; }
    },
    {
      headerName: 'Concepto',
      field: 'concepto',
      flex: 2,
      minWidth: 200,
      editable: true,
      onCellValueChanged: (p) => { p.data.__modified = true; this.hasUnsaved = true; }
    },
    {
      headerName: 'Monto',
      field: 'monto',
      width: 150,
      editable: true,
      cellDataType: 'number',
      valueFormatter: p => p.value != null
        ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(p.value)
        : '$0.00',
      onCellValueChanged: (p) => { p.data.__modified = true; this.hasUnsaved = true; }
    },
    {
      headerName: 'Fecha',
      field: 'fecha',
      width: 130,
      editable: true,
      cellEditor: 'agDateCellEditor',
      valueGetter: p => p.data?.fecha ? String(p.data.fecha).substring(0, 10) : '',
      valueSetter: p => { p.data.fecha = p.newValue; return true; },
      valueFormatter: p => {
        if (!p.value) return '';
        const [y, m, d] = String(p.value).split('-');
        return d ? `${d}/${m}/${y}` : p.value;
      },
      onCellValueChanged: (p) => { p.data.__modified = true; this.hasUnsaved = true; }
    },
    {
      headerName: 'Saldo Disponible',
      field: 'saldo_cuenta',
      width: 160,
      editable: false,
      cellRenderer: (p: ICellRendererParams) => {
        const val = p.value ?? 0;
        const fmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val);
        const cls = val < 0 ? 'text-danger fw-bold' : val === 0 ? 'text-warning' : 'text-success';
        return `<span class="${cls}">${fmt}</span>`;
      }
    },
    { headerName: 'Usuario', field: 'usuario', width: 140, editable: false }
  ];

  constructor() {
    effect(() => {
      this.idCompany = this.signalsService.getRootSelectedBySidebar()();
      this.idProject = this.signalsService.getProjectSelectedBySidebar()() ?? 0;
      if (this.idCompany && this.idProject) {
        this.loadData();
      } else {
        this.rowData = [];
      }
    });
  }

  ngOnInit(): void {
    this.idCompany = this.signalsService.getRootSelectedBySidebar()();
    this.idProject = this.signalsService.getProjectSelectedBySidebar()() ?? 0;
    if (this.idCompany && this.idProject) {
      this.loadData();
    }
  }

  loadData(): void {
    this.loading = true;
    this.cuentasService.getAll(this.idCompany).subscribe(c => this.cuentasFlat = c);
    this.presupuestoService.getPreregistros(this.idCompany, this.idProject)
      .pipe(catchError(() => { this.loading = false; return EMPTY; }))
      .subscribe(data => {
        this.rowData = data;
        this.hasUnsaved = false;
        this.loading = false;
      });
  }

  addRow(): void {
    const today = new Date().toISOString().split('T')[0];
    const newRow: any = {
      id: `temp_${this.tempCounter++}`,
      id_project: this.idProject,
      idCompany: this.idCompany,
      id_cuenta: null,
      concepto: '',
      monto: 0,
      fecha: today,
      usuario: this.trackingService.getEmail(),
      active: true,
      __isNew: true
    };
    this.rowData = [newRow, ...this.rowData];
    this.hasUnsaved = true;
    setTimeout(() => this.gridApi?.startEditingCell({ rowIndex: 0, colKey: 'id_cuenta' }), 100);
  }

  async saveChanges(): Promise<void> {
    const nuevas = this.rowData.filter(r => (r as any).__isNew && r.id_cuenta && r.concepto && r.monto);
    const modificadas = this.rowData.filter(r => (r as any).__modified && !(r as any).__isNew);

    if (!nuevas.length && !modificadas.length) {
      alerts.basicAlert('Sin cambios', 'No hay cambios que guardar.', 'info');
      return;
    }

    const adds = nuevas.map(r => this.presupuestoService.createPreregistro({
      id_project: this.idProject,
      idCompany: this.idCompany,
      id_cuenta: r.id_cuenta,
      concepto: r.concepto,
      monto: r.monto,
      fecha: r.fecha,
      usuario: r.usuario,
      active: true
    }).pipe(catchError(e => { console.error(e); return EMPTY; })));

    const updates = modificadas.map(r => this.presupuestoService.updatePreregistro(r.id as number, {
      id_cuenta: r.id_cuenta,
      concepto: r.concepto,
      monto: r.monto,
      fecha: r.fecha,
      active: r.active
    }).pipe(catchError(e => { console.error(e); return EMPTY; })));

    await lastValueFrom(concat(...adds, ...updates).pipe(toArray()));
    alerts.basicAlert('Guardado', 'Preregistros guardados.', 'success');
    this.loadData();
  }

  revert(): void {
    this.loadData();
  }

  async deleteRow(): Promise<void> {
    if (!this.selectedRow) {
      alerts.basicAlert('Sin selección', 'Seleccione un preregistro para eliminar.', 'warning');
      return;
    }
    const confirm = await alerts.confirmAlert(
      '¿Eliminar preregistro?',
      `Se eliminará el preregistro "${this.selectedRow.concepto}".`,
      'warning', 'Sí, eliminar'
    );
    if (!confirm.isConfirmed) return;
    this.presupuestoService.deletePreregistro(this.selectedRow.id as number)
      .pipe(catchError(() => { alerts.basicAlert('Error', 'No se pudo eliminar.', 'error'); return EMPTY; }))
      .subscribe(() => {
        this.selectedRow = null;
        this.loadData();
      });
  }

  onGridReady(p: GridReadyEvent): void { this.gridApi = p.api; }

  onSelectionChanged(e: any): void {
    const nodes = e.api.getSelectedNodes();
    this.selectedRow = nodes.length ? nodes[0].data : null;
  }

  onCellValueChanged(e: any): void {
    e.data.__modified = true;
    this.hasUnsaved = true;
  }

  get totalPreregistrado(): number {
    return this.rowData.reduce((s, r) => s + (r.monto || 0), 0);
  }

  formatCurrency(v: number): string {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(v ?? 0);
  }
}
