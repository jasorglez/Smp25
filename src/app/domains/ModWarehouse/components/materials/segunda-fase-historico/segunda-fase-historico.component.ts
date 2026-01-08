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
  selector: 'app-segunda-fase-historico',
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
  templateUrl: './segunda-fase-historico.component.html',
  styleUrl: './segunda-fase-historico.component.scss',
})
export class SegundaFaseHistoricoComponent extends MaterialsBaseComponent {

  private _columnDefs: ColDef[] | null = null;
  private _gridOptions: any = null;

  getType(): string {
    return 'SEGUNDA_FASE_HISTORICO';
  }

  getColumnDefs(): ColDef[] {
    if (this._columnDefs) {
      return this._columnDefs;
    }

    // Columnas estándar para histórico (no las de primera-fase)
    this._columnDefs = [
      { field: 'vigente', headerName: 'Activo', editable: true, width: 100 },
      {
        field: 'id',
        editable: false,
        width: 70,
        hide: true,
        filter: 'agNumberColumnFilter',
        filterParams: {
          filterOptions: ['equals'],
        },
      },
      {
        field: 'idProveedor',
        headerName: 'Proveedor',
        editable: false,
      },
      {
        field: 'description',
        headerName: 'Materia prima',
        editable: true,
        width: 285,
        filter: true,
      },
      {
        headerName: 'SubFamilia',
      },
      {
        headerName: 'Descripcion',
      },
      {
        headerName: 'Medidas',
      },
      {
        field: 'weight',
        headerName: 'Peso por unidad',
        editable: true,
        filter: true,
        width: 150,
      },
      {
        field: 'insumo',
        headerName: 'Num. Material',
        editable: true,
        filter: true,
        width: 150,
        cellEditor: 'autocompleteEditor',
        cellEditorParams: () => {
          return {
            filterList: this.rowData.map((e) => e.insumo),
            filterKey: 'insumo',
            placeholder: 'Número Material',
            minLength: 1,
          };
        },
        cellStyle: { backgroundColor: '#d4edda' },
      },
      {
        field: 'date',
        headerName: 'Fecha de alta MP',
        editable: true,
        width: 110,
        cellDataType: 'dateString',
        valueFormatter: (params) => {
          if (params.value) {
            return params.value.split('T')[0];
          }
          return '';
        },
      },
      {
        field: 'typeMaterial',
        headerName: 'Tipo Material',
        editable: true,
        filter: true,
        width: 150,
      },
      {
        headerName: "Peso por unidad"
      },
      {
        field: 'idMedida',
        headerName: 'Medidas',
        editable: true,
        width: 150,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: this.medidas ? this.medidas.map((item: any) => item.id) : [],
        },
        valueFormatter: (params) => {
          const foundItem = this.medidas
            ? this.medidas.find((item: any) => item.id === params.value)
            : null;
          return foundItem ? `${foundItem.description}` : params.value;
        },
      },
      {
        headerName: 'Empaquetado',
      },
      {
        headerName: 'Caducidad (En meses)',
      },
      {
        headerName: 'Tiempo de entrega (En semanas)',
      },
      {
        field: 'picture',
        headerName: 'Imagen',
        editable: false,
        width: 150,
        cellRenderer: this.imageHandlerService.imageCellRenderer.bind(
          this.imageHandlerService
        ),
        cellRendererParams: {
          clicked: this.imageHandlerService.onImageCellClicked.bind(
            this.imageHandlerService
          ),
          field: 'picture',
        },
      },
    ];

    return this._columnDefs;
  }

  getGridOptions(): any {
    if (this._gridOptions) {
      return this._gridOptions;
    }

    // GridOptions estándar para histórico (sin master-detail)
    this._gridOptions = {
      headerHeight: 25,
      rowHeight: 20,
      getRowClass: (params: any) => {
        if (params.node.isSelected()) {
          return 'selected-row';
        }
        return '';
      },
      onRowClicked: (event: any) => {
        event.node.setSelected(true);
      },
      onRowSelected: (event: any) => {
        if (event.node.isSelected()) {
          this.gridApi.forEachNode((node) => {
            if (node.id !== event.node.id) {
              node.setSelected(false);
            }
          });
        }
      },
    };

    return this._gridOptions;
  }

  override obtenerDatos(): any {
    // Para histórico, llamamos al servicio con el tipo correcto
    return this.materialsService.getMaterials(this.idRoot, this.type).subscribe(
      (data: any) => {
        this.rowData = data;
        console.log('Segunda Fase Historico - rowData:', this.rowData);
      },
      (error) => console.error('Error fetching data:', error)
    );
  }
}
