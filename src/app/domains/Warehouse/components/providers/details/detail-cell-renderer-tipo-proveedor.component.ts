import { Component, inject } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { CommonModule } from '@angular/common';
import { AgGridModule } from 'ag-grid-angular';
import { CatalogsService } from 'app/services/catalogs.service';
import { SignalsService } from 'app/services/signals.service';
import { ProvidersService } from 'app/services/providers.service';
import { CustomersService } from 'app/services/customers.service';
import { alerts } from 'app/helpers/alerts';
import { SelectWithTooltipEditorV2Component } from 'app/domains/Almacenes/components/materiales-maestro/editors/select-with-tooltip-editor-v2.component';

@Component({
  selector: 'app-detail-cell-renderer-tipo-proveedor',
  standalone: true,
  imports: [CommonModule, AgGridModule, SelectWithTooltipEditorV2Component],
  template: `
    <div style="padding: 10px; background-color: #e3f2fd; height: 100%; display: flex; flex-direction: column;">
      <!-- Título y botones -->
      <div style="margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
        <strong>Configurar Tipo de Proveedor (Cascada)</strong>
        <div class="d-flex gap-2">
          <button
            class="btn btn-sm btn-success"
            (click)="addRow()"
            [disabled]="!gridApi">
            <i class="bi bi-plus-lg"></i> Agregar
          </button>
          <button
            class="btn btn-sm btn-primary position-relative"
            (click)="saveChanges()"
            [disabled]="!hasChanges">
            <i class="bi bi-floppy"></i> Guardar
            <span class="position-absolute top-0 start-100 translate-middle p-2 bg-danger border border-light rounded-circle"
              *ngIf="hasChanges">
              <span class="visually-hidden">Hay cambios sin guardar</span>
            </span>
          </button>
          <button
            class="btn btn-sm btn-warning"
            (click)="revertChanges()">
            <i class="bi bi-arrow-clockwise"></i> Deshacer
          </button>
          <button
            class="btn btn-sm btn-danger"
            (click)="deleteSelected()"
            [disabled]="!selectedRow">
            <i class="bi bi-trash"></i> Borrar
          </button>
        </div>
      </div>

      <!-- Grid único con 3 columnas -->
      <ag-grid-angular
        class="ag-theme-quartz small-text-ag-grid"
        style="width: 100%; flex-grow: 1;"
        [rowData]="rowData"
        [columnDefs]="columnDefs"
        [gridOptions]="gridOptions"
        (gridReady)="onGridReady($event)"
        (cellValueChanged)="onCellValueChanged($event)"
        (selectionChanged)="onSelectionChanged($event)">
      </ag-grid-angular>

      <!-- Previsualización de la cadena concatenada -->
      <div class="mt-2" *ngIf="getPreviewString()">
        <div class="alert alert-info py-2 mb-0">
          <small>
            <strong>Vista previa:</strong> {{ getPreviewString() }}
          </small>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
    }
  `]
})
export class DetailCellRendererTipoProveedorComponent implements ICellRendererAngularComp {

  private catalogsService = inject(CatalogsService);
  private signalsService = inject(SignalsService);
  private providersService = inject(ProvidersService);
  private customersService = inject(CustomersService);

  params: any;
  gridApi!: GridApi;
  rowData: any[] = [];
  selectedRow: any = null;
  hasChanges: boolean = false;
  private tempIdCounter: number = 0;
  private idRoot: number;

  // Datos reales desde endpoints
  categorias: any[] = [];      // Desde getCatalogs(idRoot, 'CATEGORY')
  familias: any[] = [];         // Desde getCatalogs(idRoot, 'FAM-CAT')
  subfamilias: any[] = [];      // Desde getCatalogs(idRoot, 'SUB-FAM')

  // Column Defs con combo boxes en cascada
  columnDefs: any[] = [
    {
      field: 'vigente',
      headerName: 'Activo',
      cellRenderer: 'agCheckboxCellRenderer',
      cellEditor: 'agCheckboxCellEditor',
      editable: true,
      width: 80,
      onCellValueChanged: (params: any) => {
        // Si se desmarca como vigente, también desmarcar como principal
        if (params.newValue === false && params.data.principal === true) {
          params.data.principal = false;
          // Buscar y marcar otro como principal si es necesario
          const activeRows = this.rowData.filter(row => row.vigente && row.id !== params.data.id);
          if (activeRows.length > 0) {
            activeRows[0].principal = true;
          }
          // Refrescar grid para mostrar los cambios
          this.gridApi?.setGridOption('rowData', this.rowData);
        }

        // Si se marca como vigente, refrescar las celdas para que 'principal' sea editable
        if (params.newValue === true) {
          // Refrescar las celdas de esta fila para actualizar el estado editable
          this.gridApi?.refreshCells({
            rowNodes: [params.node],
            columns: ['principal'],
            force: true
          });
        }
      }
    },
    {
      field: 'categoria',
      headerName: 'Categoría',
      editable: true,
      cellEditor: SelectWithTooltipEditorV2Component,
      cellEditorParams: () => {
        return {
          options: this.categorias.map(c => ({
            id: c.description,
            description: c.description,
            valueAddition: c.valueAddition,
            valueAddition2: c.valueAddition2
          }))
        };
      },
      width: 180
    },
    {
      field: 'familia',
      headerName: 'Familia',
      editable: true,
      cellEditor: SelectWithTooltipEditorV2Component,
      cellEditorParams: (params: any) => {
        // Filtrar familias según la categoría seleccionada en la fila
        const categoriaSeleccionada = params.data.categoria;
        const categoriaObj = this.categorias.find(c => c.description === categoriaSeleccionada);

        if (categoriaObj) {
          const familiasFiltradas = this.familias
            .filter(f => f.parentId === categoriaObj.id)
            .map(f => ({
              id: f.description,
              description: f.description,
              valueAddition: f.valueAddition,
              valueAddition2: f.valueAddition2
            }));

          return { options: familiasFiltradas };
        }

        return { options: [] };
      },
      width: 180
    },
    {
      field: 'subfamilia',
      headerName: 'Subfamilia',
      editable: true,
      cellEditor: SelectWithTooltipEditorV2Component,
      cellEditorParams: (params: any) => {
        // Filtrar subfamilias según la familia seleccionada en la fila
        const familiaSeleccionada = params.data.familia;
        const familiaObj = this.familias.find(f => f.description === familiaSeleccionada);

        if (familiaObj) {
          const subfamiliasFiltradas = this.subfamilias
            .filter(s => s.subParentId === familiaObj.id)
            .map(s => ({
              id: s.description,
              description: s.description,
              valueAddition: s.valueAddition,
              valueAddition2: s.valueAddition2
            }));

          return { options: subfamiliasFiltradas };
        }

        return { options: [] };
      },
      width: 200
    },
    {
      field: 'principal',
      headerName: 'Principal',
      cellRenderer: 'agCheckboxCellRenderer',
      cellEditor: 'agCheckboxCellEditor',
      editable: (params: any) => {
        // Solo editable si la fila está activa (vigente)
        return params.data.vigente === true;
      },
      width: 80,
      onCellValueChanged: (params: any) => {
        // Si se intenta marcar como principal pero no está vigente, revertir
        if (params.newValue === true && params.data.vigente === false) {
          params.data.principal = false;
          this.gridApi?.setGridOption('rowData', this.rowData);
          alerts.basicAlert(
            'No permitido',
            'No se puede marcar como principal una fila inactiva.',
            'warning'
          );
          return;
        }

        // Si se intenta desmarcar como principal
        if (params.newValue === false && params.data.principal === false) {
          // Contar cuántos activos hay
          const activeRows = this.rowData.filter(row => row.vigente === true);
          const principalRows = activeRows.filter(row => row.principal === true);

          // Si no hay ningún principal activo, forzar a mantener este como principal
          if (principalRows.length === 0 && activeRows.length > 0) {
            params.data.principal = true;
            this.gridApi?.setGridOption('rowData', this.rowData);
            alerts.basicAlert(
              'No permitido',
              'Debe haber al menos un registro principal. Marque otro como principal antes de desmarcar este.',
              'warning'
            );
            return;
          }
        }

        // Si se marca como principal, desmarcar todos los demás
        if (params.newValue === true) {
          this.rowData.forEach(row => {
            if (row.id !== params.data.id) {
              row.principal = false;
            }
          });
          // Refrescar grid para mostrar los cambios
          this.gridApi?.setGridOption('rowData', this.rowData);
        }
      }
    },
  ];

  // Grid Options
  gridOptions: any = {
    headerHeight: 25,
    rowHeight: 25,
    rowSelection: 'single',
    suppressCellFocus: false,
    stopEditingWhenCellsLoseFocus: true,
    singleClickEdit: false, // Doble-click para abrir el editor
    onFirstDataRendered: (params) => {
      console.log('onFirstDataRendered - autosizing columns...');

      // Obtener todas las columnas
      const allColumnIds: string[] = [];
      params.api.getColumns()?.forEach((column: any) => {
        allColumnIds.push(column.getId());
      });

      console.log('Columns to autosize:', allColumnIds);

      // Autoajustar todas las columnas al contenido (skipHeader=false incluye header en el cálculo)
      params.api.autoSizeColumns(allColumnIds, false);

      console.log('Autosize completed');
    }
  };

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.idRoot = this.signalsService.getRootSelectedBySidebar()();

    // Cargar catálogos y datos del proveedor
    this.loadData();
  }

  async loadData(): Promise<void> {
    try {
      // Cargar catálogos y datos del proveedor en paralelo
      const [categorias, familias, subfamilias, providerTypes] = await Promise.all([
        this.catalogsService.getCatalogs(this.idRoot, 'CATEGORY').toPromise(),
        this.catalogsService.getCatalogs(this.idRoot, 'FAM-CAT').toPromise(),
        this.catalogsService.getCatalogs(this.idRoot, 'SUB-FAM').toPromise(),
        this.providersService.getProviderType(this.params.data.id).toPromise()
      ]);

      this.categorias = categorias || [];
      this.familias = familias || [];
      this.subfamilias = subfamilias || [];

      console.log('Catálogos cargados:', {
        categorias: this.categorias.length,
        familias: this.familias.length,
        subfamilias: this.subfamilias.length
      });

      console.log('Provider Types cargados:', providerTypes);

      // Convertir datos del endpoint a formato del grid
      this.rowData = (providerTypes as any[]).map((item: any) => ({
        id: item.id,
        categoria: item.nameParent || '',
        familia: item.nameSubparent || '',
        subfamilia: item.nameProduct || '',
        vigente: item.vigente || false,
        principal: item.principal || false,
        idParent: item.idParent,
        idSubparent: item.idSubparent
      }));

      // Si solo hay un registro, marcarlo como principal automáticamente
      this.ensureSinglePrincipal();

      // Refrescar el grid si ya existe
      if (this.gridApi) {
        this.gridApi.setGridOption('rowData', this.rowData);
      }

    } catch (error) {
      console.error('Error al cargar datos:', error);
      this.categorias = [];
      this.familias = [];
      this.subfamilias = [];
      this.rowData = [];
    }
  }

  refresh(): boolean {
    return false;
  }

  // Asegurar que siempre haya un único registro principal (solo entre activos)
  private ensureSinglePrincipal(): void {
    if (this.rowData.length === 0) {
      return;
    }

    // Filtrar solo registros activos (vigente = true)
    const activeRows = this.rowData.filter(row => row.vigente === true);

    if (activeRows.length === 0) {
      // Si no hay registros activos, no hacer nada
      return;
    }

    // Si solo hay un registro activo, marcarlo como principal
    if (activeRows.length === 1) {
      activeRows[0].principal = true;
      // Asegurar que los inactivos no sean principales
      this.rowData.forEach(row => {
        if (row.vigente === false) {
          row.principal = false;
        }
      });
      return;
    }

    // Si hay múltiples registros activos, verificar que solo haya uno marcado como principal
    const principalRows = activeRows.filter(row => row.principal === true);

    // Si no hay ninguno marcado como principal, marcar el primer activo
    if (principalRows.length === 0) {
      activeRows[0].principal = true;
    }
    // Si hay más de uno marcado, dejar solo el primero marcado
    else if (principalRows.length > 1) {
      let firstFound = false;
      activeRows.forEach(row => {
        if (row.principal === true) {
          if (!firstFound) {
            firstFound = true;
          } else {
            row.principal = false;
          }
        }
      });
    }

    // Asegurar que ningún registro inactivo esté marcado como principal
    this.rowData.forEach(row => {
      if (row.vigente === false && row.principal === true) {
        row.principal = false;
      }
    });
  }

  onGridReady(params: GridReadyEvent): void {
    this.gridApi = params.api;
    params.api.sizeColumnsToFit();
  }

  onCellValueChanged(event: any): void {
    // Cuando cambia la categoría, limpiar familia y subfamilia
    if (event.colDef.field === 'categoria') {
      event.data.familia = '';
      event.data.subfamilia = '';
      this.gridApi.refreshCells({ rowNodes: [event.node], force: true });
    }

    // Cuando cambia la familia, limpiar subfamilia
    if (event.colDef.field === 'familia') {
      event.data.subfamilia = '';
      this.gridApi.refreshCells({ rowNodes: [event.node], force: true });
    }

    event.data.__modified = true;
    this.hasChanges = true;
  }

  onSelectionChanged(event: any): void {
    const selectedRows = event.api.getSelectedRows();
    this.selectedRow = selectedRows.length > 0 ? selectedRows[0] : null;
  }

  addRow(): void {
    if (!this.gridApi) {
      return;
    }

    const tempId = `temp_${this.tempIdCounter++}`;
    const newRow = {
      id: tempId,
      categoria: '',
      familia: '',
      subfamilia: '',
      vigente: true,
      principal: false,
      __isNew: true
    };

    this.rowData = [newRow, ...this.rowData];
    this.hasChanges = true;

    // Si es el único registro, marcarlo como principal
    this.ensureSinglePrincipal();

    // Refrescar el grid
    if (this.gridApi) {
      this.gridApi.setGridOption('rowData', this.rowData);
    }

    setTimeout(() => {
      this.gridApi.startEditingCell({
        rowIndex: 0,
        colKey: 'categoria'
      });
    }, 100);
  }

  async deleteSelected(): Promise<void> {
    if (!this.selectedRow) {
      return;
    }

    // Si la fila es nueva (no está en BD), solo eliminarla del grid
    if (this.selectedRow.__isNew) {
      this.rowData = this.rowData.filter(row => row.id !== this.selectedRow.id);
      this.selectedRow = null;

      // Después de eliminar, asegurar que haya un principal
      this.ensureSinglePrincipal();

      // Refrescar el grid
      if (this.gridApi) {
        this.gridApi.setGridOption('rowData', this.rowData);
      }
      return;
    }

    // Si la fila existe en BD, hacer soft delete
    try {
      console.log('Eliminando registro ID:', this.selectedRow.id);

      await new Promise((resolve, reject) => {
        this.providersService.deleteSubfamilyxProvider(this.selectedRow.id).subscribe({
          next: resolve,
          error: reject
        });
      });

      // Recargar datos desde el servidor
      await this.loadData();

      alerts.basicAlert(
        'Eliminado exitoso',
        'El registro se ha eliminado correctamente.',
        'success'
      );

      this.selectedRow = null;

    } catch (error) {
      console.error('Error al eliminar:', error);
      alerts.basicAlert(
        'Error',
        'No se pudo eliminar. Por favor, intente nuevamente.',
        'error'
      );
    }
  }

  async saveChanges(): Promise<void> {
    // Validar que todas las filas tengan las 3 columnas llenas
    const incompleteRows = this.rowData.filter(
      row => !row.categoria || !row.familia || !row.subfamilia
    );

    if (incompleteRows.length > 0) {
      alerts.basicAlert(
        'Validación',
        'Por favor complete todas las filas antes de guardar.',
        'warning'
      );
      return;
    }

    console.log('Datos a guardar:', this.rowData);

    try {
      // Separar filas nuevas y modificadas
      const newRows = this.rowData.filter(row => row.__isNew);
      const modifiedRows = this.rowData.filter(row => row.__modified && !row.__isNew);

      console.log('Filas nuevas:', newRows.length);
      console.log('Filas modificadas:', modifiedRows.length);

      // Procesar filas nuevas (POST)
      for (const row of newRows) {
        // Buscar el ID de la subfamilia por su descripción
        const subfam = this.subfamilias.find(s => s.description === row.subfamilia);

        if (!subfam) {
          console.error('Subfamilia no encontrada:', row.subfamilia);
          continue;
        }

        const dataToCreate = {
          idSubfamily: subfam.id,
          idProvider: this.params.data.id,
          vigente: row.vigente || false,
          principal: row.principal || false
        };

        console.log('Creando registro:', dataToCreate);
        await new Promise((resolve, reject) => {
          this.providersService.addSubfamilyxProvider(dataToCreate).subscribe({
            next: resolve,
            error: reject
          });
        });
      }

      // Procesar filas modificadas (PUT)
      for (const row of modifiedRows) {
        // Buscar el ID de la subfamilia por su descripción
        const subfam = this.subfamilias.find(s => s.description === row.subfamilia);

        if (!subfam || !row.id) {
          console.error('Subfamilia no encontrada o ID inválido:', row);
          continue;
        }

        const dataToUpdate = {
          idSubfamily: subfam.id,
          idProvider: this.params.data.id,
          vigente: row.vigente || false,
          principal: row.principal || false
        };

        console.log('Actualizando registro ID:', row.id, dataToUpdate);
        await new Promise((resolve, reject) => {
          this.providersService.updateSubfamilyxProvider(row.id, dataToUpdate).subscribe({
            next: resolve,
            error: reject
          });
        });
      }

      // Recargar datos desde el servidor
      await this.loadData();

      // Buscar el registro marcado como principal y actualizar el campo typeProvider en la tabla padre
      const principalRow = this.rowData.find(row => row.principal === true);

      if (principalRow) {
        const tipoProveedorConcatenado = `${principalRow.categoria}/${principalRow.familia}/${principalRow.subfamilia}`;

        console.log('🔍 OBTENIENDO DATOS DEL PROVIDER');
        console.log('🔍 Tipo concatenado:', tipoProveedorConcatenado);
        console.log('🔍 ID del Provider:', this.params.data.id);

        try {
          // Consultar con getCustomerById
          console.log('\n📡 Consultando getCustomerById(' + this.params.data.id + ')...');
          const providerData: any = await new Promise((resolve, reject) => {
            this.customersService.getCustomerById(this.params.data.id).subscribe({
              next: resolve,
              error: reject
            });
          });

          console.log('✅ Respuesta de getCustomerById:', providerData);
          console.log('📊 typework actual:', providerData?.typework);

          // Actualizar solo el campo typework
          providerData.typework = tipoProveedorConcatenado;
          console.log('📝 Actualizando typework a:', tipoProveedorConcatenado);

          // Guardar con updateCustomer
          console.log('💾 Guardando en DB Administration.Customer...');
          await new Promise((resolve, reject) => {
            this.customersService.updateCustomer(this.params.data.id.toString(), providerData).subscribe({
              next: resolve,
              error: reject
            });
          });

          console.log('✅ typework actualizado exitosamente en DB Administration.Customer');

          // Actualizar los datos locales en el objeto del grid padre
          this.params.data.typework = tipoProveedorConcatenado;
          this.params.data.typeProvider = tipoProveedorConcatenado;

        } catch (error) {
          console.error('❌ Error al actualizar typework en DB:', error);
          console.error('Detalle del error:', JSON.stringify(error, null, 2));
          alerts.basicAlert(
            'Advertencia',
            'Los datos de subfamilia se guardaron correctamente, pero hubo un error al actualizar el tipo de proveedor en la tabla principal.',
            'warning'
          );
        }
      }

      alerts.basicAlert(
        'Guardado exitoso',
        'Los cambios se han guardado correctamente.',
        'success'
      );

      this.hasChanges = false;

      // Notificar al grid padre para actualizar visualización
      if (this.params.api) {
        this.params.api.applyTransaction({ update: [this.params.data] });
      }

    } catch (error) {
      console.error('Error al guardar:', error);
      alerts.basicAlert(
        'Error',
        'No se pudo guardar. Por favor, intente nuevamente.',
        'error'
      );
    }
  }

  async revertChanges(): Promise<void> {
    // Recargar datos desde el endpoint
    await this.loadData();
    this.hasChanges = false;
    this.selectedRow = null;
  }

  getPreviewString(): string {
    const validRows = this.rowData.filter(
      row => row.categoria && row.familia && row.subfamilia
    );

    if (validRows.length === 0) {
      return '';
    }

    return validRows
      .map(row => `${row.categoria}/${row.familia}/${row.subfamilia}`)
      .join(' | ');
  }
}
