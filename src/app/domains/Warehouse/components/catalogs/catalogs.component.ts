import { CommonModule } from '@angular/common';
import { Component, effect, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { alerts } from 'app/helpers/alerts';
import { CatalogsService } from 'app/services/catalogs.service';
import { SignalsService } from 'app/services/signals.service';
import { Icatalog } from 'app/interface/icatalog';
import { NgSelectModule } from '@ng-select/ng-select';

@Component({
  selector: 'app-catalogs',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, NgSelectModule],
  templateUrl: './catalogs.component.html',
  styleUrl: './catalogs.component.scss'
})

export class EditFamiliesComponent implements OnInit {
  parentCategories: Icatalog[] = [];
  childCategories: Icatalog[] = [];
  selectedParentId: number | null = null;
  showAddModal = false;
  currentParentId: number | null = null;
  idCompany: number = null;
  selectedType: string = null;
  selectedCategory: Icatalog = { id: null, idCompany: this.idCompany, description: '', parentId: null, type: null, active: 1 };

  private catalogsService = inject(CatalogsService);
  private signalsService = inject(SignalsService);

  types = [
    { name: 'Anexos', value: 'ANEXOS' },
    { name: 'Áreas', value: 'AREA' },
    { name: 'Marca', value: 'BRAND' },
    { name: 'Causa', value: 'CAUSE' },
    { name: 'Convenio', value: 'CONVENTION' },
    { name: 'Moneda', value: 'CURRENCY' },
    { name: 'Departamento', value: 'DEPARTAMENT' },
    { name: 'Depósito', value: 'DEPOSIT' },
    { name: 'Familia', value: 'FAMILY' }, 
    { name: 'Fase', value: 'FASE' },
    { name: 'Entrada', value: 'INPUT' },
    { name: 'Medida', value: 'MEASURE' },
    { name: 'Salida', value: 'OUTPUT' },
    { name: 'Método de pago', value: 'PAY' },
    { name: 'Posición', value: 'POSITION' },
    { name: 'Tipo de cambio', value: 'TYPECURRENCY' },
    { name: 'Tipo de documento', value: 'TYPEDOCUMENT' },
    { name: 'Tipo de orden', value: 'TYPEORDER' },
    { name: 'Tipo de trabajo', value: 'TYPEWORK' },
    { name: 'Ubicación', value: 'UBICATION' }
  ];

  constructor() {
    effect(() => {
      this.idCompany = this.signalsService.getRootSelectedBySidebar()();
      this.selectedCategory = { id: null, idCompany: this.idCompany, description: '', parentId: null, type: null, active: 1 };
      this.childCategories = [];
      this.selectedParentId = null;
      this.loadParentCategories();
    });
  }

  ngOnInit(): void {
    this.idCompany = this.signalsService.getRootSelectedBySidebar()();
    this.loadParentCategories();
  }

  loadParentCategories(): void {
    this.catalogsService.getCatalogs(this.idCompany, this.selectedType).subscribe({
      next: (data) => {
        this.parentCategories = data || [];
        console.log('Categorías padres recibidas:', this.parentCategories);
      },
      error: (err) => {
        console.error('Error al obtener familias:', err);
        this.parentCategories = [];
      }
    });
  }

  onParentSelect(parentId: number): void {
    this.selectedParentId = parentId;
    this.catalogsService.getSubfamiliesByParentId(parentId).subscribe({
      next: (data) => {
        this.childCategories = data || [];
        console.log('Categorías hijas recibidas:', this.childCategories);
      },
      error: (err) => {
        console.error('Error al obtener subfamilias:', err);
        this.childCategories = [];
      }
    });
  }

  deleteCategory(id: number): void {
    alerts.confirmAlert(
        'Eliminar categoría',
        '¿Estás seguro de eliminar esta categoría?',
        'warning',
        'Sí, eliminar'
    ).then((result) => {
        if (result.isConfirmed) {
            this.catalogsService.deleteCatalog(id).subscribe(() => {
                if (this.selectedParentId) {
                    this.onParentSelect(this.selectedParentId);
                } else {
                    this.loadParentCategories();
                }
                alerts.basicAlert('Categorías', `Categoría eliminada exitosamente`, "success");
            });
        }
    });
  }

  openAddModal(parentId?: number): void {
    this.currentParentId = parentId || null;
    this.selectedCategory = {
      id: 0,
      idCompany: this.idCompany,
      description: '',
      parentId: this.currentParentId,
      type: null,
      active: 1
    };
    this.showAddModal = true;
  }

  handleModalClose(): void {
    this.showAddModal = false;
    if (this.currentParentId) {
      this.onParentSelect(this.currentParentId);
    } else {
      this.loadParentCategories();
    }
  }

  onSubmit(): void {
    // Determinar el tipo basado en si es una subcategoría
    const finalType = this.currentParentId > 0 ? 'SUBFAMILY' : this.selectedType;
    
    const categoryData = {
      ...this.selectedCategory,
      type: finalType
    };

    console.log('Enviando datos al servidor:', categoryData);

    this.catalogsService.addCatalog(categoryData).subscribe(() => {
      this.handleModalClose();
      alerts.basicAlert('Categorías', `Categoría agregada exitosamente`, "success");
    });
  }

  onTypeChange(): void {
    this.selectedParentId = null;
    this.childCategories = [];
    this.loadParentCategories();
  }
}
