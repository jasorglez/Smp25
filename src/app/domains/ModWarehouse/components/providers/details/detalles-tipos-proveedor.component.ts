import { Component, inject, Renderer2, RendererFactory2 } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { CommonModule } from '@angular/common';
import { AgGridModule } from 'ag-grid-angular';
import { CatalogsService } from 'app/services/catalogs.service';
import { SignalsService } from 'app/services/signals.service';
import { ProvidersService } from 'app/services/providers.service';
import { CustomersService } from 'app/services/customers.service';
import { alerts } from 'app/helpers/alerts';
import { SelectWithTooltipEditorV2Component } from 'app/shared/select-with-tooltip-editor-v2.component';

@Component({
  selector: 'app-detalles-tipos-proveedor',
  standalone: true,
  imports: [CommonModule, AgGridModule, SelectWithTooltipEditorV2Component],
  template: `
    <div style="padding: 5px; background-color: #e3f2fd; height: 100%; max-height: 100%; display: flex; flex-direction: column; box-sizing: border-box; overflow: hidden;">
      <!-- Título y botones -->
      <div style="margin-bottom: 5px; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;" *ngIf="!invited">
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
      <div style="flex: 1 1 auto; min-height: 0; position: relative; overflow: hidden;">
        <ag-grid-angular
          class="ag-theme-quartz small-text-ag-grid"
          style="width: 100%; height: 100%; position: absolute; top: 0; left: 0; right: 0; bottom: 0;"
          [rowData]="rowData"
          [columnDefs]="columnDefs"
          [gridOptions]="gridOptions"
          (gridReady)="onGridReady($event)"
          (cellValueChanged)="onCellValueChanged($event)"
          (selectionChanged)="onSelectionChanged($event)">
        </ag-grid-angular>
      </div>

      <!-- Previsualización de la cadena concatenada -->
      <ng-container *ngIf="getPreviewString()">
        <div style="margin-top: 5px; flex-shrink: 0;">
          <div class="alert alert-info py-1 mb-0" style="font-size: 0.85rem;">
            <small>
              <strong>Vista previa:</strong> {{ getPreviewString() }}
            </small>
          </div>
        </div>
      </ng-container>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
      margin: 0;
      padding: 0;
      overflow: hidden;
    }
  `]
})
export class DetallesTiposProveedorComponent implements ICellRendererAngularComp {

  private catalogsService = inject(CatalogsService);
  private signalsService = inject(SignalsService);
  private providersService = inject(ProvidersService);
  private customersService = inject(CustomersService);
  private renderer: Renderer2;
  private tooltipElement: HTMLElement | null = null;

  params: any;
  gridApi!: GridApi;
  rowData: any[] = [];
  selectedRow: any = null;
  hasChanges: boolean = false;
  private tempIdCounter: number = 0;
  private idRoot: number;
  invited: boolean = false;

  // Datos reales desde endpoints
  categorias: any[] = [];      // Desde getCatalogs(idRoot, 'CATEGORY')
  familias: any[] = [];         // Desde getCatalogs(idRoot, 'FAM-CAT')
  subfamilias: any[] = [];      // Desde getCatalogs(idRoot, 'SUB-FAM')

  constructor(rendererFactory: RendererFactory2) {
    this.renderer = rendererFactory.createRenderer(null, null);
  }

  // Column Defs con combo boxes en cascada
  columnDefs: any[] = [
    {
      field: 'vigente',
      headerName: 'Activo',
      cellRenderer: 'agCheckboxCellRenderer',
      cellEditor: 'agCheckboxCellEditor',
      editable: true,
      width: 80,
      onCellValueChanged: async (params: any) => {
        // 🔍 DEBUG: Cambio en checkbox VIGENTE

        // Guardar ID de la fila modificada para restaurar focus
        const modifiedRowId = params.data.id;
        const modifiedRowCategoria = params.data.categoria;
        const modifiedRowFamilia = params.data.familia;

        // Si se desmarca como vigente, también desmarcar como principal
        if (params.newValue === false && params.data.principal === true) {
          params.data.principal = false;
          // Buscar y marcar otro como principal si es necesario
          const activeRows = this.rowData.filter(row => row.vigente && row.id !== params.data.id);
          if (activeRows.length > 0) {
            activeRows[0].principal = true;
          }

          // ✅ SOLUCIÓN PROBLEMA 3: NO ordenar durante la edición - solo refrescar celdas
          this.gridApi?.refreshCells({
            force: true
          });
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

        // Marcar como modificado
        params.data.__modified = true;
        this.hasChanges = true;
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
      cellRenderer: (params: any) => {
        const value = params.value || '';
        const container = document.createElement('div');
        container.style.cssText = 'width: 100%; height: 100%; display: flex; align-items: center; cursor: pointer;';
        container.textContent = value;

        container.addEventListener('mouseenter', (e) => {
          const catalogItem = this.categorias.find(c => c.description === value);
          if (catalogItem) {
            const rect = (e.target as HTMLElement).getBoundingClientRect();
            this.showCellTooltip(catalogItem, rect);
          }
        });

        container.addEventListener('mouseleave', () => {
          this.hideCellTooltip();
        });

        return container;
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
      cellRenderer: (params: any) => {
        const value = params.value || '';
        const container = document.createElement('div');
        container.style.cssText = 'width: 100%; height: 100%; display: flex; align-items: center; cursor: pointer;';
        container.textContent = value;

        container.addEventListener('mouseenter', (e) => {
          const catalogItem = this.familias.find(f => f.description === value);
          if (catalogItem) {
            const rect = (e.target as HTMLElement).getBoundingClientRect();
            this.showCellTooltip(catalogItem, rect);
          }
        });

        container.addEventListener('mouseleave', () => {
          this.hideCellTooltip();
        });

        return container;
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
        const categoriaSeleccionada = params.data.categoria;
        const familiaSeleccionada = params.data.familia;
        const familiaObj = this.familias.find(f => f.description === familiaSeleccionada);

        if (familiaObj) {
          // Obtener todas las subfamilias que pertenecen a esta familia
          let subfamiliasFiltradas = this.subfamilias
            .filter(s => s.subParentId === familiaObj.id);

          // Excluir subfamilias que ya existen con la misma combinación Categoría-Familia
          // en otras filas (excepto la fila actual que se está editando)
          const existingCombinations = this.rowData
            .filter(row =>
              row.id !== params.data.id && // Excluir la fila actual
              row.categoria === categoriaSeleccionada && // Misma categoría
              row.familia === familiaSeleccionada // Misma familia
            )
            .map(row => row.subfamilia);


          // Filtrar subfamilias que NO estén en las combinaciones existentes
          subfamiliasFiltradas = subfamiliasFiltradas
            .filter(s => !existingCombinations.includes(s.description))
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
      cellRenderer: (params: any) => {
        const value = params.value || '';
        const container = document.createElement('div');
        container.style.cssText = 'width: 100%; height: 100%; display: flex; align-items: center; cursor: pointer;';
        container.textContent = value;

        container.addEventListener('mouseenter', (e) => {
          const catalogItem = this.subfamilias.find(s => s.description === value);
          if (catalogItem) {
            const rect = (e.target as HTMLElement).getBoundingClientRect();
            this.showCellTooltip(catalogItem, rect);
          }
        });

        container.addEventListener('mouseleave', () => {
          this.hideCellTooltip();
        });

        return container;
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
      onCellValueChanged: async (params: any) => {
        // 🔍 DEBUG: Cambio en checkbox PRINCIPAL

        // Guardar ID de la fila modificada para restaurar focus
        const modifiedRowId = params.data.id;
        const modifiedRowCategoria = params.data.categoria;
        const modifiedRowFamilia = params.data.familia;

        // Si se intenta marcar como principal pero no está vigente, revertir
        if (params.newValue === true && params.data.vigente === false) {
          params.data.principal = false;

          // ✅ SOLUCIÓN PROBLEMA 3: NO ordenar durante la edición - solo refrescar
          this.gridApi?.refreshCells({
            force: true
          });

          await alerts.basicAlert(
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

            // ✅ SOLUCIÓN PROBLEMA 3: NO ordenar durante la edición - solo refrescar
            this.gridApi?.refreshCells({
              force: true
            });

            await alerts.basicAlert(
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
              // ✅ Si tenía principal=true, marcar como __modified para que se persista en BD
              if (row.principal === true) {
                row.__modified = true;
              }
              row.principal = false;
            }
          });

          // ✅ SOLUCIÓN PROBLEMA 3: NO ordenar durante la edición - solo refrescar todas las celdas
          this.gridApi?.refreshCells({
            force: true
          });

          // ✅ Forzar redibujado de todas las filas para actualizar getRowStyle (color de fondo)
          this.gridApi?.redrawRows();
        }

        // Marcar como modificado
        params.data.__modified = true;
        this.hasChanges = true;
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
    domLayout: 'normal', // El grid se ajusta al contenedor y permite scroll
    suppressHorizontalScroll: false,
    getRowStyle: (params: any) => {
      // Si la fila es principal (principal=true), aplicar fondo rojo claro
      if (params.data.principal === true) {
        return { background: '#ffcccc' };
      }
      return undefined;
    },
    onFirstDataRendered: (params) => {

      // Obtener todas las columnas
      const allColumnIds: string[] = [];
      params.api.getColumns()?.forEach((column: any) => {
        allColumnIds.push(column.getId());
      });


      // Autoajustar todas las columnas al contenido (skipHeader=false incluye header en el cálculo)
      params.api.autoSizeColumns(allColumnIds, false);

    }
  };

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.idRoot = this.signalsService.getRootSelectedBySidebar()();
    this.invited = this.signalsService.getInvited()();

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



      // Convertir datos del endpoint a formato del grid
      this.rowData = (providerTypes as any[]).map((item: any) => ({
        id: item.id,
        categoria: item.nameParent || '',
        familia: item.nameSubparent || '',
        subfamilia: item.nameProduct || '',
        vigente: item.vigente || false,
        principal: item.principal || false,
        idParent: item.idParent,
        idSubparent: item.idSubparent,
        idSubfamily: item.idSubfamily,  // Guardar el ID original para detectar cambios
        __originalSubfamilia: item.nameProduct || ''  // Guardar el valor original
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
      event.data.__modified = true;
      this.hasChanges = true;
    }
    // Cuando cambia la familia, limpiar subfamilia
    else if (event.colDef.field === 'familia') {
      event.data.subfamilia = '';
      this.gridApi.refreshCells({ rowNodes: [event.node], force: true });
      event.data.__modified = true;
      this.hasChanges = true;
    }
    // Cuando cambia la subfamilia
    else if (event.colDef.field === 'subfamilia') {
      event.data.__modified = true;
      this.hasChanges = true;
    }
    // Los checkboxes (vigente/principal) NO marcan como __modified
    // porque tienen sus propios handlers que gestionan el estado
  }

  onSelectionChanged(event: any): void {
    const selectedRows = event.api.getSelectedRows();
    this.selectedRow = selectedRows.length > 0 ? selectedRows[0] : null;

    // 🔍 DEBUG: Mostrar datos de la fila seleccionada
    if (this.selectedRow) {
    }
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

      await new Promise((resolve, reject) => {
        this.providersService.deleteSubfamilyxProvider(this.selectedRow.id).subscribe({
          next: resolve,
          error: reject
        });
      });

      // Recargar datos desde el servidor
      await this.loadData();

      // ✅ Si ya no quedan registros, limpiar typeProvider en el grid padre
      if (this.rowData.length === 0) {

        try {
          const providerData: any = await new Promise((resolve, reject) => {
            this.customersService.getCustomerById(this.params.data.id).subscribe({
              next: resolve,
              error: reject
            });
          });

          providerData.typework = '';

          await new Promise((resolve, reject) => {
            this.customersService.updateCustomer(this.params.data.id.toString(), providerData).subscribe({
              next: resolve,
              error: reject
            });
          });

          this.params.data.typework = '';
          this.params.data.typeProvider = '';

          if (this.params.api) {
            this.params.api.refreshCells({
              rowNodes: [this.params.node],
              columns: ['typeProvider'],
              force: true
            });
          }


        } catch (error) {
          console.error('❌ Error al limpiar typeProvider:', error);
        }
      }

      await alerts.basicAlert(
        'Eliminado exitoso',
        'El registro se ha eliminado correctamente.',
        'success'
      );

      this.selectedRow = null;

    } catch (error) {
      console.error('Error al eliminar:', error);
      await alerts.basicAlert(
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

    // Validar que no haya combinaciones duplicadas Categoría-Familia-Subfamilia
    const combinations = this.rowData.map(row =>
      `${row.categoria}|${row.familia}|${row.subfamilia}`
    );

    const duplicates = combinations.filter((item, index) =>
      combinations.indexOf(item) !== index
    );

    if (duplicates.length > 0) {
      const duplicateList = duplicates
        .map(d => d.replace(/\|/g, ' / '))
        .join('\n');

      alerts.basicAlert(
        'Combinaciones Duplicadas',
        `Las siguientes combinaciones están duplicadas:\n\n${duplicateList}\n\nPor favor, elimine o modifique las filas duplicadas.`,
        'error'
      );
      return;
    }


    try {
      // Separar filas nuevas y modificadas
      const newRows = this.rowData.filter(row => row.__isNew);
      const modifiedRows = this.rowData.filter(row => row.__modified && !row.__isNew);


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

        // Actualizar el registro (el backend permite cambiar la subfamilia manteniendo el ID)
        const dataToUpdate = {
          idSubfamily: subfam.id,
          idProvider: this.params.data.id,
          vigente: row.vigente || false,
          principal: row.principal || false
        };

        await new Promise((resolve, reject) => {
          this.providersService.updateSubfamilyxProvider(row.id, dataToUpdate).subscribe({
            next: resolve,
            error: reject
          });
        });
      }

      // Guardar la fila seleccionada actual para restaurarla después
      const selectedRow = this.selectedRow;
      const selectedRowId = selectedRow?.id;
      const selectedRowCombination = selectedRow
        ? `${selectedRow.categoria}|${selectedRow.familia}|${selectedRow.subfamilia}`
        : null;

      // Si hubo filas nuevas, recargar datos del servidor para obtener los IDs reales
      // Si solo hubo modificaciones, limpiar flags localmente
      // ✅ SOLUCIÓN PROBLEMA 1: Siempre recargar datos desde servidor después de guardar
      // Esto asegura que los datos estén sincronizados y evita problemas de mapeo

      // Recargar datos desde el servidor
      const providerTypes: any = await new Promise((resolve, reject) => {
        this.providersService.getProviderType(this.params.data.id).subscribe({
          next: resolve,
          error: reject
        });
      });


      // Mapear datos correctamente
      this.rowData = (providerTypes || []).map((item: any) => ({
        id: item.id,
        categoria: item.nameParent || '',
        familia: item.nameSubparent || '',
        subfamilia: item.nameProduct || '',
        vigente: item.vigente || false,
        principal: item.principal || false,
        idParent: item.idParent,
        idSubparent: item.idSubparent,
        idSubfamily: item.idSubfamily,
        __originalSubfamilia: item.nameProduct || ''
      }));

      // Ordenar por vigente y principal
      this.rowData.sort((a, b) => {
        if (a.vigente !== b.vigente) return b.vigente ? 1 : -1;
        if (a.principal !== b.principal) return b.principal ? 1 : -1;
        return (a.id || 0) - (b.id || 0);
      });


      // Actualizar el grid
      this.gridApi?.setGridOption('rowData', this.rowData);

      // Buscar el registro marcado como principal y actualizar el campo typeProvider en la tabla padre
      const principalRow = this.rowData.find(row => row.principal === true);

      // ✅ Si NO hay registros o NO hay principal, limpiar el campo typeProvider
      const hasNoPrincipal = !principalRow;

      if (hasNoPrincipal) {

        try {
          // Consultar con getCustomerById
          const providerData: any = await new Promise((resolve, reject) => {
            this.customersService.getCustomerById(this.params.data.id).subscribe({
              next: resolve,
              error: reject
            });
          });

          // Limpiar el campo typework
          providerData.typework = '';

          // Guardar con updateCustomer
          await new Promise((resolve, reject) => {
            this.customersService.updateCustomer(this.params.data.id.toString(), providerData).subscribe({
              next: resolve,
              error: reject
            });
          });


          // Actualizar los datos locales
          this.params.data.typework = '';
          this.params.data.typeProvider = '';

          // Forzar actualización visual en el grid padre
          if (this.params.api) {
            this.params.api.refreshCells({
              rowNodes: [this.params.node],
              columns: ['typeProvider'],
              force: true
            });
          }

        } catch (error) {
          console.error('❌ Error al limpiar typework en DB:', error);
        }

      } else {
        // ✅ Validar que el registro principal tenga todos los campos completos
        const isComplete = principalRow.categoria && principalRow.familia && principalRow.subfamilia;

        if (!isComplete) {
          // No actualizar typeProvider pero continuar con el resto del flujo
        } else {
          const tipoProveedorConcatenado = `${principalRow.categoria}/${principalRow.familia}/${principalRow.subfamilia}`;


          try {
            // Consultar con getCustomerById
            const providerData: any = await new Promise((resolve, reject) => {
              this.customersService.getCustomerById(this.params.data.id).subscribe({
                next: resolve,
                error: reject
              });
            });


            // Actualizar solo el campo typework
            providerData.typework = tipoProveedorConcatenado;

            // Guardar con updateCustomer
            await new Promise((resolve, reject) => {
              this.customersService.updateCustomer(this.params.data.id.toString(), providerData).subscribe({
                next: resolve,
                error: reject
              });
            });


            // ✅ SOLUCIÓN PROBLEMA 2: Actualizar los datos locales Y refrescar el grid padre
            this.params.data.typework = tipoProveedorConcatenado;
            this.params.data.typeProvider = tipoProveedorConcatenado;

            // Forzar actualización visual en el grid padre incluso con detalle abierto
            if (this.params.api && this.params.node) {
              // ✅ setDataValue notifica a AG Grid del cambio y refresca la celda en tiempo real
              try {
                this.params.node.setDataValue('typework', tipoProveedorConcatenado);
                this.params.node.setDataValue('typeProvider', tipoProveedorConcatenado);
              } catch (eSetData) {
                console.warn('No se pudo aplicar setDataValue al nodo padre:', eSetData);
              }

              // Refrescar la celda específica en el grid padre como respaldo
              this.params.api.refreshCells({
                rowNodes: [this.params.node],
                columns: ['typeProvider'],
                force: true,
                suppressFlash: true
              });
            }

          } catch (error) {
            console.error('❌ Error al actualizar typework en DB:', error);
            console.error('Detalle del error:', JSON.stringify(error, null, 2));
            await alerts.basicAlert(
              'Advertencia',
              'Los datos de subfamilia se guardaron correctamente, pero hubo un error al actualizar el tipo de proveedor en la tabla principal.',
              'warning'
            );
          }
        }
      }

      // Restaurar focus ANTES de mostrar el alert (para que no se pierda al cerrar el alert)
      await new Promise(resolve => requestAnimationFrame(() => resolve(null)));

      if (this.gridApi && selectedRow) {
        let rowToSelect = null;


        // Intentar encontrar por ID original (si no era temporal)
        if (selectedRowId && !String(selectedRowId).startsWith('temp_')) {
          rowToSelect = this.rowData.find(r => r.id === selectedRowId);
        }

        // Si no se encontró, buscar por combinación categoria/familia/subfamilia
        if (!rowToSelect && selectedRowCombination) {
          rowToSelect = this.rowData.find(r =>
            `${r.categoria}|${r.familia}|${r.subfamilia}` === selectedRowCombination
          );
        }

        // Si se encontró la fila, seleccionarla
        if (rowToSelect) {
          const rowIndex = this.rowData.indexOf(rowToSelect);

          // Intentar obtener el rowNode - si falla, iterar todos los nodos
          let rowNode = this.gridApi.getDisplayedRowAtIndex(rowIndex);

          if (!rowNode) {
            // Iterar sobre todos los nodos para encontrar el correcto
            this.gridApi.forEachNode((node) => {
              if (node.data && node.data.id === rowToSelect.id) {
                rowNode = node;
              }
            });
          }

          if (rowNode) {
            rowNode.setSelected(true);
            this.gridApi.ensureIndexVisible(rowNode.rowIndex!, 'middle');
          } else {
            console.error('❌ No se pudo obtener el rowNode');
          }
        } else {
          console.error('❌ No se encontró la fila para restaurar');
        }
      }

      // AHORA mostrar el alert (después de restaurar el focus)
      await alerts.basicAlert(
        'Guardado exitoso',
        'Los cambios se han guardado correctamente.',
        'success'
      );

      this.hasChanges = false;

      // Actualizar los datos del nodo padre SIN usar applyTransaction (para no destruir el detail grid)
      // Solo actualizar los datos en memoria
      if (this.params.data) {
        // Los datos del nodo padre ya se actualizaron en las líneas 927-928
        // No necesitamos hacer nada más aquí
      }

    } catch (error) {
      console.error('Error al guardar:', error);
      await alerts.basicAlert(
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

  // Métodos para mostrar/ocultar tooltip en celdas colapsadas
  private showCellTooltip(catalogItem: any, cellRect: DOMRect): void {
    this.hideCellTooltip();

    const description = catalogItem.valueAddition || 'NA';
    const abbreviation = catalogItem.valueAddition2 || 'NA';

    // Crear contenedor del tooltip
    this.tooltipElement = this.renderer.createElement('div');
    this.renderer.setStyle(this.tooltipElement, 'position', 'fixed');
    this.renderer.setStyle(this.tooltipElement, 'z-index', '10001');
    this.renderer.setStyle(this.tooltipElement, 'pointer-events', 'none');
    this.renderer.setStyle(this.tooltipElement, 'min-width', '280px');
    this.renderer.setStyle(this.tooltipElement, 'max-width', '400px');

    // Crear flecha del tooltip
    const arrow = this.renderer.createElement('div');
    this.renderer.setStyle(arrow, 'position', 'absolute');
    this.renderer.setStyle(arrow, 'left', '-8px');
    this.renderer.setStyle(arrow, 'top', '20px');
    this.renderer.setStyle(arrow, 'width', '0');
    this.renderer.setStyle(arrow, 'height', '0');
    this.renderer.setStyle(arrow, 'border-top', '8px solid transparent');
    this.renderer.setStyle(arrow, 'border-bottom', '8px solid transparent');
    this.renderer.setStyle(arrow, 'border-right', '8px solid #1e40af');
    this.renderer.appendChild(this.tooltipElement, arrow);

    // Crear contenido del tooltip
    const content = this.renderer.createElement('div');
    this.renderer.setStyle(content, 'border-radius', '8px');
    this.renderer.setStyle(content, 'box-shadow', '0 8px 24px rgba(0, 0, 0, 0.4)');
    this.renderer.setStyle(content, 'overflow', 'hidden');
    this.renderer.setStyle(content, 'border', '1px solid rgba(255, 255, 255, 0.1)');
    this.renderer.setStyle(content, 'background', 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)');

    // Header
    const header = this.renderer.createElement('div');
    this.renderer.setStyle(header, 'background', 'rgba(255, 255, 255, 0.15)');
    this.renderer.setStyle(header, 'padding', '10px 14px');
    this.renderer.setStyle(header, 'border-bottom', '1px solid rgba(255, 255, 255, 0.2)');
    this.renderer.setStyle(header, 'color', '#ffffff');
    this.renderer.setStyle(header, 'font-size', '13px');
    this.renderer.setStyle(header, 'display', 'flex');
    this.renderer.setStyle(header, 'align-items', 'center');
    this.renderer.setStyle(header, 'gap', '8px');
    this.renderer.setStyle(header, 'font-weight', '600');

    const headerIcon = this.renderer.createElement('i');
    this.renderer.addClass(headerIcon, 'bi');
    this.renderer.addClass(headerIcon, 'bi-info-circle');
    this.renderer.setStyle(headerIcon, 'font-size', '16px');
    this.renderer.appendChild(header, headerIcon);

    const headerText = this.renderer.createElement('strong');
    const headerTextNode = this.renderer.createText(catalogItem.description || '');
    this.renderer.appendChild(headerText, headerTextNode);
    this.renderer.appendChild(header, headerText);
    this.renderer.appendChild(content, header);

    // Body
    const body = this.renderer.createElement('div');
    this.renderer.setStyle(body, 'padding', '12px 14px');
    this.renderer.setStyle(body, 'color', '#e2e8f0');
    this.renderer.setStyle(body, 'font-size', '12px');

    // Descripción
    const descRow = this.renderer.createElement('div');
    this.renderer.setStyle(descRow, 'display', 'flex');
    this.renderer.setStyle(descRow, 'align-items', 'flex-start');
    this.renderer.setStyle(descRow, 'margin-bottom', '10px');
    this.renderer.setStyle(descRow, 'gap', '8px');

    const descLabel = this.renderer.createElement('span');
    this.renderer.setStyle(descLabel, 'color', 'rgba(255, 255, 255, 0.8)');
    this.renderer.setStyle(descLabel, 'font-weight', '600');
    this.renderer.setStyle(descLabel, 'min-width', '100px');
    this.renderer.setStyle(descLabel, 'display', 'flex');
    this.renderer.setStyle(descLabel, 'align-items', 'center');
    this.renderer.setStyle(descLabel, 'gap', '5px');
    this.renderer.setStyle(descLabel, 'flex-shrink', '0');

    const descIcon = this.renderer.createElement('i');
    this.renderer.addClass(descIcon, 'bi');
    this.renderer.addClass(descIcon, 'bi-pencil');
    this.renderer.setStyle(descIcon, 'font-size', '12px');
    this.renderer.appendChild(descLabel, descIcon);

    const descLabelText = this.renderer.createText('Descripción:');
    this.renderer.appendChild(descLabel, descLabelText);
    this.renderer.appendChild(descRow, descLabel);

    const descValue = this.renderer.createElement('span');
    this.renderer.setStyle(descValue, 'color', '#ffffff');
    this.renderer.setStyle(descValue, 'word-break', 'break-word');
    this.renderer.setStyle(descValue, 'line-height', '1.4');
    const descValueText = this.renderer.createText(description);
    this.renderer.appendChild(descValue, descValueText);
    this.renderer.appendChild(descRow, descValue);
    this.renderer.appendChild(body, descRow);

    // Abreviatura
    const abbrRow = this.renderer.createElement('div');
    this.renderer.setStyle(abbrRow, 'display', 'flex');
    this.renderer.setStyle(abbrRow, 'align-items', 'flex-start');
    this.renderer.setStyle(abbrRow, 'margin-bottom', '0');
    this.renderer.setStyle(abbrRow, 'gap', '8px');

    const abbrLabel = this.renderer.createElement('span');
    this.renderer.setStyle(abbrLabel, 'color', 'rgba(255, 255, 255, 0.8)');
    this.renderer.setStyle(abbrLabel, 'font-weight', '600');
    this.renderer.setStyle(abbrLabel, 'min-width', '100px');
    this.renderer.setStyle(abbrLabel, 'display', 'flex');
    this.renderer.setStyle(abbrLabel, 'align-items', 'center');
    this.renderer.setStyle(abbrLabel, 'gap', '5px');
    this.renderer.setStyle(abbrLabel, 'flex-shrink', '0');

    const abbrIcon = this.renderer.createElement('i');
    this.renderer.addClass(abbrIcon, 'bi');
    this.renderer.addClass(abbrIcon, 'bi-fonts');
    this.renderer.setStyle(abbrIcon, 'font-size', '12px');
    this.renderer.appendChild(abbrLabel, abbrIcon);

    const abbrLabelText = this.renderer.createText('Abreviatura:');
    this.renderer.appendChild(abbrLabel, abbrLabelText);
    this.renderer.appendChild(abbrRow, abbrLabel);

    const abbrValue = this.renderer.createElement('span');
    this.renderer.setStyle(abbrValue, 'color', '#ffffff');
    this.renderer.setStyle(abbrValue, 'word-break', 'break-word');
    this.renderer.setStyle(abbrValue, 'line-height', '1.4');
    const abbrValueText = this.renderer.createText(abbreviation);
    this.renderer.appendChild(abbrValue, abbrValueText);
    this.renderer.appendChild(abbrRow, abbrValue);
    this.renderer.appendChild(body, abbrRow);

    this.renderer.appendChild(content, body);
    this.renderer.appendChild(this.tooltipElement, content);

    // Agregar al body
    this.renderer.appendChild(document.body, this.tooltipElement);

    // Posicionar tooltip a la derecha de la celda
    const top = cellRect.top;
    const left = cellRect.right + 8;
    this.renderer.setStyle(this.tooltipElement, 'top', `${top}px`);
    this.renderer.setStyle(this.tooltipElement, 'left', `${left}px`);

    // Animación de entrada
    this.renderer.setStyle(this.tooltipElement, 'opacity', '0');
    setTimeout(() => {
      if (this.tooltipElement) {
        this.renderer.setStyle(this.tooltipElement, 'opacity', '1');
        this.renderer.setStyle(this.tooltipElement, 'transition', 'opacity 0.3s ease');
      }
    }, 10);
  }

  private hideCellTooltip(): void {
    if (this.tooltipElement) {
      this.renderer.removeChild(document.body, this.tooltipElement);
      this.tooltipElement = null;
    }
  }
}
