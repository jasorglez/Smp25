import { Component, computed, effect, inject, Signal } from '@angular/core';
import { CatalogsService } from 'app/services/catalogs.service';
import { CatalogadmonService } from 'app/services/catalogadmon.service';
import { TablesxmodulesService } from 'app/services/tablesxmodules.service';
import { SignalsService } from 'app/services/signals.service';

import { TranslateModule } from '@ngx-translate/core';
import { concat, EMPTY, lastValueFrom } from 'rxjs';
import { toArray } from 'rxjs/operators';
import { RouterModule } from '@angular/router';
import { DomainsModule } from 'app/domains/domainsmodule';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';

import {
  ColDef,
  GridApi,
  GridReadyEvent,
  ICellRendererParams,
  RowSelectedEvent,
} from 'ag-grid-enterprise';
import { AgGridModule, ICellRendererAngularComp } from 'ag-grid-angular';

import { alerts } from '../../../../helpers/alerts';
import { SharedModule } from 'app/shared/shared.module';
import { CanComponentDeactivate } from 'app/guards/unsaved-changes.guard';
import { confirmExitIfUnsaved } from 'app/helpers/can-deactivate.helper';

//soriano
@Component({
  selector: 'app-catalogs',
  standalone: true,
  imports: [
    RouterModule,
    DomainsModule,
    AgGridModule,
    SharedModule,
    TranslateModule,
  ],
  templateUrl: './catalogs.component.html',
  styleUrl: './catalogs.component.scss',
})
export class CatalogsComponent implements CanComponentDeactivate {
  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;
  notSavedChanges: boolean = false;
  rowData: any;

  newlyAddedRows: string[] = [];
  table: any[] = [];
  selectedRowData: any = null;

  idRoot: number;
  selectedCatalog: string; // Variable para almacenar e
  showDetailsTab: boolean = false;
  gridHeight: string = '50vh';
  prefixAndConsecutive: any[] = [];
  private tempIdCounter: number = 0;
  private gridApi: GridApi;

  menuSelect: number;
  showWarehTab: Signal<boolean>;
  showAdmonTab: Signal<boolean>;

  constructor() {
    effect(() => {
      this.idRoot = this.signalsService.getRootSelectedBySidebar()();
      this.obtenerTables();
      this.obtenerDatos();
    });
  }

  ngOnInit() {
    this.idRoot = this.signalsService.getRootSelectedBySidebar()();
    this.obtenerTables();
    this.obtenerDatos();
  }

  currentIndex = 0;
  private catalogService = inject(CatalogsService);
  private signalsService = inject(SignalsService);
  private tableService = inject(TablesxmodulesService);
  private catalogAdmonService = inject(CatalogadmonService);

  public rowSelection: 'single' | 'multiple' = 'single';
  public rowGroupPanelShow: 'always' | 'onlyWhenGrouping' | 'never' = 'always';
  public pivotPanelShow: 'always' | 'onlyWhenPivoting' | 'never' = 'always';

  onCatalogChange(event: Event) {
    const selectElement = event.target as HTMLSelectElement;
    this.selectedCatalog = selectElement.value; // Almacena el valor seleccionado
    this.obtenerDatos(); // Vuelve a ejecutar la consulta con el nuevo valor
  }

  obtenerTables() {
    this.tableService
      .getTablesxmodules(this.signalsService.getCatalogSelected())
      .subscribe(
        (data: any) => {
          this.table = data;
        },
        (error) => {
          if (error.status == 404) this.table = [];
          console.error('Error fetching data:', error);
        }
      );
  }

  obtenerDatos() {
    const catalogType = this.signalsService.getCatalogSelected();
    this.rowData = [];
    console.log(`Obteniendo datos para tipo: ${catalogType}`);
  
    // Determina qué servicio usar
    const service = catalogType === 'ADMINISTRATION' 
      ? this.catalogAdmonService 
      : this.catalogService;
  
    service.getCatalogs(this.idRoot, this.selectedCatalog)
      .subscribe({
        next: (data: any[]) => this.rowData = data,
        error: (err) => console.error(`Error (${catalogType || 'desconocido'}):`, err)
      });
  }
  

  //OPERACIONES DE LOS GRIDS

  get colMaster(): ColDef[] {
    return [
      {
        field: 'id',
        headerName: 'Id',
        editable: true,
        filter: false,
        width: 80,
      },
      {
        field: 'description',
        headerName: 'Descripción',
        filterParams: {
          // can be 'windows' or 'mac'
          defaultToNothingSelected: true,
          //excelMode: 'mac',
        },
        editable: true,
        filter: true,
        width: 250,
        valueSetter: (params) => {
          const rawValue = params.newValue;
          if (!rawValue || typeof rawValue !== 'string') {
            alerts.basicAlert('Campo requerido', 'El nombre es obligatorio', 'error');
            return false;
          }
      
          const normalizedValue = rawValue.trim().toUpperCase();
      
          if (!normalizedValue) {
            alerts.basicAlert('Campo requerido', 'El nombre es obligatorio', 'error');
            return false;
          }
      
          const duplicateExists = this.rowData.some(
            (row, index) =>
              index !== params.node.rowIndex &&
              row.description?.toUpperCase() === normalizedValue
          );
      
          if (duplicateExists) {
            alerts.basicAlert(
              'Nombre duplicado',
              'Ya existe un empleado con ese nombre.',
              'error'
            );
            return false;
          }
      
          params.data[params.colDef.field] = normalizedValue;
          return true;
        },
      },
      {
        field: 'valueAddition',
        headerName: this.selectedCatalog !== 'BONUS' ? 'Color' : 'Monto',
        cellRenderer:
          this.selectedCatalog !== 'BONUS' ? ColorPickerRenderer : '',
        cellRendererParams: {
          onChange: (valueAddition: string) => {},
        },
        editable: true,
        width: 100,
        hide:
          this.selectedCatalog !== 'BONUS' &&
          this.selectedCatalog !== 'TYPECLIENT', // Oculta si no es BONUS
      },
      {
        field: 'vigente',
        headerName: 'Activo',
        editable: true,
        width: 100,
      },
    ];
  }

  public frameworkComponents = {
    colorPickerRenderer: ColorPickerRenderer,
  };

  onSelectedRow(event: RowSelectedEvent): void {
    if (event.node && event.node.isSelected()) {
      // Verificar si la fila está seleccionada
      const selectedRowData = event.data;
      const selectedId = selectedRowData?.id;

      if (selectedId) {
        // Actualiza el servicio de señales
        this.signalsService.setProcces(parseInt(selectedId));

        // Asigna los datos seleccionados
        this.selectedRowData = selectedRowData;

        // Forzar la actualización del componente hijo
        this.showDetailsTab = false;
        setTimeout(() => {
          this.showDetailsTab = true;
        }, 0);
      }
    }
  }

  onCellValueChanged(event: any) {
    console.log('Dato cambiado:', event.data);
    event.data.__modified = true;
    this.notSavedChanges = true;
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  // Column Definitions: Defines the columns to be displayed.
  public gridOptions: any = {
    headerHeight: 30,
    rowHeight: 20,
    rowClass: (params) => {
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

  onSelectionChanged(event: any) {
    const selectedNodes = event.api.getSelectedNodes();
    if (selectedNodes.length > 0) {
      this.selectedRowData = selectedNodes[0].data;
    } else {
      this.selectedRowData = null;
    }
  }

  private cleanDataForServer(data: any): any {
    const cleanedData = { ...data };
    delete cleanedData.__isNew;
    delete cleanedData.__modified;
    if (cleanedData.id && cleanedData.id.toString().startsWith('temp_')) {
      delete cleanedData.id;
    }
    return cleanedData;
  }

  ///OPERATIONS DE LOS GRABADOS
  addRow() {
    const tempId = `temp_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId,
      idCompany: this.idRoot,
      description: '',
      valueAddition: '',
      type: this.selectedCatalog,
      vigente: true,
      active: 1,
      __isNew: true,
    };
    this.rowData = [newItem, ...this.rowData];
    this.newlyAddedRows.push(tempId);
    this.notSavedChanges = true;
  }

  async saveChanges() {
    const isValid = this.rowData.every((item) => item.description);
    if (!isValid) {
      alerts.basicAlert(
        'Añadir entrada',
        'Debe llenar todos los campos antes de guardar.',
        'error'
      );
      return;
    }

    const newRows = this.rowData.filter((row) => row.__isNew);
    const modifiedRows = this.rowData.filter(
      (row) => row.__modified && !row.__isNew
    );

    // console.log('modifiedRows', modifiedRows);

    const addObservables = newRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);

      cleanedData.valueAddition = String(cleanedData.valueAddition);
      console.log('añadidos', cleanedData.valueAddition);
      return this, this.catalogService.addCatalog(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      cleanedData.valueAddition = String(cleanedData.valueAddition);
      return this.catalogService.updateCatalog(row.id, cleanedData);
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
      this.notSavedChanges = false;
      this.newlyAddedRows = [];
      this.obtenerDatos(); // Refrescar los datos
    } catch (error) {
      console.error(error);
      alerts.basicAlert(
        'Error',
        'Ocurrió un error al actualizar los datos. Por favor, intente nuevamente.',
        'error'
      );
    }
  }

  revert() {
    this.obtenerTables();
    this.obtenerDatos();
    this.notSavedChanges = false;

  }

  deleteEntry() {}

  // ==================== GUARD ALERT UNSAVED CHANGES ====================

  async canDeactivate(): Promise<boolean> {
    return confirmExitIfUnsaved(this.notSavedChanges);
  }
}

// Componente personalizado para el color picker
@Component({
  selector: 'color-picker-renderer',
  template: `
    <input
      type="color"
      [value]="color"
      (input)="onChange($event)"
      style="width: 100%; height: 100%; border: none;"
    />
  `,
})
export class ColorPickerRenderer implements ICellRendererAngularComp {
  public color: string = '#ffffff';
  public params: any;

  agInit(params: any): void {
    this.params = params;
    this.color = params.value || '#ffffff';
  }

  refresh(params: any): boolean {
    this.color = params.value;
    return true;
  }

  onChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.color = input.value;

    // Llama a la función onChange si existe
    if (this.params?.onChange) {
      this.params.onChange(this.color);
    }

    // ✅ ACTUALIZAR EL DATO EN LA FILA
    if (this.params?.data) {
      this.params.data[this.params.colDef.field] = this.color;
      this.params.data.__modified = true; // Marcar como modificado si aplica
    }
  }
}
