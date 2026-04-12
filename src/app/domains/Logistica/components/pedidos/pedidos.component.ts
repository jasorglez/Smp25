import { Component, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridModule, ICellRendererAngularComp } from 'ag-grid-angular';
import { FormsModule } from '@angular/forms';
import {
  ColDef,
  GridApi,
  GridReadyEvent,
  ICellRendererParams,
} from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { SignalsService } from 'app/services/signals.service';
import { PedidosService } from 'app/services/pedidos.service';
import { alerts } from 'app/helpers/alerts';
import { lastValueFrom, forkJoin } from 'rxjs';
import { CanComponentDeactivate } from 'app/guards/unsaved-changes.guard';
import { confirmExitIfUnsaved } from 'app/helpers/can-deactivate.helper';
import { TrackingService } from 'app/services/tracking.service';
import { CustomersService } from 'app/services/customers.service';
import { MaterialsService } from 'app/services/materials.service';
import { DetallesPedidosComponent } from './detalles-pedidos/detalles-pedidos.component';
import { NumArticulosRendererComponent } from './pedidos-button-num-articulos.component';

@Component({
  selector: 'app-pedidos-logistica',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, DetallesPedidosComponent, NumArticulosRendererComponent],
  templateUrl: './pedidos.component.html',
  styleUrls: ['./pedidos.component.scss'],
})
export class PedidosLogisticaComponent implements CanComponentDeactivate {
  private signalsService = inject(SignalsService);
  private pedidosService = inject(PedidosService);
  private trackingService = inject(TrackingService);
  private customersService = inject(CustomersService);
  private materialsService = inject(MaterialsService);
  
  ngOnInit() {
    (window as any).pedidosComponent = this;
  }

  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  idCompany: number = null;
  rowData: any[] = [];
  selectedRowData: any = null;
  hasUnsavedChanges: boolean = false;
  externalFilterActive: boolean = false;
  gridHeight: string = '75vh';
  tempIdCounter: number = 0;
  newlyAddedRows: string[] = [];
  detalleContext: any = null;
  expandedRowId: number | null = null;

  private gridApi: GridApi;
  private _colMaster: ColDef[] = [];
  public components = {
    detallesPedidosRenderer: DetallesPedidosComponent
  };

  public defaultColDef: ColDef = {
    sortable: true,
    filter: false,
    resizable: true,
    lockPosition: false,
    enableRowGroup: true,
    flex: 1,
  };

  public gridOptions: any = {
    headerHeight: 24,
    rowHeight: 24,
    animateRows: true,
    masterDetail: true,
    detailCellRenderer: DetallesPedidosComponent,
    detailRowHeight: 280,
    isRowMaster: (dataItem: any) => true,
    getRowClass: (params: any) => {
      if (params.node.isSelected()) {
        return 'selected-row';
      }
      return '';
    },
    onRowClicked: (event: any) => {
      event.node.setSelected(true);
    },
    onRowSelected: (event: any) => {
      if (event.node.isSelected()) {
        this.gridApi.forEachNode((node: any) => {
          if (node.id !== event.node.id) {
            node.setSelected(false);
          }
        });
      }
    },
  };

  public rowSelection: 'single' | 'multiple' = 'single';

  constructor() {
    effect(() => {
      const currentRoot = this.signalsService.getRootSelectedBySidebar()();
      if (currentRoot && currentRoot !== this.idCompany) {
        this.idCompany = currentRoot;
        this.loadData();
      }
    });
  }

  async loadData() {
    if (!this.idCompany) return;

    this.pedidosService.getPedidosByCompany(this.idCompany).subscribe({
      next: (response: any) => {
        // El backend devuelve { data: [...], count: n }
        const pedidos = response.data || response || [];
        this.rowData = pedidos.map((pedido: any) => ({
          ...pedido,
          detailData: [],
          visible: true
        }));
      },
      error: (error) => {
        console.error('Error loading pedidos:', error);
        alerts.basicAlert('Error', 'No se pudieron cargar los pedidos', 'error');
      },
    });
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    
    this.gridApi.setGridOption('detailCellRendererParams', {
      getDetailRowData: (params: any) => {
        const detailData = params.data?.detailData || [];
        params.successCallback(detailData);
      },
      context: {
        idCompany: this.idCompany,
        componentParent: this,
        gridApi: this.gridApi,
        pedidosService: this.pedidosService,
        trackingService: this.trackingService,
        customersService: this.customersService,
        materialsService: this.materialsService,
        CONCEPTS: {
          load: (idPedido: number, callback: (data: any[]) => void) => {
            this.loadDetallesData(idPedido, callback);
          },
          save: (idPedido: number, data: any) => {
            return this.saveDetallesById(idPedido, data);
          },
          delete: (params: any, callback: () => void, newCount?: number) => {
            this.deleteDetalleRow(params, callback, newCount);
          },
          updateCount: (idPedido: number, count: number) => {
            this.updatePedidoNumArticulos(idPedido, count);
          }
        }
      }
    });
  }

  onSelectionChanged(event: any) {
    const selectedNodes = event.api.getSelectedNodes();
    if (selectedNodes.length > 0) {
      this.selectedRowData = selectedNodes[0].data;
    } else {
      this.selectedRowData = null;
    }
  }

  get colMaster(): ColDef[] {
    if (this._colMaster.length > 0) {
      return this._colMaster;
    }

    this._colMaster = [
      {
        field: 'numero',
        headerName: 'Número',
        editable: true,
        flex: 1,
        minWidth: 120,
      },
      {
        field: 'fecha',
        headerName: 'Fecha',
        editable: true,
        flex: 1,
        minWidth: 120,
        valueFormatter: (params) => {
          if (!params.value) return '';
          const date = new Date(params.value);
          return date.toLocaleDateString('es-MX');
        },
      },
      {
        field: 'numArticulos',
        headerName: 'Número Materiales',
        editable: false,
        width: 140,
        cellRenderer: NumArticulosRendererComponent,
        cellRendererParams: {
          onClick: (node: any) => {
            console.log('🖱️ NumArticulosRenderer onClick - node.id:', node.data?.id);
            const parent = (window as any).pedidosComponent;
            if (parent && typeof parent.toggleDetalle === 'function') {
              parent.toggleDetalle(node);
            } else {
              // Fallback: direct expand
              node.setExpanded(!node.expanded);
            }
          }
        },
        cellStyle: { backgroundColor: '#e3f2fd' }
      },
      {
        field: 'comentario',
        headerName: 'Comentario',
        editable: true,
        flex: 2,
        minWidth: 200,
      },
      {
        field: 'active',
        headerName: 'Activo',
        editable: true,
        width: 100,
        cellRenderer: (params: ICellRendererParams) => {
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.checked = params.value === true || params.value === 1 || params.value === '1';
          checkbox.style.cursor = 'pointer';
          return checkbox;
        },
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: [true, false],
        },
        valueSetter: (params: any) => {
          params.data.active = params.newValue;
          return true;
        },
      },
    ];

    return this._colMaster;
  }

  onCellValueChanged(event: any) {
    event.data.__modified = true;
    this.hasUnsavedChanges = true;
  }

  add() {
    if (!this.gridApi) {
      console.error('Grid API not initialized');
      alerts.basicAlert('Error', 'El grid no está listo', 'error');
      return;
    }

    const tempId = `temp_${this.tempIdCounter++}`;
    const newPedido = {
      id: tempId,
      idCompany: this.idCompany,
      numero: '',
      fecha: new Date().toISOString().split('T')[0],
      comentario: '',
      active: true,
      __isNew: true,
    };

    this.rowData = [newPedido, ...this.rowData];
    this.newlyAddedRows.push(tempId);
    this.hasUnsavedChanges = true;
    this.gridApi.setGridOption('rowData', this.rowData);

    setTimeout(() => {
      this.gridApi.startEditingCell({
        rowIndex: 0,
        colKey: 'numero',
      });
    }, 0);
  }

  async saveChanges() {
    const newRows = this.rowData.filter((row) => row.__isNew);
    const modifiedRows = this.rowData.filter((row) => row.__modified && !row.__isNew);

    try {
      for (const row of newRows) {
        const dataToSend = {
          idCompany: row.idCompany,
          numero: row.numero,
          fecha: row.fecha,
          comentario: row.comentario,
          active: row.active,
        };
        await lastValueFrom(this.pedidosService.createPedido(dataToSend));
      }

      for (const row of modifiedRows) {
        const dataToSend = {
          idCompany: row.idCompany,
          numero: row.numero,
          fecha: row.fecha,
          comentario: row.comentario,
          active: row.active,
        };
        await lastValueFrom(this.pedidosService.updatePedido(row.id, dataToSend));
      }

      alerts.basicAlert('Guardado', 'Pedidos guardados correctamente', 'success');
      this.hasUnsavedChanges = false;
      this.newlyAddedRows = [];
      
      this.trackingService.addLog(
        this.trackingService.getnameComp(),
        'Guardar Pedidos',
        'Menu Logística Pedidos',
        this.trackingService.getEmail()
      );

      await this.loadData();
    } catch (error) {
      console.error('Error saving pedidos:', error);
      alerts.basicAlert('Error', 'No se pudieron guardar los pedidos', 'error');
    }
  }

  revertChanges() {
    this.loadData();
    this.hasUnsavedChanges = false;
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Cancelar Cambios en Pedidos',
      'Menu Logística Pedidos',
      this.trackingService.getEmail()
    );
  }

  delete() {
    if (!this.selectedRowData) {
      alerts.basicAlert('Eliminar', 'Seleccione un pedido para eliminar', 'warning');
      return;
    }

    if (this.selectedRowData.__isNew) {
      this.rowData = this.rowData.filter((row) => row.id !== this.selectedRowData.id);
      this.gridApi.setGridOption('rowData', this.rowData);
      this.hasUnsavedChanges = false;
      this.selectedRowData = null;
      return;
    }

    alerts
      .confirmAlert(
        'Eliminar Pedido',
        '¿Está seguro que desea eliminar este pedido?',
        'warning',
        'Sí, eliminar'
      )
      .then(async (result) => {
        if (result.isConfirmed) {
          try {
            await lastValueFrom(this.pedidosService.deletePedido(this.selectedRowData.id));
            alerts.basicAlert('Eliminado', 'Pedido eliminado correctamente', 'success');
            this.trackingService.addLog(
              this.trackingService.getnameComp(),
              'Eliminar Pedido',
              'Menu Logística Pedidos',
              this.trackingService.getEmail()
            );
            await this.loadData();
          } catch (error) {
            alerts.basicAlert('Error', 'No se pudo eliminar el pedido', 'error');
          }
        }
      });
  }

  async canDeactivate(): Promise<boolean> {
    return confirmExitIfUnsaved(this.hasUnsavedChanges);
  }

  toggleDetalle(node: any) {
    const api = this.gridApi;
    const isCurrentlyExpanded = node.expanded && node.data.detailType === 'pedidos';

    if (isCurrentlyExpanded) {
      node.setExpanded(false);
      node.data.detailType = null;
      api.forEachNode((n: any) => {
        n.setRowHeight(undefined);
      });
      api.onRowHeightChanged();
    } else {
      api.forEachNode((n: any) => {
        if (n.id !== node.id) {
          n.setRowHeight(0);
        }
      });

      if (node.expanded && node.data.detailType !== 'pedidos') {
        node.setExpanded(false);
      }

      node.data.detailType = 'pedidos';
      api.onRowHeightChanged();

      setTimeout(() => {
        node.setExpanded(true);
      }, 0);
    }
  }

  private updatePedidoNumArticulos(idPedido: number, count: number) {
    if (this.gridApi) {
      this.gridApi.forEachNode((node: any) => {
        if (node.data && node.data.id === idPedido) {
          node.data.numArticulos = count;
          this.gridApi.refreshCells({
            rowNodes: [node],
            columns: ['numArticulos'],
            force: true
          });
        }
      });
    }
  }

  private loadDetallesData(idPedido: number, successCallback: any) {
    this.pedidosService.getDetallesByPedido(idPedido).subscribe({
      next: (data: any) => {
        let detalles: any[] = [];
        if (data?.data) {
          if (Array.isArray(data.data)) {
            detalles = data.data;
          } else if (data.data.id) {
            detalles = [data.data];
          }
        }
        successCallback(detalles);
      },
      error: (error) => {
        console.error('Error loading detalles:', error);
        successCallback([]);
      }
    });
  }

  private saveDetallesById(idPedido: number, data: any): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        const detallesData = data.detalles || data;
        
        const newRows = detallesData.filter((row: any) => row.__isNew);
        const modifiedRows = detallesData.filter((row: any) => row.__modified && !row.__isNew);

        for (const row of newRows) {
          const dataToSend = {
            idPedido: idPedido,
            idCliente: row.idCliente,
            idProducto: row.idProducto,
            cantidad: row.cantidad || 1,
            plataforma: row.plataforma,
            aplicaimpuestos: row.aplicaimpuestos,
            comentario: row.comentario,
            active: row.active ?? true,
          };
          await lastValueFrom(this.pedidosService.createDetalle(dataToSend));
        }

        for (const row of modifiedRows) {
          const dataToSend = {
            id: row.id,
            idPedido: idPedido,
            idCliente: row.idCliente,
            idProducto: row.idProducto,
            cantidad: row.cantidad || 1,
            plataforma: row.plataforma,
            aplicaimpuestos: row.aplicaimpuestos,
            comentario: row.comentario,
            active: row.active,
          };
          await lastValueFrom(this.pedidosService.updateDetalle(row.id, dataToSend));
        }

        resolve();
      } catch (error) {
        console.error('Error saving detalles:', error);
        reject(error);
      }
    });
  }

  private deleteDetalleRow(contextParams: any, doneCallback: () => void, count?: number) {
    const rowId = contextParams.data.id;

    if (contextParams.data.__isNew) {
      if (contextParams.api) {
        contextParams.api.applyTransaction({ remove: [contextParams.data] });
      }
      doneCallback();
    } else {
      this.pedidosService.deleteDetalle(rowId).subscribe({
        next: () => {
          alerts.basicAlert('Eliminado', 'Detalle eliminado correctamente', 'success');
          if (contextParams.api) {
            contextParams.api.applyTransaction({ remove: [contextParams.data] });
          }
          doneCallback();
        },
        error: (err) => {
          console.error('Error deleting detalle:', err);
          alerts.basicAlert('Error', 'No se pudo eliminar el detalle', 'error');
        }
      });
    }
  }
}