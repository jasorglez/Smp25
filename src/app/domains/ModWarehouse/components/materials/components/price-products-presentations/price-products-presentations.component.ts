import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  signal,
  effect,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { Icatalog } from 'app/interface/icatalog';
import {
  CellDoubleClickedEvent,
  ColDef,
  GridApi,
  GridReadyEvent,
  GetMainMenuItemsParams,
  MenuItemDef,
} from 'ag-grid-enterprise';
import { PricePresentations } from 'app/interface/materials.interface';
import { AutocompleteEditorComponent } from 'app/shared/autocomplete-editor/autocomplete-editor.component';
import { MultiLineEditorComponent } from 'app/shared/multi-line/multi-line-editor.component';
import { OnInit } from '@angular/core';
import { alerts } from 'app/helpers/alerts';
import { SignalsService } from 'app/services/signals.service';
import { PriceXProductsPresentationService } from 'app/services/priceXProductsPresentation.service';
import { concat, lastValueFrom, toArray } from 'rxjs';
import { CatalogsService } from 'app/services/catalogs.service';
import { TrackingService } from 'app/services/tracking.service';
declare const bootstrap: any;

@Component({
  selector: 'price-products-presentations',
  standalone: true,
  imports: [AgGridModule, CommonModule, FormsModule, AgGridModule],
  templateUrl: './price-products-presentations.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PriceProductsPresentationsComponent implements OnInit {
  public inputRowData = input.required<PricePresentations[]>();

  public inputIdMaterial = input.required<number>();

  public inputMedidas = input.required<any>();

  priceXproductService = inject(PriceXProductsPresentationService);

  catalogsService = inject(CatalogsService);
  private trackingService = inject(TrackingService);

  private signalsService = inject(SignalsService);

  rowData = signal([]);

  selectedRowData: PricePresentations;

  gridHeight = signal('30vh');

  private gridApi: GridApi;

  public notSavedChanges = signal<boolean>(false);

  id: number;

  newlyAddedRows: number[] = [];
  idRoot: number = null;
  idUser: number = null;
  familias: any;
  subfamilias2: any;
  units: any[] = [];

  ngOnInit(): void {
    this.idRoot = this.signalsService.getRootSelectedBySidebar()();
    this.idUser = this.signalsService.getIdUSer()();
     const rows = this.inputRowData().map((item) => ({
      ...item,
      idMaterials: this.inputIdMaterial(),
    }));

    this.rowData.set(rows);
    this.obtenerFamilias();
    this.obtenerSubfamilias();
    this.obtenerUnidades();
  }
  constructor() {
      effect(() => {
        this.idRoot = this.signalsService.getRootSelectedBySidebar()();
        this.idUser = this.signalsService.getIdUSer()();
         const rows = this.inputRowData().map((item) => ({
          ...item,
          idMaterials: this.inputIdMaterial(),
        }));
        
        this.rowData.set(rows);
        this.obtenerFamilias();
        this.obtenerSubfamilias();
        this.obtenerUnidades();
      });
    }

   obtenerFamilias() {
        this.catalogsService.getFamilyById(this.idRoot).subscribe(
          (data: Icatalog[]) => {
            this.familias = data;
          },
          (error) => console.error('Error fetching families:', error)
        );
      }
    
    obtenerSubfamilias() {
      this.catalogsService.getCatalogs(this.idRoot, 'SUBFAMILY').subscribe(
        (data: Icatalog[]) => {
          this.subfamilias2 = data;
        },
        (error) => console.error('Error fetching subfamilies:', error)
      );
    }

    obtenerUnidades() {
      this.catalogsService.getCatalogs(this.idRoot, 'UNITS')
      .subscribe({
        next: (data: any[]) =>{ this.units = data 
         console.log(data)},
        error: (err) => console.error(`Error):`, err)
      });
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
      /*{
        field: 'description',
        headerName: 'Descripción',
        editable: true,
        filter: true,
        width: 150,
        cellEditor: 'autocompleteEditor',
      },
      {
        field: 'idFamilia',
        headerName: 'Producto',
        editable: true,
        width: 150,
        filter: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: this.familias ? this.familias.map((item) => item.id) : [],
        },
        valueFormatter: (params) => {
          const foundItem = this.familias
            ? this.familias.find((item) => item.id === params.value)
            : null;
          return foundItem ? `${foundItem.description}` : params.value;
        },
        valueGetter: (params) => {
          console.log(params)
          if (!params.data || !params.data.idFamilia) return '';
          const familias = this.familias?.find(b => b.id === params.data.idFamilia);
        
          return familias ? familias.description : '';
        },
        mainMenuItems: (params: GetMainMenuItemsParams) => {
          const familyMenuItems: (MenuItemDef | string)[] = [
            {
              name: 'Añadir familia',
              action: () => {
                this.openAddFamilyModal();
              },
            },
            'separator',
            ...params.defaultItems.slice(0),
          ];
          return familyMenuItems;
        },
      },
     {
      field: 'idSubfamilia',
      headerName: 'Presentación',
      editable: true,
      width: 150,
      filter: true,
      cellEditor: 'agSelectCellEditor',
      mainMenuItems: (params: GetMainMenuItemsParams) => {
        return [
          {
            name: 'Añadir subfamilia',
            action: () => this.openAddSubFamilyModal(),
          },
          'separator',
          ...params.defaultItems.slice(0),
        ];
      },
      cellEditorParams: (params) => {
        const idFamilia = params.data.idFamilia;
        const subfamiliasFiltradas = this.subfamilias2.filter(
          (item) => item.parentId === idFamilia
        )   ;
      
        return {
          values: subfamiliasFiltradas.map((item) => item.id),
          valueFormatter: (id: string) => {
            const found = subfamiliasFiltradas.find((item) => item.id === id);
            if (!found) return id;
            const unidadDesc = this.getUnidadDescripcionById(found.subParentId);
            return `${found.description} ${unidadDesc}`;
          },
        };
      },
      valueFormatter: (params) => {
        const found = this.subfamilias2?.find((item) => item.id === params.value);
        if (!found) return params.value;
        const unidadDesc = this.getUnidadDescripcionById(found.subParentId);
        return `${found.description} ${unidadDesc}`;
      },
      valueGetter: (params) => {
        const found = this.subfamilias2?.find((item) => item.id === params.data?.idSubfamilia);
        if (!found) return '';
        const unidadDesc = this.getUnidadDescripcionById(found.subParentId);
        return `${found.description} ${unidadDesc}`;
      },
    },*/

      /*{
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
      },*/

      //

      
      {
        field: 'units',
        headerName: 'Total unidades',
        editable: true,
        filter: true,
        width: 150,
      },
      {
        field: 'weight',
        headerName: 'Peso por unidad',
        editable: true,
        filter: true,
        width: 150,
      },
      {
        field: 'weight',
        headerName: 'Medidas',
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

  getUnidadDescripcionById(id: string): string {
  console.log(id)
  const unidad = this.units?.find((u) => u.id === id);
  console.log(unidad)
  return unidad ? unidad.description : id;
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

  openAddFamilyModal() {
    const modal = document.getElementById('addFamilyModal');
    if (modal) {
      const bootstrapModal = new bootstrap.Modal(modal);
      bootstrapModal.show();
    }
  }
   openAddSubFamilyModal() {
    const modal = document.getElementById('addSubFamilyModal');
    if (modal) {
      const bootstrapModal = new bootstrap.Modal(modal);
      bootstrapModal.show();
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
    this.trackingService.addLog(this.trackingService.getnameComp(), 'Eliminó price products presentations', 'Almacenes', this.trackingService.getEmail());
    throw new Error('Method not implemented.');
  }

  // TODO revert changes
  revert() {
    this.trackingService.addLog(this.trackingService.getnameComp(), 'Deshizo cambios en price products presentations', 'Almacenes', this.trackingService.getEmail());
    this.notSavedChanges.set(false);

    throw new Error('Method not implemented.');
  }

  addRow() {
    this.trackingService.addLog(this.trackingService.getnameComp(), 'Agregó nuevo price products presentations', 'Almacenes', this.trackingService.getEmail());
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
    this.trackingService.addLog(this.trackingService.getnameComp(), 'Guardó cambios en price products presentations', 'Almacenes', this.trackingService.getEmail());
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
      console.log('id del updateObeservable', cleanedData);
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
  }
}
