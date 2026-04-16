import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent, ICellRendererParams } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { alerts } from 'app/helpers/alerts';
import { lastValueFrom } from 'rxjs';
import { OcAndReqsService } from 'app/services/ocandreqs.service';
import { CatalogsService } from 'app/services/catalogs.service';
import { ProvidersService } from 'app/services/providers.service';
import { RootService } from 'app/services/root.service';
import { Base64EncodeService } from 'app/services/base64encode.service';
import { PrefixSetupService } from 'app/services/prefix-setup.service';
import pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';
(pdfMake as any).vfs = (pdfFonts as any).pdfMake?.vfs || (pdfFonts as any).default?.pdfMake?.vfs;

@Component({
  selector: 'app-provider-quote-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  templateUrl: './provider-quote-detail.component.html',
  styles: [`
    .provider-quote-container {
      padding: 15px;
      background-color: #f8f9fa;
      border-radius: 8px;
      height: 100%;
      display: flex;
      flex-direction: column;
    }

    .provider-header {
      background: linear-gradient(135deg, #6c757d 0%, #495057 100%);
      color: white;
      border-radius: 8px 8px 0 0;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .quote-grid-container {
      flex: 1;
      border: 1px solid #dee2e6;
      border-radius: 0 0 8px 8px;
      background-color: white;
      overflow: hidden;
    }

    :host-context(.provider-1) .provider-header {
      background: linear-gradient(135deg, #007bff 0%, #0056b3 100%);
    }

    :host-context(.provider-2) .provider-header {
      background: linear-gradient(135deg, #28a745 0%, #1e7e34 100%);
    }

    :host-context(.provider-3) .provider-header {
      background: linear-gradient(135deg, #ffc107 0%, #e0a800 100%);
    }
  `]
})
export class ProviderQuoteDetailComponent implements OnInit {

  private params!: ICellRendererParams;
  private gridApi!: GridApi;
  private context: any;
  private ocAndReqsService = inject(OcAndReqsService);
  private catalogsService = inject(CatalogsService);
  private providersService = inject(ProvidersService);
  private rootService = inject(RootService);
  private base64EncodeService = inject(Base64EncodeService);
  private prefixSetupService = inject(PrefixSetupService);

  rowData: any[] = [];
  hasUnsavedChanges: boolean = false;
  tempIdCounter: number = 0;
  quoteData: any = null;
  providerNumber: number = 0;
  productos: any[] = [];
  proveedores: any[] = [];
  idRoot: number = 0;
  cotizId: number = null;
  idProvider: number = null;
  providerName: string = '';
  isLocked: boolean = false; // True when COTIZ has been converted to OC
  activateOc: boolean = true; // True = show convert to OC button, False = hide it

  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  public gridOptions: any = {
    headerHeight: 35,
    rowHeight: 35,
    animateRows: true,
    rowSelection: 'single',
    domLayout: 'autoHeight',
    suppressDragLeaveHidesColumns: true,
    suppressHorizontalScroll: true,
    defaultColDef: {
      sortable: true,
      filter: true,
      resizable: true,
      flex: 1
    },
    onCellValueChanged: (event: any) => {
      event.data.__modified = true;
      this.hasUnsavedChanges = true;
    }
  };

  ngOnInit() {
    this.loadProviderQuoteData();
  }

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.context = params.context;
    this.quoteData = this.context?.providerQuoteData?.quoteData;
    this.providerNumber = this.context?.providerQuoteData?.providerNumber || 1;
    this.cotizId = this.context?.providerQuoteData?.cotizId || null;
    this.idProvider = this.context?.providerQuoteData?.idProvider || null;
    this.productos = this.context?.productos || [];
    this.proveedores = this.context?.proveedores || [];
    this.idRoot = this.context?.idRoot || 0;
    this.activateOc = this.context?.activateOc !== false; // Default to true if not set

    // Get provider name
    if (this.idProvider) {
      const provider = this.proveedores.find((p: any) => p.id === this.idProvider);
      this.providerName = provider ? provider.name : `Proveedor ${this.idProvider}`;
    }

    console.log('Provider Quote Detail - Data:', {
      quoteData: this.quoteData,
      providerNumber: this.providerNumber,
      cotizId: this.cotizId,
      idProvider: this.idProvider,
      idRoot: this.idRoot
    });

    this.loadProviderQuoteData();
  }

  async loadProviderQuoteData() {
    // If we have a cotizId, load items from the COTIZ record
    if (this.cotizId) {
      try {
        // Check if COTIZ is already converted to OC (locked)
        const cotizMaster: any = await lastValueFrom(
          this.ocAndReqsService.getDetailedReq(this.cotizId)
        );
        // If COTIZ has idOc or locked field, it's been converted
        this.isLocked = cotizMaster.idOc > 0 || cotizMaster.locked === true;
        console.log('COTIZ locked status:', this.isLocked, 'idOc:', cotizMaster.idOc);

        const [items, measures]: [any[], any[]] = await Promise.all([
          lastValueFrom(this.ocAndReqsService.getReqItems(this.cotizId)),
          lastValueFrom(this.catalogsService.getMeasures()).catch(() => [])
        ]);

        this.rowData = items.map((item: any) => {
          const producto = this.productos.find((p: any) => p.id === (item.idSupplie || item.id_supplie));
          const measure  = (measures as any[]).find((m: any) => m.id === (producto?.idMedida || item.idMedida));
          return {
            id: item.id,
            idMovement: item.idMovement || item.id_movement,
            idSupplie: item.idSupplie || item.id_supplie,
            idProvider: item.idProvider || item.id_provider,
            productName: producto ? producto.description : `Producto ${item.idSupplie || item.id_supplie}`,
            productCode: producto ? producto.code : (item.idSupplie || item.id_supplie),
            unit: measure?.description || producto?.measure || '',
            quantity: item.quantity || 0,
            price: item.price || 0,
            total: (item.quantity || 0) * (item.price || 0),
            comment: item.comment || '',
            dateuse: item.dateuse,
            providerNumber: this.providerNumber,
            __isNew: false,
            __modified: false
          };
        });

        if (this.gridApi) {
          this.gridApi.setGridOption('rowData', this.rowData);
        }
      } catch (error) {
        console.error('Error loading COTIZ items:', error);
        alerts.basicAlert('Error', 'No se pudieron cargar los items de la cotización', 'error');
      }
      return;
    }

    // Fallback: load from REQUIS if no cotizId (shouldn't happen with new flow)
    if (!this.quoteData || !this.quoteData.idReq) {
      console.log('No hay requisición seleccionada');
      return;
    }

    try {
      const requisitionItems: any = await lastValueFrom(
        this.ocAndReqsService.getReqItems(this.quoteData.idReq)
      );

      console.log('Requisition items loaded (fallback):', requisitionItems);

      this.rowData = requisitionItems.map((item: any, index: number) => {
        const producto = this.productos.find((p: any) => p.id === (item.idSupplie || item.id_supplie));
        return {
          id: `provider_${this.providerNumber}_item_${index}`,
          idQuoteItem: null,
          idRequisitionItem: item.id,
          idSupplie: item.idSupplie || item.id_supplie,
          productName: producto ? producto.description : `Producto ${item.idSupplie || item.id_supplie}`,
          productCode: producto ? producto.code : (item.idSupplie || item.id_supplie),
          quantity: item.quantity || 0,
          price: 0,
          total: 0,
          comment: item.comment || '',
          dateuse: item.dateuse,
          providerNumber: this.providerNumber,
          __isNew: true,
          __modified: false
        };
      });

      if (this.gridApi) {
        this.gridApi.setGridOption('rowData', this.rowData);
      }

    } catch (error) {
      console.error('Error loading provider quote data:', error);
      alerts.basicAlert('Error', 'No se pudieron cargar los datos de la requisición', 'error');
    }
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    this.gridApi.setGridOption('columnDefs', this.colDefs);
  }

  get colDefs(): ColDef[] {
    return [
      {
        headerName: '#',
        valueGetter: (params: any) => params.node ? params.node.rowIndex + 1 : '',
        width: 50,
        editable: false,
        sortable: false,
        filter: false,
        cellStyle: { backgroundColor: '#f8f9fa', textAlign: 'center', fontWeight: 'bold' }
      },
      {
        field: 'productCode',
        headerName: 'Código',
        width: 100,
        editable: false,
        cellStyle: { backgroundColor: '#f8f9fa' }
      },
      {
        field: 'productName',
        headerName: 'Descripción',
        flex: 2,
        editable: false,
        cellStyle: { backgroundColor: '#f8f9fa' }
      },
      {
        field: 'quantity',
        headerName: 'Cantidad Req',
        width: 100,
        editable: false,
        cellStyle: { backgroundColor: '#f8f9fa', textAlign: 'center' }
      },
      {
        field: 'unit',
        headerName: 'Unidad',
        width: 90,
        editable: false,
        cellStyle: { backgroundColor: '#f8f9fa', textAlign: 'center' }
      },
      {
        field: 'price',
        headerName: 'Precio',
        width: 120,
        editable: () => !this.isLocked,
        type: 'numericColumn',
        cellEditor: 'agNumberCellEditor',
        valueFormatter: (params) => {
          return params.value ? `$${params.value.toFixed(2)}` : '$0.00';
        },
        valueSetter: (params: any) => {
          if (this.isLocked) return false;
          params.data.price = parseFloat(params.newValue) || 0;
          this.calculateTotal(params.data);
          params.data.__modified = true;
          this.hasUnsavedChanges = true;
          return true;
        }
      },
      {
        field: 'total',
        headerName: 'Total',
        width: 120,
        editable: false,
        type: 'numericColumn',
        valueFormatter: (params) => {
          return params.value ? `$${params.value.toFixed(2)}` : '$0.00';
        },
        cellStyle: {
          backgroundColor: '#e8f5e9',
          fontWeight: 'bold',
          textAlign: 'center'
        }
      },
      {
        field: 'comment',
        headerName: 'Comentarios',
        flex: 1,
        editable: () => !this.isLocked,
        cellEditor: 'agLargeTextCellEditor',
        cellEditorParams: {
          maxLength: 500,
          rows: 3,
          cols: 50
        },
        valueSetter: (params: any) => {
          if (this.isLocked) return false;
          params.data.comment = params.newValue;
          params.data.__modified = true;
          this.hasUnsavedChanges = true;
          return true;
        }
      }
    ];
  }

  private getProviderColor(): string {
    const colors = ['', '#007bff', '#28a745', '#ffc107'];
    return colors[this.providerNumber] || '#6c757d';
  }

  private calculateTotal(item: any): void {
    item.total = item.quantity * item.price;
  }

  // Save changes to DB
  async saveChanges() {
    if (!this.hasUnsavedChanges) {
      alerts.basicAlert('Sin cambios', 'No hay cambios pendientes por guardar', 'info');
      return;
    }

    if (!this.cotizId) {
      alerts.basicAlert('Error', 'No hay cotización asociada para guardar.', 'error');
      return;
    }

    try {
      const modifiedItems = this.rowData.filter(item => item.__modified && !item.__isNew);
      const newItems = this.rowData.filter(item => item.__isNew);

      // Update existing items - do NOT send id field to avoid EF tracking issues
      for (const item of modifiedItems) {
        const updateData: any = {
          idMovement: this.cotizId,
          idSupplie: item.idSupplie,
          idProvider: this.idProvider,
          quantity: item.quantity,
          price: item.price,
          type: 'COTIZ',
          comment: item.comment || '',
          active: true
        };
        // Explicitly ensure no id fields are sent (causes EF key modification error)
        delete updateData.id;
        delete updateData.Id;
        console.log('📤 UPDATE item.id:', item.id, 'updateData:', JSON.stringify(updateData));
        await lastValueFrom(this.ocAndReqsService.updateReqItem(item.id.toString(), updateData));
      }

      // Add new items
      console.log('📤 New items to add:', newItems.length);
      for (const item of newItems) {
        const provider = this.proveedores.find((p: any) => p.id === this.idProvider);
        const addData: any = {
          idMovement: this.cotizId,
          idSupplie: item.idSupplie,
          idProvider: this.idProvider,
          nameProvider: provider ? provider.name : '',
          quantity: item.quantity,
          price: item.price,
          type: 'COTIZ',
          comment: item.comment || '',
          dateuse: item.dateuse,
          active: true
        };
        console.log('📤 ADD addData:', JSON.stringify(addData));
        await lastValueFrom(this.ocAndReqsService.addReqItem(addData));
      }

      alerts.basicAlert('Éxito', 'Cotización de proveedor guardada correctamente', 'success');
      this.hasUnsavedChanges = false;

      // Reload data from DB
      await this.loadProviderQuoteData();

    } catch (error) {
      console.error('Error saving COTIZ items:', error);
      alerts.basicAlert('Error', 'No se pudieron guardar los cambios.', 'error');
    }
  }

  deleteSelectedItem() {
    const selectedNodes = this.gridApi.getSelectedNodes();
    if (selectedNodes.length === 0) {
      alerts.basicAlert('Selección requerida', 'Por favor seleccione un item para eliminar', 'warning');
      return;
    }

    const selectedItem = selectedNodes[0].data;

    alerts.confirmAlert(
      'Confirmar eliminación',
      `¿Está seguro de eliminar este item de la cotización del proveedor?`,
      'warning',
      'Sí, eliminar'
    ).then(async (result) => {
      if (result.isConfirmed) {
        // If it has a real DB id, delete from server
        if (selectedItem.id && typeof selectedItem.id === 'number') {
          try {
            await lastValueFrom(this.ocAndReqsService.deleteReqItem(selectedItem.id));
          } catch (error) {
            console.error('Error deleting item from DB:', error);
          }
        }

        this.rowData = this.rowData.filter(item => item.id !== selectedItem.id);
        this.gridApi.setGridOption('rowData', this.rowData);
        this.hasUnsavedChanges = true;

        alerts.basicAlert('Item eliminado', 'El item se eliminó correctamente', 'success');
      }
    });
  }

  revertChanges() {
    if (!this.hasUnsavedChanges) {
      alerts.basicAlert('Sin cambios', 'No hay cambios pendientes por descartar', 'info');
      return;
    }

    this.loadProviderQuoteData();
    this.hasUnsavedChanges = false;
  }

  // Convert COTIZ to OC (Purchase Order)
  async convertToOC() {
    if (!this.cotizId || !this.idProvider) {
      alerts.basicAlert('Error', 'No hay cotización válida para convertir', 'error');
      return;
    }

    if (this.rowData.length === 0) {
      alerts.basicAlert('Sin items', 'No hay items para crear la Orden de Compra', 'warning');
      return;
    }

    // Confirm with user
    const result = await alerts.confirmAlert(
      'Convertir a Orden de Compra',
      `¿Desea crear una Orden de Compra basada en esta cotización de ${this.providerName}?`,
      'question',
      'Sí, crear OC'
    );

    if (!result.isConfirmed) return;

    try {
      // Get COTIZ master data to copy fields
      const cotizMaster: any = await lastValueFrom(
        this.ocAndReqsService.getDetailedReq(this.cotizId)
      );

      // Generar folio automáticamente desde PrefixSetup
      const type: 'project' | 'branch' = cotizMaster.typeReference === 'project' ? 'project' : 'branch';
      const folio = await this.prefixSetupService.getNextFolio(type, cotizMaster.idReference, 'oc');

      // Create OC record
      const ocData: any = {
        type: 'OC',
        folio: folio || `OC-${cotizMaster.folio || this.cotizId}`,
        typeReference: cotizMaster.typeReference,
        idReference: cotizMaster.idReference,
        idReq: cotizMaster.idReq,
        idProvider: this.idProvider,
        dateCreate: new Date().toISOString(),
        dateSupply: cotizMaster.dateSupply || new Date().toISOString(),
        idDepartament: cotizMaster.idDepartament || 0,
        solicit: cotizMaster.solicit || '',
        delivery: cotizMaster.delivery || 'A',
        deliveryTime: cotizMaster.deliveryTime || '',
        typeOc: cotizMaster.typeOc || 'INSUMOS',
        idPayment: cotizMaster.idPayment || 0,
        idCurrency: cotizMaster.idCurrency || 0,
        idAuthorize: cotizMaster.idAuthorize || 0,
        active: true
      };

      console.log('Creating OC from COTIZ:', ocData);
      const ocResponse: any = await lastValueFrom(this.ocAndReqsService.addOcAndReq(ocData));
      const ocId = ocResponse.id;
      console.log('OC created with ID:', ocId);

      // Copy items from COTIZ to OC
      for (const item of this.rowData) {
        const detailData: any = {
          idMovement: ocId,
          idSupplie: item.idSupplie,
          idProvider: this.idProvider,
          nameProvider: this.providerName,
          quantity: item.quantity,
          price: item.price,
          dateuse: item.dateuse,
          type: 'OC',
          comment: item.comment || '',
          active: true
        };
        await lastValueFrom(this.ocAndReqsService.addReqItem(detailData));
      }

      // Lock the COTIZ using the PATCH endpoint
      await lastValueFrom(this.ocAndReqsService.lockRequisition(this.cotizId, true));
      this.isLocked = true;
      console.log('COTIZ locked:', this.cotizId);

      // Calculate total
      const total = this.rowData.reduce((sum, item) => sum + (item.quantity * item.price), 0);

      alerts.basicAlert(
        'Orden de Compra Creada',
        `Se ha creado la OC ${ocData.folio} con ${this.rowData.length} items. Total: $${total.toFixed(2)}`,
        'success'
      );

    } catch (error) {
      console.error('Error creating OC from COTIZ:', error);
      alerts.basicAlert('Error', 'No se pudo crear la Orden de Compra', 'error');
    }
  }

  async generatePDF() {
    if (!this.rowData || this.rowData.length === 0) {
      alerts.basicAlert('Sin datos', 'No hay items para generar el PDF', 'warning');
      return;
    }

    try {
      const HEADER_BLUE = '#2F75B6';
      const LABEL_BLUE  = '#D9E1F2';
      const MIN_ROWS    = 10;

      // ── Datos de empresa ──────────────────────────────────────────────
      const rootResponse: any = await lastValueFrom(this.rootService.getRootbyId(this.idRoot));
      const logoBase64 = rootResponse.picture
        ? await this.base64EncodeService.convertImageToBase64(rootResponse.picture)
        : '';
      const watermarkBase64 = null;

      // ── Datos del proveedor ───────────────────────────────────────────
      let contacto = '';
      let correo   = '';
      let telefono = '';
      if (this.idProvider) {
        try {
          const prov: any = await lastValueFrom(this.providersService.getProviderById(this.idProvider));
          contacto = prov?.namecontact || '';
          correo   = prov?.email       || '';
          telefono = prov?.phone || prov?.mobile || '';
        } catch { /* proveedor no crítico */ }
      }

      // ── Folio y fechas del COTIZ ──────────────────────────────────────
      let cotizFolio    = '';
      let fechaSolicitud = '';
      let fechaRequerida = '';
      if (this.cotizId) {
        try {
          const cotizMaster: any = await lastValueFrom(this.ocAndReqsService.getDetailedReq(this.cotizId));
          cotizFolio     = cotizMaster.folio        || '';
          fechaSolicitud = this.formatDateShort(cotizMaster.dateCreate  || cotizMaster.datecreate);
          fechaRequerida = cotizMaster.deliveryTime || this.formatDateShort(cotizMaster.dateSupply || cotizMaster.datesupply);
        } catch { /* no crítico */ }
      }
      if (!fechaSolicitud) fechaSolicitud = this.formatDateShort(new Date().toISOString());

      // unit ya viene en rowData desde loadProviderQuoteData
      const itemsConUnidad = this.rowData;

      // ── Fecha del documento (encabezado) ─────────────────────────────
      const today = this.formatDateShort(new Date().toISOString());

      // ── Tabla de artículos (mínimo MIN_ROWS filas) ────────────────────
      const rows = [...itemsConUnidad];
      while (rows.length < MIN_ROWS) rows.push({ _empty: true });

      const itemsBody: any[] = [
        [
          { text: 'No.',                          style: 'tableHeader' },
          { text: 'Descripción del Bien/Servicio', style: 'tableHeader' },
          { text: 'Cantidad',                     style: 'tableHeader', alignment: 'center' },
          { text: 'Unidad',                        style: 'tableHeader', alignment: 'center' },
          { text: 'Especificaciones',              style: 'tableHeader' },
          { text: 'Observaciones',                 style: 'tableHeader' }
        ],
        ...rows.map((item: any, i: number) => item._empty
          ? [
              { text: '', style: 'tableCell' },
              { text: '', style: 'tableCell' },
              { text: '', style: 'tableCell' },
              { text: '', style: 'tableCell' },
              { text: '', style: 'tableCell' },
              { text: '', style: 'tableCell' }
            ]
          : [
              { text: (i + 1).toString(), style: 'tableCell', alignment: 'center' },
              { text: item.productName || '', style: 'tableCell' },
              { text: item.quantity != null ? item.quantity.toString() : '', style: 'tableCell', alignment: 'center' },
              { text: item.unit || '', style: 'tableCell', alignment: 'center' },
              { text: item.comment || '', style: 'tableCell' },
              { text: '', style: 'tableCell' }
            ]
        )
      ];

      // ── Images dict ───────────────────────────────────────────────────
      const images: any = {};
      if (logoBase64)     images['logo']      = logoBase64;
      if (watermarkBase64) images['watermark'] = watermarkBase64;

      // ── Celda logo (con fallback si no hay imagen) ────────────────────
      const logoCell = logoBase64
        ? { image: 'logo', width: 90, rowSpan: 2, alignment: 'center', margin: [0, 4, 0, 4] }
        : { text: rootResponse?.name || '', rowSpan: 2, bold: true, alignment: 'center', margin: [0, 12, 0, 0] };

      // ── Documento ─────────────────────────────────────────────────────
      const docDefinition: any = {
        pageSize: 'LETTER',
        pageMargins: [35, 35, 35, 40],
        defaultStyle: { fontSize: 9 },

        background: watermarkBase64 ? [{
          image: 'watermark', width: 400, opacity: 0.12,
          absolutePosition: { x: 106, y: 220 }
        }] : [],

        content: [
          // ── ENCABEZADO ────────────────────────────────────────────────
          {
            table: {
              widths: [100, '*', 155],
              body: [
                [
                  logoCell,
                  { text: 'SOLICITUD DE COTIZACIÓN', style: 'mainTitle', alignment: 'center', margin: [0, 8, 0, 8] },
                  {
                    rowSpan: 2,
                    stack: [
                      { text: 'Código: HCO-ADM-FO-043', fontSize: 8, bold: true,  margin: [3, 3, 3, 1] },
                      { text: 'REF: HCO-ADM-SGC-003',   fontSize: 8, bold: true,  margin: [3, 1, 3, 1] },
                      { text: `Fecha: ${today}`,          fontSize: 8,             margin: [3, 1, 3, 1] },
                      { text: 'REV.: 00',                 fontSize: 8,             margin: [3, 1, 3, 3] }
                    ]
                  }
                ],
                [
                  {},
                  {
                    text: rootResponse?.name || '',
                    bold: true, fontSize: 10, alignment: 'center',
                    fillColor: HEADER_BLUE, color: 'white',
                    margin: [0, 4, 0, 4]
                  },
                  {}
                ]
              ]
            },
            layout: { hLineWidth: () => 1, vLineWidth: () => 1, hLineColor: () => '#555', vLineColor: () => '#555' },
            margin: [0, 0, 0, 0]
          },

          // ── INFO PROVEEDOR ────────────────────────────────────────────
          {
            table: {
              widths: ['18%', '32%', '22%', '28%'],
              body: [
                [
                  { text: 'Proveedor:',         style: 'infoLabel', fillColor: LABEL_BLUE },
                  { text: this.providerName || '', style: 'infoValue' },
                  { text: 'Fecha de Solicitud:', style: 'infoLabel', fillColor: LABEL_BLUE },
                  { text: fechaSolicitud,          style: 'infoValue' }
                ],
                [
                  { text: 'Contacto:',          style: 'infoLabel', fillColor: LABEL_BLUE },
                  { text: contacto,              style: 'infoValue' },
                  { text: 'Fecha Requerida:',    style: 'infoLabel', fillColor: LABEL_BLUE },
                  { text: fechaRequerida,         style: 'infoValue' }
                ],
                [
                  { text: 'Correo:',            style: 'infoLabel', fillColor: LABEL_BLUE },
                  { text: correo,                style: 'infoValue' },
                  { text: 'Folio:',              style: 'infoLabel', fillColor: LABEL_BLUE },
                  { text: cotizFolio,             style: 'infoValue' }
                ],
                [
                  { text: 'Teléfono:',          style: 'infoLabel', fillColor: LABEL_BLUE },
                  { text: telefono,              style: 'infoValue' },
                  { text: 'No. Requisición de\nReferencia:', style: 'infoLabel', fillColor: LABEL_BLUE },
                  { text: this.quoteData?.folio || '', style: 'infoValue' }
                ]
              ]
            },
            layout: { hLineWidth: () => 1, vLineWidth: () => 1, hLineColor: () => '#555', vLineColor: () => '#555' },
            margin: [0, 0, 0, 0]
          },

          // ── TABLA DE ARTÍCULOS ────────────────────────────────────────
          {
            table: {
              headerRows: 1,
              widths: [28, '*', 50, 45, 110, 110],
              body: itemsBody
            },
            layout: {
              fillColor: (row: number) => row === 0 ? HEADER_BLUE : null,
              hLineWidth: () => 0.5,
              vLineWidth: () => 0.5,
              hLineColor: () => '#555',
              vLineColor: () => '#555'
            },
            margin: [0, 0, 0, 0]
          },

          // ── COMENTARIOS ADICIONALES ───────────────────────────────────
          {
            table: {
              widths: ['*'],
              body: [
                [{ text: 'Comentarios adicionales:', style: 'infoLabel', fillColor: LABEL_BLUE }],
                [{ text: '\n\n\n\n', fontSize: 8 }]
              ]
            },
            layout: { hLineWidth: () => 1, vLineWidth: () => 1, hLineColor: () => '#555', vLineColor: () => '#555' },
            margin: [0, 0, 0, 0]
          }
        ],

        styles: {
          mainTitle:  { fontSize: 15, bold: true },
          infoLabel:  { bold: true, fontSize: 8, margin: [2, 3, 2, 3] },
          infoValue:  { fontSize: 8, margin: [2, 3, 2, 3] },
          tableHeader:{ bold: true, fontSize: 8, color: 'white', fillColor: HEADER_BLUE, margin: [2, 3, 2, 3] },
          tableCell:  { fontSize: 7, margin: [2, 3, 2, 3] }
        },

        images,

        footer: (currentPage: number, pageCount: number) => ({
          columns: [
            { text: `Solicitud de Cotización - ${this.providerName}`, fontSize: 7, color: '#666', margin: [35, 0, 0, 0] },
            { text: `Página ${currentPage} de ${pageCount}`,          fontSize: 7, color: '#666', alignment: 'right', margin: [0, 0, 35, 0] }
          ],
          margin: [0, 15, 0, 0]
        })
      };

      const filename = `Solicitud-Cotizacion-${cotizFolio || this.quoteData?.folio || 'SC'}.pdf`;
      pdfMake.createPdf(docDefinition).download(filename);

    } catch (error) {
      console.error('Error generando el reporte PDF:', error);
      alerts.basicAlert('Error', 'No se pudo generar el reporte PDF', 'error');
    }
  }

  private formatDateShort(value: string | Date | null | undefined): string {
    if (!value) return '';
    try {
      const s = typeof value === 'string' ? value : value.toISOString();
      if (s.match(/^\d{4}-\d{2}-\d{2}/)) {
        const [y, m, d] = s.split('T')[0].split('-');
        return `${d}/${m}/${y}`;
      }
      const dt = new Date(s);
      if (isNaN(dt.getTime())) return '';
      return `${dt.getDate().toString().padStart(2,'0')}/${(dt.getMonth()+1).toString().padStart(2,'0')}/${dt.getFullYear()}`;
    } catch { return ''; }
  }

  private formatCurrency(value: number): string {
    return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  private formatDate(dateStr: string): string {
    if (!dateStr) return 'N/A';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
    } catch {
      return dateStr.split('T')[0] || dateStr;
    }
  }
}
