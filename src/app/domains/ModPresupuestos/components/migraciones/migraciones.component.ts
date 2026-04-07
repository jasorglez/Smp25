import { Component, OnInit, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef } from 'ag-grid-community';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { PresupuestoService } from 'app/services/presupuesto.service';
import { CuentasContablesService } from 'app/services/cuentas-contables.service';
import { SignalsService } from 'app/services/signals.service';
import { TrackingService } from 'app/services/tracking.service';
import { alerts } from 'app/helpers/alerts';
import {
  IPresupuesto,
  IPresupuestoLinea,
  IPresupuestoMigracion
} from 'app/interface/ipresupuesto';
import { ICuentaContable } from 'app/interface/icuentas-contables';
import { catchError, EMPTY, forkJoin, of } from 'rxjs';

@Component({
  selector: 'app-migraciones',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, AgGridModule],
  templateUrl: './migraciones.component.html',
  styleUrl: './migraciones.component.scss'
})
export class MigracionesComponent implements OnInit {

  private presupuestoService = inject(PresupuestoService);
  private cuentasService = inject(CuentasContablesService);
  private signalsService = inject(SignalsService);
  private trackingService = inject(TrackingService);
  private fb = inject(FormBuilder);

  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  idCompany = 0;
  idProject = 0;
  loading = false;

  presupuestoVigente: IPresupuesto | null = null;
  todosPresupuestos: IPresupuesto[] = [];
  lineasVigentes: IPresupuestoLinea[] = [];
  migraciones: IPresupuestoMigracion[] = [];
  cuentasFlat: ICuentaContable[] = [];

  migracionForm!: FormGroup;
  procesando = false;

  public defaultColDef: ColDef = { sortable: true, filter: true, resizable: true };

  public columnDefsMigraciones: ColDef[] = [
    {
      headerName: 'Nueva Rev.',
      field: 'id_presupuesto_nuevo',
      width: 110,
      valueFormatter: p => {
        const pres = this.todosPresupuestos.find(x => x.id === Number(p.value));
        return pres ? pres.nombre : (p.value ? `#${p.value}` : '');
      }
    },
    {
      headerName: 'Cuenta Origen',
      field: 'id_cuenta_origen',
      flex: 1,
      minWidth: 180,
      valueFormatter: p => {
        if (p.data?.cuenta_origen_nombre) return p.data.cuenta_origen_nombre;
        const c = this.cuentasFlat.find(x => x.id === Number(p.value));
        return c ? `${c.codigo} — ${c.nombre}` : (p.value ? String(p.value) : '');
      }
    },
    {
      headerName: 'Cuenta Destino',
      field: 'id_cuenta_destino',
      flex: 1,
      minWidth: 180,
      valueFormatter: p => {
        if (p.data?.cuenta_destino_nombre) return p.data.cuenta_destino_nombre;
        const c = this.cuentasFlat.find(x => x.id === Number(p.value));
        return c ? `${c.codigo} — ${c.nombre}` : (p.value ? String(p.value) : '');
      }
    },
    {
      headerName: 'Monto Transferido',
      field: 'monto_transferido',
      width: 170,
      valueFormatter: p => p.value != null
        ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(p.value)
        : '$0.00'
    },
    { headerName: 'Motivo', field: 'motivo', flex: 2, minWidth: 200 },
    { headerName: 'Usuario', field: 'usuario', width: 140 },
    {
      headerName: 'Fecha',
      field: 'fecha',
      width: 130,
      valueFormatter: p => p.value ? String(p.value).substring(0, 10) : ''
    }
  ];

  constructor() {
    effect(() => {
      this.idCompany = this.signalsService.getRootSelectedBySidebar()();
      this.idProject = this.signalsService.getProjectSelectedBySidebar()() ?? 0;
      if (this.idCompany && this.idProject) {
        this.loadData();
      } else {
        this.resetState();
      }
    });
  }

  ngOnInit(): void {
    this.initForm();
    this.idCompany = this.signalsService.getRootSelectedBySidebar()();
    this.idProject = this.signalsService.getProjectSelectedBySidebar()() ?? 0;
    if (this.idCompany && this.idProject) {
      this.loadData();
    }
  }

  initForm(): void {
    this.migracionForm = this.fb.group({
      id_cuenta_origen:  [null, Validators.required],
      id_cuenta_destino: [null, Validators.required],
      monto_transferido: [0, [Validators.required, Validators.min(1)]],
      motivo:            ['', Validators.required]
    });
  }

  loadData(): void {
    this.loading = true;
    this.cuentasService.getAll(this.idCompany).subscribe(c => this.cuentasFlat = c);

    forkJoin({
      vigente: this.presupuestoService.getVigente(this.idCompany, this.idProject),
      todos:   this.presupuestoService.getAll(this.idCompany, this.idProject)
    }).pipe(catchError(() => { this.loading = false; return EMPTY; }))
      .subscribe(({ vigente, todos }) => {
        this.presupuestoVigente = vigente;
        this.todosPresupuestos  = todos;
        this.loading = false;
        this.loadLineas(vigente.id);
        this.cargarTodasMigraciones(todos.map(p => p.id));
      });
  }

  loadLineas(idPresupuesto: number): void {
    this.presupuestoService.getLineas(idPresupuesto)
      .subscribe(l => this.lineasVigentes = l);
  }

  cargarTodasMigraciones(ids: number[]): void {
    if (!ids.length) { this.migraciones = []; return; }
    forkJoin(ids.map(id =>
      this.presupuestoService.getMigraciones(id).pipe(catchError(() => of([] as IPresupuestoMigracion[])))
    )).subscribe(resultados => {
      const vistas = new Set<number>();
      this.migraciones = resultados
        .flat()
        .filter(m => { if (vistas.has(m.id)) return false; vistas.add(m.id); return true; })
        .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
    });
  }

  resetState(): void {
    this.presupuestoVigente = null;
    this.todosPresupuestos  = [];
    this.lineasVigentes     = [];
    this.migraciones        = [];
  }

  get cuentasHoja(): ICuentaContable[] {
    return this.cuentasFlat.filter(c => c.esHoja);
  }

  getCuentaPadre(cuenta: ICuentaContable): string {
    const parent = this.cuentasFlat.find(
      c => c.nivel === cuenta.nivel - 1 && cuenta.codigo.startsWith(c.codigo)
    );
    return parent?.nombre ?? '';
  }

  getSaldoLinea(idCuenta: any): number {
    const id = Number(idCuenta);
    const linea = this.lineasVigentes.find(l => l.id_cuenta === id);
    return linea?.saldo_disponible ?? 0;
  }

  async ejecutarMigracion(): Promise<void> {
    if (this.migracionForm.invalid) {
      alerts.basicAlert('Campos requeridos', 'Complete todos los campos.', 'warning');
      return;
    }

    const val = this.migracionForm.value;

    if (val.id_cuenta_origen === val.id_cuenta_destino) {
      alerts.basicAlert('Error', 'La cuenta origen y destino no pueden ser la misma.', 'error');
      return;
    }

    const saldoOrigen = this.getSaldoLinea(val.id_cuenta_origen);
    if (val.monto_transferido > saldoOrigen) {
      alerts.basicAlert(
        'Saldo insuficiente',
        `El saldo disponible en la cuenta origen es ${new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(saldoOrigen)}.`,
        'warning'
      );
      return;
    }

    const confirm = await alerts.confirmAlert(
      '¿Ejecutar migración?',
      `Se transferirán ${new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val.monto_transferido)} entre cuentas. Se creará una nueva versión del presupuesto.`,
      'warning', 'Sí, migrar'
    );
    if (!confirm.isConfirmed) return;

    this.procesando = true;
    this.presupuestoService.ejecutarMigracion({
      id_presupuesto_vigente: this.presupuestoVigente!.id,
      id_cuenta_origen:  Number(val.id_cuenta_origen),
      id_cuenta_destino: Number(val.id_cuenta_destino),
      monto_transferido: val.monto_transferido,
      motivo: val.motivo,
      usuario: this.trackingService.getEmail(),
      idCompany: this.idCompany
    })
    .pipe(catchError(() => {
      alerts.basicAlert('Error', 'No se pudo ejecutar la migración.', 'error');
      this.procesando = false;
      return EMPTY;
    }))
    .subscribe(nuevaPrev => {
      this.procesando = false;
      alerts.basicAlert(
        'Migración ejecutada',
        `Se creó ${nuevaPrev.nombre} con los montos actualizados.`,
        'success'
      );
      this.migracionForm.reset({ monto_transferido: 0 });
      this.loadData();
    });
  }


  formatCurrency(v: number): string {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(v ?? 0);
  }
}
