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
import { DetailCellRendererPrecioMayoreoComponent } from './details/detail-cell-renderer-precio-mayoreo.component';
import { DetailCellRendererCodigoBarrasComponent } from './details/detail-cell-renderer-codigo-barras.component';
import { DetailCellRendererCostosAlmacenComponent } from './detail-cell-renderer-costos-almacen.component';

@Component({
  selector: 'app-productos-terminados',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, AgGridModule, TranslateModule, DomainsModule, SharedModule, DetailCellRendererPrecioMayoreoComponent, DetailCellRendererCodigoBarrasComponent, DetailCellRendererCostosAlmacenComponent],
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
  private secondaryGridApi: GridApi;

  // Datos del grid
  rowData: any[] = [];
  comboBoxData: any[] = [];
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
      masterDetail: true,
      isRowMaster: (dataItem) => {
        // Una fila es maestra si tiene precio de mayoreo, código de barras o costos.
        return dataItem && (dataItem.precioUnitarioMayoreo != null || dataItem.codigoBarras || dataItem.costos);
      },
      detailCellRendererSelector: (params) => {
        if (params.data.detailType === 'precioMayoreo') {
          return { component: DetailCellRendererPrecioMayoreoComponent };
        }
        if (params.data.detailType === 'codigoBarras') {
          return { component: DetailCellRendererCodigoBarrasComponent };
        }
        if (params.data.detailType === 'costosAlmacen') {
          return { component: DetailCellRendererCostosAlmacenComponent };
        }
        return undefined;
      },
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

  // Definición de columnas para el grid principal
  get columnDefs(): ColDef[] {
    return [
      {
        headerName: 'Activo',
        field: 'vigente',
        width: 120,
        editable: true,
        cellRenderer: 'agCheckboxCellRenderer',
      },
      {
        headerName: 'id de Producto',
        field: 'cantidadXCajas',
        width: 150,
        editable: true,
        type: 'numericColumn'
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
        type: 'numericColumn',
        valueFormatter: (params: any) => {
          return params.value ? `$${params.value}` : '$0';
        }
      },
      {
        headerName: 'Precio Unitario Mayoreo',
        field: 'precioUnitarioMayoreo',
        width: 180,
        editable: false,
        type: 'numericColumn',
        valueFormatter: (params: any) => {
          return params.value != null ? `$${params.value}` : '$0';
        },
        // Renderer personalizado para dar estilo y manejar el click
        cellRenderer: (params: any): HTMLElement => {
          const div = document.createElement('div');
          const displayValue = params.value != null ? `$${params.value}` : '$0';
          div.innerText = displayValue;
          div.style.cursor = 'pointer';
          div.style.textDecoration = 'underline';
          div.style.color = '#0d6efd'; // Color azul para simular un link
          div.style.fontWeight = '500';
          return div;
        }
      },
      {
        headerName: 'Precio X Caja',
        field: 'precioXCaja',
        width: 130,
        editable: true,
        type: 'numericColumn',
        valueFormatter: (params: any) => {
          return params.value ? `$${params.value}` : '$0';
        }
      },
      {
        headerName: 'Código de Barras',
        field: 'codigoBarras',
        width: 150,
        editable: false,
        cellRenderer: (params: any): HTMLElement => {
          const div = document.createElement('div');
          div.innerText = params.value || '';
          div.style.cursor = 'pointer';
          div.style.textDecoration = 'underline';
          div.style.color = '#0d6efd';
          div.style.fontWeight = '500';
          return div;
        }
      },
      {
        headerName: 'Costos y Almacén',
        field: 'costos',
        width: 150,
        editable: false,
        type: 'numericColumn',
        valueFormatter: (params: any) => {
          return params.value ? `$${params.value}` : '$0';
        },
        cellRenderer: (params: any): HTMLElement => {
          const div = document.createElement('div');
          div.innerText = params.value ? `$${params.value}` : '$0';
          div.style.cursor = 'pointer';
          div.style.textDecoration = 'underline';
          div.style.color = '#0d6efd';
          div.style.fontWeight = '500';
          return div;
        },
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
      // Aquí iría la llamada al endpoint de productos terminados
      // const response = await lastValueFrom(this.catalogsService.getProductosTerminados(idRoot));
      // this.rowData = response || [];

      // Por ahora datos de ejemplo - vacíos para que el usuario llene
      this.rowData = [
        {
          id: 1,
          vigente: true,
          producto: 'Producto A',
          cantidadXCajas: 10,
          precioUnitario: 100,
          precioUnitarioMayoreo: 90,
          precioXCaja: 1000,
          codigoBarras: '1234567890123',
          costos: 80,
          almacen: 'Almacén 1'
        },
        {
          id: 2,
          vigente: true,
          producto: 'Producto B',
          cantidadXCajas: 20,
          precioUnitario: 200,
          precioUnitarioMayoreo: 180,
          precioXCaja: 4000,
          codigoBarras: '1234567890124',
          costos: 160,
          almacen: 'Almacén 2'
        },
        {
          id: 3,
          vigente: false,
          producto: 'Producto C',
          cantidadXCajas: 15,
          precioUnitario: 150,
          precioUnitarioMayoreo: 135,
          precioXCaja: 2250,
          codigoBarras: '1234567890125',
          costos: 120,
          almacen: 'Almacén 3'
        },
        {
          id: 4,
          vigente: true,
          producto: 'Producto D',
          cantidadXCajas: 25,
          precioUnitario: 250,
          precioUnitarioMayoreo: 225,
          precioXCaja: 6250,
          codigoBarras: '1234567890126',
          costos: 200,
          almacen: 'Almacén 4'
        },
        {
          id: 5,
          vigente: true,
          producto: 'Producto E',
          cantidadXCajas: 30,
          precioUnitario: 300,
          precioUnitarioMayoreo: 270,
          precioXCaja: 9000,
          codigoBarras: '1234567890127',
          costos: 240,
          almacen: 'Almacén 5'
        }
      ];


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

    // Configurar master-detail después de que el grid esté listo
    this.gridApi.setGridOption('detailCellRendererParams', {
      getDetailRowData: (params) => {
        params.successCallback(params.data.detailData || []);
      },
      context: {
        componentParent: this
      }
    });
  }

  // Cambios en celdas
  onCellValueChanged(event: any) {
    event.data.__modified = true;
    this.notSavedChanges = true;

    // Implementar cascada para precioUnitarioMayoreo basado en precioUnitario
    if (event.colDef.field === 'precioUnitario') {
      const precioUnitario = event.newValue || 0;
      // Aplicar descuento del 10% para mayoreo (similar al comportamiento estudiado)
      event.data.precioUnitarioMayoreo = precioUnitario * 0.9;
      // Refrescar la celda para mostrar el cambio
      this.gridApi.refreshCells({ rowNodes: [event.node], force: true });
    }
  }

  // Manejar click en celda para mostrar/ocultar detalle
  onCellClicked(event: any): void {
    const colId = event.column.getColId();

    // Si es la columna de Precio Unitario Mayoreo, mostrar/ocultar detalle
    if (colId === 'precioUnitarioMayoreo') {
      const node = event.node;
      if (node) {
        // 1. Asignar el tipo de detalle para que el selector sepa qué componente renderizar.
        event.data.detailType = 'precioMayoreo';
        
        // 2. Expandir o colapsar la fila manualmente.
        node.setExpanded(!node.expanded);
      }
    }

    if (colId === 'codigoBarras') {
      const node = event.node;
      if (node) {
        // 1. Asignar el tipo de detalle para que el selector sepa qué componente renderizar.
        event.data.detailType = 'codigoBarras';
        // 2. Expandir o colapsar la fila manualmente.
        node.setExpanded(!node.expanded);
      }
    }

    if (colId === 'costos') {
      const node = event.node;
      if (node) {
        // 1. Asignar el tipo de detalle para que el selector sepa qué componente renderizar.
        event.data.detailType = 'costosAlmacen';
        // 2. Expandir o colapsar la fila manualmente.
        node.setExpanded(!node.expanded);
      }
    }
  }

  // Guardar cambios
  async saveChanges() {
    const itemsToUpdate = this.rowData.filter(item => item.__modified);

    if (itemsToUpdate.length === 0) {
      alerts.basicAlert('Información', 'No hay cambios para guardar.', 'info');
      return;
    }

    try {

      // Aquí iría la lógica para guardar los cambios
      // for (const item of itemsToUpdate) {
      //   await lastValueFrom(this.catalogsService.updateProductoTerminado(item));
      // }

      // Limpiar flags de modificación
      itemsToUpdate.forEach(item => delete item.__modified);

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
