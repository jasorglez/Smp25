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

  constructor() {
    effect(() => {
      this.idRoot = this.signalsService.getRootSelectedBySidebar()();
      this.obtenerDatos();
      this.obtenerCatalogos();
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
    // Datos de prueba mientras no hay servicio específico
    this.rowData = [
      {
        id: 1,
        activo: true,
        articulo: 'Material de prueba 1',
        categoria: 'Categoría 1',
        familia: 'Familia 1',
        subFamilia: 'SubFamilia 1'
      },
      {
        id: 2,
        activo: false,
        articulo: 'Material de prueba 2',
        categoria: 'Categoría 2',
        familia: 'Familia 2',
        subFamilia: 'SubFamilia 2'
      }
    ];
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
        field: 'id',
        editable: false,
        width: 70,
        hide: true,
        filter: 'agNumberColumnFilter',
        filterParams: {
          filterOptions: ['equals']
        }
      },
      {
        field: 'articulo',
        headerName: 'Artículo',
        editable: true,
        width: 200,
        filter: true
      },
      {
        field: 'categoria',
        headerName: 'Categoría',
        editable: true,
        width: 150,
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
        width: 150,
        filter: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: (params) => {
          // Obtener la categoría de la fila actual
          const categoriaName = params.data.categoria;
          const categoria = this.categories.find(c => c.description === categoriaName);
          
          // Filtrar familias por parentId (idCategoria)
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
        headerName: 'Sub Familia',
        editable: true,
        width: 150,
        filter: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: (params) => {
          // Solo mostrar subfamilias si ya se seleccionaron categoría y familia
          const categoriaName = params.data.categoria;
          const familiaName = params.data.familia;
          
          if (!categoriaName || !familiaName) {
            return { values: [] }; // No hay subfamilias disponibles sin categoría+familia
          }
          
          // Usar las subfamilias cargadas dinámicamente
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