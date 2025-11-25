import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DomainsModule } from 'app/domains/domainsmodule';

interface Stat {
  label: string;
  value: string;
  icon: string;
  color: string;
}

interface WorkOrder {
  id: string;
  asset: string;
  type: string;
  priority: string;
  status: string;
  technician: string;
}

interface UpcomingMaintenance {
  asset: string;
  date: string;
  type: string;
  hours: string;
}

interface Asset {
  id: string;
  name: string;
  category: string;
  location: string;
  status: string;
  lastMaint: string;
}

@Component({
  selector: 'app-procmodmaintenance',
  standalone: true,
  imports: [RouterModule, FormsModule, DomainsModule],
  templateUrl: './procmodmaintenance.component.html',
  styleUrl: './procmodmaintenance.component.scss'
})
export class ProcmodmaintenanceComponent implements OnInit {

  activeView: string = 'dashboard';

  stats: Stat[] = [
    { label: 'Activos Totales', value: '247', icon: 'package', color: 'blue' },
    { label: 'OT Abiertas', value: '18', icon: 'clipboard-list', color: 'orange' },
    { label: 'Preventivos del Mes', value: '32', icon: 'calendar', color: 'green' },
    { label: 'Disponibilidad', value: '94.2%', icon: 'trending-up', color: 'purple' }
  ];

  recentOrders: WorkOrder[] = [
    {
      id: 'OT-2024-156',
      asset: 'Montacargas MC-03',
      type: 'Preventivo',
      priority: 'Media',
      status: 'En Proceso',
      technician: 'Juan Pérez'
    },
    {
      id: 'OT-2024-157',
      asset: 'Compresor CP-12',
      type: 'Correctivo',
      priority: 'Urgente',
      status: 'Pendiente',
      technician: 'María López'
    },
    {
      id: 'OT-2024-158',
      asset: 'Bomba hidráulica BH-05',
      type: 'Preventivo',
      priority: 'Baja',
      status: 'Completada',
      technician: 'Carlos Ruiz'
    }
  ];

  upcomingMaintenance: UpcomingMaintenance[] = [
    { asset: 'Torno CNC-01', date: '2025-11-28', type: 'Preventivo', hours: '500h' },
    { asset: 'Grúa viajera GV-02', date: '2025-11-30', type: 'Inspección', hours: '1000h' },
    { asset: 'Sistema HVAC', date: '2025-12-02', type: 'Preventivo', hours: 'Mensual' }
  ];

  assets: Asset[] = [
    {
      id: 'ACT-001',
      name: 'Torno CNC-01',
      category: 'Maquinaria',
      location: 'Producción A',
      status: 'Operativo',
      lastMaint: '2025-10-15'
    },
    {
      id: 'ACT-002',
      name: 'Compresor CP-12',
      category: 'Equipo',
      location: 'Planta Baja',
      status: 'En Mantenimiento',
      lastMaint: '2025-11-20'
    },
    {
      id: 'ACT-003',
      name: 'Montacargas MC-03',
      category: 'Vehículo',
      location: 'Almacén',
      status: 'Operativo',
      lastMaint: '2025-11-10'
    }
  ];

  searchTerm: string = '';
  selectedStatus: string = 'todos';

  constructor() { }

  ngOnInit(): void {
    this.getCurrentDate();
  }

  setActiveView(view: string): void {
    this.activeView = view;
  }

  getCurrentDate(): string {
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    };
    return new Date().toLocaleDateString('es-ES', options);
  }

  getPriorityClass(priority: string): string {
    const classes: { [key: string]: string } = {
      'Urgente': 'bg-red-100 text-red-700',
      'Alta': 'bg-orange-100 text-orange-700',
      'Media': 'bg-yellow-100 text-yellow-700',
      'Baja': 'bg-green-100 text-green-700'
    };
    return classes[priority] || 'bg-gray-100 text-gray-700';
  }

  getStatusClass(status: string): string {
    const classes: { [key: string]: string } = {
      'Completada': 'bg-green-100 text-green-700',
      'En Proceso': 'bg-blue-100 text-blue-700',
      'Pendiente': 'bg-gray-100 text-gray-700',
      'Operativo': 'bg-green-100 text-green-700',
      'En Mantenimiento': 'bg-yellow-100 text-yellow-700'
    };
    return classes[status] || 'bg-gray-100 text-gray-700';
  }

  onViewDetails(id: string): void {
    console.log('Ver detalles de:', id);
    // Aquí iría la navegación o apertura de modal
  }

  onEditOrder(id: string): void {
    console.log('Editar orden:', id);
    // Aquí iría la navegación al formulario de edición
  }

  onViewAsset(id: string): void {
    console.log('Ver activo:', id);
  }

  onViewHistory(id: string): void {
    console.log('Ver historial de:', id);
  }

  onNewOrder(): void {
    console.log('Nueva orden de trabajo');
    // Aquí iría la navegación al formulario de nueva orden
  }

  onNewAsset(): void {
    console.log('Nuevo activo');
    // Aquí iría la navegación al formulario de nuevo activo
  }

  filterOrders(): WorkOrder[] {
    let filtered = this.recentOrders;

    if (this.searchTerm) {
      filtered = filtered.filter(order =>
        order.id.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        order.asset.toLowerCase().includes(this.searchTerm.toLowerCase())
      );
    }

    if (this.selectedStatus !== 'todos') {
      filtered = filtered.filter(order =>
        order.status.toLowerCase() === this.selectedStatus.toLowerCase()
      );
    }

    return filtered;
  }
}
