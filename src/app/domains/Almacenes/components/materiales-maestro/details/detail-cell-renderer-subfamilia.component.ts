import { Component, inject, OnDestroy } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams, ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { AgGridModule } from 'ag-grid-angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { alerts } from 'app/helpers/alerts';
import { CatalogsService } from 'app/services/catalogs.service';
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
          class="btn btn-sm btn-success me-2"
          (click)="addCatalogItem()"
          [disabled]="!gridApi">
          <i class="bi bi-plus-lg"></i> Agregar
        </button>
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
        <button
          class="btn btn-sm btn-danger"
          (click)="deleteSelectedItem()"
          [disabled]="!selectedRowData">
          <i class="bi bi-trash"></i> Borrar
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

  private catalogsService = inject(CatalogsService);
  private modalService = inject(SubfamiliaModalService);
  private modalSubscription?: Subscription;

  params: any;
  materialId: number;
  materialName: string;
  idRoot: number;
  idFamilia: number; // La subfamilia base viene del idFamilia del material

  gridApi!: GridApi;
  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  // Datos del catálogo jerárquico
  treeData: any[] = [];
  originalTreeData: any[] = []; // Para revertir cambios
  selectedRowData: any = null;
  selectedNodeLevel: 'subfamilia' | 'flavor' | 'presentation' | null = null;
  hasUnsavedChanges: boolean = false;

  // Estado de expansión para persistir
  private expansionState: Map<string, { subfamilia: boolean, flavors: Map<string, boolean> }> = new Map();

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

  // Cargar datos del catálogo (3 niveles: Subfamilia → Flavor → Presentation)
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
      // Guardar estado de expansión antes de recargar
      this.saveExpansionState();

      console.log('📡 Cargando datos de Producto Terminado...');
      console.log('   - CATEGORY-PROD (Categorías)');
      console.log('   - NAME-PROD (Nombres)');
      console.log('   - PRESENT-PROD (Presentaciones)');

      // Cargar los 3 tipos de datos en paralelo (igual que producto-terminado)
      const [subfamilias, flavors, presentations] = await Promise.all([
        lastValueFrom(this.catalogsService.getCatalogs(this.idRoot, 'CATEGORY-PROD')),
        lastValueFrom(this.catalogsService.getCatalogs(this.idRoot, 'NAME-PROD')),
        lastValueFrom(this.catalogsService.getCatalogs(this.idRoot, 'PRESENT-PROD'))
      ]);

      console.log('✅ Datos recibidos de la BD:', {
        subfamilias: subfamilias.length,
        flavors: flavors.length,
        presentations: presentations.length
      });

      // Construir estructura jerárquica
      this.buildTreeStructure(subfamilias, flavors, presentations);

      console.log('🌲 TreeData construido:', this.treeData);

      // Restaurar estado de expansión
      this.restoreExpansionState();

    } catch (error) {
      console.error('❌ Error al cargar datos del catálogo:', error);
      this.treeData = [];
      alerts.basicAlert('Error', 'Error al cargar los datos.', 'error');
    }
  }

  // Construir estructura plana para 3 columnas con control de expansión
  private buildTreeStructure(categories: any[], names: any[], presentations: any[]) {
    this.treeData = [];

    console.log('🏗️ Construyendo estructura de Productos Terminados:', {
      'Total categorías (CATEGORY-PROD)': categories.length,
      'Total nombres/sabores (NAME-PROD)': names.length,
      'Total presentaciones (PRESENT-PROD)': presentations.length
    });

    // 🔍 DEBUG: Ver estructura de los datos
    console.log('🔍 ESTRUCTURA DE DATOS:');
    if (categories.length > 0) {
      console.log('  📋 Ejemplo de categoría:', categories[0]);
    }
    if (names.length > 0) {
      console.log('  📋 Ejemplo de nombre:', names[0]);
      console.log('  📋 Todos los nombres:', names);
    }
    if (presentations.length > 0) {
      console.log('  📋 Ejemplo de presentación:', presentations[0]);
      console.log('  📋 Todas las presentaciones:', presentations);
    }

    // NIVEL 1: Agregar TODAS las categorías de producto terminado
    // Las categorías tienen: parentId = 0 o null
    categories.forEach(category => {
      const categoryNode = {
        ...category,
        nodeLevel: 'subfamilia', // Mantener nombre por compatibilidad con template
        originalId: category.id,
        isExpanded: false,
        isVisible: true
      };
      this.treeData.push(categoryNode);

      // NIVEL 2: Buscar presentaciones/marcas de esta categoría
      // Las presentaciones tienen: parentId = categoryId, subParentId = 0
      const categoryPresentations = presentations.filter(presentation =>
        presentation.parentId === category.id && (presentation.subParentId === 0 || !presentation.subParentId)
      );

      console.log(`  📦 Categoría "${category.description}" (ID=${category.id}) tiene ${categoryPresentations.length} presentaciones/marcas`);

      categoryPresentations.forEach(presentation => {
        const presentationNode = {
          ...presentation,
          nodeLevel: 'flavor', // Mantener nombre por compatibilidad con template (nivel 2)
          originalId: presentation.id,
          parentSubfamiliaId: category.id, // ID de la categoría padre
          isExpanded: false,
          isVisible: false // Ocultas por defecto
        };
        this.treeData.push(presentationNode);

        // NIVEL 3: Buscar nombres/tamaños de esta presentación
        // Los nombres tienen: parentId = categoryId, subParentId = presentationId
        const presentationNames = names.filter(name =>
          name.parentId === category.id && name.subParentId === presentation.id
        );

        console.log(`    🎁 Presentación "${presentation.description}" tiene ${presentationNames.length} tamaños`);

        presentationNames.forEach(name => {
          const nameNode = {
            ...name,
            nodeLevel: 'presentation', // Nivel 3
            originalId: name.id,
            parentSubfamiliaId: category.id, // ID de la categoría raíz
            parentFlavorId: presentation.id, // ID de la presentación padre
            isVisible: false // Ocultas por defecto
          };
          this.treeData.push(nameNode);
        });
      });
    });

    console.log(`✅ Estructura construida con ${this.treeData.length} nodos en total`);
    console.log(`   - Categorías visibles: ${this.treeData.filter(n => n.nodeLevel === 'subfamilia').length}`);
    console.log(`   - Nombres cargados: ${this.treeData.filter(n => n.nodeLevel === 'flavor').length}`);
    console.log(`   - Presentaciones cargadas: ${this.treeData.filter(n => n.nodeLevel === 'presentation').length}`);

    // Guardar copia para revertir cambios
    this.originalTreeData = JSON.parse(JSON.stringify(this.treeData));
    this.hasUnsavedChanges = false;
  }

  // Configuración del grid
  get gridOptions(): any {
    return {
      headerHeight: 30,
      rowHeight: 30,
      animateRows: true,
      treeData: false,
      suppressClickEdit: true,
      singleClickEdit: false,
      stopEditingWhenCellsLoseFocus: true,
      localeText: this.AG_GRID_LOCALE_ES,
      onRowSelected: (event: any) => {
        if (event.node.isSelected()) {
          this.onRowSelected(event);
        }
      }
      // onCellDoubleClicked está en cada columna individualmente
    };
  }

  // Definición de 3 columnas separadas con chevrons funcionales
  get columnDefs(): ColDef[] {
    return [
      {
        headerName: 'Categoria/Producto',
        field: 'subfamiliaDisplay',
        width: 200,
        cellRenderer: (params: any) => {
          if (params.data.nodeLevel === 'subfamilia') {
            const isExpanded = params.data.isExpanded || false;
            const chevron = isExpanded ? '▼' : '▶';
            const description = params.data.description;
            const displayText = `${description} (${this.getFlavorCountForSubfamilia(params.data.originalId)})`;

            return `<span class="chevron-icon" data-action="toggle" style="cursor: pointer; margin-right: 5px;">${chevron}</span> ${displayText}`;
          }
          return '';
        },
        onCellClicked: (event: any) => {
          // Solo expandir si el click es en el chevron
          if (event.event.target.classList.contains('chevron-icon') ||
              event.event.target.getAttribute('data-action') === 'toggle') {
            this.toggleSubfamiliaExpansion(event.data);
            event.event.stopPropagation(); // Evitar que dispare otros eventos
          }
        },
        onCellDoubleClicked: (event: any) => {
          // Doble click para editar (solo si NO es en el chevron)
          if (!event.event.target.classList.contains('chevron-icon') &&
              event.event.target.getAttribute('data-action') !== 'toggle') {
            this.openEditModal(event.data);
          }
        }
      },
      {
        headerName: 'Sabor',
        field: 'flavorDisplay',
        width: 200,
        cellRenderer: (params: any) => {
          if (params.data.nodeLevel === 'flavor') {
            const childCount = this.getPresentationCountForFlavor(params.data.originalId);
            const isExpanded = params.data.isExpanded || false;
            const chevron = isExpanded ? '▼' : '▶';
            return `<span class="chevron-icon" data-action="toggle" style="cursor: pointer; margin-right: 5px;">${chevron}</span> ${params.data.description} (${childCount})`;
          }
          return '';
        },
        onCellClicked: (event: any) => {
          // Solo expandir si el click es en el chevron
          if (event.event.target.classList.contains('chevron-icon') ||
              event.event.target.getAttribute('data-action') === 'toggle') {
            this.toggleFlavorExpansion(event.data);
            event.event.stopPropagation(); // Evitar que dispare otros eventos
          }
        },
        onCellDoubleClicked: (event: any) => {
          // Doble click para editar (solo si NO es en el chevron)
          if (!event.event.target.classList.contains('chevron-icon') &&
              event.event.target.getAttribute('data-action') !== 'toggle') {
            this.openEditModal(event.data);
          }
        }
      },
      {
        headerName: 'Presentacion',
        field: 'presentationDisplay',
        width: 200,
        cellRenderer: (params: any) => {
          if (params.data.nodeLevel === 'presentation') {
            return `<span style="margin-right: 15px;"></span> ${params.data.description}`;
          }
          return '';
        },
        onCellDoubleClicked: (event: any) => {
          // Doble click para editar presentations
          if (event.data && event.data.nodeLevel === 'presentation') {
            this.openEditModal(event.data);
          }
        }
      },
      {
        headerName: 'Se usa aquí',
        field: 'active',
        width: 80,
        cellRenderer: 'agCheckboxCellRenderer',
      }
    ];
  }

  // Retornar datos filtrados por visibilidad para AG-Grid
  flattenTreeData(): any[] {
    return this.treeData.filter(item => item.isVisible);
  }

  // Métodos para manejar expand/collapse
  toggleSubfamiliaExpansion(subfamiliaData: any) {
    const subfamilia = this.treeData.find(item =>
      item.nodeLevel === 'subfamilia' && item.originalId === subfamiliaData.originalId
    );

    if (subfamilia) {
      subfamilia.isExpanded = !subfamilia.isExpanded;

      // Mostrar/ocultar flavors de esta subfamilia
      this.treeData.forEach(item => {
        if (item.nodeLevel === 'flavor' && item.parentSubfamiliaId === subfamilia.originalId) {
          item.isVisible = subfamilia.isExpanded;

          // Si ocultamos el flavor, también ocultar sus presentations
          if (!subfamilia.isExpanded) {
            this.treeData.forEach(subItem => {
              if (subItem.nodeLevel === 'presentation' && subItem.parentFlavorId === item.originalId) {
                subItem.isVisible = false;
              }
            });
          } else {
            // Si mostramos el flavor, mostrar presentations solo si el flavor está expandido
            if (item.isExpanded) {
              this.treeData.forEach(subItem => {
                if (subItem.nodeLevel === 'presentation' && subItem.parentFlavorId === item.originalId) {
                  subItem.isVisible = true;
                }
              });
            }
          }
        }
      });

      // Refrescar el grid
      if (this.gridApi) {
        this.gridApi.setGridOption('rowData', this.flattenTreeData());
        // Reajustar columnas después de cambiar datos
        setTimeout(() => this.gridApi?.sizeColumnsToFit(), 50);
      }
    }
  }

  toggleFlavorExpansion(flavorData: any) {
    const flavor = this.treeData.find(item =>
      item.nodeLevel === 'flavor' && item.originalId === flavorData.originalId
    );

    if (flavor) {
      flavor.isExpanded = !flavor.isExpanded;

      // Mostrar/ocultar presentations de este flavor
      this.treeData.forEach(item => {
        if (item.nodeLevel === 'presentation' && item.parentFlavorId === flavor.originalId) {
          item.isVisible = flavor.isExpanded;
        }
      });

      // Refrescar el grid
      if (this.gridApi) {
        this.gridApi.setGridOption('rowData', this.flattenTreeData());
        // Reajustar columnas después de cambiar datos
        setTimeout(() => this.gridApi?.sizeColumnsToFit(), 50);
      }
    }
  }

  // Selección de filas
  onRowSelected(event: any) {
    this.selectedRowData = event.data;
    if (event.data) {
      this.selectedNodeLevel = event.data.nodeLevel || 'subfamilia';
    } else {
      this.selectedNodeLevel = null;
    }
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

  // Agregar nuevo elemento según nivel seleccionado
  addCatalogItem() {
    if (!this.selectedRowData) {
      this.openAddSubfamiliaModal(); // Si no hay selección, agregar subfamilia
      return;
    }

    switch (this.selectedNodeLevel) {
      case 'subfamilia':
        this.openAddFlavorModal();
        break;
      case 'flavor':
        this.openAddPresentationModal();
        break;
      case 'presentation':
        alerts.basicAlert('Nivel máximo', 'No se pueden agregar elementos debajo de una presentación.', 'warning');
        break;
      default:
        this.openAddSubfamiliaModal();
    }
  }

  // Eliminar elemento seleccionado
  async deleteSelectedItem() {
    if (!this.selectedRowData) {
      alerts.basicAlert('Eliminar', 'Por favor, seleccione un elemento para eliminar.', 'error');
      return;
    }

    if (!this.selectedRowData.originalId) {
      alerts.basicAlert('Error', 'No se puede identificar el registro a eliminar.', 'error');
      return;
    }

    const result = await alerts.confirmAlert(
      'Confirmar eliminación',
      `¿Está seguro de que desea eliminar "${this.selectedRowData.description}"?`,
      'warning',
      'Sí, eliminar'
    );

    if (!result.isConfirmed) return;

    try {
      await lastValueFrom(this.catalogsService.deleteCatalog(this.selectedRowData.originalId));
      alerts.basicAlert('Eliminado', 'Elemento eliminado satisfactoriamente.', 'success');
      this.loadCatalogData();
      this.selectedRowData = null;
      this.selectedNodeLevel = null;
    } catch (error: any) {
      console.error('Error al eliminar:', error);
      const errorMsg = error?.error?.message || error?.message || 'Error desconocido';
      alerts.basicAlert('Error', `Error al eliminar el elemento: ${errorMsg}`, 'error');
    }
  }

  // ========== MÉTODOS HELPER PARA CONTADORES ==========

  private getFlavorCountForSubfamilia(subfamiliaId: string | number): number {
    if (!this.treeData || !subfamiliaId) return 0;
    return this.treeData.filter(item =>
      item.nodeLevel === 'flavor' && item.parentSubfamiliaId === subfamiliaId
    ).length;
  }

  private getPresentationCountForFlavor(flavorId: string | number): number {
    if (!this.treeData || !flavorId) return 0;
    return this.treeData.filter(item =>
      item.nodeLevel === 'presentation' && item.parentFlavorId === flavorId
    ).length;
  }

  // ========== MÉTODOS PARA MODALES ==========

  handleModalSave(data: any) {
    console.log('💾 handleModalSave - Procesando datos:', data);

    if (!data || !data.type) {
      console.error('❌ Datos inválidos recibidos del modal');
      return;
    }

    switch (data.type) {
      case 'subfamilia':
        this.handleSaveSubfamilia(data);
        break;
      case 'flavor':
        this.handleSaveFlavor(data);
        break;
      case 'presentation':
        this.handleSavePresentation(data);
        break;
      default:
        console.error('❌ Tipo de modal desconocido:', data.type);
    }
  }

  private async handleSaveSubfamilia(data: any) {
    if (data.mode === 'add') {
      // Preparar datos para guardar en BD
      const newSubfamilia = this.cleanDataForServer({
        description: data.description,
        type: 'SUB-FAM',
        parentId: this.idFamilia, // La familia del material
        subParentId: 0,
        active: data.active ? 1 : 0
      });

      try {
        const response = await lastValueFrom(this.catalogsService.addCatalog(newSubfamilia));
        console.log('✅ Subfamilia guardada en BD:', response);
        alerts.basicAlert('Éxito', 'Subfamilia creada correctamente.', 'success');

        // Recargar datos del servidor
        await this.loadCatalogData();
      } catch (error: any) {
        console.error('❌ Error al crear subfamilia:', error);
        const errorMsg = error?.error?.message || error?.message || 'Error desconocido';
        alerts.basicAlert('Error', `Error al crear la subfamilia: ${errorMsg}`, 'error');
      }
    } else if (data.mode === 'edit' && data.data) {
      // Editar subfamilia existente
      const item = this.treeData.find(i => i.originalId === data.data.originalId);
      if (item) {
        item.description = data.description;
        item.active = data.active ? 1 : 0;
        item.__modified = true;
        this.hasUnsavedChanges = true;

        if (this.gridApi) {
          this.gridApi.setGridOption('rowData', this.flattenTreeData());
        }

        alerts.basicAlert('Éxito', 'Subfamilia actualizada. Haz clic en Guardar para aplicar los cambios.', 'success');
      }
    }
  }

  private async handleSaveFlavor(data: any) {
    if (data.mode === 'add' && data.parentData?.subfamiliaId) {
      // Preparar datos para guardar en BD
      const newFlavor = this.cleanDataForServer({
        description: data.description,
        type: 'FLAVOR',
        parentId: data.parentData.subfamiliaId, // ID de la subfamilia padre
        subParentId: 0,
        active: data.active ? 1 : 0
      });

      try {
        const response = await lastValueFrom(this.catalogsService.addCatalog(newFlavor));
        console.log('✅ Flavor guardado en BD:', response);
        alerts.basicAlert('Éxito', 'Sabor creado correctamente.', 'success');

        // Guardar el ID de la subfamilia que debe expandirse
        const subfamiliaToExpand = data.parentData.subfamiliaId;

        // Recargar datos del servidor
        await this.loadCatalogData();

        // Expandir automáticamente la subfamilia padre después de recargar
        const parentSubfamilia = this.treeData.find(
          item => item.nodeLevel === 'subfamilia' && item.originalId === subfamiliaToExpand
        );
        if (parentSubfamilia && !parentSubfamilia.isExpanded) {
          this.toggleSubfamiliaExpansion(parentSubfamilia);
        }
      } catch (error: any) {
        console.error('❌ Error al crear flavor:', error);
        const errorMsg = error?.error?.message || error?.message || 'Error desconocido';
        alerts.basicAlert('Error', `Error al crear el sabor: ${errorMsg}`, 'error');
      }
    } else if (data.mode === 'edit' && data.data) {
      // Editar flavor existente
      const item = this.treeData.find(i => i.originalId === data.data.originalId);
      if (item) {
        item.description = data.description;
        item.active = data.active ? 1 : 0;
        item.__modified = true;
        this.hasUnsavedChanges = true;

        if (this.gridApi) {
          this.gridApi.setGridOption('rowData', this.flattenTreeData());
        }

        alerts.basicAlert('Éxito', 'Sabor actualizado. Haz clic en Guardar para aplicar los cambios.', 'success');
      }
    }
  }

  private async handleSavePresentation(data: any) {
    if (data.mode === 'add' && data.parentData?.flavorId) {
      // Preparar datos para guardar en BD
      const newPresentation = this.cleanDataForServer({
        description: data.description,
        type: 'PRESENTATI',
        parentId: data.parentData.subfamiliaId, // ID de la subfamilia raíz
        subParentId: data.parentData.flavorId, // ID del flavor padre
        active: data.active ? 1 : 0
      });

      try {
        const response = await lastValueFrom(this.catalogsService.addCatalog(newPresentation));
        console.log('✅ Presentation guardada en BD:', response);
        alerts.basicAlert('Éxito', 'Presentación creada correctamente.', 'success');

        // Guardar los IDs que deben expandirse
        const subfamiliaToExpand = data.parentData.subfamiliaId;
        const flavorToExpand = data.parentData.flavorId;

        // Recargar datos del servidor
        await this.loadCatalogData();

        // Expandir automáticamente la subfamilia padre
        const parentSubfamilia = this.treeData.find(
          item => item.nodeLevel === 'subfamilia' && item.originalId === subfamiliaToExpand
        );
        if (parentSubfamilia && !parentSubfamilia.isExpanded) {
          this.toggleSubfamiliaExpansion(parentSubfamilia);
        }

        // Expandir automáticamente el flavor padre
        const parentFlavor = this.treeData.find(
          item => item.nodeLevel === 'flavor' && item.originalId === flavorToExpand
        );
        if (parentFlavor && !parentFlavor.isExpanded) {
          this.toggleFlavorExpansion(parentFlavor);
        }
      } catch (error: any) {
        console.error('❌ Error al crear presentation:', error);
        const errorMsg = error?.error?.message || error?.message || 'Error desconocido';
        alerts.basicAlert('Error', `Error al crear la presentación: ${errorMsg}`, 'error');
      }
    } else if (data.mode === 'edit' && data.data) {
      // Editar presentation existente
      const item = this.treeData.find(i => i.originalId === data.data.originalId);
      if (item) {
        item.description = data.description;
        item.active = data.active ? 1 : 0;
        item.__modified = true;
        this.hasUnsavedChanges = true;

        if (this.gridApi) {
          this.gridApi.setGridOption('rowData', this.flattenTreeData());
        }

        alerts.basicAlert('Éxito', 'Presentación actualizada. Haz clic en Guardar para aplicar los cambios.', 'success');
      }
    }
  }

  openAddSubfamiliaModal() {
    console.log('🔵 Abriendo modal Subfamilia');
    this.modalService.openModal({
      type: 'subfamilia',
      mode: 'add',
      parentData: {
        idRoot: this.idRoot,
        idFamilia: this.idFamilia,
        materialId: this.materialId,
        materialName: this.materialName
      }
    });
  }

  openAddFlavorModal() {
    if (!this.selectedRowData || this.selectedNodeLevel !== 'subfamilia') {
      alerts.basicAlert('Error', 'Seleccione una subfamilia para agregar un sabor.', 'warning');
      return;
    }
    console.log('🔵 Abriendo modal Flavor para subfamilia:', this.selectedRowData);
    this.modalService.openModal({
      type: 'flavor',
      mode: 'add',
      parentData: {
        subfamiliaId: this.selectedRowData.originalId,
        subfamiliaName: this.selectedRowData.description
      }
    });
  }

  openAddPresentationModal() {
    if (!this.selectedRowData || this.selectedNodeLevel !== 'flavor') {
      alerts.basicAlert('Error', 'Seleccione un flavor para agregar una presentación.', 'warning');
      return;
    }
    console.log('🔵 Abriendo modal Presentation para flavor:', this.selectedRowData);
    this.modalService.openModal({
      type: 'presentation',
      mode: 'add',
      parentData: {
        flavorId: this.selectedRowData.originalId,
        flavorName: this.selectedRowData.description,
        subfamiliaId: this.selectedRowData.parentSubfamiliaId
      }
    });
  }

  openEditModal(item: any) {
    console.log('🔵 Abriendo modal Editar para:', item);
    this.modalService.openModal({
      type: item.nodeLevel,
      mode: 'edit',
      data: item
    });
  }

  async saveChanges() {
    if (!this.hasUnsavedChanges) {
      alerts.basicAlert('Info', 'No hay cambios sin guardar.', 'info');
      return;
    }

    try {
      const itemsToSave = this.treeData.filter(item => item.__isNew || item.__modified);

      console.log(`💾 Guardando ${itemsToSave.length} cambios...`);

      for (const item of itemsToSave) {
        if (item.__isNew) {
          // Guardar nuevo item
          const dataToSave = this.cleanDataForServer({
            description: item.description,
            type: item.nodeLevel === 'subfamilia' ? 'SUB-FAM' :
                  item.nodeLevel === 'flavor' ? 'FLAVOR' : 'PRESENTATI',
            parentId: item.parentSubfamiliaId || this.idFamilia,
            subParentId: item.parentFlavorId || 0,
            active: item.active
          });
          await lastValueFrom(this.catalogsService.addCatalog(dataToSave));
        } else if (item.__modified) {
          // Actualizar item existente
          const dataToSave = this.cleanDataForServer({
            description: item.description,
            valueAddition: item.valueAddition,
            valueAddition2: item.valueAddition2,
            valueAdditionBit: item.valueAdditionBit,
            valueAdditionBit2: item.valueAdditionBit2,
            vigente: item.vigente,
            type: item.type,
            parentId: item.parentId,
            subParentId: item.subParentId,
            price: item.price,
            active: item.active
          });
          await lastValueFrom(this.catalogsService.updateCatalog(item.originalId, dataToSave));
        }
      }

      alerts.basicAlert('Éxito', 'Cambios guardados correctamente.', 'success');
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

  private cleanDataForServer(data: any): any {
    const cleanData = {
      idCompany: Number(this.idRoot),
      description: String(data.description || '').trim(),
      valueAddition: String(data.valueAddition || 'NA'),
      valueAddition2: String(data.valueAddition2 || 'NA'),
      valueAdditionBit: Boolean(data.valueAdditionBit || false),
      valueAdditionBit2: Boolean(data.valueAdditionBit2 || false),
      vigente: Boolean(data.vigente !== false),
      type: String(data.type),
      parentId: Number(data.parentId || 0),
      subParentId: Number(data.subParentId || 0),
      price: Number(data.price || 0),
      active: Number(data.active || 1)
    };

    return cleanData;
  }

  // Guardar estado de expansión actual
  private saveExpansionState() {
    this.expansionState.clear();

    this.treeData.forEach(item => {
      if (item.nodeLevel === 'subfamilia') {
        const flavorsMap = new Map<string, boolean>();

        this.treeData.forEach(flavor => {
          if (flavor.nodeLevel === 'flavor' && flavor.parentSubfamiliaId === item.originalId) {
            flavorsMap.set(String(flavor.originalId), flavor.isExpanded || false);
          }
        });

        this.expansionState.set(String(item.originalId), {
          subfamilia: item.isExpanded || false,
          flavors: flavorsMap
        });
      }
    });
  }

  // Restaurar estado de expansión después de reconstruir
  private restoreExpansionState() {
    if (this.expansionState.size === 0) return;

    this.treeData.forEach(item => {
      if (item.nodeLevel === 'subfamilia') {
        const state = this.expansionState.get(String(item.originalId));
        if (state) {
          item.isExpanded = state.subfamilia;

          this.treeData.forEach(flavor => {
            if (flavor.nodeLevel === 'flavor' && flavor.parentSubfamiliaId === item.originalId) {
              flavor.isVisible = state.subfamilia;

              const flavorExpanded = state.flavors.get(String(flavor.originalId));
              if (flavorExpanded !== undefined) {
                flavor.isExpanded = flavorExpanded;

                if (flavor.isVisible) {
                  this.treeData.forEach(presentation => {
                    if (presentation.nodeLevel === 'presentation' && presentation.parentFlavorId === flavor.originalId) {
                      presentation.isVisible = flavorExpanded;
                    }
                  });
                }
              }
            }
          });
        }
      }
    });

    if (this.gridApi) {
      this.gridApi.setGridOption('rowData', this.flattenTreeData());
      // Reajustar columnas después de restaurar expansión
      setTimeout(() => this.gridApi?.sizeColumnsToFit(), 50);
    }
  }
}
