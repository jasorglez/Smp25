import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { EquipmentService } from 'app/services/equipment.service';
import { SignalsService } from 'app/services/signals.service';

@Component({
  selector: 'app-assets',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './assets.component.html',
  styleUrls: ['./assets.component.scss']
})
export class AssetsComponent implements OnInit {

  private equipmentService = inject(EquipmentService);
  private signalsService = inject(SignalsService);
  private router = inject(Router);

  idcompany: number = 0;
  assets: any[] = [];
  filteredAssets: any[] = [];
  searchTerm: string = '';
  selectedAsset: any = null;
  showAssetDetail: boolean = false;
  loading: boolean = false;

  // Edit/Create modal
  showForm: boolean = false;
  isEditing: boolean = false;
  formData: any = {};

  ngOnInit(): void {
    this.idcompany = this.signalsService.getRootSelectedBySidebar()();
    this.loadEquipments();
  }

  loadEquipments(): void {
    this.loading = true;
    this.equipmentService.getEquipment(this.idcompany).subscribe(
      (data: any) => {
        this.assets = data;
        this.filteredAssets = [...this.assets];
        this.loading = false;
      },
      (error) => {
        console.error('Error fetching equipments:', error);
        this.loading = false;
      }
    );
  }

  filterAssets(): void {
    this.filteredAssets = this.assets.filter(asset => {
      const matchesSearch = !this.searchTerm ||
        (asset.description || '').toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        (asset.measure || '').toLowerCase().includes(this.searchTerm.toLowerCase());
      return matchesSearch;
    });
  }

  onSearchChange(): void {
    this.filterAssets();
  }

  viewAssetDetail(asset: any): void {
    this.selectedAsset = asset;
    this.showAssetDetail = true;
  }

  closeAssetDetail(): void {
    this.showAssetDetail = false;
    this.selectedAsset = null;
  }

  // --- Create / Edit ---
  openCreateForm(): void {
    this.isEditing = false;
    this.formData = {
      id_company: this.idcompany,
      description: '',
      measure: 'DIA',
      quantity: 1,
      costMN: 0,
      costDLL: 0,
      priceMN: 0,
      priceDLL: 0,
      dayswork: 8,
      imprimir: true,
      charged: true,
      active: true
    };
    this.showForm = true;
  }

  openEditForm(asset: any, event?: Event): void {
    if (event) event.stopPropagation();
    this.isEditing = true;
    this.formData = { ...asset };
    this.showForm = true;
    this.closeAssetDetail();
  }

  closeForm(): void {
    this.showForm = false;
    this.formData = {};
  }

  saveAsset(): void {
    if (!this.formData.description) return;

    if (this.isEditing) {
      this.equipmentService.updateEquipment(this.formData.id, this.formData).subscribe({
        next: () => {
          this.closeForm();
          this.loadEquipments();
        },
        error: (err) => console.error('Error updating equipment:', err)
      });
    } else {
      this.equipmentService.addEquipment(this.formData).subscribe({
        next: () => {
          this.closeForm();
          this.loadEquipments();
        },
        error: (err) => console.error('Error creating equipment:', err)
      });
    }
  }

  deleteAsset(asset: any, event?: Event): void {
    if (event) event.stopPropagation();
    if (!confirm('Eliminar "' + asset.description + '"?')) return;
    this.equipmentService.deleteEquipment(asset.id).subscribe({
      next: () => {
        this.closeAssetDetail();
        this.loadEquipments();
      },
      error: (err) => console.error('Error deleting equipment:', err)
    });
  }

  getStatusClass(asset: any): string {
    return asset.active ? 'status-operational' : 'status-out-of-service';
  }

  getStatusText(asset: any): string {
    return asset.active ? 'Operativo' : 'Fuera de Servicio';
  }

  getOperationalCount(): number {
    return this.assets.filter(a => a.active).length;
  }

  getInactiveCount(): number {
    return this.assets.filter(a => !a.active).length;
  }
}
