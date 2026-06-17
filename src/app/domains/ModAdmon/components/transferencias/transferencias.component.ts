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
import { CustomersService } from 'app/services/customers.service';
import { alerts } from 'app/helpers/alerts';

@Component({
  selector: 'app-transferencias',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, NgSelectModule, MatIconModule],
  templateUrl: './transferencias.component.html',
  styleUrl: './transferencias.component.css'
})
export class TransferenciasComponent {
  public signalsService = inject(SignalsService);
  private readonly cdr = inject(ChangeDetectorRef);
  public trackingService = inject(TrackingService);
  public authService = inject(AuthService);
  private rootService = inject(RootService);
  private administrationService = inject(AdministrationService);
  private incomesAndExpensesService = inject(IncomesAndExpensesService);
  private customersService = inject(CustomersService);

  // Current company
  root: number;
  idBranch: number;

  // Corporativo data
  allRoots: any[] = [];
  empresasCorporativo: any[] = [];
  empresasDestino: any[] = [];
  empresaOrigen: any = null;

  // Bank accounts
  bankAccountsOrigen: any[] = [];
  bankAccountsDestino: any[] = [];

  // Customers (PRÉSTAMOS INTEREMPRESA)
  customersOrigen: any[] = [];
  customersDestino: any[] = [];

  // Transfer form
  idEmpresaDestino: number = null;
  idCuentaOrigen: number = null;
  idCuentaDestino: number = null;
  monto: number = null;
  descripcion: string = '';
  fecha: string = new Date().toISOString().split('T')[0];
  isTransferring: boolean = false;

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
        field: 'empresaOrigen', headerName: 'Empresa Origen', width: 180,
        valueGetter: (params) => {
          const r = this.allRoots.find(root => root.id === params.data.idBusinnes);
          return r ? (r.nameSmall || r.name) : params.data.idBusinnes;
        }
      },
      {
        field: 'empresaDestino', headerName: 'Empresa Destino', width: 180,
        valueGetter: (params) => {
          if (!params.data._empresaDestinoId) return '';
          const r = this.allRoots.find(root => root.id === params.data._empresaDestinoId);
          return r ? (r.nameSmall || r.name) : params.data._empresaDestinoId;
        }
      },
      {
        field: 'total', headerName: 'Monto', width: 130,
        valueFormatter: params => params.value?.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
      },
      { field: 'description', headerName: 'Descripcion', width: 300, filter: true },
      { field: 'status', headerName: 'Estatus', width: 110 },
      { field: 'type', headerName: 'Tipo', width: 100 },
    ];
  }

  constructor() {
    effect(async () => {
      this.root = this.signalsService.getRootSelectedBySidebar()();
      this.idBranch = this.signalsService.getBranchSelectedBySidebar()();

      if (this.root) {
        await this.loadAllRoots();
        await this.loadBankAccountsOrigen();
        await this.loadHistorial();
      }
    }, { allowSignalWrites: true });
  }

  async loadAllRoots() {
    try {
      const roots: any = await lastValueFrom(this.rootService.getRoot());
      this.allRoots = Array.isArray(roots) ? roots : [];

      // Find current company and its corporativo
      this.empresaOrigen = this.allRoots.find(r => r.id === this.root);
      const idCorporativo = this.empresaOrigen?.idCorporativo;

      if (idCorporativo) {
        this.empresasCorporativo = this.allRoots.filter(r => r.idCorporativo === idCorporativo);
        this.empresasDestino = this.empresasCorporativo.filter(r => r.id !== this.root);
      } else {
        this.empresasCorporativo = [];
        this.empresasDestino = [];
      }

      // Reset destination selections
      this.idEmpresaDestino = null;
      this.bankAccountsDestino = [];
      this.idCuentaDestino = null;
    } catch (err) {
      console.error('Error loading roots:', err);
      this.allRoots = [];
      this.empresasDestino = [];
    }
  
    this.cdr.detectChanges();}

  async loadBankAccountsOrigen() {
    this.administrationService.getAccountBanks(this.root).subscribe({
      next: (data: any) => {
        this.bankAccountsOrigen = Array.isArray(data) ? data : [];
      },
      error: () => { this.bankAccountsOrigen = []; }
    });
  }

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

      // Load customers for both companies to find PRÉSTAMOS INTEREMPRESA
      await this.loadCustomers();
    }
  
    this.cdr.detectChanges();}

  async loadCustomers() {
    // Load customers from origin company (to find the special customer referencing destination)
    this.customersService.getCustomersByCompany(this.root, 'CUSTOMERS').subscribe({
      next: (data: any) => { this.customersOrigen = Array.isArray(data) ? data : []; },
      error: () => { this.customersOrigen = []; }
    });

    // Load customers from destination company (to find the special customer referencing origin)
    if (this.idEmpresaDestino) {
      this.customersService.getCustomersByCompany(this.idEmpresaDestino, 'CUSTOMERS').subscribe({
        next: (data: any) => { this.customersDestino = Array.isArray(data) ? data : []; },
        error: () => { this.customersDestino = []; }
      });
    }
  }

  findPrestamoCustomer(customers: any[], empresaRef: any): any {
    if (!customers || !empresaRef) return null;
    // Look for customer with name containing PRÉSTAMO or PRESTAMO and the company reference
    const refName = (empresaRef.nameSmall || empresaRef.name || '').toUpperCase();
    return customers.find(c => {
      const name = ((c.nameContact || c.company || c.name || '') as string).toUpperCase();
      return name.includes('PRÉSTAMO') || name.includes('PRESTAMO') || name.includes('INTEREMPRESA');
    });
  }

  async transferir() {
    // Validations
    if (!this.idEmpresaDestino) {
      alerts.basicAlert('Transferencia', 'Seleccione empresa destino.', 'error');
      return;
    }
    if (!this.idCuentaOrigen) {
      alerts.basicAlert('Transferencia', 'Seleccione cuenta bancaria origen.', 'error');
      return;
    }
    if (!this.idCuentaDestino) {
      alerts.basicAlert('Transferencia', 'Seleccione cuenta bancaria destino.', 'error');
      return;
    }
    if (!this.monto || this.monto <= 0) {
      alerts.basicAlert('Transferencia', 'Ingrese un monto valido.', 'error');
      return;
    }

    // Confirm
    const result = await alerts.confirmAlert(
      'Confirmar Transferencia',
      `Se transferiran ${this.monto.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })} de ${this.empresaOrigen?.nameSmall || 'Origen'} a ${this.empresasDestino.find(e => e.id === this.idEmpresaDestino)?.nameSmall || 'Destino'}`,
      'question',
      'Transferir'
    );

    if (!result.isConfirmed) return;

    this.isTransferring = true;
    alerts.showLoading('Procesando', 'Creando transferencia interempresa...');

    try {
      const empresaDestinoObj = this.empresasDestino.find(e => e.id === this.idEmpresaDestino);
      const nombreOrigen = this.empresaOrigen?.nameSmall || this.empresaOrigen?.name || 'Origen';
      const nombreDestino = empresaDestinoObj?.nameSmall || empresaDestinoObj?.name || 'Destino';

      // Find PRÉSTAMOS INTEREMPRESA customers
      const customerEnOrigen = this.findPrestamoCustomer(this.customersOrigen, empresaDestinoObj);
      const customerEnDestino = this.findPrestamoCustomer(this.customersDestino, this.empresaOrigen);

      // Step 1: Create GASTO (expense) in origin company
      const gastoData: any = {
        type: 'GASTO',
        idBusinnes: this.root,
        idBranch: this.idBranch || 0,
        idAccount: this.idCuentaOrigen,
        idCustomer: customerEnOrigen?.id || 0,
        formaPago: '03', // Transferencia electrónica
        description: `Transferencia a ${nombreDestino} - ${this.descripcion || 'Préstamo interempresa'}`,
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

      const gastoResponse: any = await lastValueFrom(
        this.incomesAndExpensesService.addIncomesAndExpenses(gastoData)
      );

      const gastoId = gastoResponse?.id;

      if (!gastoId) {
        alerts.closeLoading();
        alerts.basicAlert('Error', 'No se obtuvo el ID del registro de gasto.', 'error');
        this.isTransferring = false;
        return;
      }

      // Step 2: Create DEPOSITO (income) in destination company
      const depositoData: any = {
        type: 'DEPOSITO',
        idBusinnes: this.idEmpresaDestino,
        idBranch: 0,
        idAccount: this.idCuentaDestino,
        idCustomer: customerEnDestino?.id || 0,
        formaPago: '03',
        description: `Transferencia de ${nombreOrigen} - ${this.descripcion || 'Préstamo interempresa'}`,
        date: this.fecha,
        total: this.monto,
        subtotal: this.monto,
        tax: 0,
        status: 'Pagada',
        active: true,
        idTransferRef: gastoId,
        createdBy: this.trackingService.getEmail() || 'Sistema',
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
      };

      const depositoResponse: any = await lastValueFrom(
        this.incomesAndExpensesService.addIncomesAndExpenses(depositoData)
      );

      const depositoId = depositoResponse?.id;

      // Step 3: Update the GASTO with idTransferRef pointing to the DEPOSITO
      if (depositoId) {
        await lastValueFrom(
          this.incomesAndExpensesService.updateIncomesAndExpenses(gastoId, {
            ...gastoData,
            id: gastoId,
            idTransferRef: depositoId
          })
        );
      }

      alerts.closeLoading();
      alerts.basicAlert('Transferencia Exitosa',
        `Se ha transferido ${this.monto.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })} de ${nombreOrigen} a ${nombreDestino}.`,
        'success'
      );

      this.trackingService.addLog(
        this.trackingService.getnameComp(),
        `Transferencia interempresa: ${nombreOrigen} → ${nombreDestino} por ${this.monto}`,
        'Transferencias',
        this.trackingService.getEmail()
      );

      // Reset form
      this.monto = null;
      this.descripcion = '';
      this.fecha = new Date().toISOString().split('T')[0];

      // Reload history
      await this.loadHistorial();

    } catch (error) {
      console.error('Error en transferencia:', error);
      alerts.closeLoading();
      alerts.basicAlert('Error', 'Ocurrio un error al procesar la transferencia. Revise los registros.', 'error');
    } finally {
      this.isTransferring = false;
    }
  
    this.cdr.detectChanges();}

  async loadHistorial() {
    if (!this.empresasCorporativo?.length) {
      this.historial = [];
      return;
    }

    // Get all incomeandexpense for each company in the corporativo
    const allRecords: any[] = [];

    for (const empresa of this.empresasCorporativo) {
      try {
        const records: any = await lastValueFrom(
          this.incomesAndExpensesService.getIncomesAndExpenses(empresa.id)
        );
        if (Array.isArray(records)) {
          // Tag records with their company
          records.forEach(r => r._fromCompanyId = empresa.id);
          allRecords.push(...records);
        }
      } catch {
        // Skip errors for individual companies
      }
    }

    // Filter only records with idTransferRef
    const transferRecords = allRecords.filter(r => r.idTransferRef != null);

    // Group by transfer pair - show only GASTO side (origin)
    const gastos = transferRecords.filter(r => r.type === 'GASTO');

    // Enrich with destination company info
    this.historial = gastos.map(gasto => {
      // Find the matching DEPOSITO
      const deposito = transferRecords.find(
        r => r.type === 'DEPOSITO' && (r.idTransferRef === gasto.id || r.id === gasto.idTransferRef)
      );
      return {
        ...gasto,
        _empresaDestinoId: deposito?.idBusinnes || deposito?._fromCompanyId || null
      };
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  
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
