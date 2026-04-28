import { Component, HostListener, inject, Renderer2, RendererFactory2, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, ICellRendererParams, GridApi } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { CustomersService } from 'app/services/customers.service';
import { SignalsService } from 'app/services/signals.service';
import { OcAndReqsService } from 'app/services/ocandreqs.service';
import { PedimentoModificationService } from 'app/services/pedimento-modification.service';
import { ProvidersService } from 'app/services/providers.service';
import { SucursalByMaterialProveedorService } from 'app/services/sucursalByMaterialProveedor.service';
import { CatalogadmonService } from 'app/services/catalogadmon.service';
import { MaterialsService } from 'app/services/materials.service';
import { alerts } from 'app/helpers/alerts';
import { NgSelectModule } from '@ng-select/ng-select';
import { lastValueFrom } from 'rxjs';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import { ItemCommentsCellRendererComponent } from 'app/shared/item-comments-cell-renderer/item-comments-cell-renderer.component';
import { ItemCommentsService } from 'app/services/item-comments.service';

pdfMake.vfs = pdfFonts.vfs;

@Component({
  selector: 'app-detalle-items-proveedor',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, NgSelectModule, ItemCommentsCellRendererComponent],
  template: `
    <div class="detail-grid-container">
      <!-- Banner de candado cuando ya existe OC -->
      <div *ngIf="ocGenerated"
           style="background:#fff3cd; border:1px solid #ffc107; border-radius:6px; padding:5px 12px; margin-bottom:5px; flex-shrink:0; display:flex; align-items:center; gap:8px;">
        <i class="bi bi-lock-fill text-warning" style="font-size:1.1rem;"></i>
        <span class="small fw-semibold text-dark">OC generada — esta cotización está bloqueada y no puede modificarse.</span>
        <span class="badge bg-warning text-dark ms-auto">{{ savedCotizFolio }}</span>
      </div>

      <!-- Header con controles -->
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
        <button class="btn btn-sm btn-outline-secondary" type="button" (click)="generatePlaceholderPdf()" [disabled]="ocGenerated" title="Ver PDF">
          <i class="bi bi-file-earmark-pdf text-danger"></i>
        </button>
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
          (cellValueChanged)="onCellValueChanged($event)"
          style="width: 100%; flex: 1 1 auto; min-height: 0;">
        </ag-grid-angular>
      </div>

      <!-- Total Cotización -->
      <div style="flex-shrink: 0; display: flex; justify-content: flex-end; align-items: center;
                  background: #c8e6c9; border-top: 2px solid #388e3c; padding: 4px 12px;">
        <span style="font-weight: bold; font-size: 0.85rem; color: #1b5e20;">Total Cotización:&nbsp;</span>
        <span style="font-weight: bold; font-size: 0.9rem; color: #1b5e20;">
          {{ totalCostoTotal | currency:'MXN':'symbol':'1.2-2' }}
        </span>
      </div>
    </div>

    <!-- Modal Nuevo Proveedor: ahora se renderiza global (en document.body) -->
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
export class DetalleItemsProveedorComponent {
  private customersService = inject(CustomersService);
  private signalsService = inject(SignalsService);
  private ocandreqsService = inject(OcAndReqsService);
  private pedimentoModificationService = inject(PedimentoModificationService);
  private providersService = inject(ProvidersService);
  private sucursalByMaterialProveedorService = inject(SucursalByMaterialProveedorService);
  private catalogadmonService = inject(CatalogadmonService);
  private itemCommentsService = inject(ItemCommentsService);
  private materialsService = inject(MaterialsService);

  private params!: ICellRendererParams;
  private gridApi!: GridApi;
  private renderer: Renderer2;
  private newProviderOverlayEl: HTMLElement | null = null;
  private newProviderOverlayUnlisteners: Array<() => void> = [];

  constructor(rendererFactory: RendererFactory2) {
    this.renderer = rendererFactory.createRenderer(null, null);
  }

  rowData: any[] = [];
  providers: any[] = [];
  selectedProviderId: number | null = null;
  selectedProviderObj: any = null;
  fechaProveedor: string = new Date().toISOString().split('T')[0];
  hasUnsavedChanges: boolean = false;
  totalCostoTotal: number = 0;
  providerLabel: string = '';
  providerField: string = '';
  private _colDefs: ColDef[] | null = null;

  requisitionId: number | null = null;
  idBranch: number | null = null;
  branchName: string = '';

  cotizacionSaved: boolean = false;
  savedCotizFolio: string = '';
  savedOcId: number = 0;
  savingChanges: boolean = false;
  generatingOC: boolean = false;
  ocGenerated: boolean = false;
  hasRowsWithTypeOC: boolean = false;

  // Modal global (se renderiza en document.body para no quedar atrapado por transforms de AG Grid)
  showNewProviderModal: boolean = false;
  savingProvider: boolean = false;
  newProvider = { company: '', nameContact: '', phone: '', email: '' };

  companySuggestions: string[] = [];
  showCompanySuggestions: boolean = false;
  companyDuplicateWarning: string = '';
  emailInvalid: boolean = false;

  typeocValues: string[] = [];
  private readonly AUTHORIZED_TYPES = ['COMPRA INMEDIATA', 'COMPRA AUTORIZADA', 'COMPRA AUTORIZADA EN OTRA FECHA'];
  private readonly NEW_PROVIDER_SENTINEL = -1;
  private rowsMissingProvider: any[] = [];

  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.providerLabel = (params as any).providerLabel || params.data?.providerLabel || params.context?.providerLabel || 'Proveedor';
    this.providerField = (params as any).providerField || params.data?.providerField || params.context?.providerField || 'idProvider';
    this.requisitionId = params.data?.requisitionId || null;
    this.idBranch = params.data?.idBranch || null;
    this.branchName = params.data?.branchName || '';

    const currentProviderId = this.params.data[this.providerField];
    if (currentProviderId && currentProviderId > 0) {
      this.selectedProviderId = currentProviderId;
    }

    this.catalogadmonService.getCatalogs(9, 'TYPEOC').subscribe({
      next: (items: any[]) => {
        this.typeocValues = items.filter(i => i.active).map(i => i.description as string);
        this._colDefs = null;
      },
      error: () => { this.typeocValues = []; }
    });

    this.buildRowData();
    this.loadProviders().then(() => {
      if (this.selectedProviderId) {
        this.selectedProviderObj = this.providers.find(p => p.id === this.selectedProviderId) || null;
      }
      this.loadExistingCotiz();
    });
  }

  onGridReady(params: any) {
    this.gridApi = params.api;
    if (this.ocGenerated) this.lockGrid();
    this.autoAdjustColumns();
  }

  @HostListener('window:resize')
  onWindowResize() {
    this.autoAdjustColumns();
  }

  private autoAdjustColumns() {
    if (!this.gridApi) return;
    const apiAny = this.gridApi as any;
    if (typeof apiAny.autoSizeAllColumns === 'function') {
      apiAny.autoSizeAllColumns(true);
    } else if (typeof apiAny.sizeColumnsToFit === 'function') {
      apiAny.sizeColumnsToFit();
    }
  }

  async loadProviders(): Promise<void> {
    try {
      const idRoot = this.signalsService.getRootSelectedBySidebar()();
      const allProviders: any = await this.customersService.getCustomersByCompany(idRoot, 'PROVIDERS').toPromise();
      const active = (allProviders || []).map((p: any) => {
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

      this.providers = [{ id: this.NEW_PROVIDER_SENTINEL, description: '+ Nuevo Proveedor' }, ...active];
    } catch (error) {
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
      proveedorXTablaId: 0,
      costoUnitario: item.price || 0,
      compraMinima: 1,
      tiempoEntrega: '',
      cantidadConfirmada: item.quantity || 0,
      costoTotal: (item.price || 0) * (item.quantity || 0),
      autorizado: false,
      oc: '',
      typeOC: '',
      comment: '',
      datePostpone: ''
    }));
    this.updateTotal();
    this.updateHasRowsWithTypeOC();
  }

  async onProviderChange() {
    if (this.selectedProviderId === this.NEW_PROVIDER_SENTINEL) {
      this.selectedProviderId = null;
      this.selectedProviderObj = null;
      this.newProvider = { company: '', nameContact: '', phone: '', email: '' };
      this.openNewProviderOverlay();
      return;
    }

    this.selectedProviderObj = this.providers.find(p => p.id === this.selectedProviderId) || null;
    this.hasUnsavedChanges = true;

    if (!this.selectedProviderId) return;

    try {
      // --- PASO 1: VALIDAR RELACIÓN MATERIAL-PROVEEDOR ---
      const assignments: any = await lastValueFrom(this.providersService.getProvidersXTable(this.selectedProviderId, 'MATERIAL'));
      const list: any[] = Array.isArray(assignments) ? assignments : [];

      const missingCodes: any[] = [];
      this.rowData.forEach(row => {
        const match = list.find((a: any) => Number(a.campo1) === Number(row.idSupplie));
        if (match) {
          row.codigoExterno = match.campo11 || '';
          row.proveedorXTablaId = match.id || 0;
          row.proveedorXTablaObj = match;
        } else {
          row.codigoExterno = '';
          row.proveedorXTablaId = 0;
          row.proveedorXTablaObj = null;
          if (row.idSupplie) missingCodes.push(row);
        }
      });

      // ALERTA 1: Vínculo Artículo-Proveedor
      if (missingCodes.length > 0) {
        const nombres = missingCodes.map((r: any) => `• ${r.articulo}`).join('\n');
        const result = await alerts.confirmAlert('Sin Código Externo', `Este proveedor no tiene Código Externo para:\n${nombres}\n\n¿Desea crear la vinculación artículo-proveedor ahora?`, 'warning', 'Sí, vincular');
        if (result.isConfirmed) {
          this.rowsMissingProvider = missingCodes;
          await this.createMissingProviderAssignments();
        } else {
          this.selectedProviderId = null;
          this.selectedProviderObj = null;
          this.rowData.forEach(row => { row.codigoExterno = ''; row.proveedorXTablaId = 0; });
          this.gridApi?.setGridOption('rowData', this.rowData);
          return;
        }
      }

      // --- PASO 2: VALIDAR AUTORIZACIÓN DE SUCURSAL ---
      const unauthorizedForBranch: any[] = [];
      for (const row of this.rowData) {
        if (row.proveedorXTablaId > 0 && this.idBranch) {
          try {
            const sucursales: any = await lastValueFrom(this.sucursalByMaterialProveedorService.getSucursalByMaterial(row.proveedorXTablaId));
            const listSuc = Array.isArray(sucursales) ? sucursales : [];
            const tienePermiso = listSuc.some((s: any) => Number(s.idSucursal) === Number(this.idBranch));
            if (!tienePermiso) unauthorizedForBranch.push(row);
          } catch (err) { console.warn(`Error validando sucursal para ${row.articulo}`, err); }
        }
      }

      if (unauthorizedForBranch.length > 0) {
        const nombres = unauthorizedForBranch.map(r => `• ${r.articulo}`).join('\n');
        const result = await alerts.confirmAlert('Proveedor no autorizado para zona', `El proveedor "${this.getSelectedProviderName()}" no tiene registrada la sucursal "${this.branchName}" para:\n\n${nombres}\n\n¿Deseas registrar esta sucursal ahora?`, 'info', 'Sí, registrar');
        if (result.isConfirmed) await this.registerMissingBranchAssignments(unauthorizedForBranch);
      }

      this.gridApi?.setGridOption('rowData', this.rowData);
    } catch (error) { console.error('Error en onProviderChange', error); }
  }

  private async registerMissingBranchAssignments(rows: any[]) {
    if (!this.idBranch || !this.selectedProviderId) return;
    alerts.showLoading('Registrando sucursal...', 'Asociando proveedor a la zona de entrega');
    try {
      for (const row of rows) {
        let materialProviderId = row.proveedorXTablaId;
        if (!materialProviderId || materialProviderId === 0) {
          const provPayload = {
            idTabla: this.selectedProviderId, campo1: row.idSupplie, campo2: 'NA', campo3: 'NA', campo4: 'NA', campo5: 'NA', campo6: 'NA',
            campo7: true, campo11: row.codigoExterno || '', campo9: row.costoUnitario || 0, campo10: this.idBranch, type: 'MATERIAL', vigente: true, principal: false, active: true
          };
          const createdProv: any = await lastValueFrom(this.providersService.addProviderXTable(provPayload));
          materialProviderId = createdProv?.id ?? createdProv?.ID ?? 0;
          row.proveedorXTablaId = materialProviderId;
        }
        if (materialProviderId > 0) {
          const sucursalPayload = {
            idMaterialByProveedor: materialProviderId, idSucursal: this.idBranch, fechaAlta: new Date().toISOString(),
            stockMinimo: 0, resurtido: 0, capacidadMaxAlmacen: 0, tiempoDeEntrega: 2, vigente: true, active: true
          };
          await lastValueFrom(this.sucursalByMaterialProveedorService.addSucursalByMaterial(sucursalPayload));
        }
      }
      alerts.closeLoading();
      alerts.reqSuccessToast('Éxito', `Proveedor vinculado a "${this.branchName}" correctamente`);
    } catch (error) {
      alerts.closeLoading();
      alerts.reqErrorToast('Error', 'No se pudo completar el registro automático');
    }
  }

  private async createMissingProviderAssignments(): Promise<void> {
    const branchId = this.signalsService.getBranchSelectedBySidebar()() || 0;
    for (const row of this.rowsMissingProvider) {
      const provPayload = {
        idTabla: this.selectedProviderId, campo1: row.idSupplie, campo2: 'NA', campo3: 'NA', campo4: 'NA', campo5: 'NA', campo6: 'NA',
        campo7: true, campo11: '', campo9: 0, campo10: branchId, type: 'MATERIAL', vigente: true, principal: false, active: true
      };
      try {
        const created: any = await lastValueFrom(this.providersService.addProviderXTable(provPayload));
        row.proveedorXTablaId = created?.id || 0;
        row.proveedorXTablaObj = created || null;
      } catch (error) { console.error(`Error creando asignación para ${row.articulo}`, error); }
    }
    this.rowsMissingProvider = [];
  }

  async saveChanges() {
    if (!this.selectedProviderId) { alert('Seleccione un proveedor.'); return; }
    if (this.savingChanges) return;
    this.gridApi?.stopEditing();
    this.savingChanges = true;
    try {
      await this.saveCotizOrOC('COTIZ');
      this.setArticulosPedimentoLocked(true);
      if (this.rowsMissingProvider.length > 0) await this.createMissingProviderAssignments();

      // ✅ Actualizar porAutorizar a true para artículos "Nuevo" con proveedor asignado
      await this.updatePorAutorizarForNewArticles();

      this.cotizacionSaved = true;
      this.hasUnsavedChanges = false;
      const providerName = this.getSelectedProviderName();
      this.params.node.data[this.providerField] = this.selectedProviderId;
      this.params.node.data['name_' + this.providerField] = providerName;
      this.params.api?.refreshCells({ rowNodes: [this.params.node], columns: [this.providerField], force: true });
      const cotizId = this.params.data.cotizacionId;
      const maestro: any = await lastValueFrom(this.ocandreqsService.getDetailedReq(cotizId));
      if (maestro) {
        maestro.dateModified = new Date().toISOString();
        await lastValueFrom(this.ocandreqsService.updateOcAndReq(cotizId, maestro));
        // Se elimina la notificación global para evitar el cierre de tablas por reordenamiento
        // this.pedimentoModificationService.pedimentoModified$.next(cotizId);
      }
      await alerts.ocCotizSaved(this.savedCotizFolio);
      const hasAuthorized = this.rowData.some(row => this.AUTHORIZED_TYPES.includes(row.typeOC));
      if (hasAuthorized) { this.savingChanges = false; await this.generateOC(); }
    } catch (error) { alert('Error al guardar.'); } finally { this.savingChanges = false; }
  }

  private async updatePorAutorizarForNewArticles(): Promise<void> {
    try {
      const newArticleItems = this.rowData.filter(item => (item.recurrent || '').toLowerCase() === 'nuevo');
      if (newArticleItems.length === 0) return;

      const idRoot = this.signalsService.getRootSelectedBySidebar()();

      for (const item of newArticleItems) {
        const materialId = item.idSupplie;
        if (!materialId || materialId === 0) continue;

        const materialData = {
          idCompany: idRoot,
          idBranch: null,
          idCustomer: null,
          insumo: item.articulo || '',
          articulo: item.articulo || '',
          idCategory: null,
          idFamilia: null,
          idSubfamilia: null,
          idMedida: null,
          idUbication: null,
          description: item.articulo || '',
          merma: 0,
          fecha: new Date().toISOString(),
          aplicaResg: false,
          costoMN: 0,
          costoDLL: 0,
          ventaMN: 0,
          ventaDLL: 0,
          stockMin: 0,
          stockMax: 0,
          picture: '',
          typeMaterial: 'CONSUMABLE',
          vigente: true,
          active: true,
          porAutorizar: true
        };

        await lastValueFrom(
          this.materialsService.updateMaterial(materialId.toString(), materialData)
        ).catch(() => {
          // Error silencioso
        });
      }
    } catch (err) {
      // No bloqueamos el flujo si falla
    }
  }

  private async saveCotizOrOC(type: 'COTIZ' | 'OC'): Promise<string> {
    if (type === 'COTIZ' && this.savedOcId > 0) {
      await lastValueFrom(this.ocandreqsService.deleteOcAndReq(this.savedOcId)).catch(() => {});
      this.savedOcId = 0;
    }
    const idRoot = this.signalsService.getRootSelectedBySidebar()();
    const idBranch = this.signalsService.getBranchSelectedBySidebar()();
    const slotSuffix = this.providerField === 'idProvider' ? 'A' : this.providerField === 'idProvider2' ? 'B' : 'C';
    const folio = `${type}-${this.params.data.cotizacionId}-${slotSuffix}-${Date.now()}`;
    const providerName = this.getSelectedProviderName();
    const ocPayload = {
      idRoot, folio, typeReference: type === 'OC' ? 'branch' : 'delison', idReference: type === 'OC' ? (idBranch || 0) : (this.params.data.cotizacionId || 0),
      idReq: this.params.data.requisitionId || 0, dateCreate: new Date().toISOString().split('T')[0], idProvider: this.selectedProviderId, solicit: providerName.substring(0, 50),
      idDepartament: 0, delivery: 'NO APLICA', deliveryTime: '1 DAY', typeOc: 'INSUMOS', idPayment: 0, idCurrency: 0, type, datesupply: this.fechaProveedor, active: true
    };
    const created: any = await lastValueFrom(this.ocandreqsService.addOcAndReq(ocPayload));
    const newOcId = Number(created?.id ?? created?.data?.id ?? created?.project?.id);
    const gridRows: any[] = [];
    this.gridApi.forEachNode((node: any) => gridRows.push(node.data));
    const rowsForDetails = type === 'OC' ? gridRows.filter((row: any) => this.AUTHORIZED_TYPES.includes(row.typeOC)) : gridRows;
    const details = rowsForDetails.map((row: any) => ({
      idMovement: newOcId, idSupplie: row.idSupplie || 0, idProvider: this.selectedProviderId, nameProvider: providerName, quantity: parseFloat(row.cantidadConfirmada) || 0,
      price: parseFloat(row.costoUnitario) || 0, type, recurrent: row.recurrent || 'Recurrente', nameArticle: row.articulo || '', numArticle: String(row.numArticulo || ''), observation: row.codigoExterno || '', typeOc: row.typeOC || '', comment: row.comment || ''
    }));
    for (const d of details) await lastValueFrom(this.ocandreqsService.addReqItem(d));
    if (type === 'COTIZ') { this.savedCotizFolio = folio; this.savedOcId = newOcId; await this.loadSavedItems(newOcId); }
    return folio;
  }

  async loadExistingCotiz(): Promise<void> {
    const cotizacionId = this.params.data.cotizacionId;
    if (!cotizacionId) return;
    const slotSuffix = this.providerField === 'idProvider' ? '-A-' : this.providerField === 'idProvider2' ? '-B-' : '-C-';
    try {
      const idBranch = this.signalsService.getBranchSelectedBySidebar()();
      const reqId = this.params.data.requisitionId || 0;
      const [cotizData, ocData] = await Promise.all([
        lastValueFrom(this.ocandreqsService.getOcAndReqs('delison', cotizacionId, 'COTIZ')),
        lastValueFrom(this.ocandreqsService.getOcAndReqs('branch', idBranch, 'OC'))
      ]);
      const ocList = (Array.isArray(ocData) ? ocData : []).filter((c: any) => Number(c.idReq) === Number(reqId));
      if (ocList.some((c: any) => c.folio?.includes(slotSuffix))) { this.ocGenerated = true; this.cotizacionSaved = true; this.lockGrid(); this.setArticulosPedimentoLocked(true); }
      const existing = (Array.isArray(cotizData) ? cotizData : []).filter((c: any) => c.folio?.includes(slotSuffix)).sort((a: any, b: any) => b.id - a.id)[0];
      if (existing) {
        this.savedOcId = existing.id; this.cotizacionSaved = true; this.savedCotizFolio = existing.folio;
        if (existing.idProvider) { this.selectedProviderId = existing.idProvider; this.selectedProviderObj = this.providers.find(p => p.id === existing.idProvider) || null; }
        if (existing.datesupply) this.fechaProveedor = String(existing.datesupply).substring(0, 10);
        await this.loadSavedItems(existing.id); this.setArticulosPedimentoLocked(true);
      }
    } catch (err) { console.error('Error loadExistingCotiz', err); }
  }

  async loadSavedItems(ocId: number): Promise<void> {
    try {
      const items: any = await lastValueFrom(this.ocandreqsService.getReqItems(ocId));
      this.rowData = (Array.isArray(items) ? items : []).map((item: any) => ({
        idSupplie: item.idSupplie || 0, recurrent: item.recurrent || 'Recurrente', active: item.active !== false, numArticulo: item.numArticle || '', articulo: item.description || item.nameArticle || '',
        codigoExterno: item.observation || '', proveedorXTablaId: 0, costoUnitario: item.price || 0, compraMinima: item.compraMinima || 1, tiempoEntrega: item.tiempoEntrega || '',
        cantidadConfirmada: item.quantity || 0, costoTotal: item.total || 0, autorizado: item.autorizado || false, oc: '', typeOC: item.typeOc || '', comment: item.comment || ''
      }));
      this.gridApi?.setGridOption('rowData', this.rowData); this.updateTotal(); this.updateHasRowsWithTypeOC();
    } catch (err) { console.error('Error loadSavedItems', err); }
  }

  revertChanges() { this.buildRowData(); this.updateTotal(); this.hasUnsavedChanges = false; this.gridApi?.setGridOption('rowData', this.rowData); }
  deleteItem() { alert('Eliminación no implementada.'); }

  get colDefs(): ColDef[] {
    if (this._colDefs) return this._colDefs;
    this._colDefs = [
      { field: 'active', headerName: 'Activo', width: 100, cellRenderer: 'agCheckboxCellRenderer', cellEditor: 'agCheckboxCellEditor', editable: true },
      { field: 'numArticulo', headerName: '# Art', width: 130 },
      { field: 'articulo', headerName: 'Artículo', width: 140 },
      { field: 'codigoExterno', headerName: 'Cód. Externo', width: 120, editable: true },
      { field: 'tiempoEntrega', headerName: 'T. Entrega', width: 120, editable: true },
      { field: 'compraMinima', headerName: 'Compra Mín.', width: 130, editable: true },
      { field: 'costoUnitario', headerName: 'Costo Unit.', width: 130, editable: true, valueFormatter: params => params.value ? `$${params.value.toFixed(2)}` : '$0.00' },
      { field: 'cantidadConfirmada', headerName: 'Cant. Conf.', width: 130, editable: true, hide: true },
      { field: 'costoTotal', headerName: 'Costo Total', width: 150, valueFormatter: params => params.value ? `$${params.value.toFixed(2)}` : '$0.00' },
      { headerName: 'Comentarios💬', width: 140, sortable: false, filter: false, cellRenderer: ItemCommentsCellRendererComponent, cellRendererParams: (params: any) => ({ documentType: 'REQ', idDocument: this.requisitionId, numArticle: params.data?.numArticulo || '', locked: this.ocGenerated }) },
      { field: 'typeOC', headerName: 'Tipo OC', width: 220, editable: true, hide: true, cellEditor: 'agRichSelectCellEditor', cellEditorParams: () => ({ values: this.typeocValues }), cellEditorPopup: true },
      { field: 'oc', headerName: 'OC', width: 80, editable: true, hide: true }
    ];
    if (this.ocGenerated) this._colDefs = this._colDefs.map(col => ({ ...col, editable: false }));
    return this._colDefs;
  }

  public gridOptions: any = {
    headerHeight: 30, rowHeight: 28, animateRows: true, suppressCellFocus: false, stopEditingWhenCellsLoseFocus: true, tooltipShowDelay: 400,
    defaultColDef: { resizable: true, sortable: true, filter: true, flex: 1, minWidth: 120 },
    onCellEditingStarted: () => { if (this.ocGenerated) this.gridApi?.stopEditing(true); }
  };

  private setArticulosPedimentoLocked(locked: boolean): void {
    const d = this.params?.node?.data as { articulosPedimentoLocked?: boolean } | undefined;
    if (d) d.articulosPedimentoLocked = locked;
  }

  private lockGrid() {
    if (!this.gridApi) return;
    this._colDefs = null;
    const lockedDefs = this.colDefs.map(col => ({ ...col, editable: false }));
    this.gridApi.setGridOption('columnDefs', lockedDefs);
    this.gridApi.setGridOption('suppressClickEdit', true);
    this.gridApi.refreshCells({ force: true });
  }

  private getSelectedProviderName(): string { return this.selectedProviderObj?.description || 'Sin seleccionar'; }
  updateTotal() { this.totalCostoTotal = this.rowData.reduce((sum, row) => sum + (row.costoTotal || 0), 0); }
  updateHasRowsWithTypeOC() { this.hasRowsWithTypeOC = this.rowData.some(row => !!(row.typeOC && row.typeOC.trim() !== '')); }
  onCellValueChanged(event: any) {
    this.hasUnsavedChanges = true;
    if (event.column.getColId() === 'costoUnitario' || event.column.getColId() === 'cantidadConfirmada') {
      const row = event.data; row.costoTotal = (row.costoUnitario || 0) * (row.cantidadConfirmada || 0);
      // Usar force: false para actualizar datos sin destruir el editor (evita perder el focus)
      this.gridApi.refreshCells({ rowNodes: [event.node], force: false });
    }
    this.updateTotal(); this.updateHasRowsWithTypeOC();
  }
  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
      alerts.reqSuccessToast('PDF Cargado', file.name);
    }
  }
  generatePlaceholderPdf() { alerts.basicAlert('PDF', 'Abriendo vista previa...', 'info'); }
  async generateOC() { this.generatingOC = true; setTimeout(() => { this.generatingOC = false; alerts.ocGenerated('OC-TEMP-123'); }, 1000); }
  ngOnDestroy(): void {
    this.closeNewProviderOverlay();
  }

  cancelNewProvider() {
    this.closeNewProviderOverlay();
  }
  onCompanyInput(value: string) {
    if (!value) { this.companySuggestions = []; this.showCompanySuggestions = false; return; }
    const term = value.toLowerCase();
    this.companySuggestions = this.providers.filter(p => p.id !== this.NEW_PROVIDER_SENTINEL && p.description.toLowerCase().includes(term)).map(p => p.description);
    this.showCompanySuggestions = this.companySuggestions.length > 0;
  }
  hideCompanySuggestionsDelayed() { setTimeout(() => { this.showCompanySuggestions = false; }, 200); }
  selectCompanySuggestion(name: string) { this.newProvider.company = name; this.showCompanySuggestions = false; }
  async confirmNewProvider() {
    if (!this.newProvider.company.trim()) return;

    this.savingProvider = true;
    try {
      const idRoot = this.signalsService.getRootSelectedBySidebar()();

      // 1. Crear el objeto del proveedor (Customer)
      const payload = {
        idRoot: idRoot,
        company: this.newProvider.company.trim().toUpperCase(),
        nameContact: (this.newProvider.nameContact || '').trim().toUpperCase(),
        phone: (this.newProvider.phone || '').trim(),
        email: (this.newProvider.email || '').trim(),
        type: 'PROVIDERS',
        typeIntOrExt: 'Externo', // Por defecto externo para nuevos desde compras
        active: true,
        vigente: true,
        autorizacion: true,
        position: 'GERENCIA'
      };

      // 2. Guardar en el microservicio de Administración
      const createdProvider: any = await lastValueFrom(this.customersService.addCustomer(payload));
      const newId = createdProvider?.id || createdProvider?.ID;

      if (!newId) throw new Error('No se obtuvo el ID del nuevo proveedor');

      // 3. Crear registro técnico inicial en ProveedorXTabla (CONTACT)
      const contactPayload = {
        campo1: 0,
        campo2: payload.nameContact || payload.company,
        campo3: payload.position,
        campo4: payload.phone,
        campo5: payload.email,
        campo6: 'NA',
        campo7: true,
        idTabla: newId,
        type: 'CONTACT'
      };
      await lastValueFrom(this.providersService.addProviderXTable(contactPayload)).catch(() => {});

      // 4. Actualizar interfaz
      await this.loadProviders(); // Recargar catálogo
      this.selectedProviderId = newId; // Seleccionar el nuevo
      
      this.closeNewProviderOverlay();
      alerts.reqSuccessToast('Éxito', `Proveedor "${payload.company}" creado y seleccionado`);

      // 5. Disparar lógica de vinculación (Artículos y Sucursal)
      await this.onProviderChange();

    } catch (error) {
      console.error('❌ Error al crear proveedor:', error);
      alerts.reqErrorToast('Error', 'No se pudo crear el proveedor en el servidor');
    } finally {
      this.savingProvider = false;
    }
  }

  private openNewProviderOverlay(): void {
    this.closeNewProviderOverlay();
    this.showNewProviderModal = true;

    const backdrop = this.renderer.createElement('div') as HTMLElement;
    this.renderer.setStyle(backdrop, 'position', 'fixed');
    this.renderer.setStyle(backdrop, 'inset', '0');
    this.renderer.setStyle(backdrop, 'background', 'rgba(0,0,0,0.55)');
    this.renderer.setStyle(backdrop, 'z-index', '999999');
    this.renderer.setStyle(backdrop, 'display', 'flex');
    this.renderer.setStyle(backdrop, 'align-items', 'center');
    this.renderer.setStyle(backdrop, 'justify-content', 'center');

    const modal = this.renderer.createElement('div') as HTMLElement;
    this.renderer.setStyle(modal, 'width', '420px');
    this.renderer.setStyle(modal, 'max-width', '95vw');
    this.renderer.setStyle(modal, 'background', '#fff');
    this.renderer.setStyle(modal, 'border-radius', '10px');
    this.renderer.setStyle(modal, 'box-shadow', '0 18px 55px rgba(0,0,0,0.45)');
    this.renderer.setStyle(modal, 'overflow', 'hidden');
    this.renderer.setStyle(modal, 'position', 'relative');

    // header
    const header = this.renderer.createElement('div') as HTMLElement;
    this.renderer.setStyle(header, 'background', '#0d6efd');
    this.renderer.setStyle(header, 'color', '#fff');
    this.renderer.setStyle(header, 'padding', '12px 16px');
    this.renderer.setStyle(header, 'display', 'flex');
    this.renderer.setStyle(header, 'align-items', 'center');
    this.renderer.setStyle(header, 'justify-content', 'space-between');

    const title = this.renderer.createElement('div') as HTMLElement;
    this.renderer.setStyle(title, 'font-weight', '700');
    this.renderer.setStyle(title, 'display', 'flex');
    this.renderer.setStyle(title, 'align-items', 'center');
    this.renderer.setStyle(title, 'gap', '8px');
    const icon = this.renderer.createElement('i');
    this.renderer.addClass(icon, 'bi');
    this.renderer.addClass(icon, 'bi-building-add');
    this.renderer.appendChild(title, icon);
    this.renderer.appendChild(title, this.renderer.createText('Nuevo Proveedor'));

    const closeBtn = this.renderer.createElement('button') as HTMLButtonElement;
    this.renderer.setAttribute(closeBtn, 'type', 'button');
    this.renderer.addClass(closeBtn, 'btn-close');
    this.renderer.addClass(closeBtn, 'btn-close-white');
    this.renderer.appendChild(header, title);
    this.renderer.appendChild(header, closeBtn);

    // body
    const body = this.renderer.createElement('div') as HTMLElement;
    this.renderer.setStyle(body, 'padding', '16px');

    const mkField = (labelText: string, placeholder: string, value: string, onChange: (v: string) => void, type: string = 'text') => {
      const wrap = this.renderer.createElement('div') as HTMLElement;
      this.renderer.setStyle(wrap, 'margin-bottom', '10px');
      const label = this.renderer.createElement('label') as HTMLElement;
      this.renderer.setStyle(label, 'font-size', '12px');
      this.renderer.setStyle(label, 'font-weight', '700');
      this.renderer.setStyle(label, 'margin-bottom', '4px');
      this.renderer.setStyle(label, 'display', 'block');
      this.renderer.appendChild(label, this.renderer.createText(labelText));
      const input = this.renderer.createElement('input') as HTMLInputElement;
      this.renderer.setAttribute(input, 'type', type);
      this.renderer.addClass(input, 'form-control');
      this.renderer.addClass(input, 'form-control-sm');
      this.renderer.setProperty(input, 'value', value || '');
      this.renderer.setAttribute(input, 'placeholder', placeholder);
      this.renderer.appendChild(wrap, label);
      this.renderer.appendChild(wrap, input);
      const un = this.renderer.listen(input, 'input', (ev: any) => onChange(String(ev?.target?.value ?? '')));
      this.newProviderOverlayUnlisteners.push(un);
      return wrap;
    };

    body.appendChild(mkField('Compañía *', 'Nombre de la empresa', this.newProvider.company, (v) => {
      this.newProvider.company = v;
      this.companyDuplicateWarning = '';
    }));
    body.appendChild(mkField('Contacto principal', 'Nombre del contacto', this.newProvider.nameContact, (v) => this.newProvider.nameContact = v));
    body.appendChild(mkField('Teléfono', '10 dígitos', this.newProvider.phone, (v) => this.newProvider.phone = v));
    body.appendChild(mkField('Correo', 'correo@ejemplo.com', this.newProvider.email, (v) => { this.newProvider.email = v; this.emailInvalid = false; }, 'email'));

    // footer
    const footer = this.renderer.createElement('div') as HTMLElement;
    this.renderer.setStyle(footer, 'padding', '10px 16px');
    this.renderer.setStyle(footer, 'border-top', '1px solid #dee2e6');
    this.renderer.setStyle(footer, 'display', 'flex');
    this.renderer.setStyle(footer, 'justify-content', 'flex-end');
    this.renderer.setStyle(footer, 'gap', '8px');

    const cancel = this.renderer.createElement('button') as HTMLButtonElement;
    this.renderer.setAttribute(cancel, 'type', 'button');
    this.renderer.addClass(cancel, 'btn');
    this.renderer.addClass(cancel, 'btn-sm');
    this.renderer.addClass(cancel, 'btn-secondary');
    this.renderer.appendChild(cancel, this.renderer.createText('Cancelar'));

    const create = this.renderer.createElement('button') as HTMLButtonElement;
    this.renderer.setAttribute(create, 'type', 'button');
    this.renderer.addClass(create, 'btn');
    this.renderer.addClass(create, 'btn-sm');
    this.renderer.addClass(create, 'btn-primary');
    this.renderer.appendChild(create, this.renderer.createText('Crear Proveedor'));

    // listeners
    this.newProviderOverlayUnlisteners.push(this.renderer.listen(closeBtn, 'click', () => this.closeNewProviderOverlay()));
    this.newProviderOverlayUnlisteners.push(this.renderer.listen(cancel, 'click', () => this.closeNewProviderOverlay()));
    this.newProviderOverlayUnlisteners.push(this.renderer.listen(backdrop, 'click', () => this.closeNewProviderOverlay()));
    this.newProviderOverlayUnlisteners.push(this.renderer.listen(modal, 'click', (e: Event) => e.stopPropagation()));
    this.newProviderOverlayUnlisteners.push(this.renderer.listen(create, 'click', () => {
      if (!String(this.newProvider.company || '').trim()) return;
      void this.confirmNewProvider();
    }));

    this.renderer.appendChild(footer, cancel);
    this.renderer.appendChild(footer, create);

    this.renderer.appendChild(modal, header);
    this.renderer.appendChild(modal, body);
    this.renderer.appendChild(modal, footer);

    this.renderer.appendChild(backdrop, modal);
    this.renderer.appendChild(document.body, backdrop);
    this.newProviderOverlayEl = backdrop;
  }

  private closeNewProviderOverlay(): void {
    this.showNewProviderModal = false;
    this.newProviderOverlayUnlisteners.forEach(fn => {
      try { fn(); } catch {}
    });
    this.newProviderOverlayUnlisteners = [];
    if (this.newProviderOverlayEl) {
      try { this.renderer.removeChild(document.body, this.newProviderOverlayEl); } catch {}
      this.newProviderOverlayEl = null;
    }
  }
}
