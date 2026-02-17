import { Component, effect, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { EquipmentService } from 'app/services/equipment.service';
import { SignalsService } from 'app/services/signals.service';
import { MaintenanceCatalogService } from 'app/services/maintenance-catalog.service';
import { TrackingService } from 'app/services/tracking.service';

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
  private catalogService = inject(MaintenanceCatalogService);
  private trackingService = inject(TrackingService);

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

  // Measures loaded from catalog (MEASURE type)
  measures: any[] = [];

  // Asset types loaded from catalog (ASSET_TYPE type)
  assetTypes: any[] = [];

  // Pagination
  pageSize: number = 9;
  currentPage: number = 1;
  Math = Math;

  get totalPages(): number {
    return Math.ceil(this.filteredAssets.length / this.pageSize);
  }

  get paginatedAssets(): any[] {
    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;
    return this.filteredAssets.slice(start, end);
  }

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
    this.trackingService.addLog(
      String(this.idcompany),
      'Acceso a Activos de Mantenimiento',
      'ModMaintenance/Assets',
      ''
    );
  }

  loadEquipments(): void {
    if (!this.hasValidContext()) {
      this.assets = [];
      this.filteredAssets = [];
      this.loading = false;
      return;
    }

    this.loading = true;

    // Load catalogs
    if (this.idcompany > 0) {
      this.catalogService.getByCompanyAndType(this.idcompany, 'MEASURE').subscribe({
        next: (data) => {
          this.measures = data;
        },
        error: (err) => {
          console.error('Error loading measures catalog:', err);
          this.measures = [];
        }
      });

      this.catalogService.getByCompanyAndType(this.idcompany, 'ASSET_TYPE').subscribe({
        next: (data) => {
          this.assetTypes = data;
        },
        error: (err) => {
          console.error('Error loading asset types catalog:', err);
          this.assetTypes = [];
        }
      });
    }

    this.equipmentService.getEquipmentByBranch(this.idBranch).subscribe(
      (data: any) => {
        this.assets = data;
        this.filteredAssets = [...this.assets];
        this.currentPage = 1;
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
        (asset.measure || '').toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        (asset.assetType || '').toLowerCase().includes(this.searchTerm.toLowerCase());
      return matchesSearch;
    });
    this.currentPage = 1; // Reset to first page on filter
  }

  onSearchChange(): void {
    this.filterAssets();
  }

  // Pagination methods
  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  getPageNumbers(): number[] {
    const pages: number[] = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(this.totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    return pages;
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
      assetType: '',
      measure: '',
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
          this.trackingService.addLog(
            String(this.idcompany),
            `Activo actualizado: ${payload.description}`,
            'ModMaintenance/Assets',
            ''
          );
          this.closeForm();
          this.loadEquipments();
        },
        error: (err) => console.error('Error updating equipment:', err)
      });
    } else {
      this.equipmentService.addEquipmentFromAssets(payload).subscribe({
        next: () => {
          this.trackingService.addLog(
            String(this.idcompany),
            `Activo creado: ${payload.description}`,
            'ModMaintenance/Assets',
            ''
          );
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
        this.trackingService.addLog(
          String(this.idcompany),
          `Activo eliminado: ${asset.description}`,
          'ModMaintenance/Assets',
          ''
        );
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
