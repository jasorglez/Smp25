import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { FacturacionService } from 'app/services/facturacion.service';

@Component({
  selector: 'app-tipo-comprobante',
  standalone: true,
  imports: [CommonModule, AgGridModule],
  templateUrl: './tipo-comprobante.component.html',
  styleUrl: './tipo-comprobante.component.scss'
})
export class TipoComprobanteComponent implements OnInit {

  private facturacionService = inject(FacturacionService);

  tipoComprobanteData: any[] = [];
  private tipoComprobanteGridApi: GridApi;

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

  tipoComprobanteColumnDefs: ColDef[] = [
    {
      field: 'tipoDeComprobante',
      headerName: 'Tipo Comprobante',
      width: 150
    },
    {
      field: 'descripcion',
      headerName: 'Descripción',
      width: 300
    },
    {
      field: 'valorMaximo',
      headerName: 'Valor Máximo',
      width: 150
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
    this.loadTipoComprobanteData();
  }

  loadTipoComprobanteData(): void {
    this.facturacionService.getTipoComprobante().subscribe({
      next: (data: any[]) => {
        this.tipoComprobanteData = data;
      },
      error: (error) => {
        console.error('Error loading Tipo Comprobante data:', error);
        this.tipoComprobanteData = [];
      }
    });
  }

  onTipoComprobanteGridReady(params: GridReadyEvent): void {
    this.tipoComprobanteGridApi = params.api;
  }

}