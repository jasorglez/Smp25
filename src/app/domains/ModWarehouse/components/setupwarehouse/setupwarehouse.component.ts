import { CommonModule } from '@angular/common';
import { Component, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { alerts } from 'app/helpers/alerts';
import { SetupService } from 'app/services/setup.service';
import { SignalsService } from 'app/services/signals.service';
import { BranchsService } from 'app/services/branchs.service';
import { ProjectsService } from 'app/services/projects.service';
import { PrefixSetupService, PrefixSetup } from 'app/services/prefix-setup.service';

@Component({
  selector: 'app-setupwarehouse',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './setupwarehouse.component.html',
  styleUrl: './setupwarehouse.component.scss'
})
export class SetupwarehouseComponent {
  private setupService = inject(SetupService);
  private signalsService = inject(SignalsService);
  private branchsService = inject(BranchsService);
  private projectsService = inject(ProjectsService);
  private prefixSetupService = inject(PrefixSetupService);

  idCompany: number;
  warehouseSetup: any = { projectOrBranch: null };
  newData: boolean = false;

  // Propiedades para listas
  branches: any[] = [];
  projects: any[] = [];
  selectedContract: number | null = null;
  selectedBranchOrProject: number | null = null;

  // Propiedades para PrefixSetup
  prefixSetupId: number | null = null;
  hasPrefixData: boolean = false;

  // Prefijos y consecutivos
  prefixReq: string = '';
  consecutiveReq: number = 0;
  prefixCotiz: string = '';
  consecutiveCotiz: number = 0;
  prefixOc: string = '';
  consecutiveOc: number = 0;

  ngOnInit() {
    this.idCompany = this.signalsService.getRootSelectedBySidebar()();
    this.getData();
  }

  constructor() {
    effect(() => {
      this.idCompany = this.signalsService.getRootSelectedBySidebar()();
      this.getData();
      this.loadBranches();
    });

    // Observar cambios en el contrato seleccionado
    effect(() => {
      const contractId = this.signalsService.getContractSelectedBySidebar()();
      if (contractId) {
        this.selectedContract = contractId;
        this.loadProjects(contractId);
      } else {
        this.selectedContract = null;
        this.projects = [];
      }
    });
  }

  getData() {
    this.setupService.getWarehouseSetup(this.idCompany).subscribe({
      next: (data: any) => {
        this.warehouseSetup = data[0];
      },
      error: (err) => {
        if (err.status === 404) {
          this.warehouseSetup = {};
          this.newData = true;
        } else {
          console.error(err);
        }
      }
    });
  }

  saveData() {
    // Primero guardar la configuración general de warehouse
    const saveGeneralConfig = () => {
      if (this.newData) {
        this.warehouseSetup.idCompany = this.idCompany;
        this.setupService.addWarehouseSetup(this.warehouseSetup).subscribe({
          next: () => {
            this.getData();
            this.newData = false;
            this.savePrefixData();
          },
          error: (err) => {
            alerts.basicAlert("Error", "Ha ocurrido un error al guardar la configuración", "error");
          }
        });
      } else {
        this.setupService.updateWarehouseSetup(this.idCompany, this.warehouseSetup).subscribe({
          next: () => {
            this.getData();
            this.savePrefixData();
          },
          error: (err) => {
            alerts.basicAlert("Error", "Ha ocurrido un error al guardar la configuración", "error");
          }
        });
      }
    };

    saveGeneralConfig();
  }

  savePrefixData() {
    // Solo guardar prefijo si hay un branch o project seleccionado
    if (!this.selectedBranchOrProject) {
      alerts.basicAlert("Actualización", "La configuración se ha guardado correctamente", "success");
      return;
    }

    const type: 'project' | 'branch' = this.warehouseSetup.projectOrBranch === true ? 'project' : 'branch';

    const prefixData: PrefixSetup = {
      idProjectOrBranch: this.selectedBranchOrProject,
      type: type,
      prefixReq: this.prefixReq || null,
      consecutiveReq: this.consecutiveReq || 0,
      prefixCotiz: this.prefixCotiz || null,
      consecutiveCotiz: this.consecutiveCotiz || 0,
      prefixOc: this.prefixOc || null,
      consecutiveOc: this.consecutiveOc || 0,
      active: true
    };


    if (this.hasPrefixData && this.prefixSetupId) {
      // PUT - Actualizar prefijo existente
      this.prefixSetupService.updatePrefixSetup(this.prefixSetupId, prefixData).subscribe({
        next: () => {
          alerts.basicAlert("Actualización", "La configuración se ha guardado correctamente", "success");
        },
        error: (err) => {
          console.error('❌ Error al actualizar PrefixSetup:', err);
          alerts.basicAlert("Error", "Ha ocurrido un error al guardar la configuración de prefijos", "error");
        }
      });
    } else {
      // POST - Crear nuevo prefijo
      this.prefixSetupService.createPrefixSetup(prefixData).subscribe({
        next: (result) => {
          this.prefixSetupId = result.id;
          this.hasPrefixData = true;
          alerts.basicAlert("Actualización", "La configuración se ha guardado correctamente", "success");
        },
        error: (err) => {
          console.error('❌ Error al crear PrefixSetup:', err);
          alerts.basicAlert("Error", "Ha ocurrido un error al guardar la configuración de prefijos", "error");
        }
      });
    }
  }

  revertChanges() {
    this.getData();
  }

  onProjectOrBranchChange() {
    // Limpiar selección al cambiar entre proyectos y sucursales
    this.selectedBranchOrProject = null;
    this.clearPrefixFields();

    // Si cambia a sucursales, cargar sucursales
    if (this.warehouseSetup.projectOrBranch === false) {
      this.loadBranches();
    }
    // Si cambia a proyectos, verificar si hay contrato seleccionado
    else if (this.warehouseSetup.projectOrBranch === true && this.selectedContract) {
      this.loadProjects(this.selectedContract);
    }
  }

  onBranchOrProjectSelection() {
    // Cuando se selecciona una sucursal o proyecto, cargar su prefijo
    if (!this.selectedBranchOrProject) {
      this.clearPrefixFields();
      return;
    }

    const type = this.warehouseSetup.projectOrBranch === true ? 'project' : 'branch';

    this.prefixSetupService.getPrefixSetup(type, this.selectedBranchOrProject).subscribe({
      next: (data: PrefixSetup) => {
        this.prefixSetupId = data.id;
        this.prefixReq = data.prefixReq || '';
        this.consecutiveReq = data.consecutiveReq || 0;
        this.prefixCotiz = data.prefixCotiz || '';
        this.consecutiveCotiz = data.consecutiveCotiz || 0;
        this.prefixOc = data.prefixOc || '';
        this.consecutiveOc = data.consecutiveOc || 0;
        this.hasPrefixData = true;
      },
      error: (err) => {
        // Si no existe (404), limpiar campos para crear nuevo
        this.clearPrefixFields();
      }
    });
  }

  private clearPrefixFields() {
    this.prefixSetupId = null;
    this.prefixReq = '';
    this.consecutiveReq = 0;
    this.prefixCotiz = '';
    this.consecutiveCotiz = 0;
    this.prefixOc = '';
    this.consecutiveOc = 0;
    this.hasPrefixData = false;
  }

  loadBranches() {
    this.branchsService.getBranches(this.idCompany).subscribe({
      next: (data: any) => {
        this.branches = data;
      },
      error: (err) => {
        console.error('❌ Error al cargar sucursales:', err);
        this.branches = [];
      }
    });
  }

  loadProjects(contractId: number) {
    const idUser = this.signalsService.idUser();
    this.projectsService.getProjectsByContract(idUser, contractId).subscribe({
      next: (data: any) => {
        // Mapear los datos para tener estructura consistente
        // El API devuelve: idProject, projectName
        this.projects = Object.values(data).map((p: any) => ({
          id: p.idProject,
          name: p.projectName
        }));
      },
      error: (err) => {
        console.error('❌ Error al cargar proyectos:', err);
        this.projects = [];
      }
    });
  }

}
