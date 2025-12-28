import { Component, effect, HostListener, inject } from '@angular/core';
import {
  CellDoubleClickedEvent,
  ColDef,
  GridApi,
  GridChartsModule,
  GridReadyEvent,
  ICellRendererParams,
} from 'ag-grid-enterprise';
import { alerts } from 'app/helpers/alerts';
import { catchError, concat, EMPTY, lastValueFrom, toArray } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { MultiLineEditorComponent } from 'app/shared/multi-line/multi-line-editor.component';
import { CatalogsService } from 'app/services/catalogs.service';
import { OcAndReqsService } from 'app/services/ocandreqs.service';
import { ProvidersService } from 'app/services/providers.service';
import { DepartmentsService } from 'app/services/departments.service';
import { CurrencyService } from 'app/services/currency.service';
import { SignalsService } from 'app/services/signals.service';
import { ModalService } from 'app/services/modal.service';
import { ReceiptsService } from 'app/services/receipts.service';
import { UsersService } from 'app/services/users.service';
import { MaterialsService } from 'app/services/materials.service';
import { SetupService } from 'app/services/setup.service';
import { CanComponentDeactivate } from 'app/guards/unsaved-changes.guard';
import { confirmExitIfUnsaved } from 'app/helpers/can-deactivate.helper';

interface Catalog {
  id: number;
  description: string;
}

interface Provider {
  id: number;
  name: string;
}

@Component({
  selector: 'app-purchaseorderdelison',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, MultiLineEditorComponent],
  templateUrl: './purchaseorderdelison.component.html',
  styleUrl: './purchaseorderdelison.component.scss',
})
export class PurchaseOrderDelisonComponent implements CanComponentDeactivate {
  // Inject of new way for Angular 18
  private requisitionsService = inject(OcAndReqsService);
  private providersService = inject(ProvidersService);
  private catalogsService = inject(CatalogsService);
  private departmentsService = inject(DepartmentsService);
  private currencyService = inject(CurrencyService);
  private signalsService = inject(SignalsService);
  private modalServiceTable = inject(ModalService);
  private receiptsService = inject(ReceiptsService);
  private usersService = inject(UsersService);
  private materialsService = inject(MaterialsService);
  private setupService = inject(SetupService);

  // Variables compartidas
  notSavedChanges: boolean = false;
  id: string = null;
  idBranch: number = null;
  idProject: number = null;
  idReference: number = null;
  private tempIdCounter: number = 0;
  idRequisition: number = null;
  private gridApi: GridApi;
  idRoot: number = null;
  projectOrBranch: boolean = null; // True = Project, False = Branch
  typeReference: string = null; // project or branch

  // Variables para grid jerárquico unificado
  hierarchicalData: any[] = [];
  selectedRowData: any = null;
  selectedNodeLevel: 'order' | 'detail' | null = null;
  newlyAddedRows: string[] = [];

  // Catálogos para combos
  requisiciones: any[] = [];
  proveedores: any[] = [];
  departamentos: any[] = [];
  ubicaciones: any[] = [];
  monedas: any[] = [];
  usuarios: any[] = [];
  tipoPago: any[] = [];

  // Catálogos Details
  productos: any[] = [];

  // Configuración Grid
  public rowSelection: 'single' | 'multiple' = 'single';
  public rowGroupPanelShow: 'always' | 'onlyWhenGrouping' | 'never' = 'always';
  public pivotPanelShow: 'always' | 'onlyWhenPivoting' | 'never' = 'always';
  public paginationPageSize = 15;
  public paginationPageSizeSelector: number[] | boolean = [15, 50, 100];

  constructor() {
    effect(() => {
      this.idRoot = this.signalsService.getRootSelectedBySidebar()();
      this.idProject = this.signalsService.getProjectSelectedBySidebar()();
      this.idBranch = this.signalsService.getBranchSelectedBySidebar()();
      this.idRequisition = this.signalsService.getIdRequisition()();
      this.getSetupData();
      this.idReference = this.projectOrBranch ? this.idProject : this.idBranch;

      this.loadHierarchicalData();
    });
  }

  ngOnInit() {
    this.idRoot = this.signalsService.getRootSelectedBySidebar()();
    this.signalsService.deleteRequisitionData();
    this.loadHierarchicalData();
    this.obtenerDepartamentos();
    this.obtenerUbicaciones();
    this.obtenerMonedas();
    this.obtenerUsuarios();
    this.obtenerRequisiciones();
    this.obtenerProveedores();
    this.obtenerTipoPago();
    this.obtenerProductos();
  }

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.notSavedChanges) {
      $event.returnValue =
        'Tienes cambios sin guardar. ¿Seguro que deseas salir?';
    }
  }

  // Configuración del grid jerárquico
  get gridOptions(): any {
    return {
      headerHeight: 35,
      rowHeight: 35,
      animateRows: true,
      treeData: false, // Usar estructura plana con niveles
      // Grid en modo solo lectura - sin edición inline
      suppressClickEdit: true,
      singleClickEdit: false,
      stopEditingWhenCellsLoseFocus: true,
      onRowSelected: (event: any) => {
        if (event.node.isSelected()) {
          this.onRowSelected(event);
        }
      },
      onCellValueChanged: (event: any) => {
        this.onCellValueChanged(event);
      },
      onCellDoubleClicked: (event: any) => {
        // Abrir modal de edición en doble click 
        if (event.data) {
          this.openEditModal(event.data);
        }
      }
    };
  }

  getSetupData() {
    this.setupService.getWarehouseSetup(this.idRoot).subscribe({
      next: (data: any) => {
        this.projectOrBranch = data[0].projectOrBranch;
        this.typeReference = this.projectOrBranch ? 'project' : 'branch';
        console.log(this.projectOrBranch);
      },
      error: (err) => {
        if (err.status === 404) {
          console.error(err);
          alerts.basicAlert(
            'Purchase Order Delison',
            'No se encontró la configuración de almacenes de la empresa.',
            'error'
          );
        }
      },
    });
  }

  nameRequisition = this.signalsService.getRequisitionName();

  // Definición de columnas jerárquicas
  get columnDefs(): ColDef[] {
    return [
      {
        headerName: 'Orden de Compra Delison',
        field: 'orderDisplay',
        width: 300,
        cellRenderer: (params: any) => {
          if (params.data.nodeLevel === 'order') {
            const childCount = this.getDetailCountForOrder(params.data.originalId);
            const isExpanded = params.data.isExpanded || false;
            const chevron = isExpanded ? '▼' : '▶';
            return `<span class="chevron-icon" data-action="toggle" style="cursor: pointer; margin-right: 5px;">${chevron}</span> ${params.data.folio} (${childCount})`;
          }
          return '';
        },
        onCellClicked: (event: any) => {
          if (event.event.target.classList.contains('chevron-icon') || 
              event.event.target.getAttribute('data-action') === 'toggle') {
            this.toggleOrderExpansion(event.data);
          }
        }
      },
      {
        headerName: 'Producto/Detalle',
        field: 'productDisplay',
        width: 300,
        cellRenderer: (params: any) => {
          if (params.data.nodeLevel === 'detail') {
            const productName = this.productos.find(p => p.id === params.data.idSupplie)?.description || 'Sin producto';
            return `<span style="margin-right: 15px;"></span> ${productName}`;
          }
          return '';
        }
      },
      {
        headerName: 'Proveedor',
        field: 'providerDisplay',
        width: 200,
        cellRenderer: (params: any) => {
          if (params.data.nodeLevel === 'order') {
            const provider = this.proveedores.find(p => p.id === params.data.idProvider);
            return provider ? provider.name : '';
          }
          return '';
        }
      },
      {
        headerName: 'Fecha',
        field: 'dateDisplay',
        width: 150,
        cellRenderer: (params: any) => {
          if (params.data.nodeLevel === 'order') {
            return params.data.dateCreate ? params.data.dateCreate.split('T')[0] : '';
          }
          return '';
        }
      },
      {
        headerName: 'Cantidad',
        field: 'quantityDisplay',
        width: 100,
        cellRenderer: (params: any) => {
          if (params.data.nodeLevel === 'detail') {
            return params.data.quantity || '';
          }
          return '';
        }
      },
      {
        headerName: 'Precio',
        field: 'priceDisplay',
        width: 120,
        cellRenderer: (params: any) => {
          if (params.data.nodeLevel === 'detail') {
            return params.data.price ? `$${params.data.price.toFixed(2)}` : '';
          }
          return '';
        }
      },
      {
        headerName: 'Total',
        field: 'totalDisplay',
        width: 120,
        cellRenderer: (params: any) => {
          if (params.data.nodeLevel === 'detail') {
            return params.data.total ? `$${params.data.total.toFixed(2)}` : '';
          } else if (params.data.nodeLevel === 'order') {
            // Calcular total de la orden
            const orderTotal = this.calculateOrderTotal(params.data.originalId);
            return orderTotal ? `$${orderTotal.toFixed(2)}` : '';
          }
          return '';
        }
      }
    ];
  }

  // ========== MÉTODOS PARA ESTRUCTURA JERÁRQUICA ==========
  
  // Cargar datos jerárquicos unificados
  async loadHierarchicalData() {
    if (!this.idRoot) return;
    
    try {
      // Cargar órdenes y detalles en paralelo
      const [orders, allDetails] = await Promise.all([
        lastValueFrom(this.requisitionsService.getOcAndReqs(this.typeReference, this.idReference, 'OC')),
        this.getAllOrderDetails()
      ]);

      // Construir estructura jerárquica
      this.buildHierarchicalStructure(orders as any[], allDetails);
      
    } catch (error) {
      console.error('Error al cargar datos jerárquicos:', error);
      this.hierarchicalData = [];
      alerts.basicAlert(
        'Error',
        'Error al cargar los datos de órdenes de compra.',
        'error'
      );
    }
  }

  // Obtener todos los detalles de todas las órdenes
  private async getAllOrderDetails(): Promise<any[]> {
    try {
      // Obtenemos todas las órdenes primero para obtener los detalles
      const orders = await lastValueFrom(
        this.requisitionsService.getOcAndReqs(this.typeReference, this.idReference, 'OC')
      ) as any[];
      
      const allDetailsPromises = orders.map(order => 
        lastValueFrom(this.requisitionsService.getReqItems(order.id))
      );
      
      const allDetailsArrays = await Promise.all(allDetailsPromises);
      return allDetailsArrays.flat();
      
    } catch (error) {
      console.error('Error al cargar detalles:', error);
      return [];
    }
  }

  // Construir estructura plana para 2 niveles con control de expansión
  private buildHierarchicalStructure(orders: any[], allDetails: any[]) {
    this.hierarchicalData = [];
    
    // Agregar órdenes (nivel 1) - siempre visibles
    orders.forEach(order => {
      const orderNode = {
        ...order,
        nodeLevel: 'order',
        originalId: order.id,
        isExpanded: true, // Por defecto expandido
        isVisible: true
      };
      this.hierarchicalData.push(orderNode);
      
      // Buscar detalles de esta orden (nivel 2)
      const orderDetails = allDetails.filter(detail => detail.idMovement === order.id);
      
      orderDetails.forEach(detail => {
        const detailNode = {
          ...detail,
          nodeLevel: 'detail',
          originalId: detail.id,
          parentOrderId: order.id,
          isVisible: true
        };
        this.hierarchicalData.push(detailNode);
      });
    });

    console.log('Estructura jerárquica construida:', this.hierarchicalData);
  }

  // Retornar datos filtrados por visibilidad para AG-Grid
  flattenHierarchicalData(): any[] {
    return this.hierarchicalData.filter(item => item.isVisible);
  }

  // Métodos para manejar expand/collapse
  toggleOrderExpansion(orderData: any) {
    const order = this.hierarchicalData.find(item => 
      item.nodeLevel === 'order' && item.originalId === orderData.originalId
    );
    
    if (order) {
      order.isExpanded = !order.isExpanded;
      
      // Mostrar/ocultar detalles de esta orden
      this.hierarchicalData.forEach(item => {
        if (item.nodeLevel === 'detail' && item.parentOrderId === order.originalId) {
          item.isVisible = order.isExpanded;
        }
      });
      
      // Refrescar el grid
      if (this.gridApi) {
        this.gridApi.setGridOption('rowData', this.flattenHierarchicalData());
      }
    }
  }

  // ========== MÉTODOS HELPER PARA CONTADORES ==========
  
  // Contar detalles de una orden
  private getDetailCountForOrder(orderId: string | number): number {
    if (!this.hierarchicalData || !orderId) return 0;
    
    return this.hierarchicalData.filter(item => 
      item.nodeLevel === 'detail' && item.parentOrderId === orderId
    ).length;
  }
  
  // Calcular total de una orden
  calculateOrderTotal(orderId: string | number): number {
    if (!this.hierarchicalData || !orderId) return 0;
    
    return this.hierarchicalData
      .filter(item => item.nodeLevel === 'detail' && item.parentOrderId === orderId)
      .reduce((total, detail) => total + (detail.total || 0), 0);
  }

  // Obtener nombre del proveedor
  getProviderName(providerId: number): string {
    if (!providerId || !this.proveedores) return 'Sin proveedor';
    const provider = this.proveedores.find(p => p.id === providerId);
    return provider ? provider.name : 'Sin proveedor';
  }

  // Obtener nombre del producto
  getProductName(productId: number): string {
    if (!productId || !this.productos) return 'Sin producto';
    const product = this.productos.find(p => p.id === productId);
    return product ? product.description : 'Sin producto';
  }

  // Selección de filas
  onRowSelected(event: any) {
    this.selectedRowData = event.data;
    if (event.data) {
      this.selectedNodeLevel = event.data.nodeLevel || 'order';
    } else {
      this.selectedNodeLevel = null;
    }
  }

  // Cambios en celdas
  onCellValueChanged(event: any) {
    console.log('Dato cambiado:', event.data);
    event.data.__modified = true;
    this.notSavedChanges = true;
  }

  // Grid listo
  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  // ========== MÉTODOS PARA MODALES ==========
  
  // Agregar nuevo elemento según nivel seleccionado
  addItem() {
    if (!this.selectedRowData) {
      this.openAddOrderModal(); // Si no hay selección, agregar orden
      return;
    }

    switch (this.selectedNodeLevel) {
      case 'order':
        this.openAddDetailModal();
        break;
      case 'detail':
        this.openAddDetailModal();
        break;
      default:
        this.openAddOrderModal();
    }
  }

  // Abrir modal para nueva orden
  openAddOrderModal() {
    alerts.basicAlert('Información', 'Funcionalidad de agregar orden pendiente de implementar.', 'info');
  }
  
  // Abrir modal para nuevo detalle
  openAddDetailModal() {
    if (!this.selectedRowData || this.selectedNodeLevel !== 'order') {
      alerts.basicAlert('Error', 'Seleccione una orden para agregar un detalle.', 'warning');
      return;
    }
    alerts.basicAlert('Información', 'Funcionalidad de agregar detalle pendiente de implementar.', 'info');
  }
  
  // Abrir modal de edición
  openEditModal(item: any) {
    if (!item) return;
    alerts.basicAlert('Información', 'Funcionalidad de edición pendiente de implementar.', 'info');
  }

  // ========== MÉTODOS CRUD PRINCIPALES ==========

  // Guardar cambios
  async saveChanges() {
    alerts.basicAlert('Información', 'Funcionalidad de guardado pendiente de implementar.', 'info');
  }

  // Revertir cambios
  revertChanges() {
    this.loadHierarchicalData();
    this.notSavedChanges = false;
    this.newlyAddedRows = [];
    this.selectedRowData = null;
    this.selectedNodeLevel = null;
    alerts.basicAlert('Cambios revertidos', 'Se han revertido todos los cambios.', 'info');
  }

  // Eliminar elemento seleccionado
  async deleteSelectedItem() {
    if (!this.selectedRowData) {
      alerts.basicAlert(
        'Error',
        'Por favor, seleccione un elemento para eliminar.',
        'warning'
      );
      return;
    }
    alerts.basicAlert('Información', 'Funcionalidad de eliminación pendiente de implementar.', 'info');
  }

  createOC(idRequisition: number, action: string) {
    this.receiptsService.generateOC(idRequisition, action);
  }

  // ==================== LEGACY METHODS (mantener por compatibilidad) ====================

  obtenerDatos() {
    // Método legacy - ahora usa loadHierarchicalData()
    this.loadHierarchicalData();
  }

  obtenerRequisiciones() {
    this.requisitionsService
      .getOcAndReqs(this.typeReference, this.idReference, 'REQUIS')
      .subscribe(
        (data: any) => {
          this.requisiciones = data;
          console.log(this.requisiciones);
        },
        (error) => console.error('Error fetching requisitions:', error)
      );
  }

  obtenerProveedores() {
    this.providersService.getProviders(this.idRoot).subscribe(
      (data: any) => {
        this.proveedores = data;
        console.log(this.proveedores);
      },
      (error) => console.error('Error fetching requisitions:', error)
    );
  }

  obtenerUsuarios() {
    this.usersService.getDataUsers(this.idRoot).subscribe(
      (response: any) => {
        this.usuarios = response.data;
      },
      (error) => console.error('Error fetching users:', error)
    );
  }

  obtenerDepartamentos() {
    this.departmentsService.getDepartments(this.idRoot).subscribe(
      (data: Provider[]) => {
        this.departamentos = data;
        console.log(this.departamentos);
      },
      (error) => console.error('Error fetching departments:', error)
    );
  }

  obtenerUbicaciones() {
    this.catalogsService.getLocations().subscribe(
      (data: Catalog[]) => {
        this.ubicaciones = data;
      },
      (error) => console.error('Error fetching locations:', error)
    );
  }

  obtenerMonedas() {
    this.currencyService.getCurrencies(this.idRoot).subscribe(
      (data: Catalog[]) => {
        this.monedas = data;
      },
      (error) => console.error('Error fetching currencies:', error)
    );
  }

  obtenerTipoPago() {
    this.currencyService.getPaymentTypes(this.idRoot).subscribe(
      (data: Catalog[]) => {
        this.tipoPago = data;
      },
      (error) => console.error('Error fetching payment types:', error)
    );
  }

  obtenerProductos() {
    this.materialsService.getMaterials2Fields(this.idRoot).subscribe(
      (data: Catalog[]) => {
        this.productos = data;
        console.log(data);
      },
      (error) => console.error('Error fetching materials:', error)
    );
  }

  // ==================== UTILITY METHODS ====================

  private cleanDataForServer(data: any): any {
    const cleanedData = { ...data };
    delete cleanedData.__isNew;
    delete cleanedData.__modified;
    if (cleanedData.id && cleanedData.id.toString().startsWith('temp_')) {
      delete cleanedData.id;
    }
    return cleanedData;
  }

  // ==================== GUARD ALERT UNSAVED CHANGES ====================

  async canDeactivate(): Promise<boolean> {
    return confirmExitIfUnsaved(this.notSavedChanges);
  }
}
