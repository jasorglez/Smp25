import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

interface Task {
  id: number;
  description: string;
  completed: boolean;
}

interface Material {
  id: number;
  material: string;
  quantity: string;
  unit: string;
}

interface Attachment {
  id: number;
  name: string;
  size: string;
}

@Component({
  selector: 'app-newworkorder',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './newworkorder.component.html',
  styleUrl: './newworkorder.component.scss'
})
export class NewworkorderComponent implements OnInit {

  formData: any = {
    type: 'preventivo',
    priority: 'media',
    asset: '',
    location: '',
    requestedBy: '',
    assignedTo: '',
    department: '',
    scheduledDate: '',
    estimatedHours: '',
    description: '',
    failureDescription: '',
    observations: ''
  };

  tasks: Task[] = [
    { id: 1, description: '', completed: false }
  ];

  materials: Material[] = [
    { id: 1, material: '', quantity: '', unit: 'pza' }
  ];

  attachments: Attachment[] = [];

  // Options
  assets: string[] = [
    'Torno CNC-01',
    'Compresor CP-12',
    'Montacargas MC-03',
    'Grúa viajera GV-02',
    'Bomba hidráulica BH-05',
    'Sistema HVAC',
    'Prensa hidráulica PH-08'
  ];

  technicians: string[] = [
    'Juan Pérez - Mecánico',
    'María López - Electricista',
    'Carlos Ruiz - Hidráulico',
    'Ana Martínez - Técnico General',
    'Roberto García - Especialista CNC'
  ];

  departments: string[] = [
    'Producción',
    'Mantenimiento',
    'Almacén',
    'Calidad',
    'Logística'
  ];

  constructor(private router: Router) { }

  ngOnInit(): void {
  }

  handleInputChange(event: any): void {
    const { name, value } = event.target;
    this.formData = { ...this.formData, [name]: value };
  }

  addTask(): void {
    this.tasks = [...this.tasks, { id: this.tasks.length + 1, description: '', completed: false }];
  }

  removeTask(id: number): void {
    if (this.tasks.length > 1) {
      this.tasks = this.tasks.filter(task => task.id !== id);
    }
  }

  updateTask(id: number, description: string): void {
    this.tasks = this.tasks.map(task =>
      task.id === id ? { ...task, description } : task
    );
  }

  addMaterial(): void {
    this.materials = [...this.materials, { id: this.materials.length + 1, material: '', quantity: '', unit: 'pza' }];
  }

  removeMaterial(id: number): void {
    if (this.materials.length > 1) {
      this.materials = this.materials.filter(material => material.id !== id);
    }
  }

  updateMaterial(id: number, field: string, value: string): void {
    this.materials = this.materials.map(material =>
      material.id === id ? { ...material, [field]: value } : material
    );
  }

  handleFileUpload(event: any): void {
    const files = Array.from(event.target.files) as File[];
    const newAttachments = files.map((file, idx) => ({
      id: this.attachments.length + idx + 1,
      name: file.name,
      size: (file.size / 1024).toFixed(2) + ' KB'
    }));
    this.attachments = [...this.attachments, ...newAttachments];
  }

  removeAttachment(id: number): void {
    this.attachments = this.attachments.filter(att => att.id !== id);
  }

  handleSubmit(): void {
    console.log('Orden de Trabajo:', { formData: this.formData, tasks: this.tasks, materials: this.materials, attachments: this.attachments });
    alert('Orden de Trabajo creada exitosamente!\n\nEsta es una demostración. Los datos se mostrarían en consola.');
    this.router.navigate(['../workorders'], { relativeTo: this.router.routerState.root });
  }

  handleCancel(): void {
    if (confirm('¿Deseas cancelar? Se perderán los datos no guardados.')) {
      this.router.navigate(['../workorders'], { relativeTo: this.router.routerState.root });
    }
  }
}
