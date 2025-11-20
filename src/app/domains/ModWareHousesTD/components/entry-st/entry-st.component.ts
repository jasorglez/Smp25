import { Component, OnInit, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { SignalsService } from 'app/services/signals.service';
import { PermitionsService } from 'app/services/permitions.service';
import { TrackingService } from 'app/services/tracking.service';
import { InandoutService } from 'app/services/inandout.service';
import { CatalogsService } from 'app/services/catalogs.service';
import { MaterialsService } from 'app/services/materials.service';
import { DetailCellRendererEntryItemsComponent } from './detail-cell-renderer-entry-items.component';
import { alerts } from 'app/helpers/alerts';
import { ButtonCellRendererComponent } from './button-cell-renderer.component';
import { lastValueFrom } from 'rxjs';

@Component({
  selector: 'app-entry-st',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, DetailCellRendererEntryItemsComponent],
  templateUrl: './entry-st.component.html'
})
export class EntryStComponent implements OnInit {

  private gridApi!: GridApi;
  private signalsService = inject(SignalsService);
  private permitionsService = inject(PermitionsService);
  private trackingService = inject(TrackingService);
  private inandoutService = inject(InandoutService);
  private catalogsService = inject(CatalogsService);
  private materialsService = inject(MaterialsService);

  rowData: any[] = [];
  selectedWarehouse: any = null;
  warehouses: any[] = [];
  gridHeight: string = '80vh';
  selectedEntry: any = null;
  hasUnsavedChanges: boolean = false;
  idRoot: number | null = null;
  newlyAddedRows: string[] = [];
  private tempIdCounter: number = 0;

  catalogs: any[] = [];
  selectedCatalog: any = null;
  isDirectEntryMode: boolean = false;

  public rowSelection: 'single' | 'multiple' = 'single';
  public paginationPageSize = 15;
  public paginationPageSizeSelector: number[] | boolean = [15, 50, 100];
  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  constructor() {
    effect(() => {
      this.idRoot = this.signalsService.getRootSelectedBySidebar()();
      const email = this.trackingService.getEmail();
      if (this.idRoot && email) {
        this.loadWarehouses(email);
        this.loadCatalogs();
      }
    });
  }

  ngOnInit() {
    const email = this.trackingService.getEmail();
    if (this.idRoot && email) {
      this.loadWarehouses(email);
      this.loadCatalogs();
    }
  }

  loadWarehouses(email: string) {
    this.permitionsService.getPermisionswarehousexEmail(email).subscribe({
      next: (data) => {
        this.warehouses = data;
        if (this.warehouses.length > 0) {
          this.selectedWarehouse = this.warehouses[0];
          this.loadEntries();
        }
      },
      error: (error) => {
        console.error('Error loading warehouses:', error);
        alerts.basicAlert('Error', 'Error al cargar almacenes', 'error');
      }
    });
  }

  loadCatalogs() {
    if (!this.idRoot) return;

    this.catalogsService.getCatalogs(this.idRoot, 'INPUT').subscribe({
      next: (data) => {
        this.catalogs = data;
        if (this.catalogs.length > 0) {
          this.selectedCatalog = this.catalogs[0];
        }
        console.log('Catalogs loaded:', this.catalogs);
      },
      error: (error) => {
        console.error('Error loading catalogs:', error);
      }
    });
  }

  onWarehouseChange() {
    this.loadEntries();
  }

  onCatalogChange() {
    this.loadEntries();
  }

  loadEntries() {
    if (!this.selectedWarehouse || !this.idRoot) return;

    this.inandoutService.getInAndOuts(this.idRoot, this.selectedWarehouse.idAlmacen, 'IN').subscribe({
      next: (data: any[]) => {
        this.rowData = data.map(entry => ({
          ...entry,
          countrow: entry.countRow || 0,
          detailType: null,
          detailData: []
        }));
        console.log('Entries loaded:', this.rowData);
      },
      error: (error) => {
        console.error('Error loading entries:', error);
        alerts.basicAlert('Error', 'Error al cargar entradas', 'error');
      }
    });
  }

  public gridOptions: any = {
    headerHeight: 35,
    rowHeight: 35,
    animateRows: true,
    masterDetail: true,
    detailRowHeight: 400,
    isRowMaster: (dataItem: any) => true,
    detailCellRenderer: DetailCellRendererEntryItemsComponent,
    getRowClass: (params: any) => {
      if (params.node.isSelected()) {
        return 'selected-row';
      }
      if (params.data.__isNew) {
        return 'new-row-highlight';
      }
      if (params.data.__modified) {
        return 'modified-row';
      }
      return '';
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
    onCellValueChanged: (event: any) => {
      console.log('Cell value changed:', event);

      if (event.colDef.field === 'directEntry') {
        event.data.directEntry = event.newValue === true || event.newValue === 1 ? true : false;
        console.log('Direct Entry changed to:', event.data.directEntry);
      }

      event.data.__modified = true;
      this.hasUnsavedChanges = true;
      setTimeout(() => {
        this.gridApi.refreshCells({ rowNodes: [event.node], force: true });
      }, 0);
    }
  };

  get colMaster(): ColDef[] {
    return [
      {
        field: 'countrow',
        headerName: 'Items',
        width: 90,
        cellRenderer: ButtonCellRendererComponent,
        cellRendererParams: {
          onClick: (node: any) => this.toggleCascade(node),
        },
        valueGetter: params => params.data.countrow || 0,
        editable: false,
        cellStyle: { backgroundColor: '#e8f5e9', cursor: 'pointer', textDecoration: 'underline' }
      },
      {
        field: 'folio',
        headerName: 'Folio',
        width: 120,
        filter: true,
        editable: true,
        valueSetter: (params: any) => {
          params.data.folio = params.newValue ? params.newValue.toUpperCase() : '';
          return true;
        }
      },
      {
        field: 'date',
        headerName: 'Fecha',
        width: 120,
        editable: true,
        valueFormatter: (params: any) => {
          if (!params.value) return '';
          return new Date(params.value).toLocaleDateString();
        },
        valueSetter: (params: any) => {
          params.data.date = params.newValue;
          return true;
        }
      },
      {
        field: 'directEntry',
        headerName: 'Entrada Directa',
        width: 120,
        editable: true,
        cellRenderer: 'agCheckboxCellRenderer',
        cellEditor: 'agCheckboxCellEditor',
        onCellValueChanged: (params: any) => {
          this.isDirectEntryMode = params.newValue;
        }
      },
      {
        field: 'ocList',
        headerValueGetter: () => this.isDirectEntryMode ? 'Cliente' : 'OC',
        width: 150,
        editable: true,
        cellStyle: { backgroundColor: this.isDirectEntryMode ? '#fff3e0' : '#e3f2fd' },
        valueSetter: (params: any) => {
          params.data.ocList = params.newValue ? params.newValue.toUpperCase() : '';
          return true;
        }
      },
      {
        field: 'deliveryDate',
        headerName: 'Fecha Entrega',
        width: 180,
        editable: true,
        valueFormatter: (params: any) => {
          if (!params.value) return '';
          return new Date(params.value).toLocaleDateString();
        },
        valueSetter: (params: any) => {
          params.data.deliveryDate = params.newValue;
          return true;
        }
      },
      {
        field: 'numBill',
        headerName: 'Factura',
        width: 120,
        editable: true,
        valueSetter: (params: any) => {
          params.data.numBill = params.newValue ? params.newValue.toUpperCase() : '';
          return true;
        }
      },
      {
        field: 'deliverName',
        headerName: 'Entregado Por',
        width: 200,
        editable: true,
        valueSetter: (params: any) => {
          params.data.deliverName = params.newValue ? params.newValue.toUpperCase() : '';
          return true;
        }
      },
      {
        field: 'comment',
        headerName: 'Comentario',
        width: 400,
        editable: true,
        valueSetter: (params: any) => {
          params.data.comment = params.newValue ? params.newValue.toUpperCase() : '';
          return true;
        }
      }
    ];
  }

  onCellClicked(event: any): void {
    event.node.setSelected(true);

    const colId = event.column.getColId();
    const isDetailColumn = colId === 'countrow';

    if (isDetailColumn) {
      const node = event.node;
      const api = event.api;

      const isCurrentlyExpanded = node.expanded && event.data.detailType === 'items';

      if (isCurrentlyExpanded) {
        // Si ya está expandido, colapsarlo y mostrar todas las filas
        node.setExpanded(false);

        api.forEachNode((otherNode: any) => {
          otherNode.setRowHeight(undefined);
        });
        api.onRowHeightChanged();
      } else {
        // Colapsar cualquier otra fila expandida
        api.forEachNode((otherNode: any) => {
          if (otherNode.expanded && otherNode.id !== node.id) {
            otherNode.setExpanded(false);
          }
        });

        // Ocultar todas las demás filas (altura 0)
        api.forEachNode((otherNode: any) => {
          if (otherNode.id !== node.id) {
            otherNode.setRowHeight(0);
          }
        });

        // Si la fila está expandida con otro tipo de detalle, cerrarla primero
        if (node.expanded && event.data.detailType !== 'items') {
          node.setExpanded(false);
        }

        // Cambiar el tipo de detalle
        event.data.detailType = 'items';

        // Aplicar los cambios de altura
        api.onRowHeightChanged();

        // Expandir con el detalle correspondiente
        setTimeout(() => {
          node.setExpanded(true);
        }, 0);
      }
    }
  }

  toggleCascade(node: any) {
    const event = {
      node: node,
      api: this.gridApi,
      data: node.data,
      column: { getColId: () => 'countrow' }
    };
    this.onCellClicked(event);
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;

    this.gridApi.setGridOption('detailCellRendererParams', {
      getDetailRowData: (params) => {
        params.successCallback(params.data.detailData);
      },
      context: {
        idRoot: this.idRoot,
        componentParent: this,
        gridApi: this.gridApi,
        ITEMS: {
          load: (entryId: number, callback: (data: any[]) => void) => {
            this.loadEntryItemsData(entryId, callback);
          },
          save: (entryId: number, data: any[]) => {
            this.saveEntryItemsById(entryId, data);
          },
          delete: (params: any, callback: () => void) => {
            this.deleteDetailRow(params, callback, 'ITEMS');
          },
          updateCount: (entryId: number, count: number) => {
            this.updateEntryItemsCount(entryId, count);
          }
        },
        materialsService: this.materialsService
      }
    });
  }

  onSelectionChanged(event: any): void {
    const selectedRows = event.api.getSelectedRows();
    this.selectedEntry = selectedRows.length > 0 ? selectedRows[0] : null;
  }

  onCellValueChanged(event: any): void {
    if (event.colDef.field === 'directEntry') {
      this.isDirectEntryMode = event.newValue;
    }
    this.hasUnsavedChanges = true;
  }

  onCellEditingStopped(event: any): void {
    if (event.colDef.field === 'directEntry') {
      this.isDirectEntryMode = event.newValue;
    }
  }

  onCellDoubleClicked(event: any): void {
    if (event.colDef.editable) {
      this.gridApi.startEditingCell({
        rowIndex: event.rowIndex,
        colKey: event.column.getColId()
      });
    }
  }

  addEntry(): void {
    const tempId = `temp_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId,
      idProject: this.idRoot,
      idWarehouse: this.selectedWarehouse.idAlmacen,
      idType: this.selectedCatalog?.id || 0,
      folio: '',
      date: new Date().toISOString(),
      deliveryDate: new Date().toISOString(),
      idOc: 0,
      numBill: '',
      deliverName: 'POR CLIENTE',
      comment: '',
      type: 'IN',
      active: true,
      directEntry: false,
      ocList: '',
      countrow: 0,
      detailType: null,
      detailData: [],
      __isNew: true,
    };

    this.rowData = [newItem, ...this.rowData];
    this.newlyAddedRows.push(tempId);
    this.hasUnsavedChanges = true;
    this.gridApi.setGridOption('rowData', this.rowData);

    setTimeout(() => {
      const firstRowIndex = 0;
      this.gridApi.ensureIndexVisible(firstRowIndex);
      this.gridApi.startEditingCell({
        rowIndex: firstRowIndex,
        colKey: 'folio'
      });
    }, 0);
  }

  editEntry(): void {
    if (!this.selectedEntry) {
      alerts.basicAlert('Selección requerida', 'Por favor seleccione una entrada para editar', 'warning');
      return;
    }

    const selectedNode = this.gridApi.getSelectedNodes()[0];
    if (selectedNode) {
      this.gridApi.startEditingCell({
        rowIndex: selectedNode.rowIndex!,
        colKey: 'folio'
      });
    }
  }

  async deleteEntry(): Promise<void> {
    if (!this.selectedEntry) {
      alerts.basicAlert('Selección requerida', 'Por favor seleccione una entrada para eliminar', 'warning');
      return;
    }

    const result = await alerts.confirmAlert(
      '¿Eliminar entrada?',
      `¿Está seguro de eliminar la entrada ${this.selectedEntry.folio}?`,
      'warning',
      'Sí, eliminar'
    );

    if (result.isConfirmed) {
      try {
        const entryId = typeof this.selectedEntry.id === 'string' ?
          parseInt(this.selectedEntry.id.replace('temp_', '')) :
          this.selectedEntry.id;

        await lastValueFrom(this.inandoutService.deleteInAndOut(entryId));
        alerts.basicAlert('Eliminado', 'La entrada ha sido eliminada correctamente', 'success');
        this.selectedEntry = null;
        this.loadEntries();
      } catch (error: any) {
        console.error('Error al eliminar entrada:', error);
        const errorMsg = error?.error?.message || error?.message || 'Error desconocido';
        alerts.basicAlert('Error', `No se pudo eliminar la entrada: ${errorMsg}`, 'error');
      }
    }
  }

  async saveChanges(): Promise<void> {
    if (!this.hasUnsavedChanges) {
      alerts.basicAlert('Sin cambios', 'No hay cambios pendientes por guardar', 'info');
      return;
    }

    const newRows = this.rowData.filter((row: any) => row.__isNew);
    const modifiedRows = this.rowData.filter((row: any) => row.__modified && !row.__isNew);

    if (newRows.length === 0 && modifiedRows.length === 0) {
      alerts.basicAlert('Sin cambios', 'No hay cambios pendientes por guardar', 'info');
      this.hasUnsavedChanges = false;
      return;
    }

    try {
      for (const newRow of newRows) {
        const entryData = this.prepareEntryData(newRow);
        await lastValueFrom(this.inandoutService.addInAndOut(entryData));
      }

      for (const modifiedRow of modifiedRows) {
        const entryData = this.prepareEntryData(modifiedRow);
        await lastValueFrom(this.inandoutService.updateInAndOut(modifiedRow.id, entryData));
      }

      alerts.basicAlert('Guardado', 'Los cambios han sido guardados correctamente', 'success');
      this.hasUnsavedChanges = false;
      this.loadEntries();
    } catch (error: any) {
      console.error('Error al guardar cambios:', error);
      const errorMsg = error?.error?.message || error?.message || 'Error desconocido';
      alerts.basicAlert('Error', `No se pudieron guardar los cambios: ${errorMsg}`, 'error');
    }
  }

  private prepareEntryData(row: any): any {
    return {
      idProject: this.idRoot,
      idWarehouse: this.selectedWarehouse.idAlmacen,
      idType: this.selectedCatalog?.id || 0,
      folio: row.folio || '',
      date: row.date || new Date().toISOString(),
      deliveryDate: row.deliveryDate || new Date().toISOString(),
      idOc: 0,
      numBill: row.numBill || '',
      deliverName: row.deliverName || '',
      comment: row.comment || '',
      type: 'IN',
      active: row.active ?? true,
      directEntry: row.directEntry === true || row.directEntry === 1 ? true : false,
      ocList: row.ocList || '',
      countrow: row.countrow || 0
    };
  }

  refreshData(): void {
    this.loadEntries();
    this.selectedEntry = null;
    this.hasUnsavedChanges = false;
    alerts.basicAlert('Recargado', 'Los datos han sido recargados', 'success');
  }

  // ==================== MÉTODOS CRUD PARA ITEMS DE ENTRADA ====================

  loadEntryItemsData(entryId: number, successCallback: any) {
    this.inandoutService.getInAndOutItems(entryId).subscribe({
      next: (data: any) => {
        successCallback(data);
      },
      error: (error) => {
        console.error('Error loading entry items:', error);
        successCallback([]);
      }
    });
  }

  async saveEntryItemsById(entryId: number, data: any[]) {
    const newItems = data.filter((row: any) => row.__isNew);
    const modifiedItems = data.filter((row: any) => row.__modified && !row.__isNew);

    try {
      for (const item of newItems) {
        const cleaned = this.cleanItemData(item);
        await lastValueFrom(this.inandoutService.addInAndOutItem(cleaned));
      }

      for (const item of modifiedItems) {
        const cleaned = this.cleanItemData(item);
        await lastValueFrom(this.inandoutService.updateInAndOutItem(item.id, cleaned));
      }

      if (newItems.length > 0 || modifiedItems.length > 0) {
        alerts.basicAlert(
          'Detalles guardados',
          'Se han guardado los items correctamente.',
          'success'
        );

        // Actualizar el contador de items localmente
        this.updateEntryItemsCount(entryId, data.length);

        // Persistir el countrow en el backend
        const masterEntry = this.rowData.find(entry => entry.id === entryId);
        if (masterEntry) {
          masterEntry.countrow = data.length;
          const entryData = this.prepareEntryData(masterEntry);
          await lastValueFrom(this.inandoutService.updateInAndOut(String(entryId), entryData));
          console.log(`✅ Persistido countrow=${data.length} para entrada ${entryId}`);
        }

        // Limpiar los flags
        data.forEach(row => {
          delete row.__isNew;
          delete row.__modified;
        });
      }

    } catch (error) {
      console.error('Error saving entry items:', error);
      alerts.basicAlert(
        'Error',
        'Error al guardar los items.',
        'error'
      );
    }
  }

  async deleteDetailRow(params: any, successCallback: () => void, type: string) {
    const entryId = params.data.idInandout;
    const detailId = params.data.id;

    if (params.data.__isNew) {
      params.api.applyTransaction({ remove: [params.data] });
      this.hasUnsavedChanges = true;
      // Update count in master grid
      const currentCount = params.api.getDisplayedRowCount();
      this.updateEntryItemsCount(entryId, currentCount - 1);
      successCallback();
    } else {
      try {
        await lastValueFrom(this.inandoutService.deleteInAndOutItem(detailId));
        alerts.basicAlert('Item eliminado', 'El item se eliminó correctamente.', 'success');
        successCallback();
      } catch (error) {
        console.error('Error deleting detail row:', error);
        alerts.basicAlert(
          'Error',
          'Error al eliminar el item.',
          'error'
        );
      }
    }
  }

  private cleanItemData(data: any): any {
    const cleanedData = { ...data };
    delete cleanedData.__isNew;
    delete cleanedData.__modified;
    delete cleanedData.material;
    delete cleanedData.materialName;
    if (cleanedData.id && cleanedData.id.toString().startsWith('temp_item_')) {
      delete cleanedData.id;
    }
    return cleanedData;
  }

  // Método para actualizar el countrow count de una entrada específica
  updateEntryItemsCount(entryId: number, count: number) {
    if (this.gridApi) {
      this.gridApi.forEachNode((node) => {
        if (node.data && node.data.id === entryId) {
          node.data.countrow = count;
          this.gridApi.refreshCells({
            rowNodes: [node],
            columns: ['countrow'],
            force: true
          });
          console.log(`✅ Actualizado "Items" para entrada ${entryId}: ${count}`);
        }
      });
    }
  }
}