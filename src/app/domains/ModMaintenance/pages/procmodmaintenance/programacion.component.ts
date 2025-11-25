import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

interface Programacion {
  id: number;
  equipo: string;
  fechaProgramada: string;
  tipoMantenimiento: 'Preventivo' | 'Correctivo' | 'Predictivo';
  estado: 'Programado' | 'En Progreso' | 'Completado' | 'Cancelado';
}

@Component({
  selector: 'app-programacion',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './programacion.component.html',
  styleUrl: './programacion.component.css'
})
export class ProgramacionComponent {

  programaciones: Programacion[] = [
    { id: 1, equipo: 'Torno CNC-01', fechaProgramada: '2024-08-01', tipoMantenimiento: 'Preventivo', estado: 'Programado' },
    { id: 2, equipo: 'Fresadora Universal', fechaProgramada: '2024-07-25', tipoMantenimiento: 'Correctivo', estado: 'Completado' },
    { id: 3, equipo: 'Compresor de Aire P-10', fechaProgramada: '2024-08-05', tipoMantenimiento: 'Predictivo', estado: 'Programado' },
    { id: 4, equipo: 'Montacargas E-03', fechaProgramada: '2024-07-28', tipoMantenimiento: 'Preventivo', estado: 'En Progreso' },
    { id: 5, equipo: 'Robot de Soldadura R-5', fechaProgramada: '2024-07-20', tipoMantenimiento: 'Preventivo', estado: 'Completado' },
    { id: 6, equipo: 'Torno CNC-02', fechaProgramada: '2024-08-10', tipoMantenimiento: 'Preventivo', estado: 'Programado' },
  ];

  constructor() { }

  nuevaProgramacion() {
    // Lógica para abrir un modal o navegar a una nueva página para crear una programación
    console.log('Iniciando nueva programación...');
  }
}