import { Component, effect, inject, OnInit } from '@angular/core';
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
  idBranch: number = 0;
  assets: any[] = [];
  filteredAssets: any[] = [];
  searchTerm: string = '';
  selectedAsset: any = null;
  showAssetDetail: boolean = false;
  loading: boolean = false;
  private initialized: boolean = false;
  private lastBranchId: number = 0;

  // Edit/Create modal
  showForm: boolean = false;
  isEditing: boolean = false;
  formData: any = {};

  constructor() {
    effect(() => {
      this.updateContext();
      if (!this.initialized) {
        return;
      }

      if (this.idBranch !== this.lastBranchId) {
        this.lastBranchId = this.idBranch;
        this.loadEquipments();
      }
    });
  }

  ngOnInit(): void {
    this.updateContext();
    this.lastBranchId = this.idBranch;
    this.initialized = true;
    this.loadEquipments();
  }

  loadEquipments(): void {
    if (!this.hasValidContext()) {
      this.assets = [];
      this.filteredAssets = [];
      this.loading = false;
      return;
    }

    this.loading = true;
    this.equipmentService.getEquipmentByBranch(this.idBranch).subscribe(
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
    if (!this.canCreateByBranch()) {
      return;
    }

    this.isEditing = false;
    this.formData = {
      idCompany: this.idcompany,
      idBranch: this.idBranch,
      id_company: this.idcompany,
      id_branch: this.idBranch,
      description: '',
      measure: 'DIA',
      quantity: 1,
      costMN: 0,
      costDLL: 0,
      priceMN: 0,
      priceDLL: 0,
      dayswork: 8,
      daysWork: 8,
      imprimir: true,
      charged: true,
      active: true
    };
    this.showForm = true;
  }

  openEditForm(asset: any, event?: Event): void {
    if (event) event.stopPropagation();
    this.isEditing = true;
    const normalizedDaysWork = asset?.daysWork ?? asset?.dayswork ?? 0;
    this.formData = {
      ...asset,
      dayswork: normalizedDaysWork,
      daysWork: normalizedDaysWork
    };
    this.showForm = true;
    this.closeAssetDetail();
  }

  closeForm(): void {
    this.showForm = false;
    this.formData = {};
  }

  saveAsset(): void {
    if (!this.formData.description || !this.hasValidContext()) return;

    const payload = {
      ...this.formData,
      dayswork: this.formData.daysWork ?? this.formData.dayswork ?? 0,
      daysWork: this.formData.daysWork ?? this.formData.dayswork ?? 0,
      active: true,
      idCompany: this.idcompany,
      idBranch: this.idBranch,
      id_company: this.idcompany,
      id_branch: this.idBranch
    };

    if (this.isEditing) {
      this.equipmentService.updateEquipmentFromAssets(this.formData.id, payload).subscribe({
        next: () => {
          this.closeForm();
          this.loadEquipments();
        },
        error: (err) => console.error('Error updating equipment:', err)
      });
    } else {
      this.equipmentService.addEquipmentFromAssets(payload).subscribe({
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

  private updateContext(): void {
    const signalCompany = this.signalsService.getRootSelectedBySidebar()();
    if (signalCompany !== null && signalCompany !== undefined) {
      this.idcompany = Number(signalCompany);
    } else {
      const companyStorage = localStorage.getItem('company');
      if (companyStorage) {
        const parsed = Number(companyStorage);
        if (!Number.isNaN(parsed)) {
          this.idcompany = parsed;
        }
      }
    }

    const signalBranch = this.signalsService.getBranchSelectedBySidebar()();
    this.idBranch = signalBranch !== null && signalBranch !== undefined ? Number(signalBranch) : 0;
  }

  private hasValidContext(): boolean {
    const hasCompany = this.idcompany !== null && this.idcompany !== undefined && !Number.isNaN(Number(this.idcompany));
    const hasBranch = this.idBranch !== null && this.idBranch !== undefined && !Number.isNaN(Number(this.idBranch)) && Number(this.idBranch) > 0;
    return hasCompany && hasBranch;
  }

  canCreateByBranch(): boolean {
    return this.idBranch > 0;
  }
}
