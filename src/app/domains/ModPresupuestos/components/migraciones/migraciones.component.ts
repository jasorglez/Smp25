import { Component, OnInit, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-community';
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
import { catchError, EMPTY } from 'rxjs';

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
  lineasVigentes: IPresupuestoLinea[] = [];
  migraciones: IPresupuestoMigracion[] = [];
  cuentasFlat: ICuentaContable[] = [];

  migracionForm!: FormGroup;
  procesando = false;

  private gridApi!: GridApi;

  public defaultColDef: ColDef = { sortable: true, filter: true, resizable: true };

  public columnDefsMigraciones: ColDef[] = [
    { headerName: 'Nueva Rev.', field: 'id_presupuesto_nuevo', width: 100 },
    { headerName: 'Cuenta Origen', field: 'cuenta_origen_nombre', flex: 1, minWidth: 180 },
    { headerName: 'Cuenta Destino', field: 'cuenta_destino_nombre', flex: 1, minWidth: 180 },
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

    this.presupuestoService.getVigente(this.idCompany, this.idProject)
      .pipe(catchError(() => { this.loading = false; return EMPTY; }))
      .subscribe(p => {
        this.presupuestoVigente = p;
        this.loading = false;
        this.loadLineas(p.id);
        this.loadMigraciones(p.id);
      });
  }

  loadLineas(idPresupuesto: number): void {
    this.presupuestoService.getLineas(idPresupuesto)
      .subscribe(l => this.lineasVigentes = l);
  }

  loadMigraciones(idPresupuesto: number): void {
    this.presupuestoService.getMigraciones(idPresupuesto)
      .subscribe(m => this.migraciones = m);
  }

  resetState(): void {
    this.presupuestoVigente = null;
    this.lineasVigentes = [];
    this.migraciones = [];
  }

  get cuentasOptions(): ICuentaContable[] {
    return this.cuentasFlat;
  }

  getSaldoLinea(idCuenta: number): number {
    const linea = this.lineasVigentes.find(l => l.id_cuenta === idCuenta);
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
      id_cuenta_origen: val.id_cuenta_origen,
      id_cuenta_destino: val.id_cuenta_destino,
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

  onGridReady(p: GridReadyEvent): void { this.gridApi = p.api; }

  formatCurrency(v: number): string {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(v ?? 0);
  }
}
