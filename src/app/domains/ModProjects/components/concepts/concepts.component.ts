import { Component, effect, inject, OnInit, ChangeDetectorRef} from '@angular/core';
import { TdConceptsService } from 'app/services/td-concepts.service';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import {
  ColDef,
  GridApi,
  GridReadyEvent,
  RowSelectedEvent,
} from 'ag-grid-enterprise';
import { AgGridModule } from 'ag-grid-angular';
import { alerts } from 'app/helpers/alerts';
import { CanComponentDeactivate } from 'app/guards/unsaved-changes.guard';
import { confirmExitIfUnsaved } from 'app/helpers/can-deactivate.helper';
import { concat, lastValueFrom } from 'rxjs';
import { toArray } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { SignalsService } from 'app/services/signals.service';

@Component({
  selector: 'app-concepts',
  standalone: true,
  imports: [
    AgGridModule,
    CommonModule,
    TranslateModule
  ],
  templateUrl: './concepts.component.html',
  styleUrl: './concepts.component.scss',
})
export class ConceptsComponent implements OnInit, CanComponentDeactivate {
  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;
  notSavedChanges: boolean = false;
  rowData: any[] = [];
  selectedRowData: any = null;
  private gridApi: GridApi;
  private tempIdCounter: number = 0;
  newlyAddedRows: string[] = [];

  private tdConceptsService = inject(TdConceptsService);
  private readonly cdr = inject(ChangeDetectorRef);
  private signalsService = inject(SignalsService);

  public rowSelection: 'single' | 'multiple' = 'single';
  private idCompany: number;

  constructor() {
    // ✅ Usar effect para reaccionar a cambios en el signal
    effect(() => {
      this.idCompany = this.signalsService.getRootSelectedBySidebar()();

      // Solo cargar datos si idCompany tiene un valor válido
      if (this.idCompany) {
        this.loadData();
      } else {
        console.warn('⚠️ idCompany no está disponible aún');
      }
    });
  }

  async ngOnInit(): Promise<void> {
    // ✅ Verificar si idCompany ya está disponible al inicializar
    if (!this.idCompany) {
    }
  }

  async loadData(): Promise<void> {
    // ✅ Validar nuevamente antes de hacer la petición
    if (!this.idCompany) {
      console.error('⚠️ No se puede cargar datos: idCompany no está disponible');
      return;
    }

    this.tdConceptsService.getTDConcepts(this.idCompany).subscribe({
      next: (data: any[]) => {
        this.rowData = data;
      },
      error: (err) => {
        console.error('Error loading TDConcepts:', err);
        alerts.basicAlert(
          'Error',
          'Error al cargar los conceptos',
          'error'
        );
      }
    });
  }

  get columnDefs(): ColDef[] {
    return [
      {
        field: 'id',
        headerName: 'ID',
        width: 80,
        hide: true,
        filter: 'agNumberColumnFilter',
      },
      {
        field: 'description',
        headerName: 'Descripcion',
        editable: false,
        filter: true,
        flex: 2,
        valueSetter: (params) => {
          const rawValue = params.newValue;
          if (!rawValue || typeof rawValue !== 'string') {
            alerts.basicAlert('Campo requerido', 'La descripción es obligatoria', 'error');
            return false;
          }

          const normalizedValue = rawValue.trim().toUpperCase();

          if (!normalizedValue) {
            alerts.basicAlert('Campo requerido', 'La descripción es obligatoria', 'error');
            return false;
          }

          const duplicateExists = this.rowData.some(
            (row, index) =>
              index !== params.node.rowIndex &&
              row.description?.toUpperCase() === normalizedValue
          );

          if (duplicateExists) {
            alerts.basicAlert(
              'Descripción duplicada',
              'Ya existe un concepto con esa descripción.',
              'error'
            );
            return false;
          }

          params.data[params.colDef.field] = normalizedValue;
          return true;
        },
      },
      {
        field: 'internalTeamValue',
        headerName: 'Cuadrilla Int.',
        editable: (params) => {
          return params.data.internalTeamValue !== null && params.data.internalTeamValue !== undefined;
        },
        flex: 1,
        filter: 'agNumberColumnFilter',
        cellStyle: (params) => {
          if (params.value === null || params.value === undefined) {
            return { backgroundColor: '#f0f0f0', cursor: 'not-allowed' };
          }
          return null;
        },
        valueFormatter: (params) => {
          return params.value !== null && params.value !== undefined
            ? `$${Number(params.value).toLocaleString('es-MX', {
              minimumFractionDigits: 2,
            })}`
            : 'N/A';
        },
        valueSetter: (params) => {
          const value = parseFloat(params.newValue);
          if (isNaN(value)) {
            alerts.basicAlert('Valor inválido', 'Debe ingresar un número válido', 'error');
            return false;
          }
          params.data[params.colDef.field] = value;
          return true;
        },
      },
      {
        field: 'externalTeamValue',
        headerName: 'Cuadrilla Ext.',
        editable: (params) => {
          return params.data.externalTeamValue !== null && params.data.externalTeamValue !== undefined;
        },
        flex: 1,
        filter: 'agNumberColumnFilter',
        cellStyle: (params) => {
          if (params.value === null || params.value === undefined) {
            return { backgroundColor: '#f0f0f0', cursor: 'not-allowed' };
          }
          return null;
        },
        valueFormatter: (params) => {
          return params.value !== null && params.value !== undefined
            ? `$${Number(params.value).toLocaleString('es-MX', {
              minimumFractionDigits: 2,
            })}`
            : 'N/A';
        },
        valueSetter: (params) => {
          const value = parseFloat(params.newValue);
          if (isNaN(value)) {
            alerts.basicAlert('Valor inválido', 'Debe ingresar un número válido', 'error');
            return false;
          }
          params.data[params.colDef.field] = value;
          return true;
        },
      },
    ];
  }

  public defaultColDef: ColDef = {
    sortable: true,
    filter: true,
    resizable: true,
    minWidth: 100
  };

  public gridOptions: any = {
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
    onFirstDataRendered: (params: any) => {
      const allColumnIds: string[] = [];
      params.api.getColumns()?.forEach((column: any) => {
        allColumnIds.push(column.getId());
      });
      params.api.autoSizeColumns(allColumnIds, false);
    }
  };

  onGridReady(params: GridReadyEvent): void {
    this.gridApi = params.api;
  }

  autoSizeAllColumns(): void {
    if (!this.gridApi) return;
    const allColumnIds: string[] = [];
    this.gridApi.getColumns()?.forEach((column: any) => {
      allColumnIds.push(column.getId());
    });
    this.gridApi.autoSizeColumns(allColumnIds, false);
  }

  onCellValueChanged(event: any): void {
    event.data.__modified = true;
    this.notSavedChanges = true;
  }

  onSelectionChanged(event: any): void {
    const selectedNodes = event.api.getSelectedNodes();
    if (selectedNodes.length > 0) {
      this.selectedRowData = selectedNodes[0].data;
    } else {
      this.selectedRowData = null;
    }
  }

  addRow(): void {
    const tempId = `temp_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId,
      description: '',
      internalTeamValue: 0,
      externalTeamValue: 0,
      active: true,
      __isNew: true,
    };
    this.rowData = [newItem, ...this.rowData];
    this.newlyAddedRows.push(tempId);
    this.notSavedChanges = true;

    setTimeout(() => {
      const firstRowIndex = 0;
      this.gridApi.ensureIndexVisible(firstRowIndex);
      this.gridApi.startEditingCell({
        rowIndex: firstRowIndex,
        colKey: 'description'
      });
    }, 0);
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

  async saveChanges(): Promise<void> {
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

    const addObservables = newRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.tdConceptsService.addTDConcept(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.tdConceptsService.updateTDConcept(row.id, cleanedData);
    });

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
      this.loadData();
    } catch (error) {
      console.error(error);
      alerts.basicAlert(
        'Error',
        'Ocurrió un error al actualizar los datos. Por favor, intente nuevamente.',
        'error'
      );
    }
  
    this.cdr.detectChanges();}

  revert(): void {
    this.loadData();
    this.notSavedChanges = false;
  }

  async deleteEntry(): Promise<void> {
    if (!this.selectedRowData) {
      alerts.basicAlert(
        'Seleccione un registro',
        'Debe seleccionar un registro para eliminar.',
        'warning'
      );
      return;
    }

    const result = await alerts.confirmAlert(
      '¿Está seguro?',
      '¿Desea eliminar este concepto?',
      'warning',
      'Sí, eliminar'
    );

    if (!result.isConfirmed) {
      return;
    }

    try {
      await lastValueFrom(this.tdConceptsService.deleteTDConcept(this.selectedRowData.id));
      alerts.basicAlert(
        'Eliminado',
        'El concepto ha sido eliminado correctamente.',
        'success'
      );
      this.loadData();
    } catch (error) {
      console.error(error);
      alerts.basicAlert(
        'Error',
        'Ocurrió un error al eliminar el concepto.',
        'error'
      );
    }
  
    this.cdr.detectChanges();}

  async canDeactivate(): Promise<boolean> {
    return confirmExitIfUnsaved(this.notSavedChanges);
  }
}
