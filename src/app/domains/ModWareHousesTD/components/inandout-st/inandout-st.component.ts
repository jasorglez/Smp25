import { Component, OnInit, inject, effect, Input } from '@angular/core';
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
import { OtService } from 'app/services/ot.service';
import { DetailCellRendererEntryItemsComponent } from './detail-cell-renderer-entry-items.component';
import { alerts } from 'app/helpers/alerts';
import { ButtonCellRendererComponent } from './button-cell-renderer.component';
import { lastValueFrom } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { UsersService } from 'app/services/users.service';

@Component({
  selector: 'app-inandout-st',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, DetailCellRendererEntryItemsComponent],
  templateUrl: './inandout-st.component.html',
})
export class InandoutStComponent implements OnInit {

  private gridApi!: GridApi;
  private signalsService = inject(SignalsService);
  private permitionsService = inject(PermitionsService);
  private trackingService = inject(TrackingService);
  private inandoutService = inject(InandoutService);
  private catalogsService = inject(CatalogsService);
  private materialsService = inject(MaterialsService);
  private otService = inject(OtService);
  private route = inject(ActivatedRoute);
  private usersService = inject(UsersService);

  rowData: any[] = [];
  selectedWarehouse: any = null;
  warehouses: any[] = [];
  gridHeight: string = '78vh';
  selectedEntry: any = null;
  hasUnsavedChanges: boolean = false;
  idRoot: number | null = null;
  idBranch: number | null = null;
  projectId: number | null = null;
  movementType: 'IN' | 'OUT' = 'IN';
  newlyAddedRows: string[] = [];
  private tempIdCounter: number = 0;

  catalogs: any[] = [];
  selectedCatalog: any = null;
  otList: any[] = [];
  selectedOt: any = null;
  users: any[] = [];
  isDirectEntryMode: boolean = false;

  public rowSelection: 'single' | 'multiple' = 'single';
  public paginationPageSize = 15;
  public paginationPageSizeSelector: number[] | boolean = [15, 50, 100];
  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  constructor() {
    effect(() => {
      this.idRoot = this.signalsService.getRootSelectedBySidebar()();
      console.log('idRoot set to:', this.idRoot);
      const email = this.trackingService.getEmail();
      if (this.idRoot && email) {
        this.loadCatalogs();
        this.loadUsers();
      }
    });

    effect(() => {
      this.idBranch = this.signalsService.getBranchSelectedBySidebar()();
      console.log('idBranch set to:', this.idBranch);
    });

    effect(() => {
      this.projectId = this.signalsService.getProjectSelectedBySidebar()();
      console.log('projectId set to:', this.projectId);
      const email = this.trackingService.getEmail();
      if (this.projectId && email) {
        this.loadWarehouses(email);
        this.loadOts();
      }
    });
  }

  ngOnInit() {
    console.log('ngOnInit called');
    this.movementType = this.route.snapshot.data['movementType'] || 'IN';
    console.log('movementType:', this.movementType);

    this.loadUsers();

    const email = this.trackingService.getEmail();
    if (this.idRoot && email) {
      this.loadCatalogs();
    }
    if (this.projectId && email) {
      this.loadWarehouses(email);
      this.loadOts();
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

    this.catalogsService.getCatalogs(this.idRoot, this.movementType).subscribe({
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

  loadOts() {
    if (!this.projectId) return;

    this.otService.get2fieldsByPect(this.projectId).subscribe({
      next: (data) => {
        this.otList = data;
        if (this.otList.length > 0) {
          this.selectedOt = this.otList[0];
        }
        console.log('OTs loaded:', this.otList);
      },
      error: (error) => {
        console.error('Error loading OTs:', error);
      }
    });
  }

  loadUsers() {
    if (!this.idRoot) return;

    this.usersService.get2fieldsUsers(this.idRoot).subscribe({
      next: (data) => {
        console.log('Users response:', data);
        this.users = data.data || data;
        console.log('Users loaded:', this.users);
        // Update columnDefs to refresh the combo options
        if (this.gridApi) {
          this.gridApi.setGridOption('columnDefs', this.colMaster);
        }
      },
      error: (error) => {
        console.error('Error loading users:', error);
      }
    });
  }

  onWarehouseChange() {
    this.loadEntries();
  }

  onCatalogChange() {
    this.loadEntries();
  }

  onOtChange() {
    this.loadEntries();
  }


  loadEntries() {
    if (!this.selectedWarehouse || !this.projectId) return;

    this.inandoutService.getInAndOuts(this.projectId, this.selectedWarehouse.idAlmacen, this.movementType).subscribe({
      next: (data: any[]) => {
        this.rowData = data.map(entry => ({
          ...entry,
          countrow: entry.countRow || 0,
          detailType: null,
          detailData: []
        }));
        console.log(`${this.movementType === 'IN' ? 'Entries' : 'Exits'} loaded:`, this.rowData);
      },
      error: (error) => {
        console.error(`Error loading ${this.movementType === 'IN' ? 'entries' : 'exits'}:`, error);
        alerts.basicAlert('Error', `Error al cargar ${this.movementType === 'IN' ? 'entradas' : 'salidas'}`, 'error');
      }
    });
  }

  public gridOptions: any = {
    headerHeight: 35,
    rowHeight: 35,
    animateRows: true,
    masterDetail: true,
    detailRowHeight: 700,
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

      if (event.colDef.field === 'idAutoriza') {
        console.log('idAutoriza changed to:', event.newValue, 'for row:', event.data.id);
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
        field: 'pdfReport',
        headerName: 'PDF',
        width: 90,
        cellRenderer: (params: any) => {
          return '<i class="bi bi-file-earmark-pdf" style="font-size: 1.2rem; color: #dc3545; cursor: pointer;"></i>';
        },
        editable: false,
        cellStyle: { textAlign: 'center', cursor: 'pointer' },
        onCellClicked: (params: any) => {
          this.toggleReportDetail(params.node);
        }
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
        field: 'idWarehouse',
        headerName: 'Almacén ID',
        width: 100,
        hide : true,
        editable: false
      },
      {
        field: 'idType',
        headerName: 'Tipo ID',
        width: 100,
        hide : true,
        editable: false
      },
      {
        field: 'idOt',
        headerName: 'OT ID',
        width: 100,
        hide : true,
        editable: false
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
        field: 'idAutoriza',
        headerName: 'Autorizado Por:',
        width: 200,
        editable: true,
        cellDataType: false,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: this.users.map(u => u.displayName)
        },
        valueFormatter: (params: any) => {
          const user = this.users.find(u => u.id === params.value);
          return user ? user.displayName : params.value;
        },
        valueSetter: (params: any) => {
          const user = this.users.find(u => u.displayName === params.newValue);
          if (user) {
            console.log('Setting idAutoriza to:', user.id);
            params.data.idAutoriza = user.id;
            params.data.__modified = true;
          }
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

  toggleReportDetail(node: any) {
    const api = this.gridApi;
    const isCurrentlyExpanded = node.expanded && node.data.detailType === 'report';

    if (isCurrentlyExpanded) {
      // Si ya está expandido con el reporte, colapsarlo
      node.setExpanded(false);

      // Restaurar alturas de todas las filas
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

      // Ocultar todas las demás filas
      api.forEachNode((otherNode: any) => {
        if (otherNode.id !== node.id) {
          otherNode.setRowHeight(0);
        }
      });

      // Si la fila está expandida con otro tipo de detalle, cerrarla
      if (node.expanded && node.data.detailType !== 'report') {
        node.setExpanded(false);
      }

      // Cambiar el tipo de detalle a 'report'
      node.data.detailType = 'report';

      // Aplicar cambios de altura
      api.onRowHeightChanged();

      // Expandir con el reporte
      setTimeout(() => {
        node.setExpanded(true);
      }, 0);
    }
  }

  collapseReportDetail(entryId: number) {
    if (this.gridApi) {
      this.gridApi.forEachNode((node) => {
        if (node.data && node.data.id === entryId) {
          node.setExpanded(false);
          node.data.detailType = null;
        }
      });

      // Restaurar alturas
      this.gridApi.forEachNode((node) => {
        node.setRowHeight(undefined);
      });
      this.gridApi.onRowHeightChanged();
    }
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;

    // Update columnDefs to ensure combo options are set
    this.gridApi.setGridOption('columnDefs', this.colMaster);

    this.gridApi.setGridOption('detailCellRendererParams', {
      getDetailRowData: (params) => {
        params.successCallback(params.data.detailData);
      },
      context: {
        idRoot: this.idRoot,
        componentParent: this,
        gridApi: this.gridApi,
        movementType: this.movementType,
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

    // Sincronizar los combo boxes con la fila seleccionada
    if (this.selectedEntry) {
      console.log('🔍 Fila seleccionada:', this.selectedEntry);
      console.log('📦 Warehouses disponibles:', this.warehouses);
      console.log('📋 Catalogs disponibles:', this.catalogs);
      console.log('🔧 OTs disponibles:', this.otList);

      // Sincronizar Almacén
      this.selectedWarehouse = this.warehouses.find(wh => wh.idAlmacen === this.selectedEntry.idWarehouse);
      console.log('✅ Warehouse sincronizado:', this.selectedWarehouse);

      // Sincronizar Catálogo/Tipo de Entrada
      this.selectedCatalog = this.catalogs.find(cat => cat.id === this.selectedEntry.idType);
      console.log('✅ Catalog sincronizado:', this.selectedCatalog);

      // Sincronizar OT
      this.selectedOt = this.otList.find(ot => ot.id === this.selectedEntry.idOt);
      console.log('✅ OT sincronizado:', this.selectedOt);
    }
  }

  onCellMouseOver(event: any): void {
    if (event.data) {
      this.selectedWarehouse = this.warehouses.find(wh => wh.idAlmacen === event.data.idWarehouse);
      this.selectedCatalog = this.catalogs.find(cat => cat.id === event.data.idType);
      this.selectedOt = this.otList.find(ot => ot.id === event.data.idOt);
    }
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
      idBranch: this.idBranch,
      idProject: this.projectId,
      idWarehouse: this.selectedWarehouse.idAlmacen,
      idType: this.selectedCatalog?.id || 0,
      idOt: this.selectedOt?.id || 0,
      folio: '',
      date: new Date().toISOString(),
      deliveryDate: new Date().toISOString(),
      idOc: 0,
      numBill: 'SIN FACTURA',
      deliverName: 'POR CLIENTE',
      idAutoriza: 0,
      comment: '',
      type: this.movementType,
      active: true,
      directEntry: false,
      //ocList: '',
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
    console.log('🚀 saveChanges called');
    if (!this.hasUnsavedChanges) {
      alerts.basicAlert('Sin cambios', 'No hay cambios pendientes por guardar', 'info');
      return;
    }

    const newRows = this.rowData.filter((row: any) => row.__isNew);
    const modifiedRows = this.rowData.filter((row: any) => row.__modified && !row.__isNew);

    console.log('📝 newRows:', newRows);
    console.log('✏️ modifiedRows:', modifiedRows);

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
      idBranch: this.idBranch,
      idProject: this.projectId,
      idWarehouse: this.selectedWarehouse.idAlmacen,
      idType: this.selectedCatalog?.id || 0,
      folio: row.folio || '',
      date: row.date || new Date().toISOString(),
      deliveryDate: row.deliveryDate || new Date().toISOString(),
      idOc: 0,
      numBill: row.numBill || '',
      deliverName: row.deliverName || '',
      idAutoriza: row.idAutoriza || 0,
      comment: row.comment || '',
      type: this.movementType,
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