import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface Report {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
}

@Component({
  selector: 'app-reportes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reportes.component.html',
  styleUrl: './reportes.component.scss'
})
export class ReportesComponent implements OnInit {

  reports: Report[] = [
    {
      id: 'REP-001',
      name: 'Informe de Activos',
      description: 'Catálogo completo de activos con estado y ubicación',
      icon: 'fas fa-cogs',
      category: 'Activos'
    },
    {
      id: 'REP-002',
      name: 'Órdenes de Trabajo',
      description: 'Historial completo de órdenes de trabajo por período',
      icon: 'fas fa-clipboard-list',
      category: 'Mantenimiento'
    },
    {
      id: 'REP-003',
      name: 'Costos de Mantenimiento',
      description: 'Análisis de costos por tipo de mantenimiento y período',
      icon: 'fas fa-dollar-sign',
      category: 'Financiero'
    },
    {
      id: 'REP-004',
      name: 'Disponibilidad de Equipos',
      description: 'Tiempo de actividad y downtime por equipo',
      icon: 'fas fa-chart-line',
      category: 'Operativo'
    },
    {
      id: 'REP-005',
      name: 'Mantenimiento Preventivo',
      description: 'Calendario y cumplimiento de mantenimientos preventivos',
      icon: 'fas fa-calendar-check',
      category: 'Mantenimiento'
    },
    {
      id: 'REP-006',
      name: 'Eficiencia de Técnicos',
      description: 'Productividad y tiempos de respuesta por técnico',
      icon: 'fas fa-users',
      category: 'Recursos Humanos'
    }
  ];

  categories: string[] = ['Todos', 'Activos', 'Mantenimiento', 'Financiero', 'Operativo', 'Recursos Humanos'];
  selectedCategory: string = 'Todos';

  constructor() { }

  ngOnInit(): void {
  }

  getFilteredReports(): Report[] {
    if (this.selectedCategory === 'Todos') {
      return this.reports;
    }
    return this.reports.filter(report => report.category === this.selectedCategory);
  }

  generateReport(reportId: string): void {
    const report = this.reports.find(r => r.id === reportId);
    alert(`Generando reporte: ${report?.name}\n\nEsta es una demostración. El reporte se descargaría en formato PDF/Excel.`);
  }

  exportReport(reportId: string, format: string): void {
    const report = this.reports.find(r => r.id === reportId);
    alert(`Exportando reporte: ${report?.name}\nFormato: ${format}\n\nEsta es una demostración.`);
  }
}
