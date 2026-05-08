import { Component, HostListener, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ICellRendererAngularComp, AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent, ICellRendererParams } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { OcAndReqsService } from 'app/services/ocandreqs.service';
import { SignalsService } from 'app/services/signals.service';
import { PedimentoModificationService } from 'app/services/pedimento-modification.service';
import { firstValueFrom, Subscription } from 'rxjs';
import { alerts } from 'app/helpers/alerts';
import { ItemCommentsCellRendererComponent } from 'app/shared/item-comments-cell-renderer/item-comments-cell-renderer.component';
import { ItemCommentsService } from 'app/services/item-comments.service';

@Component({
  selector: 'app-detalle-items-pedimentos',
  standalone: true,
  imports: [CommonModule, AgGridModule, ItemCommentsCellRendererComponent],
  template: `
    <div class="detail-grid-container">
      <div *ngIf="articulosLocked"
           style="background:#e7f3ff; border:1px solid #90caf9; border-radius:6px; padding:5px 12px; margin-bottom:5px; flex-shrink:0; display:flex; align-items:center; gap:8px;">
        <i class="bi bi-lock-fill text-primary" style="font-size:1rem;"></i>
        <span class="small fw-semibold text-dark">Cotización de proveedor guardada — no puede modificarse la solicitud de artículos en este pedimento.</span>
      </div>
      <!-- Barra de botones CRUD -->
      <div style="margin-bottom: 5px; display: flex; justify-content: flex-end; align-items: center; flex-shrink: 0; position: relative; z-index: 10; background-color: #f8f9fa; padding: 5px 0;">
        <div class="d-flex gap-1">
          <button class="btn btn-primary btn-xs position-relative" (click)="save()" [disabled]="articulosLocked || !hasUnsavedChanges">
            <i class="bi bi-floppy"></i> Guardar
            <span class="position-absolute top-0 start-100 translate-middle p-1 bg-danger border border-light rounded-circle"
                  *ngIf="hasUnsavedChanges && !articulosLocked">
            </span>
          </button>
          <button class="btn btn-warning btn-xs" (click)="revert()" [disabled]="articulosLocked">
            <i class="bi bi-arrow-clockwise"></i> Deshacer
          </button>
          <button class="btn btn-danger btn-xs" (click)="delete()" [disabled]="articulosLocked || !selectedRow">
            <i class="bi bi-trash"></i> Eliminar
          </button>
        </div>
      </div>

      <!-- Grid con tamaño completo -->
      <div style="flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column;">
        <ag-grid-angular
          class="ag-theme-quartz small-text-ag-grid"
          [rowData]="rowData"
          [columnDefs]="colDefs"
          [gridOptions]="gridOptions"
          [localeText]="AG_GRID_LOCALE_ES"
          (gridReady)="onGridReady($event)"
          (firstDataRendered)="onFirstDataRendered($event)"
          style="width: 100%; flex: 1 1 auto; min-height: 0;">
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
export class DetalleItemsPedimentosComponent implements ICellRendererAngularComp, OnDestroy {
  private params!: ICellRendererParams;
  private context: any;
  private gridApi!: GridApi;
  private ocAndReqsService = inject(OcAndReqsService);
  private signalsService = inject(SignalsService);
  private pedimentoModificationService = inject(PedimentoModificationService);
  private itemCommentsService = inject(ItemCommentsService);
  private commentSub?: Subscription;
  private chatClosedSub?: Subscription;
  private pendingReorder = false;

  // Cache para evitar re-renderizado
  private _colDefs: ColDef[] | null = null;

  rowData: any[] = [];
  originalRowData: any[] = [];
  hasUnsavedChanges: boolean = false;
  selectedRow: any = null;
  /** true si ya hay COTIZ guardada en proveedor (mismo `node.data` que `DetalleItemsProveedorComponent`). */
  articulosLocked: boolean = false;
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
    this.articulosLocked = !!(params.data as any).articulosPedimentoLocked;
    this._colDefs = null;
    this.buildRowData();
    void this.hydrateArticulosLockIfNeeded();

    this.commentSub?.unsubscribe();
    this.commentSub = this.itemCommentsService.commentSaved$.subscribe(() => {
      // Refrescar contador inmediatamente sin tocar el grid padre
      if (this.gridApi) {
        this.gridApi.refreshCells({ force: true });
      }
      // Marcar que hay un reordenamiento pendiente — se ejecutará al cerrar el chat
      this.pendingReorder = true;
    });

    this.chatClosedSub?.unsubscribe();
    this.chatClosedSub = this.itemCommentsService.chatClosed$.subscribe(() => {
      if (this.pendingReorder && this.cotizacionId) {
        this.pendingReorder = false;
        // Notificar al nivel 2 para que reordene cuando se cierra el chat
        console.log('📤 Nivel 3 emitiendo pedimentoModified$ (desde chat closed) para cotizacionId:', this.cotizacionId);
        this.pedimentoModificationService.pedimentoModified$.next(this.cotizacionId);
      }
    });
  }

  ngOnDestroy(): void {
    this.commentSub?.unsubscribe();
    this.chatClosedSub?.unsubscribe();
  }

  /** Si ya hay COTIZ/OC en cualquier slot (p. ej. tras F5 sin abrir proveedor), alinear el candado con el servidor. */
  private async hydrateArticulosLockIfNeeded(): Promise<void> {
    if (this.articulosLocked || !this.cotizacionId) return;
    try {
      const idBranch = this.signalsService.getBranchSelectedBySidebar()();
      const reqId = this.requisitionId || 0;
      const [cotizData, ocData] = await Promise.all([
        firstValueFrom(this.ocAndReqsService.getOcAndReqs('delison', this.cotizacionId, 'COTIZ')),
        firstValueFrom(this.ocAndReqsService.getOcAndReqs('branch', idBranch, 'OC'))
      ]);
      const cotizList = Array.isArray(cotizData) ? cotizData : [];
      const ocList = (Array.isArray(ocData) ? ocData : []).filter((c: any) => Number(c.idReq) === Number(reqId));
      const slotSuffixes = ['-A-', '-B-', '-C-'];
      const hasAnyCotiz = cotizList.some((c: any) => slotSuffixes.some(s => c.folio?.includes(s)));
      const hasAnyOc = ocList.some((c: any) => slotSuffixes.some(s => c.folio?.includes(s)));
      if (hasAnyCotiz || hasAnyOc) {
        const d = this.params?.node?.data as { articulosPedimentoLocked?: boolean } | undefined;
        if (d) {
          d.articulosPedimentoLocked = true;
        }
        this.articulosLocked = true;
        this._colDefs = null;
        if (this.gridApi) {
          this.gridApi.setGridOption('columnDefs', this.colDefs);
          this.gridApi.setGridOption('suppressClickEdit', true);
          this.gridApi.refreshCells({ force: true });
        }
      }
    } catch (e) {
      console.warn('hydrateArticulosLockIfNeeded', e);
    }
  }

  refresh(params?: ICellRendererParams): boolean {
    if (params) {
      this.params = params;
      this.articulosLocked = !!(params.data as any).articulosPedimentoLocked;
      this._colDefs = null;
      if (this.gridApi) {
        this.gridApi.setGridOption('columnDefs', this.colDefs);
        this.gridApi.setGridOption('suppressClickEdit', this.articulosLocked);
        this.gridApi.refreshCells({ force: true });
      }
    }
    return true;
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    if (this.articulosLocked) {
      this.gridApi.setGridOption('suppressClickEdit', true);
    }
    this.autoAdjustColumns();
  }

  onFirstDataRendered(params: any) {
    this.gridApi?.autoSizeAllColumns();
  }

  @HostListener('window:resize')
  onWindowResize() {
    this.autoAdjustColumns();
  }

  private autoAdjustColumns() {
    if (!this.gridApi) return;
    const apiAny = this.gridApi as any;
    if (typeof apiAny.sizeColumnsToFit === 'function') {
      apiAny.sizeColumnsToFit();
    }
  }

  /**
   * Mapeo alineado con `quote-delison.component.ts` (items de cotización).
   * Sirve para refrescar el nivel 3 desde API sin recargar todo el grid padre.
   */
  private mapCotizItemFromApi(item: any): any {
    return {
      id: item.id,
      idSupplie: item.idSupplie || 0,
      nameArticle: item.nameArticle || '',
      recurrent: item.recurrent || '',
      article: item.description || item.nameArticle || '',
      quantity: item.quantity || 0,
      tipo: item.intorext || 'Externo',
      intorext: item.intorext || 'Externo',
      proveedorInterno: item.provint || '',
      priority: item.typePriority || 'Normal',
      comment: item.comment || '',
      pedimento: item.pedimento || false,
      numArticle: item.numarticle || item.numArticle || '',
      code: item.code || '',
      pedimentoNumber: item.pedimentoNum || '',
      idMovement: item.idMovement || 0,
      measure: item.measure || '',
      price: item.price || 0,
      total: item.total || 0,
      type: item.type || 'COTIZ',
      idProvider: item.idProvider || 0,
      dateuse: item.dateuse || '',
      active: item.active !== undefined ? item.active : true,
      typePriority: item.typePriority || 'Normal',
      descriptionNewArticle: item.descriptionNewArticle || '',
      urlNewArticle: item.urlNewArticle || '',
      justificationNewArticle: item.justificationNewArticle || '',
      caducidadMinimaRequerida: item.caducidadMinimaRequerida || item.caducidad || item.expiration || ''
    };
  }

  /** Recarga artículos del pedimento desde el servidor sin tocar el grid de cotizaciones (nivel 1/2 abiertos). */
  private async refreshArticulosFromServer(): Promise<void> {
    if (!this.cotizacionId) return;
    try {
      const itemsData = await firstValueFrom(
        this.ocAndReqsService.getReqItems(this.cotizacionId)
      );
      const items = Array.isArray(itemsData) ? itemsData : [];
      const mapped = items.map((it: any) => this.mapCotizItemFromApi(it));
      if (this.params?.data) {
        this.params.data.articulos = mapped;
      }
      this.buildRowData();
      if (this.gridApi) {
        this.gridApi.setGridOption('rowData', this.rowData);
        this.gridApi.refreshCells({ force: true });
      }
      if (this.params.api && this.params.node) {
        this.params.api.refreshCells({
          rowNodes: [this.params.node],
          columns: ['articulos'],
        });
      }
    } catch (e) {
      console.warn('refreshArticulosFromServer', e);
    }
  }

  buildRowData() {
    const articulos = (this.params.data.articulos || []).filter(
      (item: any) => (item.intorext || item.tipo || '').toLowerCase() !== 'interno'
    );

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
        caducidadMinimaRequerida: item.caducidadMinimaRequerida || item.caducidad || item.expiration || '',
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
    if (this.articulosLocked) return;
    if (this.selectedRow) {
      this.rowData = this.rowData.filter(item => item !== this.selectedRow);
      this.selectedRow = null;
      this.hasUnsavedChanges = true;
    }
  }

  async save() {
    if (this.articulosLocked) return;
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
          justificationNewArticle: rawItem.justificationNewArticle || '',
          caducidadMinimaRequerida: String(item.caducidadMinimaRequerida || rawItem.caducidadMinimaRequerida || '')
        };

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

      // ✅ Actualizar dateModified del maestro de la cotización
      try {
        const maestroCotizacion: any = await firstValueFrom(
          this.ocAndReqsService.getDetailedReq(this.cotizacionId)
        );
        if (maestroCotizacion) {
          maestroCotizacion.dateModified = new Date().toISOString();
          await firstValueFrom(this.ocAndReqsService.updateOcAndReq(this.cotizacionId, maestroCotizacion));
          // Se elimina la notificación global para evitar el cierre de tablas por reordenamiento
          // this.pedimentoModificationService.pedimentoModified$.next(this.cotizacionId);
        }
      } catch (error) {
        console.warn('⚠️ No se pudo actualizar dateModified:', error);
      }

      // Sincronizar ítems con el servidor sin recargar el grid de «Cotizaciones» (evita cerrar niveles 1–2).
      await this.refreshArticulosFromServer();

      // Notificar al nivel 2 para que suba este pedimento al inicio sin perder la expansión.
      console.log('📤 Nivel 3 emitiendo pedimentoModified$ para cotizacionId:', this.cotizacionId);
      this.pedimentoModificationService.pedimentoModified$.next(this.cotizacionId);

      // Notificar al nivel 1 para que suba esta requisición al inicio sin cerrar nivel 2 y 3.
      console.log('📤 Nivel 3 emitiendo requisitionModified$ para cotizacionId:', this.cotizacionId);
      this.pedimentoModificationService.requisitionModified$.next(this.cotizacionId);

      alerts.basicAlert('Guardado', `Se guardaron ${changedItems.length} cambio(s) exitosamente.`, 'success');

    } catch (error) {
      console.error('❌ Error al guardar cambios:', error);
      alerts.basicAlert('Error', 'Ocurrió un error al guardar los cambios', 'error');
    }
  }

  revert() {
    if (this.articulosLocked) return;
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
    if (this.articulosLocked) return;
    rowData.pedimento = newValue;
    rowData.__modified = true;
    this.hasUnsavedChanges = true;

    // Sincronizar en el array articulos del padre para que el valueGetter lo refleje
    if (rowData._rawItem) {
      rowData._rawItem.pedimento = newValue;
    }
    const articulos = this.params.data.articulos || [];
    const match = articulos.find((a: any) => a.id === rowData.id);
    if (match) {
      match.pedimento = newValue;
    }

    // Refrescar la celda 'articulos' en el grid padre (muestra X/Total)
    // Sin force:true para no destruir este detail renderer
    if (this.params.api && this.params.node) {
      this.params.api.refreshCells({
        rowNodes: [this.params.node],
        columns: ['articulos']
      });
    }

    // Refrescar la celda del checkbox en el sub-grid
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
        numArticle: matchingReqItem.numarticle || matchingReqItem.numArticle || '',
        provint: matchingReqItem.provint || '',
        typePriority: matchingReqItem.typePriority || 'Normal',
        pedimento: false,
        pedimentoNum: newPedimentoNum,
        descriptionNewArticle: matchingReqItem.descriptionNewArticle || '',
        urlNewArticle: matchingReqItem.urlNewArticle || '',
        justificationNewArticle: matchingReqItem.justificationNewArticle || ''
      };

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
        width: 140,
        flex: 0,
        suppressSizeToFit: true
      },
      {
        field: 'articulo',
        headerName: 'Articulo',
        width: 200,
        flex: 0,
        suppressSizeToFit: true,
        wrapText: true
      },
      {
        field: 'numeroArticulo',
        headerName: '# Articulo',
        width: 100,
        flex: 0,
        suppressSizeToFit: true
      },
      {
        field: 'cantidad',
        headerName: 'Cantidad',
        width: 85,
        flex: 0,
        suppressSizeToFit: true,
        cellStyle: { textAlign: 'right' }
      },
      {
        field: 'caducidadMinimaRequerida',
        headerName: 'Caducidad Minima Requerida',
        width: 140,
        flex: 0,
        suppressSizeToFit: true,
        editable: (params: any) => !this.articulosLocked,
        cellStyle: { textAlign: 'center' }
      },
      {
        field: 'tipoPrioridad',
        headerName: 'Tipo Prioridad',
        width: 130,
        flex: 0,
        suppressSizeToFit: true
      },
      {
        headerName: 'Comentarios💬',
        width: 130,
        flex: 0,
        suppressSizeToFit: true,
        sortable: false,
        filter: false,
        cellRenderer: ItemCommentsCellRendererComponent,
        cellRendererParams: (params: any) => ({
          documentType: 'REQ',
          idDocument: this.requisitionId,
          numArticle: params.data?.numeroArticulo || (params.data?.idSupplie ? `SUPP-${params.data.idSupplie}` : ''),
          locked: false
        }),
      },
      {
        field: 'pedimento',
        headerName: 'Solicitado',
        width: 100,
        flex: 0,
        suppressSizeToFit: true,
        cellRenderer: (params: any) => {
          const isChecked = params.value === true;
          const icon = isChecked ? '✓' : '○';
          const color = isChecked ? '#28a745' : '#6c757d';
          const locked = this.articulosLocked;

          const container = document.createElement('div');
          container.style.cssText = 'display: flex; align-items: center; justify-content: center; gap: 5px;';

          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.checked = isChecked;
          checkbox.disabled = locked;
          checkbox.style.cssText = locked
            ? 'cursor: not-allowed; width: 13px; height: 13px; opacity: 0.65;'
            : 'cursor: pointer; width: 13px; height: 13px;';

          if (!locked) {
            checkbox.addEventListener('change', () => {
              this.onPedimentoToggle(params.data, checkbox.checked);
            });
          } else {
            checkbox.addEventListener('click', (e) => e.preventDefault());
          }

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
        tooltipValueGetter: (p: any) => {
          if (this.articulosLocked) {
            return 'Cotización ya guardada: no puede cambiar solicitud de artículos.';
          }
          return p.value === true
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
    getRowId: (params: any) => String(params.data.id),
    autoSizeStrategy: {
      type: 'fitGridWidth',
      defaultMinWidth: 90,
    },
    defaultColDef: {
      resizable: true,
      sortable: true,
      filter: true,
      flex: 1,
      minWidth: 120,
    },
    onFirstDataRendered: () => {
      this.autoAdjustColumns();
    },
    onCellEditingStopped: (event: any) => {
      if (event.colDef.field === 'caducidadMinimaRequerida') {
        const n = parseInt(String(event.newValue), 10);
        if (!isNaN(n) && n >= 0) {
          const row = this.rowData.find((r: any) => r.id === event.data.id);
          if (row) {
            row.caducidadMinimaRequerida = n;
            row.__modified = true;
            this.hasUnsavedChanges = true;
            this.gridApi.refreshCells({ rowNodes: [event.node], columns: ['caducidadMinimaRequerida'], force: true });
          }
        }
      }
    },
    onRowClicked: (event: any) => {
      this.selectedRow = event.data;
    }
  };
}
