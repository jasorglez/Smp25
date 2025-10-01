import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { FacturacionService } from 'app/services/facturacion.service';

@Component({
  selector: 'app-productos-servicios',
  standalone: true,
  imports: [CommonModule, AgGridModule],
  templateUrl: './productos-servicios.component.html',
  styleUrl: './productos-servicios.component.scss'
})
export class ProductosServiciosComponent implements OnInit {

  private facturacionService = inject(FacturacionService);

  productosServiciosData: any[] = [];
  private productosServiciosGridApi: GridApi;

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

  productosServiciosColumnDefs: ColDef[] = [
    {
      field: 'claveProdServValue',
      headerName: 'Clave Prod. Serv.',
      width: 140
    },
    {
      field: 'descripcion',
      headerName: 'Descripción',
      width: 300
    },
    {
      field: 'incluirIVATraslado',
      headerName: 'IVA Traslado',
      width: 120
    },
    {
      field: 'incluirIEPSTraslado',
      headerName: 'IEPS Traslado',
      width: 130
    },
    {
      field: 'complemento',
      headerName: 'Complemento',
      width: 120
    },
    {
      field: 'estimuloFranja',
      headerName: 'Estímulo Franja',
      width: 130,
      valueFormatter: (params) => {
        return params.value ? 'Sí' : 'No';
      }
    },
    {
      field: 'palabrasSimilares',
      headerName: 'Palabras Similares',
      width: 200
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
    this.loadProductosServiciosData();
  }

  loadProductosServiciosData(): void {
    this.facturacionService.getProductosServicios().subscribe({
      next: (data: any[]) => {
        this.productosServiciosData = data;
      },
      error: (error) => {
        console.error('Error loading Productos y Servicios data:', error);
        this.productosServiciosData = [];
      }
    });
  }

  onProductosServiciosGridReady(params: GridReadyEvent): void {
    this.productosServiciosGridApi = params.api;
  }

}