import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-newasset',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './newasset.component.html',
  styleUrl: './newasset.component.scss'
})
export class NewassetComponent implements OnInit {

  formData: any = {
    name: '',
    category: '',
    location: '',
    description: '',
    manufacturer: '',
    model: '',
    serialNumber: '',
    purchaseDate: '',
    purchaseCost: '',
    warrantyExpiration: '',
    status: 'operativo',
    notes: ''
  };

  categories: string[] = [
    'Maquinaria',
    'Equipo',
    'Vehículo',
    'Herramienta',
    'Instalación',
    'Otro'
  ];

  locations: string[] = [
    'Producción A',
    'Producción B',
    'Almacén Principal',
    'Planta Baja',
    'Oficina',
    'Exterior'
  ];

  statuses: { value: string, label: string }[] = [
    { value: 'operativo', label: 'Operativo' },
    { value: 'en-mantenimiento', label: 'En Mantenimiento' },
    { value: 'fuera-de-servicio', label: 'Fuera de Servicio' },
    { value: 'obsoleto', label: 'Obsoleto' }
  ];

  constructor(private router: Router) { }

  ngOnInit(): void {
  }

  handleInputChange(event: any): void {
    const { name, value } = event.target;
    this.formData = { ...this.formData, [name]: value };
  }

  handleSubmit(): void {
    console.log('Nuevo Activo:', this.formData);
    alert('Activo creado exitosamente!\n\nEsta es una demostración. Los datos se mostrarían en consola.');
    this.router.navigate(['/procmodmaintenance/assets']);
  }

  handleCancel(): void {
    if (confirm('¿Deseas cancelar? Se perderán los datos no guardados.')) {
      this.router.navigate(['/procmodmaintenance/assets']);
    }
  }
}
