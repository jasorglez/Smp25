import { Component, effect, HostListener, inject } from '@angular/core';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { alerts } from 'app/helpers/alerts';
import { AgGridModule } from 'ag-grid-angular';
import { TranslateModule } from '@ngx-translate/core';
import { TrackingService } from '../../../../services/tracking.service';
import { SharedModule } from 'app/shared/shared.module';
import { DomainsModule } from 'app/domains/domainsmodule';
import { RouterModule } from '@angular/router';
import { SignalsService } from 'app/services/signals.service';
import { CatalogsService } from 'app/services/catalogs.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { lastValueFrom } from 'rxjs';

@Component({
  selector: 'app-producto-terminado',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, AgGridModule],
  templateUrl: './producto-terminado.component.html',
  styleUrl: './producto-terminado.component.scss'
})
export class ProductoTerminadoComponent {


  
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
        'Acceso a Producto Terminado',
        'Almacenes - Materia Prima - Producto Terminado',
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
      valueAddition: '',
      description: '',
      valueAddition2: '',
      active: true,
      valueAdditionBit: false,
      valueAdditionBit2: false
    };
    
    // Datos para edición
    editingItem: any = null;
  
    // Datos del catálogo jerárquico
    treeData: any[] = [];
    selectedRowData: any = null;
    selectedNodeLevel: 'category' | 'family' | 'subfamily' | null = null;
  
    // Estado de expansión para persistir
    private expansionState: Map<string, { category: boolean, families: Map<string, boolean> }> = new Map();
  
    // Flag para evitar toggle durante doble click
    private isDoubleClicking = false;
    
  
  
    
    // ID de la empresa actual
    private idRoot = this.signalsService.getRootSelectedBySidebar()();
  
    // Cargar datos del catálogo (3 niveles)
    async loadCatalogData() {
      if (!this.idRoot) {
        console.warn('⚠️ No hay idRoot seleccionado');
        return;
      }

      try {
        console.log('🔄 Cargando datos de Producto Terminado...');
        console.log('📍 idRoot:', this.idRoot);

        // Guardar estado de expansión antes de recargar
        this.saveExpansionState();

        // Cargar los 3 tipos de datos en paralelo
        console.log('📡 Solicitando datos al API:');
        console.log('   - CATEGORY-PROD (Categorías)');
        console.log('   - PRESENT-PROD (Presentaciones)');
        console.log('   - NAME-PROD (Nombres)');

        const [categories, families, subfamilies] = await Promise.all([
          lastValueFrom(this.catalogsService.getCatalogs(this.idRoot, 'CATEGORY-PROD')),
          lastValueFrom(this.catalogsService.getCatalogs(this.idRoot, 'PRESENT-PROD')),
          lastValueFrom(this.catalogsService.getCatalogs(this.idRoot, 'NAME-PROD'))
        ]);

        console.log('✅ Datos recibidos:');
        console.log('   - Categorías:', categories?.length || 0);
        console.log('   - Presentaciones:', families?.length || 0);
        console.log('   - Nombres:', subfamilies?.length || 0);

        // Construir estructura jerárquica
        this.buildTreeStructure(categories, families, subfamilies);

        // Restaurar estado de expansión
        this.restoreExpansionState();

        console.log('✅ Catálogo cargado correctamente');

      } catch (error) {
        console.error('❌ Error al cargar datos del catálogo:', error);
        console.error('Detalles del error:', {
          message: error?.message,
          status: error?.status,
          statusText: error?.statusText,
          url: error?.url,
          error: error
        });

        this.treeData = [];
        alerts.basicAlert(
          'Error',
          `Error al cargar los datos del catálogo: ${error?.message || 'Error desconocido'}`,
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
          isExpanded: false, // Por defecto colapsado
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
            isExpanded: false, // Por defecto colapsado
            isVisible: false // Ocultas por defecto
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
              isVisible: false // Ocultas por defecto
            };
            this.treeData.push(subfamilyNode);
          });
        });
      });
    }
  
    // Configuración del grid
    get gridOptions(): any {
      return {
        headerHeight: 35,
        rowHeight: 28,
        animateRows: false, // Desactivar animaciones que pueden causar scroll inesperado
        treeData: false, // Cambiar a false para usar 3 columnas separadas
        // Grid en modo solo lectura - sin edición inline
        suppressClickEdit: true,
        singleClickEdit: false,
        stopEditingWhenCellsLoseFocus: true,
        suppressScrollOnNewData: true, // ⭐ Evitar scroll automático al actualizar datos
        // ⭐ Habilitar tooltips del navegador
        enableBrowserTooltips: true,
        tooltipShowDelay: 500, // Mostrar después de 500ms
        context: {
          componentParent: this
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
          if (event.data) {
            // Marcar que estamos en doble click para evitar toggle
            this.isDoubleClicking = true;
            this.openEditModal(event.data);
            // Resetear después de un breve momento
            setTimeout(() => {
              this.isDoubleClicking = false;
            }, 300);
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
              const description = params.data.description;
              const hasCounter = description.includes('(') && description.includes(')');
              const displayText = hasCounter ? description : `${description} (${this.getFamilyCountForCategory(params.data.originalId)})`;
  
              return `<span class="chevron-icon" data-action="toggle" style="cursor: pointer; margin-right: 5px; color: #2196f3; font-weight: bold;">${chevron}</span> ${displayText}`;
            }
            return '';
          },
          onCellClicked: (event: any) => {
            if (this.isDoubleClicking) return;
  
            if (event.event.target.classList.contains('chevron-icon') ||
                event.event.target.getAttribute('data-action') === 'toggle') {
              this.toggleCategoryExpansion(event.data);
            }
          }
        },
        {
          headerName: 'Presentación',
          field: 'familyDisplay',
          width: 300,
          cellRenderer: (params: any) => {
            if (params.data.nodeLevel === 'family') {
              const childCount = this.getSubfamilyCountForFamily(params.data.originalId);
              const isExpanded = params.data.isExpanded || false;
              const chevron = isExpanded ? '▼' : '▶';
              return `<span class="chevron-icon" data-action="toggle" style="cursor: pointer; margin-right: 5px; color: #2196f3; font-weight: bold;">${chevron}</span> ${params.data.description} (${childCount})`;
            }
            return '';
          },
          onCellClicked: (event: any) => {
            if (this.isDoubleClicking) return;
  
            if (event.event.target.classList.contains('chevron-icon') ||
                event.event.target.getAttribute('data-action') === 'toggle') {
              this.toggleFamilyExpansion(event.data);
            }
          }
        },
        {
          headerName: 'Nombre',
          field: 'subfamilyDisplay',
          width: 300,
          cellRenderer: (params: any) => {
            if (params.data.nodeLevel === 'subfamily') {
              return `<span style="margin-right: 15px;"></span> ${params.data.description}`;
            }
            return '';
          }
        },

        {
          headerName: 'Activo',
          field: 'vigente',
          width: 100,
          editable: true,
          cellRenderer: 'agCheckboxCellRenderer',
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
  
      // Si se cambió la columna vigente
      if (event.colDef.field === 'vigente') {
        const newValue = event.newValue;
        const nodeLevel = event.data.nodeLevel;
  
        // ==================== DESACTIVACIONES (cascada hacia abajo) ====================
  
        // 1. Si se desactiva una categoría, desactivar todas sus familias y subfamilias
        if (nodeLevel === 'category' && newValue === false) {
          const categoryId = event.data.originalId;
          console.log(`❌ Desactivando categoría ${categoryId} - cascada a familias y subfamilias`);
  
          this.treeData.forEach(node => {
            // Desactivar familias de esta categoría
            if (node.nodeLevel === 'family' && node.parentCategoryId === categoryId) {
              node.vigente = false;
              node.__modified = true;
              console.log(`  ❌ Familia desactivada: ${node.description}`);
  
              // Desactivar subfamilias de esta familia
              const familyId = node.originalId;
              this.treeData.forEach(subNode => {
                if (subNode.nodeLevel === 'subfamily' && subNode.parentFamilyId === familyId) {
                  subNode.vigente = false;
                  subNode.__modified = true;
                  console.log(`    ❌ Subfamilia desactivada: ${subNode.description}`);
                }
              });
            }
          });
  
          this.gridApi.refreshCells({ force: true });
        }
  
        // 2. Si se desactiva una familia, desactivar todas sus subfamilias
        if (nodeLevel === 'family' && newValue === false) {
          const familyId = event.data.originalId;
          console.log(`❌ Desactivando familia ${familyId} - cascada a subfamilias`);
  
          this.treeData.forEach(node => {
            if (node.nodeLevel === 'subfamily' && node.parentFamilyId === familyId) {
              node.vigente = false;
              node.__modified = true;
              console.log(`  ❌ Subfamilia desactivada: ${node.description}`);
            }
          });
  
          this.gridApi.refreshCells({ force: true });
        }
  
        // ==================== ACTIVACIONES ====================
  
        // 3. Si se activa una categoría, activar todas sus familias y subfamilias (cascada hacia abajo)
        if (nodeLevel === 'category' && newValue === true) {
          const categoryId = event.data.originalId;
          console.log(`✅ Activando categoría ${categoryId} - cascada a familias y subfamilias`);
  
          this.treeData.forEach(node => {
            // Activar familias de esta categoría
            if (node.nodeLevel === 'family' && node.parentCategoryId === categoryId) {
              node.vigente = true;
              node.__modified = true;
              console.log(`  ✅ Familia activada: ${node.description}`);
  
              // Activar subfamilias de esta familia
              const familyId = node.originalId;
              this.treeData.forEach(subNode => {
                if (subNode.nodeLevel === 'subfamily' && subNode.parentFamilyId === familyId) {
                  subNode.vigente = true;
                  subNode.__modified = true;
                  console.log(`    ✅ Subfamilia activada: ${subNode.description}`);
                }
              });
            }
          });
  
          this.gridApi.refreshCells({ force: true });
        }
  
        // 4. Si se activa una familia, activar su categoría padre y todas sus subfamilias
        if (nodeLevel === 'family' && newValue === true) {
          const familyId = event.data.originalId;
          const categoryId = event.data.parentCategoryId;
          console.log(`✅ Activando familia ${familyId} - activar categoría padre ${categoryId} y subfamilias hijas`);
  
          // Activar categoría padre (hacia arriba)
          this.treeData.forEach(node => {
            if (node.nodeLevel === 'category' && node.originalId === categoryId) {
              node.vigente = true;
              node.__modified = true;
              console.log(`  ✅ Categoría padre activada: ${node.description}`);
            }
          });
  
          // Activar subfamilias hijas (hacia abajo)
          this.treeData.forEach(node => {
            if (node.nodeLevel === 'subfamily' && node.parentFamilyId === familyId) {
              node.vigente = true;
              node.__modified = true;
              console.log(`  ✅ Subfamilia activada: ${node.description}`);
            }
          });
  
          this.gridApi.refreshCells({ force: true });
        }
  
        // 5. Si se cambia una subfamilia, verificar si activar/desactivar padre según hermanos
        if (nodeLevel === 'subfamily') {
          const familyId = event.data.parentFamilyId;
  
          // Buscar todas las subfamilias hermanas (misma familia padre)
          const allSubfamilies = this.treeData.filter(node =>
            node.nodeLevel === 'subfamily' && node.parentFamilyId === familyId
          );
  
          // Contar subfamilias activas
          const activeCount = allSubfamilies.filter(sf => sf.vigente === true).length;
          const totalCount = allSubfamilies.length;
  
          console.log(`📊 Subfamilia ${newValue ? 'activada' : 'desactivada'}: ${event.data.description}`);
          console.log(`   Subfamilias activas: ${activeCount}/${totalCount}`);
  
          // Buscar la familia padre
          const familyNode = this.treeData.find(node =>
            node.nodeLevel === 'family' && node.originalId === familyId
          );
  
          if (familyNode) {
            const categoryId = familyNode.parentCategoryId;
  
            // Si TODAS las subfamilias están activas → activar familia padre
            if (activeCount === totalCount && newValue === true) {
              console.log(`✅ Todas las subfamilias activas → activando familia padre`);
  
              if (!familyNode.vigente) {
                familyNode.vigente = true;
                familyNode.__modified = true;
                console.log(`  ✅ Familia activada: ${familyNode.description}`);
              }
  
              // Verificar si todas las familias de la categoría están activas
              const allFamilies = this.treeData.filter(node =>
                node.nodeLevel === 'family' && node.parentCategoryId === categoryId
              );
              const activeFamilies = allFamilies.filter(f => f.vigente === true).length;
  
              console.log(`   Familias activas: ${activeFamilies}/${allFamilies.length}`);
  
              // Si TODAS las familias están activas → activar categoría
              if (activeFamilies === allFamilies.length) {
                console.log(`✅ Todas las familias activas → activando categoría padre`);
  
                this.treeData.forEach(node => {
                  if (node.nodeLevel === 'category' && node.originalId === categoryId && !node.vigente) {
                    node.vigente = true;
                    node.__modified = true;
                    console.log(`  ✅ Categoría activada: ${node.description}`);
                  }
                });
              }
            }
  
            // Si TODAS las subfamilias están desactivadas → desactivar familia padre
            if (activeCount === 0 && newValue === false) {
              console.log(`❌ Todas las subfamilias desactivadas → desactivando familia padre`);
  
              if (familyNode.vigente) {
                familyNode.vigente = false;
                familyNode.__modified = true;
                console.log(`  ❌ Familia desactivada: ${familyNode.description}`);
              }
  
              // Verificar si todas las familias de la categoría están desactivadas
              const allFamilies = this.treeData.filter(node =>
                node.nodeLevel === 'family' && node.parentCategoryId === categoryId
              );
              const inactiveFamilies = allFamilies.filter(f => f.vigente === false).length;
  
              console.log(`   Familias desactivadas: ${inactiveFamilies}/${allFamilies.length}`);
  
              // Si TODAS las familias están desactivadas → desactivar categoría
              if (inactiveFamilies === allFamilies.length) {
                console.log(`❌ Todas las familias desactivadas → desactivando categoría padre`);
  
                this.treeData.forEach(node => {
                  if (node.nodeLevel === 'category' && node.originalId === categoryId && node.vigente) {
                    node.vigente = false;
                    node.__modified = true;
                    console.log(`  ❌ Categoría desactivada: ${node.description}`);
                  }
                });
              }
            }
          }
  
          this.gridApi.refreshCells({ force: true });
        }
  
        // 6. Si se cambia una familia, verificar si activar/desactivar categoría según hermanas
        if (nodeLevel === 'family') {
          const categoryId = event.data.parentCategoryId;
  
          // Buscar todas las familias hermanas (misma categoría padre)
          const allFamilies = this.treeData.filter(node =>
            node.nodeLevel === 'family' && node.parentCategoryId === categoryId
          );
  
          const activeCount = allFamilies.filter(f => f.vigente === true).length;
          const totalCount = allFamilies.length;
  
          console.log(`📊 Familia ${newValue ? 'activada' : 'desactivada'}: ${event.data.description}`);
          console.log(`   Familias activas: ${activeCount}/${totalCount}`);
  
          // Si TODAS las familias están activas → activar categoría padre
          if (activeCount === totalCount && newValue === true) {
            console.log(`✅ Todas las familias activas → activando categoría padre`);
  
            this.treeData.forEach(node => {
              if (node.nodeLevel === 'category' && node.originalId === categoryId && !node.vigente) {
                node.vigente = true;
                node.__modified = true;
                console.log(`  ✅ Categoría activada: ${node.description}`);
              }
            });
          }
  
          // Si TODAS las familias están desactivadas → desactivar categoría padre
          if (activeCount === 0 && newValue === false) {
            console.log(`❌ Todas las familias desactivadas → desactivando categoría padre`);
  
            this.treeData.forEach(node => {
              if (node.nodeLevel === 'category' && node.originalId === categoryId && node.vigente) {
                node.vigente = false;
                node.__modified = true;
                console.log(`  ❌ Categoría desactivada: ${node.description}`);
              }
            });
          }
        }
  
        // ==================== GUARDADO AUTOMÁTICO ====================
        // Guardar automáticamente todos los cambios en vigente
        this.saveVigenteChanges();
      }
  
      event.data.__modified = true;
      this.notSavedChanges = true;
    }
  
    // Guardar cambios de vigente automáticamente
    async saveVigenteChanges() {
      // Filtrar solo los elementos que tienen cambios en vigente
      const itemsToUpdate = this.treeData.filter(item => item.__modified);
  
      if (itemsToUpdate.length === 0) {
        console.log('No hay cambios de vigente para guardar');
        return;
      }
  
      console.log(`💾 Guardando ${itemsToUpdate.length} cambios de vigente...`);
  
      try {
        // Guardar cada elemento modificado
        for (const item of itemsToUpdate) {
          const updateData = {
            idCompany: item.idCompany,
            description: item.description,
            valueAddition: item.valueAddition || 'NA',
            valueAddition2: item.valueAddition2 || 'NA',
            valueAdditionBit: item.valueAdditionBit || false,
            valueAdditionBit2: item.valueAdditionBit2 || false,
            vigente: item.vigente,
            type: item.type,
            parentId: item.parentId || 0,
            subParentId: item.subParentId || 0,
            price: item.price || 0,
            active: item.active || 1
          };
  
          await lastValueFrom(this.catalogsService.updateCatalog(item.originalId, updateData));
          console.log(`  ✅ Guardado: ${item.description} (vigente: ${item.vigente})`);
  
          // Limpiar el flag de modificado
          delete item.__modified;
        }
  
        console.log('✅ Todos los cambios de vigente se guardaron correctamente');
        this.notSavedChanges = false;
  
        // Recargar datos para asegurar consistencia
        await this.loadCatalogData();
  
        // Mostrar mensaje de éxito
        alerts.basicAlert(
          'Guardado exitoso',
          `Se han realizado los cambios correctamente.`,
          'success'
        );
  
      } catch (error) {
        console.error('❌ Error al guardar cambios de vigente:', error);
        alerts.basicAlert(
          'Error',
          'Error al guardar los cambios. Por favor, intente nuevamente.',
          'error'
        );
      }
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
            'No se pueden agregar elementos debajo de un nombre de producto.',
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
      
      // Contar cuántas familias tienen parentCategoryId igual al categoryId
      return this.treeData.filter(item => 
        item.nodeLevel === 'family' && item.parentCategoryId === categoryId
      ).length;
    }
    
    // Contar subfamilias de una familia
    private getSubfamilyCountForFamily(familyId: string | number): number {
      if (!this.treeData || !familyId) return 0;

      // Contar cuántas subfamilias tienen parentFamilyId igual al familyId
      return this.treeData.filter(item =>
        item.nodeLevel === 'subfamily' && item.parentFamilyId === familyId
      ).length;
    }

    // Obtener el nombre de la categoría por ID
    getCategoryName(categoryId: string | number): string {
      if (!this.treeData || !categoryId) return 'N/A';

      const category = this.treeData.find(item =>
        item.nodeLevel === 'category' && item.originalId === categoryId
      );

      return category?.description || 'N/A';
    }

    // ========== MÉTODOS PARA MODALES ==========
    
    // Abrir modal para nueva categoría
    openAddCategoryModal() {
      this.resetModalForm();
      this.showAddCategoryModal = true;
    }
    
    // Abrir modal para nueva presentación
    openAddFamilyModal() {
      if (!this.selectedRowData || this.selectedNodeLevel !== 'category') {
        alerts.basicAlert('Error', 'Seleccione una categoría para agregar una presentación.', 'warning');
        return;
      }
      this.resetModalForm();
      this.showAddFamilyModal = true;
    }

    // Abrir modal para nuevo nombre
    openAddSubfamilyModal() {
      if (!this.selectedRowData || this.selectedNodeLevel !== 'family') {
        alerts.basicAlert('Error', 'Seleccione una presentación para agregar un nombre.', 'warning');
        return;
      }
      this.resetModalForm();
      this.showAddSubfamilyModal = true;
    }
    
    // Abrir modal de edición
    openEditModal(item: any) {
      this.editingItem = { ...item };
      this.modalForm.valueAddition = item.valueAddition || '';
      this.modalForm.description = item.description || '';
      this.modalForm.valueAddition2 = item.valueAddition2 || '';
      this.modalForm.active = item.active === 1;
      this.modalForm.valueAdditionBit = item.valueAdditionBit || false;
      this.modalForm.valueAdditionBit2 = item.valueAdditionBit2 || false;
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
        valueAddition: '',
        description: '',
        valueAddition2: '',
        active: true,
        valueAdditionBit: false,
        valueAdditionBit2: false
      };
    }
  
    // Convertir a mayúsculas mientras se escribe
    toUpperCase(event: any, field: 'description' | 'valueAddition' | 'valueAddition2') {
      const input = event.target as HTMLInputElement;
      const start = input.selectionStart;
      const end = input.selectionEnd;
  
      // Convertir a mayúsculas
      this.modalForm[field] = input.value.toUpperCase();
  
      // Restaurar la posición del cursor
      setTimeout(() => {
        input.setSelectionRange(start, end);
      }, 0);
    }
  
    // Guardar nueva categoría
    async saveNewCategory() {
      if (!this.modalForm.description.trim()) {
        alerts.basicAlert('Error', 'El nombre es obligatorio.', 'warning');
        return;
      }
  
      const newCategory = this.cleanDataForServer({
        valueAddition: this.modalForm.valueAddition,
        description: this.modalForm.description,
        valueAddition2: this.modalForm.valueAddition2,
        type: 'CATEGORY-PROD',
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
        alerts.basicAlert('Error', 'El nombre es obligatorio.', 'warning');
        return;
      }
  
      const newFamily = this.cleanDataForServer({
        valueAddition: this.modalForm.valueAddition,
        description: this.modalForm.description,
        valueAddition2: this.modalForm.valueAddition2,
        type: 'PRESENT-PROD',
        parentId: this.selectedRowData.originalId,
        active: this.modalForm.active ? 1 : 0
      });
  
      try {
        const response = await lastValueFrom(this.catalogsService.addCatalog(newFamily));
        console.log('Respuesta del servidor (nueva presentación):', response);
        alerts.basicAlert('Éxito', 'Presentación creada correctamente.', 'success');
        this.closeModals();
        this.loadCatalogData();
      } catch (error: any) {
        console.error('Error al crear presentación:', error);
        const errorMsg = error?.error?.message || error?.message || 'Error desconocido';
        alerts.basicAlert('Error', `Error al crear la presentación: ${errorMsg}`, 'error');
      }
    }

    // Guardar nuevo nombre
    async saveNewSubfamily() {
      if (!this.modalForm.description.trim()) {
        alerts.basicAlert('Error', 'El nombre es obligatorio.', 'warning');
        return;
      }

      const newSubfamily = this.cleanDataForServer({
        valueAddition: this.modalForm.valueAddition,
        description: this.modalForm.description,
        valueAddition2: this.modalForm.valueAddition2,
        type: 'NAME-PROD',
        parentId: this.selectedRowData.parentCategoryId,
        subParentId: this.selectedRowData.originalId,
        active: this.modalForm.active ? 1 : 0
      });

      try {
        const response = await lastValueFrom(this.catalogsService.addCatalog(newSubfamily));
        console.log('Respuesta del servidor (nuevo nombre):', response);
        alerts.basicAlert('Éxito', 'Nombre creado correctamente.', 'success');
        this.closeModals();
        this.loadCatalogData();
      } catch (error: any) {
        console.error('Error al crear nombre:', error);
        const errorMsg = error?.error?.message || error?.message || 'Error desconocido';
        alerts.basicAlert('Error', `Error al crear el nombre: ${errorMsg}`, 'error');
      }
    }
    
    // Guardar cambios en edición
    async saveEditChanges() {
      if (!this.modalForm.description.trim()) {
        alerts.basicAlert('Error', 'El nombre es obligatorio.', 'warning');
        return;
      }
  
      if (!this.editingItem?.originalId) {
        alerts.basicAlert('Error', 'No se puede identificar el registro a actualizar.', 'error');
        return;
      }
  
      const updatedData = this.cleanDataForServer({
        valueAddition: this.modalForm.valueAddition,
        description: this.modalForm.description,
        valueAddition2: this.modalForm.valueAddition2,
        valueAdditionBit: this.modalForm.valueAdditionBit,
        valueAdditionBit2: this.modalForm.valueAdditionBit2,
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
         valueAdditionBit2: Boolean(data.valueAdditionBit2 || false),
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
  
     // Leer tabla DEPARTAMENT cuando se hace click en Materia Prima
     private loadDepartmentsForSubfamily(subfamilyData: any) {
       console.log('Cargando departamentos para subfamilia:', subfamilyData);
  
       // Usar el servicio de catálogos para obtener departamentos
       this.catalogsService.getCatalogs(this.idRoot, 'DEPARTAMENT').subscribe({
         next: (departments: any[]) => {
           console.log('Departamentos obtenidos:', departments);
  
           // Aquí puedes mostrar los departamentos en un modal, alert, o navegar a otra vista
           if (departments && departments.length > 0) {
             const departmentNames = departments.map(d => d.description).join(', ');
             alerts.basicAlert(
               'Departamentos',
               `Departamentos asociados a la subfamilia "${subfamilyData.description}": ${departmentNames}`,
               'info'
             );
           } else {
             alerts.basicAlert(
               'Sin Departamentos',
               `No hay departamentos asociados a la subfamilia "${subfamilyData.description}"`,
               'warning'
             );
           }
         },
         error: (error) => {
           console.error('Error al cargar departamentos:', error);
           alerts.basicAlert(
             'Error',
             'Error al cargar los departamentos',
             'error'
           );
         }
       });
     }
  
    // Guardar estado de expansión actual
    private saveExpansionState() {
      this.expansionState.clear();
  
      this.treeData.forEach(item => {
        if (item.nodeLevel === 'category') {
          const familiesMap = new Map<string, boolean>();
  
          // Guardar estado de familias de esta categoría
          this.treeData.forEach(family => {
            if (family.nodeLevel === 'family' && family.parentCategoryId === item.originalId) {
              familiesMap.set(String(family.originalId), family.isExpanded || false);
            }
          });
  
          this.expansionState.set(String(item.originalId), {
            category: item.isExpanded || false,
            families: familiesMap
          });
        }
      });
    }
  
    // Restaurar estado de expansión después de reconstruir
    private restoreExpansionState() {
      if (this.expansionState.size === 0) return;
  
      this.treeData.forEach(item => {
        if (item.nodeLevel === 'category') {
          const state = this.expansionState.get(String(item.originalId));
          if (state) {
            item.isExpanded = state.category;
  
            // Mostrar/ocultar familias según estado guardado
            this.treeData.forEach(family => {
              if (family.nodeLevel === 'family' && family.parentCategoryId === item.originalId) {
                family.isVisible = state.category;
  
                // Restaurar estado de expansión de la familia
                const familyExpanded = state.families.get(String(family.originalId));
                if (familyExpanded !== undefined) {
                  family.isExpanded = familyExpanded;
  
                  // Mostrar/ocultar subfamilias según estado de familia
                  if (family.isVisible) {
                    this.treeData.forEach(subfamily => {
                      if (subfamily.nodeLevel === 'subfamily' && subfamily.parentFamilyId === family.originalId) {
                        subfamily.isVisible = familyExpanded;
                      }
                    });
                  }
                }
              }
            });
          }
        }
      });
  
      // Refrescar grid
      if (this.gridApi) {
        this.gridApi.setGridOption('rowData', this.flattenTreeData());
      }
    }
  }



