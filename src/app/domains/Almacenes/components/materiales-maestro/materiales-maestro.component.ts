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
        originalId: category.id,
        children: []
      };
      
      // Buscar familias de esta categoría (nivel 2)
      const categoryFamilies = families.filter(family => family.parentId === category.id);
      
      categoryFamilies.forEach(family => {
        const familyNode = {
          ...family,
          nodeLevel: 'family',
          orgHierarchy: [category.description, family.description],
          originalId: family.id,
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
            originalId: subfamily.id,
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
      // Grid en modo solo lectura - sin edición inline
      suppressClickEdit: true,
      singleClickEdit: false,
      stopEditingWhenGridLosesFocus: true
      autoGroupColumnDef: {
        headerName: 'Jerarquía',
        minWidth: 250,
        editable: false,
        cellRendererParams: {
          suppressCount: true,
          suppressDoubleClickExpansion: true, // Prevenir expansión en doble click
          innerRenderer: (params: any) => {
            if (params.data) {
              const level = params.data.nodeLevel;
              const icons = {
                category: '<i class="bi bi-folder-fill text-primary"></i>',
                family: '<i class="bi bi-collection-fill text-info"></i>', 
                subfamily: '<i class="bi bi-file-earmark-fill text-secondary"></i>'
              };
              const levelNames = {
                category: 'Categoría',
                family: 'Familia',
                subfamily: 'Subfamilia'
              };
              return `${icons[level] || icons.subfamily} ${levelNames[level] || 'Elemento'}`;
            }
            return '';
          }
        }
      },
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
        if (event.data && event.colDef.field === 'description') {
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
        editable: false, // Desactivar edición inline
        flex: 2,
        cellEditor: 'agTextCellEditor',
        cellEditorParams: {
          maxLength: 100
        },
        cellClass: 'readonly-cell',
        cellRenderer: (params: any) => {
          if (!params.data) return '';
          return params.value || '<span class="text-muted fst-italic">Sin descripción</span>';
        },
      },
      { 
        field: 'active', 
        headerName: 'Activo', 
        editable: false, // Desactivar edición inline 
        flex: 1,
        cellRenderer: 'agCheckboxCellRenderer',
        cellEditor: 'agCheckboxCellEditor',
        valueFormatter: (params) => params.value === 1 ? 'Sí' : 'No'
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






  // Aplanar datos del árbol para AG-Grid
  flattenTreeData(): any[] {
    const flattened = [];
    
    const flatten = (items: any[]) => {
      items.forEach(item => {
        flattened.push(item);
        if (item.children && item.children.length > 0) {
          flatten(item.children);
        }
      });
    };
    
    flatten(this.treeData);
    return flattened;
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

    const result = await alerts.confirmAlert(
      'Confirmar eliminación',
      `¿Está seguro de que desea eliminar "${this.selectedRowData.description}"? Esta acción no se puede deshacer.`,
      'warning',
      'Sí, eliminar'
    );

    if (!result.isConfirmed) return;

    try {
      if (!this.selectedRowData.originalId.toString().startsWith('temp_')) {
        await lastValueFrom(this.catalogsService.deleteCatalog(this.selectedRowData.originalId));
      }

      alerts.basicAlert(
        'Eliminado',
        'Elemento eliminado satisfactoriamente.',
        'success'
      );

      this.loadCatalogData(); // Recargar datos
      this.selectedRowData = null;
      this.selectedNodeLevel = null;
      
    } catch (error) {
      console.error('Error al eliminar:', error);
      alerts.basicAlert(
        'Error',
        'Error al eliminar el elemento.',
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
    
    const newCategory = {
      idCompany: this.idRoot,
      description: this.modalForm.description.trim(),
      valueAddition: 'NA',
      valueAddition2: 'NA',
      valueAdditionBit: false,
      vigente: true,
      type: 'CATEGORY',
      parentId: 0,
      subParentId: 0,
      price: 0,
      active: this.modalForm.active ? 1 : 0
    };
    
    try {
      await lastValueFrom(this.catalogsService.addCatalog(newCategory));
      alerts.basicAlert('Éxito', 'Categoría creada correctamente.', 'success');
      this.closeModals();
      this.loadCatalogData();
    } catch (error) {
      console.error('Error al crear categoría:', error);
      alerts.basicAlert('Error', 'Error al crear la categoría.', 'error');
    }
  }
  
  // Guardar nueva familia
  async saveNewFamily() {
    if (!this.modalForm.description.trim()) {
      alerts.basicAlert('Error', 'La descripción es obligatoria.', 'warning');
      return;
    }
    
    const newFamily = {
      idCompany: this.idRoot,
      description: this.modalForm.description.trim(),
      valueAddition: 'NA',
      valueAddition2: 'NA',
      valueAdditionBit: false,
      vigente: true,
      type: 'FAM-CAT',
      parentId: this.selectedRowData.originalId,
      subParentId: 0,
      price: 0,
      active: this.modalForm.active ? 1 : 0
    };
    
    try {
      await lastValueFrom(this.catalogsService.addCatalog(newFamily));
      alerts.basicAlert('Éxito', 'Familia creada correctamente.', 'success');
      this.closeModals();
      this.loadCatalogData();
    } catch (error) {
      console.error('Error al crear familia:', error);
      alerts.basicAlert('Error', 'Error al crear la familia.', 'error');
    }
  }
  
  // Guardar nueva subfamilia
  async saveNewSubfamily() {
    if (!this.modalForm.description.trim()) {
      alerts.basicAlert('Error', 'La descripción es obligatoria.', 'warning');
      return;
    }
    
    const newSubfamily = {
      idCompany: this.idRoot,
      description: this.modalForm.description.trim(),
      valueAddition: 'NA',
      valueAddition2: 'NA',
      valueAdditionBit: false,
      vigente: true,
      type: 'SUB-FAM',
      parentId: this.selectedRowData.parentCategoryId,
      subParentId: this.selectedRowData.originalId,
      price: 0,
      active: this.modalForm.active ? 1 : 0
    };
    
    try {
      await lastValueFrom(this.catalogsService.addCatalog(newSubfamily));
      alerts.basicAlert('Éxito', 'Subfamilia creada correctamente.', 'success');
      this.closeModals();
      this.loadCatalogData();
    } catch (error) {
      console.error('Error al crear subfamilia:', error);
      alerts.basicAlert('Error', 'Error al crear la subfamilia.', 'error');
    }
  }
  
  // Guardar cambios en edición
  async saveEditChanges() {
    if (!this.modalForm.description.trim()) {
      alerts.basicAlert('Error', 'La descripción es obligatoria.', 'warning');
      return;
    }
    
    const updatedData = {
      idCompany: this.editingItem.idCompany || this.idRoot,
      description: this.modalForm.description.trim(),
      valueAddition: this.editingItem.valueAddition || 'NA',
      valueAddition2: this.editingItem.valueAddition2 || 'NA',
      valueAdditionBit: this.editingItem.valueAdditionBit || false,
      vigente: this.editingItem.vigente !== false,
      type: this.editingItem.type,
      parentId: this.editingItem.parentId || 0,
      subParentId: this.editingItem.subParentId || 0,
      price: this.editingItem.price || 0,
      active: this.modalForm.active ? 1 : 0
    };
    
    try {
      await lastValueFrom(this.catalogsService.updateCatalog(this.editingItem.originalId, updatedData));
      alerts.basicAlert('Éxito', 'Registro actualizado correctamente.', 'success');
      this.closeModals();
      this.loadCatalogData();
    } catch (error) {
      console.error('Error al actualizar:', error);
      alerts.basicAlert('Error', 'Error al actualizar el registro.', 'error');
    }
  }

  // Limpiar datos para servidor
  cleanDataForServer(data: any): any {
    return {
      idCompany: data.idCompany || this.idRoot,
      description: data.description,
      valueAddition: data.valueAddition || 'NA',
      valueAddition2: data.valueAddition2 || 'NA',
      valueAdditionBit: data.valueAdditionBit || false,
      vigente: data.vigente !== false,
      type: data.type,
      parentId: data.parentId || 0,
      subParentId: data.subParentId || 0,
      price: data.price || 0,
      active: data.active || 1
    };
  }
}