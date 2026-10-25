import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent, ICellRendererParams } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { alerts } from 'app/helpers/alerts';
import { hasPersistedMasterId } from 'app/helpers/master-detail-guard';
import { TrackingService } from 'app/services/tracking.service';
import { restoreGridColumnWidths, saveGridColumnWidths } from 'app/helpers/grid-column-widths';

@Component({
  selector: 'app-detalles-requisiciones',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  templateUrl: './detalles-requisiciones.component.html',
  styleUrl: './detalles-requisiciones.component.scss'
})
export class DetallesRequisicionesComponent implements OnInit {
  private trackingService = inject(TrackingService);

  private params!: ICellRendererParams;
  private gridApi!: GridApi;
  private context: any;

  rowData: any[] = [];
  hasUnsavedChanges: boolean = false;
  tempIdCounter: number = 0;
  productos: any[] = [];
  materialBrands: any[] = [];
  codeQuery = '';
  codeMatches: any[] = [];
  isLocked: boolean = false; // True when requisition is assigned to a QUOTE
  isAuthorizationLocked: boolean = false;
  get isReadOnly(): boolean { return this.isLocked; }

  get masterSaved(): boolean {
    return hasPersistedMasterId(this.params?.data?.id, this.params?.data?.__isNew);
  }

  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  ngOnInit() {
    // Load initial data
    this.loadData();
  }

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.context = params.context;
    this.productos = this.context?.productos || [];
    this.materialBrands = this.context?.materialBrands || [];
    // Check if requisition is locked (assigned to a QUOTE for cotización)
    this.isAuthorizationLocked = Number(params.data?.idAuthorize) > 0;
    this.isLocked = params.data?.locked === true || this.isAuthorizationLocked;
    this.loadData();
  }

  closeDetail(): void {
    const parent = this.context?.componentParent;
    if (parent?.closeItemsDetail) parent.closeItemsDetail(this.params?.node);
    else this.params?.node?.setExpanded(false);
  }

  loadData() {
    if (!this.masterSaved) {
      this.rowData = [];
      this.gridApi?.setGridOption('rowData', this.rowData);
      return;
    }
    if (this.context && this.context.ITEMS && this.context.ITEMS.load) {
      const requisitionId = this.params.data.id;
      this.context.ITEMS.load(requisitionId, (data: any[]) => {
        this.rowData = data.map(item => ({
          ...item,
          __isNew: false,
          __modified: false
        }));
        if (this.gridApi) {
          this.gridApi.setGridOption('rowData', this.rowData);
        }
        // El campo pedimento se maneja desde el backend, no se actualiza desde aquí
      });
    }
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    // Ensure columnDefs are updated with loaded products
    this.gridApi.setGridOption('columnDefs', this.colDefs);
    restoreGridColumnWidths(this.gridApi, 'shopping:requisitions:detail', this.trackingService.getEmail());
  }

  onDetailGridCellKeyDown(event: any): void {
    const keyEvent: KeyboardEvent = event?.event || event;
    if (keyEvent?.key !== 'F10') return;
    keyEvent.preventDefault();
    keyEvent.stopPropagation();
    if (keyEvent.repeat) return;
    event.api?.stopEditing();
    void this.saveChanges();
  }

  onColumnResized(event: any): void {
    saveGridColumnWidths(this.gridApi, 'shopping:requisitions:detail', this.trackingService.getEmail(), event);
  }

  get colDefs(): ColDef[] {
    return [
      {
        headerName: '#',
        width: 50,
        valueGetter: (params) => params.node!.rowIndex! + 1,
        pinned: 'left',
        cellStyle: { backgroundColor: '#f8f9fa', fontWeight: 'bold' }
      },
      {
        headerName: 'Código',
        width: 135,
        valueGetter: (params) => this.productos.find(item => item.id === Number(params.data?.idSupplie))?.code || '',
      },
      {
        field: 'idSupplie',
        headerName: 'Descripción',
        headerTooltip: 'Escribe parte de la descripción para elegir un material.',
        headerClass: 'required-column-header',
        cellClassRules: {
          'required-cell-missing': (params) => !this.isPositiveNumber(params.value),
        },
        editable: () => !this.isReadOnly,
        width: 300,
        cellEditor: 'agRichSelectCellEditor',
        cellEditorParams: {
          values: this.productos.map((item) => item.id),
          valueListMaxHeight: 220,
          allowTyping: true,
          filterList: true,
          searchType: 'matchAny',
          highlightMatch: true,
          formatValue: (value: any) => {
            const foundItem = this.productos.find((item) => item.id === value);
            if (!foundItem) return value;
            return foundItem.description;
          }
        },
        valueFormatter: (params) => {
          if (!params.value) return '';
          const foundItem = this.productos.find((item) => item.id === params.value);
          return foundItem ? foundItem.description : params.value;
        },
        valueSetter: (params: any) => {
          if (Number(params.oldValue) === Number(params.newValue)) return false;
          params.data.idSupplie = Number(params.newValue);
          this.assignDefaultBrand(params.data);
          return true;
        }
      },
      {
        field: 'idBrand',
        headerName: 'Marca',
        width: 170,
        headerTooltip: 'Una marca se asigna sola; si hay varias, elige la requerida.',
        editable: (params) => !this.isReadOnly && this.brandsFor(params.data?.idSupplie).length > 1,
        cellEditor: 'agRichSelectCellEditor',
        cellEditorParams: (params: any) => ({
          values: this.brandsFor(params.data?.idSupplie).map(brand => brand.id),
          valueListMaxHeight: 220,
          allowTyping: true,
          filterList: true,
          formatValue: (value: any) => this.materialBrands.find(brand => brand.id === Number(value))?.brand || ''
        }),
        valueFormatter: (params) => params.data?.brandName || this.brandsFor(params.data?.idSupplie).find(brand => brand.id === Number(params.value))?.brand || (this.brandsFor(params.data?.idSupplie).length ? 'Elige una marca' : 'Sin marca'),
        cellClassRules: {
          'required-cell-missing': (params) => this.brandsFor(params.data?.idSupplie).length > 1 && !params.value
        },
        valueSetter: (params: any) => {
          const brand = this.brandsFor(params.data?.idSupplie).find(item => item.id === Number(params.newValue));
          if (!brand) return false;
          params.data.idBrand = brand.id;
          params.data.brandName = brand.brand;
          return true;
        }
      },
      {
        field: 'quantity',
        headerName: 'Cantidad',
        headerClass: 'required-column-header',
        cellClassRules: {
          'required-cell-missing': (params) => !this.isPositiveNumber(params.value),
        },
        editable: () => !this.isReadOnly,
        width: 100,
        type: 'numericColumn',
        valueSetter: (params: any) => {
          params.data.quantity = params.newValue;
          return true;
        }
      },
      {
        field: 'dateuse',
        headerName: 'Fecha de uso',
        headerClass: 'required-column-header',
        cellClassRules: {
          'required-cell-missing': (params) => this.isBlank(params.value),
        },
        editable: () => !this.isReadOnly,
        width: 150,
        cellDataType: 'dateString',
        valueFormatter: (params) => {
          if (params.value) {
            return params.value.split('T')[0];
          }
          return '';
        },
        valueSetter: (params: any) => {
          params.data.dateuse = params.newValue;
          return true;
        }
      },
      {
        field: 'comment',
        headerName: 'Comentario',
        editable: () => !this.isReadOnly,
        width: 250,
        cellEditor: 'agLargeTextCellEditor',
        cellEditorParams: {
          maxLength: 500,
          rows: 3,
          cols: 50
        },
        valueSetter: (params: any) => {
          params.data.comment = params.newValue ? params.newValue.toUpperCase() : '';
          return true;
        }
      }
    ];
  }

  public gridOptions: any = {
    headerHeight: 30,
    rowHeight: 28,
    animateRows: true,
    rowSelection: 'single',
    domLayout: 'normal', // Cambiar a normal para permitir expansión manual
    suppressDragLeaveHidesColumns: true,
    suppressHorizontalScroll: true,
    onCellValueChanged: (event: any) => {
      event.data.__modified = true;
      this.hasUnsavedChanges = true;
    }
  };

  addItem(material?: any) {
    if (this.isReadOnly) {
      alerts.basicAlert('Requisicion bloqueada', 'No se pueden agregar items. Esta requisicion esta en proceso de cotizacion.', 'warning');
      return;
    }
    const tempId = `temp_item_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId,
      idMovement: this.params.data.id,
      idSupplie: material?.id || 0,
      idBrand: null,
      brandName: null,
      quantity: 0,
      price: 0,
      total: 0,
      type: 'REQUIS',
      comment: '',
      dateuse: new Date().toISOString(),
      active: true,
      __isNew: true,
      __modified: false
    };
    if (material) this.assignDefaultBrand(newItem);

    this.rowData = [...this.rowData, newItem];
    this.hasUnsavedChanges = true;
    this.gridApi.setGridOption('rowData', this.rowData);

        // El contador se gestiona desde el backend al guardar los cambios

    setTimeout(() => {
      const lastRowIndex = this.rowData.length - 1;
      this.gridApi.ensureIndexVisible(lastRowIndex);
      this.gridApi.startEditingCell({
        rowIndex: lastRowIndex,
        colKey: material ? (this.brandsFor(material.id).length > 1 ? 'idBrand' : 'quantity') : 'idSupplie'
      });
    }, 0);
  }

  searchByCode() {
    const query = this.codeQuery.trim().toLocaleLowerCase();
    this.codeMatches = query ? this.productos.filter(item =>
      String(item.code || '').toLocaleLowerCase().includes(query) ||
      String(item.barCode || '').toLocaleLowerCase().includes(query)
    ).slice(0, 12) : [];
  }

  selectCodeMatch(material: any) {
    this.codeQuery = '';
    this.codeMatches = [];
    this.addItem(material);
  }

  selectExactCode() {
    const query = this.codeQuery.trim().toLocaleLowerCase();
    const exact = this.productos.find(item =>
      String(item.code || '').toLocaleLowerCase() === query ||
      String(item.barCode || '').toLocaleLowerCase() === query
    );
    if (exact) this.selectCodeMatch(exact);
    else if (this.codeMatches.length === 1) this.selectCodeMatch(this.codeMatches[0]);
    else if (query) alerts.basicAlert('Código', 'Selecciona un material de la lista de coincidencias.', 'info');
  }

  private brandsFor(materialId: any): any[] {
    return this.materialBrands.filter(brand => brand.idMaterial === Number(materialId));
  }

  private assignDefaultBrand(row: any) {
    const brands = this.brandsFor(row.idSupplie);
    row.idBrand = brands.length === 1 ? brands[0].id : null;
    row.brandName = brands.length === 1 ? brands[0].brand : null;
    this.gridApi?.refreshCells({ force: true });
  }

  deleteSelectedItem() {
    this.trackingService.addLog(this.trackingService.getnameComp(), 'Eliminó detalles requisiciones', 'Almacenes', this.trackingService.getEmail());
    if (this.isReadOnly) {
      alerts.basicAlert('Requisicion bloqueada', 'No se pueden eliminar items. Esta requisicion esta en proceso de cotizacion.', 'warning');
      return;
    }
    const selectedRows = this.gridApi.getSelectedRows();
    if (selectedRows.length === 0) {
      alerts.basicAlert('Selección requerida', 'Por favor seleccione un item para eliminar', 'warning');
      return;
    }

    const selectedItem = selectedRows[0];
    if (this.context && this.context.ITEMS && this.context.ITEMS.delete) {
      this.context.ITEMS.delete({ data: selectedItem, api: this.gridApi }, () => {
        this.rowData = this.rowData.filter(item => item.id !== selectedItem.id);
        this.gridApi.setGridOption('rowData', this.rowData);
        this.hasUnsavedChanges = true;


      });
    }
  }

  async saveChanges() {
    this.trackingService.addLog(this.trackingService.getnameComp(), 'Guardó cambios en detalles requisiciones', 'Almacenes', this.trackingService.getEmail());
    if (this.isReadOnly) {
      alerts.basicAlert('Requisicion bloqueada', 'No se pueden guardar cambios. Esta requisicion esta en proceso de cotizacion.', 'warning');
      return;
    }
    if (!this.hasUnsavedChanges) {
      alerts.basicAlert('Sin cambios', 'No hay cambios pendientes por guardar', 'info');
      return;
    }

    if (!this.validateRows()) {
      return;
    }

    if (this.context && this.context.ITEMS && this.context.ITEMS.save) {
      const requisitionId = this.params.data.id;
      
      // Guardar y esperar a que termine
      const saved = await this.context.ITEMS.save(requisitionId, this.rowData);
      if (saved === false) {
        return;
      }
      this.hasUnsavedChanges = false;
      
      // Recargar los datos del servidor para tener los IDs actualizados y el contador actualizado
      setTimeout(() => {
        this.loadData();
      }, 500); // Pequeño delay para asegurar que el servidor procesó
    }
  }

  discardChanges() {
    if (this.isReadOnly) {
      return; // Nothing to discard when locked
    }
    if (!this.hasUnsavedChanges) {
      alerts.basicAlert('Sin cambios', 'No hay cambios pendientes por descartar', 'info');
      return;
    }

    this.loadData();
    this.hasUnsavedChanges = false;
  }

  onCellValueChanged(event: any) {
    event.data.__modified = true;
    this.hasUnsavedChanges = true;
  }

  refreshByParent() {
    this.loadData();
  }

  private validateRows(): boolean {
    const requiredFields = [
      { field: 'idSupplie', label: 'Producto', invalid: (value: any) => !this.isPositiveNumber(value) },
      { field: 'quantity', label: 'Cantidad (debe ser mayor que cero)', invalid: (value: any) => !this.isPositiveNumber(value) },
      { field: 'dateuse', label: 'Fecha de uso', invalid: (value: any) => this.isBlank(value) },
    ];

    this.gridApi?.stopEditing();

    for (let rowIndex = 0; rowIndex < this.rowData.length; rowIndex++) {
      const row = this.rowData[rowIndex];
      const missingFields = requiredFields.filter((required) => required.invalid(row[required.field]));
      const brands = this.brandsFor(row.idSupplie);
      if (brands.length > 1 && !brands.some(brand => brand.id === Number(row.idBrand))) {
        missingFields.push({ field: 'idBrand', label: 'Marca', invalid: () => true });
      }
      if (brands.length === 1 && !row.idBrand) {
        row.idBrand = brands[0].id;
        row.brandName = brands[0].brand;
        row.__modified = true;
      }
      const duplicateIndex = this.rowData.findIndex(other =>
        other !== row &&
        Number(other.idSupplie) === Number(row.idSupplie) &&
        Number(other.idBrand || 0) === Number(row.idBrand || 0)
      );
      if (missingFields.length === 0 && duplicateIndex >= 0 && duplicateIndex < rowIndex) {
        alerts.basicAlert('Partida repetida', `El material y la marca de la partida ${rowIndex + 1} ya están en otra partida de esta requisición. Modifica la cantidad en esa partida.`, 'warning');
        this.gridApi?.ensureIndexVisible(rowIndex, 'middle');
        return false;
      }
      if (missingFields.length === 0) {
        continue;
      }

      this.gridApi?.refreshCells({ force: true });
      this.gridApi?.ensureIndexVisible(rowIndex, 'middle');
      this.gridApi?.setFocusedCell(rowIndex, missingFields[0].field);
      setTimeout(() => {
        this.gridApi?.startEditingCell({ rowIndex, colKey: missingFields[0].field });
      }, 0);

      alerts.basicAlert(
        'Faltan campos obligatorios',
        `En la partida ${rowIndex + 1} completa: ${missingFields.map((required) => required.label).join(', ')}. Los campos están marcados en rojo.`,
        'warning'
      );
      return false;
    }

    return true;
  }

  private isBlank(value: any): boolean {
    return value === null || value === undefined || String(value).trim() === '';
  }

  private isPositiveNumber(value: any): boolean {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) && numericValue > 0;
  }

}
