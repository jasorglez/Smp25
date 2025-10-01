import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { FacturacionService } from 'app/services/facturacion.service';

@Component({
  selector: 'app-regimen-fiscal',
  standalone: true,
  imports: [CommonModule, AgGridModule],
  templateUrl: './regimen-fiscal.component.html',
  styleUrl: './regimen-fiscal.component.scss'
})
export class RegimenFiscalComponent implements OnInit {

  private facturacionService = inject(FacturacionService);

  regimenFiscalData: any[] = [];
  private regimenFiscalGridApi: GridApi;

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

  regimenFiscalColumnDefs: ColDef[] = [
    {
      field: 'codigo',
      headerName: 'Código',
      width: 100
    },
    {
      field: 'descripcion',
      headerName: 'Descripción',
      width: 400
    },
    {
      field: 'inicioVigencia',
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
      field: 'finVigencia',
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
    this.loadRegimenFiscalData();
  }

  loadRegimenFiscalData(): void {
    this.facturacionService.getRegimenFiscal().subscribe({
      next: (data: any[]) => {
        this.regimenFiscalData = data;
      },
      error: (error) => {
        console.error('Error loading Regimen Fiscal data:', error);
        this.regimenFiscalData = [];
      }
    });
  }

  onRegimenFiscalGridReady(params: GridReadyEvent): void {
    this.regimenFiscalGridApi = params.api;
  }

}