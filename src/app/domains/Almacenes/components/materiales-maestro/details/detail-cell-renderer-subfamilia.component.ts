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
        <button
          class="btn btn-sm btn-primary me-2 position-relative"
          (click)="saveChanges()"
          [disabled]="!hasUnsavedChanges">
          <i class="bi bi-floppy"></i> Guardar
          <span class="position-absolute top-0 start-100 translate-middle p-2 bg-danger border border-light rounded-circle"
            *ngIf="hasUnsavedChanges">
            <span class="visually-hidden">Hay cambios sin guardar</span>
          </span>
        </button>
        <button
          class="btn btn-sm btn-warning me-2"
          (click)="revertChanges()">
          <i class="bi bi-arrow-clockwise"></i> Deshacer
        </button>
      </div>
    </div>
    <ag-grid-angular
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
.chevron-icon {
  cursor: pointer;
  margin-right: 5px;
}
`]
})
export class DetailCellRendererSubfamiliaComponent implements ICellRendererAngularComp, OnDestroy {

  private materialsService = inject(MaterialsService);
  private modalService = inject(SubfamiliaModalService);
  private ngZone = inject(NgZone);
  private modalSubscription?: Subscription;

  params: any;
  materialId: number;
  materialName: string;
  idRoot: number;
  idFamilia: number;

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
  hasUnsavedChanges: boolean = false;

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
  }

  // Cargar datos directamente desde getFinalProduct (sin jerarquía)
  async loadCatalogData() {

    if (!this.idRoot || !this.idFamilia) {
      console.warn('❌ idRoot o idFamilia es null, no se pueden cargar datos');
      return;
    }

    try {

      // Cargar productos finales desde el endpoint
      const finalProducts = await lastValueFrom(
        this.materialsService.getFinalProduct(this.idRoot)
      );

      if (finalProducts.length > 0) {
      }

      // Asignar directamente como filas planas
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
        // category: nivel 0 (top-level group)
        if (params.node.group && params.node.level === 0) {
          // Los children de category son nodos "flavor" (nivel 1).
          let totalCount = 0;
          let checkedCount = 0;
          params.node.childrenAfterFilter?.forEach((flavorNode: any) => {
            // Cada flavorNode tiene sus hijos reales (las filas)
            const flavorChecked = flavorNode.childrenAfterFilter?.filter((child: any) => child.data?.seUsaAqui === true).length || 0;
            const flavorTotal = flavorNode.allChildrenCount || 0;
            checkedCount += flavorChecked;
            totalCount += flavorTotal;
          });
          return `${params.node.key} (${checkedCount})`;
        } else if (params.node.group && params.node.level === 1) {
          // Si por alguna razón llegas a ver el nodo de sabor aquí (no debería si agrupas),
          // muestra solo la key del flavor.
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
      cellRenderer: (params: any) => {
        // flavor: nivel 1 (segundo nivel)
        if (params.node.group && params.node.level === 1) {
          // Este nodo tiene children que son las filas; contamos aquí mismo.
          const total = params.node.allChildrenCount || 0;
          const checked = params.node.childrenAfterFilter?.filter((child: any) => child.data?.seUsaAqui === true).length || 0;
          return `${params.node.key} (${checked})`;
        } else if (params.node.group && params.node.level === 0) {
          // Nivel categoria: lo gestionamos en la columna 'Categoría' (arriba).
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
      cellRenderer: (params: any) => {
        if (params.node.group) return '';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = params.value === true;
        checkbox.style.cursor = 'pointer';
        checkbox.style.width = '18px';
        checkbox.style.height = '18px';

        checkbox.addEventListener('click', (event) => {
          event.stopPropagation(); // evita expandir/select
          // Ejecutar la mutación dentro de Angular zone si hace falta (tu código original lo hacía)
          this.ngZone.run(() => {
            const oldValue = params.data.seUsaAqui;
            const newValue = !oldValue;
            params.data.seUsaAqui = newValue;

            // 1) Notificar al componente (tu handler)
            this.onSeUsaAquiChanged({ data: params.data, oldValue, newValue, node: params.node });

            // 2) Informar a ag-Grid sobre el cambio de datos para que lo procese bien
            // Usar applyTransaction para que ag-Grid gestione el rowModel y cambios
            params.api.applyTransaction({ update: [params.data] });

            // 3) Redibujar nodos de grupo para actualizar los contadores visibles
            const groupNodes: any[] = [];
            params.api.forEachNode((n: any) => {
              if (n.group && (n.level === 0 || n.level === 1)) {
                groupNodes.push(n);
              }
            });
            if (groupNodes.length) {
              // redrawRows acepta array de RowNode
              params.api.redrawRows(groupNodes);
            } else {
              // fallback: refrescar toda la vista de celdas
              params.api.refreshCells({ force: true });
            }
          });
        });

        const wrapper = document.createElement('div');
        wrapper.style.display = 'flex';
        wrapper.style.justifyContent = 'center';
        wrapper.style.alignItems = 'center';
        wrapper.style.height = '100%';
        wrapper.appendChild(checkbox);
        return wrapper;
      }
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

  async saveChanges() {
    if (!this.hasUnsavedChanges) {
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

      alerts.basicAlert('Éxito', 'Cambios guardados correctamente.', 'success');
      this.hasUnsavedChanges = false;
      await this.loadCatalogData();

      // Notificar al componente padre para actualizar "Donde usa"
      if (this.params?.context?.componentParent?.updateSubfamilyCount) {
        this.params.context.componentParent.updateSubfamilyCount(this.materialId);
      }
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
      // Reajustar columnas después de revertir
      setTimeout(() => this.gridApi?.sizeColumnsToFit(), 50);
    }

    alerts.basicAlert('Éxito', 'Cambios revertidos correctamente.', 'success');
  }

  // Cargar el estado "Se usa aquí" para todas las filas
  private async loadSeUsaAquiStatus() {


    if (this.treeData.length === 0) {
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

    // IMPORTANTE: Guardar copia para revertir cambios DESPUÉS de cargar todo
    this.originalTreeData = JSON.parse(JSON.stringify(this.treeData));

    // Refrescar el grid para mostrar los checkboxes actualizados
    if (this.gridApi) {
      this.gridApi.setGridOption('rowData', this.flattenTreeData());
      // Expandir automáticamente los grupos que tienen items marcados
      this.expandGroupsWithMarkedItems();
    }
  }

  // Reordenar para que items marcados aparezcan primero
  private reorderMarkedItemsFirst() {

    // Separar productos marcados y no marcados
    const markedProducts = this.treeData.filter(item => item.seUsaAqui === true);
    const unmarkedProducts = this.treeData.filter(item => item.seUsaAqui !== true);


    // Reordenar: marcados primero, luego no marcados
    this.treeData = [...markedProducts, ...unmarkedProducts];

  }

  // Expandir automáticamente grupos que contienen items marcados
  private expandGroupsWithMarkedItems() {
    if (!this.gridApi) return;


    // Obtener combinaciones únicas de category + flavor que tienen items marcados
    const groupsToExpand = new Set<string>();

    this.treeData.forEach(product => {
      if (product.seUsaAqui === true) {
        // Agregar la categoría
        groupsToExpand.add(product.category);
        // Agregar la combinación categoría + sabor
        groupsToExpand.add(`${product.category}|${product.flavor}`);
      }
    });


    // Usar setTimeout para asegurar que el grid ya procesó los datos
    setTimeout(() => {
      this.gridApi.forEachNode((node) => {
        if (node.group) {
          // Para grupos de nivel 1 (categoría)
          if (node.level === 0 && groupsToExpand.has(node.key)) {
            node.setExpanded(true);
          }
          // Para grupos de nivel 2 (sabor)
          else if (node.level === 1) {
            // Obtener la categoría padre
            const parentKey = node.parent?.key || '';
            const groupKey = `${parentKey}|${node.key}`;
            if (groupsToExpand.has(groupKey)) {
              node.setExpanded(true);
            }
          }
        }
      });
    }, 100);
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


    // NO refrescar el grid aquí para evitar perder el estado editable
    // El reordenamiento y expansión se harán solo al guardar o al cargar inicial
  }

  // Catalog/expansion helper methods removed - not used in flat structure
}
