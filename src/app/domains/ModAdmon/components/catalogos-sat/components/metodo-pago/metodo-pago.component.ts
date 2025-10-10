import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { FacturacionService } from 'app/services/facturacion.service';

@Component({
  selector: 'app-metodo-pago',
  standalone: true,
  imports: [CommonModule, AgGridModule],
  templateUrl: './metodo-pago.component.html',
  styleUrl: './metodo-pago.component.scss'
})
export class MetodoPagoComponent implements OnInit {

  private facturacionService = inject(FacturacionService);

  metodoPagoData: any[] = [];
  private metodoPagoGridApi: GridApi;

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

  metodoPagoColumnDefs: ColDef[] = [
    {
      field: 'metodoPagoValue',
      headerName: 'Método Pago',
      width: 130
    },
    {
      field: 'descripcion',
      headerName: 'Descripción',
      width: 300
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
    this.loadMetodoPagoData();
  }

  loadMetodoPagoData(): void {
    this.facturacionService.getMetodoPago().subscribe({
      next: (data: any[]) => {
        this.metodoPagoData = data;
      },
      error: (error) => {
        console.error('Error loading Metodo Pago data:', error);
        this.metodoPagoData = [];
      }
    });
  }

  onMetodoPagoGridReady(params: GridReadyEvent): void {
    this.metodoPagoGridApi = params.api;
  }

}