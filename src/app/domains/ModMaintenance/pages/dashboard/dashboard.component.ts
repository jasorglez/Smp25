import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

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

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {

  stats: Stat[] = [
    { label: 'Activos Totales', value: '247', icon: 'box', color: 'blue' },
    { label: 'OT Abiertas', value: '18', icon: 'clipboard-list', color: 'orange' },
    { label: 'Preventivos del Mes', value: '32', icon: 'calendar', color: 'green' },
    { label: 'Disponibilidad', value: '94.2%', icon: 'chart-line', color: 'purple' }
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

  constructor() { }

  ngOnInit(): void {
  }

  getPriorityClass(priority: string): string {
    return priority.toLowerCase();
  }

  getStatusClass(status: string): string {
    return status.toLowerCase().replace(' ', '-');
  }
}
