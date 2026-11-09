import { ChangeDetectorRef, Component, DestroyRef, Input, Output, EventEmitter, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-community';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { forkJoin, Observable, of } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { throwError } from 'rxjs';
import { UsersxpermissionsService } from 'app/services/usersxpermissions.service';
import { RootService } from 'app/services/root.service';
import { BranchsService } from 'app/services/branchs.service';
import { ContractsService } from 'app/services/contracts.service';
import { ProjectsService } from 'app/services/projects.service';
import { SignalsService } from 'app/services/signals.service';
import { WarehousesService } from 'app/services/warehouses.service';
import { alerts } from 'app/helpers/alerts';
import { ButtonCellRendererExpenditureComponent } from 'app/domains/ModAdmon/components/egresos-palacio/button-cell-renderer-expenditure.component';
import { CompanyMasterPermissionsRendererComponent } from './company-master-permissions-renderer.component';
import { MasterPermissions2Service } from 'app/services/master-permissions-2.service';
import { UserEntityQuickCreateService } from 'app/services/user-entity-quick-create.service';

function restoreUsersDescriptionWidth(api: GridApi, grid: string, column: string): void {
  try {
    const width = Number(localStorage.getItem(`smp:users:${grid}:${column}:width`));
    if (Number.isFinite(width) && width >= 200) {
      api.applyColumnState({ state: [{ colId: column, width }], applyOrder: false });
    }
  } catch { /* almacenamiento del navegador no disponible */ }
}

function saveUsersDescriptionWidth(event: any, grid: string, column: string): void {
  if (!event.finished || event.column?.getColId() !== column) return;
  try {
    localStorage.setItem(`smp:users:${grid}:${column}:width`, String(event.column.getActualWidth()));
  } catch { /* almacenamiento del navegador no disponible */ }
}

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
          [disabled]="loading || !!loadError || isSaving || availableProjects.length === 0">
          <option value="">-- Seleccionar proyecto --</option>
          <option *ngFor="let p of availableProjects" [value]="p.id">
            {{ p.name ?? p.projectName }}
          </option>
        </select>
        <button
          class="btn btn-sm btn-primary"
          (click)="addProyecto()"
          [disabled]="!selectedNewProjectId || isSaving || loading || !!loadError"
          title="Agregar proyecto">
          <i class="bi bi-plus-lg"></i>
        </button>
        <button
          class="btn btn-sm btn-danger"
          (click)="deleteProyecto()"
          [disabled]="!selectedRow || isSaving || loading || !!loadError"
          title="Quitar proyecto seleccionado">
          <i class="bi bi-trash"></i>
        </button>
      </div>

      <div *ngIf="loading" class="text-muted small mb-2" role="status">Cargando listado…</div>
      <div *ngIf="loadError" class="alert alert-warning py-2" role="alert">
        {{ loadError }}
        <button class="btn btn-sm btn-outline-secondary ms-2" (click)="retryLoad()" [disabled]="loading">Reintentar</button>
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
          (columnResized)="onDescriptionResized($event)"
          (selectionChanged)="onSelectionChanged($event)">
        </ag-grid-angular>
      </div>

    </div>
  `
})
export class ProyectosDetailRendererComponent implements ICellRendererAngularComp {
  private changeDetector = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);
  private projectsService          = inject(ProjectsService);
  private usersxpermissionsService = inject(UsersxpermissionsService);
  private signalsService           = inject(SignalsService);

  projects: any[] = [];
  availableProjects: any[] = [];
  selectedNewProjectId: string = '';
  selectedRow: any = null;
  isSaving = false;
  loading = false;
  loadError = '';

  retryLoad(): void { if (!this.loading && !this.isSaving) this.loadData(); }

  private render(): void {
    if (!this.destroyRef.destroyed) this.changeDetector.detectChanges();
  }
  contractName: string = '';
  private userId: number = 0;
  private contractId: number = 0;
  private gridApi!: GridApi;

  cols: ColDef[] = [
    { field: 'id',                 hide: true },
    { field: 'idProject',          hide: true },
    { field: 'projectName',        headerName: 'Proyecto',     flex: 2 },
    { field: 'projectDescription', headerName: 'Descripción', minWidth: 300, width: 360, flex: 0, resizable: true, suppressSizeToFit: true }
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
    this.loadError = '';
    if (![this.userId, this.contractId].every(id => Number.isSafeInteger(Number(id)) && Number(id) > 0)) {
      this.loadError = 'Guarda primero el usuario y selecciona un registro válido para asignar permisos.';
      this.render();
      return;
    }
    this.loading = true;
    forkJoin({
      permissions: this.usersxpermissionsService.getUsersxPermissionsGeneral('project', this.userId),
      catalog: this.projectsService.getProjectListByContract(this.contractId).pipe(catchError(error => error.status === 404 ? of([]) : throwError(() => error)))
    }).pipe(timeout(20000), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ permissions, catalog: catalogResponse }) => {
        const permissionRows = Array.isArray(permissions) ? permissions : [];
        const catalogRows = Array.isArray(catalogResponse) ? catalogResponse : [];
        const catalog = catalogRows.map(p => ({ ...p, id: Number(p.id) }));
        const assigned = new Map(permissionRows.map(p => [Number(p.idPermission), p]));
        this.projects = catalog.filter(p => assigned.has(p.id)).map(p => ({
          ...p, id: assigned.get(p.id).id, idProject: p.id,
          projectName: p.name ?? p.projectName, projectDescription: p.description ?? ''
        }));
        this.availableProjects = catalog.filter(p => !assigned.has(p.id));
        this.selectedNewProjectId = '';
        this.selectedRow = null;
        if (this.gridApi) this.gridApi.setGridOption('rowData', this.projects);
        this.loading = false;
        this.render();

      },
      error: () => {
        this.loading = false;
        this.loadError = 'No se pudo cargar el listado. Pulsa Reintentar para volver a consultar.';
        this.render();
      }
    });
  }

  addProyecto(): void {
    if (this.loading || this.loadError || this.isSaving || !this.availableProjects.some(item => Number(item.id) === Number(this.selectedNewProjectId))) return;
    this.isSaving = true;
    const payload = {
      idUser:       this.userId,
      idPermission: +this.selectedNewProjectId,
      type:         'project',
      description:  null,
      active:       1
    };
    this.usersxpermissionsService.addUserxPermission(payload).subscribe({
      next:  () => { this.isSaving = false; this.loadData(); this.signalsService.notifyUserProjectAssignmentsChanged(); },
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
        next:  () => { this.isSaving = false; this.selectedRow = null; this.loadData(); this.signalsService.notifyUserProjectAssignmentsChanged(); },
        error: () => { this.isSaving = false; alerts.basicAlert('Error', 'No se pudo quitar el proyecto', 'error'); }
      });
    });
  }

  onGridReady(event: GridReadyEvent): void { this.gridApi = event.api; restoreUsersDescriptionWidth(event.api, 'projects', 'projectDescription'); }
  onDescriptionResized(event: any): void { saveUsersDescriptionWidth(event, 'projects', 'projectDescription'); }

  onSelectionChanged(event: any): void {
    const nodes = event.api.getSelectedNodes();
    this.selectedRow = nodes.length > 0 ? nodes[0].data : null;
  }

  refresh(): boolean { return false; }
}

// ─── Detail renderer: almacenes por contrato (sucursal) ────────────────────────
@Component({
  selector: 'app-almacenes-detail-renderer',
  standalone: true,
  imports: [AgGridModule, CommonModule, FormsModule],
  template: `
    <div style="padding:8px;background:#f3e8ff;height:100%;display:flex;flex-direction:column;">

      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap;">
        <strong style="font-size:0.85rem;margin-right:auto;">
          <i class="bi bi-box-seam me-1"></i> Almacenes — {{ contractName }}
        </strong>
        <select
          class="form-select form-select-sm"
          style="width:260px;"
          [(ngModel)]="selectedNewWarehouseId"
          [disabled]="loading || !!loadError || isSaving || availableWarehouses.length === 0">
          <option value="">-- Seleccionar almacén --</option>
          <option *ngFor="let w of availableWarehouses" [value]="w.id">{{ w.name }}</option>
        </select>
        <button
          class="btn btn-sm btn-primary"
          (click)="addAlmacen()"
          [disabled]="!selectedNewWarehouseId || isSaving || loading || !!loadError"
          title="Agregar almacén">
          <i class="bi bi-plus-lg"></i>
        </button>
        <button type="button" class="btn btn-sm btn-success" (click)="createWarehouse()" [disabled]="isSaving || loading || !!loadError">
          <i class="bi bi-plus-circle me-1"></i>Nuevo almacén
        </button>
        <button
          class="btn btn-sm btn-danger"
          (click)="deleteAlmacen()"
          [disabled]="!selectedRow || isSaving || loading || !!loadError"
          title="Quitar almacén seleccionado">
          <i class="bi bi-trash"></i>
        </button>
      </div>

      <div *ngIf="loading" class="text-muted small mb-2" role="status">Cargando listado…</div>
      <div *ngIf="loadError" class="alert alert-warning py-2" role="alert">
        {{ loadError }}
        <button class="btn btn-sm btn-outline-secondary ms-2" (click)="retryLoad()" [disabled]="loading">Reintentar</button>
      </div>
      <div style="flex:1;min-height:0;">
        <ag-grid-angular
          class="ag-theme-quartz small-text-ag-grid"
          style="width:100%;height:100%;"
          [columnDefs]="cols"
          [rowData]="warehouses"
          [gridOptions]="gridOptions"
          rowSelection="single"
          (gridReady)="onGridReady($event)"
          (columnResized)="onDescriptionResized($event)"
          (selectionChanged)="onSelectionChanged($event)">
        </ag-grid-angular>
      </div>

    </div>
  `
})
export class AlmacenesDetailRendererComponent implements ICellRendererAngularComp {
  private quickCreate = inject(UserEntityQuickCreateService);
  private changeDetector = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);
  private warehousesService          = inject(WarehousesService);
  private usersxpermissionsService   = inject(UsersxpermissionsService);

  warehouses: any[] = [];
  availableWarehouses: any[] = [];
  selectedNewWarehouseId: string = '';
  selectedRow: any = null;
  isSaving = false;
  loading = false;
  loadError = '';

  retryLoad(): void { if (!this.loading && !this.isSaving) this.loadData(); }

  private render(): void {
    if (!this.destroyRef.destroyed) this.changeDetector.detectChanges();
  }
  contractName: string = '';
  private userId: number = 0;
  private branchId: number = 0;
  private gridApi!: GridApi;

  cols: ColDef[] = [
    { field: 'id', hide: true },
    { field: 'idPermission', hide: true },
    { field: 'name', headerName: 'Almacén', flex: 2 },
    { field: 'description', headerName: 'Descripción', minWidth: 300, width: 360, flex: 0, resizable: true, suppressSizeToFit: true }
  ];

  gridOptions: any = { headerHeight: 25, rowHeight: 22, suppressCellFocus: true };

  agInit(params: any): void {
    this.contractName = params.data?.name ?? '';
    this.userId       = params.data?.userId;
    this.branchId     = params.data?.branchId ?? params.data?.idBranch;
    if (this.userId && this.branchId) {
      this.loadData();
    }
  }

  private loadData(): void {
    this.loadError = '';
    if (![this.userId, this.branchId].every(id => Number.isSafeInteger(Number(id)) && Number(id) > 0)) {
      this.loadError = 'Guarda primero el usuario y selecciona un registro válido para asignar permisos.';
      this.render();
      return;
    }
    this.loading = true;
    forkJoin({
      permissions: this.usersxpermissionsService.getUsersxPermissionsGeneral('warehouse', this.userId),
      catalog: this.warehousesService.getSimpleWarehouses(this.branchId).pipe(catchError(error => error.status === 404 ? of([]) : throwError(() => error)))
    }).pipe(timeout(20000), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ permissions, catalog: catalogResponse }) => {
        const permissionRows = Array.isArray(permissions) ? permissions : [];
        const catalogRows = Array.isArray(catalogResponse) ? catalogResponse : [];
        const catalog = catalogRows.map(w => ({ ...w, id: Number(w.id) }));
        const assigned = new Map(permissionRows.map(p => [Number(p.idPermission), p]));
        this.warehouses = catalog.filter(w => assigned.has(w.id)).map(w => ({
          ...w, id: assigned.get(w.id).id, idPermission: w.id
        }));
        this.availableWarehouses = catalog.filter(w => !assigned.has(w.id));
        this.selectedNewWarehouseId = '';
        this.selectedRow = null;
        if (this.gridApi) this.gridApi.setGridOption('rowData', this.warehouses);
        this.loading = false;
        this.render();

      },
      error: () => {
        this.loading = false;
        this.loadError = 'No se pudo cargar el listado. Pulsa Reintentar para volver a consultar.';
        this.render();
      }
    });
  }

  async createWarehouse(): Promise<void> {
    if (this.isSaving || !this.userId || !this.branchId) return;
    this.isSaving = true;
    try {
      await this.quickCreate.open({ kind: 'warehouse', parentId: this.branchId, parentName: this.contractName, userId: this.userId });
    } catch {
      alerts.basicAlert('Error', 'No se pudo abrir el formulario de alta.', 'error');
    } finally {
      if (!this.destroyRef.destroyed) {
        this.isSaving = false;
        this.loadData();
        this.changeDetector.detectChanges();
      }
    }
  }

  addAlmacen(): void {
    if (this.loading || this.loadError || this.isSaving || !this.availableWarehouses.some(item => Number(item.id) === Number(this.selectedNewWarehouseId))) return;
    this.isSaving = true;
    const payload = {
      idUser:       this.userId,
      idPermission: +this.selectedNewWarehouseId,
      type:         'warehouse',
      description:  null,
      active:       1
    };
    this.usersxpermissionsService.addUserxPermission(payload).subscribe({
      next:  () => { this.isSaving = false; this.loadData(); },
      error: () => { this.isSaving = false; alerts.basicAlert('Error', 'No se pudo agregar el almacén', 'error'); }
    });
  }

  deleteAlmacen(): void {
    if (!this.selectedRow || this.isSaving) return;
    alerts.confirmAlert(
      'Quitar almacén',
      `¿Quitar <b>${this.selectedRow.name}</b> de este usuario?`,
      'warning',
      'Sí, quitar'
    ).then(result => {
      if (!result.isConfirmed) return;
      this.isSaving = true;
      this.usersxpermissionsService.deleteUserxPermission(this.selectedRow.id).subscribe({
        next:  () => { this.isSaving = false; this.selectedRow = null; this.loadData(); },
        error: () => { this.isSaving = false; alerts.basicAlert('Error', 'No se pudo quitar el almacén', 'error'); }
      });
    });
  }

  onGridReady(event: GridReadyEvent): void { this.gridApi = event.api; restoreUsersDescriptionWidth(event.api, 'warehouses', 'description'); }
  onDescriptionResized(event: any): void { saveUsersDescriptionWidth(event, 'warehouses', 'description'); }

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
          [disabled]="loading || !!loadError || isSaving || availableContracts.length === 0">
          <option value="">-- Seleccionar contrato --</option>
          <option *ngFor="let c of availableContracts" [value]="c.idContrato">
            {{ c.numberContract }} - {{ c.descripSmall }}
          </option>
        </select>
        <button
          class="btn btn-sm btn-primary"
          (click)="addContrato()"
          [disabled]="!selectedNewContractId || isSaving || loading || !!loadError"
          title="Agregar contrato">
          <i class="bi bi-plus-lg"></i>
        </button>
        <button
          class="btn btn-sm btn-danger"
          (click)="deleteContrato()"
          [disabled]="!selectedRow || isSaving || loading || !!loadError"
          title="Quitar contrato seleccionado">
          <i class="bi bi-trash"></i>
        </button>
      </div>

      <div *ngIf="loading" class="text-muted small mb-2" role="status">Cargando listado…</div>
      <div *ngIf="loadError" class="alert alert-warning py-2" role="alert">
        {{ loadError }}
        <button class="btn btn-sm btn-outline-secondary ms-2" (click)="retryLoad()" [disabled]="loading">Reintentar</button>
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
          (columnResized)="onDescriptionResized($event)"
          (selectionChanged)="onSelectionChanged($event)">
        </ag-grid-angular>
      </div>

    </div>
  `
})
export class ContratosDetailRendererComponent implements ICellRendererAngularComp {
  private changeDetector = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);
  private contractsService         = inject(ContractsService);
  private usersxpermissionsService = inject(UsersxpermissionsService);
  private signalsService           = inject(SignalsService);
  private projectsService          = inject(ProjectsService);

  contracts: any[] = [];
  availableContracts: any[] = [];
  selectedNewContractId: string = '';
  selectedRow: any = null;
  isSaving = false;
  loading = false;
  loadError = '';

  retryLoad(): void { if (!this.loading && !this.isSaving) this.loadData(); }

  private render(): void {
    if (!this.destroyRef.destroyed) this.changeDetector.detectChanges();
  }
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
    { field: 'descripSmall', headerName: 'Descripción', minWidth: 300, width: 360, flex: 0, resizable: true, suppressSizeToFit: true },
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
    this.loadError = '';
    if (![this.userId, this.branchId].every(id => Number.isSafeInteger(Number(id)) && Number(id) > 0)) {
      this.loadError = 'Guarda primero el usuario y selecciona un registro válido para asignar permisos.';
      this.render();
      return;
    }
    this.loading = true;
    forkJoin({
      permissions: this.usersxpermissionsService.getUsersxPermissionsGeneral('contract', this.userId),
      catalog: this.contractsService.getContracts(this.branchId).pipe(catchError(error => error.status === 404 ? of([]) : throwError(() => error)))
    }).pipe(timeout(20000), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ permissions, catalog: catalogResponse }) => {
        const permissionRows = Array.isArray(permissions) ? permissions : [];
        const catalogRows = Array.isArray(catalogResponse) ? catalogResponse : [];
        const catalog = catalogRows.map(c => ({ ...c, idContrato: Number(c.idContrato) }));
        const assigned = new Map(permissionRows.map(p => [Number(p.idPermission), p]));
        this.contracts = catalog.filter(c => assigned.has(c.idContrato)).map(c => ({
          permissionId: assigned.get(c.idContrato).id, contractId: c.idContrato,
          name: c.numberContract ?? c.name ?? c.descripSmall ?? `Contrato ${c.idContrato}`,
          descripSmall: c.descripSmall, userId: this.userId, branchId: this.branchId, countProyectos: 0
        }));
        this.availableContracts = catalog.filter(c => !assigned.has(c.idContrato));
        this.selectedNewContractId = '';
        this.selectedRow = null;
        if (this.gridApi) this.gridApi.setGridOption('rowData', this.contracts);
        this.loading = false;
        this.render();
        if (this.contracts.length === 0) return;

        const projectRequests: Record<string, Observable<any>> = {};
        this.contracts.forEach(row => {
          projectRequests[row.contractId] = this.projectsService
            .getProjectsByContract(this.userId, row.contractId)
            .pipe(catchError(() => of([])));
        });

        forkJoin(projectRequests).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
          next: projectData => {
            this.contracts = this.contracts.map(row => ({
              ...row,
              countProyectos: Array.isArray(projectData[row.contractId]) ? projectData[row.contractId].length : 0
            }));
            if (this.gridApi) this.gridApi.setGridOption('rowData', this.contracts);
            this.render();
          }
        });

      },
      error: () => {
        this.loading = false;
        this.loadError = 'No se pudo cargar el listado. Pulsa Reintentar para volver a consultar.';
        this.render();
      }
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
    if (this.loading || this.loadError || this.isSaving || !this.availableContracts.some(item => Number(item.idContrato) === Number(this.selectedNewContractId))) return;
    this.isSaving = true;
    const payload = {
      idUser:       this.userId,
      idPermission: +this.selectedNewContractId,
      type:         'contract',
      description:  null,
      active:       1
    };
    this.usersxpermissionsService.addUserxPermission(payload).subscribe({
      next:  () => { this.isSaving = false; this.loadData(); this.signalsService.notifyUserProjectAssignmentsChanged(); },
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
        next:  () => { this.isSaving = false; this.selectedRow = null; this.loadData(); this.signalsService.notifyUserProjectAssignmentsChanged(); },
        error: () => { this.isSaving = false; alerts.basicAlert('Error', 'No se pudo quitar el contrato', 'error'); }
      });
    });
  }

  onGridReady(event: GridReadyEvent): void { this.gridApi = event.api; restoreUsersDescriptionWidth(event.api, 'contracts', 'descripSmall'); }
  onDescriptionResized(event: any): void { saveUsersDescriptionWidth(event, 'contracts', 'descripSmall'); }

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
  imports: [AgGridModule, CommonModule, FormsModule, ContratosDetailRendererComponent, AlmacenesDetailRendererComponent, ButtonCellRendererExpenditureComponent],
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
          [disabled]="loading || !!loadError || isSaving || availableBranches.length === 0">
          <option value="">-- Seleccionar sucursal --</option>
          <option *ngFor="let b of availableBranches" [value]="b.id">{{ b.name }}</option>
        </select>
        <button
          class="btn btn-sm btn-primary"
          (click)="addSucursal()"
          [disabled]="!selectedNewBranchId || isSaving || loading || !!loadError"
          title="Agregar sucursal">
          <i class="bi bi-plus-lg"></i>
        </button>
        <button type="button" class="btn btn-sm btn-success" (click)="createBranch()" [disabled]="isSaving || loading || !!loadError">
          <i class="bi bi-plus-circle me-1"></i>Nueva sucursal
        </button>
        <button
          class="btn btn-sm btn-danger"
          (click)="deleteSucursal()"
          [disabled]="!selectedRow || isSaving || loading || !!loadError"
          title="Quitar sucursal seleccionada">
          <i class="bi bi-trash"></i>
        </button>
      </div>

      <div *ngIf="loading" class="text-muted small mb-2" role="status">Cargando listado…</div>
      <div *ngIf="loadError" class="alert alert-warning py-2" role="alert">
        {{ loadError }}
        <button class="btn btn-sm btn-outline-secondary ms-2" (click)="retryLoad()" [disabled]="loading">Reintentar</button>
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
  private quickCreate = inject(UserEntityQuickCreateService);
  private changeDetector = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);
  private branchsService           = inject(BranchsService);
  private usersxpermissionsService = inject(UsersxpermissionsService);
  private contractsService         = inject(ContractsService);
  private warehousesService        = inject(WarehousesService);

  branches: any[] = [];
  companyName: string = '';
  availableBranches: any[] = [];
  selectedNewBranchId: string = '';
  selectedRow: any = null;
  isSaving = false;
  loading = false;
  loadError = '';

  retryLoad(): void { if (!this.loading && !this.isSaving) this.loadData(); }

  private render(): void {
    if (!this.destroyRef.destroyed) this.changeDetector.detectChanges();
  }
  private userId: number = 0;
  private idCompany: number = 0;
  private gridApi!: GridApi;

  components = {
    contratosDetail:  ContratosDetailRendererComponent,
    almacenesDetail:  AlmacenesDetailRendererComponent,
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
    },
    {
      field: 'countAlmacenes',
      headerName: 'Almacenes',
      width: 120,
      editable: false,
      cellRenderer: ButtonCellRendererExpenditureComponent,
      cellRendererParams: {
        icon: 'bi bi-box-seam',
        onClick: (node: any) => this.toggleAlmacenes(node)
      },
      valueGetter: (params) => params.data?.countAlmacenes ?? 0,
      cellStyle: { backgroundColor: '#f3e8ff', cursor: 'pointer' }
    }
  ];

  gridOptions: any = {
    headerHeight: 25,
    rowHeight: 22,
    suppressCellFocus: true,
    masterDetail: true,
    isRowMaster: () => true,
    detailCellRendererSelector: (params: any) =>
      params.data?.expandedPanel === 'almacenes'
        ? { component: 'almacenesDetail' }
        : { component: 'contratosDetail' },
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
    this.loadError = '';
    if (![this.userId, this.idCompany].every(id => Number.isSafeInteger(Number(id)) && Number(id) > 0)) {
      this.loadError = 'Guarda primero el usuario y selecciona un registro válido para asignar permisos.';
      this.render();
      return;
    }
    this.loading = true;
    forkJoin({
      permissions: this.usersxpermissionsService.getUsersxPermissionsGeneral('branch', this.userId),
      catalog: this.branchsService.getBranches(this.idCompany).pipe(catchError(error => error.status === 404 ? of([]) : throwError(() => error)))
    }).pipe(timeout(20000), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ permissions, catalog: catalogResponse }) => {
        const permissionRows = Array.isArray(permissions) ? permissions : [];
        const catalogRows = Array.isArray(catalogResponse) ? catalogResponse : [];
        const catalog = catalogRows.map(b => ({ ...b, id: Number(b.id) }));
        const assigned = new Map(permissionRows.map(p => [Number(p.idPermission), p]));
        this.branches = catalog.filter(b => assigned.has(b.id)).map(b => ({
          ...b, id: assigned.get(b.id).id, idPermission: b.id, idBranch: b.id,
          userId: this.userId, countContratos: 0, countAlmacenes: 0
        }));
        this.availableBranches = catalog.filter(b => !assigned.has(b.id));
        this.selectedNewBranchId = '';
        this.selectedRow = null;
        if (this.gridApi) this.gridApi.setGridOption('rowData', this.branches);
        this.loading = false;
        this.render();
        if (this.branches.length === 0) return;

        const contractRequests: Record<string, Observable<any>> = {};
        this.branches.forEach(row => {
          contractRequests[row.idBranch] = this.contractsService
            .getContractsByBranch(this.userId, row.idBranch)
            .pipe(catchError(() => of([])));
        });

        const warehouseRequests: Record<string, Observable<any>> = {};
        this.branches.forEach(row => {
          warehouseRequests[row.idBranch] = forkJoin({
            permissions: this.usersxpermissionsService.getUsersxPermissionsGeneral('warehouse', this.userId).pipe(catchError(() => of([]))),
            branchWarehouses: this.warehousesService.getSimpleWarehouses(row.idBranch).pipe(catchError(() => of([])))
          });
        });

        forkJoin({
          contracts: forkJoin(contractRequests),
          warehouses: forkJoin(warehouseRequests)
        }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
          next: ({ contracts: contractData, warehouses: whData }) => {
            this.branches = this.branches.map(row => {
              const wh = whData[row.idBranch] || {};
              const branchWhIds = new Set((Array.isArray(wh.branchWarehouses) ? wh.branchWarehouses : []).map((w: any) => w.id));
              const userWhCount = (Array.isArray(wh.permissions) ? wh.permissions : []).filter(
                (p: any) => branchWhIds.has(p.idPermission)
              ).length;
              return {
                ...row,
                countContratos: Array.isArray(contractData[row.idBranch]) ? contractData[row.idBranch].length : 0,
                countAlmacenes: userWhCount
              };
            });
            if (this.gridApi) this.gridApi.setGridOption('rowData', this.branches);
            this.render();
          }
        });

      },
      error: () => {
        this.loading = false;
        this.loadError = 'No se pudo cargar el listado. Pulsa Reintentar para volver a consultar.';
        this.render();
      }
    });
  }

  toggleContratos(node: any): void {
    const isExpanded = node.expanded;
    (node.data as any).expandedPanel = 'contratos';
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

  toggleAlmacenes(node: any): void {
    const isExpanded = node.expanded;
    (node.data as any).expandedPanel = 'almacenes';
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

  async createBranch(): Promise<void> {
    if (this.isSaving || !this.userId || !this.idCompany) return;
    this.isSaving = true;
    try {
      await this.quickCreate.open({ kind: 'branch', parentId: this.idCompany, parentName: this.companyName, userId: this.userId });
    } catch {
      alerts.basicAlert('Error', 'No se pudo abrir el formulario de alta.', 'error');
    } finally {
      if (!this.destroyRef.destroyed) {
        this.isSaving = false;
        this.loadData();
        this.changeDetector.detectChanges();
      }
    }
  }

  addSucursal(): void {
    if (this.loading || this.loadError || this.isSaving || !this.availableBranches.some(item => Number(item.id) === Number(this.selectedNewBranchId))) return;
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
  imports: [AgGridModule, CommonModule, FormsModule, SucursalesDetailRendererComponent, CompanyMasterPermissionsRendererComponent, ButtonCellRendererExpenditureComponent],
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
  private masterPermissionsService = inject(MasterPermissions2Service);

  rowData: any[] = [];
  private allCompanies: any[] = [];
  availableCompanies: any[] = [];
  selectedNewCompanyId: string = '';
  selectedRow: any = null;
  isSaving = false;
  private gridApi!: GridApi;

  components = {
    sucursalesDetail: SucursalesDetailRendererComponent,
    companyMasterPermissions: CompanyMasterPermissionsRendererComponent,
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
    },
    {
      field: 'countMasterPermissions',
      headerName: 'Permisos maestros',
      width: 155,
      editable: false,
      cellRenderer: ButtonCellRendererExpenditureComponent,
      cellRendererParams: {
        icon: 'bi bi-shield-check',
        onClick: (node: any) => this.toggleMasterPermissions(node)
      },
      valueGetter: (params) => params.data?.countMasterPermissions ?? 0,
      cellStyle: { backgroundColor: '#e8f0fe', cursor: 'pointer' }
    }
  ];

  gridOptions: any = {
    headerHeight: 30,
    rowHeight: 28,
    animateRows: true,
    suppressCellFocus: true,
    masterDetail: true,
    isRowMaster: () => true,
    detailCellRendererSelector: (params: any) => params.data?.expandedPanel === 'master-permissions'
      ? { component: 'companyMasterPermissions' }
      : { component: 'sucursalesDetail' },
    detailRowHeight: 600
  };

  ngOnInit(): void {
    this.loadData();
  }

  toggleSucursales(node: any): void {
    const isExpanded = node.expanded && node.data?.expandedPanel === 'sucursales';
    node.data.expandedPanel = 'sucursales';
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

  toggleMasterPermissions(node: any): void {
    const isExpanded = node.expanded && node.data?.expandedPanel === 'master-permissions';
    this.gridApi.forEachNode((n: any) => { if (n.expanded) n.setExpanded(false); });
    if (!isExpanded) {
      node.data.expandedPanel = 'master-permissions';
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
            countSucursales: 0,
            countMasterPermissions: 0
          };
        });
        this.refreshAvailable();
        this.countChanged.emit(this.rowData.length);

        if (this.rowData.length === 0) return;

        const branchRequests: Record<string, Observable<any>> = {};
        const masterPermissionRequests: Record<string, Observable<any>> = {};
        this.rowData.forEach(row => {
          branchRequests[row.idPermission] = this.branchsService
            .getBranchesByUserAndCompany(this.userId, row.idPermission)
            .pipe(catchError(() => of({ project: [] })));
          masterPermissionRequests[row.idPermission] = this.masterPermissionsService
            .getCompanyUserPermissions(row.idPermission, this.userId)
            .pipe(catchError(() => of([])));
        });

        forkJoin({ branches: forkJoin(branchRequests), masterPermissions: forkJoin(masterPermissionRequests) }).subscribe({
          next: ({ branches: branchData, masterPermissions }) => {
            this.rowData = this.rowData.map(row => ({
              ...row,
              countSucursales: branchData[row.idPermission]?.project?.length ?? 0,
              countMasterPermissions: Array.isArray(masterPermissions[row.idPermission]) ? masterPermissions[row.idPermission].length : 0
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
