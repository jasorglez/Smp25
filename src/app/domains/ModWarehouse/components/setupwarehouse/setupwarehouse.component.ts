import { CommonModule } from '@angular/common';
import { Component, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { alerts } from 'app/helpers/alerts';
import { SetupService } from 'app/services/setup.service';
import { SignalsService } from 'app/services/signals.service';
import { BranchsService } from 'app/services/branchs.service';
import { ProjectsService } from 'app/services/projects.service';
import { TypexPrefixesService } from 'app/services/typexprefixes.service';

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
  private typexPrefixesService = inject(TypexPrefixesService);

  idCompany: number;
  warehouseSetup: any = { projectOrBranch: null };
  newData: boolean = false;

  // Nuevas propiedades
  branches: any[] = [];
  projects: any[] = [];
  selectedContract: number | null = null;
  selectedBranchOrProject: number | null = null;
  prefix: string = '';
  consecutive: number = 0;
  prefixId: number | null = null; // Para saber si ya existe o es nuevo
  hasPrefixData: boolean = false; // Para saber si usar add o update

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
        console.log(this.warehouseSetup);
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

    const reqType = this.warehouseSetup.projectOrBranch === true ? 'project' : 'branch';
    const prefixData = {
      reqType: reqType,
      idReqType: this.selectedBranchOrProject,
      prefix: this.prefix,
      consecutive: this.consecutive,
      active: true
    };

    if (this.hasPrefixData) {
      // Actualizar prefijo existente
      this.typexPrefixesService.updatePrefix(reqType, this.selectedBranchOrProject, prefixData).subscribe({
        next: () => {
          console.log('✅ Prefijo actualizado correctamente');
          alerts.basicAlert("Actualización", "La configuración se ha guardado correctamente", "success");
        },
        error: (err) => {
          console.error('❌ Error al actualizar prefijo:', err);
          alerts.basicAlert("Error", "Ha ocurrido un error al guardar el prefijo", "error");
        }
      });
    } else {
      // Crear nuevo prefijo
      this.typexPrefixesService.addPrefix(prefixData).subscribe({
        next: () => {
          console.log('✅ Prefijo creado correctamente');
          this.hasPrefixData = true;
          alerts.basicAlert("Actualización", "La configuración se ha guardado correctamente", "success");
        },
        error: (err) => {
          console.error('❌ Error al crear prefijo:', err);
          alerts.basicAlert("Error", "Ha ocurrido un error al guardar el prefijo", "error");
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
    this.prefix = '';
    this.consecutive = 0;
    this.prefixId = null;
    this.hasPrefixData = false;

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
      this.prefix = '';
      this.consecutive = 0;
      this.prefixId = null;
      this.hasPrefixData = false;
      return;
    }

    const reqType = this.warehouseSetup.projectOrBranch === true ? 'project' : 'branch';

    this.typexPrefixesService.getPrefix(reqType, this.selectedBranchOrProject).subscribe({
      next: (data: any) => {
        console.log('✅ Prefijo encontrado:', data);
        this.prefix = data.prefix || '';
        this.consecutive = data.consecutive || 0;
        this.prefixId = data.id;
        this.hasPrefixData = true;
      },
      error: (err) => {
        // Si no existe (404), limpiar campos para crear nuevo
        console.log('ℹ️ No existe prefijo, se creará uno nuevo');
        this.prefix = '';
        this.consecutive = 0;
        this.prefixId = null;
        this.hasPrefixData = false;
      }
    });
  }

  loadBranches() {
    this.branchsService.getBranches(this.idCompany).subscribe({
      next: (data: any) => {
        this.branches = data;
        console.log('✅ Sucursales cargadas:', this.branches.length);
      },
      error: (err) => {
        console.error('❌ Error al cargar sucursales:', err);
        this.branches = [];
      }
    });
  }

  loadProjects(contractId: number) {
    this.projectsService.getProjectsByContract(contractId).subscribe({
      next: (data: any) => {
        this.projects = data;
        console.log('✅ Proyectos cargados:', this.projects.length);
      },
      error: (err) => {
        console.error('❌ Error al cargar proyectos:', err);
        this.projects = [];
      }
    });
  }

}
