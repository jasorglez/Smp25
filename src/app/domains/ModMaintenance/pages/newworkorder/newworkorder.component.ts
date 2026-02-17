import { Component, effect, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { NgSelectComponent } from '@ng-select/ng-select';
import { WorkorderService } from 'app/services/workorder.service';
import { WorkorderTaskService } from 'app/services/workorder-task.service';
import { WorkorderMaterialService } from 'app/services/workorder-material.service';
import { MaintenanceConfigService } from 'app/services/maintenance-config.service';
import { EquipmentService } from 'app/services/equipment.service';
import { EmployeesService } from 'app/services/employees.service';
import { TeamService } from 'app/services/team.service';
import { MaterialsService } from 'app/services/materials.service';
import { SignalsService } from 'app/services/signals.service';
import { forkJoin } from 'rxjs';

interface Task {
  id: number;
  dbId?: number;
  description: string;
  completed: boolean;
}

interface MaterialItem {
  id: number;
  dbId?: number;
  materialId: number;
  materialName: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
}

@Component({
  selector: 'app-newworkorder',
  standalone: true,
  imports: [CommonModule, FormsModule, NgSelectComponent],
  templateUrl: './newworkorder.component.html',
  styleUrl: './newworkorder.component.scss'
})
export class NewworkorderComponent implements OnInit {

  private workorderService = inject(WorkorderService);
  private taskService = inject(WorkorderTaskService);
  private materialService = inject(WorkorderMaterialService);
  private configService = inject(MaintenanceConfigService);
  private equipmentService = inject(EquipmentService);
  private employeesService = inject(EmployeesService);
  private teamService = inject(TeamService);
  private materialsService = inject(MaterialsService);
  private signalsService = inject(SignalsService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  idcompany: number = 0;
  idBranch: number = 0;
  isEditing: boolean = false;
  editingId: number | null = null;
  loading: boolean = false;
  saving: boolean = false;
  private initialized: boolean = false;
  private lastBranchId: number = 0;

  formData: any = {
    type: 'preventivo',
    priority: 'media',
    title: '',
    assetId: '',
    assetName: '',
    requestedBy: '',
    assignedTo: '',
    department: '',
    scheduledDate: '',
    estimatedHours: null,
    actualHours: null,
    description: '',
    failureDescription: '',
    observations: '',
    costLabor: 0,
    costParts: 0,
    status: 'pendiente'
  };

  tasks: Task[] = [
    { id: 1, description: '', completed: false }
  ];

  assets: any[] = [];
  employees: any[] = [];
  teams: any[] = [];
  materials: any[] = [];
  selectedMaterials: MaterialItem[] = [];
  selectedTeam: any = null;

  departments: string[] = [
    'Producción',
    'Mantenimiento',
    'Almacén',
    'Calidad',
    'Logística',
    'Instalaciones'
  ];

  constructor() {
    effect(() => {
      this.updateContext();
      if (!this.initialized) {
        return;
      }

      if (this.idBranch !== this.lastBranchId) {
        this.lastBranchId = this.idBranch;
        this.loadData();
      }
    });
  }

  ngOnInit(): void {
    this.updateContext();

    const editId = this.route.snapshot.queryParamMap.get('id');
    if (editId) {
      this.isEditing = true;
      this.editingId = parseInt(editId, 10);
    }

    this.lastBranchId = this.idBranch;
    this.initialized = true;
    this.loadData();
  }

  loadData(): void {
    if (!this.hasValidContext()) {
      this.loading = false;
      this.assets = [];
      this.employees = [];
      this.teams = [];
      this.materials = [];
      this.selectedMaterials = [];
      this.selectedTeam = null;
      return;
    }

    this.loading = true;
    const idBranchStr = this.idBranch.toString();

    const requests: any = {
      assets: this.equipmentService.getEquipmentByBranch(this.idBranch),
      employees: this.employeesService.getEmployees(this.idBranch),
      teams: this.teamService.getAll(idBranchStr),
      materials: this.materialsService.getMaterials(this.idcompany, 'CONSUMABLE')
    };

    if (this.isEditing && this.editingId) {
      requests.workOrder = this.workorderService.getById(this.editingId);
      requests.tasks = this.taskService.getByWorkOrder(this.editingId);
      requests.woMaterials = this.materialService.getByWorkOrder(this.editingId);
    }

    forkJoin(requests).subscribe({
      next: (result: any) => {
        this.assets = (result.assets || []).filter((a: any) => a.active);
        this.employees = (result.employees || []).filter((e: any) => e.active);
        this.teams = result.teams || [];
        this.materials = (result.materials || []).filter((m: any) => m.active);

        if (this.isEditing && result.workOrder) {
          const wo = result.workOrder;
          this.formData = {
            type: wo.type || 'preventivo',
            priority: wo.priority || 'media',
            title: wo.title || '',
            assetId: wo.assetId || '',
            assetName: wo.assetName || '',
            requestedBy: wo.requestedBy || '',
            assignedTo: wo.assignedTo || '',
            department: wo.department || '',
            scheduledDate: wo.scheduledDate ? wo.scheduledDate.split('T')[0] : '',
            estimatedHours: wo.estimatedHours || null,
            actualHours: wo.actualHours || null,
            description: wo.description || '',
            failureDescription: wo.failureDescription || '',
            observations: wo.observations || '',
            costLabor: wo.costLabor || 0,
            costParts: wo.costParts || 0,
            status: wo.status || 'pendiente'
          };

          const woTasks = result.tasks || [];
          if (woTasks.length > 0) {
            this.tasks = woTasks.map((t: any, i: number) => ({
              id: i + 1,
              dbId: t.id,
              description: t.description || '',
              completed: t.completed || false
            }));
          }

          // Set selected team for labor cost display
          if (this.formData.assignedTo) {
            this.selectedTeam = this.teams.find((t: any) => t.name === this.formData.assignedTo) || null;
          }

          // Load existing materials
          const woMaterials = result.woMaterials || [];
          if (woMaterials.length > 0) {
            this.selectedMaterials = woMaterials.map((m: any, i: number) => ({
              id: i + 1,
              dbId: m.id,
              materialId: m.idMaterial,
              materialName: m.materialName || '',
              quantity: m.quantity || 1,
              unitCost: m.unitCost || 0,
              totalCost: m.totalCost || 0
            }));
          }
        }

        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading data:', err);
        this.loading = false;
      }
    });
  }

  onAssetChange(): void {
    const selected = this.assets.find((a: any) => a.id.toString() === this.formData.assetId);
    this.formData.assetName = selected ? selected.description : '';

    // Assign to team if asset has an associated team
    if (selected && selected.idTeam) {
      const team = this.teams.find((t: any) => t.id === selected.idTeam);
      if (team) {
        this.formData.assignedTo = team.name;
        this.selectedTeam = team;
        this.calculateLaborCost();
      }
    } else {
      this.formData.assignedTo = '';
      this.selectedTeam = null;
      this.formData.costLabor = 0;
    }
  }

  onTeamChange(): void {
    this.selectedTeam = this.teams.find((t: any) => t.name === this.formData.assignedTo) || null;
    this.calculateLaborCost();
  }

  onEstimatedHoursChange(): void {
    this.calculateLaborCost();
  }

  calculateLaborCost(): void {
    if (this.selectedTeam && this.formData.estimatedHours) {
      const hourlyRate = this.selectedTeam.hourlyRate || 0;
      this.formData.costLabor = Math.round(hourlyRate * this.formData.estimatedHours * 100) / 100;
    } else {
      this.formData.costLabor = 0;
    }
  }

  addMaterial(): void {
    if (!this.canCreateByBranch()) return;

    const newId = this.selectedMaterials.length > 0
      ? Math.max(...this.selectedMaterials.map(m => m.id)) + 1
      : 1;

    this.selectedMaterials.push({
      id: newId,
      materialId: 0,
      materialName: '',
      quantity: 1,
      unitCost: 0,
      totalCost: 0
    });
  }

  removeMaterial(id: number): void {
    this.selectedMaterials = this.selectedMaterials.filter(m => m.id !== id);
    this.calculatePartsCost();
  }

  onMaterialSelect(item: MaterialItem): void {
    const material = this.materials.find((m: any) => m.id === item.materialId);
    if (material) {
      item.materialName = material.description;
      item.unitCost = material.costoMN || 0;
      item.totalCost = Math.round(item.unitCost * item.quantity * 100) / 100;
    }
    this.calculatePartsCost();
  }

  onQuantityChange(item: MaterialItem): void {
    item.totalCost = Math.round(item.unitCost * item.quantity * 100) / 100;
    this.calculatePartsCost();
  }

  calculatePartsCost(): void {
    this.formData.costParts = this.selectedMaterials.reduce((sum, m) => sum + m.totalCost, 0);
    this.formData.costParts = Math.round(this.formData.costParts * 100) / 100;
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount || 0);
  }

  addTask(): void {
    if (!this.canCreateByBranch()) {
      return;
    }

    this.tasks.push({ id: this.tasks.length + 1, description: '', completed: false });
  }

  removeTask(id: number): void {
    if (this.tasks.length > 1) {
      this.tasks = this.tasks.filter(task => task.id !== id);
    }
  }

  handleSubmit(): void {
    if (!this.formData.title || !this.formData.description) return;
    if (!this.hasValidContext()) return;

    this.saving = true;
    const idBranchStr = this.idBranch.toString();

    const workOrderData: any = {
      idBranch: idBranchStr,
      title: this.formData.title,
      type: this.formData.type,
      priority: this.formData.priority,
      status: this.formData.status,
      requestedBy: this.formData.requestedBy,
      assignedTo: this.formData.assignedTo,
      department: this.formData.department,
      assetId: this.formData.assetId ? this.formData.assetId.toString() : null,
      assetName: this.formData.assetName,
      scheduledDate: this.formData.scheduledDate || null,
      estimatedHours: this.formData.estimatedHours || null,
      actualHours: this.formData.actualHours || null,
      description: this.formData.description,
      failureDescription: this.formData.failureDescription || null,
      observations: this.formData.observations || null,
      costLabor: this.formData.costLabor || 0,
      costParts: this.formData.costParts || 0,
      active: true
    };

    if (this.isEditing && this.editingId) {
      this.workorderService.update(this.editingId, workOrderData).subscribe({
        next: () => this.syncTasks(this.editingId!),
        error: (err) => {
          console.error('Error updating work order:', err);
          this.saving = false;
        }
      });
    } else {
      workOrderData.createdDate = new Date().toISOString();

      this.configService.getByBranch(idBranchStr).subscribe({
        next: (configs: any) => {
          const config = Array.isArray(configs) && configs.length > 0 ? configs[0] : null;
          const prefix = config?.prefixWorkOrder || 'OT';
          const consecutive = config?.consecutiveWO || 1;
          const year = new Date().getFullYear();
          workOrderData.folio = `${prefix}-${year}-${String(consecutive).padStart(3, '0')}`;

          this.workorderService.add(workOrderData).subscribe({
            next: (created: any) => {
              if (config) {
                this.configService.update(config.id, { ...config, consecutiveWO: consecutive + 1 }).subscribe();
              }
              this.saveTasks(created.id);
            },
            error: (err) => {
              console.error('Error creating work order:', err);
              this.saving = false;
            }
          });
        },
        error: () => {
          workOrderData.folio = `OT-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;
          this.workorderService.add(workOrderData).subscribe({
            next: (created: any) => this.saveTasks(created.id),
            error: (err) => {
              console.error('Error creating work order:', err);
              this.saving = false;
            }
          });
        }
      });
    }
  }

  private saveTasks(workOrderId: number): void {
    const validTasks = this.tasks.filter(t => t.description.trim());
    const validMaterials = this.selectedMaterials.filter(m => m.materialId > 0);

    const ops: any[] = [];

    // Add task operations
    for (const t of validTasks) {
      ops.push(this.taskService.add({ idWorkorder: workOrderId, description: t.description, completed: t.completed, active: true }));
    }

    // Add material operations
    for (const m of validMaterials) {
      ops.push(this.materialService.add({
        idWorkorder: workOrderId,
        idMaterial: m.materialId,
        materialName: m.materialName,
        quantity: m.quantity,
        unitCost: m.unitCost,
        totalCost: m.totalCost,
        active: true
      }));
    }

    if (ops.length === 0) {
      this.saving = false;
      this.router.navigate(['/procmodmaintenance/workorders']);
      return;
    }

    forkJoin(ops).subscribe({
      next: () => {
        this.saving = false;
        this.router.navigate(['/procmodmaintenance/workorders']);
      },
      error: () => {
        this.saving = false;
        this.router.navigate(['/procmodmaintenance/workorders']);
      }
    });
  }

  private syncTasks(workOrderId: number): void {
    this.taskService.getByWorkOrder(workOrderId).subscribe({
      next: (currentTasks: any[]) => {
        const ops: any[] = [];

        // Delete removed tasks
        const currentDbIds = this.tasks.filter(t => t.dbId).map(t => t.dbId);
        for (const ct of (currentTasks || [])) {
          if (!currentDbIds.includes(ct.id)) {
            ops.push(this.taskService.delete(ct.id));
          }
        }

        // Update existing tasks
        for (const task of this.tasks) {
          if (task.dbId) {
            ops.push(this.taskService.update(task.dbId, {
              id: task.dbId,
              idWorkorder: workOrderId,
              description: task.description,
              completed: task.completed,
              active: true
            }));
          } else if (task.description.trim()) {
            ops.push(this.taskService.add({
              idWorkorder: workOrderId,
              description: task.description,
              completed: task.completed,
              active: true
            }));
          }
        }

        if (ops.length > 0) {
          forkJoin(ops).subscribe({
            complete: () => this.syncMaterials(workOrderId)
          });
        } else {
          this.syncMaterials(workOrderId);
        }
      },
      error: () => {
        this.saveTasks(workOrderId);
      }
    });
  }

  private syncMaterials(workOrderId: number): void {
    this.materialService.getByWorkOrder(workOrderId).subscribe({
      next: (currentMaterials: any[]) => {
        const ops: any[] = [];
        const validMaterials = this.selectedMaterials.filter(m => m.materialId > 0);

        // Delete removed materials
        const currentDbIds = validMaterials.filter(m => m.dbId).map(m => m.dbId);
        for (const cm of (currentMaterials || [])) {
          if (!currentDbIds.includes(cm.id)) {
            ops.push(this.materialService.delete(cm.id));
          }
        }

        // Update existing or add new materials
        for (const mat of validMaterials) {
          if (mat.dbId) {
            ops.push(this.materialService.update(mat.dbId, {
              id: mat.dbId,
              idWorkorder: workOrderId,
              idMaterial: mat.materialId,
              materialName: mat.materialName,
              quantity: mat.quantity,
              unitCost: mat.unitCost,
              totalCost: mat.totalCost,
              active: true
            }));
          } else {
            ops.push(this.materialService.add({
              idWorkorder: workOrderId,
              idMaterial: mat.materialId,
              materialName: mat.materialName,
              quantity: mat.quantity,
              unitCost: mat.unitCost,
              totalCost: mat.totalCost,
              active: true
            }));
          }
        }

        if (ops.length > 0) {
          forkJoin(ops).subscribe({
            complete: () => {
              this.saving = false;
              this.router.navigate(['/procmodmaintenance/workorders']);
            }
          });
        } else {
          this.saving = false;
          this.router.navigate(['/procmodmaintenance/workorders']);
        }
      },
      error: () => {
        // If error getting materials, just save them as new
        const validMaterials = this.selectedMaterials.filter(m => m.materialId > 0);
        if (validMaterials.length > 0) {
          const adds = validMaterials.map(m =>
            this.materialService.add({
              idWorkorder: workOrderId,
              idMaterial: m.materialId,
              materialName: m.materialName,
              quantity: m.quantity,
              unitCost: m.unitCost,
              totalCost: m.totalCost,
              active: true
            })
          );
          forkJoin(adds).subscribe({
            complete: () => {
              this.saving = false;
              this.router.navigate(['/procmodmaintenance/workorders']);
            }
          });
        } else {
          this.saving = false;
          this.router.navigate(['/procmodmaintenance/workorders']);
        }
      }
    });
  }

  handleCancel(): void {
    if (confirm('¿Deseas cancelar? Se perderán los datos no guardados.')) {
      this.router.navigate(['/procmodmaintenance/workorders']);
    }
  }

  private updateContext(): void {
    const signalCompany = this.signalsService.getRootSelectedBySidebar()();
    if (signalCompany !== null && signalCompany !== undefined) {
      this.idcompany = Number(signalCompany);
    } else {
      const companyStorage = localStorage.getItem('company');
      if (companyStorage) {
        const parsedCompany = Number(companyStorage);
        if (!Number.isNaN(parsedCompany)) {
          this.idcompany = parsedCompany;
        }
      }
    }

    const signalBranch = this.signalsService.getBranchSelectedBySidebar()();
    this.idBranch = signalBranch !== null && signalBranch !== undefined ? Number(signalBranch) : 0;
  }

  private hasValidContext(): boolean {
    const hasCompany = this.idcompany !== null && this.idcompany !== undefined && !Number.isNaN(Number(this.idcompany));
    const hasBranch = this.idBranch !== null && this.idBranch !== undefined && !Number.isNaN(Number(this.idBranch)) && Number(this.idBranch) > 0;
    return hasCompany && hasBranch;
  }

  canCreateByBranch(): boolean {
    return this.idBranch > 0;
  }
}
