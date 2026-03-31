
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, ICellRendererParams, GridApi } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { CustomersService } from 'app/services/customers.service';
import { SignalsService } from 'app/services/signals.service';
import { OcAndReqsService } from 'app/services/ocandreqs.service';
import { NgSelectModule } from '@ng-select/ng-select';
import { lastValueFrom } from 'rxjs';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';

pdfMake.vfs = pdfFonts.vfs;

@Component({
  selector: 'app-detalle-items-proveedor',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, NgSelectModule],
  template: `
    <div class="detail-grid-container">
      <!-- Banner de candado cuando ya existe OC -->
      <div *ngIf="ocGenerated"
           style="background:#fff3cd; border:1px solid #ffc107; border-radius:6px; padding:5px 12px; margin-bottom:5px; flex-shrink:0; display:flex; align-items:center; gap:8px;">
        <i class="bi bi-lock-fill text-warning" style="font-size:1.1rem;"></i>
        <span class="small fw-semibold text-dark">OC generada — esta cotización está bloqueada y no puede modificarse.</span>
        <span class="badge bg-warning text-dark ms-auto">{{ savedCotizFolio }}</span>
      </div>

      <!-- Header con controles: todo en una sola fila sin gaps -->
      <div style="margin-bottom: 5px; padding: 6px 10px; flex-shrink: 0; display: flex; align-items: center;">
        <label class="form-label small mb-0 me-1" style="white-space: nowrap;">Proveedor:</label>
        <ng-select
          [items]="providers"
          bindValue="id"
          bindLabel="description"
          [groupBy]="'group'"
          [(ngModel)]="selectedProviderId"
          [clearable]="true"
          [disabled]="ocGenerated"
          placeholder="Seleccione proveedor"
          (ngModelChange)="onProviderChange()"
          style="width: 50%; min-width: 150px;">
          <ng-template ng-optgroup-tmp let-item="item">
            <span style="font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; width: 100%; text-align: center; display: inline-block;">
              {{ item.group }}
            </span>
          </ng-template>
        </ng-select>
        <input type="file" #fileInput accept=".pdf" style="display: none;" (change)="onFileSelected($event)">
        <button class="btn btn-sm btn-outline-secondary" type="button" (click)="fileInput.click()" [disabled]="ocGenerated" title="Cargar PDF">
          <i class="bi bi-upload"></i>
        </button>
        <button class="btn btn-sm btn-outline-secondary" type="button" (click)="generatePlaceholderPdf()" title="Ver PDF">
          <i class="bi bi-file-earmark-pdf text-danger"></i>
        </button>
        <input type="date" class="form-control form-control-sm" [(ngModel)]="fechaProveedor" [disabled]="ocGenerated" style="width: 140px;">
        <button type="button" class="btn btn-sm btn-success position-relative" (click)="saveChanges()" [disabled]="savingChanges || ocGenerated" title="Guardar cotización">
          <span *ngIf="savingChanges" class="spinner-border spinner-border-sm"></span>
          <i *ngIf="!savingChanges" class="bi bi-floppy"></i>
          <span class="position-absolute top-0 start-100 translate-middle p-2 bg-danger border border-light rounded-circle" *ngIf="hasUnsavedChanges && !savingChanges && !ocGenerated">
            <span class="visually-hidden">Cambios sin guardar</span>
          </span>
        </button>
        <button type="button" class="btn btn-sm btn-warning" (click)="revertChanges()" [disabled]="ocGenerated" title="Deshacer">
          <i class="bi bi-arrow-clockwise"></i>
        </button>
        <button type="button" class="btn btn-sm btn-danger" (click)="deleteItem()" [disabled]="ocGenerated" title="Eliminar">
          <i class="bi bi-trash"></i>
        </button>
        <button type="button" class="btn btn-sm btn-primary ms-2" (click)="generateOC()" [disabled]="generatingOC || !cotizacionSaved || ocGenerated" title="Generar Orden de Compra">
          <span *ngIf="generatingOC" class="spinner-border spinner-border-sm me-1"></span>
          <i *ngIf="!generatingOC" class="bi bi-file-earmark-check me-1"></i>
          {{ generatingOC ? 'Generando...' : 'Generar OC' }}
        </button>
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
    </div>

    <!-- Modal Nuevo Proveedor -->
    <div *ngIf="showNewProviderModal" class="modal-backdrop-inline">
      <div class="modal-box-inline" (click)="$event.stopPropagation()">
        <div class="modal-header-inline">
          <span><i class="bi bi-building-add me-2"></i>Nuevo Proveedor</span>
          <button type="button" class="btn-close btn-close-white" (click)="cancelNewProvider()"></button>
        </div>
        <div class="modal-body-inline">
          <div class="mb-3" style="position: relative;">
            <label class="form-label small fw-semibold">Compañía <span class="text-danger">*</span></label>
            <input type="text" class="form-control form-control-sm"
              [(ngModel)]="newProvider.company"
              (ngModelChange)="onCompanyInput($event)"
              (blur)="hideCompanySuggestionsDelayed()"
              placeholder="Nombre de la empresa"
              autocomplete="off">
            <!-- Sugerencias -->
            <div *ngIf="showCompanySuggestions" class="company-suggestions">
              <div *ngFor="let s of companySuggestions"
                   class="company-suggestion-item"
                   (mousedown)="selectCompanySuggestion(s)">
                <i class="bi bi-exclamation-triangle-fill text-warning me-1"></i>{{ s }}
              </div>
            </div>
            <!-- Aviso duplicado -->
            <div *ngIf="companyDuplicateWarning" class="mt-1 text-danger small">
              <i class="bi bi-x-circle-fill me-1"></i>Ya existe: <strong>{{ companyDuplicateWarning }}</strong>
            </div>
          </div>
          <div class="mb-3">
            <label class="form-label small fw-semibold">Contacto principal</label>
            <input type="text" class="form-control form-control-sm" [(ngModel)]="newProvider.nameContact" placeholder="Nombre del contacto">
          </div>
          <div class="mb-3">
            <label class="form-label small fw-semibold">Teléfono</label>
            <input type="text" class="form-control form-control-sm" [(ngModel)]="newProvider.phone" placeholder="10 dígitos">
          </div>
          <div class="mb-3">
            <label class="form-label small fw-semibold">Correo</label>
            <input type="email" class="form-control form-control-sm"
              [(ngModel)]="newProvider.email"
              (ngModelChange)="emailInvalid = false"
              [class.is-invalid]="emailInvalid"
              placeholder="correo@ejemplo.com">
            <div *ngIf="emailInvalid" class="invalid-feedback">
              <i class="bi bi-x-circle-fill me-1"></i>Correo no válido.
            </div>
          </div>
          <div class="alert alert-warning py-1 px-2 small mb-0">
            <i class="bi bi-info-circle me-1"></i>El proveedor se creará como <strong>inactivo</strong>. Actívalo desde el catálogo de proveedores cuando esté listo.
          </div>
        </div>
        <div class="modal-footer-inline">
          <button type="button" class="btn btn-sm btn-secondary" (click)="cancelNewProvider()" [disabled]="savingProvider">
            Cancelar
          </button>
          <button type="button" class="btn btn-sm btn-primary" (click)="confirmNewProvider()" [disabled]="savingProvider || !newProvider.company">
            <span *ngIf="savingProvider" class="spinner-border spinner-border-sm me-1"></span>
            <i *ngIf="!savingProvider" class="bi bi-floppy me-1"></i>
            {{ savingProvider ? 'Guardando...' : 'Crear Proveedor' }}
          </button>
        </div>
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
    .modal-backdrop-inline {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.5);
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .modal-box-inline {
      background: #fff;
      border-radius: 8px;
      width: 380px;
      max-width: 95vw;
      box-shadow: 0 8px 32px rgba(0,0,0,0.25);
      display: flex;
      flex-direction: column;
    }
    .modal-header-inline {
      background: #0d6efd;
      color: #fff;
      padding: 12px 16px;
      border-radius: 8px 8px 0 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: 600;
      font-size: 0.95rem;
    }
    .modal-body-inline {
      padding: 16px;
    }
    .modal-footer-inline {
      padding: 10px 16px;
      border-top: 1px solid #dee2e6;
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
    .company-suggestions {
      position: absolute;
      top: 100%;
      left: 0; right: 0;
      background: white;
      border: 1px solid #ffc107;
      border-top: none;
      z-index: 10000;
      max-height: 160px;
      overflow-y: auto;
      box-shadow: 0 4px 8px rgba(0,0,0,0.15);
    }
    .company-suggestion-item {
      padding: 6px 10px;
      cursor: pointer;
      font-size: 0.82rem;
    }
    .company-suggestion-item:hover {
      background: #fff3cd;
    }
  `]
})
export class DetalleItemsProveedorComponent {
  private customersService = inject(CustomersService);
  private signalsService = inject(SignalsService);
  private ocandreqsService = inject(OcAndReqsService);

  private params!: ICellRendererParams;
  private gridApi!: GridApi;

  rowData: any[] = [];
  providers: any[] = [];
  selectedProviderId: number | null = null;
  selectedProviderObj: any = null;
  fechaProveedor: string = new Date().toISOString().split('T')[0];
  pdfFileName: string = '';
  selectedFile: File | null = null;
  hasUnsavedChanges: boolean = false;
  providerLabel: string = '';
  providerField: string = '';

  // Estado guardado
  cotizacionSaved: boolean = false;
  savedCotizFolio: string = '';
  savedOcId: number = 0;
  savingChanges: boolean = false;
  generatingOC: boolean = false;
  ocGenerated: boolean = false; // true = ya existe OC → candado total

  // Modal nuevo proveedor
  showNewProviderModal: boolean = false;
  savingProvider: boolean = false;
  newProvider = { company: '', nameContact: '', phone: '', email: '' };

  // Autocomplete compañía
  companySuggestions: string[] = [];
  showCompanySuggestions: boolean = false;
  companyDuplicateWarning: string = '';
  emailInvalid: boolean = false;

  private readonly NEW_PROVIDER_SENTINEL = -1;

  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  agInit(params: ICellRendererParams): void {
    this.params = params;
    // providerField viene por tres rutas posibles (detailCellRendererSelector params, node.data, o context)
    this.providerLabel = (params as any).providerLabel || params.data?.providerLabel || params.context?.providerLabel || 'Proveedor';
    this.providerField  = (params as any).providerField  || params.data?.providerField  || params.context?.providerField  || 'idProvider';

    const currentProviderId = this.params.data[this.providerField];
    if (currentProviderId && currentProviderId > 0) {
      this.selectedProviderId = currentProviderId;
    }

    this.buildRowData();
    this.loadProviders().then(() => {
      if (this.selectedProviderId) {
        this.selectedProviderObj = this.providers.find(p => p.id === this.selectedProviderId) || null;
      }
      // Cargar COTIZ existente DESPUÉS de providers para evitar titileo en ng-select
      this.loadExistingCotiz();
    });
  }

  onGridReady(params: any) {
    this.gridApi = params.api;
  }

  async loadProviders(): Promise<void> {
    try {
      const idRoot = this.signalsService.getRootSelectedBySidebar()();
      const allProviders: any = await this.customersService.getCustomersByCompany(idRoot, 'PROVIDERS').toPromise();

      // API devuelve: name=Company, Description=NameContact (ya filtrado active+vigente)
      const active = allProviders.map((p: any) => {
        const company = (p.name ?? '').trim();
        const contact = (p.Description ?? p.description ?? '').trim();
        const isCompany = !!company;
        return {
          id: p.id,
          description: isCompany ? company : (contact || `Proveedor ${p.id}`),
          group: isCompany ? 'Compañía' : 'Contacto',
          sortKey: isCompany ? company : contact
        };
      }).sort((a: any, b: any) => {
        if (a.group !== b.group) return a.group === 'Compañía' ? -1 : 1;
        return a.sortKey.localeCompare(b.sortKey, 'es', { sensitivity: 'base' });
      });

      this.providers = [
        { id: this.NEW_PROVIDER_SENTINEL, description: '+ Nuevo Proveedor' },
        ...active
      ];
    } catch (error) {
      console.error('❌ Error cargando proveedores:', error);
      this.providers = [{ id: this.NEW_PROVIDER_SENTINEL, description: '+ Nuevo Proveedor' }];
    }
  }

  buildRowData() {
    const articulos = (this.params.data.articulos || []).filter((item: any) => !!item.pedimento);

    this.rowData = articulos.map((item: any, index: number) => ({
      active: true,
      idSupplie: item.idSupplie || 0,
      recurrent: item.recurrent || 'Recurrente',
      numArticulo: item.recurrent === 'Nuevo' ? '' : (item.numArticle || (index + 1)),
      articulo: item.article || '',
      codigoExterno: '',
      costoUnitario: item.price || 0,
      compraMinima: 1,
      tiempoEntrega: '',
      cantidadConfirmada: item.quantity || 0,
      costoTotal: (item.price || 0) * (item.quantity || 0),
      autorizado: false,
      oc: ''
    }));
  }

  onProviderChange() {
    if (this.selectedProviderId === this.NEW_PROVIDER_SENTINEL) {
      this.selectedProviderId = null;
      this.selectedProviderObj = null;
      this.newProvider = { company: '', nameContact: '', phone: '', email: '' };
      this.showNewProviderModal = true;
      return;
    }
    this.selectedProviderObj = this.providers.find(p => p.id === this.selectedProviderId) || null;
    this.hasUnsavedChanges = true;
  }

  cancelNewProvider() {
    this.showNewProviderModal = false;
    this.newProvider = { company: '', nameContact: '', phone: '', email: '' };
    this.companySuggestions = [];
    this.showCompanySuggestions = false;
    this.companyDuplicateWarning = '';
    this.emailInvalid = false;
  }

  onCompanyInput(value: string) {
    this.companyDuplicateWarning = '';
    if (!value || value.trim().length < 1) {
      this.companySuggestions = [];
      this.showCompanySuggestions = false;
      return;
    }
    const term = value.trim().toLowerCase();
    this.companySuggestions = this.providers
      .filter(p => p.id !== this.NEW_PROVIDER_SENTINEL && p.description.toLowerCase().includes(term))
      .map(p => p.description);
    this.showCompanySuggestions = this.companySuggestions.length > 0;
  }

  selectCompanySuggestion(name: string) {
    this.newProvider.company = name;
    this.showCompanySuggestions = false;
    this.companyDuplicateWarning = name;
  }

  hideCompanySuggestionsDelayed() {
    setTimeout(() => { this.showCompanySuggestions = false; }, 200);
  }

  async confirmNewProvider() {
    if (!this.newProvider.company) return;

    if (this.newProvider.email && this.newProvider.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(this.newProvider.email.trim())) {
        this.emailInvalid = true;
        return;
      }
    }
    this.emailInvalid = false;

    this.savingProvider = true;
    const idRoot = this.signalsService.getRootSelectedBySidebar()();

    const payload = {
      idRoot,
      idBranch: 0,
      company: this.newProvider.company,
      nameContact: this.newProvider.nameContact,
      phone: this.newProvider.phone,
      email: this.newProvider.email,
      type: 'PROVIDERS',
      typeIntOrExt: 'Externo',
      vigente: false,
      active: true
    };

    try {
      const created: any = await this.customersService.addCustomer(payload).toPromise();
      await this.loadProviders();
      this.selectedProviderId = created?.id ?? null;
      this.hasUnsavedChanges = true;
      this.showNewProviderModal = false;
    } catch (error) {
      console.error('❌ Error creando proveedor:', error);
      alert('Error al crear el proveedor. Intente de nuevo.');
    } finally {
      this.savingProvider = false;
    }
  }

  onCellValueChanged(event: any) {
    this.hasUnsavedChanges = true;

    if (event.column.getColId() === 'costoUnitario' || event.column.getColId() === 'cantidadConfirmada') {
      const row = event.data;
      row.costoTotal = (row.costoUnitario || 0) * (row.cantidadConfirmada || 0);
      this.gridApi.refreshCells({ rowNodes: [event.node], force: true });
    }
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
                { text: '$0.00', alignment: 'right' },
                { text: '$0.00', alignment: 'right' }
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
    return this.selectedProviderObj?.description || 'Sin seleccionar';
  }

  async saveChanges() {
    if (!this.selectedProviderId) {
      alert('Seleccione un proveedor antes de guardar.');
      return;
    }
    if (this.savingChanges) return;
    this.gridApi?.stopEditing();
    this.savingChanges = true;

    // Capturar modo ANTES de guardar para el mensaje
    const isEditing = this.cotizacionSaved && this.savedOcId > 0;

    try {
      await this.saveCotizOrOC('COTIZ');
      this.cotizacionSaved = true;
      this.hasUnsavedChanges = false;
      // Mutar el nodo padre directamente (NO setData: destruiría el detail y resetearía precios)
      const providerName = this.getSelectedProviderName();
      this.params.node.data[this.providerField] = this.selectedProviderId;
      this.params.node.data['name_' + this.providerField] = providerName;
      this.params.api?.refreshCells({ rowNodes: [this.params.node], columns: [this.providerField], force: true });
      const msg = isEditing
        ? `✅ Cotización editada: ${this.savedCotizFolio}`
        : `✅ Cotización creada: ${this.savedCotizFolio}`;
      alert(msg);
    } catch (error: any) {
      console.error('❌ Error guardando cotización:', error);
      alert('Error al guardar la cotización. Intente de nuevo.');
    } finally {
      this.savingChanges = false;
    }
  }

  async generateOC() {
    if (!this.selectedProviderId) {
      alert('Seleccione un proveedor antes de generar la OC.');
      return;
    }
    if (this.generatingOC) return;
    this.gridApi?.stopEditing();
    this.generatingOC = true;

    try {
      const folio = await this.saveCotizOrOC('OC');
      this.ocGenerated = true; // 🔒 Bloquear todo una vez generada la OC
      alert(`✅ Orden de Compra generada: ${folio}`);
    } catch (error: any) {
      console.error('❌ Error generando OC:', error);
      alert('Error al generar la Orden de Compra. Intente de nuevo.');
    } finally {
      this.generatingOC = false;
    }
  }

  private async saveCotizOrOC(type: 'COTIZ' | 'OC'): Promise<string> {
    // Si es edición de COTIZ existente, borrar el registro anterior antes de crear el nuevo
    if (type === 'COTIZ' && this.savedOcId > 0) {
      await lastValueFrom(this.ocandreqsService.deleteOcAndReq(this.savedOcId)).catch(e =>
        console.warn('⚠️ No se pudo borrar COTIZ anterior:', e)
      );
      this.savedOcId = 0;
    }

    const idRoot = this.signalsService.getRootSelectedBySidebar()();
    const slotSuffix = this.providerField === 'idProvider' ? 'A' :
                       this.providerField === 'idProvider2' ? 'B' : 'C';
    const folio = `${type}-${this.params.data.cotizacionId}-${slotSuffix}-${Date.now()}`;
    const providerName = this.getSelectedProviderName();

    const ocPayload = {
      idRoot,
      folio,
      typeReference: 'delison',
      idReference: this.params.data.cotizacionId || 0,
      idReq: this.params.data.requisitionId || 0,
      dateCreate: new Date().toISOString().split('T')[0],
      idProvider: this.selectedProviderId,
      solicit: providerName.substring(0, 50),
      idDepartament: 0,
      delivery: 'NO APLICA',
      deliveryTime: '1 DAY',
      typeOc: 'INSUMOS',
      idPayment: 0,
      idCurrency: 0,
      type,
      datesupply: this.fechaProveedor || new Date().toISOString().split('T')[0],
      active: true
    };

    const created: any = await lastValueFrom(this.ocandreqsService.addOcAndReq(ocPayload));
    const newOcId = created.id;

    // Leer datos DIRECTO del grid para capturar valores editados
    const gridRows: any[] = [];
    this.gridApi.forEachNode((node: any) => gridRows.push(node.data));

    const details = gridRows.map((row: any) => ({
      idMovement: newOcId,
      idSupplie: row.idSupplie || 0,
      idProvider: this.selectedProviderId,
      nameProvider: providerName,
      quantity: parseFloat(row.cantidadConfirmada) || 0,
      price: parseFloat(row.costoUnitario) || 0,
      type,
      tiempoEntrega: row.tiempoEntrega || '',
      compraMinima: parseInt(row.compraMinima) || 1,
      autorizado: row.autorizado === true,
      active: row.active !== false,
      recurrent: row.recurrent || 'Recurrente',
      nameArticle: row.articulo || '',
      numArticle: String(row.numArticulo || ''),
      observation: row.codigoExterno || ''
    }));

    try {
      console.log(`💾 Guardando ${details.length} artículos para OC id=${newOcId}...`);
      for (let i = 0; i < details.length; i++) {
        console.log(`  → item ${i + 1}/${details.length}:`, details[i]);
        await lastValueFrom(this.ocandreqsService.addReqItem(details[i]));
      }
      console.log('✅ Todos los artículos guardados correctamente');
    } catch (itemError) {
      console.error('❌ Error guardando artículos, haciendo rollback del OC id=', newOcId, itemError);
      await lastValueFrom(this.ocandreqsService.deleteOcAndReq(newOcId)).catch(() => {});
      throw itemError;
    }

    if (type === 'COTIZ') {
      this.savedCotizFolio = folio;
      this.savedOcId = newOcId;
      await this.loadSavedItems(newOcId);
    }
    return folio;
  }

  async loadExistingCotiz(): Promise<void> {
    const cotizacionId = this.params.data.cotizacionId;
    if (!cotizacionId) return;

    const slotSuffix = this.providerField === 'idProvider' ? '-A-' :
                       this.providerField === 'idProvider2' ? '-B-' : '-C-';
    try {
      // Consultar COTIZ y OC en paralelo para determinar estado
      const [cotizData, ocData] = await Promise.all([
        lastValueFrom(this.ocandreqsService.getOcAndReqs('delison', cotizacionId, 'COTIZ')),
        lastValueFrom(this.ocandreqsService.getOcAndReqs('delison', cotizacionId, 'OC'))
      ]);

      const cotizList = Array.isArray(cotizData) ? cotizData : [];
      const ocList    = Array.isArray(ocData)    ? ocData    : [];

      // Verificar si ya existe OC para este slot → candado total
      const existingOC = ocList
        .filter((c: any) => c.folio?.includes(slotSuffix))
        .sort((a: any, b: any) => b.id - a.id)[0];
      if (existingOC) {
        this.ocGenerated = true;
        this.cotizacionSaved = true;
      }

      // Tomar COTIZ más reciente del slot
      const existing = cotizList
        .filter((c: any) => c.folio?.includes(slotSuffix))
        .sort((a: any, b: any) => b.id - a.id)[0];

      if (existing) {
        this.savedOcId = existing.id;
        this.cotizacionSaved = true;
        this.savedCotizFolio = existing.folio;
        // Pre-poblar proveedor si no estaba ya desde params.data (evita titileo en ng-select)
        if (existing.idProvider) {
          if (!this.selectedProviderId) {
            this.selectedProviderId = existing.idProvider;
          }
          // Siempre actualizar selectedProviderObj para que getSelectedProviderName() funcione
          if (!this.selectedProviderObj) {
            this.selectedProviderObj = this.providers.find(p => p.id === existing.idProvider) || null;
          }
        }
        if (existing.datesupply) {
          this.fechaProveedor = String(existing.datesupply).substring(0, 10);
        }
        await this.loadSavedItems(existing.id);
      }
    } catch (err) {
      console.error('Error cargando COTIZ existente:', err);
    }
  }

  async loadSavedItems(ocId: number): Promise<void> {
    try {
      const items: any = await lastValueFrom(this.ocandreqsService.getReqItems(ocId));
      const rows = Array.isArray(items) ? items : [];
      this.rowData = rows.map((item: any) => ({
        idSupplie: item.idSupplie || 0,
        recurrent: item.recurrent || 'Recurrente',
        active: item.active !== false,
        numArticulo: item.recurrent === 'Nuevo' ? '' : (item.numArticle || ''),
        articulo: item.description || item.nameArticle || '',
        codigoExterno: item.observation || '',
        costoUnitario: item.price || 0,
        compraMinima: item.compraMinima || 1,
        tiempoEntrega: item.tiempoEntrega || '',
        cantidadConfirmada: item.quantity || 0,
        costoTotal: item.total || 0,
        autorizado: item.autorizado || false,
        oc: ''
      }));
      this.gridApi?.setGridOption('rowData', this.rowData);
    } catch (err) {
      console.error('❌ Error cargando items guardados:', err);
    }
  }

  revertChanges() {
    this.buildRowData();
    this.hasUnsavedChanges = false;
    this.gridApi?.setGridOption('rowData', this.rowData);
  }

  deleteItem() {
    console.log('🗑️ Eliminar (frontend only)');
    alert('Funcionalidad de eliminación pendiente de implementar.');
  }

  get colDefs(): ColDef[] {
    return [
      {
        field: 'active',
        headerName: 'Activo',
        width: 100,
        cellRenderer: 'agCheckboxCellRenderer',
        cellEditor: 'agCheckboxCellEditor',
        editable: true
      },
      { field: 'numArticulo', headerName: '# Art', width: 130 },
      { field: 'articulo', headerName: 'Artículo', width: 140 },
      { field: 'codigoExterno', headerName: 'Cód. Externo', width: 120, editable: true },
      { field: 'compraMinima', headerName: 'Compra Mín.', width: 130, editable: true },
      { field: 'tiempoEntrega', headerName: 'T. Entrega', width: 120, editable: true },
      {
        field: 'costoUnitario',
        headerName: 'Costo Unit.',
        width: 130,
        editable: true,
        valueFormatter: params => params.value ? `$${params.value.toFixed(2)}` : '$0.00'
      },
      { field: 'cantidadConfirmada', headerName: 'Cant. Conf.', width: 130, editable: true },
      {
        field: 'costoTotal',
        headerName: 'Costo Total',
        width: 150,
        valueFormatter: params => params.value ? `$${params.value.toFixed(2)}` : '$0.00'
      },
      {
        field: 'autorizado',
        headerName: 'Autoriz.',
        width: 100,
        cellRenderer: 'agCheckboxCellRenderer',
        cellEditor: 'agCheckboxCellEditor',
        editable: true
      },
      { field: 'oc', headerName: 'OC', width: 80, editable: true }
    ];
  }

  public gridOptions: any = {
    headerHeight: 30,
    rowHeight: 28,
    animateRows: true,
    suppressCellFocus: false,
    stopEditingWhenCellsLoseFocus: true,
    domLayout: 'autoHeight',
    onCellEditingStarted: () => {
      // Si la OC ya fue generada, cancelar inmediatamente cualquier edición
      if (this.ocGenerated) {
        this.gridApi?.stopEditing(true);
      }
    }
  };
}
