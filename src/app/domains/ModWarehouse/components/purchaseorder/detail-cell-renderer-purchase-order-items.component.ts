import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent, ICellRendererParams } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { alerts } from 'app/helpers/alerts';
import { TrackingService } from 'app/services/tracking.service';
import { CatalogsService } from 'app/services/catalogs.service';
import { lastValueFrom } from 'rxjs';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-detail-cell-renderer-purchase-order-items',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  template: `
    <div class="detail-grid-container">
      <div class="detail-actions d-flex justify-content-end mb-1">
        <button class="btn btn-primary btn-xs me-1 py-0 px-2" (click)="addItem()" style="font-size: 0.75rem; line-height: 1.5;">
          <i class="bi bi-plus" style="font-size: 0.75rem;"></i> Agregar
        </button>
        <button class="btn btn-outline-primary btn-xs me-1 py-0 px-2" (click)="quickAddMaterial()" style="font-size: 0.75rem; line-height: 1.5;">
          <i class="bi bi-box-seam"></i> Nuevo material
        </button>
        <button class="btn btn-warning btn-xs me-1 py-0 px-2" (click)="discardChanges()" style="font-size: 0.75rem; line-height: 1.5;">
          <i class="bi bi-arrow-counterclockwise" style="font-size: 0.75rem;"></i> Deshacer
        </button>
        <button class="btn btn-danger btn-xs me-1 py-0 px-2" (click)="deleteSelectedItem()" style="font-size: 0.75rem; line-height: 1.5;">
          <i class="bi bi-trash" style="font-size: 0.75rem;"></i> Eliminar
        </button>
        <button class="btn btn-success btn-xs position-relative py-0 px-2" (click)="saveChanges()" style="font-size: 0.75rem; line-height: 1.5;">
          <i class="bi bi-floppy" style="font-size: 0.75rem;"></i> Guardar
          <span class="position-absolute top-0 start-100 translate-middle p-1 bg-danger border border-light rounded-circle"
            *ngIf="hasUnsavedChanges" style="width: 8px; height: 8px;">
            <span class="visually-hidden">Hay cambios sin guardar</span>
          </span>
        </button>
      </div>
      <ag-grid-angular
        #agGrid
        class="ag-theme-quartz small-text-ag-grid"
        [rowData]="rowData"
        [columnDefs]="colDefs"
        [gridOptions]="gridOptions"
        [localeText]="AG_GRID_LOCALE_ES"
        (gridReady)="onGridReady($event)"
        (cellValueChanged)="onCellValueChanged($event)"
        style="height: 300px; width: 100%;">
      </ag-grid-angular>
    </div>
  `,
  styles: [`
    .detail-grid-container {
      padding: 8px;
      background-color: #f8f9fa;
      border-radius: 8px;
    }
    .btn-xs {
      padding: 1px 5px;
      font-size: 0.75rem;
      line-height: 1.5;
    }
  `]
})
export class DetailCellRendererPurchaseOrderItemsComponent implements OnInit {
  private trackingService = inject(TrackingService);
  private catalogsService = inject(CatalogsService);

  private params!: ICellRendererParams;
  private gridApi!: GridApi;
  private context: any;

  rowData: any[] = [];
  hasUnsavedChanges: boolean = false;
  tempIdCounter: number = 0;
  productos: any[] = [];
  proveedores: any[] = [];

  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  ngOnInit() {
    this.loadData();
  }

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.context = params.context;
    this.productos = this.context?.productos || [];
    this.proveedores = this.context?.proveedores || [];
    this.loadData();
  }

  loadData() {
    if (this.context && this.context.ITEMS && this.context.ITEMS.load) {
      const purchaseOrderId = this.params.data.id;
      this.context.ITEMS.load(purchaseOrderId, (data: any[]) => {
        this.rowData = data.map(item => ({
          ...item,
          __isNew: false,
          __modified: false
        }));
        if (this.gridApi) {
          this.gridApi.setGridOption('rowData', this.rowData);
        }
        // Update the count in master grid
        if (this.context && this.context.ITEMS && this.context.ITEMS.updateCount) {
          this.context.ITEMS.updateCount(purchaseOrderId, this.rowData.length);
        }
      });
    }
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    this.gridApi.setGridOption('columnDefs', this.colDefs);
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
        field: 'idSupplie',
        headerName: 'Producto',
        editable: true,
        width: 250,
        cellEditor: 'agRichSelectCellEditor',
        cellEditorParams: {
          values: [...this.productos.map((item) => item.id), '__ADD_MATERIAL__'],
          valueListMaxHeight: 220,
          formatValue: (value: any) => {
            if (value === '__ADD_MATERIAL__') return '+ Agregar material...';
            const foundItem = this.productos.find((item) => item.id === value);
            return foundItem ? foundItem.description : value;
          }
        },
        valueFormatter: (params) => {
          if (!params.value) return '';
          if (params.value === '__ADD_MATERIAL__') return '+ Agregar material...';
          const foundItem = this.productos.find((item) => item.id === params.value);
          return foundItem ? foundItem.description : params.value;
        },
        tooltipValueGetter: (params) => {
          if (!params.value) return '';
          const foundItem = this.productos.find((item: any) => item.id === params.value);
          return foundItem ? foundItem.description : '';
        },
        valueSetter: (params: any) => {
          if (params.newValue === '__ADD_MATERIAL__') {
            this.quickAddMaterial(params);
            return false;
          }
          // Validar si el material ya existe
          const existingItem = this.findExistingMaterial(params.newValue);
          if (existingItem && existingItem.id !== params.data.id) {
            // Material duplicado encontrado
            this.showDuplicateMaterialAlert(existingItem, params);
            return false; // No cambiar el valor hasta confirmación
          }
          params.data.idSupplie = params.newValue;
          const product = this.productos.find((item: any) => Number(item.id) === Number(params.newValue));
          if (product) {
            params.data.costoMN = Number(product.costoMN ?? product.price ?? 0);
            params.data.ventaMN = Number(product.ventaMN ?? product.price ?? 0);
          }
          return true;
        }
      },
      {
        field: 'idProvider',
        headerName: 'Proveedor',
        hide: true,
        editable: false,
        width: 200,
        cellEditor: 'agRichSelectCellEditor',
        cellEditorParams: {
          values: this.proveedores.map((item) => item.id),
          valueListMaxHeight: 220,
          formatValue: (value: any) => {
            const foundItem = this.proveedores.find((item) => item.id === value);
            return foundItem ? foundItem.name : value;
          }
        },
        valueFormatter: (params) => {
          if (!params.value) return '';
          const foundItem = this.proveedores.find((item) => item.id === params.value);
          return foundItem ? foundItem.name : params.value;
        }
      },
      {
        field: 'dateuse',
        headerName: 'Fecha de uso',
        editable: true,
        width: 130,
        cellDataType: 'dateString',
        valueFormatter: (params) => {
          if (params.value) {
            return params.value.split('T')[0];
          }
          return '';
        }
      },
      {
        field: 'quantity',
        headerName: 'Cantidad',
        editable: true,
        width: 100,
        type: 'numericColumn',
        valueSetter: (params: any) => {
          params.data.quantity = parseFloat(params.newValue) || 0;
          this.updateTotal(params.data);
          return true;
        }
      },
      {
        field: 'price',
        headerName: 'Precio',
        editable: true,
        width: 110,
        type: 'numericColumn',
        valueFormatter: (params) => {
          if (params.value) {
            return `$${parseFloat(params.value).toFixed(2)}`;
          }
          return '$0.00';
        },
        valueSetter: (params: any) => {
          params.data.price = parseFloat(params.newValue) || 0;
          this.updateTotal(params.data);
          return true;
        }
      },
      {
        field: 'iva',
        headerName: 'IVA',
        editable: true,
        width: 95,
        type: 'numericColumn',
        valueFormatter: (params) => `$${Number(params.value || 0).toFixed(2)}`,
        valueSetter: (params: any) => {
          params.data.iva = Number(params.newValue) || 0;
          return true;
        }
      },
      {
        field: 'retention',
        headerName: 'Retención',
        editable: true,
        width: 115,
        type: 'numericColumn',
        valueFormatter: (params) => `$${Number(params.value || 0).toFixed(2)}`,
        valueSetter: (params: any) => {
          params.data.retention = Number(params.newValue) || 0;
          return true;
        }
      },
      {
        field: 'total',
        headerName: 'Total',
        editable: false,
        width: 120,
        type: 'numericColumn',
        valueFormatter: (params) => {
          if (params.value) {
            return `$${parseFloat(params.value).toFixed(2)}`;
          }
          return '$0.00';
        },
        cellStyle: { backgroundColor: '#e3f2fd', fontWeight: 'bold' }
      },
      {
        field: 'comment',
        headerName: 'Comentario',
        editable: true,
        width: 200,
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
    headerHeight: 35,
    rowHeight: 35,
    animateRows: true,
    rowSelection: 'single',
    onCellValueChanged: (event: any) => {
      event.data.__modified = true;
      this.hasUnsavedChanges = true;
    }
  };

  updateTotal(data: any) {
    if (data.quantity && data.price) {
      data.total = data.quantity * data.price;
    } else {
      data.total = 0;
    }
  }

  addItem() {
    const tempId = `temp_item_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId,
      idMovement: this.params.data.id,
      idSupplie: 0,
      idProvider: 0,
      quantity: 1,
      price: 0,
      costoMN: 0,
      ventaMN: 0,
      iva: 0,
      retention: 0,
      total: 0,
      type: 'OC',
      comment: 'NINGUNO.',
      dateuse: new Date().toISOString(),
      active: true,
      __isNew: true,
      __modified: false
    };

    this.rowData = [...this.rowData, newItem];
    this.hasUnsavedChanges = true;
    this.gridApi.setGridOption('rowData', this.rowData);

    // Update count in master grid
    if (this.context && this.context.ITEMS && this.context.ITEMS.updateCount) {
      this.context.ITEMS.updateCount(this.params.data.id, this.rowData.length);
    }

    setTimeout(() => {
      const lastRowIndex = this.rowData.length - 1;
      this.gridApi.ensureIndexVisible(lastRowIndex);
      this.gridApi.startEditingCell({
        rowIndex: lastRowIndex,
        colKey: 'idSupplie'
      });
    }, 0);
  }

  async quickAddMaterial(params?: any): Promise<void> {
    const service = this.context?.materialsService;
    const idRoot = this.context?.idRoot;
    if (!service || !idRoot) return;
    const [measures, families, subfamilies] = await Promise.all([
      lastValueFrom(this.catalogsService.getCatalogs(idRoot, 'MEASURE')).catch(() => []),
      lastValueFrom(this.catalogsService.getFamilyById(idRoot)).catch(() => []),
      lastValueFrom(this.catalogsService.getCatalogs(idRoot, 'SUBFAMILY')).catch(() => [])
    ]);
    const measureList: any[] = Array.isArray(measures) ? measures : [];
    const familyList: any[] = Array.isArray(families) ? families : [];
    const subfamilyList: any[] = Array.isArray(subfamilies) ? subfamilies : [];
    const options = (items: any[], empty: string) => `<option value="">${empty}</option>${items.map(item => `<option value="${item.id}">${item.description}</option>`).join('')}`;
    const result = await Swal.fire({
      title: 'Nuevo material',
      width: 760,
      html: `
        <div class="row g-2 text-start">
          <div class="col-md-12"><label class="form-label">Descripción *</label><textarea id="mat-description" class="form-control" rows="3" autofocus></textarea></div>
          <div class="col-md-4"><label class="form-label">Código</label><input id="mat-code" class="form-control" maxlength="35"></div>
          <div class="col-md-4"><label class="form-label">Unidad *</label><select id="mat-measure" class="form-select">${options(measureList, 'Seleccione unidad')}<option value="__NEW__">+ Nueva unidad</option></select><input id="mat-measure-new" class="form-control mt-1 d-none" placeholder="Ej: PZA, KG, M"></div>
          <div class="col-md-4"><label class="form-label">Costo *</label><input id="mat-cost" type="number" min="0" step="0.01" value="0" class="form-control"></div>
          <div class="col-md-4"><label class="form-label">Precio venta *</label><input id="mat-sale" type="number" min="0" step="0.01" value="0" class="form-control"></div>
          <div class="col-md-6"><label class="form-label">Familia *</label><select id="mat-family" class="form-select">${options(familyList, 'Seleccione familia')}<option value="__NEW__">+ Agregar familia</option></select><input id="mat-family-new" class="form-control mt-1 d-none" placeholder="Nueva familia"></div>
          <div class="col-md-6"><label class="form-label">Subfamilia *</label><select id="mat-subfamily" class="form-select"><option value="">Seleccione primero familia</option><option value="__NEW__">+ Agregar subfamilia</option></select><input id="mat-subfamily-new" class="form-control mt-1 d-none" placeholder="Nueva subfamilia"></div>
        </div>`,
      showCancelButton: true, confirmButtonText: 'Guardar material', cancelButtonText: 'Cancelar',
      didOpen: () => {
        const get = (id: string) => document.getElementById(id) as HTMLSelectElement;
        const measure = get('mat-measure'); const family = get('mat-family'); const subfamily = get('mat-subfamily');
        measure.onchange = () => (document.getElementById('mat-measure-new') as HTMLElement).classList.toggle('d-none', measure.value !== '__NEW__');
        family.onchange = () => {
          subfamily.innerHTML = '<option value="">Seleccione primero familia</option><option value="__NEW__">+ Agregar subfamilia</option>';
          (document.getElementById('mat-family-new') as HTMLElement).classList.toggle('d-none', family.value !== '__NEW__');
          const list = subfamilyList.filter(s => String(s.parentId) === family.value);
          subfamily.innerHTML = options(list, 'Seleccione subfamilia') + '<option value="__NEW__">+ Agregar subfamilia</option>';
        };
        subfamily.onchange = () => (document.getElementById('mat-subfamily-new') as HTMLElement).classList.toggle('d-none', subfamily.value !== '__NEW__');
      },
      preConfirm: () => {
        const value = (id: string) => (document.getElementById(id) as HTMLInputElement).value.trim();
        const description = value('mat-description'); const measureId = value('mat-measure'); const familyId = value('mat-family'); const subfamilyId = value('mat-subfamily');
        if (!description || !measureId || !familyId || !subfamilyId) { Swal.showValidationMessage('Descripción, unidad, familia y subfamilia son obligatorias.'); return false; }
        if (measureId === '__NEW__' && !value('mat-measure-new')) { Swal.showValidationMessage('Capture la nueva unidad.'); return false; }
        if (familyId === '__NEW__' && !value('mat-family-new')) { Swal.showValidationMessage('Capture la nueva familia.'); return false; }
        if (subfamilyId === '__NEW__' && !value('mat-subfamily-new')) { Swal.showValidationMessage('Capture la nueva subfamilia.'); return false; }
        return { description, code: value('mat-code'), measureId, measureNew: value('mat-measure-new'), costoMN: Number(value('mat-cost')) || 0, ventaMN: Number(value('mat-sale')) || 0, familyId, familyNew: value('mat-family-new'), subfamilyId, subfamilyNew: value('mat-subfamily-new') };
      }
    });
    if (!result.isConfirmed || !result.value) return;
    const form: any = result.value;
    try {
      let measureId = form.measureId;
      if (measureId === '__NEW__') measureId = (await lastValueFrom(this.catalogsService.addCatalog({ description: form.measureNew, type: 'MEASURE', idCompany: idRoot, active: 1, vigente: true })))?.id;
      let familyId = form.familyId;
      if (familyId === '__NEW__') familyId = (await lastValueFrom(this.catalogsService.addCatalog({ description: form.familyNew, type: 'FAMILY', idCompany: idRoot, active: 1, vigente: true })))?.id;
      let subfamilyId = form.subfamilyId;
      if (subfamilyId === '__NEW__') subfamilyId = (await lastValueFrom(this.catalogsService.addCatalog({ description: form.subfamilyNew, type: 'SUBFAMILY', idCompany: idRoot, parentId: Number(familyId), active: 1, vigente: true })))?.id;
      if (!familyId || !subfamilyId) throw new Error('Debe seleccionar o agregar familia y subfamilia.');
      const created: any = await lastValueFrom(service.addMaterial({
        idCompany: idRoot,
        insumo: String(form.code || '').slice(0, 35),
        articulo: String(form.description).slice(0, 50),
        description: form.description,
        idMedida: Number(measureId),
        idFamilia: Number(familyId),
        idSubfamilia: Number(subfamilyId),
        idUbication: null,
        date: new Date().toISOString(),
        aplicaResg: false,
        costoMN: form.costoMN,
        costoDLL: 0,
        ventaMN: form.ventaMN,
        ventaDLL: 0,
        quantity: 0,
        stockMin: 0,
        stockMax: 0,
        picture: '',
        typeMaterial: 'CONSUMIBLE',
        active: true,
        vigente: true
      }));
      const material = created?.data || created?.material || created;
      const materialId = Number(
        material?.id ?? material?.Id ?? created?.id ?? created?.Id ?? 0
      );
      if (!materialId) {
        throw new Error('El material fue creado, pero el servidor no devolvió su identificador para agregarlo a la OC.');
      }

      const materialForGrid = { ...material, id: materialId };
      // Conserva la misma referencia que recibió el renderer desde el padre;
      // así el material queda disponible inmediatamente en todos los combos.
      if (!this.productos.some((item: any) => Number(item.id) === materialId)) {
        this.productos.push(materialForGrid);
      }

      if (params?.data) {
        params.data.idSupplie = materialId;
        params.data.price = form.costoMN;
        params.data.costoMN = form.costoMN;
        params.data.ventaMN = form.ventaMN;
        params.data.__modified = true;
        this.hasUnsavedChanges = true;
        this.gridApi?.refreshCells({ rowNodes: params.node ? [params.node] : undefined, force: true });
      } else {
        const tempId = `temp_item_${this.tempIdCounter++}`;
        this.rowData = [...this.rowData, {
          id: tempId,
          idMovement: this.params.data.id,
          idSupplie: materialId,
          idProvider: 0,
          quantity: 1,
          price: form.costoMN,
          costoMN: form.costoMN,
          ventaMN: form.ventaMN,
          iva: 0,
          retention: 0,
          total: form.costoMN,
          type: 'OC',
          comment: 'NINGUNO.',
          dateuse: new Date().toISOString(),
          active: true,
          __isNew: true,
          __modified: false
        }];
        this.hasUnsavedChanges = true;
        this.gridApi?.setGridOption('rowData', this.rowData);
        this.context?.ITEMS?.updateCount?.(this.params.data.id, this.rowData.length);
      }
      this.gridApi?.refreshCells({ columns: ['idSupplie'], force: true });
      alerts.basicAlert('Material creado y agregado a la OC', '', 'success');
      this.gridApi?.setGridOption('columnDefs', this.colDefs);
    } catch (error) {
      console.error('Error al agregar material en OC:', error);
      const detail = (error as any)?.error?.title || (error as any)?.error?.message || (error as any)?.error || 'Revise familia, subfamilia y unidad seleccionadas.';
      alerts.basicAlert('Material', `No fue posible guardar: ${detail}`, 'error');
    }
  }

  deleteSelectedItem() {
    this.trackingService.addLog(this.trackingService.getnameComp(), 'Eliminó detail cell renderer purchase order items', 'Almacenes', this.trackingService.getEmail());
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

        // Update count in master grid
        if (this.context && this.context.ITEMS && this.context.ITEMS.updateCount) {
          this.context.ITEMS.updateCount(this.params.data.id, this.rowData.length);
        }
      });
    }
  }

  async saveChanges() {
    this.trackingService.addLog(this.trackingService.getnameComp(), 'Guardó cambios en detail cell renderer purchase order items', 'Almacenes', this.trackingService.getEmail());
    if (!this.hasUnsavedChanges) {
      // También permite vincular partidas ya guardadas cuando se eligió un
      // gasto destino posteriormente en el maestro de la OC.
      await this.context?.ITEMS?.save?.(this.params.data.id, this.rowData);
      return;
    }

    // Validar que todos los items tengan producto, proveedor y fecha
    const isValid = this.rowData.every(item => item.idSupplie && item.dateuse);
    if (!isValid) {
      alerts.basicAlert('Validación', 'Todos los items deben tener producto, proveedor y fecha de uso', 'warning');
      return;
    }

    if (this.context && this.context.ITEMS && this.context.ITEMS.save) {
      const purchaseOrderId = this.params.data.id;
      await this.context.ITEMS.save(purchaseOrderId, this.rowData);
      this.hasUnsavedChanges = false;
    }
  }

  discardChanges() {
    if (!this.hasUnsavedChanges) {
      alerts.basicAlert('Sin cambios', 'No hay cambios pendientes por descartar', 'info');
      return;
    }

    this.loadData();
    this.hasUnsavedChanges = false;
  }

  onCellValueChanged(event: any) {
    if (event.colDef.field === 'quantity' || event.colDef.field === 'price') {
      this.updateTotal(event.data);
      this.gridApi.refreshCells({ rowNodes: [event.node], columns: ['total'] });
    }

    event.data.__modified = true;
    this.hasUnsavedChanges = true;
  }

  refreshByParent() {
    this.loadData();
  }

  private findExistingMaterial(materialId: number): any {
    return this.rowData.find(item =>
      item.idSupplie === materialId &&
      item.id !== this.params.data?.id
    );
  }

  private showDuplicateMaterialAlert(existingItem: any, params: any): void {
    const existingProduct = this.productos.find(p => p.id === existingItem.idSupplie);
    const productName = existingProduct ? existingProduct.description : 'Material desconocido';

    alerts.confirmAlert(
      'Material Duplicado',
      `El material "${productName}" ya existe con cantidad ${existingItem.quantity}.\n\n¿Desea sumar las cantidades?`,
      'warning',
      'Sí, sumar cantidades'
    ).then((result) => {
      if (result.isConfirmed) {
        // Usuario confirma - solicitar cantidad a sumar
        this.promptForQuantity(existingItem, params);
      } else {
        // Usuario cancela - mantener selección pero no sumar
        params.data.idSupplie = params.newValue;
        if (this.gridApi) {
          this.gridApi.refreshCells({
            rowNodes: [this.gridApi.getRowNode(params.data.id)],
            columns: ['idSupplie'],
            force: true
          });
        }
      }
    });
  }

  private promptForQuantity(existingItem: any, params: any): void {
    alerts.inputAlert(
      'Sumar Cantidades',
      `Material actual: ${existingItem.quantity}\nCantidad a agregar:`,
      'text',
      '',
      {
        confirmButtonText: 'Sumar',
        required: true
      }
    ).then((result) => {
      if (result.isConfirmed && result.value) {
        const newQuantity = parseFloat(result.value);
        if (!isNaN(newQuantity) && newQuantity > 0) {
          // Sumar cantidades
          existingItem.quantity += newQuantity;
          existingItem.__modified = true;
          this.hasUnsavedChanges = true;

          // Recalcular el total del item existente
          this.updateTotal(existingItem);

          // Eliminar la fila actual
          const updatedRowData = this.rowData.filter(item => item.id !== params.data.id);
          this.rowData = updatedRowData;

          // Actualizar grid
          this.gridApi.setGridOption('rowData', this.rowData);

          // Actualizar el contador en el master grid
          if (this.context && this.context.ITEMS && this.context.ITEMS.updateCount) {
            this.context.ITEMS.updateCount(this.params.data.id, this.rowData.length);
          }

          alerts.basicAlert(
            'Cantidades Sumadas',
            `Se sumaron ${newQuantity} unidades al material existente. Total: ${existingItem.quantity}`,
            'success'
          );
        } else {
          alerts.basicAlert(
            'Error',
            'La cantidad debe ser un número mayor a cero.',
            'error'
          );
        }
      }
    });
  }
}
