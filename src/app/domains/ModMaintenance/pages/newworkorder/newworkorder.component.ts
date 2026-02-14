import { Component, effect, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { WorkorderService } from 'app/services/workorder.service';
import { WorkorderTaskService } from 'app/services/workorder-task.service';
import { MaintenanceConfigService } from 'app/services/maintenance-config.service';
import { EquipmentService } from 'app/services/equipment.service';
import { EmployeesService } from 'app/services/employees.service';
import { TeamService } from 'app/services/team.service'; // Added TeamService
import { SignalsService } from 'app/services/signals.service';
import { forkJoin } from 'rxjs';

interface Task {
  id: number;
  dbId?: number;
  description: string;
  completed: boolean;
}

@Component({
  selector: 'app-newworkorder',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './newworkorder.component.html',
  styleUrl: './newworkorder.component.scss'
})
export class NewworkorderComponent implements OnInit {

  private workorderService = inject(WorkorderService);
  private taskService = inject(WorkorderTaskService);
  private configService = inject(MaintenanceConfigService);
  private equipmentService = inject(EquipmentService);
  private employeesService = inject(EmployeesService);
  private teamService = inject(TeamService); // Injected TeamService
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
      return;
    }

    this.loading = true;
    const idBranchStr = this.idBranch.toString();

    const requests: any = {
      assets: this.equipmentService.getEquipmentByBranch(this.idBranch),
      employees: this.employeesService.getEmployees(this.idBranch),
      teams: this.teamService.getAll(idBranchStr) // Fetch teams data
    };

    if (this.isEditing && this.editingId) {
      requests.workOrder = this.workorderService.getById(this.editingId);
      requests.tasks = this.taskService.getByWorkOrder(this.editingId);
    }

    forkJoin(requests).subscribe({
      next: (result: any) => {
        this.assets = (result.assets || []).filter((a: any) => a.active);
        this.employees = (result.employees || []).filter((e: any) => e.active);
        this.teams = result.teams || []; // Store fetched teams

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
      this.formData.assignedTo = team ? team.name : '';
    } else {
      this.formData.assignedTo = ''; // Clear if no team is associated
    }
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
    if (validTasks.length === 0) {
      this.saving = false;
      this.router.navigate(['/procmodmaintenance/workorders']);
      return;
    }

    const ops = validTasks.map(t =>
      this.taskService.add({ idWorkorder: workOrderId, description: t.description, completed: t.completed, active: true })
    );

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
        this.saveTasks(workOrderId);
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
