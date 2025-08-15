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
  selector: 'app-cat-fam-sub',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  templateUrl: './cat-fam-sub.component.html',
  styleUrl: './cat-fam-sub.component.scss'
})
export class CatFamSubComponent {

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
      'Acceso a Catálogo Cat-Fam-Sub',
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

  // Construir estructura plana para 3 columnas con control de expansión
  private buildTreeStructure(categories: any[], families: any[], subfamilies: any[]) {
    this.treeData = [];
    
    // Agregar categorías (nivel 1) - siempre visibles
    categories.forEach(category => {
      const categoryNode = {
        ...category,
        nodeLevel: 'category',
        originalId: category.id,
        isExpanded: true, // Por defecto expandido
        isVisible: true
      };
      this.treeData.push(categoryNode);
      
      // Buscar familias de esta categoría (nivel 2)
      const categoryFamilies = families.filter(family => family.parentId === category.id);
      
      categoryFamilies.forEach(family => {
        const familyNode = {
          ...family,
          nodeLevel: 'family',
          originalId: family.id,
          parentCategoryId: category.id,
          isExpanded: true, // Por defecto expandido
          isVisible: true
        };
        this.treeData.push(familyNode);
        
        // Buscar subfamilias de esta familia (nivel 3)
        const familySubfamilies = subfamilies.filter(subfamily => 
          subfamily.subParentId === family.id
        );
        
        familySubfamilies.forEach(subfamily => {
          const subfamilyNode = {
            ...subfamily,
            nodeLevel: 'subfamily',
            originalId: subfamily.id,
            parentCategoryId: category.id,
            parentFamilyId: family.id,
            isVisible: true
          };
          this.treeData.push(subfamilyNode);
        });
      });
    });

    console.log('Estructura plana construida:', this.treeData);
  }

  // Configuración del grid
  get gridOptions(): any {
    return {
      headerHeight: 35,
      rowHeight: 35,
      animateRows: true,
      treeData: false, // Cambiar a false para usar 3 columnas separadas
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
      onCellDoubleClicked: (event: any) => {
        // Abrir modal de edición en doble click 
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
        headerName: 'Categoría',
        field: 'categoryDisplay',
        width: 300,
        cellRenderer: (params: any) => {
          if (params.data.nodeLevel === 'category') {
            const isExpanded = params.data.isExpanded || false;
            const chevron = isExpanded ? '▼' : '▶';
            return `<span class="chevron-icon" data-action="toggle" style="cursor: pointer; margin-right: 5px;">${chevron}</span> ${params.data.description}`;
          }
          return '';
        },
        onCellClicked: (event: any) => {
          if (event.event.target.classList.contains('chevron-icon') || 
              event.event.target.getAttribute('data-action') === 'toggle') {
            this.toggleCategoryExpansion(event.data);
          }
        }
      },
      {
        headerName: 'Familia',
        field: 'familyDisplay',
        width: 300,
        cellRenderer: (params: any) => {
          if (params.data.nodeLevel === 'family') {
            const isExpanded = params.data.isExpanded || false;
            const chevron = isExpanded ? '▼' : '▶';
            return `<span class="chevron-icon" data-action="toggle" style="cursor: pointer; margin-right: 5px;">${chevron}</span> ${params.data.description}`;
          }
          return '';
        },
        onCellClicked: (event: any) => {
          if (event.event.target.classList.contains('chevron-icon') || 
              event.event.target.getAttribute('data-action') === 'toggle') {
            this.toggleFamilyExpansion(event.data);
          }
        }
      },
      {
        headerName: 'Sub Familia',
        field: 'subfamilyDisplay',
        width: 300,
        cellRenderer: (params: any) => {
          if (params.data.nodeLevel === 'subfamily') {
            return `<span style="margin-right: 15px;"></span> ${params.data.description}`;
          }
          return '';
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






  // Retornar datos filtrados por visibilidad para AG-Grid
  flattenTreeData(): any[] {
    return this.treeData.filter(item => item.isVisible);
  }

  // Métodos para manejar expand/collapse
  toggleCategoryExpansion(categoryData: any) {
    const category = this.treeData.find(item => 
      item.nodeLevel === 'category' && item.originalId === categoryData.originalId
    );
    
    if (category) {
      category.isExpanded = !category.isExpanded;
      
      // Mostrar/ocultar familias de esta categoría
      this.treeData.forEach(item => {
        if (item.nodeLevel === 'family' && item.parentCategoryId === category.originalId) {
          item.isVisible = category.isExpanded;
          
          // Si ocultamos la familia, también ocultar sus subfamilias
          if (!category.isExpanded) {
            this.treeData.forEach(subItem => {
              if (subItem.nodeLevel === 'subfamily' && subItem.parentFamilyId === item.originalId) {
                subItem.isVisible = false;
              }
            });
          } else {
            // Si mostramos la familia, mostrar subfamilias solo si la familia está expandida
            if (item.isExpanded) {
              this.treeData.forEach(subItem => {
                if (subItem.nodeLevel === 'subfamily' && subItem.parentFamilyId === item.originalId) {
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

  toggleFamilyExpansion(familyData: any) {
    const family = this.treeData.find(item => 
      item.nodeLevel === 'family' && item.originalId === familyData.originalId
    );
    
    if (family) {
      family.isExpanded = !family.isExpanded;
      
      // Mostrar/ocultar subfamilias de esta familia
      this.treeData.forEach(item => {
        if (item.nodeLevel === 'subfamily' && item.parentFamilyId === family.originalId) {
          item.isVisible = family.isExpanded;
        }
      });
      
      // Refrescar el grid
      if (this.gridApi) {
        this.gridApi.setGridOption('rowData', this.flattenTreeData());
      }
    }
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