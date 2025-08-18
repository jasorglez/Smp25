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
      'Almacenes - Materiales Maestro',
      this.trackingService.getEmail()
    );
    
    this.loadCatalogData();
  }

  notSavedChanges: boolean = false;
  private gridApi: GridApi;

  // Datos para combos
  categories: any[] = [];
  families: any[] = [];
  subfamilies: any[] = [];
  
  // Datos del grid maestro
  materialesData: any[] = [];
  selectedRowData: any = null;
  
  // Variables para manejar subconsultas en cascada
  currentSelectedCategory: any = null;
  currentSelectedFamily: any = null;
  
  // ID de la empresa actual
  private idRoot = this.signalsService.getRootSelectedBySidebar()();

  // Cargar datos del catálogo para combos
  async loadCatalogData() {
    if (!this.idRoot) return;
    
    try {
      // Cargar solo categorías inicialmente
      const categories = await lastValueFrom(this.catalogsService.getCatalogs(this.idRoot, 'CATEGORY'));
      this.categories = categories;
      
      console.log('Categorías cargadas:', this.categories.length);
      
      // Limpiar familias y subfamilias hasta que se seleccione una categoría
      this.families = [];
      this.subfamilies = [];
      
      // Cargar datos del grid maestro
      this.loadMaterialesData();
      
    } catch (error) {
      console.error('Error al cargar categorías:', error);
      this.categories = [];
      this.families = [];
      this.subfamilies = [];
      alerts.basicAlert(
        'Error',
        'Error al cargar las categorías.',
        'error'
      );
    }
  }

  // Cargar familias cuando se selecciona una categoría
  async loadFamiliesByCategory(categoryId: number) {
    if (!this.idRoot || !categoryId) return;
    
    try {
      const families = await lastValueFrom(this.catalogsService.getCatalogs(this.idRoot, 'FAM-CAT'));
      // Filtrar familias por categoría (asumiendo que tienen idParent o similar)
      this.families = families.filter((family: any) => family.idParent === categoryId);
      
      // Limpiar subfamilias
      this.subfamilies = [];
      this.currentSelectedCategory = this.categories.find(cat => cat.id === categoryId);
      
      console.log('Familias cargadas para categoría:', this.families.length);
      
    } catch (error) {
      console.error('Error al cargar familias:', error);
      this.families = [];
    }
  }

  // Cargar subfamilias cuando se selecciona una familia
  async loadSubfamiliesByFamily(familyId: number) {
    if (!this.idRoot || !familyId) return;
    
    try {
      const subfamilies = await lastValueFrom(this.catalogsService.getCatalogs(this.idRoot, 'SUB-FAM'));
      // Filtrar subfamilias por familia
      this.subfamilies = subfamilies.filter((subfamily: any) => subfamily.idParent === familyId);
      
      this.currentSelectedFamily = this.families.find(fam => fam.id === familyId);
      
      console.log('Subfamilias cargadas para familia:', this.subfamilies.length);
      
    } catch (error) {
      console.error('Error al cargar subfamilias:', error);
      this.subfamilies = [];
    }
  }

  // Cargar datos del grid maestro de materiales
  loadMaterialesData() {
    // Por ahora datos de prueba - después se conectará con el servicio real
    this.materialesData = [
      {
        id: 1,
        activo: true,
        categoria: 'Materia prima',
        familia: 'Básica',
        subFamilia: 'refresco',
        articulo: 'Cola concentrada',
        precioProveedor: 125.50,
        descripcionEtiquetado: 'Cola concentrada 500ml',
        numeroPiezasPorPaquete: 24,
        numeroMaterial: 'MAT-001',
        medidas: '500ml',
        pesosVolumenes: '0.5kg',
        caducidadGarantia: 12,
        imagen: null,
        sucursal: 'Principal',
        fechaAlta: new Date(),
        stockMinimo: 100,
        resumirDe: '',
        capacidadMaxAlmacen: 1000,
        tiempoEntregaSemanas: 2
      }
    ];
  }

  // Configuración del grid
  get gridOptions(): any {
    return {
      headerHeight: 35,
      rowHeight: 35,
      animateRows: true,
      // Grid editable
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

  // Definición de columnas del grid maestro (Columna por columna)
  get columnDefs(): ColDef[] {
    return [
      // COLUMNA 1: Activo (checkbox)
      {
        headerName: 'Activo',
        field: 'activo',
        width: 80,
        cellRenderer: (params: any) => {
          const checked = params.value ? 'checked' : '';
          return `<input type="checkbox" ${checked} style="cursor: pointer;" disabled>`;
        },
        cellEditor: 'agCheckboxCellEditor',
        editable: true,
        onCellValueChanged: (event: any) => {
          console.log('Activo cambiado:', event.data.activo);
          this.onCellValueChanged(event);
        }
      },
      
      // COLUMNA 2: Categoría (combo con endpoint)
      {
        headerName: 'Categoría',
        field: 'categoria',
        width: 150,
        editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: this.categories.map(cat => cat.description)
        },
        onCellValueChanged: async (event: any) => {
          console.log('Categoría seleccionada:', event.newValue);
          
          // Buscar el ID de la categoría seleccionada
          const selectedCategory = this.categories.find(cat => cat.description === event.newValue);
          if (selectedCategory) {
            // Cargar familias para esta categoría
            await this.loadFamiliesByCategory(selectedCategory.id);
            
            // Limpiar familia y subfamilia de la fila actual
            event.data.familia = '';
            event.data.subFamilia = '';
            
            // Refrescar el grid para actualizar las opciones
            if (this.gridApi) {
              this.gridApi.refreshCells();
            }
          }
          this.onCellValueChanged(event);
        }
      },
      
      // COLUMNA 3: Familia (combo con subconsulta)
      {
        headerName: 'Familia',
        field: 'familia',
        width: 150,
        editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: this.families.map(fam => fam.description)
        },
        onCellValueChanged: async (event: any) => {
          console.log('Familia seleccionada:', event.newValue);
          
          // Buscar el ID de la familia seleccionada
          const selectedFamily = this.families.find(fam => fam.description === event.newValue);
          if (selectedFamily) {
            // Cargar subfamilias para esta familia
            await this.loadSubfamiliesByFamily(selectedFamily.id);
            
            // Limpiar subfamilia de la fila actual
            event.data.subFamilia = '';
            
            // Refrescar el grid para actualizar las opciones
            if (this.gridApi) {
              this.gridApi.refreshCells();
            }
          }
          this.onCellValueChanged(event);
        }
      },
      
      // COLUMNA 4: Subfamilia (combo con subconsulta)
      {
        headerName: 'Sub Familia',
        field: 'subFamilia',
        width: 150,
        editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: this.subfamilies.map(sub => sub.description)
        },
        onCellValueChanged: (event: any) => {
          console.log('Subfamilia seleccionada:', event.newValue);
          this.onCellValueChanged(event);
        }
      },
      
      // COLUMNA 5: Artículo (texto)
      {
        headerName: 'Artículo',
        field: 'articulo',
        width: 200,
        editable: true
      },
      {
        headerName: 'Precio Proveedor (0 Kg)',
        field: 'precioProveedor',
        width: 180,
        editable: true,
        cellEditor: 'agNumberCellEditor'
      },
      {
        headerName: 'Descripción de Etiquetado',
        field: 'descripcionEtiquetado',
        width: 250,
        editable: true
      },
      {
        headerName: 'Número de Piezas por Paquete',
        field: 'numeroPiezasPorPaquete',
        width: 200,
        editable: true,
        cellEditor: 'agNumberCellEditor'
      },
      {
        headerName: 'Número de Material',
        field: 'numeroMaterial',
        width: 150,
        editable: true
      },
      {
        headerName: 'Medidas',
        field: 'medidas',
        width: 120,
        editable: true
      },
      {
        headerName: 'Pesos o Volúmenes en Kg o Lts',
        field: 'pesosVolumenes',
        width: 200,
        editable: true
      },
      {
        headerName: 'Caducidad o Garantía en Meses',
        field: 'caducidadGarantia',
        width: 200,
        editable: true,
        cellEditor: 'agNumberCellEditor'
      },
      {
        headerName: 'Imagen',
        field: 'imagen',
        width: 100,
        editable: false,
        cellRenderer: (params: any) => {
          return `<button class="btn btn-sm btn-outline-primary">📷</button>`;
        }
      },
      {
        headerName: 'Sucursal',
        field: 'sucursal',
        width: 120,
        editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: ['Principal', 'Sucursal 1', 'Sucursal 2'] // Después se cargará dinámicamente
        }
      },
      {
        headerName: 'Fecha de Alta',
        field: 'fechaAlta',
        width: 120,
        editable: true,
        cellEditor: 'agDateCellEditor'
      },
      {
        headerName: 'Stock Mínimo',
        field: 'stockMinimo',
        width: 120,
        editable: true,
        cellEditor: 'agNumberCellEditor'
      },
      {
        headerName: 'Resumir de',
        field: 'resumirDe',
        width: 150,
        editable: true
      },
      {
        headerName: 'Capacidad Máx Almacén',
        field: 'capacidadMaxAlmacen',
        width: 180,
        editable: true,
        cellEditor: 'agNumberCellEditor'
      },
      {
        headerName: 'Tiempo Entrega en Semanas',
        field: 'tiempoEntregaSemanas',
        width: 200,
        editable: true,
        cellEditor: 'agNumberCellEditor'
      }
    ];
  }

  // Selección de filas
  onRowSelected(event: any) {
    this.selectedRowData = event.data;
  }

  // Cambios en celdas
  onCellValueChanged(event: any) {
    console.log('Material modificado:', event.data);
    event.data.__modified = true;
    this.notSavedChanges = true;
  }

  // Grid listo
  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  // Agregar nuevo material
  addNewMaterial() {
    const newMaterial = {
      id: Date.now(), // ID temporal
      activo: true,
      categoria: '',
      familia: '',
      subFamilia: '',
      articulo: '',
      precioProveedor: 0,
      descripcionEtiquetado: '',
      numeroPiezasPorPaquete: 1,
      numeroMaterial: '',
      medidas: '',
      pesosVolumenes: '',
      caducidadGarantia: 12,
      imagen: null,
      sucursal: 'Principal',
      fechaAlta: new Date(),
      stockMinimo: 0,
      resumirDe: '',
      capacidadMaxAlmacen: 0,
      tiempoEntregaSemanas: 1,
      __isNew: true
    };

    this.materialesData = [newMaterial, ...this.materialesData];
    this.notSavedChanges = true;

    if (this.gridApi) {
      this.gridApi.setGridOption('rowData', this.materialesData);
    }
  }

  // Eliminar material seleccionado
  deleteSelectedMaterial() {
    if (!this.selectedRowData) {
      alerts.basicAlert(
        'Eliminar',
        'Por favor, seleccione un material para eliminar.',
        'error'
      );
      return;
    }

    const index = this.materialesData.findIndex(item => item.id === this.selectedRowData.id);
    if (index > -1) {
      this.materialesData.splice(index, 1);
      this.notSavedChanges = true;
      
      if (this.gridApi) {
        this.gridApi.setGridOption('rowData', this.materialesData);
      }
    }
  }

  // Guardar cambios
  saveChanges() {
    // Por ahora solo mostrar mensaje - después se conectará con el servicio
    alerts.basicAlert(
      'Guardado',
      'Cambios guardados correctamente.',
      'success'
    );
    this.notSavedChanges = false;
  }

  // Revertir cambios
  revert() {
    this.loadMaterialesData();
    this.notSavedChanges = false;
    this.selectedRowData = null;
  }
}