import { Component, effect, inject, HostListener } from '@angular/core';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { alerts } from 'app/helpers/alerts';
import { AgGridModule } from 'ag-grid-angular';
import { catchError, concat, EMPTY, lastValueFrom, toArray } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SignalsService } from 'app/services/signals.service';
import { CatalogsService } from 'app/services/catalogs.service';
import { MaterialsService } from 'app/services/materials.service';
import { MaterialsResponse } from 'app/interface/materials.interface';
import { CanComponentDeactivate } from 'app/guards/unsaved-changes.guard';
import { confirmExitIfUnsaved } from 'app/helpers/can-deactivate.helper';

@Component({
  selector: 'app-materiales-maestro',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  templateUrl: './materiales-maestro.component.html',
  styleUrl: './materiales-maestro.component.scss'
})
export class MaterialesMaestroComponent implements CanComponentDeactivate {

  private catalogsService = inject(CatalogsService);
  private signalsService = inject(SignalsService);
  private materialsService = inject(MaterialsService);

  constructor() {
    effect(() => {
      console.log('Effect ejecutado en constructor');
      this.idRoot = this.signalsService.getRootSelectedBySidebar()();
      console.log('idRoot actualizado a:', this.idRoot);
      this.obtenerDatos();
      this.obtenerCatalogos();
      this.obtenerMedidas();
      this.cargarDatosMock();
    });
  }

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.notSavedChanges) {
      $event.returnValue = 'Tienes cambios sin guardar. ¿Seguro que deseas salir?';
    }
  }

  notSavedChanges: boolean = false;
  private gridApi: GridApi;
  private idRoot = this.signalsService.getRootSelectedBySidebar()();
  private tempIdCounter: number = 0;
  
  categories: any[] = [];
  familias: any[] = [];
  subfamilias: any[] = []; // Subfamilias filtradas para la fila actual
  todasSubfamilias: any[] = []; // Todas las subfamilias disponibles
  medidas: any[] = []; // Unidades de medida
  proveedores: any[] = []; // Proveedores (datos mock)
  sucursales: any[] = []; // Sucursales (datos mock)
  rawData: any[] = []; // Datos originales del API
  treeData: any[] = []; // Datos estructurados en árbol
  rowData: any[] = []; // Datos visibles en el grid
  selectedRowData: any = null;
  newlyAddedRows: string[] = [];
  gridHeight: string = '80vh';
  
  public rowSelection: 'single' | 'multiple' = 'single';
  public paginationPageSize = 15;
  public paginationPageSizeSelector: number[] | boolean = [15, 50, 100];
  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  async obtenerDatos() {
    console.log('obtenerDatos() llamado, idRoot:', this.idRoot);
    
    if (!this.idRoot) {
      console.warn('No idRoot available');
      return;
    }

    try {
      // Asegurar que los catálogos estén cargados primero
      await this.obtenerCatalogos();
      
      console.log('Llamando al servicio de materiales con idRoot:', this.idRoot, 'type: CONSUMABLE');
      
      const materials = await lastValueFrom(
        this.materialsService.getAllMaterialsxview(this.idRoot)
          .pipe(
            catchError((error) => {
              console.error('Error en el pipe catchError:', error);
              return EMPTY;
            })
          )
      );
      
      console.log('Materiales recibidos del servicio:', materials);
      console.log('Número de materiales:', materials?.length || 0);
      
      this.rawData = materials;
    this.buildTreeStructure();
    this.updateGridData();
      
    } catch (error) {
      console.error('Error en try/catch al cargar materiales:', error);
      this.rowData = [];
      if (this.gridApi) {
        this.gridApi.setGridOption('rowData', this.rowData);
      }
    }
  }

  // Construir estructura de árbol: Material -> Proveedor -> Items
  private buildTreeStructure() {
    console.log('Construyendo estructura de árbol con:', this.rawData.length, 'materiales');
    
    if (!this.rawData || this.rawData.length === 0) {
      this.treeData = [];
      return;
    }
    
    this.treeData = [];
    const materialsMap = new Map();
    const providersMap = new Map();
    
    // Procesar cada registro del API (cada uno es una orden de compra)
    this.rawData.forEach(material => {
      const materialKey = material.description;
      const companyName = material.company === 'N/A' ? 'Sin Proveedor' : material.company;
      const providerKey = `${materialKey}_${companyName}`;
      
      // Solo crear nodos si hay datos relevantes (no N/A en typeOcorReq)
      const hasOrderData = material.typeOcorReq !== 'N/A' && material.folioOcorReq !== 'N/A';
      
      // Crear nodo de material si no existe
      if (!materialsMap.has(materialKey)) {
        const materialNode = {
          id: `material_${materialKey}`,
          nodeLevel: 'material',
          description: material.description,
          articulo: material.description,
          isExpanded: true,
          isVisible: true,
          providerCount: 0,
          totalCost: 0
        };
        materialsMap.set(materialKey, materialNode);
        this.treeData.push(materialNode);
      }
      
      // Solo procesar si tiene datos de orden de compra
      if (hasOrderData) {
        // Crear nodo de proveedor si no existe
        if (!providersMap.has(providerKey)) {
          const providerNode = {
            id: `provider_${providerKey}`,
            nodeLevel: 'provider', 
            description: companyName,
            proveedor: companyName,
            parentMaterial: materialKey,
            isExpanded: true,
            isVisible: true,
            orderCount: 0,
            totalCost: 0
          };
          providersMap.set(providerKey, providerNode);
          this.treeData.push(providerNode);
          
          // Incrementar contador de proveedores del material
          materialsMap.get(materialKey).providerCount++;
        }
        
        // Crear orden de compra individual
        const totalOC = (material.price || 0) * (material.inOrOutQuantity || 0);
        const orderNode = {
          id: `order_${material.id}_${Date.now()}`,
          nodeLevel: 'order',
          parentMaterial: materialKey,
          parentProvider: companyName,
          isVisible: true,
          // Datos de la orden de compra
          folioOcorReq: material.folioOcorReq,
          price: material.price,
          inOrOutQuantity: material.inOrOutQuantity,
          totalOC: totalOC,
          fechaOc: material.fechaOc,
          // Otros campos del material para referencia
          insumo: material.insumo,
          medida: material.measure,
          quantity: material.quantity
        };
        
        this.treeData.push(orderNode);
        
        // Actualizar contadores y totales
        const materialNode = materialsMap.get(materialKey);
        const providerNode = providersMap.get(providerKey);
        
        materialNode.totalCost += totalOC;
        providerNode.orderCount++;
        providerNode.totalCost += totalOC;
      }
    });
    
    console.log('Estructura de árbol construida:', this.treeData.length, 'nodos');
  }
  
  // Actualizar datos visibles del grid
  private updateGridData() {
    this.rowData = this.treeData.filter(item => item.isVisible);
    if (this.gridApi) {
      this.gridApi.setGridOption('rowData', this.rowData);
    }
  }

  // Métodos helper para obtener descripciones de catálogos
  private getCategoriaDescription(idCategory: number): string {
    console.log('getCategoriaDescription - idCategory:', idCategory, 'categories:', this.categories?.length);
    if (!idCategory || !this.categories) return '';
    const categoria = this.categories.find(cat => cat.id === idCategory);
    console.log('Categoria encontrada:', categoria);
    return categoria ? categoria.description : '';
  }

  private getFamiliaDescription(idFamilia: number): string {
    console.log('getFamiliaDescription - idFamilia:', idFamilia, 'familias:', this.familias?.length);
    if (!idFamilia || !this.familias) return '';
    const familia = this.familias.find(fam => fam.id === idFamilia);
    console.log('Familia encontrada:', familia);
    return familia ? familia.description : '';
  }

  private getSubfamiliaDescription(idSubfamilia: number): string {
    console.log('getSubfamiliaDescription - idSubfamilia:', idSubfamilia, 'subfamilias:', this.todasSubfamilias?.length);
    if (!idSubfamilia || !this.todasSubfamilias) return '';
    const subfamilia = this.todasSubfamilias.find(sub => sub.id === idSubfamilia);
    console.log('Subfamilia encontrada:', subfamilia);
    return subfamilia ? subfamilia.description : '';
  }


  async obtenerCatalogos() {
    if (!this.idRoot) return;

    try {
      // Cargar categorías, familias y todas las subfamilias
      const [categories, families, subfamilies] = await Promise.all([
        lastValueFrom(this.catalogsService.getCatalogs(this.idRoot, 'CATEGORY')),
        lastValueFrom(this.catalogsService.getCatalogs(this.idRoot, 'FAM-CAT')),
        lastValueFrom(this.catalogsService.getCatalogs(this.idRoot, 'SUB-FAM'))
      ]);

      this.categories = categories || [];
      this.familias = families || [];
      this.todasSubfamilias = subfamilies || [];
      this.subfamilias = []; // Se filtrarán dinámicamente

      console.log('Catálogos cargados:', {
        categories: this.categories.length,
        families: this.familias.length,
        subfamilies: this.todasSubfamilias.length
      });

    } catch (error) {
      console.error('Error fetching catalogs:', error);
      this.categories = [];
      this.familias = [];
      this.todasSubfamilias = [];
      this.subfamilias = [];
    }
  }


  filtrarSubfamilias(categoriaId: number, familiaId: number) {
    // Filtrar subfamilias que tengan parentId=categoriaId y subParentId=familiaId (igual que CAT-Fam-Sub)
    return this.todasSubfamilias.filter(subfamilia => 
      subfamilia.parentId === categoriaId && subfamilia.subParentId === familiaId
    );
  }

  obtenerMedidas() {
    if (!this.idRoot) return;
    
    this.catalogsService.getCatalogs(this.idRoot, 'MEASURE').subscribe(
      (data: any[]) => {
        this.medidas = data || [];
      },
      (error) => console.error('Error fetching measures:', error)
    );
  }

  cargarDatosMock() {
    // Datos mock para proveedores
    this.proveedores = [
      { id: 1, description: 'Proveedor A' },
      { id: 2, description: 'Proveedor B' },
      { id: 3, description: 'Proveedor C' }
    ];

    // Datos mock para sucursales
    this.sucursales = [
      { id: 1, description: 'Sucursal Centro' },
      { id: 2, description: 'Sucursal Norte' },
      { id: 3, description: 'Sucursal Sur' }
    ];
  }

  public gridOptions: any = {
    headerHeight: 35,
    rowHeight: 35,
    animateRows: true,
    treeData: false,
    suppressClickEdit: true,
    singleClickEdit: false,
    stopEditingWhenCellsLoseFocus: true,
    rowClass: (params) => {
      if (params.data.nodeLevel === 'material') {
        return 'tree-material-row';
      }
      if (params.data.nodeLevel === 'provider') {
        return 'tree-provider-row';
      }
      return 'tree-item-row';
    },
    onRowClicked: (event) => {
      event.node.setSelected(true);
    },
    onRowSelected: (event) => {
      if (event.node.isSelected()) {
        this.selectedRowData = event.data;
        this.gridApi.forEachNode((node) => {
          if (node.id !== event.node.id) {
            node.setSelected(false);
          }
        });
      }
    },
    onCellValueChanged: (event) => {
      this.onCellValueChanged(event);
    }
  };

  get colMaster(): ColDef[] {
    return [
      {
        field: 'articulo',
        headerName: 'Material',
        width: 200,
        cellRenderer: (params: any) => {
          if (params.data.nodeLevel === 'material') {
            const isExpanded = params.data.isExpanded || false;
            const chevron = isExpanded ? '▼' : '▶';
            const providerCount = params.data.providerCount || 0;
            const totalCost = params.data.totalCost || 0;
            return `<span class="chevron-icon" data-action="toggle" style="cursor: pointer; margin-right: 5px;">${chevron}</span> <strong>${params.data.description}</strong> (${providerCount}) - $${totalCost.toFixed(2)}`;
          }
          return '';
        },
        onCellClicked: (event: any) => {
          if (event.event.target.classList.contains('chevron-icon') || 
              event.event.target.getAttribute('data-action') === 'toggle') {
            if (event.data.nodeLevel === 'material') {
              this.toggleMaterialExpansion(event.data);
            }
          }
        }
      },
      {
        field: 'activo',
        headerName: 'Activo',
        editable: true,
        width: 100,
        cellEditor: 'agCheckboxCellEditor',
        cellRenderer: (params: any) => {
          if (params.data.nodeLevel === 'item') {
            const checked = params.data.activo ? 'checked' : '';
            return `<input type="checkbox" ${checked} style="cursor: pointer;">`;
          }
          return '';
        }
      },
      {
        field: 'categoria',
        headerName: 'Categoría',
        editable: true,
        width: 130,
        filter: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: this.categories ? this.categories.map(item => item.description) : []
        },
        valueFormatter: (params) => {
          const foundItem = this.categories
            ? this.categories.find((item) => item.description === params.value)
            : null;
          return foundItem ? foundItem.description : params.value;
        }
      },
      {
        field: 'familia',
        headerName: 'Familia',
        editable: true,
        width: 130,
        filter: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: (params) => {
          const categoriaName = params.data.categoria;
          const categoria = this.categories.find(c => c.description === categoriaName);
          
          const familiasFiltradas = categoria 
            ? this.familias.filter(item => item.parentId === categoria.id)
            : [];

          return {
            values: familiasFiltradas.map(item => item.description)
          };
        },
        valueFormatter: (params) => {
          const foundItem = this.familias
            ? this.familias.find((item) => item.description === params.value)
            : null;
          return foundItem ? foundItem.description : params.value;
        }
      },
      {
        field: 'subFamilia',
        headerName: 'Subfamilia',
        editable: true,
        width: 130,
        filter: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: (params) => {
          const categoriaName = params.data.categoria;
          const familiaName = params.data.familia;
          
          if (!categoriaName || !familiaName) {
            return { values: [] };
          }
          
          return {
            values: this.subfamilias.map(item => item.description)
          };
        },
        valueFormatter: (params) => {
          const foundItem = this.subfamilias
            ? this.subfamilias.find((item) => item.description === params.value)
            : null;
          return foundItem ? foundItem.description : params.value;
        }
      },
      {
        field: 'costoMN',
        headerName: 'Precio unitario',
        editable: true,
        width: 120,
        cellDataType: 'number',
        cellEditorParams: { min: 0, step: 0.01 },
        valueFormatter: (params) => {
          return params.value ? `$${params.value}` : '$0.00';
        }
      },
      {
        field: 'descriptionPackage',
        headerName: 'Descripción empacado',
        editable: true,
        width: 180,
        filter: true
      },
      {
        field: 'packageQuantity',
        headerName: 'Núm piezas por paquete',
        editable: true,
        width: 150,
        cellDataType: 'number',
        cellEditorParams: { min: 1 }
      },
      {
        field: 'insumo',
        headerName: 'Numero Material',
        editable: true,
        width: 140,
        filter: true
      },
      {
        field: 'medida',
        headerName: 'Medidas',
        editable: true,
        width: 100,
        filter: true
      },
      {
        field: 'weightOrVolumes',
        headerName: 'Pesos o volúmenes en Kgr o lts',
        editable: true,
        width: 180,
        cellDataType: 'number',
        cellEditorParams: { min: 0, step: 0.01 }
      },
      {
        field: 'expiration',
        headerName: 'Caducidad o garantía en meses',
        editable: true,
        width: 180,
        cellDataType: 'number',
        cellEditorParams: { min: 0 }
      },
      {
        field: 'picture',
        headerName: 'Imagen',
        editable: false,
        width: 100,
        cellRenderer: (params) => {
          if (params.data.nodeLevel === 'order') {
            return params.value ? '📷 Imagen' : '📷 Subir';
          }
          return '';
        }
      },
      {
        field: 'proveedor',
        headerName: 'Proveedor',
        width: 200,
        cellRenderer: (params: any) => {
          if (params.data.nodeLevel === 'provider') {
            const isExpanded = params.data.isExpanded || false;
            const chevron = isExpanded ? '▼' : '▶';
            const orderCount = params.data.orderCount || 0;
            const totalCost = params.data.totalCost || 0;
            return `<span style="margin-left: 20px;"></span><span class="chevron-icon" data-action="toggle" style="cursor: pointer; margin-right: 5px;">${chevron}</span> ${params.data.description} (${orderCount}) - $${totalCost.toFixed(2)}`;
          }
          return '';
        },
        onCellClicked: (event: any) => {
          if (event.event.target.classList.contains('chevron-icon') || 
              event.event.target.getAttribute('data-action') === 'toggle') {
            if (event.data.nodeLevel === 'provider') {
              this.toggleProviderExpansion(event.data);
            }
          }
        }
      },
      {
        field: 'folioOcorReq',
        headerName: 'Folio OC',
        width: 120,
        filter: true,
        cellRenderer: (params: any) => {
          return params.data.nodeLevel === 'order' ? params.value || '' : '';
        }
      },
      {
        field: 'price',
        headerName: 'Precio',
        width: 100,
        cellRenderer: (params: any) => {
          if (params.data.nodeLevel === 'order') {
            const value = params.value || 0;
            return `$${value.toFixed(2)}`;
          }
          return '';
        }
      },
      {
        field: 'inOrOutQuantity',
        headerName: 'Cantidad',
        width: 100,
        cellRenderer: (params: any) => {
          return params.data.nodeLevel === 'order' ? params.value || 0 : '';
        }
      },
      {
        field: 'totalOC',
        headerName: 'Total OC',
        width: 120,
        cellRenderer: (params: any) => {
          if (params.data.nodeLevel === 'order') {
            const value = params.value || 0;
            return `$${value.toFixed(2)}`;
          }
          return '';
        }
      },
    ];
  }

  onSelectedRow(event: any) {
    this.selectedRowData = event.data;
  }

  onSelectionChanged(event: any) {
    const selectedNodes = event.api.getSelectedNodes();
    if (selectedNodes.length > 0) {
      this.selectedRowData = selectedNodes[0].data;
    } else {
      this.selectedRowData = null;
    }
  }

  async onCellValueChanged(event: any) {
    console.log('Celda cambiada:', event.colDef.field, 'nuevo valor:', event.newValue, 'valor anterior:', event.oldValue);
    event.data.__modified = true;
    this.notSavedChanges = true;
    
    // Si cambió la categoría, limpiar familia y subfamilia
    if (event.colDef.field === 'categoria') {
      event.data.familia = '';
      event.data.subFamilia = '';
      this.gridApi.refreshCells({
        rowNodes: [event.node],
        columns: ['familia', 'subFamilia']
      });
    }
    
    // Si cambió la familia, limpiar subfamilia y filtrar nuevas subfamilias
    if (event.colDef.field === 'familia') {
      event.data.subFamilia = '';
      
      // Obtener IDs de categoría y familia
      const categoriaName = event.data.categoria;
      const familiaName = event.data.familia;
      
      if (categoriaName && familiaName) {
        const categoria = this.categories.find(c => c.description === categoriaName);
        const familia = this.familias.find(f => f.description === familiaName);
        
        if (categoria && familia) {
          // Filtrar subfamilias específicas para esta categoría+familia
          this.subfamilias = this.filtrarSubfamilias(categoria.id, familia.id);
          console.log(`Subfamilias filtradas para categoria ${categoria.id} y familia ${familia.id}:`, this.subfamilias.length);
        }
      }
      
      this.gridApi.refreshCells({
        rowNodes: [event.node],
        columns: ['subFamilia']
      });
    }
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  addRow() {
    const tempId = `temp_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId,
      activo: true,
      articulo: '',
      categoria: '',
      familia: '',
      subFamilia: '',
      proveedor: '',
      costoMN: 0,
      descriptionPackage: '',
      packageQuantity: 1,
      insumo: '',
      medida: '',
      weightOrVolumes: 0,
      expiration: 0,
      picture: '',
      // Campos adicionales del API
      idCompany: Number(this.idRoot),
      idBranch: null,
      idCustomer: null,
      barCode: '',
      idFamilia: 0,
      idSubfamilia: 0,
      idMedida: 0,
      idUbication: 0,
      aplicaResg: false,
      costoDLL: 0,
      ventaMN: 0,
      ventaDLL: 0,
      vigente: true,
      typeMaterial: 'CONSUMABLE',
      date: new Date().toISOString(),
      stockMin: 0,
      stockMax: 0,
      __isNew: true
    };

    this.rowData = [newItem, ...this.rowData];
    this.newlyAddedRows.push(tempId);
    this.notSavedChanges = true;
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

  async saveChanges() {
    if (!this.rowData.every(item => item.articulo)) {
      alerts.basicAlert('Error', 'Debe llenar la descripción del artículo.', 'error');
      return;
    }

    try {
      const modifiedRows = this.rowData.filter(row => row.__modified || row.__isNew);
      
      for (const row of modifiedRows) {
        const data = this.prepareDataForSave(row);
        
        if (row.__isNew) {
          console.log('Guardando nuevo material XSDDDDD:', data);
          await lastValueFrom(this.materialsService.addMaterial(data));
        } else {
          await lastValueFrom(this.materialsService.updateMaterial(row.id.toString(), data));
        }
      }
      
      this.rowData = this.rowData.map(row => {
        const cleanRow = { ...row };
        delete cleanRow.__isNew;
        delete cleanRow.__modified;
        return cleanRow;
      });
      
      alerts.basicAlert('Éxito', 'Datos guardados correctamente.', 'success');
      this.notSavedChanges = false;
      this.newlyAddedRows = [];
      await this.obtenerDatos();
      
    } catch (error) {
      console.error('Error:', error);
      alerts.basicAlert('Error', 'Error al guardar.', 'error');
    }
  }

  private prepareDataForSave(row: any): any {
    return {
      idCompany: Number(this.idRoot),
      description: row.articulo,
      insumo: row.insumo || '',
      idCategory: this.getCategoriaId(row.categoria),
      idFamilia: this.getFamiliaId(row.familia),
      idSubfamilia: this.getSubfamiliaId(row.subFamilia),
      costoMN: Number(row.costoMN) || 0,
      descriptionPackage: row.descriptionPackage || '',
      packageQuantity: Number(row.packageQuantity) || 1,
      measure: row.medida || '',
      weightOrVolumes: Number(row.weightOrVolumes) || 0,
      expiration: Number(row.expiration) || 0,
      picture: row.picture || '',
      typeMaterial: 'CONSUMABLE',
      active: Boolean(row.activo),
      vigente: true,
      stockMin: 0,
      stockMax: 0,
      costoDLL: 0,
      ventaMN: 0,
      ventaDLL: 0,
      aplicaResg: false,
      barCode: row.barCode || '',
      idBranch: null,
      idCustomer: null,
      idMedida: 0,
      idUbication: 0,
      date: new Date().toISOString()
    };
  }

  // Métodos helper para obtener IDs de catálogos
  private getCategoriaId(description: string): number {
    console.log('getCategoriaId - buscando:', description, 'en', this.categories?.length, 'categorias');
    if (!description || !this.categories) return 0;
    const categoria = this.categories.find(cat => cat.description === description);
    console.log('Categoria encontrada:', categoria);
    return categoria ? categoria.id : 0;
  }

  private getFamiliaId(description: string): number {
    if (!description || !this.familias) return 0;
    const familia = this.familias.find(fam => fam.description === description);
    return familia ? familia.id : 0;
  }

  private getSubfamiliaId(description: string): number {
    if (!description || !this.todasSubfamilias) return 0;
    const subfamilia = this.todasSubfamilias.find(sub => sub.description === description);
    return subfamilia ? subfamilia.id : 0;
  }

  async deleteEntry() {
    const selectedNodes = this.gridApi.getSelectedNodes();
    if (selectedNodes.length === 0) {
      alerts.basicAlert(
        'Eliminar entrada',
        'Por favor, seleccione una entrada para eliminar.',
        'error'
      );
      return;
    }

    const selectedData = selectedNodes[0].data;
    this.rowData = this.rowData.filter(item => item.id !== selectedData.id);
    this.selectedRowData = null;
    this.notSavedChanges = true;
    this.gridApi.setGridOption('rowData', this.rowData);
    
    alerts.basicAlert(
      'Eliminar entrada',
      'Entrada eliminada satisfactoriamente.',
      'success'
    );
  }

  // Métodos para manejar expand/collapse
  toggleMaterialExpansion(materialData: any) {
    const material = this.treeData.find(item => 
      item.nodeLevel === 'material' && item.articulo === materialData.articulo
    );
    
    if (material) {
      material.isExpanded = !material.isExpanded;
      
      // Mostrar/ocultar proveedores de este material
      this.treeData.forEach(item => {
        if (item.nodeLevel === 'provider' && item.parentMaterial === material.articulo) {
          item.isVisible = material.isExpanded;
          
          // Si ocultamos el proveedor, también ocultar sus órdenes
          if (!material.isExpanded) {
            this.treeData.forEach(subItem => {
              if (subItem.nodeLevel === 'order' && subItem.parentProvider === item.proveedor && subItem.parentMaterial === material.articulo) {
                subItem.isVisible = false;
              }
            });
          } else {
            // Si mostramos el proveedor, mostrar órdenes solo si el proveedor está expandido
            if (item.isExpanded) {
              this.treeData.forEach(subItem => {
                if (subItem.nodeLevel === 'order' && subItem.parentProvider === item.proveedor && subItem.parentMaterial === material.articulo) {
                  subItem.isVisible = true;
                }
              });
            }
          }
        }
      });
      
      this.updateGridData();
    }
  }

  toggleProviderExpansion(providerData: any) {
    const provider = this.treeData.find(item => 
      item.nodeLevel === 'provider' && item.proveedor === providerData.proveedor && item.parentMaterial === providerData.parentMaterial
    );
    
    if (provider) {
      provider.isExpanded = !provider.isExpanded;
      
      // Mostrar/ocultar órdenes de este proveedor
      this.treeData.forEach(item => {
        if (item.nodeLevel === 'order' && item.parentProvider === provider.proveedor && item.parentMaterial === provider.parentMaterial) {
          item.isVisible = provider.isExpanded;
        }
      });
      
      this.updateGridData();
    }
  }


  revert() {
    this.obtenerDatos();
    this.notSavedChanges = false;
    this.selectedRowData = null;
    this.newlyAddedRows = [];
  }

  async canDeactivate(): Promise<boolean> {
    return confirmExitIfUnsaved(this.notSavedChanges);
  }
}