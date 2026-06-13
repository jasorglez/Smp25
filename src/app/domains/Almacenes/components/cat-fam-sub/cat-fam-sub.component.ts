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
import { MaterialsService } from 'app/services/materials.service';

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
  private materialsService = inject(MaterialsService);

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
  // Datos del catálogo jerárquico
  treeData: any[] = [];
  flattenedData: any[] = []; // Datos aplanados para AG-Grid
  selectedRowData: any = null;
  selectedNodeLevel: 'category' | 'family' | 'subfamily' | null = null;
  selectedColumnContext: 'category' | 'family' | 'subfamily' | null = null; // Columna clickeada

  // Estado de expansión para persistir
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

  // Estado de expansión para persistir
  private expansionState: Map<string, { category: boolean, families: Map<string, boolean> }> = new Map();

  // Flag para evitar toggle durante doble click
  private isDoubleClicking = false;
  


  
  // ID de la empresa actual
  private idRoot = this.signalsService.getRootSelectedBySidebar()();

  // Cargar datos del catálogo (3 niveles)
  async loadCatalogData() {
    if (!this.idRoot) return;

    try {
      // Guardar estado de expansión antes de recargar
      this.saveExpansionState();

      // Cargar los 3 tipos de datos en paralelo
      const [categories, families, subfamilies] = await Promise.all([
        lastValueFrom(this.catalogsService.getCatalogs(this.idRoot, 'CATEGORY', true)),
        lastValueFrom(this.catalogsService.getCatalogs(this.idRoot, 'FAM-CAT', true)),
        lastValueFrom(this.catalogsService.getCatalogs(this.idRoot, 'SUB-FAM', true))
      ]);

      // Construir estructura jerárquica
      this.buildTreeStructure(categories, families, subfamilies);

      // Restaurar estado de expansión
      this.restoreExpansionState();

    } catch (error) {
      console.error('Error al cargar datos del catálogo:', error);
      this.treeData = [];
      this.updateFlattenedData();
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

    // Actualizar datos aplanados para el grid
    this.updateFlattenedData();
  }

  // Configuración del grid
  private _gridOptions: any = null;

  get gridOptions(): any {
    if (this._gridOptions) {
      return this._gridOptions;
    }

    this._gridOptions = {
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
      rowClassRules: {
        'catalog-inactive-row': (params: any) => params.data?.active === 0
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
      },
      onColumnPinned: (event: any) => {
        this.saveColumnState();
      },
      onColumnVisible: (event: any) => {
        this.saveColumnState();
      },
      onColumnMoved: (event: any) => {
        this.saveColumnState();
      },
      onColumnResized: (event: any) => {
        this.saveColumnState();
      }
    };

    return this._gridOptions;
  }

  // Definición de 3 columnas separadas con chevrons funcionales
  private _columnDefs: ColDef[] = [];

  get columnDefs(): ColDef[] {
    if (this._columnDefs.length > 0) {
      return this._columnDefs;
    }

    this._columnDefs = [
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
        tooltipValueGetter: (params: any) => {
          if (params.data.nodeLevel === 'category') {
            const desc = params.data.valueAddition;
            const abbr = params.data.valueAddition2;

            // Mostrar tooltip si alguno de los campos no es null/undefined/vacío
            if (!desc && !abbr) return null;

            let tooltip = `📁 ${params.data.description}\n\n`;

            if (desc) {
              tooltip += `📝 Descripción: ${desc}\n`;
            }
            if (abbr) {
              tooltip += `🔤 Abreviatura: ${abbr}`;
            }

            return tooltip;
          }
          return null;
        },
        onCellClicked: (event: any) => {
          if (this.isDoubleClicking) return;

          // Actualizar contexto de columna al hacer clic
          this.selectedColumnContext = 'category';

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
            const childCount = this.getSubfamilyCountForFamily(params.data.originalId);
            const isExpanded = params.data.isExpanded || false;
            const chevron = isExpanded ? '▼' : '▶';
            return `<span class="chevron-icon" data-action="toggle" style="cursor: pointer; margin-right: 5px; color: #2196f3; font-weight: bold;">${chevron}</span> ${params.data.description} (${childCount})`;
          }
          return '';
        },
        tooltipValueGetter: (params: any) => {
          if (params.data.nodeLevel === 'family') {
            const desc = params.data.valueAddition;
            const abbr = params.data.valueAddition2;

            // Mostrar tooltip si alguno de los campos no es null/undefined/vacío
            if (!desc && !abbr) return null;

            let tooltip = `📂 ${params.data.description}\n\n`;

            if (desc) {
              tooltip += `📝 Descripción: ${desc}\n`;
            }
            if (abbr) {
              tooltip += `🔤 Abreviatura: ${abbr}`;
            }

            return tooltip;
          }
          return null;
        },
        onCellClicked: (event: any) => {
          if (this.isDoubleClicking) return;

          // Actualizar contexto de columna al hacer clic
          this.selectedColumnContext = 'family';

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
        },
        tooltipValueGetter: (params: any) => {
          if (params.data.nodeLevel === 'subfamily') {
            const desc = params.data.valueAddition;
            const abbr = params.data.valueAddition2;

            // Mostrar tooltip si alguno de los campos no es null/undefined/vacío
            if (!desc && !abbr) return null;

            let tooltip = `📄 ${params.data.description}\n\n`;

            if (desc) {
              tooltip += `📝 Descripción: ${desc}\n`;
            }
            if (abbr) {
              tooltip += `🔤 Abreviatura: ${abbr}`;
            }

            return tooltip;
          }
          return null;
        },
        onCellClicked: () => {
          if (this.isDoubleClicking) return;

          // Actualizar contexto de columna al hacer clic
          this.selectedColumnContext = 'subfamily';
        }
      },
 
      {
        headerName: 'MATERIA PRIMA',
        field: 'valueAdditionBit',
        width: 210,
        editable: true,
        onCellClicked: (params: any) => {
          if (params.data.nodeLevel === 'subfamily') {
            this.openMaterialsModal(params.data);
          }
        }
      },
      {
        headerName: 'BIENES Y SERVICIOS',
        field: 'valueAdditionBit3',
        width: 210,
        editable: true,
      },
      {
        headerName: 'ARTICULOS Y SERVICIOS NUEVOS',
        field: 'esArticuloServicioNuevo',
        width: 250,
        editable: true,
        cellDataType: 'boolean',
      },
      {
        headerName: 'Requisiciones',
        field: 'valueAdditionBit2',
        width: 120,
        cellRenderer: (params: any) => {
          if (params.data.nodeLevel === 'subfamily') {
            const value = params.data.valueAdditionBit2 || false;
            const checked = value ? 'checked' : '';
            return `<input type="checkbox" ${checked} disabled style="cursor: pointer;">`;
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

    return this._columnDefs;
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
    if (event.colDef.field === 'valueAdditionBit') {
      this.catalogsService.updateValueBit(
        event.data.originalId,
        event.data.valueAdditionBit,
        "MATERIAL"
      ).subscribe({
        next: (result) => {
          if (result) {
            alerts.basicAlert(
              'Guardado exitoso',
              `Se han realizado los cambios correctamente.`,
              'success'
            );
          } else {
            alerts.basicAlert(
              'Error',
              'Error al guardar los cambios. Por favor, intente nuevamente.',
              'error'
            );
          }
        },
        error: (err) => {
          console.error("Error al actualizar el valor:", err);
        }
      });
    }

    if (event.colDef.field === 'valueAdditionBit3') {
      const newValue = event.data.valueAdditionBit3;
      const nodeLevel = event.data.nodeLevel;
      const nodesToUpdate: any[] = [event.data];

      // Cascada hacia abajo: categoria -> familias + subfamilias; familia -> subfamilias
      if (nodeLevel === 'category') {
        const categoryId = event.data.originalId;
        this.treeData.forEach(node => {
          if ((node.nodeLevel === 'family' || node.nodeLevel === 'subfamily')
              && node.parentCategoryId === categoryId) {
            node.valueAdditionBit3 = newValue;
            nodesToUpdate.push(node);
          }
        });
      } else if (nodeLevel === 'family') {
        const familyId = event.data.originalId;
        this.treeData.forEach(node => {
          if (node.nodeLevel === 'subfamily' && node.parentFamilyId === familyId) {
            node.valueAdditionBit3 = newValue;
            nodesToUpdate.push(node);
          }
        });
      }

      this.gridApi.refreshCells({ force: true });

      Promise.all(
        nodesToUpdate.map(node =>
          lastValueFrom(this.catalogsService.updateValueBit(node.originalId, newValue, "BIENESYSERVICIOS"))
        )
      ).then(() => {
        alerts.basicAlert(
          'Guardado exitoso',
          `Se han realizado los cambios correctamente.`,
          'success'
        );
      }).catch((err) => {
        console.error("Error al actualizar Bienes y Servicios:", err);
        alerts.basicAlert(
          'Error',
          'Error al guardar los cambios. Por favor, intente nuevamente.',
          'error'
        );
      });
    }

    if (event.colDef.field === 'esArticuloServicioNuevo') {
      const newValue = event.data.esArticuloServicioNuevo;
      const nodeLevel = event.data.nodeLevel;
      const nodesToUpdate: any[] = [event.data];

      // Cascada hacia abajo: categoria -> familias + subfamilias; familia -> subfamilias
      if (nodeLevel === 'category') {
        const categoryId = event.data.originalId;
        this.treeData.forEach(node => {
          if ((node.nodeLevel === 'family' || node.nodeLevel === 'subfamily')
              && node.parentCategoryId === categoryId) {
            node.esArticuloServicioNuevo = newValue;
            nodesToUpdate.push(node);
          }
        });
      } else if (nodeLevel === 'family') {
        const familyId = event.data.originalId;
        this.treeData.forEach(node => {
          if (node.nodeLevel === 'subfamily' && node.parentFamilyId === familyId) {
            node.esArticuloServicioNuevo = newValue;
            nodesToUpdate.push(node);
          }
        });
      }

      this.gridApi.refreshCells({ force: true });

      Promise.all(
        nodesToUpdate.map(node =>
          lastValueFrom(this.catalogsService.updateValueBit(node.originalId, newValue, "ARTICULOSNUEVOS"))
        )
      ).then(() => {
        alerts.basicAlert(
          'Guardado exitoso',
          `Se han realizado los cambios correctamente.`,
          'success'
        );
      }).catch((err) => {
        console.error("Error al actualizar Articulos y Servicios Nuevos:", err);
        alerts.basicAlert(
          'Error',
          'Error al guardar los cambios. Por favor, intente nuevamente.',
          'error'
        );
      });
    }

    // Si se cambió la columna vigente
    if (event.colDef.field === 'vigente') {
      const newValue = event.newValue;
      const nodeLevel = event.data.nodeLevel;

      // ==================== DESACTIVACIONES (cascada hacia abajo) ====================

      // 1. Si se desactiva una categoría, desactivar todas sus familias y subfamilias
      if (nodeLevel === 'category' && newValue === false) {
        const categoryId = event.data.originalId;

        this.treeData.forEach(node => {
          // Desactivar familias de esta categoría
          if (node.nodeLevel === 'family' && node.parentCategoryId === categoryId) {
            node.vigente = false;
            node.__modified = true;

            // Desactivar subfamilias de esta familia
            const familyId = node.originalId;
            this.treeData.forEach(subNode => {
              if (subNode.nodeLevel === 'subfamily' && subNode.parentFamilyId === familyId) {
                subNode.vigente = false;
                subNode.__modified = true;
              }
            });
          }
        });
      

        this.gridApi.refreshCells({ force: true });
      }

      // 2. Si se desactiva una familia, desactivar todas sus subfamilias
      if (nodeLevel === 'family' && newValue === false) {
        const familyId = event.data.originalId;

        this.treeData.forEach(node => {
          if (node.nodeLevel === 'subfamily' && node.parentFamilyId === familyId) {
            node.vigente = false;
            node.__modified = true;
          }
        });

        this.gridApi.refreshCells({ force: true });
      }

      // ==================== ACTIVACIONES ====================

      // 3. Si se activa una categoría, activar todas sus familias y subfamilias (cascada hacia abajo)
      if (nodeLevel === 'category' && newValue === true) {
        const categoryId = event.data.originalId;

        this.treeData.forEach(node => {
          // Activar familias de esta categoría
          if (node.nodeLevel === 'family' && node.parentCategoryId === categoryId) {
            node.vigente = true;
            node.__modified = true;

            // Activar subfamilias de esta familia
            const familyId = node.originalId;
            this.treeData.forEach(subNode => {
              if (subNode.nodeLevel === 'subfamily' && subNode.parentFamilyId === familyId) {
                subNode.vigente = true;
                subNode.__modified = true;
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

        // Activar categoría padre (hacia arriba)
        this.treeData.forEach(node => {
          if (node.nodeLevel === 'category' && node.originalId === categoryId) {
            node.vigente = true;
            node.__modified = true;
          }
        });

        // Activar subfamilias hijas (hacia abajo)
        this.treeData.forEach(node => {
          if (node.nodeLevel === 'subfamily' && node.parentFamilyId === familyId) {
            node.vigente = true;
            node.__modified = true;
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


        // Buscar la familia padre
        const familyNode = this.treeData.find(node =>
          node.nodeLevel === 'family' && node.originalId === familyId
        );

        if (familyNode) {
          const categoryId = familyNode.parentCategoryId;

          // Si TODAS las subfamilias están activas → activar familia padre
          if (activeCount === totalCount && newValue === true) {

            if (!familyNode.vigente) {
              familyNode.vigente = true;
              familyNode.__modified = true;
            }

            // Verificar si todas las familias de la categoría están activas
            const allFamilies = this.treeData.filter(node =>
              node.nodeLevel === 'family' && node.parentCategoryId === categoryId
            );
            const activeFamilies = allFamilies.filter(f => f.vigente === true).length;


            // Si TODAS las familias están activas → activar categoría
            if (activeFamilies === allFamilies.length) {

              this.treeData.forEach(node => {
                if (node.nodeLevel === 'category' && node.originalId === categoryId && !node.vigente) {
                  node.vigente = true;
                  node.__modified = true;
                }
              });
            }
          }

          // Si TODAS las subfamilias están desactivadas → desactivar familia padre
          if (activeCount === 0 && newValue === false) {

            if (familyNode.vigente) {
              familyNode.vigente = false;
              familyNode.__modified = true;
            }

            // Verificar si todas las familias de la categoría están desactivadas
            const allFamilies = this.treeData.filter(node =>
              node.nodeLevel === 'family' && node.parentCategoryId === categoryId
            );
            const inactiveFamilies = allFamilies.filter(f => f.vigente === false).length;


            // Si TODAS las familias están desactivadas → desactivar categoría
            if (inactiveFamilies === allFamilies.length) {

              this.treeData.forEach(node => {
                if (node.nodeLevel === 'category' && node.originalId === categoryId && node.vigente) {
                  node.vigente = false;
                  node.__modified = true;
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


        // Si TODAS las familias están activas → activar categoría padre
        if (activeCount === totalCount && newValue === true) {

          this.treeData.forEach(node => {
            if (node.nodeLevel === 'category' && node.originalId === categoryId && !node.vigente) {
              node.vigente = true;
              node.__modified = true;
            }
          });
        }

        // Si TODAS las familias están desactivadas → desactivar categoría padre
        if (activeCount === 0 && newValue === false) {

          this.treeData.forEach(node => {
            if (node.nodeLevel === 'category' && node.originalId === categoryId && node.vigente) {
              node.vigente = false;
              node.__modified = true;
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
      return;
    }


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

        // Limpiar el flag de modificado
        delete item.__modified;
      }

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
    // Cargar estado de columnas desde localStorage
    this.loadColumnState();
  }

  // Guardar estado de columnas (pin, orden, visibilidades) en localStorage
  private saveColumnState() {
    if (!this.gridApi) return;

    try {
      const columnState = this.gridApi.getColumnState();
      const localStorageKey = `catfam_sub_column_state_${this.idRoot}`;
      localStorage.setItem(localStorageKey, JSON.stringify(columnState));
    } catch (error) {
      console.error('Error guardando estado de columnas:', error);
    }
  }

  // Cargar estado de columnas desde localStorage
  private loadColumnState() {
    if (!this.gridApi) return;

    try {
      const localStorageKey = `catfam_sub_column_state_${this.idRoot}`;
      const savedState = localStorage.getItem(localStorageKey);

      if (savedState) {
        const columnState = JSON.parse(savedState);
        this.gridApi.applyColumnState({
          state: columnState,
          applyOrder: true
        });
      }
    } catch (error) {
      console.error('Error cargando estado de columnas:', error);
    }
  }

  // Agregar nuevo elemento según nivel seleccionado - Usar modales
  addCatalogItem() {
    if (!this.selectedRowData) {
      this.openAddCategoryModal(); // Si no hay selección, agregar categoría
      return;
    }

    // Lógica basada en el contexto de columna clickeada
    // Si hice clic en la columna de familia de una categoría → crear primera familia
    if (this.selectedColumnContext === 'family' && this.selectedNodeLevel === 'category') {
      this.openAddFamilyModal();
      return;
    }

    // Si hice clic en la columna de subfamilia de una familia → crear primera subfamilia
    if (this.selectedColumnContext === 'subfamily' && this.selectedNodeLevel === 'family') {
      this.openAddSubfamilyModal();
      return;
    }

    // Lógica por defecto: crear hermano del mismo nivel
    switch (this.selectedNodeLevel) {
      case 'category':
        // Crear una nueva categoría hermana
        this.openAddCategoryModal();
        break;
      case 'family':
        // Crear una nueva familia hermana (misma categoría padre)
        this.openAddFamilyModal();
        break;
      case 'subfamily':
        // Crear una nueva subfamilia hermana (misma familia padre)
        this.openAddSubfamilyModal();
        break;
      default:
        this.openAddCategoryModal();
    }
  }






  // Actualizar datos aplanados (llamar cada vez que treeData cambie)
  private updateFlattenedData(): void {
    this.flattenedData = this.treeData.filter(item => item.isVisible);
  }

  // Retornar datos filtrados por visibilidad para AG-Grid (deprecated - usar flattenedData)
  flattenTreeData(): any[] {
    return this.flattenedData;
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
      this.updateFlattenedData();
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
      this.updateFlattenedData();
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

    let cascadeWarning = '';
    if (this.selectedRowData.nodeLevel === 'category') {
      cascadeWarning = ' Se eliminarán también TODAS sus familias y subfamilias.';
    } else if (this.selectedRowData.nodeLevel === 'family') {
      cascadeWarning = ' Se eliminarán también TODAS sus subfamilias.';
    }

    const result = await alerts.confirmAlert(
      'Confirmar eliminación',
      `¿Está seguro de que desea eliminar "${this.selectedRowData.description}"?${cascadeWarning} Esta acción borrará el registro de la base de datos y NO se puede deshacer.`,
      'warning',
      'Sí, eliminar'
    );

    if (!result.isConfirmed) return;

    try {

      const res = await lastValueFrom(this.materialsService.catalogBymaterial(this.selectedRowData.originalId))
      
      if(res){
        alerts.basicAlert(
        'Error',
        'No se puede eliminar, este elemeto se encuentra cargado en un material',
        'error'
      );
      }else{
        const response = await lastValueFrom(this.catalogsService.deleteCatalog(this.selectedRowData.originalId));
        alerts.basicAlert(
        'Eliminado',
        'Elemento eliminado satisfactoriamente.',
        'success'
      );
      }

      

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

  // Obtener el nombre de la familia por ID
  getFamilyName(familyId: string | number): string {
    if (!this.treeData || !familyId) return 'N/A';

    const family = this.treeData.find(item =>
      item.nodeLevel === 'family' && item.originalId === familyId
    );

    return family?.description || 'N/A';
  }

  // ========== MÉTODOS PARA MODALES ==========
  
  // Abrir modal para nueva categoría
  openAddCategoryModal() {
    this.resetModalForm();
    this.showAddCategoryModal = true;
  }
  
  // Abrir modal para nueva familia
  openAddFamilyModal() {
    this.resetModalForm();
    this.showAddFamilyModal = true;
  }

  // Abrir modal para nueva subfamilia
  openAddSubfamilyModal() {
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

  // Verificar si una abreviatura ya existe en el mismo nivel
  private isAbbreviationDuplicated(abreviatura: string, nodeLevel: string, excludeId?: any): boolean {
    if (!abreviatura || !abreviatura.trim()) return false;
    const normalized = abreviatura.trim().toUpperCase();
    return this.treeData.some(item =>
      item.nodeLevel === nodeLevel &&
      item.valueAddition2 &&
      String(item.valueAddition2).trim().toUpperCase() === normalized &&
      (excludeId === undefined || item.originalId !== excludeId)
    );
  }

  // Guardar nueva categoría
  async saveNewCategory() {
    if (!this.modalForm.description.trim()) {
      alerts.basicAlert('Error', 'El nombre es obligatorio.', 'warning');
      return;
    }

    if (this.isAbbreviationDuplicated(this.modalForm.valueAddition2, 'category')) {
      alerts.basicAlert(
        'Abreviatura duplicada',
        `La abreviatura "${this.modalForm.valueAddition2.trim().toUpperCase()}" ya está registrada en otra categoría.`,
        'warning'
      );
      return;
    }

    const newCategory = this.cleanDataForServer({
      valueAddition: this.modalForm.valueAddition,
      description: this.modalForm.description,
      valueAddition2: this.modalForm.valueAddition2,
      valueAdditionBit: this.modalForm.valueAdditionBit,
      type: 'CATEGORY',
      active: this.modalForm.active ? 1 : 0
    });

    try {
      const response = await lastValueFrom(this.catalogsService.addCatalog(newCategory));
      
      // Guardar el ID seleccionado actualmente para restaurar después
      const selectedId = this.selectedRowData?.originalId;
      const selectedNodeLevel = this.selectedNodeLevel;
      
      this.closeModals();
      await this.loadCatalogData();
      
      // Mostrar alert Y LUEGO restaurar selección
      await alerts.basicAlert('Éxito', 'Categoría creada correctamente.', 'success');
      
      // Restaurar selección si había una
      if (selectedId) {
        this.restoreSelectionAfterReload(selectedId, selectedNodeLevel || 'category');
      }
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

    if (this.isAbbreviationDuplicated(this.modalForm.valueAddition2, 'family')) {
      alerts.basicAlert(
        'Abreviatura duplicada',
        `La abreviatura "${this.modalForm.valueAddition2.trim().toUpperCase()}" ya está registrada en otra familia.`,
        'warning'
      );
      return;
    }

    // Determinar el parentId según el nivel del elemento seleccionado
    let parentId: number;

    if (this.selectedNodeLevel === 'category') {
      // Si seleccioné una categoría (primera familia), usar su ID como padre
      parentId = this.selectedRowData.originalId;
    } else if (this.selectedNodeLevel === 'family') {
      // Si seleccioné una familia (hermana), usar su categoría padre
      parentId = this.selectedRowData.parentCategoryId;
    } else {
      alerts.basicAlert('Error', 'Seleccione una categoría o familia.', 'warning');
      return;
    }

    const newFamily = this.cleanDataForServer({
      valueAddition: this.modalForm.valueAddition,
      description: this.modalForm.description,
      valueAddition2: this.modalForm.valueAddition2,
      valueAdditionBit: this.modalForm.valueAdditionBit,
      type: 'FAM-CAT',
      parentId: parentId,
      active: this.modalForm.active ? 1 : 0
    });

    try {
      const response = await lastValueFrom(this.catalogsService.addCatalog(newFamily));
      
      // Guardar el ID seleccionado actualmente para restaurar después
      const selectedId = this.selectedRowData?.originalId;
      const selectedNodeLevel = this.selectedNodeLevel;
      
      this.closeModals();
      await this.loadCatalogData();
      
      // Mostrar alert Y LUEGO restaurar selección
      await alerts.basicAlert('Éxito', 'Familia creada correctamente.', 'success');
      
      // Restaurar selección si había una
      if (selectedId) {
        this.restoreSelectionAfterReload(selectedId, selectedNodeLevel || 'family');
      }
    } catch (error: any) {
      console.error('Error al crear familia:', error);
      const errorMsg = error?.error?.message || error?.message || 'Error desconocido';
      alerts.basicAlert('Error', `Error al crear la familia: ${errorMsg}`, 'error');
    }
  }
  
  // Guardar nueva subfamilia
  async saveNewSubfamily() {
    if (!this.modalForm.description.trim()) {
      alerts.basicAlert('Error', 'El nombre es obligatorio.', 'warning');
      return;
    }

    if (this.isAbbreviationDuplicated(this.modalForm.valueAddition2, 'subfamily')) {
      alerts.basicAlert(
        'Abreviatura duplicada',
        `La abreviatura "${this.modalForm.valueAddition2.trim().toUpperCase()}" ya está registrada en otra subfamilia.`,
        'warning'
      );
      return;
    }

    // Determinar el parentId y subParentId según el nivel del elemento seleccionado
    let parentId: number; // Categoría padre
    let subParentId: number; // Familia padre

    if (this.selectedNodeLevel === 'family') {
      // Si seleccioné una familia (primera subfamilia), usar sus IDs
      parentId = this.selectedRowData.parentCategoryId;
      subParentId = this.selectedRowData.originalId;
    } else if (this.selectedNodeLevel === 'subfamily') {
      // Si seleccioné una subfamilia (hermana), usar sus padres
      parentId = this.selectedRowData.parentCategoryId;
      subParentId = this.selectedRowData.parentFamilyId;
    } else {
      alerts.basicAlert('Error', 'Seleccione una familia o subfamilia.', 'warning');
      return;
    }

    const newSubfamily = this.cleanDataForServer({
      valueAddition: this.modalForm.valueAddition,
      description: this.modalForm.description,
      valueAddition2: this.modalForm.valueAddition2,
      valueAdditionBit: this.modalForm.valueAdditionBit,
      type: 'SUB-FAM',
      parentId: parentId,
      subParentId: subParentId,
      active: this.modalForm.active ? 1 : 0
    });

    try {
      const response = await lastValueFrom(this.catalogsService.addCatalog(newSubfamily));
      
      // Guardar el ID seleccionado actualmente para restaurar después
      const selectedId = this.selectedRowData?.originalId;
      const selectedNodeLevel = this.selectedNodeLevel;
      
      this.closeModals();
      await this.loadCatalogData();
      
      // Mostrar alert Y LUEGO restaurar selección
      await alerts.basicAlert('Éxito', 'Subfamilia creada correctamente.', 'success');
      
      // Restaurar selección si había una
      if (selectedId) {
        this.restoreSelectionAfterReload(selectedId, selectedNodeLevel || 'subfamily');
      }
    } catch (error: any) {
      console.error('Error al crear subfamilia:', error);
      const errorMsg = error?.error?.message || error?.message || 'Error desconocido';
      alerts.basicAlert('Error', `Error al crear la subfamilia: ${errorMsg}`, 'error');
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

    if (this.isAbbreviationDuplicated(this.modalForm.valueAddition2, this.editingItem.nodeLevel, this.editingItem.originalId)) {
      const levelLabel: Record<string, string> = { category: 'categoría', family: 'familia', subfamily: 'subfamilia' };
      const label = levelLabel[this.editingItem.nodeLevel] || 'registro';
      alerts.basicAlert(
        'Abreviatura duplicada',
        `La abreviatura "${this.modalForm.valueAddition2.trim().toUpperCase()}" ya está registrada en otra ${label}.`,
        'warning'
      );
      return;
    }

    // Guardar el ID del registro seleccionado para restaurarlo después
    const selectedId = this.editingItem.originalId;
    const selectedNodeLevel = this.editingItem.nodeLevel;

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
      const response = await lastValueFrom(this.catalogsService.updateCatalog(this.editingItem.originalId, updatedData));
      
      this.closeModals();
      
      // Recargar datos primero
      await this.loadCatalogData();
      
      // MOSTRAR EL ALERT Y LUEGO RESTAURAR SELECCIÓN
      await alerts.basicAlert('Éxito', 'Registro actualizado correctamente.', 'success');
      
      // Restaurar selección DESPUÉS de que el alert se cierre
      this.restoreSelectionAfterReload(selectedId, selectedNodeLevel);
    } catch (error: any) {
      console.error('Error al actualizar:', error);
      const errorMsg = error?.error?.message || error?.message || 'Error desconocido';
      alerts.basicAlert('Error', `Error al actualizar el registro: ${errorMsg}`, 'error');
    }
  }

  // Restaurar selección después de recargar datos
  private restoreSelectionAfterReload(selectedId: any, selectedNodeLevel: string) {
    if (!selectedId || !this.gridApi) return;

    // Buscar el nodo por ID original
    let targetNode = null;
    this.gridApi.forEachNode((node: any) => {
      if (node.data?.originalId === selectedId) {
        targetNode = node;
      }
    });

    if (targetNode) {
      // Seleccionar el nodo
      targetNode.setSelected(true);
      
      // Asegurar que sea visible haciendo scroll hacia él
      this.gridApi.ensureNodeVisible(targetNode, 'middle');
      
    } else {
      console.warn('⚠️ No se encontró el nodo para restaurar selección:', selectedId);
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

     return cleanData;
   }

   // Leer tabla DEPARTAMENT cuando se hace click en Materia Prima
   private loadDepartmentsForSubfamily(subfamilyData: any) {

     // Usar el servicio de catálogos para obtener departamentos
     this.catalogsService.getCatalogs(this.idRoot, 'DEPARTAMENT').subscribe({
       next: (departments: any[]) => {

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
    this.updateFlattenedData();
  }

  // Método para abrir el modal de materiales (placeholder)
  // TODO: Implementar la lógica del modal de materiales como se solicitó para proveedores.
  openMaterialsModal(subfamilyData: any) {
    this.loadDepartmentsForSubfamily(subfamilyData); // Reutilizando la lógica existente por ahora
  }
}
