import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { FacturacionService } from 'app/services/facturacion.service';

@Component({
  selector: 'app-uso-cfdi',
  standalone: true,
  imports: [CommonModule, AgGridModule],
  templateUrl: './uso-cfdi.component.html',
  styleUrl: './uso-cfdi.component.scss'
})
export class UsoCfdiComponent implements OnInit {

  private facturacionService = inject(FacturacionService);

  usoCfdiData: any[] = [];
  private usoCfdiGridApi: GridApi;

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

  usoCfdiColumnDefs: ColDef[] = [
    {
      field: 'cUsoCFDI',
      headerName: 'Código Uso CFDI',
      width: 130
    },
    {
      field: 'descripcion',
      headerName: 'Descripción',
      width: 300
    },
    {
      field: 'aplicaParaFisica',
      headerName: 'Aplica Física',
      width: 120
    },
    {
      field: 'aplicaParaMoral',
      headerName: 'Aplica Moral',
      width: 120
    },
    {
      field: 'regimenFiscal',
      headerName: 'Régimen Fiscal',
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
    this.loadUsoCfdiData();
  }

  loadUsoCfdiData(): void {
    this.facturacionService.getUsoCfdi().subscribe({
      next: (data: any[]) => {
        this.usoCfdiData = data;
      },
      error: (error) => {
        console.error('Error loading Uso CFDI data:', error);
        this.usoCfdiData = [];
      }
    });
  }

  onUsoCfdiGridReady(params: GridReadyEvent): void {
    this.usoCfdiGridApi = params.api;
  }

}