import { Component, effect, inject } from '@angular/core';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { alerts } from 'app/helpers/alerts';
import { AgGridModule } from 'ag-grid-angular';
import { lastValueFrom } from 'rxjs';
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

  ngOnInit() {
    this.loadCatalogData();
    this.loadMaterialesData();
  }

  // Variables básicas
  notSavedChanges: boolean = false;
  private gridApi: GridApi;
  private idRoot = this.signalsService.getRootSelectedBySidebar()();
  
  // Datos para combos
  categories: any[] = [];
  
  // Datos del grid
  materialesData: any[] = [];
  selectedRowData: any = null;

  // Cargar categorías
  async loadCatalogData() {
    if (!this.idRoot) return;
    
    try {
      const categories = await lastValueFrom(this.catalogsService.getCatalogs(this.idRoot, 'CATEGORY'));
      this.categories = categories || [];
      console.log('Categorías cargadas:', this.categories.length);
      
    } catch (error) {
      console.error('Error al cargar categorías:', error);
      this.categories = [];
    }
  }

  // Cargar datos del grid 
  loadMaterialesData() {
    this.materialesData = [
      {
        id: 1,
        activo: true,
        categoria: '',
        familia: '',
        subFamilia: '',
        articulo: 'Material de prueba 1'
      },
      {
        id: 2,
        activo: false,
        categoria: '',
        familia: '',
        subFamilia: '',
        articulo: 'Material de prueba 2'
      }
    ];
  }

  // Grid config
  get gridOptions(): any {
    return {
      headerHeight: 35,
      rowHeight: 35,
      animateRows: true,
      singleClickEdit: true,
      suppressClickEdit: false,
      stopEditingWhenCellsLoseFocus: true,
      onRowSelected: (event: any) => {
        if (event.node.isSelected()) {
          this.onRowSelected(event);
        }
      },
      onCellValueChanged: (event: any) => {
        this.onCellValueChanged(event);
      }
    };
  }

  // Solo 5 columnas básicas
  get columnDefs(): ColDef[] {
    return [
      {
        headerName: 'Activo',
        field: 'activo',
        width: 80,
        cellEditor: 'agCheckboxCellEditor',
        editable: true
      },
      {
        headerName: 'Categoría',
        field: 'categoria',
        width: 150,
        editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: this.categories.map(cat => cat.description || '')
        }
      },
      {
        headerName: 'Familia',
        field: 'familia',
        width: 150,
        editable: true
      },
      {
        headerName: 'Sub Familia',
        field: 'subFamilia',
        width: 150,
        editable: true
      },
      {
        headerName: 'Artículo',
        field: 'articulo',
        width: 200,
        editable: true
      }
    ];
  }

  // Eventos del grid
  onRowSelected(event: any) {
    this.selectedRowData = event.data;
  }

  onCellValueChanged(event: any) {
    console.log('Celda cambiada:', event.data);
    this.notSavedChanges = true;
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  // CRUD Methods
  addNewMaterial() {
    const newId = Math.max(...this.materialesData.map(m => m.id), 0) + 1;
    const newMaterial = {
      id: newId,
      activo: true,
      categoria: '',
      familia: '',
      subFamilia: '',
      articulo: ''
    };
    
    this.materialesData = [newMaterial, ...this.materialesData];
    this.notSavedChanges = true;
    
    if (this.gridApi) {
      this.gridApi.setGridOption('rowData', this.materialesData);
    }
    
    alerts.basicAlert('Éxito', 'Nuevo material agregado', 'success');
  }

  deleteSelectedMaterial() {
    if (!this.selectedRowData) {
      alerts.basicAlert('Error', 'Seleccione un material para eliminar', 'warning');
      return;
    }
    
    this.materialesData = this.materialesData.filter(m => m.id !== this.selectedRowData.id);
    this.selectedRowData = null;
    this.notSavedChanges = true;
    
    if (this.gridApi) {
      this.gridApi.setGridOption('rowData', this.materialesData);
    }
    
    alerts.basicAlert('Éxito', 'Material eliminado', 'success');
  }

  saveChanges() {
    // Simular guardado
    this.notSavedChanges = false;
    alerts.basicAlert('Éxito', 'Cambios guardados correctamente', 'success');
  }

  revert() {
    this.loadMaterialesData();
    this.notSavedChanges = false;
    this.selectedRowData = null;
    
    if (this.gridApi) {
      this.gridApi.setGridOption('rowData', this.materialesData);
    }
    
    alerts.basicAlert('Información', 'Cambios revertidos', 'info');
  }
}