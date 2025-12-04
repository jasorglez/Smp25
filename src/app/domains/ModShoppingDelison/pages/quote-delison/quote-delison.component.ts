import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, ColGroupDef, GridApi } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { alerts } from 'app/helpers/alerts';
import { ButtonCellRendererComponent } from './button-cell-renderer.component';
import { DetailCellRendererPedimentosComponent } from './detail-cell-renderer-pedimentos.component';

@Component({
  selector: 'app-quote-delison',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, ButtonCellRendererComponent, DetailCellRendererPedimentosComponent],
  templateUrl: './quote-delison.component.html',
  styleUrl: './quote-delison.component.scss'
})
export class QuoteDelisonComponent implements OnInit {

  rowData: any[] = [];
  gridHeight: string = '80vh';
  private gridApi: GridApi;

  public rowSelection: 'single' | 'multiple' = 'single';
  public paginationPageSize = 15;
  public paginationPageSizeSelector: number[] | boolean = [15, 50, 100];
  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  public gridOptions: any = {
    headerHeight: 35,
    rowHeight: 35,
    animateRows: true,
    singleClickEdit: true,
    masterDetail: true,
    detailRowHeight: 400,
    detailCellRenderer: DetailCellRendererPedimentosComponent
  };

  ngOnInit() {
    this.loadQuotes();
  }

  onGridReady(params: any) {
    this.gridApi = params.api;
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

        ]
      }

    ];
  }

  togglePedimentosCascade(node: any) {
    node.setSelected(true);

    const isCurrentlyExpanded = node.expanded;

    if (isCurrentlyExpanded) {
      // Si ya está expandido, colapsarlo
      node.setExpanded(false);
    } else {
      // Colapsar cualquier otra fila expandida
      this.gridApi.forEachNode((otherNode: any) => {
        if (otherNode.id !== node.id && otherNode.expanded) {
          otherNode.setExpanded(false);
        }
      });

      // Expandir el nodo
      node.setExpanded(true);
    }
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
        width: 150,
        cellRenderer: ButtonCellRendererComponent,
        cellRendererParams: {
          onClick: (node: any) => this.togglePedimentosCascade(node),
        },
        valueGetter: params => params.data.pedimentos ? params.data.pedimentos.length : 0,
        editable: false,
        cellStyle: { backgroundColor: '#e8f5e9', cursor: 'pointer' }
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
