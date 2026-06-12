import { Component, effect, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { EquipmentService } from 'app/services/equipment.service';
import { SignalsService } from 'app/services/signals.service';
import { TrackingService } from 'app/services/tracking.service';

@Component({
  selector: 'app-newasset',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './newasset.component.html',
  styleUrl: './newasset.component.scss'
})
export class NewassetComponent implements OnInit {
  private router = inject(Router);
  private equipmentService = inject(EquipmentService);
  private signalsService = inject(SignalsService);
  private trackingService = inject(TrackingService);
  idcompany: number = 0;
  idBranch: number = 0;
  saving: boolean = false;

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

  constructor() {
    effect(() => {
      const company = this.signalsService.getRootSelectedBySidebar()();
      if (company !== null && company !== undefined) {
        this.idcompany = Number(company);
      } else {
        const companyStorage = localStorage.getItem('company');
        const parsedCompany = Number(companyStorage);
        if (!Number.isNaN(parsedCompany)) {
          this.idcompany = parsedCompany;
        }
      }

      const branch = this.signalsService.getBranchSelectedBySidebar()();
      this.idBranch = branch !== null && branch !== undefined ? Number(branch) : 0;
    });
  }

  ngOnInit(): void {
    const company = this.signalsService.getRootSelectedBySidebar()();
    if (company !== null && company !== undefined) {
      this.idcompany = Number(company);
    } else {
      const companyStorage = localStorage.getItem('company');
      const parsedCompany = Number(companyStorage);
      if (!Number.isNaN(parsedCompany)) {
        this.idcompany = parsedCompany;
      }
    }

    const branch = this.signalsService.getBranchSelectedBySidebar()();
    this.idBranch = branch !== null && branch !== undefined ? Number(branch) : 0;

    this.trackingService.addLog(
      String(this.idcompany),
      'Acceso a Nuevo Activo',
      'ModMaintenance/NewAsset',
      ''
    );
  }

  handleInputChange(event: any): void {
    const { name, value } = event.target;
    this.formData = { ...this.formData, [name]: value };
  }

  handleSubmit(): void {
    if (Number(this.idBranch) <= 0 || Number.isNaN(this.idBranch)) {
      alert('No hay sucursal activa. Selecciona una sucursal e intenta de nuevo.');
      return;
    }

    const purchaseCost = Number(this.formData.purchaseCost) || 0;
    const description = (this.formData.name || this.formData.description || '').trim();
    if (!description) {
      alert('El nombre del activo es requerido.');
      return;
    }

    const payload: any = {
      idCompany: this.idcompany,
      idBranch: this.idBranch,
      id_company: this.idcompany,
      id_branch: this.idBranch,
      description,
      measure: 'PZA',
      quantity: 1,
      dayswork: 8,
      costMN: purchaseCost,
      costDLL: 0,
      priceMN: purchaseCost,
      priceDLL: 0,
      charged: true,
      imprimir: true,
      active: this.formData.status !== 'fuera-de-servicio' && this.formData.status !== 'obsoleto'
    };

    this.saving = true;
    this.equipmentService.addEquipmentFromAssets(payload).subscribe({
      next: () => {
        this.trackingService.addLog(
          String(this.idcompany),
          `Activo creado: ${description}`,
          'ModMaintenance/NewAsset',
          ''
        );
        this.saving = false;
        alert('Activo creado exitosamente.');
        this.router.navigate(['/procmodmaintenance/assets']);
      },
      error: (error) => {
        console.error('Error creating asset:', error);
        this.saving = false;
        alert('No fue posible crear el activo.');
      }
    });
  }

  handleCancel(): void {
    if (confirm('¿Deseas cancelar? Se perderán los datos no guardados.')) {
      this.router.navigate(['/procmodmaintenance/assets']);
    }
  }

  canCreateByBranch(): boolean {
    return this.idBranch > 0;
  }
}
