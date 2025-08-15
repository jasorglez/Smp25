import { Component, effect, HostListener, inject } from '@angular/core';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { alerts } from 'app/helpers/alerts';
import { AgGridModule } from 'ag-grid-angular';
import { catchError, EMPTY, lastValueFrom } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SignalsService } from 'app/services/signals.service';
import { TrackingService } from 'app/services/tracking.service';
import { CatalogsService } from 'app/services/catalogs.service';

@Component({
  selector: 'app-materiales-maestro',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  templateUrl: './materiales-maestro.component.html',
  styleUrl: './materiales-maestro.component.scss'
})
export class MaterialesMaestroComponent {

  private catalogsService = inject(CatalogsService);
  private signalsService = inject(SignalsService);
  private trackingService = inject(TrackingService);

  constructor() {
    effect(() => {
      this.idRoot = this.signalsService.getRootSelectedBySidebar()();
      this.loadCatalogData();
    });
  }

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.notSavedChanges) {
      $event.returnValue = 'Tienes cambios sin guardar. ¿Seguro que deseas salir?';
    }
  }

  ngOnInit() {
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Acceso a Materiales Maestro',
      'Almacenes - Catálogo Jerárquico',
      this.trackingService.getEmail()
    );
    
    this.loadCatalogData();
  }

  notSavedChanges: boolean = false;
  private gridApi: GridApi;
  private tempIdCounter: number = 0;

  // Propiedades para modales
  showAddCategoryModal = false;
  showAddFamilyModal = false;
  showAddSubfamilyModal = false;
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
  selectedNodeLevel: 'category' | 'family' | 'subfamily' | null = null;
  
  // ID de la empresa actual
  private idRoot = this.signalsService.getRootSelectedBySidebar()();

  // Cargar datos del catálogo (3 niveles)
  async loadCatalogData() {
    if (!this.idRoot) return;
    
    try {
      // Cargar los 3 tipos de datos en paralelo
      const [categories, families, subfamilies] = await Promise.all([
        lastValueFrom(this.catalogsService.getCatalogs(this.idRoot, 'CATEGORY')),
        lastValueFrom(this.catalogsService.getCatalogs(this.idRoot, 'FAM-CAT')),
        lastValueFrom(this.catalogsService.getCatalogs(this.idRoot, 'SUB-FAM'))
      ]);

      // Construir estructura jerárquica
      this.buildTreeStructure(categories, families, subfamilies);
      
    } catch (error) {
      console.error('Error al cargar datos del catálogo:', error);
      this.treeData = [];
      alerts.basicAlert(
        'Error',
        'Error al cargar los datos del catálogo.',
        'error'
      );
    }
  }

  // Construir estructura de árbol de 3 niveles
  private buildTreeStructure(categories: any[], families: any[], subfamilies: any[]) {
    this.treeData = [];
    
    // Agregar categorías (nivel 1)
    categories.forEach(category => {
      const categoryNode = {
        ...category,
        nodeLevel: 'category',
        orgHierarchy: [category.description],
        originalId: category.id, // ID real del servidor
        children: []
      };
      
      // Buscar familias de esta categoría (nivel 2)
      const categoryFamilies = families.filter(family => family.parentId === category.id);
      
      categoryFamilies.forEach(family => {
        const familyNode = {
          ...family,
          nodeLevel: 'family',
          orgHierarchy: [category.description, family.description],
          originalId: family.id, // ID real del servidor
          parentCategoryId: category.id,
          children: []
        };
        
        // Buscar subfamilias de esta familia (nivel 3)
        const familySubfamilies = subfamilies.filter(subfamily => 
          subfamily.subParentId === family.id
        );
        
        familySubfamilies.forEach(subfamily => {
          const subfamilyNode = {
            ...subfamily,
            nodeLevel: 'subfamily',
            orgHierarchy: [category.description, family.description, subfamily.description],
            originalId: subfamily.id, // ID real del servidor
            parentCategoryId: category.id,
            parentFamilyId: family.id
          };
          
          familyNode.children.push(subfamilyNode);
        });
        
        categoryNode.children.push(familyNode);
      });
      
      this.treeData.push(categoryNode);
    });

    console.log('Estructura jerárquica construida:', this.treeData);
    console.log('IDs encontrados:', {
      categories: categories.map(c => c.id),
      families: families.map(f => f.id),
      subfamilies: subfamilies.map(s => s.id)
    });
  }

  // Configuración del grid
  get gridOptions(): any {
    return {
      headerHeight: 35,
      rowHeight: 35,
      animateRows: true,
      treeData: true,
      groupDefaultExpanded: 1, // Expandir primer nivel por defecto
      getDataPath: (data: any) => data.orgHierarchy,
      suppressAutoGroupColumn: true, // Ocultar columna de agrupación automática
      // Grid en modo solo lectura - sin edición inline
      suppressClickEdit: true,
      singleClickEdit: false,
      stopEditingWhenCellsLoseFocus: true,
      onRowSelected: (event: any) => {
        if (event.node.isSelected()) {
          this.onRowSelected(event);
        }
      },
      onCellValueChanged: (event: any) => {
        this.onCellValueChanged(event);
      },
      onCellClicked: (event: any) => {
        // Manejar click en iconos de expand/collapse
        if (event.event.target && event.event.target.classList.contains('expand-icon')) {
          event.node.setExpanded(!event.node.expanded);
          event.api.refreshCells({ rowNodes: [event.node], force: true });
        }
      },
      onCellDoubleClicked: (event: any) => {
        // Abrir modal de edición en doble click 
        if (event.data && !event.event.target.classList.contains('expand-icon')) {
          this.openEditModal(event.data);
        }
      }
    };
  }

  // Definición de columnas
  get columnDefs(): ColDef[] {
    return [
      { 
        field: 'description', 
        headerName: 'Descripción', 
        editable: false,
        flex: 1,
        cellClass: 'readonly-cell',
        cellRenderer: (params: any) => {
          if (!params.data) return '';
          
          const nodeLevel = params.data.nodeLevel;
          let expandIcon = '';
          let icon = '';
          let text = params.data.description;
          let count = '';
          
          if (nodeLevel === 'category') {
            const familyCount = this.getFamilyCountForCategory(params.data.originalId);
            const hasChildren = familyCount > 0;
            const isExpanded = params.node.expanded;
            
            if (hasChildren) {
              expandIcon = isExpanded 
                ? '<i class="bi bi-chevron-down me-1 expand-icon" style="cursor: pointer;"></i>'
                : '<i class="bi bi-chevron-right me-1 expand-icon" style="cursor: pointer;"></i>';
            }
            
            icon = '<i class="bi bi-folder-fill text-primary me-2"></i>';
            count = ` (${familyCount})`;
          } else if (nodeLevel === 'family') {
            const subfamilyCount = this.getSubfamilyCountForFamily(params.data.originalId);
            const hasChildren = subfamilyCount > 0;
            const isExpanded = params.node.expanded;
            
            if (hasChildren) {
              expandIcon = isExpanded 
                ? '<i class="bi bi-chevron-down me-1 expand-icon" style="cursor: pointer;"></i>'
                : '<i class="bi bi-chevron-right me-1 expand-icon" style="cursor: pointer;"></i>';
            }
            
            icon = '<i class="bi bi-collection-fill text-info me-2"></i>';
            count = ` (${subfamilyCount})`;
          } else if (nodeLevel === 'subfamily') {
            icon = '<i class="bi bi-file-earmark-fill text-secondary me-2"></i>';
          }
          
          return `${expandIcon}${icon}${text}${count}`;
        }
      }
    ];
  }

  // Selección de filas
  onRowSelected(event: any) {
    this.selectedRowData = event.data;
    if (event.data) {
      this.selectedNodeLevel = event.data.nodeLevel || 'category';
    } else {
      this.selectedNodeLevel = null;
    }
  }

  // Cambios en celdas
  onCellValueChanged(event: any) {
    console.log('Dato cambiado:', event.data);
    event.data.__modified = true;
    this.notSavedChanges = true;
  }

  // Grid listo
  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  // Agregar nuevo elemento según nivel seleccionado - Usar modales
  addCatalogItem() {
    if (!this.selectedRowData) {
      this.openAddCategoryModal(); // Si no hay selección, agregar categoría
      return;
    }

    switch (this.selectedNodeLevel) {
      case 'category':
        this.openAddFamilyModal();
        break;
      case 'family':
        this.openAddSubfamilyModal();
        break;
      case 'subfamily':
        alerts.basicAlert(
          'Nivel máximo',
          'No se pueden agregar elementos debajo de una subfamilia.',
          'warning'
        );
        break;
      default:
        this.openAddCategoryModal();
    }
  }






  // Retornar datos en estructura de árbol para AG-Grid
  flattenTreeData(): any[] {
    // Para treeData, AG-Grid necesita la estructura jerárquica completa
    return this.treeData;
  }


  // Eliminar elemento seleccionado
  async deleteSelectedItem() {
    if (!this.selectedRowData) {
      alerts.basicAlert(
        'Eliminar',
        'Por favor, seleccione un elemento para eliminar.',
        'error'
      );
      return;
    }

    if (!this.selectedRowData.originalId) {
      alerts.basicAlert('Error', 'No se puede identificar el registro a eliminar.', 'error');
      return;
    }

    const result = await alerts.confirmAlert(
      'Confirmar eliminación',
      `¿Está seguro de que desea eliminar "${this.selectedRowData.description}"? Esta acción no se puede deshacer.`,
      'warning',
      'Sí, eliminar'
    );

    if (!result.isConfirmed) return;

    try {
      console.log('Eliminando registro ID:', this.selectedRowData.originalId);
      const response = await lastValueFrom(this.catalogsService.deleteCatalog(this.selectedRowData.originalId));
      console.log('Respuesta del servidor (eliminación):', response);

      alerts.basicAlert(
        'Eliminado',
        'Elemento eliminado satisfactoriamente.',
        'success'
      );

      this.loadCatalogData(); // Recargar datos
      this.selectedRowData = null;
      this.selectedNodeLevel = null;
      
    } catch (error: any) {
      console.error('Error al eliminar:', error);
      const errorMsg = error?.error?.message || error?.message || 'Error desconocido';
      alerts.basicAlert(
        'Error',
        `Error al eliminar el elemento: ${errorMsg}`,
        'error'
      );
    }
  }

  // Revertir cambios
  revert() {
    this.loadCatalogData();
    this.notSavedChanges = false;
    this.selectedRowData = null;
    this.selectedNodeLevel = null;
  }



  // ========== MÉTODOS HELPER PARA CONTADORES ==========
  
  // Contar familias de una categoría
  private getFamilyCountForCategory(categoryId: string | number): number {
    if (!this.treeData || !categoryId) return 0;
    
    const category = this.treeData.find(cat => cat.originalId === categoryId);
    return category?.children?.length || 0;
  }
  
  // Contar subfamilias de una familia
  private getSubfamilyCountForFamily(familyId: string | number): number {
    if (!this.treeData || !familyId) return 0;
    
    for (const category of this.treeData) {
      if (category.children) {
        const family = category.children.find(fam => fam.originalId === familyId);
        if (family) {
          return family.children?.length || 0;
        }
      }
    }
    return 0;
  }

  // ========== MÉTODOS PARA MODALES ==========
  
  // Abrir modal para nueva categoría
  openAddCategoryModal() {
    this.resetModalForm();
    this.showAddCategoryModal = true;
  }
  
  // Abrir modal para nueva familia
  openAddFamilyModal() {
    if (!this.selectedRowData || this.selectedNodeLevel !== 'category') {
      alerts.basicAlert('Error', 'Seleccione una categoría para agregar una familia.', 'warning');
      return;
    }
    this.resetModalForm();
    this.showAddFamilyModal = true;
  }
  
  // Abrir modal para nueva subfamilia
  openAddSubfamilyModal() {
    if (!this.selectedRowData || this.selectedNodeLevel !== 'family') {
      alerts.basicAlert('Error', 'Seleccione una familia para agregar una subfamilia.', 'warning');
      return;
    }
    this.resetModalForm();
    this.showAddSubfamilyModal = true;
  }
  
  // Abrir modal de edición
  openEditModal(item: any) {
    this.editingItem = { ...item };
    this.modalForm.description = item.description || '';
    this.modalForm.active = item.active === 1;
    this.showEditModal = true;
  }
  
  // Cerrar todos los modales
  closeModals() {
    this.showAddCategoryModal = false;
    this.showAddFamilyModal = false;
    this.showAddSubfamilyModal = false;
    this.showEditModal = false;
    this.resetModalForm();
    this.editingItem = null;
  }
  
  // Resetear formulario modal
  private resetModalForm() {
    this.modalForm = {
      description: '',
      active: true
    };
  }
  
  // Guardar nueva categoría
  async saveNewCategory() {
    if (!this.modalForm.description.trim()) {
      alerts.basicAlert('Error', 'La descripción es obligatoria.', 'warning');
      return;
    }
    
    const newCategory = this.cleanDataForServer({
      description: this.modalForm.description,
      type: 'CATEGORY',
      active: this.modalForm.active ? 1 : 0
    });
    
    try {
      const response = await lastValueFrom(this.catalogsService.addCatalog(newCategory));
      console.log('Respuesta del servidor (nueva categoría):', response);
      alerts.basicAlert('Éxito', 'Categoría creada correctamente.', 'success');
      this.closeModals();
      this.loadCatalogData();
    } catch (error: any) {
      console.error('Error al crear categoría:', error);
      const errorMsg = error?.error?.message || error?.message || 'Error desconocido';
      alerts.basicAlert('Error', `Error al crear la categoría: ${errorMsg}`, 'error');
    }
  }
  
  // Guardar nueva familia
  async saveNewFamily() {
    if (!this.modalForm.description.trim()) {
      alerts.basicAlert('Error', 'La descripción es obligatoria.', 'warning');
      return;
    }
    
    const newFamily = this.cleanDataForServer({
      description: this.modalForm.description,
      type: 'FAM-CAT',
      parentId: this.selectedRowData.originalId,
      active: this.modalForm.active ? 1 : 0
    });
    
    try {
      const response = await lastValueFrom(this.catalogsService.addCatalog(newFamily));
      console.log('Respuesta del servidor (nueva familia):', response);
      alerts.basicAlert('Éxito', 'Familia creada correctamente.', 'success');
      this.closeModals();
      this.loadCatalogData();
    } catch (error: any) {
      console.error('Error al crear familia:', error);
      const errorMsg = error?.error?.message || error?.message || 'Error desconocido';
      alerts.basicAlert('Error', `Error al crear la familia: ${errorMsg}`, 'error');
    }
  }
  
  // Guardar nueva subfamilia
  async saveNewSubfamily() {
    if (!this.modalForm.description.trim()) {
      alerts.basicAlert('Error', 'La descripción es obligatoria.', 'warning');
      return;
    }
    
    const newSubfamily = this.cleanDataForServer({
      description: this.modalForm.description,
      type: 'SUB-FAM',
      parentId: this.selectedRowData.parentCategoryId,
      subParentId: this.selectedRowData.originalId,
      active: this.modalForm.active ? 1 : 0
    });
    
    try {
      const response = await lastValueFrom(this.catalogsService.addCatalog(newSubfamily));
      console.log('Respuesta del servidor (nueva subfamilia):', response);
      alerts.basicAlert('Éxito', 'Subfamilia creada correctamente.', 'success');
      this.closeModals();
      this.loadCatalogData();
    } catch (error: any) {
      console.error('Error al crear subfamilia:', error);
      const errorMsg = error?.error?.message || error?.message || 'Error desconocido';
      alerts.basicAlert('Error', `Error al crear la subfamilia: ${errorMsg}`, 'error');
    }
  }
  
  // Guardar cambios en edición
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
      vigente: this.editingItem.vigente,
      type: this.editingItem.type,
      parentId: this.editingItem.parentId,
      subParentId: this.editingItem.subParentId,
      price: this.editingItem.price,
      active: this.modalForm.active ? 1 : 0
    });
    
    try {
      console.log('Actualizando registro ID:', this.editingItem.originalId);
      const response = await lastValueFrom(this.catalogsService.updateCatalog(this.editingItem.originalId, updatedData));
      console.log('Respuesta del servidor (actualización):', response);
      alerts.basicAlert('Éxito', 'Registro actualizado correctamente.', 'success');
      this.closeModals();
      this.loadCatalogData();
    } catch (error: any) {
      console.error('Error al actualizar:', error);
      const errorMsg = error?.error?.message || error?.message || 'Error desconocido';
      alerts.basicAlert('Error', `Error al actualizar el registro: ${errorMsg}`, 'error');
    }
  }

  // Limpiar datos para servidor
  private cleanDataForServer(data: any): any {
    const cleanData = {
      idCompany: Number(this.idRoot),
      description: String(data.description || '').trim(),
      valueAddition: String(data.valueAddition || 'NA'),
      valueAddition2: String(data.valueAddition2 || 'NA'),
      valueAdditionBit: Boolean(data.valueAdditionBit || false),
      vigente: Boolean(data.vigente !== false),
      type: String(data.type),
      parentId: Number(data.parentId || 0),
      subParentId: Number(data.subParentId || 0),
      price: Number(data.price || 0),
      active: Number(data.active || 1)
    };
    
    console.log('Datos enviados al servidor:', cleanData);
    return cleanData;
  }
}