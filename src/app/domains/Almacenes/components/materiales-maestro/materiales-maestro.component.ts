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
      this.idRoot = this.signalsService.getRootSelectedBySidebar()();
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

  obtenerDatos() {
    if (!this.idRoot) {
      console.warn('No idRoot available');
      return;
    }

    this.materialsService.getMaterials(this.idRoot, 'CONSUMABLE')
      .pipe(
        catchError((error) => {
          console.error('Error fetching materials:', error);
          this.rowData = [];
          return EMPTY;
        })
      )
      .subscribe((materials: MaterialsResponse[]) => {
        this.rowData = materials.map(material => ({
          id: material.id,
          activo: material.active,
          articulo: material.description,
          categoria: '',
          familia: '',
          subFamilia: '',
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
        }));

        if (this.gridApi) {
          this.gridApi.setGridOption('rowData', this.rowData);
        }
        
        console.log('Materials loaded:', this.rowData.length);
      });
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
        filter: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: this.medidas ? this.medidas.map(item => item.description) : []
        }
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
    const isValid = this.rowData.every(
      (item) => item.articulo && item.categoria
    );
    if (!isValid) {
      alerts.basicAlert(
        'Campos requeridos',
        'Debe llenar artículo y categoría antes de guardar.',
        'error'
      );
      return;
    }

    // Simular guardado por ahora
    this.rowData = this.rowData.map(row => {
      const cleanRow = { ...row };
      delete cleanRow.__isNew;
      delete cleanRow.__modified;
      return cleanRow;
    });
    
    alerts.basicAlert(
      'Datos actualizados',
      'Se han actualizado los datos correctamente.',
      'success'
    );
    this.notSavedChanges = false;
    this.newlyAddedRows = [];
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