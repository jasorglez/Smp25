import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { FacturacionService } from 'app/services/facturacion.service';

@Component({
  selector: 'app-forma-pago',
  standalone: true,
  imports: [CommonModule, AgGridModule],
  templateUrl: './forma-pago.component.html',
  styleUrl: './forma-pago.component.scss'
})
export class FormaPagoComponent implements OnInit {

  private facturacionService = inject(FacturacionService);

  formaPagoData: any[] = [];
  private formaPagoGridApi: GridApi;

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

  formaPagoColumnDefs: ColDef[] = [
    {
      field: 'formaPagoValue',
      headerName: 'Forma Pago',
      width: 120
    },
    {
      field: 'descripcion',
      headerName: 'Descripción',
      width: 200
    },
    {
      field: 'bancarizado',
      headerName: 'Bancarizado',
      width: 120
    },
    {
      field: 'numeroOperacion',
      headerName: 'Num. Operación',
      width: 130
    },
    {
      field: 'rfcEmisor',
      headerName: 'RFC Emisor',
      width: 120
    },
    {
      field: 'cuentaOrdenante',
      headerName: 'Cuenta Ordenante',
      width: 150
    },
    {
      field: 'patronOrdenante',
      headerName: 'Patrón Ordenante',
      width: 150
    },
    {
      field: 'rfcEmisorBeneficiario',
      headerName: 'RFC Emisor Benef.',
      width: 150
    },
    {
      field: 'cuentaBeneficiario',
      headerName: 'Cuenta Benef.',
      width: 140
    },
    {
      field: 'patronBeneficiario',
      headerName: 'Patrón Benef.',
      width: 140
    },
    {
      field: 'tipoCadena',
      headerName: 'Tipo Cadena',
      width: 120
    },
    {
      field: 'nombreDelBanco',
      headerName: 'Nombre Banco',
      width: 200
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
    this.loadFormaPagoData();
  }

  loadFormaPagoData(): void {
    this.facturacionService.getFormaPago().subscribe({
      next: (data: any[]) => {
        this.formaPagoData = data;
      },
      error: (error) => {
        console.error('Error loading Forma Pago data:', error);
        this.formaPagoData = [];
      }
    });
  }

  onFormaPagoGridReady(params: GridReadyEvent): void {
    this.formaPagoGridApi = params.api;
  }

}
