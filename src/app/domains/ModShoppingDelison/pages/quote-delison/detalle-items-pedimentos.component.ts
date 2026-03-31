import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ICellRendererAngularComp, AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent, ICellRendererParams } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { OcAndReqsService } from 'app/services/ocandreqs.service';
import { firstValueFrom } from 'rxjs';
import { alerts } from 'app/helpers/alerts';

@Component({
  selector: 'app-detalle-items-pedimentos',
  standalone: true,
  imports: [CommonModule, AgGridModule],
  template: `
    <div class="detail-grid-container">
      <!-- Barra de botones CRUD -->
      <div style="margin-bottom: 5px; display: flex; justify-content: flex-end; align-items: center; flex-shrink: 0;">
        <div class="d-flex gap-1">
          <button class="btn btn-primary btn-xs position-relative" (click)="save()" [disabled]="!hasUnsavedChanges">
            <i class="bi bi-floppy"></i> Guardar
            <span class="position-absolute top-0 start-100 translate-middle p-1 bg-danger border border-light rounded-circle"
                  *ngIf="hasUnsavedChanges">
            </span>
          </button>
          <button class="btn btn-warning btn-xs" (click)="revert()">
            <i class="bi bi-arrow-clockwise"></i> Deshacer
          </button>
          <button class="btn btn-danger btn-xs" (click)="delete()" [disabled]="!selectedRow">
            <i class="bi bi-trash"></i> Eliminar
          </button>
        </div>
      </div>

      <!-- Grid con tamaño completo -->
      <div style="flex: 1 1 auto; min-height: 0; position: relative; overflow: hidden;">
        <ag-grid-angular
          class="ag-theme-quartz small-text-ag-grid"
          [rowData]="rowData"
          [columnDefs]="colDefs"
          [gridOptions]="gridOptions"
          [localeText]="AG_GRID_LOCALE_ES"
          (gridReady)="onGridReady($event)"
          style="width: 100%; height: 100%; position: absolute; top: 0; left: 0; right: 0; bottom: 0;">
        </ag-grid-angular>
      </div>
    </div>
  `,
  styles: [`
    .detail-grid-container {
      padding: 5px;
      background-color: #f8f9fa;
      border-radius: 8px;
      height: 100%;
      max-height: 100%;
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
      overflow: hidden;
    }
    .btn-xs {
      padding: 0.15rem 0.4rem;
      font-size: 0.75rem;
      line-height: 1.3;
    }
  `]
})
export class DetalleItemsPedimentosComponent implements ICellRendererAngularComp {
  private params!: ICellRendererParams;
  private context: any;
  private gridApi!: GridApi;
  private ocAndReqsService = inject(OcAndReqsService);

  // Cache para evitar re-renderizado
  private _colDefs: ColDef[] | null = null;

  rowData: any[] = [];
  originalRowData: any[] = [];
  hasUnsavedChanges: boolean = false;
  selectedRow: any = null;
  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  // IDs necesarios para las operaciones de API
  cotizacionId: number = 0;
  requisitionId: number = 0;
  numeroPedimentoRaw: number = 0;

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.context = params.context;
    this.cotizacionId = params.data.cotizacionId || 0;
    this.requisitionId = params.data.requisitionId || 0;
    this.numeroPedimentoRaw = params.data.numeroPedimentoRaw || 0;
    this.buildRowData();
  }

  refresh(): boolean {
    return false;
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  buildRowData() {
    const articulos = (this.params.data.articulos || []).filter(
      (item: any) => (item.intorext || item.tipo || '').toLowerCase() !== 'interno'
    );
    console.log('📋 buildRowData - articulos recibidos:', articulos);

    // Mapear todos los items (excluidos los de tipo Interno)
    const mappedItems = articulos.map((item: any, index: number) => {
      return {
        id: item.id,
        idSupplie: item.idSupplie || 0,
        nameArticle: item.nameArticle || '',
        recurrent: item.recurrent || '',
        articulo: item.nameArticle || item.description || item.article,
        numeroArticulo: item.recurrent === 'Nuevo' ? '' : (item.numArticle || (index + 1)),
        cantidad: item.quantity,
        tipo: item.intorext || item.tipo,
        proveedorInterno: item.proveedorInterno,
        tipoPrioridad: item.typePriority || item.priority,
        comment: item.comment || item.observation || item.observaciones || '',
        pedimento: item.pedimento || false,
        pedimentoNumber: item.pedimentoNum || '',
        numeroPedimento: this.params.data.numeroPedimentoRaw,
        // Guardar el item original completo para el PUT
        _rawItem: item
      };
    });

    // Ordenar: items solicitados (pedimento: true) primero
    this.rowData = mappedItems.sort((a: any, b: any) => {
      if (a.pedimento === b.pedimento) return 0;
      return a.pedimento ? -1 : 1;
    });

    this.originalRowData = JSON.parse(JSON.stringify(this.rowData));
  }

  delete() {
    if (this.selectedRow) {
      this.rowData = this.rowData.filter(item => item !== this.selectedRow);
      this.selectedRow = null;
      this.hasUnsavedChanges = true;
    }
  }

  async save() {
    const changedItems = this.rowData.filter(item => item.__modified);
    if (changedItems.length === 0) {
      alerts.basicAlert('Sin cambios', 'No hay cambios pendientes por guardar', 'info');
      return;
    }

    try {
      for (const item of changedItems) {
        const rawItem = item._rawItem || {};
        const originalItem = this.originalRowData.find(o => o.id === item.id);
        const originalPedimento = originalItem ? originalItem.pedimento : !item.pedimento;

        // 1. Actualizar el item de la cotización (pedimento true/false)
        const cotizPayload = {
          id: item.id,
          idMovement: rawItem.idMovement || this.cotizacionId,
          idSupplie: rawItem.idSupplie || item.idSupplie || 0,
          description: rawItem.article || rawItem.description || item.articulo || '',
          nameArticle: rawItem.nameArticle || item.nameArticle || '',
          code: rawItem.code || '',
          intorext: rawItem.tipo || rawItem.intorext || item.tipo || 'Externo',
          measure: rawItem.measure || '',
          quantity: rawItem.quantity || item.cantidad || 0,
          price: rawItem.price || 0,
          total: rawItem.total || 0,
          type: rawItem.type || 'COTIZ',
          idProvider: rawItem.idProvider || 0,
          comment: rawItem.comment || item.comment || '',
          dateuse: rawItem.dateuse || new Date().toISOString(),
          active: rawItem.active !== undefined ? rawItem.active : true,
          recurrent: rawItem.recurrent || item.recurrent || 'Recurrente',
          numArticle: rawItem.numArticle || '',
          provint: rawItem.proveedorInterno || rawItem.provint || '',
          typePriority: rawItem.typePriority || rawItem.priority || 'Normal',
          pedimento: item.pedimento,
          descriptionNewArticle: rawItem.descriptionNewArticle || '',
          urlNewArticle: rawItem.urlNewArticle || '',
          justificationNewArticle: rawItem.justificationNewArticle || ''
        };

        console.log(`📤 Guardando item ${item.id}: pedimento = ${item.pedimento}`);
        await firstValueFrom(this.ocAndReqsService.updateReqItem(item.id.toString(), cotizPayload));

        // 2. Actualizar pedimentoNum en la requisición solo si cambió el estado
        if (item.pedimento !== originalPedimento) {
          await this.updateRequisitionItemPedimentoNum(item, item.pedimento);
        }

        // Limpiar flag
        item.__modified = false;
        item._rawItem = { ...rawItem, pedimento: item.pedimento };
      }

      this.originalRowData = JSON.parse(JSON.stringify(this.rowData));
      this.hasUnsavedChanges = false;
      if (this.gridApi) {
        this.gridApi.refreshCells({ force: true });
      }

      alerts.basicAlert('Guardado', `Se guardaron ${changedItems.length} cambio(s) exitosamente.`, 'success');

    } catch (error) {
      console.error('❌ Error al guardar cambios:', error);
      alerts.basicAlert('Error', 'Ocurrió un error al guardar los cambios', 'error');
    }
  }

  revert() {
    this.rowData = JSON.parse(JSON.stringify(this.originalRowData));
    this.hasUnsavedChanges = false;
    if (this.gridApi) {
      this.gridApi.setGridOption('rowData', this.rowData);
    }
  }

  /**
   * Toggle local del checkbox "Solicitado".
   * Solo actualiza el estado local. Los cambios se persisten al hacer clic en Guardar.
   */
  onPedimentoToggle(rowData: any, newValue: boolean) {
    rowData.pedimento = newValue;
    rowData.__modified = true;
    this.hasUnsavedChanges = true;

    // Refrescar solo la celda del checkbox
    if (this.gridApi) {
      this.gridApi.refreshCells({ force: true, columns: ['pedimento'] });
    }
  }

  /**
   * Busca el item correspondiente en la requisición y actualiza su pedimentoNum
   * agregando o quitando el número de pedimento actual.
   */
  private async updateRequisitionItemPedimentoNum(rowData: any, added: boolean) {
    if (!this.requisitionId || !this.numeroPedimentoRaw) return;

    try {
      // Obtener items de la requisición
      const reqItemsRaw: any = await firstValueFrom(
        this.ocAndReqsService.getReqItems(this.requisitionId)
      );
      const reqItems = Array.isArray(reqItemsRaw) ? reqItemsRaw : [];

      // Buscar el item correspondiente por idSupplie o nameArticle
      const idSupplie = rowData.idSupplie || 0;
      const nameArticle = rowData.nameArticle || rowData.articulo || '';

      const matchingReqItem = reqItems.find((ri: any) => {
        if (idSupplie > 0) return ri.idSupplie === idSupplie;
        return ri.nameArticle === nameArticle && ri.idSupplie === 0;
      });

      if (!matchingReqItem) {
        console.warn(`⚠️ No se encontró item "${nameArticle}" en la requisición ${this.requisitionId}`);
        return;
      }

      // Calcular nuevo pedimentoNum
      const currentPedimentoNum = matchingReqItem.pedimentoNum || '';
      const currentNumbers = currentPedimentoNum
        ? currentPedimentoNum.split(',').map((n: string) => n.trim()).filter((n: string) => n !== '')
        : [];

      const pedNumStr = String(this.numeroPedimentoRaw);

      let newNumbers: string[];
      if (added) {
        // Agregar el número si no existe
        if (!currentNumbers.includes(pedNumStr)) {
          currentNumbers.push(pedNumStr);
        }
        newNumbers = currentNumbers;
      } else {
        // Quitar el número
        newNumbers = currentNumbers.filter((n: string) => n !== pedNumStr);
      }

      const newPedimentoNum = newNumbers.join(',');

      // Actualizar el item de la requisición
      const updatePayload = {
        id: matchingReqItem.id,
        idMovement: this.requisitionId,
        idSupplie: matchingReqItem.idSupplie,
        description: matchingReqItem.description || '',
        nameArticle: matchingReqItem.nameArticle || '',
        code: matchingReqItem.code || '',
        intorext: matchingReqItem.intorext || 'Externo',
        measure: matchingReqItem.measure || '',
        quantity: matchingReqItem.quantity || 0,
        price: matchingReqItem.price || 0,
        total: matchingReqItem.total || 0,
        type: matchingReqItem.type || 'REQUIS',
        idProvider: matchingReqItem.idProvider || 0,
        comment: matchingReqItem.comment || '',
        dateuse: matchingReqItem.dateuse || new Date().toISOString(),
        active: matchingReqItem.active !== undefined ? matchingReqItem.active : true,
        recurrent: matchingReqItem.recurrent || 'Recurrente',
        numArticle: matchingReqItem.numArticle || '',
        provint: matchingReqItem.provint || '',
        typePriority: matchingReqItem.typePriority || 'Normal',
        pedimento: false,
        pedimentoNum: newPedimentoNum,
        descriptionNewArticle: matchingReqItem.descriptionNewArticle || '',
        urlNewArticle: matchingReqItem.urlNewArticle || '',
        justificationNewArticle: matchingReqItem.justificationNewArticle || ''
      };

      console.log(`📤 Actualizando requisición item ${matchingReqItem.id}: pedimentoNum "${currentPedimentoNum}" → "${newPedimentoNum}"`);
      await firstValueFrom(
        this.ocAndReqsService.updateReqItem(matchingReqItem.id.toString(), updatePayload)
      );

    } catch (error) {
      console.error('❌ Error al actualizar pedimentoNum en requisición:', error);
    }
  }

  get colDefs(): ColDef[] {
    if (this._colDefs) {
      return this._colDefs;
    }

    this._colDefs = [
      {
        field: 'recurrent',
        headerName: 'Recurrente',
        width: 120
      },
      {
        field: 'articulo',
        headerName: 'Articulo',
        width: 200
      },
      {
        field: 'numeroArticulo',
        headerName: '# Articulo',
        width: 120
      },
      {
        field: 'cantidad',
        headerName: 'Cantidad',
        width: 100
      },
      {
        field: 'tipo',
        headerName: 'Tipo',
        width: 130
      },
      {
        field: 'proveedorInterno',
        headerName: 'Proveedor Interno',
        width: 200
      },
      {
        field: 'tipoPrioridad',
        headerName: 'Tipo Prioridad',
        width: 150
      },
      {
        field: 'comment',
        headerName: 'Observation',
        width: 200
      },
      {
        field: 'pedimento',
        headerName: 'Solicitado',
        width: 120,
        cellRenderer: (params: any) => {
          const isChecked = params.value === true;
          const icon = isChecked ? '✓' : '○';
          const color = isChecked ? '#28a745' : '#6c757d';

          const container = document.createElement('div');
          container.style.cssText = 'display: flex; align-items: center; justify-content: center; gap: 5px;';

          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.checked = isChecked;
          checkbox.style.cssText = 'cursor: pointer; width: 13px; height: 13px;';

          checkbox.addEventListener('change', () => {
            this.onPedimentoToggle(params.data, checkbox.checked);
          });

          const span = document.createElement('span');
          span.style.cssText = `color: ${color}; font-weight: bold;`;
          span.textContent = icon;

          container.appendChild(checkbox);
          container.appendChild(span);
          return container;
        },
        cellStyle: (params: any) => {
          return params.value === true
            ? { textAlign: 'center', backgroundColor: '#d4edda' }
            : { textAlign: 'center', backgroundColor: '#f8f9fa' };
        },
        tooltipValueGetter: (params: any) => {
          return params.value === true
            ? 'Item solicitado en este pedimento'
            : 'Item de contexto (no solicitado). Click para agregar al pedimento.';
        }
      },
    ];

    return this._colDefs;
  }

  public gridOptions: any = {
    headerHeight: 35,
    rowHeight: 35,
    animateRows: true,
    rowSelection: 'single',
    onRowClicked: (event: any) => {
      this.selectedRow = event.data;
    }
  };
}
