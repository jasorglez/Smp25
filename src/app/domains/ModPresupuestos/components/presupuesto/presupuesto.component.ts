import { Component, OnInit, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent, ICellRendererParams } from 'ag-grid-community';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { PresupuestoService } from 'app/services/presupuesto.service';
import { CuentasContablesService } from 'app/services/cuentas-contables.service';
import { SignalsService } from 'app/services/signals.service';
import { TrackingService } from 'app/services/tracking.service';
import { alerts } from 'app/helpers/alerts';
import {
  IPresupuesto,
  IPresupuestoLinea,
  IPresupuestoMes,
  IPresupuestoForm,
  MESES
} from 'app/interface/ipresupuesto';
import { ICuentaContable } from 'app/interface/icuentas-contables';
import { catchError, EMPTY, lastValueFrom, concat, toArray } from 'rxjs';

@Component({
  selector: 'app-presupuesto',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, AgGridModule],
  templateUrl: './presupuesto.component.html',
  styleUrl: './presupuesto.component.scss'
})
export class PresupuestoComponent implements OnInit {

  private presupuestoService = inject(PresupuestoService);
  private cuentasService = inject(CuentasContablesService);
  private signalsService = inject(SignalsService);
  private trackingService = inject(TrackingService);
  private modalService = inject(NgbModal);
  private fb = inject(FormBuilder);

  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;
  public MESES = MESES;

  idCompany = 0;
  idProject = 0;

  // Presupuestos (versiones)
  presupuestos: IPresupuesto[] = [];
  selectedPresupuesto: IPresupuesto | null = null;

  // Líneas del presupuesto seleccionado
  lineas: IPresupuestoLinea[] = [];
  selectedLinea: IPresupuestoLinea | null = null;
  hasUnsavedLineas = false;

  // Meses de la línea seleccionada
  mesesLinea: IPresupuestoMes[] = [];

  // Cuentas contables disponibles
  cuentasFlat: ICuentaContable[] = [];

  loading = false;
  loadingLineas = false;
  showMeses = false;

  // Formulario para nuevo presupuesto
  presupuestoForm!: FormGroup;
  isEditingPresupuesto = false;

  // AG Grid — versiones
  private gridApiVersiones!: GridApi;
  public columnDefsVersiones: ColDef[] = [
    {
      headerName: 'Revisión',
      field: 'nombre',
      width: 100,
      cellClass: 'fw-bold',
      cellRenderer: (p: ICellRendererParams) =>
        p.data?.vigente
          ? `<span class="text-success fw-bold">${p.value} <i class="bi bi-check-circle-fill"></i></span>`
          : p.value
    },
    { headerName: 'Motivo', field: 'motivo', flex: 2, minWidth: 200 },
    { headerName: 'Inicio', field: 'fecha_inicio', width: 110,
      valueFormatter: p => p.value ? String(p.value).substring(0, 10) : '' },
    { headerName: 'Fin', field: 'fecha_fin', width: 110,
      valueFormatter: p => p.value ? String(p.value).substring(0, 10) : '' },
    {
      headerName: 'Monto Total',
      field: 'monto_total',
      width: 150,
      valueFormatter: p => p.value != null
        ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(p.value)
        : '$0.00'
    },
    { headerName: 'Responsable', field: 'usuario_responsable', width: 160 },
    { headerName: 'Fecha Creación', field: 'fecha_creacion', width: 140,
      valueFormatter: p => p.value ? String(p.value).substring(0, 10) : '' },
    {
      headerName: 'Vigente',
      field: 'vigente',
      width: 90,
      cellRenderer: (p: ICellRendererParams) =>
        p.value
          ? '<span class="badge bg-success">Vigente</span>'
          : '<span class="badge bg-secondary">Histórico</span>'
    }
  ];

  // AG Grid — líneas (detalle de cuentas)
  private gridApiLineas!: GridApi;
  private tempCounter = 0;
  public columnDefsLineas: ColDef[] = [];

  public defaultColDef: ColDef = {
    sortable: true, filter: true, resizable: true
  };

  constructor() {
    effect(() => {
      this.idCompany = this.signalsService.getRootSelectedBySidebar()();
      this.idProject = this.signalsService.getProjectSelectedBySidebar()() ?? 0;
      if (this.idCompany && this.idProject) {
        this.loadData();
      } else {
        this.presupuestos = [];
        this.lineas = [];
      }
    });
  }

  ngOnInit(): void {
    this.initForm();
    this.setupLineasColumns();
    this.idCompany = this.signalsService.getRootSelectedBySidebar()();
    this.idProject = this.signalsService.getProjectSelectedBySidebar()() ?? 0;
    if (this.idCompany && this.idProject) {
      this.loadData();
    }
  }

  initForm(): void {
    this.presupuestoForm = this.fb.group({
      nombre: ['Rev.0', Validators.required],
      motivo: ['Presupuesto inicial', Validators.required],
      fecha_inicio: ['', Validators.required],
      fecha_fin: ['', Validators.required],
      vigente: [true]
    });
  }

  setupLineasColumns(): void {
    this.columnDefsLineas = [
      {
        headerName: 'Cuenta',
        field: 'cuenta_codigo',
        width: 120,
        cellClass: 'fw-bold'
      },
      {
        headerName: 'Nombre Cuenta',
        field: 'cuenta_nombre',
        flex: 2,
        minWidth: 200
      },
      {
        headerName: 'Nivel',
        field: 'cuenta_nivel',
        width: 80,
        cellRenderer: (p: ICellRendererParams) => {
          const n = p.value;
          const cls = n === 1 ? 'primary' : n === 2 ? 'info' : 'success';
          return `<span class="badge bg-${cls}">${n}</span>`;
        }
      },
      {
        headerName: 'Descripción',
        field: 'descripcion',
        flex: 1,
        minWidth: 180,
        editable: (p) => !!this.selectedPresupuesto?.vigente,
        onCellValueChanged: (p) => { p.data.__modified = true; this.hasUnsavedLineas = true; }
      },
      {
        headerName: 'Monto Presupuestado',
        field: 'monto',
        width: 180,
        editable: (p) => !!this.selectedPresupuesto?.vigente,
        cellDataType: 'number',
        valueFormatter: p => p.value != null
          ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(p.value)
          : '$0.00',
        onCellValueChanged: (p) => { p.data.__modified = true; this.hasUnsavedLineas = true; }
      },
      {
        headerName: 'Ejecutado',
        field: 'monto_ejecutado',
        width: 150,
        editable: false,
        valueFormatter: p => p.value != null
          ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(p.value)
          : '$0.00'
      },
      {
        headerName: 'Saldo',
        field: 'saldo_disponible',
        width: 150,
        editable: false,
        cellRenderer: (p: ICellRendererParams) => {
          const val = p.value ?? 0;
          const fmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val);
          const cls = val < 0 ? 'text-danger fw-bold' : val === 0 ? 'text-warning' : 'text-success';
          return `<span class="${cls}">${fmt}</span>`;
        }
      },
      {
        headerName: '% Ejecución',
        field: 'pct_ejecucion',
        width: 120,
        editable: false,
        cellRenderer: (p: ICellRendererParams) => {
          const pct = p.value ?? 0;
          const cls = pct > 100 ? 'danger' : pct > 80 ? 'warning' : 'success';
          return `<span class="badge bg-${cls}">${pct.toFixed(1)}%</span>`;
        }
      },
      {
        headerName: 'Meses',
        field: 'id',
        width: 80,
        editable: false,
        cellRenderer: () =>
          '<button class="btn btn-sm btn-outline-primary py-0 px-1"><i class="bi bi-calendar3"></i></button>',
        onCellClicked: (p) => {
          this.selectedLinea = p.data;
          this.loadMeses(p.data.id);
          this.showMeses = true;
        }
      }
    ];
  }

  loadData(): void {
    this.loading = true;
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Cargar Presupuestos',
      'Módulo Presupuestos',
      this.trackingService.getEmail()
    );

    this.presupuestoService.getAll(this.idCompany, this.idProject)
      .pipe(catchError(() => { this.loading = false; return EMPTY; }))
      .subscribe(data => {
        this.presupuestos = data;
        this.loading = false;
        // Auto-seleccionar el vigente
        const vigente = data.find(p => p.vigente);
        if (vigente) { this.selectPresupuesto(vigente); }
      });

    this.cuentasService.getAll(this.idCompany)
      .subscribe(c => this.cuentasFlat = c);
  }

  selectPresupuesto(p: IPresupuesto): void {
    this.selectedPresupuesto = p;
    this.showMeses = false;
    this.selectedLinea = null;
    this.loadLineas(p.id);
  }

  loadLineas(idPresupuesto: number): void {
    this.loadingLineas = true;
    this.presupuestoService.getLineas(idPresupuesto)
      .pipe(catchError(() => { this.loadingLineas = false; return EMPTY; }))
      .subscribe(data => {
        this.lineas = data;
        this.hasUnsavedLineas = false;
        this.loadingLineas = false;
      });
  }

  loadMeses(idLinea: number): void {
    this.presupuestoService.getMeses(idLinea)
      .subscribe(meses => {
        // Construir array completo de 12 meses, marcando los que existen
        const anioActual = new Date().getFullYear();
        this.mesesLinea = MESES.map(m => {
          const existing = meses.find(x => x.mes === m.num);
          return {
            id: existing?.id,
            id_linea: idLinea,
            mes: m.num,
            anio: existing?.anio ?? anioActual,
            monto: existing?.monto ?? 0,
            active: existing?.active ?? true,
            seleccionado: !!existing
          };
        });
      });
  }

  // ── CRUD Presupuesto (versiones) ─────────────────────────

  openNuevoPresupuesto(modal: any): void {
    this.isEditingPresupuesto = false;
    const rev = this.presupuestos.length;
    this.presupuestoForm.patchValue({
      nombre: `Rev.${rev}`,
      motivo: rev === 0 ? 'Presupuesto inicial' : '',
      fecha_inicio: '',
      fecha_fin: '',
      vigente: true
    });
    this.modalService.open(modal, { size: 'lg', backdrop: 'static' });
  }

  async guardarPresupuesto(modal: any): Promise<void> {
    if (this.presupuestoForm.invalid) {
      alerts.basicAlert('Campos requeridos', 'Complete todos los campos obligatorios.', 'warning');
      return;
    }
    const formVal = this.presupuestoForm.value;
    const payload: IPresupuestoForm = {
      ...formVal,
      id_project: this.idProject,
      idCompany: this.idCompany,
      active: true
    };

    this.presupuestoService.create(payload)
      .pipe(catchError(() => {
        alerts.basicAlert('Error', 'No se pudo crear el presupuesto.', 'error');
        return EMPTY;
      }))
      .subscribe(nuevo => {
        alerts.basicAlert('Presupuesto creado', `${nuevo.nombre} creado correctamente.`, 'success');
        modal.close();
        this.loadData();
      });
  }

  async setVigente(p: IPresupuesto): Promise<void> {
    if (p.vigente) return;
    const confirm = await alerts.confirmAlert(
      '¿Cambiar versión vigente?',
      `Se establecerá ${p.nombre} como la versión activa del presupuesto.`,
      'warning', 'Sí, activar'
    );
    if (!confirm.isConfirmed) return;
    this.presupuestoService.setVigente(p.id, this.idCompany, this.idProject)
      .pipe(catchError(() => { alerts.basicAlert('Error', 'No se pudo actualizar.', 'error'); return EMPTY; }))
      .subscribe(() => { this.loadData(); });
  }

  // ── CRUD Líneas ───────────────────────────────────────────

  addLinea(): void {
    if (!this.selectedPresupuesto) {
      alerts.basicAlert('Sin selección', 'Seleccione un presupuesto primero.', 'warning');
      return;
    }
    const tempId = `temp_${this.tempCounter++}`;
    const newLinea: any = {
      id: tempId,
      id_presupuesto: this.selectedPresupuesto.id,
      id_cuenta: null,
      cuenta_codigo: '',
      cuenta_nombre: '-- Seleccionar cuenta --',
      cuenta_nivel: null,
      descripcion: '',
      monto: 0,
      monto_ejecutado: 0,
      saldo_disponible: 0,
      pct_ejecucion: 0,
      active: true,
      __isNew: true
    };
    this.lineas = [newLinea, ...this.lineas];
    this.hasUnsavedLineas = true;
    setTimeout(() => this.gridApiLineas?.startEditingCell({ rowIndex: 0, colKey: 'descripcion' }), 100);
  }

  async saveLineas(): Promise<void> {
    const nuevas = this.lineas.filter(l => (l as any).__isNew && l.id_cuenta);
    const modificadas = this.lineas.filter(l => (l as any).__modified && !(l as any).__isNew);

    if (!nuevas.length && !modificadas.length) {
      alerts.basicAlert('Sin cambios', 'No hay cambios que guardar.', 'info');
      return;
    }

    const adds = nuevas.map(l => this.presupuestoService.createLinea({
      id_presupuesto: this.selectedPresupuesto!.id,
      id_cuenta: l.id_cuenta,
      descripcion: l.descripcion,
      monto: l.monto,
      active: true
    }).pipe(catchError(e => { console.error(e); return EMPTY; })));

    const updates = modificadas.map(l => this.presupuestoService.updateLinea(l.id as number, {
      id_presupuesto: l.id_presupuesto,
      id_cuenta: l.id_cuenta,
      descripcion: l.descripcion,
      monto: l.monto,
      active: l.active
    }).pipe(catchError(e => { console.error(e); return EMPTY; })));

    await lastValueFrom(concat(...adds, ...updates).pipe(toArray()));
    alerts.basicAlert('Guardado', 'Líneas guardadas correctamente.', 'success');
    this.loadLineas(this.selectedPresupuesto!.id);
  }

  async deleteLinea(): Promise<void> {
    if (!this.selectedLinea) {
      alerts.basicAlert('Sin selección', 'Seleccione una línea para eliminar.', 'warning');
      return;
    }
    const confirm = await alerts.confirmAlert(
      '¿Eliminar línea?',
      `Se eliminará la línea de ${this.selectedLinea.cuenta_nombre}.`,
      'warning', 'Sí, eliminar'
    );
    if (!confirm.isConfirmed) return;
    this.presupuestoService.deleteLinea(this.selectedLinea.id as number)
      .pipe(catchError(() => { alerts.basicAlert('Error', 'No se pudo eliminar.', 'error'); return EMPTY; }))
      .subscribe(() => {
        this.selectedLinea = null;
        this.showMeses = false;
        this.loadLineas(this.selectedPresupuesto!.id);
      });
  }

  // ── Distribución mensual ──────────────────────────────────

  async saveMeses(): Promise<void> {
    if (!this.selectedLinea) return;
    const seleccionados = this.mesesLinea.filter(m => m.seleccionado);
    await lastValueFrom(
      this.presupuestoService.saveMeses(this.selectedLinea.id as number, seleccionados)
    );
    alerts.basicAlert('Guardado', 'Distribución mensual guardada.', 'success');
    this.showMeses = false;
  }

  toggleMes(mes: IPresupuestoMes): void {
    mes.seleccionado = !mes.seleccionado;
    if (!mes.seleccionado) mes.monto = 0;
  }

  getTotalMeses(): number {
    return this.mesesLinea.filter(m => m.seleccionado).reduce((s, m) => s + (m.monto || 0), 0);
  }

  // ── AG Grid events ────────────────────────────────────────

  onGridVersionesReady(p: GridReadyEvent): void { this.gridApiVersiones = p.api; }
  onGridLineasReady(p: GridReadyEvent): void { this.gridApiLineas = p.api; }

  onSeleccionarLinea(e: any): void {
    const nodes = e.api.getSelectedNodes();
    this.selectedLinea = nodes.length ? nodes[0].data : null;
    if (this.selectedLinea) {
      this.showMeses = false;
    }
  }

  onCellValueChangedLinea(e: any): void {
    e.data.__modified = true;
    this.hasUnsavedLineas = true;
  }

  // ── Helpers ───────────────────────────────────────────────

  get montoTotalLineas(): number {
    return this.lineas.reduce((s, l) => s + (l.monto || 0), 0);
  }

  formatCurrency(v: number): string {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(v ?? 0);
  }

  onGridVersionesRowClicked(e: any): void {
    if (e.data) { this.selectPresupuesto(e.data); }
  }
}
