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

interface ProfileCompanyGroup {
  name: string;
  branches: Array<{
    name: string;
    assigned: boolean;
    contracts: Array<{ name: string; projects: string[] }>;
    warehouses: string[];
    projects: string[];
  }>;
  contracts: Array<{ name: string; projects: string[] }>;
  projects: string[];
  warehouses: string[];
}

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
  companyGroups: ProfileCompanyGroup[] = [];
  unlinkedAccessSections: Array<{ title: string; icon: string; items: string[] }> = [];

  constructor() {
    effect(() => {
      const idUser = Number(this.profile.idUser() || 0);
      if (idUser) {
        this.loadAccessSummary(idUser);
      } else {
        this.companyGroups = [];
        this.unlinkedAccessSections = [];
      }
    });
  }

  get visibleAssignedItems(): string[] {
    return [...new Set((this.assignedItems ?? []).filter(item => !!item))];
  }

  get visibleAccessSections(): Array<{ title: string; icon: string; items: string[] }> {
    return this.unlinkedAccessSections.map(section => ({ ...section }));
  }

  async copyProfileValue(value: string | null | undefined): Promise<void> {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch (error) {
      const input = document.createElement('textarea');
      input.value = value;
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      input.remove();
    }
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
        const warehousesByBranch = new Map<number, any[]>();
        branchIds.forEach((branchId, index) => {
          warehousesByBranch.set(branchId, this.asArray(catalogs.warehouseCatalog[index]));
        });
        const companyByBranch = new Map<number, number>();
        branches.forEach(branch => {
          const companyId = Number(branch?.idCompany ?? branch?.idRoot ?? 0);
          if (companyId) companyByBranch.set(Number(branch.id), companyId);
        });

        const groups = new Map<number, ProfileCompanyGroup>();
        companyIds.forEach(id => groups.set(id, {
          name: this.findName(companies, id, ['name', 'nombre'], `Empresa ${id}`),
          branches: [], contracts: [], projects: [], warehouses: []
        }));
        const branchNodes = new Map<number, ProfileCompanyGroup['branches'][number]>();
        const getBranchNode = (branchId: number, assigned = false) => {
          let node = branchNodes.get(branchId);
          if (!node) {
            node = {
              name: this.findName(branches, branchId, ['name', 'nombre'], `Sucursal ${branchId}`),
              assigned, contracts: [], warehouses: [], projects: []
            };
            branchNodes.set(branchId, node);
            const companyId = companyByBranch.get(branchId);
            const company = companyId ? groups.get(companyId) : undefined;
            if (company) company.branches.push(node);
          } else if (assigned) {
            node.assigned = true;
          }
          return node;
        };

        branchIds.forEach(id => getBranchNode(id, true));
        const contractAssignments = new Map<number, { name: string; projects: string[]; branch?: ProfileCompanyGroup['branches'][number]; company?: ProfileCompanyGroup; linked: boolean }>();
        const unlinkedContractNames: string[] = [];
        contractIds.forEach(id => {
          const contract = this.findById(contracts, id);
          const name = contract
            ? [contract.numberContract, contract.descripSmall].filter(Boolean).join(' - ')
            : `Contrato ${id}`;
          const branchId = Number(contract?.idBranch ?? 0);
          const branch = branchId ? getBranchNode(branchId) : undefined;
          const companyId = branchId ? companyByBranch.get(branchId) : undefined;
          const company = companyId ? groups.get(companyId) : undefined;
          const item = { name, projects: [] as string[] };
          if (branch && company) branch.contracts.push(item);
          else if (company) company.contracts.push(item);
          else unlinkedContractNames.push(name);
          contractAssignments.set(id, { ...item, branch, company, linked: !!company });
        });

        projectIds.forEach(id => {
          const project = this.findById(projects, id);
          const name = project
            ? [project.idConsecutivo, project.name ?? project.nombre].filter(Boolean).join(' - ')
            : `Proyecto ${id}`;
          const contractId = Number(project?.idContract ?? project?.idContrato ?? 0);
          const contract = contractAssignments.get(contractId);
          if (contract?.linked) {
            contract.projects.push(name);
          } else {
            const companyId = Number(project?.idCompany ?? project?.idRoot ?? 0);
            const company = groups.get(companyId);
            if (company) company.projects.push(name);
          }
        });

        const assignedWarehouseIds = new Set(warehouseIds);
        warehousesByBranch.forEach((warehouseList, branchId) => {
          const branch = getBranchNode(branchId);
          const companyId = companyByBranch.get(branchId);
          const company = companyId ? groups.get(companyId) : undefined;
          warehouseList.forEach(warehouse => {
            const warehouseId = Number(warehouse?.id ?? warehouse?.idWarehouse ?? warehouse?.idAlmacen ?? 0);
            if (!warehouseId || !assignedWarehouseIds.has(warehouseId)) return;
            const name = this.findName([warehouse], warehouseId, ['name', 'nombre', 'description'], `Almacén ${warehouseId}`);
            if (branch && company) branch.warehouses.push(name);
            else if (company) company.warehouses.push(name);
          });
        });

        this.companyGroups = [...groups.values()].map(group => ({
          ...group,
          branches: group.branches.sort((a, b) => a.name.localeCompare(b.name))
        }));

        const linkedCompanyBranchIds = new Set([...branchNodes.keys()].filter(id => groups.has(companyByBranch.get(id) ?? -1)));
        const linkedProjectNames = new Set([...groups.values()].flatMap(group => [
          ...group.projects,
          ...group.branches.flatMap(branch => [
            ...branch.projects,
            ...branch.contracts.flatMap(contract => contract.projects)
          ]),
          ...group.contracts.flatMap(contract => contract.projects)
        ]));
        this.unlinkedAccessSections = [
          { title: 'Sucursales sin empresa asignada', icon: 'bi-geo-alt', items: branchIds.filter(id => !linkedCompanyBranchIds.has(id)).map(id => this.findName(branches, id, ['name', 'nombre'], `Sucursal ${id}`)) },
          { title: 'Contratos sin empresa/sucursal asignada', icon: 'bi-file-earmark-text', items: unlinkedContractNames },
          { title: 'Proyectos sin empresa o contrato vinculado', icon: 'bi-diagram-3', items: projectIds.map(id => {
            const project = this.findById(projects, id);
            const name = project ? [project.idConsecutivo, project.name ?? project.nombre].filter(Boolean).join(' - ') : `Proyecto ${id}`;
            return linkedProjectNames.has(name) ? '' : name;
          }).filter(Boolean) },
          { title: 'Almacenes sin sucursal/empresa asignada', icon: 'bi-box-seam', items: warehouseIds.filter(id => {
            const owner = [...warehousesByBranch.entries()].find(([, list]) => list.some(warehouse => Number(warehouse?.id ?? warehouse?.idWarehouse ?? warehouse?.idAlmacen) === id));
            return !owner || !groups.has(companyByBranch.get(owner[0]) ?? -1);
          }).map(id => `Almacén ${id}`) }
        ].filter(section => section.items.length);
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
    return catalog.find(item => Number(item?.id ?? item?.idContrato ?? item?.idProject ?? item?.idProyecto) === Number(id));
  }

  private findName(catalog: any[], id: number, fields: string[], fallback: string): string {
    const item = this.findById(catalog, id);
    return fields.map(field => item?.[field]).find(Boolean) || fallback;
  }

}
