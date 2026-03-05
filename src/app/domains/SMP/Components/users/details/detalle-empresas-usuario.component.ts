import { Component, Input, Output, EventEmitter, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-community';
import { forkJoin } from 'rxjs';
import { UsersxpermissionsService } from 'app/services/usersxpermissions.service';
import { RootService } from 'app/services/root.service';
import { alerts } from 'app/helpers/alerts';

@Component({
  selector: 'app-detalle-empresas-usuario',
  standalone: true,
  imports: [AgGridModule, CommonModule, FormsModule],
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

  rowData: any[] = [];
  private allCompanies: any[] = [];
  availableCompanies: any[] = [];
  selectedNewCompanyId: string = '';
  selectedRow: any = null;
  isSaving = false;
  private gridApi!: GridApi;

  columnDefs: ColDef[] = [
    { field: 'id',          hide: true },
    { field: 'idPermission', hide: true },
    { field: 'nombre', headerName: 'Empresa', flex: 1, sortable: true, filter: true },
  ];

  gridOptions: any = {
    headerHeight: 30,
    rowHeight: 28,
    animateRows: true,
    suppressCellFocus: true,
  };

  ngOnInit(): void {
    this.loadData();
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
            id:           p.id,
            idPermission: p.idPermission,
            nombre:       company?.name ?? `Empresa ${p.idPermission}`
          };
        });
        this.refreshAvailable();
        this.countChanged.emit(this.rowData.length);
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
