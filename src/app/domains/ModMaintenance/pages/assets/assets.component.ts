import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

interface Asset {
  id: string;
  name: string;
  category: string;
  location: string;
  status: string;
  lastMaintenance: string;
  nextMaintenance: string;
  criticality: string;
  purchaseDate: string;
  purchaseValue: number;
  currentValue: number;
  manufacturer: string;
  model: string;
  serialNumber: string;
  description: string;
  imageUrl: string;
  qrCode: string;
}

@Component({
  selector: 'app-assets',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './assets.component.html',
  styleUrls: ['./assets.component.scss']
})
export class AssetsComponent implements OnInit {

  assets: Asset[] = [
    {
      id: 'ACT-001',
      name: 'Torno CNC-01',
      category: 'Maquinaria Industrial',
      location: 'Planta de Producción A',
      status: 'Operativo',
      lastMaintenance: '2025-10-15',
      nextMaintenance: '2025-12-15',
      criticality: 'Alta',
      purchaseDate: '2020-03-15',
      purchaseValue: 250000,
      currentValue: 180000,
      manufacturer: 'Mazak',
      model: 'QT-250',
      serialNumber: 'MZ20200315001',
      description: 'Torno CNC de alta precisión para mecanizado de piezas metálicas',
      imageUrl: '/assets/img/cnc-lathe.jpg',
      qrCode: 'QR-ACT-001'
    },
    {
      id: 'ACT-002',
      name: 'Compresor CP-12',
      category: 'Equipos de Aire Comprimido',
      location: 'Sala de Compresores',
      status: 'En Mantenimiento',
      lastMaintenance: '2025-11-20',
      nextMaintenance: '2026-02-20',
      criticality: 'Media',
      purchaseDate: '2019-08-10',
      purchaseValue: 85000,
      currentValue: 65000,
      manufacturer: 'Atlas Copco',
      model: 'GA-15',
      serialNumber: 'AC20190810001',
      description: 'Compresor de aire industrial con motor eléctrico',
      imageUrl: '/assets/img/compressor.jpg',
      qrCode: 'QR-ACT-002'
    },
    {
      id: 'ACT-003',
      name: 'Montacargas MC-03',
      category: 'Vehículos Industriales',
      location: 'Área de Almacén',
      status: 'Operativo',
      lastMaintenance: '2025-11-10',
      nextMaintenance: '2026-01-10',
      criticality: 'Alta',
      purchaseDate: '2021-05-20',
      purchaseValue: 120000,
      currentValue: 95000,
      manufacturer: 'Toyota',
      model: '7FBRU25',
      serialNumber: 'TY20210520001',
      description: 'Montacargas eléctrico con capacidad de 2.5 toneladas',
      imageUrl: '/assets/img/forklift.jpg',
      qrCode: 'QR-ACT-003'
    },
    {
      id: 'ACT-004',
      name: 'Sistema HVAC Principal',
      category: 'Sistemas de Climatización',
      location: 'Techo Edificio Principal',
      status: 'Operativo',
      lastMaintenance: '2025-09-30',
      nextMaintenance: '2025-12-30',
      criticality: 'Crítica',
      purchaseDate: '2018-11-15',
      purchaseValue: 180000,
      currentValue: 120000,
      manufacturer: 'Carrier',
      model: '30XA-150',
      serialNumber: 'CR20181115001',
      description: 'Sistema de climatización central con capacidad de 150 TR',
      imageUrl: '/assets/img/hvac.jpg',
      qrCode: 'QR-ACT-004'
    },
    {
      id: 'ACT-005',
      name: 'Prensa Hidráulica PH-08',
      category: 'Maquinaria Industrial',
      location: 'Área de Prensas',
      status: 'Fuera de Servicio',
      lastMaintenance: '2025-08-25',
      nextMaintenance: '2026-02-25',
      criticality: 'Alta',
      purchaseDate: '2017-12-01',
      purchaseValue: 95000,
      currentValue: 55000,
      manufacturer: 'Schuler',
      model: 'PH-80',
      serialNumber: 'SC20171201001',
      description: 'Prensa hidráulica de 80 toneladas para conformado de metales',
      imageUrl: '/assets/img/hydraulic-press.jpg',
      qrCode: 'QR-ACT-005'
    }
  ];

  filteredAssets: Asset[] = [];
  searchTerm: string = '';
  selectedCategory: string = '';
  selectedStatus: string = '';
  selectedCriticality: string = '';
  selectedAsset: Asset | null = null;
  showAssetDetail: boolean = false;

  categories: string[] = ['Todas', 'Maquinaria Industrial', 'Equipos de Aire Comprimido', 'Vehículos Industriales', 'Sistemas de Climatización', 'Equipos de Oficina'];
  statuses: string[] = ['Todos', 'Operativo', 'En Mantenimiento', 'Fuera de Servicio', 'En Reparación'];
  criticalities: string[] = ['Todas', 'Crítica', 'Alta', 'Media', 'Baja'];

  constructor(private router: Router) { }

  ngOnInit(): void {
    this.filteredAssets = [...this.assets];
  }

  filterAssets(): void {
    this.filteredAssets = this.assets.filter(asset => {
      const matchesSearch = !this.searchTerm ||
        asset.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        asset.id.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        asset.location.toLowerCase().includes(this.searchTerm.toLowerCase());

      const matchesCategory = !this.selectedCategory || this.selectedCategory === 'Todas' ||
        asset.category === this.selectedCategory;

      const matchesStatus = !this.selectedStatus || this.selectedStatus === 'Todos' ||
        asset.status === this.selectedStatus;

      const matchesCriticality = !this.selectedCriticality || this.selectedCriticality === 'Todas' ||
        asset.criticality === this.selectedCriticality;

      return matchesSearch && matchesCategory && matchesStatus && matchesCriticality;
    });
  }

  onSearchChange(): void {
    this.filterAssets();
  }

  onFilterChange(): void {
    this.filterAssets();
  }

  viewAssetDetail(asset: Asset): void {
    this.selectedAsset = asset;
    this.showAssetDetail = true;
  }

  closeAssetDetail(): void {
    this.showAssetDetail = false;
    this.selectedAsset = null;
  }

  getStatusClass(status: string): string {
    const classes: { [key: string]: string } = {
      'Operativo': 'status-operational',
      'En Mantenimiento': 'status-maintenance',
      'Fuera de Servicio': 'status-out-of-service',
      'En Reparación': 'status-repair'
    };
    return classes[status] || 'status-unknown';
  }

  getCriticalityClass(criticality: string): string {
    const classes: { [key: string]: string } = {
      'Crítica': 'criticality-critical',
      'Alta': 'criticality-high',
      'Media': 'criticality-medium',
      'Baja': 'criticality-low'
    };
    return classes[criticality] || 'criticality-unknown';
  }

  calculateDepreciation(asset: Asset): number {
    const purchaseDate = new Date(asset.purchaseDate);
    const now = new Date();
    const yearsDiff = (now.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24 * 365);
    const depreciationRate = 0.1; // 10% annual depreciation
    const depreciation = asset.purchaseValue * depreciationRate * yearsDiff;
    return Math.max(0, asset.purchaseValue - depreciation);
  }

  isMaintenanceOverdue(asset: Asset): boolean {
    const nextMaintenance = new Date(asset.nextMaintenance);
    const now = new Date();
    return nextMaintenance < now;
  }

  getDaysUntilMaintenance(asset: Asset): number {
    const nextMaintenance = new Date(asset.nextMaintenance);
    const now = new Date();
    const diffTime = nextMaintenance.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  getOperationalCount(): number {
    return this.assets.filter(a => a.status === 'Operativo').length;
  }

  getMaintenanceCount(): number {
    return this.assets.filter(a => a.status === 'En Mantenimiento').length;
  }

  onNewAsset(): void {
    this.router.navigate(['/procmodmaintenance/newasset']);
  }
}
