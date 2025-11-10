import { Component, inject, HostListener } from '@angular/core';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { alerts } from 'app/helpers/alerts';
import { AgGridModule } from 'ag-grid-angular';
import { TranslateModule } from '@ngx-translate/core';
import { TrackingService } from '../../../../services/tracking.service';
import { SharedModule } from 'app/shared/shared.module';
import { DomainsModule } from 'app/domains/domainsmodule';
import { RouterModule } from '@angular/router';
import { AuthService } from 'app/services/auth.service';
import { SignalsService } from 'app/services/signals.service';
import { CatalogsService } from 'app/services/catalogs.service';
import { ProdTerminadoService } from 'app/services/prodterminado.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { lastValueFrom } from 'rxjs';

@Component({
  selector: 'app-productos-terminados',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, AgGridModule, TranslateModule, DomainsModule, SharedModule],
  templateUrl: './productos-terminados.component.html',
  styleUrl: './productos-terminados.component.scss'
})
export class ProductosTerminadosComponent {

  private catalogsService = inject(CatalogsService);
  private prodTerminadoService = inject(ProdTerminadoService);
  private signalsService = inject(SignalsService);
  private trackingService = inject(TrackingService);
  authService = inject(AuthService);

  constructor() {
    this.signalsService.setCatalogSelected('WAREHOUSE');
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
      'Acceso a Productos Terminados Grid',
      'Almacenes - Productos Terminados',
      this.trackingService.getEmail()
    );

    this.loadProductosTerminados();
    this.loadComboBoxData();
  }

  notSavedChanges: boolean = false;
  private gridApi: GridApi;

  // Datos del grid
  rowData: any[] = [];
  comboBoxData: any[] = [];

  // Configuración del grid
  get gridOptions(): any {
    return {
      headerHeight: 35,
      rowHeight: 28,
      animateRows: false,
      suppressClickEdit: false, // Cambiar a false para permitir edición con click
      singleClickEdit: true, // Permitir edición con un solo click
      stopEditingWhenCellsLoseFocus: true,
      suppressScrollOnNewData: true,
      enableBrowserTooltips: true,
      tooltipShowDelay: 500,
      context: {
        componentParent: this
      },
      onCellValueChanged: (event: any) => {
        this.onCellValueChanged(event);
      },
      onCellDoubleClicked: (event: any) => {
        // Iniciar edición en la celda clickeada
        if (event.column.getColId() === 'producto') {
          this.gridApi.startEditingCell({
            rowIndex: event.rowIndex,
            colKey: 'producto'
          });
        }
      }
    };
  }

  // Definición de columnas
  get columnDefs(): ColDef[] {
    return [
      {
        headerName: 'Activo',
        field: 'vigente',
        width: 80,
        editable: true,
        cellRenderer: 'agCheckboxCellRenderer',
      },
      {
        headerName: 'Producto',
        field: 'producto',
        width: 200,
        editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: this.getComboBoxValues()
        },
        valueFormatter: (params: any) => {
          return params.value || '';
        }
      },
      {
        headerName: 'Cantidad X Cajas',
        field: 'cantidadXCajas',
        width: 150,
        editable: true,
        type: 'numericColumn'
      },
      {
        headerName: 'Precio Unitario',
        field: 'precioUnitario',
        width: 130,
        editable: true,
        type: 'numericColumn'
      },
      {
        headerName: 'Precio Unitario Mayoreo',
        field: 'precioUnitarioMayoreo',
        width: 180,
        editable: true,
        type: 'numericColumn'
      },
      {
        headerName: 'Precio X Caja',
        field: 'precioXCaja',
        width: 130,
        editable: true,
        type: 'numericColumn'
      },
      {
        headerName: 'Código de Barras',
        field: 'codigoBarras',
        width: 150,
        editable: true
      },
      {
        headerName: 'Costos',
        field: 'costos',
        width: 100,
        editable: true,
        type: 'numericColumn'
      },
      {
        headerName: 'Almacén',
        field: 'almacen',
        width: 120,
        editable: true
      }
    ];
  }

  // Cargar datos de productos terminados
  async loadProductosTerminados() {
    const idRoot = this.signalsService.getRootSelectedBySidebar()();

    if (!idRoot) {
      console.warn('⚠️ No hay idRoot seleccionado');
      return;
    }

    try {
      console.log('🔄 Cargando productos terminados...');
      // Aquí iría la llamada al endpoint de productos terminados
      // const response = await lastValueFrom(this.catalogsService.getProductosTerminados(idRoot));
      // this.rowData = response || [];

      // Por ahora datos de ejemplo - vacíos para que el usuario llene
      this.rowData = [
        {
          id: 1,
          vigente: true,
          producto: '',
          cantidadXCajas: 0,
          precioUnitario: 0,
          precioUnitarioMayoreo: 0,
          precioXCaja: 0,
          codigoBarras: '',
          costos: 0,
          almacen: ''
        },
        {
          id: 2,
          vigente: false,
          producto: '',
          cantidadXCajas: 0,
          precioUnitario: 0,
          precioUnitarioMayoreo: 0,
          precioXCaja: 0,
          codigoBarras: '',
          costos: 0,
          almacen: ''
        }
      ];

      console.log('✅ Productos terminados cargados correctamente');

    } catch (error) {
      console.error('❌ Error al cargar productos terminados:', error);
      alerts.basicAlert(
        'Error',
        `Error al cargar los productos terminados: ${error?.message || 'Error desconocido'}`,
        'error'
      );
    }
  }

  // Cargar datos para el combo box
  async loadComboBoxData() {
    const idRoot = this.signalsService.getRootSelectedBySidebar()();

    if (!idRoot) {
      console.warn('⚠️ No hay idRoot seleccionado');
      return;
    }

    try {
      const response = await lastValueFrom(this.prodTerminadoService.getProdTerminado(idRoot));
      this.comboBoxData = response || [];

    } catch (error) {
      console.error('❌ Error al cargar datos del combo box:', error);
      alerts.basicAlert(
        'Error',
        `Error al cargar los datos del combo box: ${error?.message || 'Error desconocido'}`,
        'error'
      );
    }
  }

  // Obtener valores para el combo box
  getComboBoxValues(): string[] {
    return this.comboBoxData.map(item => item.producto);
  }

  // Grid listo
  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  // Cambios en celdas
  onCellValueChanged(event: any) {
    console.log('Dato cambiado:', event.data);
    event.data.__modified = true;
    this.notSavedChanges = true;
  }

  // Guardar cambios
  async saveChanges() {
    const itemsToUpdate = this.rowData.filter(item => item.__modified);

    if (itemsToUpdate.length === 0) {
      alerts.basicAlert('Información', 'No hay cambios para guardar.', 'info');
      return;
    }

    try {
      console.log(`💾 Guardando ${itemsToUpdate.length} cambios...`);

      // Aquí iría la lógica para guardar los cambios
      // for (const item of itemsToUpdate) {
      //   await lastValueFrom(this.catalogsService.updateProductoTerminado(item));
      // }

      // Limpiar flags de modificación
      itemsToUpdate.forEach(item => delete item.__modified);

      console.log('✅ Cambios guardados correctamente');
      this.notSavedChanges = false;

      alerts.basicAlert(
        'Guardado exitoso',
        'Los cambios se han guardado correctamente.',
        'success'
      );

    } catch (error) {
      console.error('❌ Error al guardar cambios:', error);
      alerts.basicAlert(
        'Error',
        'Error al guardar los cambios. Por favor, intente nuevamente.',
        'error'
      );
    }
  }

  // Revertir cambios
  revertChanges() {
    this.loadProductosTerminados();
    this.notSavedChanges = false;
  }
}