import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { DomainsModule } from 'app/domains/domainsmodule';
import { TrackingService } from 'app/services/tracking.service';

import {
  ColDef,
  GridApi,
  GridReadyEvent,
  ICellRendererParams,
} from 'ag-grid-enterprise';
import { alerts } from '../../../../helpers/alerts';
import { AdministrationService } from 'app/services/administration.service';
import { AgGridModule } from 'ag-grid-angular';
import { AuthService } from 'app/services/auth.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RootService } from 'app/services/root.service';
import { Base64EncodeService } from 'app/services/base64encode.service';
import { lastValueFrom } from 'rxjs';
import { SignalsService } from 'app/services/signals.service';
@Component({
  selector: 'app-saldos-palacio',
  standalone: true,
  imports: [
    RouterModule,
    DomainsModule,
    AgGridModule,
    CommonModule,
    FormsModule
  ],
  templateUrl: './saldos-palacio.component.html',
  styleUrl: './saldos-palacio.component.scss',
})
export class SaldosPalacioComponent {
  authService = inject(AuthService);
  signalsService = inject(SignalsService);

  constructor() {
    this.obtenerDatos();
    this.obtenerBanks();
    this.invited = this.signalsService.getInvited()();
  }

  private trackingService = inject(TrackingService);
  private administrationService = inject(AdministrationService);
  private rootService = inject(RootService);
  private base64EncodeService = inject(Base64EncodeService);

  // Propiedades para el modal de reporte
  showReportModal: boolean = false;
  reportStartDate: string = '';
  reportEndDate: string = '';
  invited: boolean = false;
  isGeneratingReport: boolean = false;

  saldoData: any[] = [];
  rowDetails: any[] = [];
  selectedRowData: any = null;
  private gridApi: GridApi;
  private detailsGridApi: GridApi;
  loading: boolean = false;
  private lastSelectedId: string | null = null;
  banks: any;

  // Column Definitions: Defines the columns to be displayed.
  public gridOptions: any = {
    headerHeight: 30,
    rowHeight: 30,
    suppressDragLeaveHidesColumns: true,
    rowGroupPanelShow: 'never',
    suppressRowClickSelection: true,
    getRowClass: (params) => {
      if (params.node.isSelected()) {
        return 'selected-row';
      }
      return '';
    },
    onRowClicked: (event) => {
      event.node.setSelected(true);
    },
    onRowSelected: (event) => {
      if (event.node.isSelected()) {
        this.gridApi.forEachNode((node) => {
          if (node.id !== event.node.id) {
            node.setSelected(false);
          }
        });
      }
    },
  };

  private _colMaster: ColDef[] = [];
  private _colDetails: ColDef[] = [];

  get colMaster(): ColDef[] {
    if (this._colMaster.length > 0) {
      return this._colMaster;
    }

    this._colMaster = [
      {
        field: 'idBanco',
        headerName: 'Banco',
        editable: false,
        width: 150,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: this.banks ? this.banks.map((item) => item.id) : [],
        },
        valueFormatter: (params) => {
          const foundItem = this.banks
            ? this.banks.find((item) => item.id === params.value)
            : null;
          return foundItem ? `${foundItem.name}` : params.value;
        },
      },
      {
        field: 'numberAccount',
        headerName: 'Numero Cuenta',
        editable: false,
        filter: true,
        width: 200,
      },
      {
        field: 'nameAccount',
        headerName: 'Nombre Cuenta',
        editable: false,
        width: 360,
        filter: true,
      },
      {
        field: 'interbancaria',
        headerName: 'Interbancaria',
        editable: false,
        width: 160,
      },
      {
        field: 'folioCheque',
        headerName: 'Inicio Cheque',
        editable: false,
        width: 129,
      },
      {
        field: 'folioSinCheque',
        headerName: 'Termino Cheque',
        editable: false,
        width: 140,
      },
      {
        field: 'gasto',
        headerName: 'Gastos',
        editable: false,
        width: 105,
        valueFormatter: (params) =>
          params.value?.toLocaleString('es-MX', {
            style: 'currency',
            currency: 'MXN',
          }),
      },
      {
        field: 'depositoPagado',
        headerName: 'Ingresos',
        editable: false,
        width: 105,
        valueFormatter: (params) =>
          params.value?.toLocaleString('es-MX', {
            style: 'currency',
            currency: 'MXN',
          }),
      },
      {
        field: 'saldo',
        headerName: 'Saldo',
        editable: false,
        width: 110,
        valueFormatter: (params) =>
          params.value?.toLocaleString('es-MX', {
            style: 'currency',
            currency: 'MXN',
          }),
      },
      {
        field: 'maskin',
        headerName: 'Mask In',
        editable: false,
        width: 120,
        filter: true,
      },
      {
        field: 'consecin',
        headerName: 'Consec In',
        editable: false,
        width: 110,
        filter: true,
      },
      {
        field: 'maskex',
        headerName: 'Mask Ex',
        editable: false,
        width: 120,
        filter: true,
      },
      {
        field: 'consecex',
        headerName: 'Consec Ex',
        editable: false,
        width: 110,
        filter: true,
      },
    ];

    return this._colMaster;
  }

  get colDetails(): ColDef[] {
    if (this._colDetails.length > 0) {
      return this._colDetails;
    }

    this._colDetails = [
      {
        field: 'numeroDocumento',
        headerName: 'Numero Documento',
        filter: true,
        width: 200,
        cellStyle: (params) => {
          const deposito = typeof params.data.deposito === 'string'
            ? parseFloat(params.data.deposito.replace(/,/g, ''))
            : params.data.deposito || 0;
          const gasto = typeof params.data.gasto === 'string'
            ? parseFloat(params.data.gasto.replace(/,/g, ''))
            : params.data.gasto || 0;
          return {
            backgroundColor: deposito > 0 ? '#e6ffe6' : gasto > 0 ? '#ffe6e6' : null,
          };
        },
      },
      {
        field: 'fecha',
        headerName: 'Fecha',
        width: 150,
        filter: true,
      },
      {
        field: 'descripcion',
        headerName: 'Descripción',
        width: 300,
      },
      {
        field: 'tipo',
        headerName: 'Tipo',
        width: 150,
      },
      {
        field: 'deposito',
        headerName: 'Ingreso',
        width: 150,
        valueFormatter: (params) => {
          const value = params.value || 0;
          return `$${value.toLocaleString('es-MX', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`;
        },
        cellStyle: (params) => {
          const value = typeof params.value === 'string'
            ? parseFloat(params.value.replace(/,/g, ''))
            : params.value || 0;
          return {
            color: value > 0 ? '#198754' : null,
            backgroundColor: value > 0 ? '#e6ffe6' : null,
            fontWeight: value > 0 ? 'bold' : 'normal',
          };
        },
      },
      {
        field: 'gasto',
        headerName: 'Egreso',
        width: 150,
        valueFormatter: (params) => {
          const value = params.value || 0;
          return `$${value.toLocaleString('es-MX', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`;
        },
        cellStyle: (params) => {
          const value = typeof params.value === 'string'
            ? parseFloat(params.value.replace(/,/g, ''))
            : params.value || 0;
          return {
            color: value > 0 ? '#dc3545' : null,
            backgroundColor: value > 0 ? '#ffe6e6' : null,
            fontWeight: value > 0 ? 'bold' : 'normal',
          };
        },
      },
      {
        field: 'saldo',
        headerName: 'Saldo',
        width: 150,
        valueFormatter: (params) => {
          const value = params.value || 0;
          return `$${value.toLocaleString('es-MX', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`;
        },
        cellStyle: (params) => {
          if (params.value >= 0) {
            return { color: '#198754', fontWeight: 'bold' };
          } else {
            return { color: '#dc3545', fontWeight: 'bold' };
          }
        },
      },
    ];

    return this._colDetails;
  }

  obtenerBanks() {
    this.administrationService.get2fieldsBanks().subscribe({
      next: (data: any) => {
        this.banks = data;
      },
      error: (error) => {
        console.error('Error al cargar bancos:', error);
        this.banks = [];
        alerts.basicAlert('Error', 'Error al cargar el catálogo de bancos', 'error');
      }
    });
  }

  obtenerDatos() {
    this.loading = true;

    const companyId = parseInt(localStorage.getItem('company') || '0');
    if (!companyId) {
      console.error('No hay empresa seleccionada en localStorage');
      this.loading = false;
      return;
    }

    this.administrationService
      .getAccountBanks(companyId)
      .subscribe({
        next: (response: any) => {
          if (response && response.length > 0) {
            this.saldoData = response;
          } else {
            this.saldoData = [];
          }
        },
        error: (error) => {
          // 404 significa "no hay datos", no es un error real
          if (error.status === 404) {
            this.saldoData = [];
            console.log('No hay cuentas bancarias para esta empresa');
          } else {
            // Otros errores sí son problemas reales
            console.error('Error al cargar cuentas bancarias:', error);
            this.saldoData = [];
            alerts.basicAlert('Error', 'Error al cargar las cuentas bancarias', 'error');
          }
          this.loading = false;
        },
        complete: () => {
          this.loading = false;
        }
      });
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      `Mostrar Listado de Saldos Palacio`,
      'Menu Administración - Palacio Municipal',
      this.trackingService.getEmail()
    );
  }

  onSelectionChanged(event: any) {
    const selectedNodes = event.api.getSelectedNodes();
    if (selectedNodes.length > 0) {
      const selectedData = selectedNodes[0].data;
      this.selectedRowData = selectedData;

      // Solo cargar balance si el ID no es temporal (nueva fila)
      if (selectedData.id && !selectedData.id.toString().startsWith('temp_')) {
        this.loadBalanceData(selectedData.id);
      } else {
        // Limpiar detalles para filas nuevas
        this.rowDetails = [];
      }
    } else {
      this.selectedRowData = null;
      this.rowDetails = [];
    }
  }

  private loadBalanceData(id: string) {
    if (!id || id === this.lastSelectedId) return;

    this.lastSelectedId = id;
    this.rowDetails = [];
    this.loading = true;

    this.administrationService.getBalance(parseInt(id)).subscribe({
      next: (response: any) => {
        if (response.success && response.hasData) {
          this.rowDetails = response.data;
        } else {
          this.rowDetails = [];
          alerts.basicAlert('Aviso', 'No hay datos disponibles', 'info');
        }
      },
      error: () => {
        this.rowDetails = [];
        alerts.basicAlert('Error', 'Error al cargar los datos', 'error');
      },
      complete: () => {
        this.loading = false;
      },
    });
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  onDetailGridReady(params: GridReadyEvent) {
    this.detailsGridApi = params.api;
  }

  refreshData() {
    this.obtenerDatos();
    alerts.basicAlert(
      'Datos actualizados',
      'Los saldos se han actualizado correctamente.',
      'success'
    );
  }

  exportToExcel() {
    if (this.gridApi) {
      this.gridApi.exportDataAsExcel({
        fileName: `saldos-palacio-${new Date().getTime()}.xlsx`,
        sheetName: 'Saldos'
      });
      this.trackingService.addLog(
        this.trackingService.getnameComp(),
        `Exportar Saldos a Excel`,
        'Menu Administración - Palacio Municipal',
        this.trackingService.getEmail()
      );
    }
  }

  // ==================== MÉTODOS PARA REPORTE PDF ====================

  openReportModal() {
    if (!this.selectedRowData || !this.selectedRowData.id) {
      alerts.basicAlert(
        'Sin selección',
        'Por favor seleccione una cuenta bancaria para generar el reporte',
        'warning'
      );
      return;
    }

    // Establecer fechas por defecto: un mes antes
    const now = new Date();
    const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());

    this.reportStartDate = this.formatDateForInput(previousMonth);
    this.reportEndDate = this.formatDateForInput(now);

    this.showReportModal = true;
    document.body.classList.add('modal-open');

    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Abrir modal de reporte de estado de cuenta',
      'Palacio Municipal - Saldos',
      this.trackingService.getEmail()
    );
  }

  closeReportModal() {
    this.showReportModal = false;
    document.body.classList.remove('modal-open');
  }

  private formatDateForInput(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  async generateReport() {
    if (!this.reportStartDate || !this.reportEndDate) {
      alerts.basicAlert('Error', 'Por favor seleccione ambas fechas', 'error');
      return;
    }

    if (new Date(this.reportStartDate) > new Date(this.reportEndDate)) {
      alerts.basicAlert('Error', 'La fecha de inicio no puede ser mayor que la fecha de término', 'error');
      return;
    }

    this.isGeneratingReport = true;

    try {
      // Cargar datos del estado de cuenta con las fechas seleccionadas
      const startDate = new Date(this.reportStartDate);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(this.reportEndDate);
      endDate.setHours(23, 59, 59, 999);

      // Filtrar rowDetails por rango de fechas
      const filteredData = this.rowDetails.filter(row => {
        const rowDate = new Date(row.fecha);
        return rowDate >= startDate && rowDate <= endDate;
      });

      if (filteredData.length === 0) {
        alerts.basicAlert(
          'Sin datos',
          'No se encontraron movimientos en el rango de fechas seleccionado',
          'warning'
        );
        this.isGeneratingReport = false;
        return;
      }

      // Generar PDF
      await this.generatePDF(filteredData);

      this.trackingService.addLog(
        this.trackingService.getnameComp(),
        `Generar reporte de estado de cuenta del ${this.reportStartDate} al ${this.reportEndDate}`,
        'Palacio Municipal - Saldos',
        this.trackingService.getEmail()
      );

      // Cerrar modal
      this.closeReportModal();

    } catch (error) {
      console.error('Error generando reporte:', error);
      alerts.basicAlert('Error', 'Error al generar el reporte', 'error');
    } finally {
      this.isGeneratingReport = false;
    }
  }

  private async generatePDF(data: any[]) {
    // Importar pdfMake dinámicamente
    const pdfMake = (await import('pdfmake/build/pdfmake')).default;
    const pdfFonts = (await import('pdfmake/build/vfs_fonts')).default;
    (pdfMake as any).vfs = (pdfFonts as any).pdfMake?.vfs || (pdfFonts as any).default?.pdfMake?.vfs;

    // Obtener información de la empresa y firmas
    const companyId = parseInt(localStorage.getItem('company') || '0');
    const rootResponse: any = await lastValueFrom(
      this.rootService.getRootbyId(companyId)
    );

    const logoBase64 = await this.base64EncodeService.convertImageToBase64(rootResponse.picture);
    const logo2Base64 = rootResponse.picture2
      ? await this.base64EncodeService.convertImageToBase64(rootResponse.picture2)
      : logoBase64; // Si no hay picture2, usar picture
    const watermarkBase64 = rootResponse.picture3
      ? await this.base64EncodeService.convertImageToBase64(rootResponse.picture3)
      : null;

    // La configuración de firmas es opcional; algunas empresas aún no tienen
    // registro en SetupManagement y el endpoint responde 404. Eso no debe
    // impedir generar el estado de cuenta.
    let setupManagementInfo: any = null;
    try {
      setupManagementInfo = await lastValueFrom(
        this.administrationService.getSetupManagementInfo(companyId)
      );
    } catch (error: any) {
      if (error?.status !== 404) {
        console.warn('No se pudo cargar la configuración de firmas:', error);
      }
    }
    const firmas = Array.isArray(setupManagementInfo) && setupManagementInfo.length > 0
      ? setupManagementInfo[0]
      : null;

    // Obtener nombre de la cuenta seleccionada
    const accountInfo = this.selectedRowData;
    const accountName = `${accountInfo.nameAccount} - ${accountInfo.bankName || ''}`.toUpperCase();

    // Construir tabla del estado de cuenta
    const tableBody: any[] = [
      // Encabezado
      [
        { text: 'NÚMERO DOCUMENTO', style: 'tableHeader', alignment: 'left' },
        { text: 'FECHA', style: 'tableHeader', alignment: 'center' },
        { text: 'DESCRIPCIÓN', style: 'tableHeader', alignment: 'left' },
        { text: 'TIPO', style: 'tableHeader', alignment: 'center' },
        { text: 'INGRESO', style: 'tableHeader', alignment: 'right' },
        { text: 'EGRESO', style: 'tableHeader', alignment: 'right' },
        { text: 'SALDO', style: 'tableHeader', alignment: 'right' }
      ]
    ];

    // Agregar filas de datos y calcular totales
    let totalIngresos = 0;
    let totalEgresos = 0;

    data.forEach(row => {
      // Acumular totales
      totalIngresos += row.deposito || 0;
      totalEgresos += row.gasto || 0;

      tableBody.push([
        { text: row.numeroDocumento || '', style: 'tableCell', alignment: 'left' },
        { text: row.fecha || '', style: 'tableCell', alignment: 'center' },
        { text: row.descripcion || '', style: 'tableCell', alignment: 'left' },
        { text: row.tipo || '', style: 'tableCell', alignment: 'center' },
        {
          text: this.formatCurrencyNumber(row.deposito || 0),
          style: 'tableCellAmount',
          alignment: 'right',
          color: row.deposito > 0 ? '#198754' : '#000000'
        },
        {
          text: this.formatCurrencyNumber(row.gasto || 0),
          style: 'tableCellAmount',
          alignment: 'right',
          color: row.gasto > 0 ? '#dc3545' : '#000000'
        },
        {
          text: this.formatCurrencyNumber(row.saldo || 0),
          style: 'tableCellAmount',
          alignment: 'right',
          color: row.saldo >= 0 ? '#198754' : '#dc3545',
          bold: true
        }
      ]);
    });

    // Agregar fila de totales
    tableBody.push([
      { text: '', style: 'tableCell', alignment: 'left' },
      { text: '', style: 'tableCell', alignment: 'center' },
      { text: '', style: 'tableCell', alignment: 'left' },
      { text: 'TOTALES:', style: 'tableTotalLabel', alignment: 'right', bold: true },
      {
        text: this.formatCurrencyNumber(totalIngresos),
        style: 'tableTotalAmount',
        alignment: 'right',
        color: '#198754',
        bold: true,
        fillColor: '#e6ffe6'
      },
      {
        text: this.formatCurrencyNumber(totalEgresos),
        style: 'tableTotalAmount',
        alignment: 'right',
        color: '#dc3545',
        bold: true,
        fillColor: '#ffe6e6'
      },
      { text: '', style: 'tableCell', alignment: 'right' }
    ]);

    // Definición del documento
    const docDefinition: any = {
      pageSize: 'LETTER',
      pageOrientation: 'landscape',
      pageMargins: [40, 55, 40, 60],
      background: watermarkBase64 ? [
        {
          image: 'watermark',
          width: 400,
          opacity: 0.15,
          absolutePosition: { x: 206, y: 150 }
        }
      ] : [],
      content: [
        // Header con logos y título
        {
          columns: [
            {
              image: 'logo',
              width: 60,
              alignment: 'left'
            },
            {
              stack: [
                {
                  text: rootResponse.name || 'H. JUNTA MUNICIPAL',
                  style: 'companyName',
                  alignment: 'center'
                },
                {
                  text: rootResponse.address || '',
                  style: 'companyInfo',
                  alignment: 'center'
                }
              ],
              width: '*'
            },
            {
              image: 'logo2',
              width: 60,
              alignment: 'right'
            }
          ],
          margin: [0, 0, 0, 10]
        },
        // Título del reporte
        {
          text: `ESTADO DE CUENTA - ${accountName}`,
          style: 'reportTitle',
          alignment: 'center',
          margin: [0, 5, 0, 5]
        },
        // Período
        {
          text: `Del ${this.reportStartDate} al ${this.reportEndDate}`,
          style: 'reportSubtitle',
          alignment: 'center',
          margin: [0, 0, 0, 15]
        },
        // Tabla de movimientos
        {
          table: {
            headerRows: 1,
            widths: [85, 70, '*', 70, 70, 70, 70],
            body: tableBody
          },
          layout: {
            hLineWidth: (i, node) => (i === 0 || i === 1 || i === node.table.body.length) ? 1 : 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => '#000000',
            vLineColor: () => '#000000',
            paddingTop: () => 2,
            paddingBottom: () => 2,
            paddingLeft: () => 4,
            paddingRight: () => 4
          },
          margin: [0, 0, 0, 20]
        },
        // Firmas
        {
          columns: [
            {
              stack: [
                { text: firmas?.administratorTitle || 'TESORERO', style: 'firmaTitle', alignment: 'center' },
                { text: '\n\n', margin: [0, 3, 0, 0] },
                { text: '_______________________________', alignment: 'center', fontSize: 8 },
                { text: firmas?.administratorName || '', style: 'firmaNombre', alignment: 'center', margin: [0, 1, 0, 0] }
              ],
              width: '33%'
            },
            {
              stack: [
                { text: firmas?.gerencyTitle || 'SINDICO DE HACIENDA', style: 'firmaTitle', alignment: 'center' },
                { text: '\n\n', margin: [0, 3, 0, 0] },
                { text: '_______________________________', alignment: 'center', fontSize: 8 },
                { text: firmas?.gerencyName || '', style: 'firmaNombre', alignment: 'center', margin: [0, 1, 0, 0] }
              ],
              width: '34%'
            },
            {
              stack: [
                { text: firmas?.directorTitle || 'PRESIDENTE', style: 'firmaTitle', alignment: 'center' },
                { text: '\n\n', margin: [0, 3, 0, 0] },
                { text: '_______________________________', alignment: 'center', fontSize: 8 },
                { text: firmas?.directorName || '', style: 'firmaNombre', alignment: 'center', margin: [0, 1, 0, 0] }
              ],
              width: '33%'
            }
          ]
        }
      ],
      images: watermarkBase64 ? {
        logo: logoBase64,
        logo2: logo2Base64,
        watermark: watermarkBase64
      } : {
        logo: logoBase64,
        logo2: logo2Base64
      },
      styles: {
        companyName: {
          fontSize: 11,
          bold: true,
          color: '#000000'
        },
        companyInfo: {
          fontSize: 8,
          color: '#000000'
        },
        reportTitle: {
          fontSize: 11,
          bold: true,
          color: '#000000'
        },
        reportSubtitle: {
          fontSize: 9,
          color: '#000000'
        },
        tableHeader: {
          fontSize: 8,
          bold: true,
          fillColor: '#e0e0e0',
          color: '#000000'
        },
        tableCell: {
          fontSize: 7,
          color: '#000000'
        },
        tableCellAmount: {
          fontSize: 7
        },
        tableTotalLabel: {
          fontSize: 8,
          bold: true,
          color: '#000000'
        },
        tableTotalAmount: {
          fontSize: 8,
          bold: true
        },
        firmaTitle: {
          fontSize: 8,
          bold: true,
          color: '#000000'
        },
        firmaNombre: {
          fontSize: 8,
          color: '#000000'
        }
      }
    };

    // Generar y abrir el PDF
    this.trackingService.addLog(this.trackingService.getnameComp(), 'Imprimió/abrió PDF estado de cuenta saldos palacio', 'Admon / Saldos Palacio', this.trackingService.getEmail());
    const pdf = pdfMake.createPdf(docDefinition);
    pdf.open();

    alerts.basicAlert(
      'Reporte generado',
      'El estado de cuenta se ha generado correctamente',
      'success'
    );
  }

  private formatCurrencyNumber(amount: number): string {
    return `$${amount.toLocaleString('es-MX', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  }
}
