import { Component, OnInit, inject, effect } from '@angular/core';
import { Router } from '@angular/router';
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
import { catchError, EMPTY, lastValueFrom, concat, toArray, forkJoin, of } from 'rxjs';
import { map } from 'rxjs/operators';
import Swal from 'sweetalert2';
import { RootService } from 'app/services/root.service';
import { Base64EncodeService } from 'app/services/base64encode.service';
import { PdfWorkerService } from 'app/services/pdf-worker.service';

@Component({
  selector: 'app-presupuesto',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, AgGridModule],
  templateUrl: './presupuesto.component.html',
  styleUrl: './presupuesto.component.scss'
})
export class PresupuestoComponent implements OnInit {

  private router = inject(Router);
  private presupuestoService = inject(PresupuestoService);
  private cuentasService = inject(CuentasContablesService);
  private signalsService = inject(SignalsService);
  private trackingService = inject(TrackingService);
  private modalService = inject(NgbModal);
  private fb = inject(FormBuilder);
  private rootService = inject(RootService);
  private base64EncodeService = inject(Base64EncodeService);
  private pdfWorkerService = inject(PdfWorkerService);

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
  generandoPDF = false;

  // Diff entre versiones
  showDiff = false;
  loadingDiff = false;
  versionPrevia: IPresupuesto | null = null;
  lineasPrevias: IPresupuestoLinea[] = [];
  soloMostrarCambios = true;

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
        field: 'id_cuenta',
        width: 300,
        editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: () => ({
          values: this.cuentasFlat.map(c => c.id),
        }),
        valueFormatter: (p) => {
          const c = this.cuentasFlat.find(x => x.id === p.value);
          return c ? `${c.codigo} — ${c.nombre}` : (p.value ? String(p.value) : '-- Seleccionar --');
        },
        onCellValueChanged: (p) => {
          const c = this.cuentasFlat.find(x => x.id === p.newValue);
          if (c) {
            p.data.id_cuenta = c.id;
            p.data.cuenta_codigo = c.codigo;
            p.data.cuenta_nombre = c.nombre;
            p.data.cuenta_nivel = c.nivel;
          }
          p.data.__modified = true;
          this.hasUnsavedLineas = true;
        }
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
    this.showDiff = false;
    this.selectedLinea = null;
    this.lineasPrevias = [];
    this.versionPrevia = null;
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
        if (this.selectedPresupuesto?.vigente) {
          this.checkSaldoAgotado(data);
        }
      });
  }

  private checkSaldoAgotado(lineas: IPresupuestoLinea[]): void {
    const conSaldo = lineas.filter(l => l.saldo_disponible !== undefined && l.monto > 0);
    if (!conSaldo.length) return;

    const hayAgotadas = conSaldo.some(l => (l.saldo_disponible ?? 0) <= 0);
    const totalSaldo  = conSaldo.reduce((s, l) => s + (l.saldo_disponible ?? 0), 0);

    if (hayAgotadas && totalSaldo <= 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Presupuesto Agotado',
        html: `<p>Una o más cuentas no tienen saldo disponible y <strong>el presupuesto total del proyecto está agotado</strong>.</p>
               <p class="mb-0">Se requiere una solicitud de incremento a Dirección General.</p>`,
        confirmButtonText: 'Solicitar Incremento',
        confirmButtonColor: '#dc3545',
        showCancelButton: true,
        cancelButtonText: 'Cerrar',
      }).then(result => {
        if (result.isConfirmed) {
          this.router.navigate(['/presupuestos/incrementos']);
        }
      });
    }
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
      numrevision: this.presupuestos.length,
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
    setTimeout(() => this.gridApiLineas?.startEditingCell({ rowIndex: 0, colKey: 'id_cuenta' }), 100);
  }

  async saveLineas(): Promise<void> {
    const nuevas     = this.lineas.filter(l => (l as any).__isNew && l.id_cuenta);
    const modificadas = this.lineas.filter(l => (l as any).__modified && !(l as any).__isNew);

    if (!nuevas.length && !modificadas.length) {
      alerts.basicAlert('Sin cambios', 'No hay cambios que guardar.', 'info');
      return;
    }

    // ── Líneas modificadas → ajuste que genera nueva versión ─────────────
    if (modificadas.length) {
      const { value: motivo, isConfirmed } = await Swal.fire({
        title: 'Motivo del ajuste',
        text: 'Los cambios generarán una nueva versión del presupuesto.',
        input: 'textarea',
        inputLabel: 'Motivo *',
        inputPlaceholder: 'Describa el motivo de los cambios...',
        inputValidator: v => (!v?.trim() ? 'El motivo es requerido' : null),
        showCancelButton: true,
        confirmButtonText: 'Guardar y versionar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#0d6efd'
      });
      if (!isConfirmed) return;

      // Crear nueva versión
      const nuevoRev = this.presupuestos.length;
      let nuevaVersion: IPresupuesto;
      try {
        nuevaVersion = await lastValueFrom(this.presupuestoService.create({
          id_project:   this.idProject,
          idCompany:    this.idCompany,
          numrevision:  nuevoRev,
          nombre:       `Rev.${nuevoRev}`,
          motivo,
          fecha_inicio: this.selectedPresupuesto!.fecha_inicio,
          fecha_fin:    this.selectedPresupuesto!.fecha_fin,
          vigente:      true,
          active:       true
        }));
      } catch {
        alerts.basicAlert('Error', 'No se pudo crear la nueva versión.', 'error');
        return;
      }

      // Copiar TODAS las líneas guardadas (con montos actualizados) + nuevas
      const lineasGuardadas = this.lineas.filter(l => typeof l.id === 'number');
      const todasLineas = [...lineasGuardadas, ...nuevas];

      if (todasLineas.length) {
        const ops = todasLineas.map(l => this.presupuestoService.createLinea({
          id_presupuesto: nuevaVersion.id,
          id_cuenta:      l.id_cuenta,
          descripcion:    l.descripcion,
          monto:          l.monto,
          active:         true
        }).pipe(catchError(e => { console.error(e); return EMPTY; })));
        await lastValueFrom(concat(...ops).pipe(toArray()));
      }

      alerts.basicAlert('Ajuste guardado', `Se creó ${nuevaVersion.nombre} con los cambios aplicados.`, 'success');
      this.loadData();
      return;
    }

    // ── Solo líneas nuevas → guardar directamente sin versionar ──────────
    const adds = nuevas.map(l => this.presupuestoService.createLinea({
      id_presupuesto: this.selectedPresupuesto!.id,
      id_cuenta:      l.id_cuenta,
      descripcion:    l.descripcion,
      monto:          l.monto,
      active:         true
    }).pipe(catchError(e => { console.error(e); return EMPTY; })));

    await lastValueFrom(concat(...adds).pipe(toArray()));
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

  // ── Diff entre versiones ──────────────────────────────────

  cargarDiff(): void {
    const previa = this.findVersionPrevia(this.selectedPresupuesto!);
    if (!previa) {
      alerts.basicAlert('Sin versión anterior', 'Esta es la primera versión del presupuesto, no hay versión anterior con la que comparar.', 'info');
      return;
    }
    this.versionPrevia = previa;
    this.loadingDiff = true;
    this.showDiff = true;
    this.showMeses = false;
    this.presupuestoService.getLineas(previa.id)
      .pipe(catchError(() => { this.loadingDiff = false; return EMPTY; }))
      .subscribe(l => {
        this.lineasPrevias = l;
        this.loadingDiff = false;
      });
  }

  private findVersionPrevia(p: IPresupuesto): IPresupuesto | null {
    const sorted = [...this.presupuestos].sort((a, b) => a.numrevision - b.numrevision);
    const idx = sorted.findIndex(x => x.id === p.id);
    return idx > 0 ? sorted[idx - 1] : null;
  }

  get diffRows(): any[] {
    const map = new Map<number, any>();

    for (const l of this.lineasPrevias) {
      map.set(l.id_cuenta, {
        id_cuenta:     l.id_cuenta,
        cuenta_codigo: l.cuenta_codigo ?? '',
        cuenta_nombre: l.cuenta_nombre ?? '',
        monto_previo:  l.monto,
        monto_actual:  0,
        tipo:          'eliminado'
      });
    }

    for (const l of this.lineas) {
      const existing = map.get(l.id_cuenta);
      if (existing) {
        existing.monto_actual = l.monto;
        existing.tipo = existing.monto_previo === l.monto ? 'igual' : 'modificado';
      } else {
        map.set(l.id_cuenta, {
          id_cuenta:     l.id_cuenta,
          cuenta_codigo: l.cuenta_codigo ?? '',
          cuenta_nombre: l.cuenta_nombre ?? '',
          monto_previo:  0,
          monto_actual:  l.monto,
          tipo:          'nuevo'
        });
      }
    }

    const order: Record<string, number> = { modificado: 0, nuevo: 1, eliminado: 2, igual: 3 };
    return Array.from(map.values())
      .map(r => ({ ...r, diferencia: r.monto_actual - r.monto_previo }))
      .filter(r => !this.soloMostrarCambios || r.tipo !== 'igual')
      .sort((a, b) => (order[a.tipo] ?? 3) - (order[b.tipo] ?? 3));
  }

  get diffResumen() {
    const counts = { modificado: 0, nuevo: 0, eliminado: 0, igual: 0 };
    for (const l of this.lineasPrevias) {
      const actual = this.lineas.find(x => x.id_cuenta === l.id_cuenta);
      if (!actual) counts.eliminado++;
      else if (actual.monto !== l.monto) counts.modificado++;
      else counts.igual++;
    }
    for (const l of this.lineas) {
      if (!this.lineasPrevias.find(x => x.id_cuenta === l.id_cuenta)) counts.nuevo++;
    }
    const totalPrevio = this.lineasPrevias.reduce((s, l) => s + l.monto, 0);
    const totalActual = this.lineas.reduce((s, l) => s + l.monto, 0);
    return { ...counts, totalPrevio, totalActual, delta: totalActual - totalPrevio };
  }

  // ── PDF Export ────────────────────────────────────────────

  async generarPDF(): Promise<void> {
    if (!this.selectedPresupuesto) {
      alerts.basicAlert('Sin selección', 'Seleccione un presupuesto primero.', 'warning');
      return;
    }
    if (!this.lineas.length) {
      alerts.basicAlert('Sin líneas', 'El presupuesto no tiene líneas de detalle.', 'warning');
      return;
    }
    this.generandoPDF = true;
    try {
      // Logo desde el root (empresa)
      const rootData: any = await lastValueFrom(
        this.rootService.getRootbyId(this.idCompany).pipe(catchError(() => of(null)))
      );
      let logoBase64: string | null = null;
      if (rootData?.picture) {
        try {
          logoBase64 = await this.base64EncodeService.convertImageToBase64(rootData.picture);
        } catch { /* sin logo */ }
      }
      const empresaNombre: string = rootData?.nombre || rootData?.name || 'HCO';

      // Columnas de meses según rango del presupuesto
      const mesesCols = this.buildMonthColumns();

      // Cargar distribución mensual de todas las líneas en paralelo
      const lineasReales = this.lineas.filter(l => typeof l.id === 'number');
      const mesMap = new Map<number, Map<string, number>>();

      if (lineasReales.length) {
        const obs = lineasReales.map(l =>
          this.presupuestoService.getMeses(l.id as number).pipe(
            map(meses => ({ id: l.id as number, meses })),
            catchError(() => of({ id: l.id as number, meses: [] }))
          )
        );
        const results = await lastValueFrom(forkJoin(obs));
        for (const r of results) {
          const mm = new Map<string, number>();
          for (const m of r.meses) {
            mm.set(`${m.anio}-${m.mes}`, m.monto);
          }
          mesMap.set(r.id, mm);
        }
      }

      const docDef = this.buildPresupuestoPdf(logoBase64, empresaNombre, mesesCols, mesMap);
      const nombre = this.selectedPresupuesto.nombre.replace(/[^a-zA-Z0-9_.-]/g, '-');
      await this.pdfWorkerService.generateAndDownload(
        docDef,
        `Presupuesto-${nombre}-${new Date().toISOString().substring(0, 10)}.pdf`
      );
    } catch (e) {
      console.error('Error generando PDF presupuesto:', e);
      alerts.basicAlert('Error', 'No se pudo generar el PDF.', 'error');
    } finally {
      this.generandoPDF = false;
    }
  }

  private buildMonthColumns(): { num: number; anio: number; label: string }[] {
    const p = this.selectedPresupuesto!;
    if (!p.fecha_inicio || !p.fecha_fin) return [];
    const start = new Date(p.fecha_inicio);
    const end   = new Date(p.fecha_fin);
    const cols: { num: number; anio: number; label: string }[] = [];
    const cur = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cur <= end && cols.length < 24) {
      const short = cur.toLocaleDateString('es-MX', { month: 'short' }).replace('.', '');
      const yy = String(cur.getFullYear()).slice(2);
      cols.push({ num: cur.getMonth() + 1, anio: cur.getFullYear(), label: `${short}.-${yy}` });
      cur.setMonth(cur.getMonth() + 1);
    }
    return cols;
  }

  private findParentCuenta(linea: IPresupuestoLinea): ICuentaContable | null {
    if (!linea.cuenta_codigo || !linea.cuenta_nivel || linea.cuenta_nivel <= 1) return null;
    const targetNivel = linea.cuenta_nivel - 1;
    const candidates = this.cuentasFlat.filter(c =>
      c.nivel === targetNivel && linea.cuenta_codigo!.startsWith(c.codigo)
    );
    if (!candidates.length) return null;
    return candidates.reduce((best, c) => c.codigo.length > best.codigo.length ? c : best);
  }

  private buildPresupuestoPdf(
    logoBase64: string | null,
    empresaNombre: string,
    mesesCols: { num: number; anio: number; label: string }[],
    mesMap: Map<number, Map<string, number>>
  ): any {
    const p = this.selectedPresupuesto!;
    const fmt = (v: number) =>
      new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(v);
    const nMeses = mesesCols.length || 1;
    const nFixed = 4;
    const totalCols = nFixed + nMeses;

    // Anchos dinámicos — TABLOID landscape (1224pt) menos márgenes 20+20 = 1184pt usables
    const fixedWidths = [38, 75, 75, 115];
    const usable = 1184;
    const monthW = Math.max(42, Math.floor((usable - fixedWidths.reduce((a, b) => a + b, 0)) / nMeses));
    const widths = [...fixedWidths, ...mesesCols.map(() => monthW)];

    // Fila de encabezado
    const thStyle = { bold: true, fontSize: 7, color: '#FFFFFF', fillColor: '#2D5F8A', alignment: 'center' };
    const headerRow = [
      { text: 'EMPRESA',          ...thStyle },
      { text: 'PROYECTO',         ...thStyle },
      { text: 'CLASIFICACION',    ...thStyle },
      { text: 'SUBCLASIFICACION', ...thStyle },
      ...mesesCols.map(m => ({ text: m.label.toUpperCase(), ...thStyle }))
    ];

    // Filas de datos + totales por mes
    const monthTotals = new Array(nMeses).fill(0);
    const dataRows = this.lineas.map(l => {
      const parent = this.findParentCuenta(l);
      const clasificacion   = parent ? parent.nombre : '';
      const subclasificacion = l.cuenta_nombre || l.descripcion || '';

      const monthCells = mesesCols.map((m, i) => {
        const mm = mesMap.get(l.id as number);
        const amount = mm?.get(`${m.anio}-${m.num}`) ?? 0;
        monthTotals[i] += amount;
        return { text: amount > 0 ? fmt(amount) : '', style: 'tdRight' };
      });

      return [
        { text: empresaNombre,                                style: 'td' },
        { text: p.proyecto_nombre || `Proyecto #${p.id_project}`, style: 'td' },
        { text: clasificacion,                                style: 'td' },
        { text: subclasificacion,                             style: 'td' },
        ...monthCells
      ];
    });

    // Acumulado mensual
    let running = 0;
    const monthAccum = monthTotals.map(t => { running += t; return running; });
    const grandTotal = running;

    const empty = (n: number) =>
      Array(n).fill({ text: '', border: [false, false, false, false] });

    const makeLabelRow = (label: string, values: number[], fillColor = '#D9E1F2') => [
      { text: label, colSpan: nFixed, alignment: 'right', bold: true, fontSize: 7, fillColor },
      ...Array(nFixed - 1).fill({}),
      ...values.map(v => ({ text: fmt(v), fontSize: 7, bold: true, alignment: 'right', fillColor }))
    ];

    const makeTotalRow = (label: string, total: number, fillColor = '#FFD700') => [
      { text: label, colSpan: nFixed + 1, alignment: 'right', bold: true, fontSize: 8, fillColor },
      ...Array(nFixed).fill({}),
      { text: fmt(total), fontSize: 8, bold: true, alignment: 'right', fillColor, colSpan: nMeses - 1 > 0 ? nMeses - 1 : 1 },
      ...Array(Math.max(0, nMeses - 2)).fill({})
    ];

    const body = [
      headerRow,
      ...dataRows,
      makeLabelRow('Costo Mensual $',    monthTotals, '#D9E1F2'),
      makeLabelRow('Costo Acumulado $',  monthAccum,  '#BDD7EE'),
      empty(totalCols),
      makeTotalRow('TOTAL DE EGRESOS $', grandTotal,  '#FFD700'),
      empty(totalCols),
      [
        { text: '', style: 'td' },
        { text: '', style: 'td' },
        { text: 'Ingreso', style: 'td' },
        { text: 'Facturación Mensual', style: 'td' },
        ...mesesCols.map(() => ({ text: '', style: 'td' }))
      ],
      makeLabelRow('Acumulado $', new Array(nMeses).fill(0), '#D9E1F2'),
      empty(totalCols),
      makeTotalRow('TOTAL DE INGRESOS $', 0, '#92D050'),
      empty(totalCols),
      makeTotalRow('MARGEN DEL NEGOCIO $', 0, '#FFD700'),
    ];

    return {
      pageSize: 'TABLOID',
      pageOrientation: 'landscape',
      pageMargins: [20, 65, 20, 20],
      header: this.buildPresupuestoPdfHeader(logoBase64, p),
      content: [{
        table: { headerRows: 1, widths, body },
        layout: 'lightHorizontalLines'
      }],
      styles: {
        td:      { fontSize: 7, margin: [1, 1, 1, 1] },
        tdRight: { fontSize: 7, alignment: 'right', margin: [1, 1, 1, 1] },
      }
    };
  }

  private buildPresupuestoPdfHeader(logoBase64: string | null, p: IPresupuesto): any {
    const logoCell = logoBase64
      ? { image: logoBase64, width: 50, alignment: 'left' }
      : { text: 'HCO', bold: true, fontSize: 14, alignment: 'left' };

    return {
      margin: [20, 8, 20, 0],
      table: {
        widths: ['12%', '*', '22%'],
        body: [[
          logoCell,
          {
            stack: [
              { text: 'FORMATO PRESUPUESTO PROYECTOS', fontSize: 11, bold: true, alignment: 'center', color: '#1A365D' },
              { text: 'Sistema de Gestión de Calidad', fontSize: 8, alignment: 'center', color: '#475569', margin: [0, 2, 0, 0] },
            ]
          },
          {
            stack: [
              { text: 'Código:     HCO-ADM-FO-021', fontSize: 7, alignment: 'right', color: '#334155' },
              { text: 'Referencia: HCO-ADM-SGC-005', fontSize: 7, alignment: 'right', color: '#334155' },
              { text: `Rev.:       ${p.numrevision ?? '00'}`, fontSize: 7, alignment: 'right', color: '#334155' },
            ]
          }
        ]]
      },
      layout: 'noBorders'
    };
  }
}
