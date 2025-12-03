import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, ColGroupDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { alerts } from 'app/helpers/alerts';
import { DetailCellRendererQuoteItemsComponent } from './detail-cell-renderer-quote-items.component';

@Component({
  selector: 'app-quote-delison',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, DetailCellRendererQuoteItemsComponent],
  templateUrl: './quote-delison.component.html',
  styleUrl: './quote-delison.component.scss'
})
export class QuoteDelisonComponent implements OnInit {

  private gridApi!: GridApi;
  rowData: any[] = [];
  gridHeight: string = '80vh';

  public rowSelection: 'single' | 'multiple' = 'single';
  public paginationPageSize = 15;
  public paginationPageSizeSelector: number[] | boolean = [15, 50, 100];
  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  public gridOptions: any = {
    headerHeight: 35,
    rowHeight: 35,
    animateRows: true,
    masterDetail: true,
    detailRowHeight: 300,
    isRowMaster: (dataItem: any) => true, // Todas las filas pueden ser maestras
    detailCellRenderer: DetailCellRendererQuoteItemsComponent,
    singleClickEdit: true
  };

  ngOnInit() {
    this.loadQuotes();
  }

  loadQuotes() {
    // Mock data for quotes
    this.rowData = [
      {
        id: 1,
        branch: 'BODEGAS',
        requisition: 'REQ-001',
        pedimentos: [
          { id: 'PED-001', name: 'Pedimento 1', items: [{ article: 'Item 1', quantity: 10, tipo: 'Tipo A', proveedorInterno: 'Prov Int 1', priority: 'Alta', observaciones: 'Obs 1', pedimento: true }, { article: 'Item 2', quantity: 5, tipo: 'Tipo B', proveedorInterno: 'Prov Int 2', priority: 'Media', observaciones: 'Obs 2', pedimento: false }], createdAt: new Date().toISOString() },
          { id: 'PED-002', name: 'Pedimento 2', items: [{ article: 'Item 3', quantity: 20, tipo: 'Tipo C', proveedorInterno: 'Prov Int 3', priority: 'Baja', observaciones: 'Obs 3', pedimento: true }], createdAt: new Date().toISOString() }
        ],
        // Datos para las nuevas columnas de proveedor
        proveedor1: null,
        proveedor2: null,
        proveedor3: null,
        requiredDate: new Date().toISOString(),
        requestedBy: 'Juan Pérez',
        department: 'Departamento 1',
        providers: [
          {
            id: 1,
            name: 'Proveedor A',
            receptionDate: new Date().toISOString(),
            unitCost: 100,
            minPurchase: 10,
            deliveryTime: '5 días',
            status: 'Pendiente',
            confirmedQuantity: 20,
            totalCost: 2000,
            authorized: 'Sí',
            oc: 'OC-001'
          },
          {
            id: 2,
            name: 'Proveedor B',
            receptionDate: new Date().toISOString(),
            unitCost: 95,
            minPurchase: 15,
            deliveryTime: '7 días',
            status: 'Aprobado',
            confirmedQuantity: 25,
            totalCost: 2375,
            authorized: 'Sí',
            oc: 'OC-002'
          }
          ,
          {
            id: 3,
            name: 'Proveedor C',
            receptionDate: new Date().toISOString(),
            unitCost: 110,
            minPurchase: 5,
            deliveryTime: '3 días',
            status: 'Rechazado',
            confirmedQuantity: 0,
            totalCost: 0,
            authorized: 'No',
            oc: null
          }
        ]
      }
      
    ];
  }

  get colMaster(): (ColDef | ColGroupDef)[] {
    return [
      {
        field: 'branch',
        headerName: 'Sucursal',
        width: 120,
        editable: false
      },
    
      {
        field: 'requisition',
        headerName: 'Requisicion',
        width: 120,
        editable: false
      },
    
      {
        field: 'pedimentos',
        headerName: 'Pedimentos',
        width: 120,
        cellRenderer: 'agGroupCellRenderer', // Para mostrar la flecha de expansión
        valueGetter: (params) => params.data.pedimentos ? params.data.pedimentos.length : 0,
        editable: false
      },

     {
        field: 'requestedBy',
        headerName: 'Quien lo Pidio',
        width: 150,
        editable: false
      },

     {
        field: 'department',
        headerName: 'Departamento',
        width: 150,
        editable: false
      },
    ];
  }

  onCellClicked(event: any): void {
    event.node.setSelected(true);
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  // --- Lógica de botones CRUD principal (ejemplos) ---

  addQuote() {
    alerts.basicAlert('Función no implementada', 'La lógica para agregar una nueva cotización aún no se ha implementado.', 'info');
  }

  deleteQuote() {
    alerts.basicAlert('Función no implementada', 'La lógica para eliminar una cotización aún no se ha implementado.', 'info');
  }

  saveChanges() {
    alerts.basicAlert('Función no implementada', 'La lógica para guardar cambios en las cotizaciones aún no se ha implementado.', 'info');
  }
}