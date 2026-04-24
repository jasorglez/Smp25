import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent, ICellRendererParams } from 'ag-grid-enterprise';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { alerts } from 'app/helpers/alerts';
import { lastValueFrom } from 'rxjs';

@Component({
  selector: 'app-detalles-clientes',
  standalone: true,
  imports: [CommonModule, AgGridModule],
  template: `
    <div style="height: 280px; padding: 4px;">
      <div class="d-flex justify-content-end gap-2 mb-1">
        <button type="button"
          class="btn btn-success btn-sm position-relative"
          (click)="saveChanges()"
          [disabled]="!hasUnsavedChanges">
          <i class="bi bi-floppy"></i> Guardar
          <span
            class="position-absolute top-0 start-100 translate-middle p-2 bg-danger border border-light rounded-circle"
            *ngIf="hasUnsavedChanges">
          </span>
        </button>
      </div>
      <ag-grid-angular
        style="width: 100%; height: 100%;"
        class="ag-theme-quartz small-text-ag-grid detalles-clientes-grid"
        [rowData]="rowData"
        [columnDefs]="colDefs"
        [defaultColDef]="defaultColDef"
        [gridOptions]="gridOptions"
        (gridReady)="onGridReady($event)"
        [localeText]="AG_GRID_LOCALE_ES">
      </ag-grid-angular>
    </div>
  `
})
export class DetallesClientesComponent implements ICellRendererAngularComp {
  private readonly MANUAL_ESTADOS = ['RECIBIDO', 'CANCELADO', 'ALMACENADO', 'REVENDIDO', 'SOLICITADO'];
  private params!: ICellRendererParams;
  private gridApi!: GridApi;
  private context: any;
  private pedidoNumero: any = '-';

  rowData: any[] = [];
  hasUnsavedChanges: boolean = false;
  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  public defaultColDef: ColDef = {
    sortable: true,
    filter: true,
    resizable: true,
  };

  public gridOptions: any = {
    headerHeight: 28,
    rowHeight: 26,
    animateRows: true,
    // Como estaba antes: grupos colapsados por default
    groupDefaultExpanded: 0,
    // Footer por grupo (no total global al final)
    groupIncludeFooter: true,
    getRowStyle: (params: any) => {
      if (params.node?.footer) return { backgroundColor: '#d4edda', fontWeight: 'bold' };
      return null;
    },
    autoGroupColumnDef: {
      headerName: 'Cliente',
      minWidth: 200,
      pinned: 'left',
      cellRendererParams: {
        suppressCount: false,
        footerValueGetter: (params: any) => `Total — ${params.value}`,
      },
    },
    popupParent: typeof document !== 'undefined' ? document.body : undefined,
    onCellValueChanged: (event: any) => {
      // Solo aplica a filas de datos (no grupo/footer)
      if (event?.node?.group || event?.node?.footer) return;
      if (event?.colDef?.field !== 'estado') return;
      if (!event?.data) return;
      event.data.__modified = true;
      this.hasUnsavedChanges = true;
    },
  };

  public colDefs: ColDef[] = [
    {
      field: 'clienteName',
      rowGroup: true,
      hide: true,
    },
    {
      field: 'producto',
      headerName: 'Producto',
      flex: 2,
      minWidth: 150,
    },
    {
      headerName: 'Pedido',
      width: 100,
      valueGetter: (params) => params.node?.group ? null : this.pedidoNumero,
    },
    {
      field: 'cantidad',
      headerName: 'Cantidad',
      width: 90,
      type: 'numericColumn',
      valueFormatter: (params) => params.node?.group ? '' : (params.value ?? ''),
    },
    {
      field: 'plataforma',
      headerName: 'Plataforma',
      width: 130,
      valueFormatter: (params) => params.node?.group ? '' : (params.value ?? ''),
    },
    {
      field: 'costo',
      headerName: 'Costo',
      width: 110,
      type: 'numericColumn',
      aggFunc: 'sum',
      valueFormatter: (params) => {
        if (params.node?.group && !params.node?.footer) return '';
        return params.value != null
          ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(params.value)
          : '$0.00';
      },
    },
    {
      field: 'venta',
      headerName: 'Venta',
      width: 110,
      type: 'numericColumn',
      aggFunc: 'sum',
      valueFormatter: (params) => {
        if (params.node?.group && !params.node?.footer) return '';
        return params.value != null
          ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(params.value)
          : '$0.00';
      },
    },
    {
      field: 'estado',
      headerName: 'Estado',
      width: 120,
      valueFormatter: (params) => params.node?.group ? '' : (params.value ?? ''),
      editable: (params) => !params.node?.group && !params.node?.footer && !this.isBackendControlledState(params.data?.estado),
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: {
        values: this.MANUAL_ESTADOS
      },
      cellStyle: (params) => {
        if (params.node?.group) return {};
        if (params.value === 'RECIBIDO')   return { backgroundColor: '#d4edda' };
        if (params.value === 'CANCELADO')  return { backgroundColor: '#f8d7da' };
        if (params.value === 'ALMACENADO') return { backgroundColor: '#cce5ff' };
        if (params.value === 'REVENDIDO')  return { backgroundColor: '#fff3cd' };
        if (params.value === 'REMISION')   return { backgroundColor: '#ffe5b4' };
        if (params.value === 'ENTREGADO')  return { backgroundColor: '#d1ecf1' };
        return { backgroundColor: '#e2e3e5' };
      }
    },
  ];

  agInit(params: ICellRendererParams): void {
    console.log('[DetallesClientes] agInit called — params.data:', params.data, 'context:', params.context);
    this.params = params;
    this.context = params.context;
    this.pedidoNumero = params.data?.numero ?? '-';
    this.loadData();
  }

  onGridReady(params: GridReadyEvent): void {
    this.gridApi = params.api;
    console.log('[DetallesClientes] onGridReady — rowData.length:', this.rowData.length);
    if (this.rowData.length > 0) {
      console.log('[DetallesClientes] onGridReady — rowData already loaded, setting it now');
      this.gridApi.setGridOption('rowData', this.rowData);
      this.gridApi.refreshClientSideRowModel('group');
    }
    // Esconder la columna de suma(costo)
    this.gridApi.setColumnVisible('costo', false);
  }

  private loadData(): void {
    console.log('[DetallesClientes] loadData — context:', this.context, 'CONCEPTS:', this.context?.CONCEPTS);
    if (this.context?.CONCEPTS?.load) {
      const pedidoId = this.params.data.id;
      console.log('[DetallesClientes] calling CONCEPTS.load with pedidoId:', pedidoId);
      this.context.CONCEPTS.load(pedidoId, (data: any[]) => {
        console.log('[DetallesClientes] data received — count:', data.length, 'gridApi set?:', !!this.gridApi, 'sample:', data[0]);
        this.rowData = (data || []).map((r: any) => ({ ...r, __modified: false }));
        this.hasUnsavedChanges = false;
        if (this.gridApi) {
          console.log('[DetallesClientes] calling setGridOption rowData + refreshClientSideRowModel');
          this.gridApi.setGridOption('rowData', this.rowData);
          this.gridApi.refreshClientSideRowModel('group');
        } else {
          console.warn('[DetallesClientes] gridApi is null when data arrived — rowData stored, waiting for onGridReady');
        }
      });
    } else {
      console.warn('[DetallesClientes] context.CONCEPTS.load is not available — context:', this.context);
    }
  }

  private isBackendControlledState(estado: unknown): boolean {
    const normalized = String(estado ?? '').toUpperCase();
    return normalized === 'REMISION' || normalized === 'ENTREGADO';
  }

  private buildPayload(row: any) {
    return {
      id: row.id,
      idPedido: row.idPedido,
      idCliente: row.idCliente,
      producto: row.producto,
      cantidad: row.cantidad || 1,
      plataforma: row.plataforma,
      aplicaimpuestos: row.aplicaimpuestos,
      costo: row.costo || 0,
      venta: row.venta || 0,
      impuesto: row.impuesto || 0,
      estado: row.estado,
      comentario: row.comentario,
      active: row.active ?? true,
    };
  }

  async saveChanges(): Promise<void> {
    if (!this.hasUnsavedChanges) return;
    if (!this.context?.pedidosService?.updateDetalle) return;

    const dirty = (this.rowData || []).filter((r: any) => r?.__modified && r?.id);
    if (dirty.length === 0) {
      this.hasUnsavedChanges = false;
      return;
    }

    try {
      for (const row of dirty) {
        await lastValueFrom(this.context.pedidosService.updateDetalle(row.id, this.buildPayload(row)));
        row.__modified = false;
      }
      this.hasUnsavedChanges = false;
      if (this.gridApi) {
        this.gridApi.refreshCells({ force: true });
      }
      alerts.toastAlert('Estado actualizado correctamente', 'success');
    } catch (err) {
      console.error('[DetallesClientes] Error saving changes:', err);
      alerts.basicAlert('Error', 'No se pudo actualizar el estado', 'error');
    }
  }

  refresh(params: ICellRendererParams): boolean {
    // Cuando el master-detail reusa el renderer, AG Grid llama refresh con nuevos params.
    // Si no actualizamos params/context aquí, se queda mostrando el pedido anterior.
    this.params = params;
    this.context = params.context;
    this.pedidoNumero = params.data?.numero ?? '-';

    // Limpia para evitar “flash” de datos viejos mientras carga
    this.rowData = [];
    this.hasUnsavedChanges = false;
    if (this.gridApi) {
      this.gridApi.setGridOption('rowData', this.rowData);
      this.gridApi.refreshClientSideRowModel('group');
    }

    this.loadData();
    return true;
  }
}
