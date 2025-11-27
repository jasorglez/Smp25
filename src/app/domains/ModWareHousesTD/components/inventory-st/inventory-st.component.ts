import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-inventory-st',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './inventory-st.component.html',
})
export class InventoryStComponent implements OnInit {

  // Summary data
  totalInventory: number = 1250;
  totalValue: string = '284,750';
  lowStockCount: number = 47;
  totalWarehouses: number = 5;
  totalCapacity: number = 85;
  totalFamilies: number = 12;
  topFamily: string = 'Tornillería';
  topFamilyPercentage: number = 35;

  // Tab data
  totalInventoryData: any[] = [
    {
      id: 'PROD-001',
      product: 'Tornillos 3/8',
      description: 'Tornillo hexagonal acero inox',
      entradas: 1500,
      salidas: 875,
      existencia: 625,
      status: 'Óptimo'
    },
    {
      id: 'PROD-002',
      product: 'Tuercas 3/8',
      description: 'Tuerca hexagonal galvanizada',
      entradas: 800,
      salidas: 650,
      existencia: 150,
      status: 'Bajo'
    },
    {
      id: 'PROD-003',
      product: 'Arandelas planas',
      description: 'Arandela plana acero carbono',
      entradas: 300,
      salidas: 295,
      existencia: 5,
      status: 'Crítico'
    }
  ];

  warehouseInventoryData: any[] = [
    {
      warehouse: 'Almacén Principal',
      product: 'Tornillos 3/8',
      entradas: 800,
      salidas: 450,
      existencia: 350,
      location: 'Zona A'
    },
    {
      warehouse: 'Almacén Norte',
      product: 'Tornillos 3/8',
      entradas: 700,
      salidas: 425,
      existencia: 275,
      location: 'Zona B'
    }
  ];

  familyInventoryData: any[] = [
    {
      family: 'Tornillería',
      products: 45,
      stock: 8500,
      value: '125,000',
      rotation: 'Alta'
    },
    {
      family: 'Herramientas',
      products: 28,
      stock: 1200,
      value: '89,500',
      rotation: 'Media'
    },
    {
      family: 'Electricidad',
      products: 15,
      stock: 3800,
      value: '45,250',
      rotation: 'Baja'
    }
  ];

  individualInventoryData: any[] = [
    {
      id: 'PROD-001',
      name: 'Tornillos 3/8',
      code: 'TOR-038',
      measure: 'Unidad',
      stock: 625,
      unitPrice: '15.50',
      totalValue: '9,687.50',
      lastUpdate: '2024-11-24'
    },
    {
      id: 'PROD-002',
      name: 'Tuercas 3/8',
      code: 'TUE-038',
      measure: 'Unidad',
      stock: 150,
      unitPrice: '8.75',
      totalValue: '1,312.50',
      lastUpdate: '2024-11-24'
    }
  ];

  ngOnInit() {
    // Initialize data if needed
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'Óptimo':
        return 'bg-success';
      case 'Bajo':
        return 'bg-warning';
      case 'Crítico':
        return 'bg-danger';
      default:
        return 'bg-secondary';
    }
  }
}