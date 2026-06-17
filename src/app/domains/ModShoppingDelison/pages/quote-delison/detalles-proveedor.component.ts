
import { Component, inject, ChangeDetectorRef} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, ICellRendererParams, GridApi } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { CustomersService } from 'app/services/customers.service';
import { SignalsService } from 'app/services/signals.service';
import { OcAndReqsService } from 'app/services/ocandreqs.service';
import { NgSelectModule } from '@ng-select/ng-select';
import { firstValueFrom } from 'rxjs';
import { alerts } from 'app/helpers/alerts';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import { ItemCommentsCellRendererComponent } from 'app/shared/item-comments-cell-renderer/item-comments-cell-renderer.component';

pdfMake.vfs = pdfFonts.vfs;

@Component({
  selector: 'app-detalles-proveedor',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, NgSelectModule, ItemCommentsCellRendererComponent],
  template: `
    <div class="detail-grid-container">
      <!-- Header con controles -->
      <div style="margin-bottom: 5px; display: flex; justify-content: space-between; align-items: end; gap: 3; padding: 10px; flex-shrink: 0;">

        <!-- Seleccionar Proveedor -->
        <div style="flex: 1; min-width: 200px;">
          <label class="form-label small">Seleccionar Proveedor:</label>
          <ng-select
            [items]="providers"
            bindValue="id"
            bindLabel="description"
            [(ngModel)]="selectedProviderId"
            [clearable]="true"
            placeholder="Seleccione proveedor"
            (ngModelChange)="onProviderChange()">
          </ng-select>
        </div>

       <!-- PDF Cotización -->
        <div style="flex: 0 0 auto;">
          <label class="form-label small">PDF Cotización:</label>
          <div class="input-group input-group-sm">
            <button class="btn btn-outline-secondary" type="button" (click)="generatePlaceholderPdf()" title="Ver PDF">
              <i class="bi bi-file-earmark-pdf text-danger"></i>
            </button>
            <input type="file" #fileInput accept=".pdf" style="display: none;" (change)="onFileSelected($event)">
            <button class="btn btn-outline-secondary" type="button" (click)="fileInput.click()" title="Cargar PDF">
              <i class="bi bi-upload"></i>
            </button>
          </div>
        </div>

        <!-- Fecha Proveedor -->
        <div style="flex: 0 0 auto;">
          <label class="form-label small">Fecha Proveedor:</label>
          <input type="date" class="form-control form-control-sm" [(ngModel)]="fechaProveedor" style="width: 140px;">
        </div>


        <!-- Botones CRUD -->
        <div class="d-flex gap-1" style="flex: 0 0 auto;">
          <button type="button" class="btn btn-sm btn-success position-relative" (click)="saveChanges()" title="Guardar cambios">
            <i class="bi bi-floppy"></i>
            <span
              class="position-absolute top-0 start-100 translate-middle p-2 bg-danger border border-light rounded-circle"
              *ngIf="hasUnsavedChanges">
              <span class="visually-hidden">Hay cambios sin guardar</span>
            </span>
          </button>
          <button type="button" class="btn btn-sm btn-warning" (click)="revertChanges()" title="Deshacer cambios">
            <i class="bi bi-arrow-clockwise"></i>
          </button>
          <button type="button" class="btn btn-sm btn-danger" (click)="deleteItem()" title="Eliminar">
            <i class="bi bi-trash"></i>
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
          (cellValueChanged)="onCellValueChanged($event)"
          style="width: 120%; height: 100%; position: absolute; top: 0; left: 0; right: 0; bottom: 0;">
        </ag-grid-angular>
      </div>

      <!-- Total Costo Total -->
      <div style="flex-shrink: 0; display: flex; justify-content: flex-end; align-items: center;
                  background: #c8e6c9; border-top: 2px solid #388e3c; padding: 4px 12px; border-radius: 0 0 6px 6px;">
        <span style="font-weight: bold; font-size: 0.85rem; color: #1b5e20;">
          Total Cotización:&nbsp;
        </span>
        <span style="font-weight: bold; font-size: 0.9rem; color: #1b5e20;">
          {{ totalCostoTotal | currency:'MXN':'symbol':'1.2-2' }}
        </span>
      </div>
    </div>
  `,
  styles: [`
    .detail-grid-container {
      padding: 5px;
      background-color: #e3f2fd;
      border-radius: 8px;
      height: 100%;
      max-height: 100%;
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
      overflow: hidden;
    }
    .form-label {
      margin-bottom: 2px;
      font-weight: 500;
    }
  `]
})
export class DetallesProveedorComponent {
  private customersService = inject(CustomersService);
  private readonly cdr = inject(ChangeDetectorRef);
  private signalsService = inject(SignalsService);
  private ocAndReqsService = inject(OcAndReqsService);

  private params!: ICellRendererParams;
  private gridApi!: GridApi;

  rowData: any[] = [];
  providers: any[] = [];
  selectedProviderId: number | null = null;
  fechaProveedor: string = new Date().toISOString().split('T')[0];
  pdfFileName: string = '';
  selectedFile: File | null = null;
  hasUnsavedChanges: boolean = false;
  totalCostoTotal: number = 0;
  providerLabel: string = '';
  providerField: string = '';
  requisitionId: number | null = null;
  private _colDefs: ColDef[] | null = null;

  // COTPRO state
  cotproId: number | null = null;
  cotizacionId: number | null = null;
  existingItemIds: Map<number, number> = new Map(); // rowIndex -> detailId

  /** ID del COTPRO que pertenece a ESTA ranura (no al de otra ranura) */
  private slotCotproId: number | null = null;
  /** true cuando el usuario cambia el proveedor desde el dropdown (no carga inicial) */
  private providerChangedByUser = false;

  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.providerLabel  = params.context?.providerLabel || 'Proveedor';
    this.providerField  = params.context?.providerField || 'idProvider';
    this.cotizacionId   = this.params.data.cotizacionId || null;
    this.requisitionId  = this.params.data.requisitionId || null;

    const currentProviderId = this.params.data[this.providerField];
    if (currentProviderId && currentProviderId > 0) {
      this.selectedProviderId = currentProviderId;
    }

    this.loadProviders();
    this.loadExistingCotproOrBuildFromArticulos();
  
    this.cdr.detectChanges();}

  onGridReady(params: any) {
    this.gridApi = params.api;
  }

  updateTotal() {
    this.totalCostoTotal = this.rowData.reduce((sum, row) => sum + (row.costoTotal || 0), 0);
  }

  async loadProviders() {
    try {
      const idRoot = this.signalsService.getRootSelectedBySidebar()();
      const allProviders: any = await firstValueFrom(
        this.customersService.getCustomersByCompany(idRoot, 'PROVIDERS')
      );

      this.providers = allProviders
        .filter((p: any) => p.vigente === true || p.vigente === 1)
        .map((p: any) => ({
          id: p.id,
          description: p.description || p.name || `Proveedor ${p.id}`
        }));
    } catch {
      this.providers = [];
    }
  
    this.cdr.detectChanges();}

  async loadExistingCotproOrBuildFromArticulos() {
    if (!this.cotizacionId || !this.selectedProviderId) {
      this.buildRowData();
      return;
    }

    try {
      const cotproList: any = await firstValueFrom(
        this.ocAndReqsService.getOcAndReqs('cotiz', this.cotizacionId, 'COTPRO')
      );

      const existing = Array.isArray(cotproList)
        ? cotproList.find((c: any) => c.idProvider === this.selectedProviderId && c.active !== false)
        : null;

      if (existing) {
        this.cotproId = existing.id;
        // Solo marca como "propio" si el proveedor NO fue cambiado por el usuario
        // (es decir, viene de la carga inicial de esta ranura)
        if (!this.providerChangedByUser) {
          this.slotCotproId = existing.id;
        }
        await this.loadCotproItems();
      } else {
        this.buildRowData();
      }
    } catch {
      this.buildRowData();
    }
  
    this.cdr.detectChanges();}

  async loadCotproItems() {
    if (!this.cotproId) return;
    try {
      const items: any = await firstValueFrom(
        this.ocAndReqsService.getReqItems(this.cotproId)
      );

      this.existingItemIds = new Map();
      this.rowData = (Array.isArray(items) ? items : []).map((item: any, index: number) => {
        if (item.id) this.existingItemIds.set(index, item.id);
        return {
          active: item.active !== false,
          numArticulo: item.numArticle || item.numarticle || (index + 1),
          articulo: item.nameArticle || item.namearticle || '',
          codigoExterno: item.observation || '',
          costoUnitario: item.price || 0,
          compraMinima: item.compraMinima || item.compraminima || 1,
          tiempoEntrega: item.tiempoEntrega || item.tiempoentrega || '',
          cantidadConfirmada: item.quantity || 0,
          costoTotal: (item.price || 0) * (item.quantity || 0),
          autorizado: item.autorizado || false,
          comment: item.comment || '',
          requisitionId: this.requisitionId
        };
      });
      this.updateTotal();
    } catch {
      this.buildRowData();
    }
  
    this.cdr.detectChanges();}

  buildRowData() {
    const articulos = (this.params.data.articulos || []).filter(
      (item: any) =>
        (item.intorext || item.tipo || '').toLowerCase() !== 'interno' &&
        item.pedimento === true
    );

    this.rowData = articulos.map((item: any, index: number) => ({
      active: true,
      numArticulo: item.numarticle || item.numArticle || (index + 1),
      articulo: item.nameArticle || item.article || item.description || '',
      codigoExterno: '',
      costoUnitario: 0,
      compraMinima: 1,
      tiempoEntrega: '',
      cantidadConfirmada: item.quantity || 0,
      requisitionId: this.requisitionId,
      costoTotal: 0,
      autorizado: false,
      comment: ''
    }));
    this.updateTotal();
  }

  onProviderChange() {
    this.hasUnsavedChanges = true;
    this.providerChangedByUser = true;
    this.cotproId = null;
    this.existingItemIds = new Map();
    this.loadExistingCotproOrBuildFromArticulos();
  }

  onCellValueChanged(event: any) {
    this.hasUnsavedChanges = true;

    if (event.column.getColId() === 'costoUnitario' || event.column.getColId() === 'cantidadConfirmada') {
      const row = event.data;
      row.costoTotal = (row.costoUnitario || 0) * (row.cantidadConfirmada || 0);
      this.gridApi.refreshCells({ rowNodes: [event.node], force: true });
    }
    this.updateTotal();
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
      this.selectedFile = file;
      this.pdfFileName = file.name;
      this.hasUnsavedChanges = true;
    } else if (file) {
      alert('Por favor seleccione un archivo PDF válido');
      this.pdfFileName = '';
      this.selectedFile = null;
    }
  }

  async saveChanges() {
    if (!this.selectedProviderId) {
      alerts.basicAlert('Atención', 'Seleccione un proveedor antes de guardar.', 'warning');
      return;
    }

    if (!this.cotizacionId) {
      alerts.basicAlert('Error', 'No se encontró la cotización (COTIZ) de referencia.', 'error');
      return;
    }

    // Validar que el proveedor no esté ya guardado en otra ranura (A, B o C)
    try {
      const allCotpros: any = await firstValueFrom(
        this.ocAndReqsService.getOcAndReqs('cotiz', this.cotizacionId, 'COTPRO')
      );
      const duplicado = (Array.isArray(allCotpros) ? allCotpros : []).find(
        (c: any) => c.idProvider === this.selectedProviderId && c.active !== false && c.id !== this.slotCotproId
      );
      if (duplicado) {
        alerts.basicAlert(
          'Proveedor duplicado',
          'No puedes guardar la cotización porque ese proveedor ya existe en otra ranura.',
          'warning'
        );
        return;
      }
    } catch {
      // Si falla la validación, continuar (no bloquear)
    }

    const today = new Date().toISOString().split('T')[0];
    const providerName = this.getSelectedProviderName();

    try {
      // 1. Crear COTPRO si no existe
      if (!this.cotproId) {
        const cotproData: any = {
          type: 'COTPRO',
          folio: `COTPRO-${this.cotizacionId}-${this.selectedProviderId}`,
          typeReference: 'cotiz',
          idReference: this.cotizacionId,
          idProvider: this.selectedProviderId,
          nameProvider: providerName,
          dateCreate: today,
          active: true
        };

        const cotproResponse: any = await firstValueFrom(
          this.ocAndReqsService.addOcAndReq(cotproData)
        );
        this.cotproId = cotproResponse.id;
        this.slotCotproId = cotproResponse.id; // Esta ranura es dueña de este COTPRO
      }

      // 2. Obtener filas actuales del grid
      const currentRows: any[] = [];
      this.gridApi.forEachNode((node: any) => {
        if (node.data) currentRows.push(node.data);
      });

      // 3. Guardar cada fila como detalle
      for (let i = 0; i < currentRows.length; i++) {
        const row = currentRows[i];
        const detailData: any = {
          idMovement: this.cotproId,
          idSupplie: 0,
          idProvider: this.selectedProviderId,
          nameProvider: providerName,
          nameArticle: row.articulo || '',
          numArticle: String(row.numArticulo || ''),
          quantity: row.cantidadConfirmada || 0,
          price: row.costoUnitario || 0,
          observation: row.codigoExterno || '',
          tiempoEntrega: row.tiempoEntrega || '',
          compraMinima: row.compraMinima || 0,
          autorizado: row.autorizado || false,
          comment: row.comment || '',
          type: 'COTPRO',
          intorext: 'Externo',
          pedimento: true,
          active: row.active !== false
        };

        const existingId = this.existingItemIds.get(i);
        if (existingId) {
          await firstValueFrom(
            this.ocAndReqsService.updateReqItem(String(existingId), detailData)
          );
        } else {
          const savedItem: any = await firstValueFrom(
            this.ocAndReqsService.addReqItem(detailData)
          );
          if (savedItem?.id) this.existingItemIds.set(i, savedItem.id);
        }
      }

      this.hasUnsavedChanges = false;
      alerts.basicAlert('Guardado', `Cotización de proveedor guardada correctamente.`, 'success');

    } catch (error) {
      alerts.basicAlert('Error', 'No se pudo guardar la cotización del proveedor.', 'error');
    }
  
    this.cdr.detectChanges();}

  generatePlaceholderPdf() {
    const docDefinition: any = {
      pageSize: 'LETTER',
      pageMargins: [40, 60, 40, 60],
      content: [
        {
          columns: [
            { text: '[ LOGO EMPRESA ]', alignment: 'left', fontSize: 12, color: '#666' },
            { text: '[ LOGO PROVEEDOR ]', alignment: 'right', fontSize: 12, color: '#666' }
          ],
          margin: [0, 0, 0, 40]
        },
        { text: 'COTIZACIÓN DE PROVEEDOR', style: 'header', alignment: 'center', margin: [0, 40, 0, 20] },
        { text: `Proveedor: ${this.getSelectedProviderName()}`, fontSize: 12, margin: [0, 10, 0, 5] },
        { text: `Fecha: ${this.fechaProveedor}`, fontSize: 12, margin: [0, 0, 0, 30] },
        { text: '🚧 EN CONSTRUCCIÓN 🚧', style: 'construction', alignment: 'center', margin: [0, 60, 0, 20] },
        { text: 'Esta funcionalidad está en desarrollo.', alignment: 'center', fontSize: 12, color: '#666', margin: [0, 0, 0, 10] },
        { text: 'Próximamente podrá ver la cotización completa del proveedor.', alignment: 'center', fontSize: 12, color: '#666' },
        {
          margin: [0, 40, 0, 0],
          table: {
            headerRows: 1,
            widths: ['auto', '*', 'auto', 'auto', 'auto'],
            body: [
              [
                { text: '#', style: 'tableHeader' },
                { text: 'ARTÍCULO', style: 'tableHeader' },
                { text: 'CANTIDAD', style: 'tableHeader' },
                { text: 'PRECIO', style: 'tableHeader' },
                { text: 'TOTAL', style: 'tableHeader' }
              ],
              ...this.rowData.map((item, index) => [
                { text: index + 1, alignment: 'center' },
                { text: item.articulo || '-' },
                { text: item.cantidadConfirmada || 0, alignment: 'center' },
                { text: `$${(item.costoUnitario || 0).toFixed(2)}`, alignment: 'right' },
                { text: `$${(item.costoTotal || 0).toFixed(2)}`, alignment: 'right' }
              ])
            ]
          }
        }
      ],
      styles: {
        header: { fontSize: 18, bold: true, color: '#333' },
        construction: { fontSize: 24, bold: true, color: '#ff6600' },
        tableHeader: { bold: true, fontSize: 10, fillColor: '#4472C4', color: 'white', alignment: 'center' }
      }
    };

    pdfMake.createPdf(docDefinition).open();
  }

  getSelectedProviderName(): string {
    if (!this.selectedProviderId) return 'Sin seleccionar';
    const provider = this.providers.find(p => p.id === this.selectedProviderId);
    return provider ? provider.description : 'Sin seleccionar';
  }

  revertChanges() {
    this.cotproId = null;
    this.existingItemIds = new Map();
    this.loadExistingCotproOrBuildFromArticulos().then(() => {
      this.hasUnsavedChanges = false;
      this.gridApi?.setGridOption('rowData', this.rowData);
    });
  }

  deleteItem() {
    alert('Funcionalidad de eliminación pendiente de implementar.');
  }

  get colDefs(): ColDef[] {
    if (this._colDefs) return this._colDefs;

    this._colDefs = [
      { field: 'active', headerName: 'Activo', width: 100, cellRenderer: 'agCheckboxCellRenderer', cellEditor: 'agCheckboxCellEditor', editable: true },
      { field: 'numArticulo', headerName: '# Art', width: 130 },
      { field: 'articulo', headerName: 'Artículo', width: 140 },
      { field: 'codigoExterno', headerName: 'Cód. Externo', width: 120, editable: true },
      { field: 'compraMinima', headerName: 'Compra Mín.', width: 130, editable: true },
      { field: 'tiempoEntrega', headerName: 'T. Entrega', width: 120, editable: true },
      { field: 'costoUnitario', headerName: 'Costo Unit.', width: 130, editable: true, valueFormatter: params => params.value ? `$${params.value.toFixed(2)}` : '$0.00' },
      { field: 'cantidadConfirmada', headerName: 'Cant. Conf.', width: 130, editable: true },
      { field: 'costoTotal', headerName: 'Costo Total', width: 150, valueFormatter: params => params.value ? `$${params.value.toFixed(2)}` : '$0.00' },
      { field: 'autorizado', headerName: 'Autoriz.', width: 100, cellRenderer: 'agCheckboxCellRenderer', cellEditor: 'agCheckboxCellEditor', editable: true },
      { field: 'comment', headerName: 'Comentario', width: 200, editable: true },
      {
        headerName: '💬',
        width: 60,
        sortable: false,
        filter: false,
        cellRenderer: ItemCommentsCellRendererComponent,
        cellRendererParams: () => ({ documentType: 'PROVEEDOR', idDocument: this.cotizacionId }),
      }
    ];

    return this._colDefs;
  }

  public gridOptions: any = {
    headerHeight: 30,
    rowHeight: 28,
    animateRows: true,
    suppressCellFocus: false,
    stopEditingWhenCellsLoseFocus: true
  };
}
