import { Component, Input, Output, EventEmitter, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-community';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { forkJoin, Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { UsersxpermissionsService } from 'app/services/usersxpermissions.service';
import { RootService } from 'app/services/root.service';
import { BranchsService } from 'app/services/branchs.service';
import { ContractsService } from 'app/services/contracts.service';
import { ProjectsService } from 'app/services/projects.service';
import { alerts } from 'app/helpers/alerts';
import { ButtonCellRendererExpenditureComponent } from 'app/domains/ModAdmon/components/egresos-palacio/button-cell-renderer-expenditure.component';

// ─── Detail renderer: proyectos por contrato ──────────────────────────────────
@Component({
  selector: 'app-proyectos-detail-renderer',
  standalone: true,
  imports: [AgGridModule, CommonModule, FormsModule],
  template: `
    <div style="padding:8px;background:#e8f4fd;height:100%;display:flex;flex-direction:column;">

      <!-- Toolbar -->
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap;">
        <strong style="font-size:0.85rem;margin-right:auto;">
          <i class="bi bi-diagram-3 me-1"></i> Proyectos — {{ contractName }}
        </strong>
        <select
          class="form-select form-select-sm"
          style="width:260px;"
          [(ngModel)]="selectedNewProjectId"
          [disabled]="availableProjects.length === 0">
          <option value="">-- Seleccionar proyecto --</option>
          <option *ngFor="let p of availableProjects" [value]="p.id">
            {{ p.name ?? p.projectName }}
          </option>
        </select>
        <button
          class="btn btn-sm btn-primary"
          (click)="addProyecto()"
          [disabled]="!selectedNewProjectId || isSaving"
          title="Agregar proyecto">
          <i class="bi bi-plus-lg"></i>
        </button>
        <button
          class="btn btn-sm btn-danger"
          (click)="deleteProyecto()"
          [disabled]="!selectedRow || isSaving"
          title="Quitar proyecto seleccionado">
          <i class="bi bi-trash"></i>
        </button>
      </div>

      <!-- Grid -->
      <div style="flex:1;min-height:0;">
        <ag-grid-angular
          class="ag-theme-quartz small-text-ag-grid"
          style="width:100%;height:100%;"
          [columnDefs]="cols"
          [rowData]="projects"
          [gridOptions]="gridOptions"
          rowSelection="single"
          (gridReady)="onGridReady($event)"
          (selectionChanged)="onSelectionChanged($event)">
        </ag-grid-angular>
      </div>

    </div>
  `
})
export class ProyectosDetailRendererComponent implements ICellRendererAngularComp {
  private projectsService          = inject(ProjectsService);
  private usersxpermissionsService = inject(UsersxpermissionsService);

  projects: any[] = [];
  availableProjects: any[] = [];
  selectedNewProjectId: string = '';
  selectedRow: any = null;
  isSaving = false;
  contractName: string = '';
  private userId: number = 0;
  private contractId: number = 0;
  private gridApi!: GridApi;

  cols: ColDef[] = [
    { field: 'id',                 hide: true },
    { field: 'idProject',          hide: true },
    { field: 'projectName',        headerName: 'Proyecto',     flex: 2 },
    { field: 'projectDescription', headerName: 'Descripción',  flex: 1 }
  ];

  gridOptions: any = { headerHeight: 25, rowHeight: 22, suppressCellFocus: true };

  agInit(params: any): void {
    this.contractName = params.data?.name ?? '';
    this.userId       = params.data?.userId;
    this.contractId   = params.data?.contractId;
    if (this.userId && this.contractId) {
      this.loadData();
    }
  }

  private loadData(): void {
    forkJoin({
      assigned:    this.projectsService.getProjectsByContract(this.userId, this.contractId)
                     .pipe(catchError(() => of([]))),
      allProjects: this.projectsService.getProjectListByContract(this.contractId)
                     .pipe(catchError(() => of([])))
    }).subscribe(({ assigned, allProjects }) => {
      const assignedArr = Array.isArray(assigned)    ? assigned    : [];
      const allArr      = Array.isArray(allProjects) ? allProjects : [];

      const assignedIds = new Set(assignedArr.map((p: any) => p.idProject));

      this.projects = assignedArr.map((p: any) => ({ ...p }));

      this.availableProjects  = allArr.filter((p: any) => !assignedIds.has(p.id));
      this.selectedNewProjectId = '';
      this.selectedRow = null;
      if (this.gridApi) this.gridApi.setGridOption('rowData', this.projects);
    });
  }

  addProyecto(): void {
    if (!this.selectedNewProjectId || this.isSaving) return;
    this.isSaving = true;
    const payload = {
      idUser:       this.userId,
      idPermission: +this.selectedNewProjectId,
      type:         'project',
      description:  null,
      active:       1
    };
    this.usersxpermissionsService.addUserxPermission(payload).subscribe({
      next:  () => { this.isSaving = false; this.loadData(); },
      error: () => { this.isSaving = false; alerts.basicAlert('Error', 'No se pudo agregar el proyecto', 'error'); }
    });
  }

  deleteProyecto(): void {
    if (!this.selectedRow || this.isSaving) return;
    alerts.confirmAlert(
      'Quitar proyecto',
      `¿Quitar <b>${this.selectedRow.projectName}</b> de este usuario?`,
      'warning',
      'Sí, quitar'
    ).then(result => {
      if (!result.isConfirmed) return;
      this.isSaving = true;
      this.usersxpermissionsService.deleteUserxPermission(this.selectedRow.id).subscribe({
        next:  () => { this.isSaving = false; this.selectedRow = null; this.loadData(); },
        error: () => { this.isSaving = false; alerts.basicAlert('Error', 'No se pudo quitar el proyecto', 'error'); }
      });
    });
  }

  onGridReady(event: GridReadyEvent): void { this.gridApi = event.api; }

  onSelectionChanged(event: any): void {
    const nodes = event.api.getSelectedNodes();
    this.selectedRow = nodes.length > 0 ? nodes[0].data : null;
  }

  refresh(): boolean { return false; }
}

// ─── Detail renderer: contratos por sucursal ──────────────────────────────────
@Component({
  selector: 'app-contratos-detail-renderer',
  standalone: true,
  imports: [AgGridModule, CommonModule, FormsModule, ProyectosDetailRendererComponent, ButtonCellRendererExpenditureComponent],
  template: `
    <div style="padding:8px;background:#fff8e1;height:100%;display:flex;flex-direction:column;">

      <!-- Toolbar -->
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap;">
        <strong style="font-size:0.85rem;margin-right:auto;">
          <i class="bi bi-file-earmark-text me-1"></i> Contratos — {{ branchName }}
        </strong>
        <select
          class="form-select form-select-sm"
          style="width:260px;"
          [(ngModel)]="selectedNewContractId"
          [disabled]="availableContracts.length === 0">
          <option value="">-- Seleccionar contrato --</option>
          <option *ngFor="let c of availableContracts" [value]="c.idContrato">
            {{ c.numberContract }} - {{ c.descripSmall }}
          </option>
        </select>
        <button
          class="btn btn-sm btn-primary"
          (click)="addContrato()"
          [disabled]="!selectedNewContractId || isSaving"
          title="Agregar contrato">
          <i class="bi bi-plus-lg"></i>
        </button>
        <button
          class="btn btn-sm btn-danger"
          (click)="deleteContrato()"
          [disabled]="!selectedRow || isSaving"
          title="Quitar contrato seleccionado">
          <i class="bi bi-trash"></i>
        </button>
      </div>

      <!-- Grid -->
      <div style="flex:1;min-height:0;">
        <ag-grid-angular
          class="ag-theme-quartz small-text-ag-grid"
          style="width:100%;height:100%;"
          [columnDefs]="cols"
          [rowData]="contracts"
          [gridOptions]="gridOptions"
          [components]="components"
          rowSelection="single"
          (gridReady)="onGridReady($event)"
          (selectionChanged)="onSelectionChanged($event)">
        </ag-grid-angular>
      </div>

    </div>
  `
})
export class ContratosDetailRendererComponent implements ICellRendererAngularComp {
  private contractsService         = inject(ContractsService);
  private usersxpermissionsService = inject(UsersxpermissionsService);
  private projectsService          = inject(ProjectsService);

  contracts: any[] = [];
  availableContracts: any[] = [];
  selectedNewContractId: string = '';
  selectedRow: any = null;
  isSaving = false;
  branchName: string = '';
  private userId: number = 0;
  private branchId: number = 0;
  private gridApi!: GridApi;

  components = {
    proyectosDetail: ProyectosDetailRendererComponent,
    buttonRenderer:  ButtonCellRendererExpenditureComponent
  };

  cols: ColDef[] = [
    { field: 'permissionId', hide: true, filter: 'agNumberColumnFilter' },
    { field: 'contractId',   hide: true },
    { field: 'name',         headerName: 'Contrato',    flex: 2 },
    { field: 'descripSmall', headerName: 'Descripción', flex: 1 },
    {
      field: 'countProyectos',
      headerName: 'Proyectos',
      width: 120,
      editable: false,
      cellRenderer: ButtonCellRendererExpenditureComponent,
      cellRendererParams: {
        icon: 'bi bi-diagram-3',
        onClick: (node: any) => this.toggleProyectos(node)
      },
      valueGetter: (params) => params.data?.countProyectos ?? 0,
      cellStyle: { backgroundColor: '#d6eaf8', cursor: 'pointer' }
    }
  ];

  gridOptions: any = {
    headerHeight: 25,
    rowHeight: 22,
    suppressCellFocus: true,
    masterDetail: true,
    isRowMaster: () => true,
    detailCellRenderer: 'proyectosDetail',
    detailRowHeight: 180
  };

  agInit(params: any): void {
    this.branchName = params.data?.name ?? '';
    this.userId     = params.data?.userId;
    this.branchId   = params.data?.idBranch;
    if (this.userId && this.branchId) {
      this.loadData();
    }
  }

  private loadData(): void {
    forkJoin({
      assigned:    this.contractsService.getContractsByBranch(this.userId, this.branchId)
                     .pipe(catchError(() => of([]))),
      allContracts: this.contractsService.getContracts(this.branchId)
                     .pipe(catchError(() => of([]))),
      permissions: this.usersxpermissionsService.getUsersxPermissionsGeneral('contract', this.userId)
                     .pipe(catchError(() => of([])))
    }).subscribe(({ assigned, allContracts, permissions }) => {
      const assignedArr = Array.isArray(assigned)     ? assigned     : [];
      const allArr      = Array.isArray(allContracts) ? allContracts : [];
      const permsArr    = Array.isArray(permissions)  ? permissions  : [];

      const assignedIds = new Set(assignedArr.map((c: any) => c.contractId));
      const permsMap    = new Map(permsArr.map((p: any) => [p.idPermission, p.id]));

      this.contracts = assignedArr.map((c: any) => ({
        permissionId:  permsMap.get(c.contractId),
        contractId:    c.contractId,
        name:          c.contract,
        descripSmall:  c.descripSmall,
        userId:        this.userId,
        countProyectos: 0
      }));

      this.availableContracts    = allArr.filter((c: any) => !assignedIds.has(c.idContrato));
      this.selectedNewContractId = '';
      this.selectedRow           = null;

      if (this.gridApi) this.gridApi.setGridOption('rowData', this.contracts);

      if (this.contracts.length === 0) return;

      const projectRequests: Record<string, Observable<any>> = {};
      this.contracts.forEach(row => {
        projectRequests[row.contractId] = this.projectsService
          .getProjectsByContract(this.userId, row.contractId)
          .pipe(catchError(() => of([])));
      });

      forkJoin(projectRequests).subscribe({
        next: projectData => {
          this.contracts = this.contracts.map(row => ({
            ...row,
            countProyectos: Array.isArray(projectData[row.contractId])
              ? projectData[row.contractId].length
              : 0
          }));
          if (this.gridApi) this.gridApi.setGridOption('rowData', this.contracts);
        }
      });
    });
  }

  toggleProyectos(node: any): void {
    const isExpanded = node.expanded;
    this.gridApi.forEachNode((n: any) => { if (n.expanded) n.setExpanded(false); });

    if (!isExpanded) {
      this.gridApi.setFilterModel(null);
      this.gridApi.setFilterModel({ permissionId: { filterType: 'number', type: 'equals', filter: node.data.permissionId } });
      this.gridApi.onFilterChanged();
      setTimeout(() => node.setExpanded(true), 50);
    } else {
      this.gridApi.setFilterModel(null);
      this.gridApi.onFilterChanged();
    }
  }

  addContrato(): void {
    if (!this.selectedNewContractId || this.isSaving) return;
    this.isSaving = true;
    const payload = {
      idUser:       this.userId,
      idPermission: +this.selectedNewContractId,
      type:         'contract',
      description:  null,
      active:       1
    };
    this.usersxpermissionsService.addUserxPermission(payload).subscribe({
      next:  () => { this.isSaving = false; this.loadData(); },
      error: () => { this.isSaving = false; alerts.basicAlert('Error', 'No se pudo agregar el contrato', 'error'); }
    });
  }

  deleteContrato(): void {
    if (!this.selectedRow || this.isSaving) return;
    alerts.confirmAlert(
      'Quitar contrato',
      `¿Quitar <b>${this.selectedRow.name}</b> de este usuario?`,
      'warning',
      'Sí, quitar'
    ).then(result => {
      if (!result.isConfirmed) return;
      this.isSaving = true;
      this.usersxpermissionsService.deleteUserxPermission(this.selectedRow.permissionId).subscribe({
        next:  () => { this.isSaving = false; this.selectedRow = null; this.loadData(); },
        error: () => { this.isSaving = false; alerts.basicAlert('Error', 'No se pudo quitar el contrato', 'error'); }
      });
    });
  }

  onGridReady(event: GridReadyEvent): void { this.gridApi = event.api; }

  onSelectionChanged(event: any): void {
    const nodes = event.api.getSelectedNodes();
    this.selectedRow = nodes.length > 0 ? nodes[0].data : null;
  }

  refresh(): boolean { return false; }
}

// ─── Detail renderer: sucursales por empresa ──────────────────────────────────
@Component({
  selector: 'app-sucursales-detail-renderer',
  standalone: true,
  imports: [AgGridModule, CommonModule, FormsModule, ContratosDetailRendererComponent, ButtonCellRendererExpenditureComponent],
  template: `
    <div style="padding:8px;background:#f0fff4;height:100%;display:flex;flex-direction:column;">

      <!-- Toolbar -->
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap;">
        <strong style="font-size:0.85rem;margin-right:auto;">
          <i class="bi bi-geo-alt me-1"></i> Sucursales — {{ companyName }}
        </strong>
        <select
          class="form-select form-select-sm"
          style="width:220px;"
          [(ngModel)]="selectedNewBranchId"
          [disabled]="availableBranches.length === 0">
          <option value="">-- Seleccionar sucursal --</option>
          <option *ngFor="let b of availableBranches" [value]="b.id">{{ b.name }}</option>
        </select>
        <button
          class="btn btn-sm btn-primary"
          (click)="addSucursal()"
          [disabled]="!selectedNewBranchId || isSaving"
          title="Agregar sucursal">
          <i class="bi bi-plus-lg"></i>
        </button>
        <button
          class="btn btn-sm btn-danger"
          (click)="deleteSucursal()"
          [disabled]="!selectedRow || isSaving"
          title="Quitar sucursal seleccionada">
          <i class="bi bi-trash"></i>
        </button>
      </div>

      <!-- Grid -->
      <div style="flex:1;min-height:0;">
        <ag-grid-angular
          class="ag-theme-quartz small-text-ag-grid"
          style="width:100%;height:100%;"
          [columnDefs]="cols"
          [rowData]="branches"
          [gridOptions]="gridOptions"
          [components]="components"
          rowSelection="single"
          (gridReady)="onGridReady($event)"
          (selectionChanged)="onSelectionChanged($event)">
        </ag-grid-angular>
      </div>

    </div>
  `
})
export class SucursalesDetailRendererComponent implements ICellRendererAngularComp {
  private branchsService           = inject(BranchsService);
  private usersxpermissionsService = inject(UsersxpermissionsService);
  private contractsService         = inject(ContractsService);

  branches: any[] = [];
  companyName: string = '';
  availableBranches: any[] = [];
  selectedNewBranchId: string = '';
  selectedRow: any = null;
  isSaving = false;
  private userId: number = 0;
  private idCompany: number = 0;
  private gridApi!: GridApi;

  components = {
    contratosDetail:  ContratosDetailRendererComponent,
    buttonRenderer:   ButtonCellRendererExpenditureComponent
  };

  cols: ColDef[] = [
    { field: 'id',   hide: true, filter: 'agNumberColumnFilter' },
    { field: 'name', headerName: 'Sucursal', flex: 1 },
    {
      field: 'countContratos',
      headerName: 'Contratos',
      width: 120,
      editable: false,
      cellRenderer: ButtonCellRendererExpenditureComponent,
      cellRendererParams: {
        icon: 'bi bi-file-earmark-text',
        onClick: (node: any) => this.toggleContratos(node)
      },
      valueGetter: (params) => params.data?.countContratos ?? 0,
      cellStyle: { backgroundColor: '#fff9c4', cursor: 'pointer' }
    }
  ];

  gridOptions: any = {
    headerHeight: 25,
    rowHeight: 22,
    suppressCellFocus: true,
    masterDetail: true,
    isRowMaster: () => true,
    detailCellRenderer: 'contratosDetail',
    detailRowHeight: 280
  };

  agInit(params: any): void {
    this.companyName = params.data?.nombre ?? '';
    this.userId      = params.data?.userId;
    this.idCompany   = params.data?.idPermission;
    if (this.userId && this.idCompany) {
      this.loadData();
    }
  }

  private loadData(): void {
    forkJoin({
      assigned:  this.branchsService.getBranchesByUserAndCompany(this.userId, this.idCompany)
                   .pipe(catchError(() => of({ project: [] }))),
      available: this.usersxpermissionsService.getDataUsersxPermissionsbranch(this.idCompany, this.userId)
                   .pipe(catchError(() => of([])))
    }).subscribe(({ assigned, available }) => {
      const project = (assigned as any)?.project ?? [];

      this.branches = project.map((row: any) => ({
        ...row,
        userId:        this.userId,
        idBranch:      row.idPermission ?? row.idBranch ?? row.id,
        countContratos: 0
      }));

      this.availableBranches   = Array.isArray(available) ? available : [];
      this.selectedNewBranchId = '';
      this.selectedRow         = null;

      if (this.gridApi) this.gridApi.setGridOption('rowData', this.branches);

      if (this.branches.length === 0) return;

      const contractRequests: Record<string, Observable<any>> = {};
      this.branches.forEach(row => {
        contractRequests[row.idBranch] = this.contractsService
          .getContractsByBranch(this.userId, row.idBranch)
          .pipe(catchError(() => of([])));
      });

      forkJoin(contractRequests).subscribe({
        next: contractData => {
          this.branches = this.branches.map(row => ({
            ...row,
            countContratos: Array.isArray(contractData[row.idBranch])
              ? contractData[row.idBranch].length
              : 0
          }));
          if (this.gridApi) this.gridApi.setGridOption('rowData', this.branches);
        }
      });
    });
  }

  toggleContratos(node: any): void {
    const isExpanded = node.expanded;
    this.gridApi.forEachNode((n: any) => { if (n.expanded) n.setExpanded(false); });

    if (!isExpanded) {
      this.gridApi.setFilterModel(null);
      this.gridApi.setFilterModel({ id: { filterType: 'number', type: 'equals', filter: node.data.id } });
      this.gridApi.onFilterChanged();
      setTimeout(() => node.setExpanded(true), 50);
    } else {
      this.gridApi.setFilterModel(null);
      this.gridApi.onFilterChanged();
    }
  }

  addSucursal(): void {
    if (!this.selectedNewBranchId || this.isSaving) return;
    this.isSaving = true;
    const payload = {
      idUser:       this.userId,
      idPermission: +this.selectedNewBranchId,
      type:         'branch',
      description:  null,
      active:       1
    };
    this.usersxpermissionsService.addUserxPermission(payload).subscribe({
      next:  () => { this.isSaving = false; this.loadData(); },
      error: () => { this.isSaving = false; alerts.basicAlert('Error', 'No se pudo agregar la sucursal', 'error'); }
    });
  }

  deleteSucursal(): void {
    if (!this.selectedRow || this.isSaving) return;
    alerts.confirmAlert(
      'Quitar sucursal',
      `¿Quitar <b>${this.selectedRow.name}</b> de este usuario?`,
      'warning',
      'Sí, quitar'
    ).then(result => {
      if (!result.isConfirmed) return;
      this.isSaving = true;
      this.usersxpermissionsService.deleteUserxPermission(this.selectedRow.id).subscribe({
        next:  () => { this.isSaving = false; this.selectedRow = null; this.loadData(); },
        error: () => { this.isSaving = false; alerts.basicAlert('Error', 'No se pudo quitar la sucursal', 'error'); }
      });
    });
  }

  onGridReady(event: GridReadyEvent): void { this.gridApi = event.api; }

  onSelectionChanged(event: any): void {
    const nodes = event.api.getSelectedNodes();
    this.selectedRow = nodes.length > 0 ? nodes[0].data : null;
  }

  refresh(): boolean { return false; }
}

// ─── Main component ────────────────────────────────────────────────────────────
@Component({
  selector: 'app-detalle-empresas-usuario',
  standalone: true,
  imports: [AgGridModule, CommonModule, FormsModule, SucursalesDetailRendererComponent, ButtonCellRendererExpenditureComponent],
  template: `
    <div style="padding:10px;background:#f0f4ff;height:100%;display:flex;flex-direction:column;">

      <!-- Toolbar -->
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap;">
        <strong style="margin-right:auto;font-size:0.9rem;">
          <i class="bi bi-building me-1"></i> Empresas de: {{ userName }}
        </strong>
        <select
          class="form-select form-select-sm"
          style="width:280px;"
          [(ngModel)]="selectedNewCompanyId"
          [disabled]="availableCompanies.length === 0">
          <option value="">-- Seleccionar empresa --</option>
          <option *ngFor="let c of availableCompanies" [value]="c.id">{{ c.name }}</option>
        </select>
        <button
          class="btn btn-sm btn-primary"
          (click)="addEmpresa()"
          [disabled]="!selectedNewCompanyId || isSaving"
          title="Agregar empresa">
          <i class="bi bi-plus-lg"></i>
        </button>
        <button
          class="btn btn-sm btn-danger"
          (click)="deleteEmpresa()"
          [disabled]="!selectedRow || isSaving"
          title="Quitar empresa seleccionada">
          <i class="bi bi-trash"></i>
        </button>
      </div>

      <!-- Grid -->
      <div style="flex:1;min-height:0;">
        <ag-grid-angular
          class="ag-theme-quartz small-text-ag-grid"
          style="width:100%;height:100%;"
          [columnDefs]="columnDefs"
          [rowData]="rowData"
          [gridOptions]="gridOptions"
          [components]="components"
          rowSelection="single"
          (gridReady)="onGridReady($event)"
          (selectionChanged)="onSelectionChanged($event)">
        </ag-grid-angular>
      </div>

    </div>
  `
})
export class DetalleEmpresasUsuarioComponent implements OnInit {
  @Input() userId!: number;
  @Input() userName: string = '';
  @Output() countChanged = new EventEmitter<number>();

  private usersxpermissionsService = inject(UsersxpermissionsService);
  private rootService             = inject(RootService);
  private branchsService          = inject(BranchsService);

  rowData: any[] = [];
  private allCompanies: any[] = [];
  availableCompanies: any[] = [];
  selectedNewCompanyId: string = '';
  selectedRow: any = null;
  isSaving = false;
  private gridApi!: GridApi;

  components = {
    sucursalesDetail: SucursalesDetailRendererComponent,
    buttonRenderer:   ButtonCellRendererExpenditureComponent
  };

  columnDefs: ColDef[] = [
    { field: 'id',          hide: true, filter: 'agNumberColumnFilter' },
    { field: 'idPermission', hide: true },
    { field: 'userId',      hide: true },
    { field: 'nombre',          headerName: 'Empresa',    minWidth: 150, flex: 1, sortable: true, filter: true },
    {
      field: 'countSucursales',
      headerName: 'Sucursales',
      width: 120,
      editable: false,
      cellRenderer: ButtonCellRendererExpenditureComponent,
      cellRendererParams: {
        icon: 'bi bi-geo-alt',
        onClick: (node: any) => this.toggleSucursales(node)
      },
      valueGetter: (params) => params.data?.countSucursales ?? 0,
      cellStyle: { backgroundColor: '#e8f5e9', cursor: 'pointer' }
    }
  ];

  gridOptions: any = {
    headerHeight: 30,
    rowHeight: 28,
    animateRows: true,
    suppressCellFocus: true,
    masterDetail: true,
    isRowMaster: () => true,
    detailCellRenderer: 'sucursalesDetail',
    detailRowHeight: 420
  };

  ngOnInit(): void {
    this.loadData();
  }

  toggleSucursales(node: any): void {
    const isExpanded = node.expanded;
    this.gridApi.forEachNode((n: any) => { if (n.expanded) n.setExpanded(false); });

    if (!isExpanded) {
      this.gridApi.setFilterModel(null);
      this.gridApi.setFilterModel({ id: { filterType: 'number', type: 'equals', filter: node.data.id } });
      this.gridApi.onFilterChanged();
      setTimeout(() => node.setExpanded(true), 50);
    } else {
      this.gridApi.setFilterModel(null);
      this.gridApi.onFilterChanged();
    }
  }

  private loadData(): void {
    forkJoin({
      permissions: this.usersxpermissionsService.getUsersxPermissionsGeneral('root', this.userId),
      companies:   this.rootService.getRoot2fields()
    }).subscribe({
      next: ({ permissions, companies }) => {
        this.allCompanies = companies as any[];
        const perms = permissions as any[];
        this.rowData = perms.map(p => {
          const company = this.allCompanies.find(c => c.id === p.idPermission);
          return {
            id:              p.id,
            idPermission:    p.idPermission,
            userId:          this.userId,
            nombre:          company?.name ?? `Empresa ${p.idPermission}`,
            countSucursales: 0
          };
        });
        this.refreshAvailable();
        this.countChanged.emit(this.rowData.length);

        if (this.rowData.length === 0) return;

        const branchRequests: Record<string, Observable<any>> = {};
        this.rowData.forEach(row => {
          branchRequests[row.idPermission] = this.branchsService
            .getBranchesByUserAndCompany(this.userId, row.idPermission)
            .pipe(catchError(() => of({ project: [] })));
        });

        forkJoin(branchRequests).subscribe({
          next: branchData => {
            this.rowData = this.rowData.map(row => ({
              ...row,
              countSucursales: branchData[row.idPermission]?.project?.length ?? 0
            }));
            if (this.gridApi) this.gridApi.setGridOption('rowData', this.rowData);
          }
        });
      },
      error: () => alerts.basicAlert('Error', 'No se pudieron cargar las empresas', 'error')
    });
  }

  private refreshAvailable(): void {
    const assignedIds = this.rowData.map(r => r.idPermission);
    this.availableCompanies = this.allCompanies.filter(c => !assignedIds.includes(c.id));
    this.selectedNewCompanyId = '';
  }

  onGridReady(event: GridReadyEvent): void {
    this.gridApi = event.api;
  }

  onSelectionChanged(event: any): void {
    const nodes = event.api.getSelectedNodes();
    this.selectedRow = nodes.length > 0 ? nodes[0].data : null;
  }

  addEmpresa(): void {
    if (!this.selectedNewCompanyId || this.isSaving) return;
    this.isSaving = true;
    const companyId = +this.selectedNewCompanyId;
    const payload = {
      idUser:       this.userId,
      idPermission: companyId,
      type:         'root',
      description:  null,
      active:       1
    };
    this.usersxpermissionsService.addUserxPermission(payload).subscribe({
      next: () => { this.isSaving = false; this.loadData(); },
      error: () => { this.isSaving = false; alerts.basicAlert('Error', 'No se pudo agregar la empresa', 'error'); }
    });
  }

  deleteEmpresa(): void {
    if (!this.selectedRow || this.isSaving) return;
    alerts.confirmAlert(
      'Quitar empresa',
      `¿Quitar <b>${this.selectedRow.nombre}</b> de este usuario?`,
      'warning',
      'Sí, quitar'
    ).then(result => {
      if (!result.isConfirmed) return;
      this.isSaving = true;
      this.usersxpermissionsService.deleteUserxPermission(this.selectedRow.id).subscribe({
        next: () => { this.isSaving = false; this.selectedRow = null; this.loadData(); },
        error: () => { this.isSaving = false; alerts.basicAlert('Error', 'No se pudo quitar la empresa', 'error'); }
      });
    });
  }
}
