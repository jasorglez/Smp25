import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { FacturacionService } from 'app/services/facturacion.service';

@Component({
  selector: 'app-moneda',
  standalone: true,
  imports: [CommonModule, AgGridModule],
  templateUrl: './moneda.component.html',
  styleUrl: './moneda.component.scss'
})
export class MonedaComponent implements OnInit {

  private facturacionService = inject(FacturacionService);

  monedaData: any[] = [];
  private monedaGridApi: GridApi;

  // Configuración del grid
  defaultColDef = {
    sortable: true,
    filter: true,
    resizable: true,
    flex: 1
  };

  gridOptions = {
    rowHeight: 30,
    headerHeight: 30
  };

  monedaColumnDefs: ColDef[] = [
    {
      field: 'cMoneda',
      headerName: 'Código Moneda',
      width: 120
    },
    {
      field: 'descripcion',
      headerName: 'Descripción',
      width: 200
    },
    {
      field: 'decimales',
      headerName: 'Decimales',
      width: 100
    },
    {
      field: 'porcentaje',
      headerName: 'Porcentaje',
      width: 120
    },
    {
      field: 'iniciovigencia',
      headerName: 'Inicio Vigencia',
      width: 130,
      valueFormatter: (params) => {
        if (params.value) {
          return new Date(params.value).toLocaleDateString('es-ES');
        }
        return '';
      }
    },
    {
      field: 'finvigencia',
      headerName: 'Fin Vigencia',
      width: 130,
      valueFormatter: (params) => {
        if (params.value) {
          return new Date(params.value).toLocaleDateString('es-ES');
        }
        return '';
      }
    }
  ];

  ngOnInit(): void {
    this.loadMonedaData();
  }

  loadMonedaData(): void {
    this.facturacionService.getMoneda().subscribe({
      next: (data: any[]) => {
        this.monedaData = data;
      },
      error: (error) => {
        console.error('Error loading Moneda data:', error);
        this.monedaData = [];
      }
    });
  }

  onMonedaGridReady(params: GridReadyEvent): void {
    this.monedaGridApi = params.api;
  }

}