import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { FacturacionService } from 'app/services/facturacion.service';

@Component({
  selector: 'app-clave-unidad',
  standalone: true,
  imports: [CommonModule, AgGridModule],
  templateUrl: './clave-unidad.component.html',
  styleUrl: './clave-unidad.component.scss'
})
export class ClaveUnidadComponent implements OnInit {

  private facturacionService = inject(FacturacionService);

  claveUnidadData: any[] = [];
  private claveUnidadGridApi: GridApi;

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

  claveUnidadColumnDefs: ColDef[] = [
    {
      field: 'claveUnidadValue',
      headerName: 'Clave Unidad',
      width: 150
    },
    {
      field: 'nombre',
      headerName: 'Nombre',
      width: 200
    },
    {
      field: 'descripcion',
      headerName: 'Descripción',
      width: 300
    },
    {
      field: 'nota',
      headerName: 'Nota',
      width: 400
    },
    {
      field: 'iniciovigencia',
      headerName: 'Inicio Vigencia',
      width: 150,
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
      width: 150,
      valueFormatter: (params) => {
        if (params.value) {
          return new Date(params.value).toLocaleDateString('es-ES');
        }
        return '';
      }
    },
    {
      field: 'simbolo',
      headerName: 'Símbolo',
      width: 100
    }
  ];

  ngOnInit(): void {
    this.loadClaveUnidadData();
  }

  loadClaveUnidadData(): void {
    this.facturacionService.getClaveUnidad().subscribe({
      next: (data: any[]) => {
        this.claveUnidadData = data;
      },
      error: (error) => {
        console.error('Error loading Clave Unidad data:', error);
        this.claveUnidadData = [];
      }
    });
  }

  onClaveUnidadGridReady(params: GridReadyEvent): void {
    this.claveUnidadGridApi = params.api;
  }

}