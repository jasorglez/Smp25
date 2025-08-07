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
  isInlineEditing: boolean = false;
  currentEditingRowId: string | null = null;
  
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
      singleClickEdit: true,
      stopEditingWhenGridLosesFocus: false,
      autoGroupColumnDef: {
        headerName: 'Jerarquía',
        minWidth: 250,
        editable: false,
        cellRendererParams: {
          suppressCount: true,
          innerRenderer: (params: any) => {
            if (params.data) {
              const level = params.data.nodeLevel;
              const icons = {
                category: '<i class="bi bi-folder-fill text-primary"></i>',
                family: '<i class="bi bi-collection-fill text-info"></i>', 
                subfamily: '<i class="bi bi-file-earmark-fill text-secondary"></i>'
              };
              const editingClass = params.data.__isInlineEditing ? 'editing-row' : '';
              const levelNames = {
                category: 'Categoría',
                family: 'Familia',
                subfamily: 'Subfamilia'
              };
              return `<span class="${editingClass}">${icons[level] || icons.subfamily} ${levelNames[level] || 'Elemento'}</span>`;
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
      onCellKeyPress: (event: any) => {
        this.onCellKeyPress(event);
      },
      onCellValueChanged: (event: any) => {
        // Solo procesar cambios en la columna description durante edición inline
        if (this.isInlineEditing && event.data.__isInlineEditing && event.colDef.field === 'description') {
          event.data.description = event.newValue;
          // No marcar como cambios guardables aún, solo cuando se confirme con Enter
        } else if (!this.isInlineEditing) {
          // Cambios normales fuera de edición inline
          this.onCellValueChanged(event);
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
        editable: true, 
        flex: 2,
        hide: false, // Hacer visible para permitir edición
        cellEditor: 'agTextCellEditor',
        cellEditorParams: {
          maxLength: 100
        },
        cellRenderer: (params: any) => {
          if (params.data && params.data.__isInlineEditing) {
            return params.value || 'Escriba aquí...';
          }
          return params.value || '';
        }
      },
      { 
        field: 'active', 
        headerName: 'Activo', 
        editable: true, 
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

  // Agregar nuevo elemento según nivel seleccionado
  addCatalogItem() {
    // Colapsar todo el grid para vista limpia
    if (this.gridApi) {
      this.gridApi.collapseAll();
    }

    // Verificar si ya hay una edición en curso
    if (this.isInlineEditing) {
      alerts.basicAlert(
        'Edición en curso',
        'Complete la edición actual antes de agregar un nuevo elemento.',
        'warning'
      );
      return;
    }

    if (!this.selectedRowData) {
      this.addCategoryInline(); // Si no hay selección, agregar categoría
      return;
    }

    switch (this.selectedNodeLevel) {
      case 'category':
        this.addFamilyInline();
        break;
      case 'family':
        this.addSubfamilyInline();
        break;
      case 'subfamily':
        alerts.basicAlert(
          'Nivel máximo',
          'No se pueden agregar elementos debajo de una subfamilia.',
          'warning'
        );
        break;
      default:
        this.addCategoryInline();
    }
  }

  // Agregar categoría inline (nivel 1)
  private addCategoryInline() {
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Agregar Categoría Inline',
      'Almacenes - Materiales Maestro',
      this.trackingService.getEmail()
    );

    const tempId = `temp_category_${this.tempIdCounter++}`;
    const newCategory = {
      id: tempId,
      idCompany: this.idRoot,
      description: '',
      valueAddition: 'NA',
      valueAddition2: 'NA',
      valueAdditionBit: false,
      vigente: true,
      type: 'CATEGORY',
      parentId: 0,
      subParentId: 0,
      price: 0,
      active: 1,
      nodeLevel: 'category',
      orgHierarchy: [''],
      originalId: tempId,
      children: [],
      __isNew: true,
      __isInlineEditing: true
    };

    this.treeData = [newCategory, ...this.treeData];
    this.notSavedChanges = true;
    this.isInlineEditing = true;
    this.currentEditingRowId = tempId;
    
    // Refrescar grid y activar edición
    if (this.gridApi) {
      this.gridApi.setGridOption('rowData', this.flattenTreeData());
      // Activar edición después de un pequeño delay para que el DOM se actualice
      setTimeout(() => {
        this.startInlineEditing(tempId);
      }, 100);
    }
  }

  // Agregar categoría (nivel 1) - método original mantenido para compatibilidad
  private addCategory() {
    this.addCategoryInline();
  }

  // Agregar familia inline (nivel 2)
  private addFamilyInline() {
    if (!this.selectedRowData || this.selectedNodeLevel !== 'category') {
      alerts.basicAlert('Error', 'Seleccione una categoría para agregar una familia.', 'warning');
      return;
    }

    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Agregar Familia Inline',
      'Almacenes - Materiales Maestro',
      this.trackingService.getEmail()
    );

    const tempId = `temp_family_${this.tempIdCounter++}`;
    const parentCategory = this.selectedRowData;
    
    const newFamily = {
      id: tempId,
      idCompany: this.idRoot,
      description: '',
      valueAddition: 'NA',
      valueAddition2: 'NA',
      valueAdditionBit: false,
      vigente: true,
      type: 'FAM-CAT',
      parentId: parentCategory.originalId,
      subParentId: 0,
      price: 0,
      active: 1,
      nodeLevel: 'family',
      orgHierarchy: [parentCategory.description, ''],
      originalId: tempId,
      parentCategoryId: parentCategory.originalId,
      children: [],
      __isNew: true,
      __isInlineEditing: true
    };

    // Agregar a la categoría padre
    const category = this.findCategoryInTree(parentCategory.originalId);
    if (category) {
      category.children.push(newFamily);
    }

    this.notSavedChanges = true;
    this.isInlineEditing = true;
    this.currentEditingRowId = tempId;
    
    // Refrescar grid y activar edición
    if (this.gridApi) {
      this.gridApi.setGridOption('rowData', this.flattenTreeData());
      setTimeout(() => {
        this.startInlineEditing(tempId);
      }, 100);
    }
  }

  // Agregar familia (nivel 2) - método original mantenido para compatibilidad
  private addFamily() {
    this.addFamilyInline();
  }

  // Agregar subfamilia inline (nivel 3)
  private addSubfamilyInline() {
    if (!this.selectedRowData || this.selectedNodeLevel !== 'family') {
      alerts.basicAlert('Error', 'Seleccione una familia para agregar una subfamilia.', 'warning');
      return;
    }

    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Agregar Subfamilia Inline',
      'Almacenes - Materiales Maestro',
      this.trackingService.getEmail()
    );

    const tempId = `temp_subfamily_${this.tempIdCounter++}`;
    const parentFamily = this.selectedRowData;
    
    const newSubfamily = {
      id: tempId,
      idCompany: this.idRoot,
      description: '',
      valueAddition: 'NA',
      valueAddition2: 'NA',
      valueAdditionBit: false,
      vigente: true,
      type: 'SUB-FAM',
      parentId: parentFamily.parentCategoryId,
      subParentId: parentFamily.originalId,
      price: 0,
      active: 1,
      nodeLevel: 'subfamily',
      orgHierarchy: [
        parentFamily.orgHierarchy[0], 
        parentFamily.description, 
        ''
      ],
      originalId: tempId,
      parentCategoryId: parentFamily.parentCategoryId,
      parentFamilyId: parentFamily.originalId,
      __isNew: true,
      __isInlineEditing: true
    };

    // Agregar a la familia padre
    const family = this.findFamilyInTree(parentFamily.originalId);
    if (family) {
      family.children.push(newSubfamily);
    }

    this.notSavedChanges = true;
    this.isInlineEditing = true;
    this.currentEditingRowId = tempId;
    
    // Refrescar grid y activar edición
    if (this.gridApi) {
      this.gridApi.setGridOption('rowData', this.flattenTreeData());
      setTimeout(() => {
        this.startInlineEditing(tempId);
      }, 100);
    }
  }

  // Agregar subfamilia (nivel 3) - método original mantenido para compatibilidad
  private addSubfamily() {
    this.addSubfamilyInline();
  }

  // Método auxiliar para encontrar categoría en el árbol
  private findCategoryInTree(categoryId: string | number): any {
    return this.treeData.find(cat => cat.originalId === categoryId);
  }

  // Método auxiliar para encontrar familia en el árbol
  private findFamilyInTree(familyId: string | number): any {
    for (const category of this.treeData) {
      const family = category.children.find(fam => fam.originalId === familyId);
      if (family) return family;
    }
    return null;
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

  // Guardar cambios
  async saveChanges() {
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Guardar Cambios Catálogo',
      'Almacenes - Materiales Maestro',
      this.trackingService.getEmail()
    );

    // Obtener datos aplanados
    const flatData = this.flattenTreeData();
    
    // Filtrar elementos nuevos y modificados
    const newItems = flatData.filter(item => item.__isNew);
    const modifiedItems = flatData.filter(item => item.__modified && !item.__isNew);

    try {
      // Guardar elementos nuevos
      for (const item of newItems) {
        const cleanedData = this.cleanDataForServer(item);
        const response = await lastValueFrom(this.catalogsService.addCatalog(cleanedData));
        if (response && response.id) {
          item.id = response.id;
          item.originalId = response.id;
        }
        item.__isNew = false;
      }

      // Guardar elementos modificados
      for (const item of modifiedItems) {
        const cleanedData = this.cleanDataForServer(item);
        await lastValueFrom(this.catalogsService.updateCatalog(item.originalId, cleanedData));
        item.__modified = false;
      }

      alerts.basicAlert(
        'Datos actualizados',
        'Los cambios se han guardado correctamente.',
        'success'
      );
      
      this.notSavedChanges = false;
      this.loadCatalogData(); // Recargar datos
      
    } catch (error) {
      console.error('Error al guardar:', error);
      alerts.basicAlert(
        'Error',
        'Ocurrió un error al guardar los datos. Por favor, intente nuevamente.',
        'error'
      );
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

  // Iniciar edición inline
  private startInlineEditing(rowId: string) {
    if (!this.gridApi) return;

    // Encontrar el nodo en el grid
    this.gridApi.forEachNode((node) => {
      if (node.data && node.data.originalId === rowId) {
        // Seleccionar la fila
        node.setSelected(true);
        // Iniciar edición en la columna de descripción
        this.gridApi.startEditingCell({
          rowIndex: node.rowIndex,
          colKey: 'description' // Usar la columna description directamente
        });
      }
    });
  }

  // Manejar eventos de teclado en edición
  onCellKeyPress(event: any) {
    if (!this.isInlineEditing) return;

    const keyCode = event.event.keyCode || event.event.which;
    
    // Enter (13) - Guardar
    if (keyCode === 13) {
      event.event.preventDefault();
      this.saveInlineEditing();
    }
    
    // Escape (27) - Cancelar
    if (keyCode === 27) {
      event.event.preventDefault();
      this.cancelInlineEditing();
    }
  }

  // Guardar edición inline
  private async saveInlineEditing() {
    if (!this.isInlineEditing || !this.currentEditingRowId) return;

    const editingRow = this.findRowById(this.currentEditingRowId);
    if (!editingRow) return;

    // Validar descripción
    if (!editingRow.description || editingRow.description.trim() === '') {
      alerts.basicAlert(
        'Campo requerido',
        'La descripción es obligatoria.',
        'warning'
      );
      return;
    }

    // Actualizar la jerarquía con la nueva descripción
    this.updateRowHierarchy(editingRow);

    try {
      // Guardar en servidor
      const cleanedData = this.cleanDataForServer(editingRow);
      const response = await lastValueFrom(this.catalogsService.addCatalog(cleanedData));
      
      if (response && response.id) {
        editingRow.id = response.id;
        editingRow.originalId = response.id;
      }
      
      editingRow.__isNew = false;
      editingRow.__isInlineEditing = false;
      
      alerts.basicAlert(
        'Elemento agregado',
        'El elemento se ha guardado correctamente.',
        'success'
      );

      // Finalizar edición
      this.finishInlineEditing();
      
      // Recargar datos completos
      this.loadCatalogData();
      
    } catch (error) {
      console.error('Error al guardar elemento:', error);
      alerts.basicAlert(
        'Error',
        'Ocurrió un error al guardar el elemento.',
        'error'
      );
    }
  }

  // Cancelar edición inline
  private cancelInlineEditing() {
    if (!this.isInlineEditing || !this.currentEditingRowId) return;

    // Remover el elemento temporal
    this.removeRowById(this.currentEditingRowId);
    
    // Finalizar edición
    this.finishInlineEditing();
    
    // Refrescar grid
    if (this.gridApi) {
      this.gridApi.setGridOption('rowData', this.flattenTreeData());
    }
  }

  // Finalizar edición inline
  private finishInlineEditing() {
    this.isInlineEditing = false;
    this.currentEditingRowId = null;
    
    // Detener cualquier edición activa
    if (this.gridApi) {
      this.gridApi.stopEditing();
    }
  }

  // Encontrar fila por ID
  private findRowById(rowId: string): any {
    const flatData = this.flattenTreeData();
    return flatData.find(row => row.originalId === rowId);
  }

  // Remover fila por ID
  private removeRowById(rowId: string) {
    // Remover de categorías de primer nivel
    this.treeData = this.treeData.filter(item => item.originalId !== rowId);
    
    // Remover de categorías hijas
    this.treeData.forEach(category => {
      if (category.children) {
        category.children = category.children.filter(family => family.originalId !== rowId);
        
        // Remover de subfamilias
        category.children.forEach(family => {
          if (family.children) {
            family.children = family.children.filter(subfamily => subfamily.originalId !== rowId);
          }
        });
      }
    });
  }

  // Actualizar jerarquía de la fila
  private updateRowHierarchy(row: any) {
    switch (row.nodeLevel) {
      case 'category':
        row.orgHierarchy = [row.description];
        break;
      case 'family':
        row.orgHierarchy = [row.orgHierarchy[0], row.description];
        break;
      case 'subfamily':
        row.orgHierarchy = [row.orgHierarchy[0], row.orgHierarchy[1], row.description];
        break;
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