import { Component } from '@angular/core';
import { MaterialsBaseComponent } from '../base/materials-base.component';
import { ColDef } from 'ag-grid-enterprise';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { MultiLineEditorComponent } from 'app/shared/multi-line/multi-line-editor.component';
import { PriceProductsPresentationsComponent } from '../components/price-products-presentations/price-products-presentations.component';
import { ProvedoorByBranchComponent } from '../components/ProvedoorByBranch/ProvedoorByBranch.component';
import { AutocompleteEditorComponent } from 'app/shared/autocomplete-editor/autocomplete-editor.component';

@Component({
  selector: 'app-primera-fase-historico',
  standalone: true,
  imports: [
    AutocompleteEditorComponent,
    CommonModule,
    FormsModule,
    AgGridModule,
    MultiLineEditorComponent,
    PriceProductsPresentationsComponent,
    ProvedoorByBranchComponent
  ],
  templateUrl: './primera-fase-historico.component.html',
  styleUrl: './primera-fase-historico.component.scss',
})
export class PrimeraFaseHistoricoComponent extends MaterialsBaseComponent {

  private _columnDefs: ColDef[] | null = null;
  private _gridOptions: any = null;

  getType(): string {
    return 'PRIMERA_FASE_HISTORICO';
  }

  getColumnDefs(): ColDef[] {
    if (this._columnDefs) {
      return this._columnDefs;
    }

    // Mismas columnas que primera-fase
    this._columnDefs = [
      {
        field: 'articulo',
        headerName: 'Artículo',
        editable: true,
        width: 250,
        flex: 1
      },
      {
        field: 'fase',
        headerName: 'Fase',
        editable: true,
        width: 150,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: ['Primera', 'Segunda']
        }
      },
      {
        field: 'materiales',
        headerName: 'Materiales',
        editable: false,
        width: 150,
        cellStyle: { backgroundColor: '#e1f5fe', cursor: 'pointer', textDecoration: 'underline' },
        cellRenderer: (params: any) => {
          const count = params.data.materialesData ? params.data.materialesData.length : 0;
          const div = document.createElement('div');
          div.innerText = `${count} materiales`;
          div.style.cursor = 'pointer';
          div.style.textDecoration = 'underline';
          return div;
        }
      },
      {
        field: 'costoFinal',
        headerName: 'Costo Final',
        editable: true,
        width: 130,
        valueFormatter: (params) => {
          return params.value ? `$${params.value.toFixed(2)}` : '$0.00';
        }
      },
      {
        field: 'fechaCambio',
        headerName: 'Fecha Cambio',
        editable: true,
        width: 130,
        valueFormatter: (params) => {
          if (params.value) {
            return params.value.split('T')[0];
          }
          return '';
        }
      },
      {
        field: 'numArticulo',
        headerName: 'Num Artículo',
        editable: true,
        width: 130
      },
      {
        field: 'parametros',
        headerName: 'Parámetros',
        editable: false,
        width: 150,
        cellStyle: { backgroundColor: '#fff9c4', cursor: 'pointer', textDecoration: 'underline' },
        cellRenderer: (params: any) => {
          const div = document.createElement('div');
          div.innerText = 'Parámetros';
          div.style.cursor = 'pointer';
          div.style.textDecoration = 'underline';
          return div;
        }
      }
    ];

    return this._columnDefs;
  }

  getGridOptions(): any {
    if (this._gridOptions) {
      return this._gridOptions;
    }

    this._gridOptions = {
      headerHeight: 25,
      rowHeight: 20,
      masterDetail: true,
      isRowMaster: (dataItem: any) => {
        return dataItem.historicoData && dataItem.historicoData.length > 0;
      },
      detailCellRendererSelector: (params: any) => {
        if (params.data.detailType === 'historico') {
          return { component: 'detailCellRendererHistorico' };
        }
        if (params.data.detailType === 'materiales') {
          return { component: 'detailCellRendererMateriales' };
        }
        if (params.data.detailType === 'parametros') {
          return { component: 'detailCellRendererParametros' };
        }
        return undefined;
      },
      getRowClass: (params) => {
        if (params.node.isSelected()) {
          return 'selected-row';
        }
        return '';
      },
      onRowClicked: (event) => {
        event.node.setSelected(true);
      },
      onRowSelected: (event) => {
        if (event.node.isSelected()) {
          this.gridApi.forEachNode((node) => {
            if (node.id !== event.node.id) {
              node.setSelected(false);
            }
          });
        }
      },
      onCellClicked: this.onCellClicked.bind(this),
    };

    return this._gridOptions;
  }

  override onCellClicked(event: any): void {
    const colId = event.column.getColId();

    if (colId === 'historico' || colId === 'materiales' || colId === 'parametros') {
      const node = event.node;
      const api = event.api;

      let detailType = '';
      if (colId === 'historico') detailType = 'historico';
      if (colId === 'materiales') detailType = 'materiales';
      if (colId === 'parametros') detailType = 'parametros';

      const isCurrentlyExpanded = node.expanded && event.data.detailType === detailType;

      if (isCurrentlyExpanded) {
        node.setExpanded(false);
        api.forEachNode((otherNode: any) => {
          otherNode.setRowHeight(undefined);
        });
        api.onRowHeightChanged();
      } else {
        api.forEachNode((otherNode: any) => {
          if (otherNode.expanded && otherNode.id !== node.id) {
            otherNode.setExpanded(false);
          }
        });

        api.forEachNode((otherNode: any) => {
          if (otherNode.id !== node.id) {
            otherNode.setRowHeight(0);
          }
        });

        if (node.expanded && event.data.detailType !== detailType) {
          node.setExpanded(false);
        }

        event.data.detailType = detailType;
        api.onRowHeightChanged();

        setTimeout(() => {
          node.setExpanded(true);
        }, 0);
      }
    }
  }

  override obtenerDatos(): any {
    // Para histórico, llamamos al servicio con el tipo correcto
    return this.materialsService.getMaterials(this.idRoot, this.type).subscribe(
      (data: any) => {
        this.rowData = data;
        console.log('Primera Fase Historico - rowData:', this.rowData);
      },
      (error) => console.error('Error fetching data:', error)
    );
  }
}
