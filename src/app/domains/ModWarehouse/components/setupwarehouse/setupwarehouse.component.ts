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
  warehouseSetup: any = { projectOrBranch: false };
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
  prefixOcProveedor: string = '';
  consecutiveOcProveedor: number = 0;
  prefixCompraInmediata: string = '';
  consecutiveCompraInmediata: number = 0;
  prefixTraspaso: string = '';
  consecutiveTraspaso: number = 0;

  // iva se enlaza directamente en warehouseSetup.iva (cargado y guardado con getData/saveData)

  selectedBranch: number | null = null;
  get branchIsValid(): boolean {
    return this.selectedBranch !== null && this.selectedBranch > 0;
  }

  get selectedBranchName(): string {
    const branch = this.branches.find(b => b.id == this.selectedBranch);
    return branch ? (branch.name || branch.description || '') : '';
  }

  ngOnInit() {
    this.idCompany = this.signalsService.getRootSelectedBySidebar()();
  }

  constructor() {
    effect(() => {
      this.idCompany = this.signalsService.getRootSelectedBySidebar()();
      this.loadBranches();
    });

    // La sucursal proviene del selector del sidebar; al cambiar se carga el setup + prefijos de esa sucursal
    effect(() => {
      const branchId = this.signalsService.getBranchSelectedBySidebar()();
      this.selectedBranch = branchId;
      this.selectedBranchOrProject = branchId;
      this.getData();
      this.onBranchOrProjectSelection();
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
    // Si no hay sucursal seleccionada, no cargar nada
    if (!this.selectedBranch || this.selectedBranch <= 0) {
      this.warehouseSetup = { projectOrBranch: false };
      this.newData = true;
      return;
    }

    this.setupService.getWarehouseSetupByBranch(this.selectedBranch).subscribe({
      next: (data: any) => {
        this.warehouseSetup = data || {};
        this.warehouseSetup.projectOrBranch = false;
        this.newData = false;
      },
      error: (err) => {
        if (err.status === 404) {
          this.warehouseSetup = { projectOrBranch: false };
          this.newData = true;
        } else {
          console.error(err);
        }
      }
    });
  }

  saveData() {
    if (!this.selectedBranch || this.selectedBranch <= 0) {
      alerts.basicAlert("Atención", "Selecciona una sucursal en el menú lateral", "warning");
      return;
    }

    // El prefijo de Pedimentos es obligatorio: se usa al generar OCs (ej. OC-BOD-PE1-GON1429)
    if (!this.prefixCotiz?.trim()) {
      alerts.basicAlert("Atención", "El prefijo de Pedimentos es obligatorio", "warning");
      return;
    }

    // El prefijo de Órdenes de Compra es obligatorio: reemplaza la literal "OC" en el folio
    if (!this.prefixOc?.trim()) {
      alerts.basicAlert("Atención", "El prefijo de Órdenes de Compra es obligatorio", "warning");
      return;
    }

    // Iniciales del proveedor en OC: entero entre 1 y 5
    const iniciales = Number(this.consecutiveOcProveedor);
    if (!iniciales || iniciales < 1 || iniciales > 5) {
      alerts.basicAlert("Atención", "Iniciales del proveedor debe ser un número entre 1 y 5", "warning");
      return;
    }

    const saveGeneralConfig = () => {
      if (this.newData) {
        this.warehouseSetup.idCompany = this.idCompany;
        this.warehouseSetup.idBranch = this.selectedBranch;
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
        this.setupService.updateWarehouseSetupByBranch(this.selectedBranch, this.warehouseSetup).subscribe({
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
      prefixOcProveedor: this.prefixOcProveedor || null,
      consecutiveOcProveedor: this.consecutiveOcProveedor || 0,
      prefixCompraInmediata: this.prefixCompraInmediata || null,
      consecutiveCompraInmediata: this.consecutiveCompraInmediata || 0,
      prefixTraspaso: this.prefixTraspaso || null,
      consecutiveTraspaso: this.consecutiveTraspaso || 0,
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
        this.prefixOcProveedor = data.prefixOcProveedor || '';
        // Iniciales del proveedor en OC: si no está configurado, usar 3 (comportamiento histórico)
        this.consecutiveOcProveedor = data.consecutiveOcProveedor || 3;
        this.prefixCompraInmediata = data.prefixCompraInmediata || '';
        this.consecutiveCompraInmediata = data.consecutiveCompraInmediata || 0;
        this.prefixTraspaso = data.prefixTraspaso || '';
        this.consecutiveTraspaso = data.consecutiveTraspaso || 0;
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
    this.prefixOcProveedor = '';
    // Default a 3 iniciales (comportamiento histórico hardcoded)
    this.consecutiveOcProveedor = 3;
    this.prefixCompraInmediata = '';
    this.consecutiveCompraInmediata = 0;
    this.prefixTraspaso = '';
    this.consecutiveTraspaso = 0;
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
