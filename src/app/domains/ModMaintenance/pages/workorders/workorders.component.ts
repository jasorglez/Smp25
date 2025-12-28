import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

interface WorkOrder {
  id: string;
  title: string;
  asset: string;
  type: 'preventivo' | 'correctivo' | 'predictivo' | 'inspeccion' | 'mejora';
  priority: 'urgente' | 'alta' | 'media' | 'baja';
  status: 'pendiente' | 'en-proceso' | 'pausada' | 'completada' | 'cancelada';
  requestedBy: string;
  assignedTo: string;
  department: string;
  scheduledDate: string;
  estimatedHours: number;
  actualHours?: number;
  description: string;
  failureDescription?: string;
  observations?: string;
  createdDate: string;
  completedDate?: string;
  costLabor: number;
  costParts: number;
  totalCost: number;
}

interface Task {
  id: number;
  description: string;
  completed: boolean;
  completedDate?: string;
}

interface Material {
  id: number;
  name: string;
  quantity: number;
  unit: string;
  unitCost: number;
  totalCost: number;
}

@Component({
  selector: 'app-workorders',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './workorders.component.html',
  styleUrls: ['./workorders.component.scss']
})
export class WorkordersComponent implements OnInit {

  workOrders: WorkOrder[] = [
    {
      id: 'OT-2024-156',
      title: 'Mantenimiento Preventivo - Torno CNC-01',
      asset: 'Torno CNC-01',
      type: 'preventivo',
      priority: 'media',
      status: 'en-proceso',
      requestedBy: 'Juan Pérez',
      assignedTo: 'Carlos Ruiz',
      department: 'Producción',
      scheduledDate: '2025-11-28',
      estimatedHours: 4,
      actualHours: 3.5,
      description: 'Mantenimiento preventivo mensual del torno CNC incluyendo lubricación, verificación de calibración y limpieza general.',
      observations: 'Se detectó desgaste leve en correas de transmisión. Se recomienda reemplazo en próximo mantenimiento.',
      createdDate: '2025-11-20',
      costLabor: 280,
      costParts: 45,
      totalCost: 325
    },
    {
      id: 'OT-2024-157',
      title: 'Reparación Correctiva - Compresor CP-12',
      asset: 'Compresor CP-12',
      type: 'correctivo',
      priority: 'urgente',
      status: 'completada',
      requestedBy: 'María López',
      assignedTo: 'Ana Martínez',
      department: 'Mantenimiento',
      scheduledDate: '2025-11-22',
      estimatedHours: 6,
      actualHours: 8,
      description: 'Falla en motor eléctrico del compresor. Ruido anormal y sobrecalentamiento detectado.',
      failureDescription: 'Falla en rodamientos del motor principal. Causa: falta de lubricación preventiva.',
      observations: 'Se reemplazaron rodamientos y se realizó mantenimiento completo del sistema de lubricación.',
      createdDate: '2025-11-21',
      completedDate: '2025-11-23',
      costLabor: 640,
      costParts: 285,
      totalCost: 925
    },
    {
      id: 'OT-2024-158',
      title: 'Inspección de Seguridad - Montacargas MC-03',
      asset: 'Montacargas MC-03',
      type: 'inspeccion',
      priority: 'alta',
      status: 'pendiente',
      requestedBy: 'Roberto García',
      assignedTo: 'Juan Pérez',
      department: 'Almacén',
      scheduledDate: '2025-11-30',
      estimatedHours: 2,
      description: 'Inspección de seguridad trimestral del montacargas incluyendo frenos, dirección y sistemas hidráulicos.',
      observations: 'Inspección programada según calendario de seguridad.',
      createdDate: '2025-11-25',
      costLabor: 160,
      costParts: 0,
      totalCost: 160
    },
    {
      id: 'OT-2024-159',
      title: 'Mejora de Eficiencia - Sistema HVAC',
      asset: 'Sistema HVAC Principal',
      type: 'mejora',
      priority: 'baja',
      status: 'pausada',
      requestedBy: 'Luis Hernández',
      assignedTo: 'María López',
      department: 'Instalaciones',
      scheduledDate: '2025-12-15',
      estimatedHours: 12,
      description: 'Optimización del sistema HVAC para mejorar eficiencia energética y reducir costos operativos.',
      observations: 'Proyecto en pausa por falta de presupuesto aprobado.',
      createdDate: '2025-11-15',
      costLabor: 960,
      costParts: 1200,
      totalCost: 2160
    },
    {
      id: 'OT-2024-160',
      title: 'Mantenimiento Predictivo - Prensa Hidráulica PH-08',
      asset: 'Prensa Hidráulica PH-08',
      type: 'predictivo',
      priority: 'media',
      status: 'pendiente',
      requestedBy: 'Ana Martínez',
      assignedTo: 'Carlos Ruiz',
      department: 'Producción',
      scheduledDate: '2025-12-05',
      estimatedHours: 8,
      description: 'Mantenimiento basado en análisis predictivo. Vibraciones anormales detectadas en sensor IoT.',
      observations: 'Alertas del sistema de monitoreo predictivo indican posible desgaste en cilindros hidráulicos.',
      createdDate: '2025-11-28',
      costLabor: 640,
      costParts: 350,
      totalCost: 990
    }
  ];

  filteredWorkOrders: WorkOrder[] = [];
  selectedWorkOrder: WorkOrder | null = null;
  showWorkOrderDetail: boolean = false;

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
    { value: 'Calidad', label: 'Calidad' }
  ];

  constructor(private router: Router) { }

  ngOnInit(): void {
    this.filteredWorkOrders = [...this.workOrders];
    this.calculateStats();
  }

  calculateStats(): void {
    this.stats.total = this.workOrders.length;
    this.stats.pending = this.workOrders.filter(wo => wo.status === 'pendiente').length;
    this.stats.inProgress = this.workOrders.filter(wo => wo.status === 'en-proceso').length;
    this.stats.completed = this.workOrders.filter(wo => wo.status === 'completada').length;
    this.stats.urgent = this.workOrders.filter(wo => wo.priority === 'urgente').length;
  }

  filterWorkOrders(): void {
    this.filteredWorkOrders = this.workOrders.filter(workOrder => {
      const matchesSearch = !this.searchTerm ||
        workOrder.title.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        workOrder.id.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        workOrder.asset.toLowerCase().includes(this.searchTerm.toLowerCase());

      const matchesType = !this.selectedType || workOrder.type === this.selectedType;
      const matchesPriority = !this.selectedPriority || workOrder.priority === this.selectedPriority;
      const matchesStatus = !this.selectedStatus || workOrder.status === this.selectedStatus;
      const matchesDepartment = !this.selectedDepartment || workOrder.department === this.selectedDepartment;

      return matchesSearch && matchesType && matchesPriority && matchesStatus && matchesDepartment;
    });
  }

  onSearchChange(): void {
    this.filterWorkOrders();
  }

  onFilterChange(): void {
    this.filterWorkOrders();
  }

  viewWorkOrderDetail(workOrder: WorkOrder): void {
    this.selectedWorkOrder = workOrder;
    this.showWorkOrderDetail = true;
  }

  closeWorkOrderDetail(): void {
    this.showWorkOrderDetail = false;
    this.selectedWorkOrder = null;
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
    }).format(amount);
  }

  getDaysOverdue(workOrder: WorkOrder): number {
    if (workOrder.status === 'completada' || workOrder.status === 'cancelada') return 0;

    const scheduledDate = new Date(workOrder.scheduledDate);
    const now = new Date();
    const diffTime = now.getTime() - scheduledDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays > 0 ? diffDays : 0;
  }

  isOverdue(workOrder: WorkOrder): boolean {
    return this.getDaysOverdue(workOrder) > 0;
  }

  getProgressPercentage(workOrder: WorkOrder): number {
    if (workOrder.status === 'completada') return 100;
    if (workOrder.status === 'cancelada') return 0;

    // Simple progress calculation based on status
    const statusProgress: { [key: string]: number } = {
      'pendiente': 0,
      'en-proceso': 50,
      'pausada': 25
    };

    return statusProgress[workOrder.status] || 0;
  }

  onNewWorkOrder(): void {
    // Navigate to create new work order
    this.router.navigate(['/procmodmaintenance/newworkorder']);
  }

  onEditWorkOrder(workOrder: WorkOrder): void {
    console.log('Editar orden de trabajo:', workOrder.id);
  }

  onCompleteWorkOrder(workOrder: WorkOrder): void {
    workOrder.status = 'completada';
    workOrder.completedDate = new Date().toISOString().split('T')[0];
    this.calculateStats();
    console.log('Orden completada:', workOrder.id);
  }

  onCancelWorkOrder(workOrder: WorkOrder): void {
    if (confirm('¿Está seguro de cancelar esta orden de trabajo?')) {
      workOrder.status = 'cancelada';
      this.calculateStats();
      console.log('Orden cancelada:', workOrder.id);
    }
  }
}
