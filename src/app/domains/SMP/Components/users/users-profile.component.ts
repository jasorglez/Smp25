import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, Input } from '@angular/core';
import { catchError, forkJoin, of } from 'rxjs';
import { BranchsService } from 'app/services/branchs.service';
import { ContractsService } from 'app/services/contracts.service';
import { ProjectsService } from 'app/services/projects.service';
import { RootService } from 'app/services/root.service';
import { SignalsService } from 'app/services/signals.service';
import { UsersxpermissionsService } from 'app/services/usersxpermissions.service';
import { WarehousesService } from 'app/services/warehouses.service';

@Component({
  selector: 'app-users-profile',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './users-profile.component.html',
  styleUrl: './users-profile.component.scss'
})
export class UsersProfileComponent {

  @Input() sectionTitle: string = '';
  @Input() sectionIcon: string = 'bi-list-check';
  @Input() assignedItems: string[] = [];
  @Input() showAllAccess: boolean = false;

  private signalsService = inject(SignalsService);
  usersxpermissionsService = inject(UsersxpermissionsService);
  private branchsService = inject(BranchsService);
  private contractsService = inject(ContractsService);
  private projectsService = inject(ProjectsService);
  private rootService = inject(RootService);
  private warehousesService = inject(WarehousesService);
  
  profile = this.signalsService.profile;

  nameCompany = this.signalsService.nameCompany();
  nameContract = this.signalsService.nameContract();
  accessSections: Array<{ title: string; icon: string; items: string[] }> = [];

  constructor() {
    effect(() => {
      const idUser = Number(this.profile.idUser() || 0);
      if (idUser) {
        this.loadAccessSummary(idUser);
      } else {
        this.accessSections = [];
      }
    });
  }

  get visibleAssignedItems(): string[] {
    return [...new Set((this.assignedItems ?? []).filter(item => !!item))];
  }

  get visibleAccessSections(): Array<{ title: string; icon: string; items: string[] }> {
    return this.accessSections.map(section => ({
      ...section,
      items: section.title === this.sectionTitle && this.visibleAssignedItems.length
        ? this.visibleAssignedItems
        : section.items
    }));
  }

  private loadAccessSummary(idUser: number): void {
    const safePermissions = (type: string) => this.usersxpermissionsService
      .getUsersxPermissionsGeneral(type, idUser)
      .pipe(catchError(() => of([])));

    forkJoin({
      companies: safePermissions('root'),
      branches: safePermissions('branch'),
      contracts: safePermissions('contract'),
      projects: safePermissions('project'),
      warehouses: safePermissions('warehouse'),
      companyCatalog: this.rootService.getRoot().pipe(catchError(() => of([]))),
      branchCatalog: this.branchsService.getAllBranches().pipe(catchError(() => of([])))
    }).subscribe((data: any) => {
      if (Number(this.profile.idUser() || 0) !== idUser) return;

      const companyIds = this.permissionIds(data.companies);
      const branchIds = this.permissionIds(data.branches);
      const contractIds = this.permissionIds(data.contracts);
      const projectIds = this.permissionIds(data.projects);
      const warehouseIds = this.permissionIds(data.warehouses);
      const companies = this.asArray(data.companyCatalog);
      const branches = this.asArray(data.branchCatalog);

      const contractRequests = contractIds.map(id =>
        this.contractsService.getContractById(id).pipe(catchError(() => of(null)))
      );
      const projectRequests = projectIds.map(id =>
        this.projectsService.getProjectsById(id).pipe(catchError(() => of(null)))
      );
      const warehouseRequests = branchIds.map(id =>
        this.warehousesService.getSimpleWarehouses(id).pipe(catchError(() => of([])))
      );

      forkJoin({
        contractCatalog: contractRequests.length ? forkJoin(contractRequests) : of([]),
        projectCatalog: projectRequests.length ? forkJoin(projectRequests) : of([]),
        warehouseCatalog: warehouseRequests.length ? forkJoin(warehouseRequests) : of([])
      }).subscribe((catalogs: any) => {
        if (Number(this.profile.idUser() || 0) !== idUser) return;

        const contracts = this.asArray(catalogs.contractCatalog).flatMap(item => this.asArrayOrSingle(item));
        const projects = this.asArray(catalogs.projectCatalog).flatMap(item => this.asArrayOrSingle(item));
        const warehouses = this.asArray(catalogs.warehouseCatalog).flatMap(item => this.asArray(item));

        this.accessSections = [
          {
            title: 'Empresas',
            icon: 'bi-building',
            items: companyIds.map(id => this.findName(companies, id, ['name', 'nombre'], `Empresa ${id}`))
          },
          {
            title: 'Sucursales',
            icon: 'bi-geo-alt',
            items: branchIds.map(id => this.findName(branches, id, ['name', 'nombre'], `Sucursal ${id}`))
          },
          {
            title: 'Contratos',
            icon: 'bi-file-earmark-text',
            items: contractIds.map(id => {
              const contract = this.findById(contracts, id);
              return contract
                ? [contract.numberContract, contract.descripSmall].filter(Boolean).join(' - ')
                : `Contrato ${id}`;
            })
          },
          {
            title: 'Proyectos',
            icon: 'bi-diagram-3',
            items: projectIds.map(id => {
              const project = this.findById(projects, id);
              return project
                ? [project.idConsecutivo, project.name ?? project.nombre].filter(Boolean).join(' - ')
                : `Proyecto ${id}`;
            })
          },
          {
            title: 'Almacenes',
            icon: 'bi-box-seam',
            items: warehouseIds.map(id => this.findName(warehouses, id, ['name', 'nombre'], `Almacén ${id}`))
          }
        ];
      });
    });
  }

  private permissionIds(data: any): number[] {
    return [...new Set(this.asArray(data)
      .map((item: any) => Number(item.idPermission))
      .filter((id: number) => id > 0))];
  }

  private asArray(data: any): any[] {
    return Array.isArray(data) ? data : [];
  }

  private asArrayOrSingle(data: any): any[] {
    if (!data) return [];
    return Array.isArray(data) ? data : [data];
  }

  private findById(catalog: any[], id: number): any {
    return catalog.find(item => Number(item?.id ?? item?.idContrato) === Number(id));
  }

  private findName(catalog: any[], id: number, fields: string[], fallback: string): string {
    const item = this.findById(catalog, id);
    return fields.map(field => item?.[field]).find(Boolean) || fallback;
  }

}
