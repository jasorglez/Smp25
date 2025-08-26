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
  rowData: any[] = [];
  selectedRowData: any = null;
  newlyAddedRows: string[] = [];
  gridHeight: string = '80vh';
  
  public rowSelection: 'single' | 'multiple' = 'single';
  public rowGroupPanelShow: 'always' | 'onlyWhenGrouping' | 'never' = 'always';
  public pivotPanelShow: 'always' | 'onlyWhenPivoting' | 'never' = 'always';
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
        this.materialsService.getMaterials(this.idRoot, 'CONSUMABLE')
          .pipe(
            catchError((error) => {
              console.error('Error en el pipe catchError:', error);
              return EMPTY;
            })
          )
      );
      
      console.log('Materiales recibidos del servicio:', materials);
      console.log('Número de materiales:', materials?.length || 0);
      
      this.procesarMateriales(materials);
      
    } catch (error) {
      console.error('Error en try/catch al cargar materiales:', error);
      this.rowData = [];
      if (this.gridApi) {
        this.gridApi.setGridOption('rowData', this.rowData);
      }
    }
  }

  private procesarMateriales(materials: MaterialsResponse[]) {
    console.log('procesarMateriales() llamado con:', materials);
    
    if (!materials || materials.length === 0) {
      console.warn('No hay materiales para procesar');
      this.rowData = [];
      if (this.gridApi) {
        this.gridApi.setGridOption('rowData', this.rowData);
      }
      return;
    }
    
    this.rowData = materials.map(material => {
      console.log('Procesando material:', material.id);
      console.log('Campos del material:', Object.keys(material));
      console.log('idCategory:', material.idCategory, 'existe:', 'idCategory' in material);
      return {
        id: material.id,
        activo: material.active,
        articulo: material.description,
        categoria: this.getCategoriaDescription(material.idCategory),
      familia: this.getFamiliaDescription(material.idFamilia),
      subFamilia: this.getSubfamiliaDescription(material.idSubfamilia),
      proveedor: '',
      costoMN: material.costoMN,
      descriptionPackage: material.descriptionPackage,
      packageQuantity: material.packageQuantity,
      insumo: material.insumo,
      medida: material.measure,
      weightOrVolumes: material.weightOrVolumes,
      expiration: material.expiration,
      picture: material.picture,
      // Campos adicionales del API
      idCompany: material.idCompany,
      idBranch: material.idBranch,
      idCustomer: material.idCustomer,
      barCode: material.barCode,
      idFamilia: material.idFamilia,
      idSubfamilia: material.idSubfamilia,
      idMedida: material.idMedida,
      idUbication: material.idUbication,
      aplicaResg: material.aplicaResg,
      costoDLL: material.costoDLL,
      ventaMN: material.ventaMN,
      ventaDLL: material.ventaDLL,
      vigente: material.vigente,
      typeMaterial: material.typeMaterial,
      date: material.date,
      stockMin: material.stockMin,
      stockMax: material.stockMax
      };
    });

    console.log('Datos procesados para el grid:', this.rowData);
    console.log('Número de filas procesadas:', this.rowData.length);
    
    if (this.gridApi) {
      console.log('Actualizando grid con datos');
      this.gridApi.setGridOption('rowData', this.rowData);
    } else {
      console.warn('gridApi no está disponible aún');
    }
    
    console.log('Materials loaded:', this.rowData.length);
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
    headerHeight: 25,
    rowHeight: 20,
    rowClass: (params) => {
      if (params.node.isSelected()) {
        return 'selected-row';
      }
      return '';
    },
    onRowClicked: (event) => {
      event.node.setSelected(true);
    },
    onRowSelected: (event) => {
      if (event.node.isSelected()) {
        this.gridApi.forEachNode((node) => {
          if (node.id !== event.node.id) {
            node.setSelected(false);
          }
        });
      }
    }
  };

  get colMaster(): ColDef[] {
    return [
      {
        field: 'activo',
        headerName: 'Activo',
        editable: true,
        width: 100,
        cellEditor: 'agCheckboxCellEditor'
      },
      {
        field: 'articulo',
        headerName: 'Artículo',
        editable: true,
        width: 150,
        filter: true
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
        field: 'proveedor',
        headerName: 'Proveedor',
        editable: true,
        width: 130,
        filter: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: this.proveedores ? this.proveedores.map(item => item.description) : []
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
        headerName: 'Insumo',
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
          return params.value ? '📷 Imagen' : '📷 Subir';
        }
      }
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

  revert() {
    this.obtenerDatos();
    this.notSavedChanges = false;
    this.selectedRowData = null;
    this.newlyAddedRows = [];
    if (this.gridApi) {
      this.gridApi.setGridOption('rowData', this.rowData);
    }
  }

  async canDeactivate(): Promise<boolean> {
    return confirmExitIfUnsaved(this.notSavedChanges);
  }
}