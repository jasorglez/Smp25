import { Component, OnInit, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridReadyEvent, ICellRendererParams } from 'ag-grid-community';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { PresupuestoService } from 'app/services/presupuesto.service';
import { CuentasContablesService } from 'app/services/cuentas-contables.service';
import { SignalsService } from 'app/services/signals.service';
import { TrackingService } from 'app/services/tracking.service';
import { alerts } from 'app/helpers/alerts';
import { IPresupuesto, IPresupuestoIncremento } from 'app/interface/ipresupuesto';
import { ICuentaContable } from 'app/interface/icuentas-contables';
import { catchError, EMPTY } from 'rxjs';

@Component({
  selector: 'app-incrementos',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, AgGridModule],
  templateUrl: './incrementos.component.html',
  styleUrl: './incrementos.component.scss'
})
export class IncrementosComponent implements OnInit {

  private presupuestoService = inject(PresupuestoService);
  private cuentasService = inject(CuentasContablesService);
  private signalsService = inject(SignalsService);
  private trackingService = inject(TrackingService);
  private fb = inject(FormBuilder);

  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  idCompany = 0;
  idProject = 0;
  loading = false;
  procesando = false;

  presupuestoVigente: IPresupuesto | null = null;
  incrementos: IPresupuestoIncremento[] = [];
  cuentasFlat: ICuentaContable[] = [];
  selectedRow: IPresupuestoIncremento | null = null;

  solicitudForm!: FormGroup;
  public getRowStyle = (p: any) => {
    if (p.data?.estado === 'pendiente') return { background: '#fff3cd' };
    if (p.data?.estado === 'rechazado') return { background: '#f8d7da' };
    return {};
  };

  public defaultColDef: ColDef = { sortable: true, filter: true, resizable: true };

  public columnDefs: ColDef[] = [
    {
      headerName: 'Estado',
      field: 'estado',
      width: 120,
      cellRenderer: (p: ICellRendererParams) => {
        const cls = p.value === 'autorizado' ? 'success'
                  : p.value === 'rechazado' ? 'danger' : 'warning';
        return `<span class="badge bg-${cls}">${p.value}</span>`;
      }
    },
    { headerName: 'Cuenta', field: 'cuenta_nombre', flex: 1, minWidth: 180 },
    {
      headerName: 'Monto Solicitado',
      field: 'monto_solicitado',
      width: 160,
      valueFormatter: p => p.value != null
        ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(p.value)
        : '$0.00'
    },
    { headerName: 'Motivo', field: 'motivo', flex: 2, minWidth: 200 },
    { headerName: 'Solicitó', field: 'usuario_solicito', width: 140 },
    { headerName: 'Autorizó', field: 'usuario_autorizo', width: 140 },
    {
      headerName: 'Fecha Solicitud',
      field: 'fecha_solicitud',
      width: 140,
      valueFormatter: p => p.value ? String(p.value).substring(0, 10) : ''
    },
    {
      headerName: 'Fecha Autorización',
      field: 'fecha_autorizacion',
      width: 160,
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
        this.presupuestoVigente = null;
        this.incrementos = [];
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
    this.solicitudForm = this.fb.group({
      id_cuenta:       [null, Validators.required],
      monto_solicitado:[0, [Validators.required, Validators.min(1)]],
      motivo:          ['', Validators.required]
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
        this.presupuestoService.getIncrementos(p.id)
          .subscribe(inc => this.incrementos = inc);
      });
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

  async solicitarIncremento(): Promise<void> {
    if (this.solicitudForm.invalid) {
      alerts.basicAlert('Campos requeridos', 'Complete todos los campos.', 'warning');
      return;
    }
    const val = this.solicitudForm.value;
    const confirm = await alerts.confirmAlert(
      '¿Solicitar incremento?',
      `Se enviará solicitud de incremento por ${new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val.monto_solicitado)} a Dirección General.`,
      'warning', 'Sí, solicitar'
    );
    if (!confirm.isConfirmed) return;

    this.procesando = true;
    this.presupuestoService.solicitarIncremento({
      id_presupuesto: this.presupuestoVigente!.id,
      id_cuenta: Number(val.id_cuenta),
      monto_solicitado: val.monto_solicitado,
      motivo: val.motivo,
      estado: 'pendiente',
      usuario_solicito: this.trackingService.getEmail(),
      active: true
    })
    .pipe(catchError(() => {
      alerts.basicAlert('Error', 'No se pudo registrar la solicitud.', 'error');
      this.procesando = false;
      return EMPTY;
    }))
    .subscribe(() => {
      this.procesando = false;
      alerts.basicAlert(
        'Solicitud enviada',
        'Se registró la solicitud y se notificará a Dirección General.',
        'success'
      );
      this.solicitudForm.reset({ monto_solicitado: 0 });
      this.loadData();
    });
  }

  async autorizar(): Promise<void> {
    if (!this.selectedRow || this.selectedRow.estado !== 'pendiente') return;
    const confirm = await alerts.confirmAlert(
      '¿Autorizar incremento?',
      `Se autorizarán ${new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(this.selectedRow.monto_solicitado)} y se creará una nueva versión del presupuesto.`,
      'warning', 'Sí, autorizar'
    );
    if (!confirm.isConfirmed) return;

    this.presupuestoService.autorizarIncremento(this.selectedRow.id, this.trackingService.getEmail())
      .pipe(catchError(() => { alerts.basicAlert('Error', 'No se pudo autorizar.', 'error'); return EMPTY; }))
      .subscribe(nuevaVersion => {
        alerts.basicAlert('Autorizado', `Incremento autorizado. Nueva versión: ${nuevaVersion.nombre}.`, 'success');
        this.selectedRow = null;
        this.loadData();
      });
  }

  async rechazar(): Promise<void> {
    if (!this.selectedRow || this.selectedRow.estado !== 'pendiente') return;
    this.presupuestoService.rechazarIncremento(this.selectedRow.id, this.trackingService.getEmail())
      .pipe(catchError(() => { alerts.basicAlert('Error', 'No se pudo rechazar.', 'error'); return EMPTY; }))
      .subscribe(() => {
        alerts.basicAlert('Rechazado', 'La solicitud fue rechazada.', 'info');
        this.selectedRow = null;
        this.loadData();
      });
  }

  onGridReady(_p: GridReadyEvent): void { }

  onSelectionChanged(e: any): void {
    const nodes = e.api.getSelectedNodes();
    this.selectedRow = nodes.length ? nodes[0].data : null;
  }

  formatCurrency(v: number): string {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(v ?? 0);
  }
}
