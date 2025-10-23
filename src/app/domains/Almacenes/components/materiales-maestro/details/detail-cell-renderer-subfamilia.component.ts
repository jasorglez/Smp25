import { Component, inject } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams, ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { AgGridModule } from 'ag-grid-angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { alerts } from 'app/helpers/alerts';
import { CatalogsService } from 'app/services/catalogs.service';
import { lastValueFrom } from 'rxjs';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';

@Component({
  selector: 'app-detail-cell-renderer-subfamilia',
  standalone: true,
  imports: [AgGridModule, CommonModule, FormsModule],
  template: `
<div style="padding: 15px; background-color: #fff3e0; height: 100%; display: flex; flex-direction: column;">
  <!-- Header -->
  <div style="margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center;">
    <h6 class="mb-0">
      <i class="bi bi-cup-straw"></i> Variantes de: <strong>{{ materialName }}</strong>
    </h6>

    <!-- Botones de acción -->
    <div class="btn-group btn-group-sm" role="group">
      <button type="button" class="btn btn-success" (click)="addCatalogItem()" title="Agregar">
        <i class="bi bi-plus-lg"></i> Agregar
      </button>
      <button type="button" class="btn btn-danger" (click)="deleteSelectedItem()"
              [disabled]="!selectedRowData" title="Eliminar">
        <i class="bi bi-trash"></i> Eliminar
      </button>
    </div>
  </div>

  <!-- AG Grid -->
  <div style="flex-grow: 1;">
    <ag-grid-angular
      class="ag-theme-quartz"
      style="width: 100%; height: 100%;"
      [columnDefs]="columnDefs"
      [rowData]="flattenTreeData()"
      [gridOptions]="gridOptions"
      [rowSelection]="'single'"
      (gridReady)="onGridReady($event)">
    </ag-grid-angular>
  </div>
</div>

<!-- ========== MODAL PARA AGREGAR FLAVOR ========== -->
<div class="modal fade" [class.show]="showAddFlavorModal"
     [style.display]="showAddFlavorModal ? 'block' : 'none'"
     tabindex="-1" *ngIf="showAddFlavorModal">
  <div class="modal-dialog modal-dialog-centered">
    <div class="modal-content">
      <div class="modal-header bg-info text-white">
        <h5 class="modal-title"><i class="bi bi-plus-circle"></i> Nuevo Flavor</h5>
        <button type="button" class="btn-close btn-close-white" (click)="closeModals()"></button>
      </div>
      <div class="modal-body">
        <form (ngSubmit)="saveNewFlavor()">
          <div class="mb-3">
            <label for="flavorDescription" class="form-label">Descripción *</label>
            <input type="text" class="form-control" id="flavorDescription"
                   [(ngModel)]="modalForm.description" name="description" required>
          </div>
          <div class="form-check">
            <input class="form-check-input" type="checkbox" id="flavorActive"
                   [(ngModel)]="modalForm.active" name="active">
            <label class="form-check-label" for="flavorActive">Activo</label>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" (click)="closeModals()">Cancelar</button>
            <button type="submit" class="btn btn-info">
              <i class="bi bi-check-circle"></i> Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</div>

<!-- ========== MODAL PARA AGREGAR PRESENTATION ========== -->
<div class="modal fade" [class.show]="showAddPresentationModal"
     [style.display]="showAddPresentationModal ? 'block' : 'none'"
     tabindex="-1" *ngIf="showAddPresentationModal">
  <div class="modal-dialog modal-dialog-centered">
    <div class="modal-content">
      <div class="modal-header bg-secondary text-white">
        <h5 class="modal-title"><i class="bi bi-plus-circle"></i> Nueva Presentación</h5>
        <button type="button" class="btn-close btn-close-white" (click)="closeModals()"></button>
      </div>
      <div class="modal-body">
        <form (ngSubmit)="saveNewPresentation()">
          <div class="mb-3">
            <label for="presentationDescription" class="form-label">Descripción *</label>
            <input type="text" class="form-control" id="presentationDescription"
                   [(ngModel)]="modalForm.description" name="description" required>
          </div>
          <div class="form-check">
            <input class="form-check-input" type="checkbox" id="presentationActive"
                   [(ngModel)]="modalForm.active" name="active">
            <label class="form-check-label" for="presentationActive">Activo</label>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" (click)="closeModals()">Cancelar</button>
            <button type="submit" class="btn btn-secondary">
              <i class="bi bi-check-circle"></i> Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</div>

<!-- ========== MODAL PARA EDITAR ========== -->
<div class="modal fade" [class.show]="showEditModal"
     [style.display]="showEditModal ? 'block' : 'none'"
     tabindex="-1" *ngIf="showEditModal">
  <div class="modal-dialog modal-dialog-centered">
    <div class="modal-content">
      <div class="modal-header bg-warning text-dark">
        <h5 class="modal-title"><i class="bi bi-pencil-square"></i> Editar</h5>
        <button type="button" class="btn-close" (click)="closeModals()"></button>
      </div>
      <div class="modal-body">
        <form (ngSubmit)="saveEditChanges()">
          <div class="mb-3">
            <label for="editDescription" class="form-label">Descripción *</label>
            <input type="text" class="form-control" id="editDescription"
                   [(ngModel)]="modalForm.description" name="description" required>
          </div>
          <div class="form-check">
            <input class="form-check-input" type="checkbox" id="editActive"
                   [(ngModel)]="modalForm.active" name="active">
            <label class="form-check-label" for="editActive">Activo</label>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" (click)="closeModals()">Cancelar</button>
            <button type="submit" class="btn btn-warning">
              <i class="bi bi-check-circle"></i> Actualizar
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</div>

<!-- Backdrop para modales -->
<div class="modal-backdrop fade show"
     *ngIf="showAddFlavorModal || showAddPresentationModal || showEditModal">
</div>
`,
  styles: [`
.chevron-icon {
  cursor: pointer;
  margin-right: 5px;
}
`]
})
export class DetailCellRendererSubfamiliaComponent implements ICellRendererAngularComp {

  private catalogsService = inject(CatalogsService);

  params: any;
  materialId: number;
  materialName: string;
  idRoot: number;
  idFamilia: number; // La subfamilia base viene del idFamilia del material

  private gridApi!: GridApi;
  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  // Propiedades para modales (igual que cat-fam-sub)
  showAddSubfamiliaModal = false;
  showAddFlavorModal = false;
  showAddPresentationModal = false;
  showEditModal = false;

  // Datos del formulario modal
  modalForm = {
    description: '',
    active: true
  };

  // Datos para edición
  editingItem: any = null;

  // Datos del catálogo jerárquico
  treeData: any[] = [];
  selectedRowData: any = null;
  selectedNodeLevel: 'subfamilia' | 'flavor' | 'presentation' | null = null;

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

    // Cargar datos
    this.loadCatalogData();
  }

  refresh(): boolean {
    return false;
  }

  // Cargar datos del catálogo (3 niveles: Subfamilia → Flavor → Presentation)
  async loadCatalogData() {
    if (!this.idRoot) return;

    try {
      // Guardar estado de expansión antes de recargar
      this.saveExpansionState();

      // Cargar los 3 tipos de datos en paralelo
      const [subfamilias, flavors, presentations] = await Promise.all([
        lastValueFrom(this.catalogsService.getCatalogs(this.idRoot, 'SUB-FAM')),
        lastValueFrom(this.catalogsService.getCatalogs(this.idRoot, 'FLAVOR')),
        lastValueFrom(this.catalogsService.getCatalogs(this.idRoot, 'PRESENTATI'))
      ]);

      // Construir estructura jerárquica
      this.buildTreeStructure(subfamilias, flavors, presentations);

      // Restaurar estado de expansión
      this.restoreExpansionState();

    } catch (error) {
      console.error('Error al cargar datos del catálogo:', error);
      this.treeData = [];
      alerts.basicAlert('Error', 'Error al cargar los datos.', 'error');
    }
  }

  // Construir estructura plana para 3 columnas con control de expansión
  private buildTreeStructure(subfamilias: any[], flavors: any[], presentations: any[]) {
    this.treeData = [];

    // Filtrar solo la subfamilia del material actual
    const materialSubfamilia = subfamilias.find(s => s.id === this.idFamilia);

    if (!materialSubfamilia) {
      console.warn('No se encontró la subfamilia del material');
      return;
    }

    // Agregar subfamilia (nivel 1) - siempre visible
    const subfamiliaNode = {
      ...materialSubfamilia,
      nodeLevel: 'subfamilia',
      originalId: materialSubfamilia.id,
      isExpanded: false,
      isVisible: true
    };
    this.treeData.push(subfamiliaNode);

    // Buscar flavors de esta subfamilia (nivel 2)
    const subfamiliaFlavors = flavors.filter(flavor => flavor.parentId === materialSubfamilia.id);

    subfamiliaFlavors.forEach(flavor => {
      const flavorNode = {
        ...flavor,
        nodeLevel: 'flavor',
        originalId: flavor.id,
        parentSubfamiliaId: materialSubfamilia.id,
        isExpanded: false,
        isVisible: false // Ocultas por defecto
      };
      this.treeData.push(flavorNode);

      // Buscar presentations de este flavor (nivel 3)
      const flavorPresentations = presentations.filter(presentation =>
        presentation.subParentId === flavor.id
      );

      flavorPresentations.forEach(presentation => {
        const presentationNode = {
          ...presentation,
          nodeLevel: 'presentation',
          originalId: presentation.id,
          parentSubfamiliaId: materialSubfamilia.id,
          parentFlavorId: flavor.id,
          isVisible: false // Ocultas por defecto
        };
        this.treeData.push(presentationNode);
      });
    });
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
      },
      onCellDoubleClicked: (event: any) => {
        if (event.data) {
          this.openEditModal(event.data);
        }
      }
    };
  }

  // Definición de 3 columnas separadas con chevrons funcionales
  get columnDefs(): ColDef[] {
    return [
      {
        headerName: 'Subfamilia',
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
          if (event.event.target.classList.contains('chevron-icon') ||
              event.event.target.getAttribute('data-action') === 'toggle') {
            this.toggleSubfamiliaExpansion(event.data);
          }
        }
      },
      {
        headerName: 'Flavor',
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
          if (event.event.target.classList.contains('chevron-icon') ||
              event.event.target.getAttribute('data-action') === 'toggle') {
            this.toggleFlavorExpansion(event.data);
          }
        }
      },
      {
        headerName: 'Presentation',
        field: 'presentationDisplay',
        width: 200,
        cellRenderer: (params: any) => {
          if (params.data.nodeLevel === 'presentation') {
            return `<span style="margin-right: 15px;"></span> ${params.data.description}`;
          }
          return '';
        }
      },
      {
        headerName: 'Activo',
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
  }

  // Agregar nuevo elemento según nivel seleccionado
  addCatalogItem() {
    if (!this.selectedRowData) {
      this.openAddFlavorModal(); // Si no hay selección, agregar flavor
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
        this.openAddFlavorModal();
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

  openAddFlavorModal() {
    if (!this.selectedRowData || this.selectedNodeLevel !== 'subfamilia') {
      alerts.basicAlert('Error', 'Seleccione una subfamilia para agregar un flavor.', 'warning');
      return;
    }
    this.resetModalForm();
    this.showAddFlavorModal = true;
  }

  openAddPresentationModal() {
    if (!this.selectedRowData || this.selectedNodeLevel !== 'flavor') {
      alerts.basicAlert('Error', 'Seleccione un flavor para agregar una presentación.', 'warning');
      return;
    }
    this.resetModalForm();
    this.showAddPresentationModal = true;
  }

  openEditModal(item: any) {
    this.editingItem = { ...item };
    this.modalForm.description = item.description || '';
    this.modalForm.active = item.active === 1;
    this.showEditModal = true;
  }

  closeModals() {
    this.showAddFlavorModal = false;
    this.showAddPresentationModal = false;
    this.showEditModal = false;
    this.resetModalForm();
    this.editingItem = null;
  }

  private resetModalForm() {
    this.modalForm = {
      description: '',
      active: true
    };
  }

  async saveNewFlavor() {
    if (!this.modalForm.description.trim()) {
      alerts.basicAlert('Error', 'La descripción es obligatoria.', 'warning');
      return;
    }

    const newFlavor = this.cleanDataForServer({
      description: this.modalForm.description,
      type: 'FLAVOR',
      parentId: this.selectedRowData.originalId,
      active: this.modalForm.active ? 1 : 0
    });

    try {
      await lastValueFrom(this.catalogsService.addCatalog(newFlavor));
      alerts.basicAlert('Éxito', 'Flavor creado correctamente.', 'success');
      this.closeModals();
      this.loadCatalogData();
    } catch (error: any) {
      console.error('Error al crear flavor:', error);
      const errorMsg = error?.error?.message || error?.message || 'Error desconocido';
      alerts.basicAlert('Error', `Error al crear el flavor: ${errorMsg}`, 'error');
    }
  }

  async saveNewPresentation() {
    if (!this.modalForm.description.trim()) {
      alerts.basicAlert('Error', 'La descripción es obligatoria.', 'warning');
      return;
    }

    const newPresentation = this.cleanDataForServer({
      description: this.modalForm.description,
      type: 'PRESENTATI',
      parentId: this.selectedRowData.parentSubfamiliaId,
      subParentId: this.selectedRowData.originalId,
      active: this.modalForm.active ? 1 : 0
    });

    try {
      await lastValueFrom(this.catalogsService.addCatalog(newPresentation));
      alerts.basicAlert('Éxito', 'Presentación creada correctamente.', 'success');
      this.closeModals();
      this.loadCatalogData();
    } catch (error: any) {
      console.error('Error al crear presentación:', error);
      const errorMsg = error?.error?.message || error?.message || 'Error desconocido';
      alerts.basicAlert('Error', `Error al crear la presentación: ${errorMsg}`, 'error');
    }
  }

  async saveEditChanges() {
    if (!this.modalForm.description.trim()) {
      alerts.basicAlert('Error', 'La descripción es obligatoria.', 'warning');
      return;
    }

    if (!this.editingItem?.originalId) {
      alerts.basicAlert('Error', 'No se puede identificar el registro a actualizar.', 'error');
      return;
    }

    const updatedData = this.cleanDataForServer({
      description: this.modalForm.description,
      valueAddition: this.editingItem.valueAddition,
      valueAddition2: this.editingItem.valueAddition2,
      valueAdditionBit: this.editingItem.valueAdditionBit,
      valueAdditionBit2: this.editingItem.valueAdditionBit2,
      vigente: this.editingItem.vigente,
      type: this.editingItem.type,
      parentId: this.editingItem.parentId,
      subParentId: this.editingItem.subParentId,
      price: this.editingItem.price,
      active: this.modalForm.active ? 1 : 0
    });

    try {
      await lastValueFrom(this.catalogsService.updateCatalog(this.editingItem.originalId, updatedData));
      alerts.basicAlert('Éxito', 'Registro actualizado correctamente.', 'success');
      this.closeModals();
      this.loadCatalogData();
    } catch (error: any) {
      console.error('Error al actualizar:', error);
      const errorMsg = error?.error?.message || error?.message || 'Error desconocido';
      alerts.basicAlert('Error', `Error al actualizar el registro: ${errorMsg}`, 'error');
    }
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
    }
  }
}
