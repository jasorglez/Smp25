import { Component, effect, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { WorkorderService } from 'app/services/workorder.service';
import { WorkorderTaskService } from 'app/services/workorder-task.service';
import { EquipmentService } from 'app/services/equipment.service';
import { EmployeesService } from 'app/services/employees.service';
import { SignalsService } from 'app/services/signals.service';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-workorders',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './workorders.component.html',
  styleUrls: ['./workorders.component.scss']
})
export class WorkordersComponent implements OnInit {

  private workorderService = inject(WorkorderService);
  private taskService = inject(WorkorderTaskService);
  private equipmentService = inject(EquipmentService);
  private employeesService = inject(EmployeesService);
  private signalsService = inject(SignalsService);
  private router = inject(Router);

  idcompany: number = 0;
  idBranch: number = 0;

  workOrders: any[] = [];
  filteredWorkOrders: any[] = [];
  selectedWorkOrder: any = null;
  selectedWorkOrderTasks: any[] = [];
  showWorkOrderDetail: boolean = false;
  loading: boolean = false;
  private initialized: boolean = false;
  private lastBranchId: number = 0;

  assets: any[] = [];
  employees: any[] = [];

  // Filters
  searchTerm: string = '';
  selectedType: string = '';
  selectedPriority: string = '';
  selectedStatus: string = '';
  selectedDepartment: string = '';

  // Stats
  stats = {
    total: 0,
    pending: 0,
    inProgress: 0,
    completed: 0,
    urgent: 0
  };

  // Options
  types = [
    { value: '', label: 'Todos los tipos' },
    { value: 'preventivo', label: 'Preventivo' },
    { value: 'correctivo', label: 'Correctivo' },
    { value: 'predictivo', label: 'Predictivo' },
    { value: 'inspeccion', label: 'Inspección' },
    { value: 'mejora', label: 'Mejora' }
  ];

  priorities = [
    { value: '', label: 'Todas las prioridades' },
    { value: 'urgente', label: 'Urgente' },
    { value: 'alta', label: 'Alta' },
    { value: 'media', label: 'Media' },
    { value: 'baja', label: 'Baja' }
  ];

  statuses = [
    { value: '', label: 'Todos los estados' },
    { value: 'pendiente', label: 'Pendiente' },
    { value: 'en-proceso', label: 'En Proceso' },
    { value: 'pausada', label: 'Pausada' },
    { value: 'completada', label: 'Completada' },
    { value: 'cancelada', label: 'Cancelada' }
  ];

  departments = [
    { value: '', label: 'Todos los departamentos' },
    { value: 'Producción', label: 'Producción' },
    { value: 'Mantenimiento', label: 'Mantenimiento' },
    { value: 'Almacén', label: 'Almacén' },
    { value: 'Instalaciones', label: 'Instalaciones' },
    { value: 'Calidad', label: 'Calidad' },
    { value: 'Logística', label: 'Logística' }
  ];

  constructor() {
    effect(() => {
      this.updateContext();
      if (!this.initialized) {
        return;
      }

      if (this.idBranch !== this.lastBranchId) {
        this.lastBranchId = this.idBranch;
        this.closeWorkOrderDetail();
        this.loadData();
      }
    });
  }

  ngOnInit(): void {
    this.updateContext();
    this.lastBranchId = this.idBranch;
    this.initialized = true;
    this.loadData();
  }

  loadData(): void {
    if (!this.hasValidContext()) {
      this.loading = false;
      this.workOrders = [];
      this.filteredWorkOrders = [];
      this.assets = [];
      this.employees = [];
      return;
    }

    this.loading = true;
    const idBranchStr = this.idBranch.toString();

    forkJoin({
      workOrders: this.workorderService.getAll(idBranchStr),
      assets: this.equipmentService.getEquipmentByBranch(this.idBranch),
      employees: this.employeesService.getEmployees(this.idBranch)
    }).subscribe({
      next: (result: any) => {
        this.assets = result.assets || [];
        this.employees = (result.employees || []).filter((e: any) => e.active);
        this.workOrders = (result.workOrders || []).map((wo: any) => ({
          ...wo,
          scheduledDate: wo.scheduledDate ? wo.scheduledDate.split('T')[0] : '',
          createdDate: wo.createdDate ? wo.createdDate.split('T')[0] : '',
          completedDate: wo.completedDate ? wo.completedDate.split('T')[0] : null
        }));
        this.filteredWorkOrders = [...this.workOrders];
        this.calculateStats();
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading data:', err);
        this.loading = false;
      }
    });
  }

  calculateStats(): void {
    this.stats.total = this.workOrders.length;
    this.stats.pending = this.workOrders.filter(wo => wo.status === 'pendiente').length;
    this.stats.inProgress = this.workOrders.filter(wo => wo.status === 'en-proceso').length;
    this.stats.completed = this.workOrders.filter(wo => wo.status === 'completada').length;
    this.stats.urgent = this.workOrders.filter(wo => wo.priority === 'urgente').length;
  }

  filterWorkOrders(): void {
    this.filteredWorkOrders = this.workOrders.filter(wo => {
      const matchesSearch = !this.searchTerm ||
        (wo.title || '').toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        (wo.folio || '').toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        (wo.assetName || '').toLowerCase().includes(this.searchTerm.toLowerCase());

      const matchesType = !this.selectedType || wo.type === this.selectedType;
      const matchesPriority = !this.selectedPriority || wo.priority === this.selectedPriority;
      const matchesStatus = !this.selectedStatus || wo.status === this.selectedStatus;
      const matchesDepartment = !this.selectedDepartment || wo.department === this.selectedDepartment;

      return matchesSearch && matchesType && matchesPriority && matchesStatus && matchesDepartment;
    });
  }

  onSearchChange(): void {
    this.filterWorkOrders();
  }

  onFilterChange(): void {
    this.filterWorkOrders();
  }

  viewWorkOrderDetail(workOrder: any): void {
    this.selectedWorkOrder = workOrder;
    this.selectedWorkOrderTasks = [];
    this.showWorkOrderDetail = true;

    this.taskService.getByWorkOrder(workOrder.id).subscribe({
      next: (tasks: any) => this.selectedWorkOrderTasks = tasks || [],
      error: () => this.selectedWorkOrderTasks = []
    });
  }

  closeWorkOrderDetail(): void {
    this.showWorkOrderDetail = false;
    this.selectedWorkOrder = null;
    this.selectedWorkOrderTasks = [];
  }

  getPriorityClass(priority: string): string {
    const classes: { [key: string]: string } = {
      'urgente': 'priority-urgent',
      'alta': 'priority-high',
      'media': 'priority-medium',
      'baja': 'priority-low'
    };
    return classes[priority] || 'priority-low';
  }

  getStatusClass(status: string): string {
    const classes: { [key: string]: string } = {
      'pendiente': 'status-pending',
      'en-proceso': 'status-in-progress',
      'pausada': 'status-paused',
      'completada': 'status-completed',
      'cancelada': 'status-cancelled'
    };
    return classes[status] || 'status-pending';
  }

  getTypeClass(type: string): string {
    const classes: { [key: string]: string } = {
      'preventivo': 'type-preventive',
      'correctivo': 'type-corrective',
      'predictivo': 'type-predictive',
      'inspeccion': 'type-inspection',
      'mejora': 'type-improvement'
    };
    return classes[type] || 'type-preventive';
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount || 0);
  }

  getDaysOverdue(workOrder: any): number {
    if (workOrder.status === 'completada' || workOrder.status === 'cancelada') return 0;
    if (!workOrder.scheduledDate) return 0;

    const scheduledDate = new Date(workOrder.scheduledDate);
    const now = new Date();
    const diffTime = now.getTime() - scheduledDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays > 0 ? diffDays : 0;
  }

  isOverdue(workOrder: any): boolean {
    return this.getDaysOverdue(workOrder) > 0;
  }

  getProgressPercentage(workOrder: any): number {
    if (workOrder.status === 'completada') return 100;
    if (workOrder.status === 'cancelada') return 0;

    const statusProgress: { [key: string]: number } = {
      'pendiente': 0,
      'en-proceso': 50,
      'pausada': 25
    };

    return statusProgress[workOrder.status] || 0;
  }

  onNewWorkOrder(): void {
    if (!this.canCreateByBranch()) {
      return;
    }

    this.router.navigate(['/procmodmaintenance/newworkorder']);
  }

  onEditWorkOrder(workOrder: any): void {
    this.closeWorkOrderDetail();
    this.router.navigate(['/procmodmaintenance/newworkorder'], { queryParams: { id: workOrder.id } });
  }

  onCompleteWorkOrder(workOrder: any): void {
    if (!confirm('¿Marcar esta orden como completada?')) return;
    this.workorderService.updateStatus(workOrder.id, 'completada').subscribe({
      next: () => this.loadData(),
      error: (err) => console.error('Error completing work order:', err)
    });
  }

  onCancelWorkOrder(workOrder: any): void {
    if (!confirm('¿Está seguro de cancelar esta orden de trabajo?')) return;
    this.workorderService.updateStatus(workOrder.id, 'cancelada').subscribe({
      next: () => this.loadData(),
      error: (err) => console.error('Error cancelling work order:', err)
    });
  }

  deleteWorkOrder(workOrder: any): void {
    if (!confirm('¿Eliminar la orden "' + (workOrder.folio || workOrder.title) + '"?')) return;
    this.workorderService.delete(workOrder.id).subscribe({
      next: () => {
        this.closeWorkOrderDetail();
        this.loadData();
      },
      error: (err) => console.error('Error deleting work order:', err)
    });
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
