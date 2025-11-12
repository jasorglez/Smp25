import { Component, OnInit, OnDestroy, inject, effect } from '@angular/core';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { AgGridModule } from 'ag-grid-angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { alerts } from 'app/helpers/alerts';
import { DetailCellRendererProveedoresComponent } from './details/detail-cell-renderer-proveedores.component';
import { DetailCellRendererFamiliaComponent } from './details/detail-cell-renderer-familia.component';
import { DetailCellRendererSucursalComponent } from './details/detail-cell-renderer-sucursal.component';
import { DetailCellRendererCostosComponent } from './details/detail-cell-renderer-costos.component';
import { DetailCellRendererSubfamiliaComponent } from './details/detail-cell-renderer-subfamilia.component';
import { DetailCellRendererProveedorSucursalComponent } from './details/detail-cell-renderer-proveedor-sucursal.component';
import { SelectWithTooltipEditorV2Component } from './editors/select-with-tooltip-editor-v2.component';
import { ImageCellRendererComponent } from './renderers/image-cell-renderer.component';
import { MaterialsService } from 'app/services/materials.service';
import { MaterialsResponse } from 'app/interface/materials.interface';
import { SignalsService } from 'app/services/signals.service';
import { CatalogsService } from 'app/services/catalogs.service';
import { ProvidersService } from 'app/services/providers.service';
import { CustomersService } from 'app/services/customers.service';
import { BranchsService } from 'app/services/branchs.service';
import { lastValueFrom, Subscription } from 'rxjs';
import { environment } from '@env/environment';
import { SubfamiliaModalService, ModalData } from './services/subfamilia-modal.service';

@Component({
  selector: 'app-materiales-maestro',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AgGridModule,
    DetailCellRendererProveedoresComponent,
    DetailCellRendererFamiliaComponent,
    DetailCellRendererSucursalComponent,
    DetailCellRendererCostosComponent,
    DetailCellRendererSubfamiliaComponent,
    DetailCellRendererProveedorSucursalComponent,
    SelectWithTooltipEditorV2Component,
    ImageCellRendererComponent
  ],
  templateUrl: './materiales-maestro.component.html',
  styleUrl: './materiales-maestro.component.scss'
})
export class MaterialesMaestroComponent implements OnInit, OnDestroy {

  private gridApi!: GridApi;
  private materialsService = inject(MaterialsService);
  private signalsService = inject(SignalsService);
  private catalogsService = inject(CatalogsService);
  private providersService = inject(ProvidersService);
  private customersService = inject(CustomersService);
  private branchsService = inject(BranchsService);
  private subfamiliaModalService = inject(SubfamiliaModalService);

  rowData: any[] = [];
  allMaterialsData: MaterialsResponse[] = []; // Guarda todos los datos
  gridHeight: string = '80vh';
  selectedMaterial: MaterialsResponse | null = null;
  hasUnsavedChanges: boolean = false;
  idRoot: number | null = null;
  newlyAddedRows: string[] = [];
  private tempIdCounter: number = 0;

  // Catálogos para los combos
  categories: any[] = [];
  families: any[] = [];
  subfamilies: any[] = [];

  // Modal de subfamilias
  private modalSubscription?: Subscription;
  showModal = false;
  modalType: 'subfamilia' | 'flavor' | 'presentation' = 'subfamilia';
  modalMode: 'add' | 'edit' = 'add';
  modalData: ModalData | null = null;
  modalForm = {
    description: '',
    active: true
  };

  // Modal de imagen
  showImageModal = false;
  selectedImageUrl = '';

  // Modal de agregar/editar material
  showMaterialModal = false;
  materialModalMode: 'add' | 'edit' = 'add';
  materialForm = {
    insumo: '',
    articulo: '',
    idCategory: 0,
    idFamilia: 0,
    picture: '',
    active: true
  };
  selectedImageFile: File | null = null;
  previewImageUrl: string = '';


  // Datos de proveedores por material
  materialsXTableData: { [key: number]: any[] } = {};

  public rowSelection: 'single' | 'multiple' = 'single';
  public paginationPageSize = 15;
  public paginationPageSizeSelector: number[] | boolean = [15, 50, 100];
  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  constructor() {
    effect(() => {
      this.idRoot = this.signalsService.getRootSelectedBySidebar()();
      if (this.idRoot) {
        this.loadCatalogs();
        this.loadMaterials();
        // Actualizar el contexto del grid cuando cambia idRoot
        this.updateGridContext();
      }
    });
  }

  ngOnInit() {
    if (this.idRoot) {
      this.loadCatalogs();
      this.loadMaterials();
    }

    // Suscribirse a las solicitudes de modal del servicio
    this.modalSubscription = this.subfamiliaModalService.modalRequest$.subscribe(data => {
      console.log('🔔 MaterialesMaestro - Recibida solicitud de modal:', data);
      this.handleModalRequest(data);
    });
  }

  ngOnDestroy() {
    if (this.modalSubscription) {
      this.modalSubscription.unsubscribe();
    }
  }

  async loadCatalogs() {
    if (!this.idRoot) return;

    try {
      // Cargar categorías, familias y subfamilias en paralelo
      [this.categories, this.families, this.subfamilies] = await Promise.all([
        lastValueFrom(this.catalogsService.getCatalogsMaterialBit(this.idRoot, 'CATEGORY')),
        lastValueFrom(this.catalogsService.getCatalogsMaterialBit(this.idRoot, 'FAM-CAT')),
        lastValueFrom(this.catalogsService.getCatalogsMaterialBit(this.idRoot, 'SUB-FAM'))
      ]);

      console.log('Catalogs loaded:', {
        categories: this.categories,
        families: this.families,
        subfamilies: this.subfamilies
      });
    } catch (error) {
      console.error('Error loading catalogs:', error);
    }
  }
  
  // Obtener familias de una categoría específica
  getFamiliesByCategory(categoryId: number): any[] {
    return this.families.filter(f => f.parentId === categoryId );
  }

  // Obtener subfamilias de una familia específica
  getSubfamiliesByFamily(familyId: number): any[] {
    if (!familyId) return [];
    return this.subfamilies.filter(sf => sf.subParentId === familyId);
  }

  loadMaterials() {
    if (!this.idRoot) {
      console.warn('No idRoot available');
      return;
    }

    this.materialsService.getMaterialsxview(this.idRoot).subscribe({
      next: (data) => {
        // Agregar datos falsos para la columna de costos
        this.rowData = data.map(material => ({
          ...material,
          costo: Math.floor(Math.random() * (500 - 50 + 1)) + 50 // Costo aleatorio entre 50 y 500
        }));
        console.log('Materials loaded:', data);
      },
      error: (error) => {
        console.error('Error loading materials:', error);
        alerts.basicAlert('Error', 'Error al cargar materiales', 'error');
      }
    });
  }


  components = {
    detailCellRendererProveedores: DetailCellRendererProveedoresComponent,
    detailCellRendererFamilia: DetailCellRendererFamiliaComponent,
    detailCellRendererSucursal: DetailCellRendererSucursalComponent,
    detailCellRendererCostos: DetailCellRendererCostosComponent,
    detailCellRendererSubfamilia: DetailCellRendererSubfamiliaComponent,
    detailCellRendererProveedorSucursal: DetailCellRendererProveedorSucursalComponent
  };

  public gridOptions: any = {
    headerHeight: 35,
    rowHeight: 35,
    animateRows: true,
    suppressClickEdit: false,
    singleClickEdit: false,
    stopEditingWhenCellsLoseFocus: true,
    masterDetail: true,
    detailRowHeight: 600, // Altura del detail row para subfamilias (ajustable)
    isRowMaster: (dataItem: any) => {
      return true; // Todas las filas son maestras
    },
    detailCellRendererSelector: (params: any) => {
      if (params.data.detailType === 'proveedores') {
        return { component: 'detailCellRendererProveedores' };
      } else if (params.data.detailType === 'familia') {
        return { component: 'detailCellRendererFamilia' };
      } else if (params.data.detailType === 'sucursal') {
        return { component: 'detailCellRendererSucursal' };
      } else if (params.data.detailType === 'subfamilia') {
        return { component: 'detailCellRendererSubfamilia' };
      } else if (params.data.detailType === 'costos') {
        return { component: 'detailCellRendererCostos' };
      }
      return undefined;
    },
    getRowClass: (params: any) => {
      if (params.node.isSelected()) {
        return 'selected-row';
      }
      if (params.data.__isNew) {
        return 'new-row-highlight';
      }
      if (params.data.__modified) {
        return 'modified-row';
      }
      return '';
    },
    onRowSelected: (event: any) => {
      if (event.node.isSelected()) {
        this.gridApi.forEachNode((node) => {
          if (node.id !== event.node.id) {
            node.setSelected(false);
          }
        });
      }
    },
    onCellValueChanged: (event: any) => {
      console.log('Cell value changed:', event);

      // Convertir vigente a true/false (nunca NULL)
      if (event.colDef.field === 'vigente') {
        event.data.vigente = event.newValue === true || event.newValue === 1 ? true : false;
        console.log('Vigente changed to:', event.data.vigente);
      }

      event.data.__modified = true;
      this.hasUnsavedChanges = true;
      // Envolver en setTimeout para evitar conflictos de renderizado
      setTimeout(() => {
        this.gridApi.refreshCells({ rowNodes: [event.node], force: true });
      }, 0);
    }
  };

  get colMaster(): ColDef[] {
    return [
      {
        field: 'vigente',
        headerName: 'Activo',
        width: 100,
        editable: true,
        cellRenderer: 'agCheckboxCellRenderer',
        cellEditor: 'agCheckboxCellEditor'
      },
      {
        field: 'insumo',
        headerName: 'Num Mat',
        width: 130,
        filter: true,
        editable: true
      },
      {
        field: 'articulo',
        headerName: 'Artículo',
        width: 250,
        filter: true,
        editable: true
      },
      {
        field: 'idCategory',
        headerName: 'Categoria',
        width: 250,
        editable: true,
        cellEditor: SelectWithTooltipEditorV2Component,
        cellEditorParams: {
          options: this.categories.map(c => ({
            id: c.id,
            description: c.description,
            valueAddition: c.valueAddition,
            valueAddition2: c.valueAddition2,
            valueAdditionBit: c.valueAdditionBit
          }))
        },
        valueFormatter: (params: any) => {
          const cat = this.categories.find(c => c.id === params.value);
          return cat ? cat.description : params.data.categoria || '';
        },
        onCellValueChanged: (params: any) => {
          // Cuando cambia la categoría, resetear familia y subfamilia
          params.data.idFamilia = null;
          params.data.familia = '';
          params.data.idSubfamilia = null;
          params.data.subfamilia = '';
          this.hasUnsavedChanges = true;
          // Refrescar la fila para actualizar el combo de familia usando setTimeout
          setTimeout(() => {
            params.api.refreshCells({ rowNodes: [params.node], force: true });
          }, 0);
        }
      },
      {
        field: 'idFamilia',
        headerName: 'Familia',
        width: 200,
        editable: (params: any) => {
          // Solo editable si hay una categoría seleccionada
          return params.data.idCategory != null;
        },
        cellEditor: SelectWithTooltipEditorV2Component,
        cellEditorParams: (params: any) => ({
            getOptions: () => {
              const familiesFiltered = this.getFamiliesByCategory(params.data.idCategory);
              return familiesFiltered.map(f => ({
                id: f.id,
                description: f.description,
                valueAddition: f.valueAddition,
                valueAddition2: f.valueAddition2
              }));
            }
        }),
        valueFormatter: (params: any) => {
          const fam = this.families.find(f => f.id === params.value);
          return fam ? fam.description : params.data.familia || '';
        },
        onCellValueChanged: (params: any) => {
          // Cuando cambia la familia, resetear subfamilia
          params.data.idSubfamilia = null;
          params.data.subfamilia = '';
          this.hasUnsavedChanges = true;
          setTimeout(() => {
            params.api.refreshCells({ rowNodes: [params.node], force: true });
          }, 0);
        },
        cellStyle: (params: any) => {
          if (!params.data.idCategory) {
            return { backgroundColor: '#f0f0f0', color: '#999' };
          }
          return null;
        }
      },
      {
        field: 'idSubfamilia',
        headerName: 'Subfamilia',
        width: 200,
        editable: (params: any) => {
          // Solo editable si hay una familia seleccionada
          return params.data.idFamilia != null;
        },
        cellEditor: SelectWithTooltipEditorV2Component,
        cellEditorParams: (params: any) => ({
            getOptions: () => {
              const subfamiliesFiltered = this.getSubfamiliesByFamily(params.data.idFamilia);
              return subfamiliesFiltered.map(sf => ({
                id: sf.id,
                description: sf.description,
                valueAddition: sf.valueAddition,
                valueAddition2: sf.valueAddition2
              }));
            }
        }),
        valueFormatter: (params: any) => {
          const sf = this.subfamilies.find(sf => sf.id === params.value);
          return sf ? sf.description : params.data.subfamilia || '';
        },
        onCellValueChanged: (params: any) => {
          this.hasUnsavedChanges = true;
          setTimeout(() => {
            params.api.refreshCells({ rowNodes: [params.node], force: true });
          }, 0);
        },
        cellStyle: (params: any) => {
          if (!params.data.idFamilia) {
            return { backgroundColor: '#f0f0f0', color: '#999' };
          }
          return null;
        }
      },

      {
        field: 'costo',
        headerName: 'Materiales',
        width: 150,
        valueFormatter: (params: any) => {
          return params.value ? `$${params.value.toFixed(2)}` : '$0.00';
        },
        cellRenderer: (params: any) => {
          // Este renderer es necesario para que el clic funcione igual que en las otras columnas de detalle.
          // Muestra el valor formateado.
          return params.value ? `$${params.value.toFixed(2)}` : '$0.00';
        },
        cellStyle: { backgroundColor: '#e8f5e9', cursor: 'pointer', textDecoration: 'underline' }
      },
      
      {
        field: 'subfamilyCount',
        headerName: 'Donde Usa',
        width: 150,
        cellRenderer: (params: any) => {
          const count = params.value || 0;
          return count;
        },
        cellStyle: { backgroundColor: '#fff3e0', cursor: 'pointer', textDecoration: 'underline' }
      },
      {
        field: 'providerCount',
        headerName: 'Proveedor',
        width: 120,
        cellRenderer: (params: any) => {
          return params.value || 0;
        },
        cellStyle: { backgroundColor: '#e3f2fd', cursor: 'pointer', textDecoration: 'underline' }
      },
 
      {
        field: 'picture',
        headerName: 'Imagen',
        width: 150,
        cellRenderer: ImageCellRendererComponent,
        cellRendererParams: {
          context: {
            componentParent: this
          }
        }
      }
    ];
  }

  // Función auxiliar para obtener el tipo de detalle desde el ID de la columna
  getDetailTypeFromColId(colId: string): string | null {
    if (colId === 'providerCount') return 'proveedores';
    if (colId === 'subfamilyCount') return 'subfamilia';
    if (colId === 'costo') return 'costos';
    return null;
  }

  createDetailToggleCellRenderer(detailType: string): (params: any) => HTMLElement {
    return (params: any): HTMLElement => {
      const div = document.createElement('div');

      switch (detailType) {
        case 'proveedores':
          div.innerText = params.value || '';
          break;
        case 'subfamilia':
          div.innerText = params.value || '';
          break;
      }

      div.style.cursor = 'pointer';
      div.style.textDecoration = 'underline';

      return div;
    };
  }

  onCellClicked(event: any): void {
    event.node.setSelected(true);

    const colId = event.column.getColId();
    const isDetailColumn = colId === 'providerCount' || colId === 'subfamilyCount' || colId === 'costo';

    if (isDetailColumn) {
      const node = event.node;
      const api = event.api;
      const detailType = this.getDetailTypeFromColId(colId);

      // Determinar si la fila actual ya está expandida CON ESTE MISMO tipo de detalle
      const isCurrentlyExpanded = node.expanded && event.data.detailType === detailType;

      if (isCurrentlyExpanded) {
        // Si ya está expandido, colapsarlo y mostrar todas las filas
        node.setExpanded(false);

        // Mostrar todas las filas de nuevo
        api.forEachNode((otherNode: any) => {
          otherNode.setRowHeight(undefined);
        });
        api.onRowHeightChanged();
      } else {
        // Colapsar cualquier otra fila expandida
        api.forEachNode((otherNode: any) => {
          if (otherNode.expanded && otherNode.id !== node.id) {
            otherNode.setExpanded(false);
          }
        });

        // Ocultar todas las demás filas (altura 0)
        api.forEachNode((otherNode: any) => {
          if (otherNode.id !== node.id) {
            otherNode.setRowHeight(0);
          }
        });

        // Si la fila está expandida con otro tipo de detalle, cerrarla primero
        if (node.expanded && event.data.detailType !== detailType) {
          node.setExpanded(false);
        }

        // Cambiar el tipo de detalle
        event.data.detailType = detailType;

        // Aplicar los cambios de altura
        api.onRowHeightChanged();

        // Expandir con el detalle correspondiente
        setTimeout(() => {
          node.setExpanded(true);
        }, 0);
      }
    }
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;

    // Configurar master-detail después de que el grid esté listo
    this.updateGridContext();
  }

  // Actualizar el contexto del grid (llamado cuando cambia idRoot o al inicializar el grid)
  updateGridContext() {
    if (!this.gridApi) return;

    this.gridApi.setGridOption('detailCellRendererParams', {
      getDetailRowData: (params) => {
        params.successCallback(params.data.detailData);
      },
      context: {
        idRoot: this.idRoot, // Pasar idRoot al detail renderer
        componentParent: this, // Referencia al componente padre
        MATERIAL: {
          load: (materialId: number, type: string, callback: (data: any[]) => void) => {
            this.loadMaterialXTableData(materialId, type, callback);
          },
          save: (materialId: number, data: any[], type: string) => {
            this.saveMaterialDetailsById(materialId, data, type);
          },
          delete: (params: any, callback: () => void) => {
            this.deleteDetailRow(params, callback, 'MATERIAL');
          }
        }
      }
    });
  }

  // Método para actualizar el subfamilyCount de un material específico
  updateSubfamilyCount(materialId: number) {
    this.materialsService.getMaterialsxview(this.idRoot).subscribe({
      next: (data) => {
        // Buscar solo el material actualizado
        const updatedMaterial = data.find(m => m.id === materialId);
        if (updatedMaterial && this.gridApi) {
          // Actualizar solo la fila específica
          this.gridApi.forEachNode((node) => {
            if (node.data && node.data.id === materialId) {
              node.data.subfamilyCount = updatedMaterial.subfamilyCount;
              this.gridApi.refreshCells({
                rowNodes: [node],
                columns: ['subfamilyCount'],
                force: true
              });
              console.log(`✅ Actualizado "Donde usa" para material ${materialId}: ${updatedMaterial.subfamilyCount}`);
            }
          });
        }
      },
      error: (error) => {
        console.error('❌ Error al actualizar subfamilyCount:', error);
      }
    });
  }

  onSelectionChanged(event: any): void {
    const selectedRows = event.api.getSelectedRows();
    this.selectedMaterial = selectedRows.length > 0 ? selectedRows[0] : null;
  }

  addMaterial(): void {
    const tempId = `temp_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId,
      idCompany: this.idRoot,
      insumo: '',
      articulo: '',
      idCategory: null,
      idFamilia: null,
      idSubfamilia: null,
      idMedida: null,
      idUbication: null,
      description: '',
      date: new Date().toISOString(),
      aplicaResg: false,
      picture: '',
      costoMN: 0,
      costoDLL: 0,
      ventaMN: 0,
      ventaDLL: 0,
      stockMin: 0,
      stockMax: 0,
      vigente: true,
      active: true,
      __isNew: true,
    };

    this.rowData = [newItem, ...this.rowData];
    this.newlyAddedRows.push(tempId);
    this.hasUnsavedChanges = true;
    this.gridApi.setGridOption('rowData', this.rowData);

    setTimeout(() => {
      const firstRowIndex = 0;

      this.gridApi.ensureIndexVisible(firstRowIndex);

      this.gridApi.startEditingCell({
        rowIndex: firstRowIndex,
        colKey: 'articulo'
      });
    }, 0);
  }

  editMaterial(): void {
    if (!this.selectedMaterial) {
      alerts.basicAlert('Selección requerida', 'Por favor seleccione un material para editar', 'warning');
      return;
    }

    // Iniciar edición en la primera celda editable
    const selectedNode = this.gridApi.getSelectedNodes()[0];
    if (selectedNode) {
      this.gridApi.startEditingCell({
        rowIndex: selectedNode.rowIndex!,
        colKey: 'insumo'
      });
    }
  }

  async deleteMaterial(): Promise<void> {
    if (!this.selectedMaterial) {
      alerts.basicAlert('Selección requerida', 'Por favor seleccione un material para eliminar', 'warning');
      return;
    }

    const result = await alerts.confirmAlert(
      '¿Eliminar material?',
      `¿Está seguro de eliminar el material ${this.selectedMaterial.insumo} - ${this.selectedMaterial.articulo}?`,
      'warning',
      'Sí, eliminar'
    );

    if (result.isConfirmed) {
      try {
        const materialId = typeof this.selectedMaterial.id === 'string' ?
          parseInt(this.selectedMaterial.id.replace('temp_', '')) :
          this.selectedMaterial.id;

        await lastValueFrom(this.materialsService.deleteMaterial(materialId));
        alerts.basicAlert('Eliminado', 'El material ha sido eliminado correctamente', 'success');
        this.selectedMaterial = null;
        this.loadMaterials(); // Recargar datos
      } catch (error: any) {
        console.error('Error al eliminar material:', error);
        const errorMsg = error?.error?.message || error?.message || 'Error desconocido';
        alerts.basicAlert('Error', `No se pudo eliminar el material: ${errorMsg}`, 'error');
      }
    }
  }

  async saveChanges(): Promise<void> {
    if (!this.hasUnsavedChanges) {
      alerts.basicAlert('Sin cambios', 'No hay cambios pendientes por guardar', 'info');
      return;
    }

    // Buscar filas nuevas y modificadas
    const newRows = this.rowData.filter((row: any) => row.__isNew);
    const modifiedRows = this.rowData.filter((row: any) => row.__modified && !row.__isNew);

    if (newRows.length === 0 && modifiedRows.length === 0) {
      alerts.basicAlert('Sin cambios', 'No hay cambios pendientes por guardar', 'info');
      this.hasUnsavedChanges = false;
      return;
    }

    try {
      // Guardar nuevos registros
      for (const newRow of newRows) {
        const materialData = this.prepareMaterialData(newRow);
        await lastValueFrom(this.materialsService.addMaterial(materialData));
      }

      // Actualizar registros modificados
      for (const modifiedRow of modifiedRows) {
        const materialData = this.prepareMaterialData(modifiedRow);
        await lastValueFrom(this.materialsService.updateMaterial(modifiedRow.id.toString(), materialData));
      }

      alerts.basicAlert('Guardado', 'Los cambios han sido guardados correctamente', 'success');
      this.hasUnsavedChanges = false;
      this.loadMaterials(); // Recargar datos
    } catch (error: any) {
      console.error('Error al guardar cambios:', error);
      const errorMsg = error?.error?.message || error?.message || 'Error desconocido';
      alerts.basicAlert('Error', `No se pudieron guardar los cambios: ${errorMsg}`, 'error');
    }
  }

  private prepareMaterialData(row: any): any {
    return {
      idCompany: this.idRoot,
      idBranch: null,
      typeOcorReq: '',
      idCustomer: null,
      insumo: row.insumo || '',
      barCode: '',
      barcode: '',
      company: '',
      articulo: '',
      idCategory: row.idCategory || 0,
      idFamilia: row.idFamilia || 0,
      idSubfamilia: row.idSubfamilia || 0,
      idMedida: 0,
      idUbication: 0,
      description: row.articulo || '',
      folio: '',
      price: 0,
      quantity: 0,
      date: new Date().toISOString(),
      aplicaResg: false,
      costoMN: 0,
      costoDLL: 0,
      ventaMN: 0,
      ventaDLL: 0,
      stockMin: 0,
      stockMax: 0,
      picture: row.picture || '',
      typeMaterial: 'CONSUMABLE',
      folioOcorReq: '',
      vigente: row.vigente === true || row.vigente === 1 ? true : false,
      active: row.active ?? true
    };
  }

  refreshData(): void {
    this.loadMaterials();
    this.selectedMaterial = null;
    this.hasUnsavedChanges = false;
    alerts.basicAlert('Recargado', 'Los datos han sido recargados', 'success');
  }

  // ==================== MÉTODOS CRUD PARA PROVEEDORES DEL MATERIAL ====================

  loadMaterialXTableData(materialId: number, type: string, successCallback: any) {
    this.providersService.getMaterXTable(materialId, type).subscribe({
      next: (data: any) => {
        this.materialsXTableData[materialId] = data;
        successCallback(data);
      },
      error: (error) => {
        console.error('Error loading material details:', error);
        successCallback([]);
      }
    });
  }

  async saveMaterialDetailsById(materialId: number, data: any[], type: string) {
    const newDetails = data.filter((row: any) => row.__isNew);
    const modifiedDetails = data.filter((row: any) => row.__modified && !row.__isNew);

    try {
      for (const row of newDetails) {
        await lastValueFrom(this.providersService.addProviderXTable(this.cleanDataForServer(row)));
      }

      for (const row of modifiedDetails) {
        await lastValueFrom(this.providersService.updateProviderXTable(row.id, this.cleanDataForServer(row)));
      }

      if (newDetails.length > 0 || modifiedDetails.length > 0) {
        alerts.basicAlert(
          'Detalles guardados',
          'Se han guardado los proveedores correctamente.',
          'success'
        );

        // Limpiar los flags
        data.forEach(row => {
          delete row.__isNew;
          delete row.__modified;
        });
      }

    } catch (error) {
      console.error('Error saving provider details:', error);
      alerts.basicAlert(
        'Error',
        'Error al guardar los proveedores.',
        'error'
      );
    }
  }

  async deleteDetailRow(params: any, successCallback: () => void, type: string) {
    const materialId = params.data.campo1;
    const detailId = params.data.id;

    if (params.data.__isNew) {
      // Si es una fila nueva, solo removerla del array local
      this.materialsXTableData[materialId] = (this.materialsXTableData[materialId] || []).filter(
        item => item.id !== detailId
      ) || [];
      params.api.applyTransaction({ remove: [params.data] });
      this.hasUnsavedChanges = true;
    } else {
      // Si es una fila existente, eliminarla del servidor
      try {
        await lastValueFrom(this.providersService.deleteProviderXTable(detailId));
        alerts.basicAlert('Proveedor eliminado', 'El proveedor se eliminó correctamente.', 'success');
        successCallback(); // Llama al callback para recargar los datos en el componente hijo
      } catch (error) {
        console.error('Error deleting detail row:', error);
        alerts.basicAlert(
          'Error',
          'Error al eliminar el proveedor.',
          'error'
        );
      }
    }
  }

  private cleanDataForServer(data: any): any {
    const cleanedData = { ...data };
    delete cleanedData.__isNew;
    delete cleanedData.__modified;
    if (cleanedData.id && cleanedData.id.toString().startsWith('temp_')) {
      delete cleanedData.id;
    }
    return cleanedData;
  }

  // ========== MÉTODOS PARA MODAL DE SUBFAMILIAS ==========

  handleModalRequest(data: ModalData) {
    console.log('📝 MaterialesMaestro - Manejando solicitud de modal:', data);
    this.modalData = data;
    this.modalType = data.type;
    this.modalMode = data.mode;

    // Si es edición, cargar datos existentes
    if (data.mode === 'edit' && data.data) {
      this.modalForm.description = data.data.description || '';
      this.modalForm.active = data.data.active === 1;
    } else {
      // Resetear form para modo agregar
      this.modalForm = {
        description: '',
        active: true
      };
    }

    this.showModal = true;
  }

  saveModal() {
    if (!this.modalForm.description.trim()) {
      alerts.basicAlert('Error', 'La descripción es obligatoria.', 'warning');
      return;
    }

    console.log('💾 MaterialesMaestro - Guardando modal:', {
      type: this.modalType,
      mode: this.modalMode,
      form: this.modalForm,
      parentData: this.modalData?.parentData
    });

    // Preparar datos para enviar al servicio
    const saveData = {
      type: this.modalType,
      mode: this.modalMode,
      description: this.modalForm.description,
      active: this.modalForm.active,
      parentData: this.modalData?.parentData,
      data: this.modalData?.data // ⭐ Incluir datos originales para modo edición
    };

    // Enviar confirmación de guardado al servicio
    this.subfamiliaModalService.confirmSave(saveData);

    // Cerrar modal
    this.closeModal();
  }

  closeModal() {
    this.showModal = false;
    this.modalData = null;
    this.modalForm = {
      description: '',
      active: true
    };
  }

  // ========== MÉTODOS PARA MODAL DE IMAGEN ==========
  openImageModal(imageUrl: string) {
    this.selectedImageUrl = imageUrl;
    this.showImageModal = true;
  }

  closeImageModal() {
    this.showImageModal = false;
    this.selectedImageUrl = '';
  }

  // ========== MÉTODOS PARA MODAL DE MATERIAL ==========
  onImageFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.selectedImageFile = file;

      // Crear preview de la imagen
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.previewImageUrl = e.target.result;
        this.materialForm.picture = e.target.result; // Guardar como base64
      };
      reader.readAsDataURL(file);
    }
  }

  removeImage() {
    this.selectedImageFile = null;
    this.previewImageUrl = '';
    this.materialForm.picture = '';
  }

  async saveMaterialFromModal() {
    // Validar campos requeridos
    if (!this.materialForm.insumo.trim()) {
      alerts.basicAlert('Error', 'El número de material es obligatorio', 'warning');
      return;
    }
    if (!this.materialForm.articulo.trim()) {
      alerts.basicAlert('Error', 'El nombre del artículo es obligatorio', 'warning');
      return;
    }

    try {
      const materialData = this.prepareMaterialData({
        ...this.materialForm,
        active: this.materialForm.active
      });

      await lastValueFrom(this.materialsService.addMaterial(materialData));
      alerts.basicAlert('Guardado', 'Material creado correctamente', 'success');
      this.closeMaterialModal();
      this.loadMaterials();
    } catch (error: any) {
      console.error('Error al guardar material:', error);
      const errorMsg = error?.error?.message || error?.message || 'Error desconocido';
      alerts.basicAlert('Error', `No se pudo guardar el material: ${errorMsg}`, 'error');
    }
  }

  closeMaterialModal() {
    this.showMaterialModal = false;
    this.materialForm = {
      insumo: '',
      articulo: '',
      idCategory: 0,
      idFamilia: 0,
      picture: '',
      active: true
    };
    this.selectedImageFile = null;
    this.previewImageUrl = '';
  }

  getModalTitle(): string {
    const typeLabels = {
      subfamilia: 'Subfamilia',
      flavor: 'Sabor',
      presentation: 'Presentación'
    };
    const modeLabel = this.modalMode === 'add' ? 'Nueva' : 'Editar';
    return `${modeLabel} ${typeLabels[this.modalType]}`;
  }

  getModalColor(): string {
    const colors = {
      subfamilia: 'primary',
      flavor: 'info',
      presentation: 'secondary'
    };
    return colors[this.modalType];
  }
}
