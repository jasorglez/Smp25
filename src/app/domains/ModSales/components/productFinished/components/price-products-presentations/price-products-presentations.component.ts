import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  signal, ChangeDetectorRef} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import {
  CellDoubleClickedEvent,
  ColDef,
  GridApi,
  GridReadyEvent,
} from 'ag-grid-enterprise';
import { PricePresentations } from 'app/interface/materials.interface';
import { AutocompleteEditorComponent } from 'app/shared/autocomplete-editor/autocomplete-editor.component';
import { MultiLineEditorComponent } from 'app/shared/multi-line/multi-line-editor.component';
import { OnInit } from '@angular/core';
import { alerts } from 'app/helpers/alerts';
import { PriceXProductsPresentationService } from 'app/services/priceXProductsPresentation.service';
import { concat, lastValueFrom, toArray } from 'rxjs';
import { CatalogsService } from 'app/services/catalogs.service';

@Component({
  selector: 'price-products-presentations',
  standalone: true,
  imports: [AgGridModule, CommonModule, FormsModule, AgGridModule],
  templateUrl: './price-products-presentations.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PriceProductsPresentationsComponent implements OnInit {
  private readonly cdr = inject(ChangeDetectorRef);
  public inputRowData = input.required<PricePresentations[]>();

  public inputIdMaterial = input.required<number>();

  public inputMedidas = input.required<any>();

  priceXproductService = inject(PriceXProductsPresentationService);

  catalogsService = inject(CatalogsService);

  rowData = signal([]);

  selectedRowData: PricePresentations;

  gridHeight = signal('30vh');

  private gridApi: GridApi;

  public notSavedChanges = signal<boolean>(false);

  id: number;

  newlyAddedRows: number[] = [];

  ngOnInit(): void {
    const rows = this.inputRowData().map((item) => ({
      ...item,
      idMaterials: this.inputIdMaterial(),
    }));

    this.rowData.set(rows);
  }

  // Column Definitions: Defines the columns to be displayed.
  public gridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    getRowClass: (params) => {
      // Verificar si la fila está seleccionada
      if (params.node.isSelected()) {
        return 'selected-row';
      }
      return '';
    },
    onRowClicked: (event) => {
      // Seleccionar la fila al hacer clic en cualquier celda
      event.node.setSelected(true);
    },
    onRowSelected: (event) => {
      // Deseleccionar otras filas cuando se selecciona una nueva
      if (event.node.isSelected()) {
        this.gridApi.forEachNode((node) => {
          if (node.id !== event.node.id) {
            node.setSelected(false);
          }
        });
      }
    },
  };

  components = {
    multiLineEditor: MultiLineEditorComponent,
    autocompleteEditor: AutocompleteEditorComponent,
  };
  tempIdCounter: any;

  get colMaster(): ColDef[] {
    return [
      {
        field: 'id',
        editable: false,
        hide: true,
        filter: 'agNumberColumnFilter', // Filtro para números (si el ID es numérico)
        filterParams: {
          filterOptions: ['equals'], // Opciones de filtro
        },
      },
      {
        field: 'idMaterials',
        hide: true,
      },
      {
        field: 'description',
        headerName: 'Descripción',
        editable: true,
        filter: true,
        width: 150,
        cellEditor: 'autocompleteEditor',
      },

      //

      {
        field: 'idCatalogs',
        hide: true, // oculto, pero el valor real se guarda aquí
      },
      {
        headerName: 'Medida',
        field: 'idCatalogs',
        editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: () => ({
          values: this.inputMedidas().map((medida: any) => medida.id),
        }),
        valueFormatter: (params) => {
          const medida = this.inputMedidas().find(
            (m: any) => m.id === params.value
          );
          return medida ? medida.description : '';
        },
      },

      //

      {
        field: 'price',
        headerName: 'Precio',
        editable: true,
        filter: true,
        width: 150,
      },
      {
        field: 'active',
        headerName: 'Vigente',
        editable: true,
        filter: true,
        width: 150,
      },
    ];
  }

  onSelectionChanged(event: any) {
    const selectedNodes = event.api.getSelectedNodes();
    if (selectedNodes.length > 0) {
      this.selectedRowData = selectedNodes[0].data;
    } else {
      this.selectedRowData = null;
    }
  }

  onCellValueChanged(event: any) {
    event.data.__modified = true;

    this.notSavedChanges.set(true);

    if (event.data.idMedida) {
      event.data.idMedida = Number(event.data.idMedida);
    }
  }

  onSelectedRow(event: any) {
    this.id = event.data.id;
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  async onCellDoubleClicked(event: CellDoubleClickedEvent): Promise<void> {
    const colId = event.column.getColId();
    const selectedRowData = event.data; // Obtener los datos de la fila seleccionada
    const selectedId = selectedRowData.id; // Obtener el ID del registro

    this.notSavedChanges.set(true);

    if (colId === 'insumo') {
      // Filtrar el grid para mostrar solo el registro con el ID seleccionado
      const filterModel = {
        id: {
          type: 'equals',
          filter: selectedId,
        },
      };

      this.gridApi.setFilterModel(filterModel);
      this.gridApi.onFilterChanged();
    }

    // Puedes agregar lógica adicional aquí si necesitas guardar los datos seleccionados
    this.selectedRowData = selectedRowData;
  }

  private cleanDataForServer(data: any): any {
    const cleanedData = { ...data };
    delete cleanedData.__isNew;
    delete cleanedData.__modified;
    if (cleanedData.id) {
      delete cleanedData.id;
    }
    return cleanedData;
  }

  // TODO Check to delete measure

  deleteEntry() {
    throw new Error('Method not implemented.');
  }

  // TODO revert changes
  revert() {
    this.notSavedChanges.set(false);

    throw new Error('Method not implemented.');
  }

  addRow() {
    const tempId = this.tempIdCounter++;
    const newItem = {
      id: tempId,
      idMaterials: this.inputIdMaterial(),
      idCatalogs: 0,
      description: '',
      price: 0.0,
      active: true,
      __isNew: true,
    };

    this.rowData.update((current) => [newItem, ...current]);
    this.newlyAddedRows.push(tempId);
    this.notSavedChanges.set(true);
    this.gridApi.setGridOption('rowData', this.rowData());
  }

  async saveChanges() {
    const isValid = this.rowData().every(
      (item) => item.description && item.price
    );
    if (!isValid) {
      alerts.basicAlert(
        'Añadir entrada',
        `Debe llenar todos los campos antes de guardar.`,
        'error'
      );
      return;
    }

    const newRows = this.rowData().filter((row) => row.__isNew);
    const modifiedRows = this.rowData().filter(
      (row) => row.__modified && !row.__isNew
    );

    const addObservables = newRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.priceXproductService.createPriceXProductsPresentations(
        cleanedData
      );
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.priceXproductService.updatePriceXProductsPresentationsById(
        row.id,
        cleanedData
      );
    });

    // Using concat to combine observables and lastValueFrom for async/await
    try {
      const responses = await lastValueFrom(
        concat(...addObservables, ...updateObservables).pipe(toArray())
      );
      alerts.basicAlert(
        'Datos actualizados',
        'Se han actualizado los datos correctamente.',
        'success'
      );
      this.notSavedChanges.set(false);
      this.newlyAddedRows = [];
    } catch (error) {
      console.error(error);
      alerts.basicAlert(
        'Error',
        'Ocurrió un error al actualizar los datos. Por favor, intente nuevamente.',
        'error'
      );
    }
  
    this.cdr.detectChanges();}
}
