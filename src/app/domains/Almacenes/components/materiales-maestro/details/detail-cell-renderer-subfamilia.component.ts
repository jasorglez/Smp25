import { Component, inject, OnDestroy, NgZone } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams, ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { AgGridModule } from 'ag-grid-angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { alerts } from 'app/helpers/alerts';
import { runAutosizeAllColumns } from 'app/helpers/ag-grid-autosize.helper';
import { MaterialsService } from 'app/services/materials.service';
import { lastValueFrom, Subscription } from 'rxjs';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { SubfamiliaModalService } from '../services/subfamilia-modal.service';
import { PendingChangesService } from 'app/services/pending-changes.service';

@Component({
  selector: 'app-detail-cell-renderer-subfamilia',
  standalone: true,
  imports: [AgGridModule, CommonModule, FormsModule],
  template: `
<div style="padding: 10px; background-color: #fff3e0; height: 100%; display: flex; flex-direction: column;">
  <div style="margin-bottom: 15px; flex-grow: 1; display: flex; flex-direction: column;">
    <div style="margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
      <strong><i class="bi bi-cup-straw"></i> Variantes de: {{ materialName }}</strong>
      <div class="d-flex gap-2">
        <!-- Guardar centralizado en Nivel 1 (materiales-maestro). Ver PendingChangesService. -->
        <button
          class="btn btn-sm btn-warning me-2"
          (click)="revertChanges()">
          <i class="bi bi-arrow-clockwise"></i> Deshacer
        </button>
      </div>
    </div>
    <div *ngIf="isLoading"
         style="flex-grow:1; display:flex; align-items:center; justify-content:center; color:#888; font-size:0.9rem;">
      <i class="bi bi-arrow-repeat" style="margin-right:6px; animation:spin 1s linear infinite;"></i>
      Cargando...
    </div>
    <ag-grid-angular
      *ngIf="!isLoading"
      class="ag-theme-quartz small-text-ag-grid"
      style="width: 100%; flex-grow: 1;"
      [columnDefs]="columnDefs"
      [rowData]="flattenTreeData()"
      [gridOptions]="gridOptions"
      [rowSelection]="'single'"
      (gridReady)="onGridReady($event)"
      [autoGroupColumnDef]="autoGroupColumnDef">
    </ag-grid-angular>
  </div>
</div>
`,
  styles: [`
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.chevron-icon { cursor: pointer; margin-right: 5px; }
`]
})
export class DetailCellRendererSubfamiliaComponent implements ICellRendererAngularComp, OnDestroy {

  private materialsService = inject(MaterialsService);
  private modalService = inject(SubfamiliaModalService);
  private ngZone = inject(NgZone);
  private pendingChangesService = inject(PendingChangesService);
  private modalSubscription?: Subscription;
  private saverId: string = '';

  params: any;
  materialId: number;
  materialName: string;
  idRoot: number;
  idFamilia: number;

  isLoading = true;

  /** True si el materialId todavía es temporal (material aún no guardado en BD). */
  private isTempMaterialId(): boolean {
    return typeof this.materialId === 'string' && String(this.materialId).startsWith('temp_');
  }

  autoGroupColumnDef = {
    cellRendererParams: {
      suppressCount: true
    }
  };

  gridApi!: GridApi;
  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  // Datos planos de productos finales
  treeData: any[] = [];
  originalTreeData: any[] = []; // Para revertir cambios

  /** Cambios pendientes. El setter notifica al servicio central para que el botón
   *  Guardar del Nivel 1 encienda su badge rojo. */
  private _hasUnsavedChanges: boolean = false;
  get hasUnsavedChanges(): boolean { return this._hasUnsavedChanges; }
  set hasUnsavedChanges(value: boolean) {
    this._hasUnsavedChanges = value;
    if (this.saverId) {
      this.pendingChangesService.notifyChanges(this.saverId, value);
    }
  }

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.materialId = params.data.id;
    this.materialName = params.data.articulo || params.data.insumo;

    // Obtener idRoot e idFamilia del contexto del padre
    if (params.context?.idRoot) {
      this.idRoot = params.context.idRoot;
    }

    // La subfamilia viene del idFamilia del material
    this.idFamilia = params.data.idFamilia;

    // Suscribirse a confirmaciones de guardado del servicio de modales
    this.modalSubscription = this.modalService.saveConfirmed$.subscribe(data => {
      this.handleModalSave(data);
    });

    // Registro en el bus central para que el Guardar único del Nivel 1 invoque saveChanges().
    this.saverId = `subfamilia-${this.materialId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    this.pendingChangesService.register(this.saverId, {
      hasChanges: false,
      save: (idMap?: Map<string, number>) => this.saveChanges(idMap)
    });

    // Cargar datos
    this.loadCatalogData();
  }

  refresh(): boolean {
    return false;
  }

  ngOnDestroy() {
    if (this.modalSubscription) {
      this.modalSubscription.unsubscribe();
    }
    if (this.saverId) {
      this.pendingChangesService.unregister(this.saverId);
    }
  }

  // Cargar datos directamente desde getFinalProduct (sin jerarquía)
  async loadCatalogData() {

    // Las variantes (productos terminados) son POR EMPRESA → solo se necesita idRoot.
    // idFamilia no se usa para cargar; exigirlo bloqueaba materiales con familia null/0.
    if (!this.idRoot) {
      console.warn('❌ idRoot es null, no se pueden cargar datos');
      return;
    }

    this.isLoading = true;

    try {

      // Cargar productos finales desde el endpoint
      const finalProducts = await lastValueFrom(
        this.materialsService.getFinalProduct(this.idRoot)
      );

      // Asignar directamente como filas planas (sin mostrar al grid aún)
      this.treeData = finalProducts.map(product => ({
        ...product,
        originalId: product.id,
        seUsaAqui: false,
        isLoadingSeUsa: true
      }));

      // Cargar el estado "Se usa aquí" para todas las filas
      await this.loadSeUsaAquiStatus();

    } catch (error) {
      console.error('❌ Error al cargar datos de productos finales:', error);
      this.treeData = [];
      this.isLoading = false;
      alerts.basicAlert('Error', 'Error al cargar los datos.', 'error');
    }
  }

  // Hierarchical methods removed - not used in flat structure


  // Configuración del grid con grupos separados y filtros independientes
  get gridOptions(): any {
    return {
      headerHeight: 30,
      groupDisplayType: 'multipleColumns',
      suppressRowClickSelection: true,
      rowSelection: 'multiple',
      rowHeight: 30,
      animateRows: true,
      suppressClickEdit: false, // Cambié a false para permitir edición
      singleClickEdit: false,
      stopEditingWhenCellsLoseFocus: true,
      localeText: this.AG_GRID_LOCALE_ES,
      // Agrupación jerárquica con columnas visibles y filtros independientes
      groupDefaultExpanded: 0,
      suppressAggFuncInHeader: true,
      autoGroupColumnDef: {
    minWidth: 200,
    cellRendererParams: {
        suppressCount: false,
        innerRenderer: function(params) {
            // Si es grupo de categoría
            if (params.node.level === 0) {
                return params.value; // Categoría
            }
            // Si es grupo de sabor
            else if (params.node.level === 1) {
                return params.value; // Sabor
            }
            return '';
        }
    }
},

      onFirstDataRendered: (params: any) => runAutosizeAllColumns(params.api),

    };
  }

  // Definición de columnas con grupos separados y filtros independientes
  get columnDefs(): ColDef[] {
  return [
    {
      headerName: 'Categoría',
      field: 'category',
      rowGroup: true,
      rowGroupIndex: 0,
      cellRenderer: (params: any) => {
        if (params.node.group && params.node.level === 0) {
          // Contador = sabores con al menos 1 presentación con seUsaAqui = true
          const flavorsWithCheck = (params.node.childrenAfterFilter || []).filter((flavorNode: any) =>
            flavorNode.group &&
            (flavorNode.childrenAfterFilter || []).some((leaf: any) => !leaf.group && leaf.data?.seUsaAqui === true)
          ).length;
          return `${params.node.key} (${flavorsWithCheck})`;
        } else if (params.node.group && params.node.level === 1) {
          return params.node.key;
        } else {
          return params.value || '';
        }
      },
      hide: true
    },

    {
      headerName: 'Sabor',
      field: 'flavor',
      rowGroup: true,
      rowGroupIndex: 1,
      minWidth: 250,
      cellRenderer: (params: any) => {
        if (params.node.group && params.node.level === 1) {
          // Contador = presentaciones con seUsaAqui = true bajo este sabor
          const checkedCount = (params.node.childrenAfterFilter || []).filter((leaf: any) =>
            !leaf.group && leaf.data?.seUsaAqui === true
          ).length;
          return `${params.node.key} (${checkedCount})`;
        } else if (params.node.group && params.node.level === 0) {
          return '';
        } else {
          return params.value || '';
        }
      },
      hide: true
    },

    {
      headerName: 'Presentación',
      field: 'presentation',
      filter: 'agSetColumnFilter',
      filterParams: {
        buttons: ['reset', 'apply'],
        closeOnApply: true,
        caseSensitive: false
      },
      width: 300,
      resizable: true
    },

    {
      headerName: 'Se usa aquí',
      field: 'seUsaAqui',
      width: 120,
      // Checkbox NATIVO de AG Grid: interactivo cuando la celda es editable. Toggla con un
      // solo click, actualiza el dato y dispara onCellValueChanged (que marca el cambio para
      // el Guardar del Nivel 1 → materialxfinalproduct). Solo en filas hoja (presentaciones).
      editable: (params: any) => !params.node.group,
      cellStyle: { display: 'flex', justifyContent: 'center', alignItems: 'center' },
      cellRendererSelector: (params: any) =>
        params.node.group ? undefined : { component: 'agCheckboxCellRenderer' },
      cellEditor: 'agCheckboxCellEditor',
      valueGetter: (params: any) => params.node.group ? null : (params.data?.seUsaAqui === true),
      onCellValueChanged: (params: any) => {
        if (params.node.group) return;
        this.onSeUsaAquiChanged({
          data: params.data,
          oldValue: params.oldValue === true,
          newValue: params.newValue === true,
          node: params.node,
        });
      },
    }
  ];
}


  // Retornar todos los datos (ya son planos)
  flattenTreeData(): any[] {
    return this.treeData;
  }

  // Expand/collapse methods removed - not used in flat structure

  // Selección de filas (no usado en estructura plana)
  onRowSelected(event: any) {
    // Método mantenido por compatibilidad pero no usado
  }

  // Grid listo
  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  // Métodos de catálogo no usados en estructura plana (removidos)

  // ========== MÉTODOS PARA MODALES (no usados en estructura plana) ==========

  handleModalSave(data: any) {
    // Método mantenido por compatibilidad con modal service pero no usado
  }

  // Modal handlers removed - not used in flat structure

  async saveChanges(idMap?: Map<string, number>) {
    // Remapeo de ID temporal → real cuando el Nivel 1 acaba de crear el material padre.
    if (this.isTempMaterialId() && idMap) {
      const realId = idMap.get(String(this.materialId));
      if (realId) {
        this.materialId = realId;
      }
    }

    if (!this.hasUnsavedChanges) {
      // Cuando se invoca desde el Guardar centralizado sin cambios reales, sólo retornar.
      if (idMap) return;
      alerts.basicAlert('Info', 'No hay cambios sin guardar.', 'info');
      return;
    }

    try {
      // Filtrar productos con cambios en "Se usa aquí"
      const productsToSave = this.treeData.filter(item => item.__seUsaAquiModified);


      // Guardar cambios de "Se usa aquí" (MaterialxFinalProduct)
      for (const product of productsToSave) {
        const originalValue = product.__originalSeUsaAqui ?? false;
        const currentValue = product.seUsaAqui;


        if (currentValue === true && originalValue === false) {
          // Agregar relación
          await lastValueFrom(
            this.materialsService.addMaterialToFinalProduct(
              this.materialId,
              product.originalId,
              {}
            )
          );
        } else if (currentValue === false && originalValue === true) {
          // Eliminar relación
          await lastValueFrom(
            this.materialsService.removeMaterialFromFinalProduct(
              this.materialId,
              product.originalId
            )
          );
        }

        // Limpiar flags de modificación
        delete product.__seUsaAquiModified;
        delete product.__originalSeUsaAqui;
      }

      // El mensaje de éxito lo muestra el Guardar centralizado del Nivel 1 (materiales-maestro);
      // aquí NO se muestra para no duplicar la alerta.
      this.hasUnsavedChanges = false;
      await this.loadCatalogData();

      // Actualizar contador "Donde Usa" en Nivel 1 (ya recalculado por loadCatalogData)
      this.notifyParentCount();
    } catch (error: any) {
      console.error('❌ Error al guardar cambios:', error);
      const errorMsg = error?.error?.message || error?.message || 'Error desconocido';
      alerts.basicAlert('Error', `Error al guardar los cambios: ${errorMsg}`, 'error');
    }
  }

  revertChanges() {
    if (!this.hasUnsavedChanges) {
      alerts.basicAlert('Info', 'No hay cambios para revertir.', 'info');
      return;
    }

    this.treeData = JSON.parse(JSON.stringify(this.originalTreeData));
    this.hasUnsavedChanges = false;

    if (this.gridApi) {
      this.gridApi.setGridOption('rowData', this.flattenTreeData());
      // Autosize columnas después de revertir
      setTimeout(() => runAutosizeAllColumns(this.gridApi), 50);
    }

    alerts.basicAlert('Éxito', 'Cambios revertidos correctamente.', 'success');
  }

  // Cargar el estado "Se usa aquí" para todas las filas
  private async loadSeUsaAquiStatus() {


    if (this.treeData.length === 0) {
      return;
    }

    // Si el material aún no existe en BD (id temporal), no hay relaciones que consultar;
    // todos quedan en false hasta que el Guardar del Nivel 1 cree el material.
    if (this.isTempMaterialId()) {
      this.treeData.forEach(product => {
        product.seUsaAqui = false;
        product.isLoadingSeUsa = false;
      });
      this.originalTreeData = JSON.parse(JSON.stringify(this.treeData));
      this.isLoading = false;
      return;
    }

    // Cargar el estado para cada producto
    const promises = this.treeData.map(async (product) => {
      try {
        const exists = await lastValueFrom(
          this.materialsService.checkMaterialExistsInFinalProduct(this.materialId, product.originalId)
        );
        product.seUsaAqui = exists;
        product.isLoadingSeUsa = false;
      } catch (error) {
        console.error(`❌ Error al verificar producto "${product.presentation}":`, error);
        product.seUsaAqui = false;
        product.isLoadingSeUsa = false;
      }
    });

    // Esperar a que todas las consultas terminen
    await Promise.all(promises);

    // Reordenar: items marcados primero
    this.reorderMarkedItemsFirst();

    // Guardar copia para revertir cambios
    this.originalTreeData = JSON.parse(JSON.stringify(this.treeData));

    // Mostrar grid con datos finales — onFirstDataRendered hace el autosize una sola vez
    this.isLoading = false;

    // Actualizar contador "Donde Usa" en Nivel 1
    this.notifyParentCount();
  }

  // Reordenar para que items marcados aparezcan primero
  private reorderMarkedItemsFirst() {

    // Separar productos marcados y no marcados
    const markedProducts = this.treeData.filter(item => item.seUsaAqui === true);
    const unmarkedProducts = this.treeData.filter(item => item.seUsaAqui !== true);


    // Reordenar: marcados primero, luego no marcados
    this.treeData = [...markedProducts, ...unmarkedProducts];

  }

  // Manejar cambios en el checkbox "Se usa aquí" (solo marcar, no guardar)
  onSeUsaAquiChanged(params: any) {
    const product = params.data;
    const newValue = params.newValue;
    const oldValue = params.oldValue;


    // Si no cambió realmente, no hacer nada
    if (newValue === oldValue) {
      return;
    }

    // Guardar el valor original si no existe
    if (product.__originalSeUsaAqui === undefined) {
      product.__originalSeUsaAqui = oldValue;
    }

    // Marcar como modificado
    product.__seUsaAquiModified = true;

    // Actualizar el estado de "hasUnsavedChanges"
    this.hasUnsavedChanges = true;

    // Refrescar filas de grupo para actualizar los contadores de Categoría y Sabor
    if (this.gridApi) {
      const groupNodes: any[] = [];
      this.gridApi.forEachNode((node: any) => { if (node.group) groupNodes.push(node); });
      this.gridApi.refreshCells({ rowNodes: groupNodes, force: true });
    }
  }

  // Catalog/expansion helper methods removed - not used in flat structure

  /** Envía al Nivel 1 la cantidad de checkboxes "Se usa aquí" activos para actualizar "Donde Usa". */
  private notifyParentCount(): void {
    const count = this.treeData.filter(p => p.seUsaAqui === true).length;
    const parent = this.params?.context?.componentParent;
    if (parent?.updateSubfamilyCountDirect) {
      parent.updateSubfamilyCountDirect(this.materialId, count);
    }
  }
}
