import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

interface Team {
  id: string;
  name: string;
  leader: string;
  members: string[];
  specialty: string;
  status: string;
}

@Component({
  selector: 'app-equipos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './equipos.component.html',
  styleUrl: './equipos.component.scss'
})
export class EquiposComponent implements OnInit {

  teams: Team[] = [
    {
      id: 'EQ-001',
      name: 'Equipo Eléctrico',
      leader: 'María López',
      members: ['Carlos Ruiz', 'Ana Martínez'],
      specialty: 'Electricidad',
      status: 'Activo'
    },
    {
      id: 'EQ-002',
      name: 'Equipo Mecánico',
      leader: 'Juan Pérez',
      members: ['Roberto García', 'Luis Hernández'],
      specialty: 'Mecánica',
      status: 'Activo'
    }
  ];

  showForm: boolean = false;
  formData: any = {
    name: '',
    leader: '',
    members: [''],
    specialty: '',
    status: 'Activo'
  };

  specialties: string[] = [
    'Electricidad',
    'Mecánica',
    'Hidráulica',
    'Neumática',
    'Soldadura',
    'Pintura',
    'General'
  ];

  technicians: string[] = [
    'Juan Pérez - Mecánico',
    'María López - Electricista',
    'Carlos Ruiz - Hidráulico',
    'Ana Martínez - Técnico General',
    'Roberto García - Especialista CNC',
    'Luis Hernández - Soldador'
  ];

  constructor(private router: Router) { }

  ngOnInit(): void {
  }

  toggleForm(): void {
    this.showForm = !this.showForm;
    if (!this.showForm) {
      this.resetForm();
    }
  }

  addMember(): void {
    this.formData.members.push('');
  }

  removeMember(index: number): void {
    if (this.formData.members.length > 1) {
      this.formData.members.splice(index, 1);
    }
  }

  handleSubmit(): void {
    console.log('Nuevo Equipo:', this.formData);
    alert('Equipo creado exitosamente!\n\nEsta es una demostración. Los datos se mostrarían en consola.');
    this.toggleForm();
    this.resetForm();
  }

  resetForm(): void {
    this.formData = {
      name: '',
      leader: '',
      members: [''],
      specialty: '',
      status: 'Activo'
    };
  }

  getStatusClass(status: string): string {
    return status === 'Activo' ? 'status-active' : 'status-inactive';
  }
}
