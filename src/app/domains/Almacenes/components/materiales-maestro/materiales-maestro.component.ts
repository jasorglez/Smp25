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
  
  // ID de la empresa actual
  private idRoot = this.signalsService.getRootSelectedBySidebar()();

  // Cargar datos del catálogo para combos
  async loadCatalogData() {
    if (!this.idRoot) return;
    
    try {
      // Cargar los 3 tipos de datos en paralelo
      const [categories, families, subfamilies] = await Promise.all([
        lastValueFrom(this.catalogsService.getCatalogs(this.idRoot, 'CATEGORY')),
        lastValueFrom(this.catalogsService.getCatalogs(this.idRoot, 'FAM-CAT')),
        lastValueFrom(this.catalogsService.getCatalogs(this.idRoot, 'SUB-FAM'))
      ]);

      // Guardar datos para combos
      this.categories = categories;
      this.families = families;
      this.subfamilies = subfamilies;

      console.log('Datos cargados para combos:', {
        categories: this.categories.length,
        families: this.families.length,
        subfamilies: this.subfamilies.length
      });
      
      // Cargar datos del grid maestro (por ahora datos de prueba)
      this.loadMaterialesData();
      
    } catch (error) {
      console.error('Error al cargar datos del catálogo:', error);
      this.categories = [];
      this.families = [];
      this.subfamilies = [];
      alerts.basicAlert(
        'Error',
        'Error al cargar los datos del catálogo.',
        'error'
      );
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

  // Definición de columnas del grid maestro
  get columnDefs(): ColDef[] {
    return [
      {
        headerName: 'Activo',
        field: 'activo',
        width: 80,
        cellRenderer: (params: any) => {
          const checked = params.value ? 'checked' : '';
          return `<input type="checkbox" ${checked} style="cursor: pointer;">`;
        },
        editable: true
      },
      {
        headerName: 'Categoría',
        field: 'categoria',
        width: 150,
        editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: this.categories.map(cat => cat.description)
        }
      },
      {
        headerName: 'Familia',
        field: 'familia',
        width: 150,
        editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: this.families.map(fam => fam.description)
        }
      },
      {
        headerName: 'Sub Familia',
        field: 'subFamilia',
        width: 150,
        editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: this.subfamilies.map(sub => sub.description)
        }
      },
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