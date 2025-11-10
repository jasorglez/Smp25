import { Component, inject, OnDestroy } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams, ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { AgGridModule } from 'ag-grid-angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { alerts } from 'app/helpers/alerts';
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
      (gridReady)="onGridReady($event)">
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
  private modalSubscription?: Subscription;

  params: any;
  materialId: number;
  materialName: string;
  idRoot: number;
  idFamilia: number;

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
      console.log('💾 DetailCellRenderer - Recibido evento de guardado:', data);
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
    console.log('🔍 loadCatalogData - Parámetros:', {
      idRoot: this.idRoot,
      idFamilia: this.idFamilia,
      materialId: this.materialId,
      materialName: this.materialName
    });

    if (!this.idRoot || !this.idFamilia) {
      console.warn('❌ idRoot o idFamilia es null, no se pueden cargar datos');
      return;
    }

    try {
      console.log('📡 Cargando productos finales desde getFinalProduct...');

      // Cargar productos finales desde el endpoint
      const finalProducts = await lastValueFrom(
        this.materialsService.getFinalProduct(this.idRoot)
      );

      console.log('✅ Productos finales recibidos:', finalProducts.length);
      if (finalProducts.length > 0) {
        console.log('🔍 Ejemplo de producto:', finalProducts[0]);
      }

      // Asignar directamente como filas planas
      this.treeData = finalProducts.map(product => ({
        ...product,
        originalId: product.id,
        seUsaAqui: false,
        isLoadingSeUsa: true
      }));

      console.log('📋 TreeData asignado (filas planas):', this.treeData.length);

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
        headerName: 'Grupos',
        minWidth: 200,
        cellRendererParams: {
          suppressCount: false
        }
      }
    };
  }

  // Definición de columnas con grupos separados y filtros independientes
  get columnDefs(): ColDef[] {
    return [
      {
        // Columna de categoría - agrupación principal
        headerName: 'Categoría',
        field: 'category',
        rowGroup: true,
        hide: false, // Mostrar como columna
        filter: 'agSetColumnFilter',
        filterParams: {
          buttons: ['reset', 'apply'],
          closeOnApply: true,
          caseSensitive: false
        },
        width: 150,
        resizable: true,
        cellClass: 'group-cell'
      },
      {
        // Columna de sabor - agrupación secundaria
        headerName: 'Sabor',
        field: 'flavor',
        rowGroup: true,
        hide: false, // Mostrar como columna
        filter: 'agSetColumnFilter',
        filterParams: {
          buttons: ['reset', 'apply'],
          closeOnApply: true,
          caseSensitive: false
        },
        width: 150,
        resizable: true,
        cellClass: 'group-cell'
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
        editable: true,
        cellRenderer: 'agCheckboxCellRenderer',
        cellEditor: 'agCheckboxCellEditor',
        onCellValueChanged: (params: any) => {
          // Solo procesar cambios de filas de datos
          if (params.node && params.node.group) {
            return;
          }
          this.onSeUsaAquiChanged(params);
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

    // Autoajustar columnas al contenido o al header (lo que sea más largo)
    setTimeout(() => {
      if (this.gridApi) {
        this.gridApi.sizeColumnsToFit();
      }
    }, 100);
  }

  // Métodos de catálogo no usados en estructura plana (removidos)

  // ========== MÉTODOS PARA MODALES (no usados en estructura plana) ==========

  handleModalSave(data: any) {
    // Método mantenido por compatibilidad con modal service pero no usado
    console.log('💾 handleModalSave - No implementado para estructura plana:', data);
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

      console.log(`💾 Guardando cambios...`);
      console.log(`   - Productos con cambios: ${productsToSave.length}`);

      // Guardar cambios de "Se usa aquí" (MaterialxFinalProduct)
      for (const product of productsToSave) {
        const originalValue = product.__originalSeUsaAqui ?? false;
        const currentValue = product.seUsaAqui;

        console.log(`   Procesando "${product.presentation}": ${originalValue} → ${currentValue}`);

        if (currentValue === true && originalValue === false) {
          // Agregar relación
          console.log(`   ➕ Agregando material a producto ${product.originalId}`);
          await lastValueFrom(
            this.materialsService.addMaterialToFinalProduct(
              this.materialId,
              product.originalId,
              {}
            )
          );
        } else if (currentValue === false && originalValue === true) {
          // Eliminar relación
          console.log(`   ➖ Eliminando material de producto ${product.originalId}`);
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
    console.log('🔍 Cargando estado "Se usa aquí" para todos los productos...');

    console.log(`📊 Total de productos a verificar: ${this.treeData.length}`);

    if (this.treeData.length === 0) {
      console.log('⚠️ No hay productos para verificar');
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
        console.log(`✅ Producto "${product.presentation}" (ID=${product.originalId}): ${exists ? 'SÍ se usa' : 'NO se usa'}`);
      } catch (error) {
        console.error(`❌ Error al verificar producto "${product.presentation}":`, error);
        product.seUsaAqui = false;
        product.isLoadingSeUsa = false;
      }
    });

    // Esperar a que todas las consultas terminen
    await Promise.all(promises);

    console.log('✅ Estado "Se usa aquí" cargado para todos los productos');

    // Reordenar: items marcados primero
    this.reorderMarkedItemsFirst();

    // IMPORTANTE: Guardar copia para revertir cambios DESPUÉS de cargar todo
    this.originalTreeData = JSON.parse(JSON.stringify(this.treeData));
    console.log('📋 Copia de seguridad creada para Deshacer');

    // Refrescar el grid para mostrar los checkboxes actualizados
    if (this.gridApi) {
      this.gridApi.setGridOption('rowData', this.flattenTreeData());
      // Expandir automáticamente los grupos que tienen items marcados
      this.expandGroupsWithMarkedItems();
    }
  }

  // Reordenar para que items marcados aparezcan primero
  private reorderMarkedItemsFirst() {
    console.log('🔄 Reordenando productos: marcados primero...');

    // Separar productos marcados y no marcados
    const markedProducts = this.treeData.filter(item => item.seUsaAqui === true);
    const unmarkedProducts = this.treeData.filter(item => item.seUsaAqui !== true);

    console.log(`📌 Productos marcados: ${markedProducts.length}`);
    console.log(`📋 Productos no marcados: ${unmarkedProducts.length}`);

    // Reordenar: marcados primero, luego no marcados
    this.treeData = [...markedProducts, ...unmarkedProducts];

    console.log('✅ Reordenamiento completado');
  }

  // Expandir automáticamente grupos que contienen items marcados
  private expandGroupsWithMarkedItems() {
    if (!this.gridApi) return;

    console.log('📂 Expandiendo grupos con items marcados...');

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

    console.log(`🔓 Grupos a expandir: ${groupsToExpand.size}`);

    // Usar setTimeout para asegurar que el grid ya procesó los datos
    setTimeout(() => {
      this.gridApi.forEachNode((node) => {
        if (node.group) {
          // Para grupos de nivel 1 (categoría)
          if (node.level === 0 && groupsToExpand.has(node.key)) {
            node.setExpanded(true);
            console.log(`  ✅ Expandido: ${node.key} (Nivel 1 - Categoría)`);
          }
          // Para grupos de nivel 2 (sabor)
          else if (node.level === 1) {
            // Obtener la categoría padre
            const parentKey = node.parent?.key || '';
            const groupKey = `${parentKey}|${node.key}`;
            if (groupsToExpand.has(groupKey)) {
              node.setExpanded(true);
              console.log(`  ✅ Expandido: ${node.key} (Nivel 2 - Sabor)`);
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

    console.log(`🔄 Checkbox cambiado para "${product.presentation}":`, {
      oldValue,
      newValue,
      materialId: this.materialId,
      productId: product.originalId
    });

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

    console.log(`📝 Cambio marcado localmente (no guardado aún)`);

    // Reordenar y expandir después de marcar/desmarcar
    this.reorderMarkedItemsFirst();

    // Refrescar el grid
    if (this.gridApi) {
      this.gridApi.setGridOption('rowData', this.flattenTreeData());
      // Expandir grupos con items marcados
      this.expandGroupsWithMarkedItems();
    }
  }

  // Catalog/expansion helper methods removed - not used in flat structure
}
