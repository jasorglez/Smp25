import { Component, effect, inject, ChangeDetectorRef} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { NgSelectModule } from '@ng-select/ng-select';
import { MatIconModule } from '@angular/material/icon';
import { lastValueFrom } from 'rxjs';

import { SignalsService } from 'app/services/signals.service';
import { TrackingService } from 'app/services/tracking.service';
import { AuthService } from 'app/services/auth.service';
import { RootService } from 'app/services/root.service';
import { AdministrationService } from 'app/services/administration.service';
import { IncomesAndExpensesService } from 'app/services/incomes-and-expenses.service';
import { alerts } from 'app/helpers/alerts';

@Component({
  selector: 'app-aportaciones',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, NgSelectModule, MatIconModule],
  templateUrl: './aportaciones.component.html',
  styleUrl: './aportaciones.component.css'
})
export class AportacionesComponent {
  public signalsService = inject(SignalsService);
  private readonly cdr = inject(ChangeDetectorRef);
  public trackingService = inject(TrackingService);
  public authService = inject(AuthService);
  private rootService = inject(RootService);
  private administrationService = inject(AdministrationService);
  private incomesAndExpensesService = inject(IncomesAndExpensesService);

  // Current company
  root: number;
  idBranch: number;

  // Corporativo data
  allRoots: any[] = [];
  empresasCorporativo: any[] = [];
  empresasDestino: any[] = [];
  empresaActual: any = null;

  // Socios del corporativo (partner1-5)
  socios: { label: string; value: string }[] = [];
  socioSeleccionado: string = null;

  // Bank accounts destino
  bankAccountsDestino: any[] = [];

  // Form
  idEmpresaDestino: number = null;
  idCuentaDestino: number = null;
  monto: number = null;
  descripcion: string = '';
  fecha: string = new Date().toISOString().split('T')[0];
  isAportando: boolean = false;

  // Grid
  private gridApi: GridApi;
  historial: any[] = [];

  public gridOptions: any = {
    headerHeight: 24,
    rowHeight: 24,
    animateRows: true,
  };

  get colDefs(): ColDef[] {
    return [
      {
        field: 'date', headerName: 'Fecha', width: 120,
        valueFormatter: (params) => this.formatDate(params.value)
      },
      {
        field: 'socio', headerName: 'Socio', width: 220,
        valueGetter: (params) => {
          const desc: string = params.data.description || '';
          const match = desc.match(/^Aportaci[oó]n de (.+?) - /);
          return match ? match[1] : '';
        }
      },
      {
        field: 'empresaDestino', headerName: 'Empresa Destino', width: 180,
        valueGetter: (params) => {
          const r = this.allRoots.find(root => root.id === params.data.idBusinnes);
          return r ? (r.nameSmall || r.name) : params.data.idBusinnes;
        }
      },
      {
        field: 'total', headerName: 'Monto', width: 130,
        valueFormatter: params =>
          params.value?.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
      },
      { field: 'description', headerName: 'Descripcion', flex: 1, filter: true },
    ];
  }

  constructor() {
    effect(async () => {
      this.root = this.signalsService.getRootSelectedBySidebar()();
      this.idBranch = this.signalsService.getBranchSelectedBySidebar()();

      if (this.root) {
        await this.loadAllRoots();
        await this.loadHistorial();
      }
    }, { allowSignalWrites: true });
  }

  async loadAllRoots() {
    try {
      const roots: any = await lastValueFrom(this.rootService.getRoot());
      this.allRoots = Array.isArray(roots) ? roots : [];

      this.empresaActual = this.allRoots.find(r => r.id === this.root);
      const idCorporativo = this.empresaActual?.idCorporativo;

      if (idCorporativo) {
        this.empresasCorporativo = this.allRoots.filter(r => r.idCorporativo === idCorporativo);
        this.empresasDestino = [...this.empresasCorporativo];
      } else {
        this.empresasCorporativo = [];
        this.empresasDestino = [];
      }

      this.idEmpresaDestino = null;
      this.bankAccountsDestino = [];
      this.idCuentaDestino = null;

      await this.loadSocios(idCorporativo);
    } catch (err) {
      console.error('Error loading roots:', err);
      this.allRoots = [];
      this.empresasDestino = [];
    }
  
    this.cdr.detectChanges();}

  async loadSocios(idCorporativo: number) {
    if (!idCorporativo) {
      this.socios = [];
      return;
    }
    try {
      const corporativos: any = await lastValueFrom(this.rootService.getCorporativos());
      const corp = Array.isArray(corporativos)
        ? corporativos.find((c: any) => c.id === idCorporativo)
        : null;

      this.socios = [];
      if (corp) {
        for (let i = 1; i <= 5; i++) {
          const nombre: string = corp[`partner${i}`];
          const label = nombre?.trim() ? `Socio ${i} - ${nombre.trim()}` : `Socio ${i}`;
          const value = nombre?.trim() ? nombre.trim() : `Socio ${i}`;
          this.socios.push({ label, value });
        }
      }
    } catch (err) {
      console.error('Error loading socios:', err);
      this.socios = [];
    }
  
    this.cdr.detectChanges();}

  async onEmpresaDestinoChange() {
    this.idCuentaDestino = null;
    this.bankAccountsDestino = [];

    if (this.idEmpresaDestino) {
      this.administrationService.getAccountBanks(this.idEmpresaDestino).subscribe({
        next: (data: any) => {
          this.bankAccountsDestino = Array.isArray(data) ? data : [];
        },
        error: () => { this.bankAccountsDestino = []; }
      });
    }
  }

  async aportar() {
    if (!this.socioSeleccionado) {
      alerts.basicAlert('Aportación', 'Seleccione el socio que realiza la aportación.', 'error');
      return;
    }
    if (!this.idEmpresaDestino) {
      alerts.basicAlert('Aportación', 'Seleccione la empresa destino.', 'error');
      return;
    }
    if (!this.idCuentaDestino) {
      alerts.basicAlert('Aportación', 'Seleccione la cuenta bancaria destino.', 'error');
      return;
    }
    if (!this.monto || this.monto <= 0) {
      alerts.basicAlert('Aportación', 'Ingrese un monto válido.', 'error');
      return;
    }

    const empresaDestinoObj = this.empresasDestino.find(e => e.id === this.idEmpresaDestino);
    const nombreDestino = empresaDestinoObj?.nameSmall || empresaDestinoObj?.name || 'Destino';

    const result = await alerts.confirmAlert(
      'Confirmar Aportación',
      `${this.socioSeleccionado} aportará ${this.monto.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })} a ${nombreDestino}`,
      'question',
      'Aportar'
    );

    if (!result.isConfirmed) return;

    this.isAportando = true;
    alerts.showLoading('Procesando', 'Registrando aportación de socio...');

    try {
      const aportacionData: any = {
        type: 'APORTACION',
        idBusinnes: this.idEmpresaDestino,
        idBranch: 0,
        idAccount: this.idCuentaDestino,
        idCustomer: 0,
        formaPago: '03',
        description: `Aportación de ${this.socioSeleccionado} - ${this.descripcion || 'Aportación de socio'}`,
        date: this.fecha,
        total: this.monto,
        subtotal: this.monto,
        tax: 0,
        status: 'Pagada',
        active: true,
        createdBy: this.trackingService.getEmail() || 'Sistema',
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
      };

      await lastValueFrom(this.incomesAndExpensesService.addIncomesAndExpenses(aportacionData));

      alerts.closeLoading();
      alerts.basicAlert(
        'Aportación Registrada',
        `Se registró la aportación de ${this.socioSeleccionado} por ${this.monto.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })} a ${nombreDestino}.`,
        'success'
      );

      this.trackingService.addLog(
        this.trackingService.getnameComp(),
        `Aportación: ${this.socioSeleccionado} → ${nombreDestino} por ${this.monto}`,
        'Aportaciones',
        this.trackingService.getEmail()
      );

      this.monto = null;
      this.descripcion = '';
      this.fecha = new Date().toISOString().split('T')[0];

      await this.loadHistorial();

    } catch (error: any) {
      console.error('Error en aportación:', error);
      alerts.closeLoading();
      alerts.basicAlert(
        'Error',
        error?.error?.message || error?.error?.title || error?.message || 'Ocurrió un error al registrar la aportación.',
        'error'
      );
    } finally {
      this.isAportando = false;
    }
  
    this.cdr.detectChanges();}

  async loadHistorial() {
    if (!this.empresasCorporativo?.length) {
      this.historial = [];
      return;
    }

    const allRecords: any[] = [];
    for (const empresa of this.empresasCorporativo) {
      try {
        const records: any = await lastValueFrom(
          this.incomesAndExpensesService.getIncomesAndExpenses(empresa.id)
        );
        if (Array.isArray(records)) {
          allRecords.push(...records);
        }
      } catch {
        // Skip errors for individual companies
      }
    }

    this.historial = allRecords
      .filter(r => r.type === 'APORTACION')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  
    this.cdr.detectChanges();}

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  private formatDate(value: string): string {
    if (!value) return '';
    const date = new Date(value);
    return [
      date.getDate().toString().padStart(2, '0'),
      (date.getMonth() + 1).toString().padStart(2, '0'),
      date.getFullYear()
    ].join('-');
  }
}
