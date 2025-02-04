import { CommonModule } from '@angular/common';
import { Component, effect, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { alerts } from 'app/helpers/alerts';
import { CatalogsService } from 'app/services/catalogs.service';
import { SignalsService } from 'app/services/signals.service';


interface Category {
  id: number;
  idCompany: number;
  description: string;
  parentId: number;
}

@Component({
  selector: 'app-edit-families',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './edit-families.component.html',
  styleUrl: './edit-families.component.scss'
})

export class EditFamiliesComponent implements OnInit {
  parentCategories: Category[] = [];
  childCategories: Category[] = [];
  selectedParentId: number | null = null;
  showAddModal = false;
  currentParentId: number | null = null;
  idCompany: number = null;
  selectedCategory: Category = { id: null, idCompany: this.idCompany, description: '', parentId: null };


  constructor(private catalogsService: CatalogsService, private signalsService: SignalsService) {
    effect(() => {
      this.idCompany = this.signalsService.getRootSelectedBySidebar()();
      this.selectedCategory = { id: null, idCompany: this.idCompany, description: '', parentId: null };
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
    this.catalogsService.getFamilyById(this.idCompany).subscribe({
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
    this.catalogsService.deleteCatalog(id).subscribe(() => {
      if (this.selectedParentId) {
        this.onParentSelect(this.selectedParentId); // Recargar categorías hijas
      } else {
        this.loadParentCategories(); // Recargar categorías padres
      }
    });
  }

  openAddModal(parentId?: number): void {
    this.currentParentId = parentId || null;
    this.selectedCategory = {
      id: 0,
      idCompany: this.idCompany,
      description: '',
      parentId: this.currentParentId
    };
    this.showAddModal = true;
    console.log('Abriendo modal para:', this.currentParentId ? 'Categoría hija' : 'Categoría padre');
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
    // Añadir el campo type basado en si es categoría padre o hija
    const categoryData = {
      ...this.selectedCategory,
      type: this.selectedCategory.parentId ? 'SUBFAMILY' : 'FAMILY'
    };


    this.catalogsService.addCatalog(categoryData).subscribe(() => {
      this.handleModalClose();
      const tipo = this.selectedCategory.parentId ? 'Subfamilia' : 'Familia'
      alerts.basicAlert(tipo, `${tipo} agregada exitosamente`, "success");
    });
  }
}
