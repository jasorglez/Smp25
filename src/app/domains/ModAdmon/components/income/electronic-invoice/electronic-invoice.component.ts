import { CommonModule } from '@angular/common';
import { Component, effect, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { FacturacionService } from 'app/services/facturacion.service';
import { AdministrationService } from 'app/services/administration.service';
import { CustomersService } from 'app/services/customers.service';
import { IncomesAndExpensesService } from 'app/services/incomes-and-expenses.service';
import { SignalsService } from 'app/services/signals.service';
import { TrackingService } from 'app/services/tracking.service';
import { alerts } from 'app/helpers/alerts';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-electronic-invoice',
  standalone: true,
  imports: [CommonModule, FormsModule, NgSelectModule],
  templateUrl: './electronic-invoice.component.html',
  styleUrl: './electronic-invoice.component.scss'
})
export class ElectronicInvoiceComponent implements OnInit {

  private facturacionService = inject(FacturacionService);
  private administrationService = inject(AdministrationService);
  private customersService = inject(CustomersService);
  private incomesAndExpensesService = inject(IncomesAndExpensesService);
  private signalsService = inject(SignalsService);
  private trackingService = inject(TrackingService);

  idRoot: number;
  idIncomeExpense: number;
  incomeData: any = null;
  conceptsData: any[] = [];
  billingConfig: any = null;
  customerData: any = null;

  // Datos de la factura electrónica
  electronicInvoice = {
    // Serie y Folio se generan automáticamente del prefixAndConsecutive
    serie: '',
    folio: '',

    // Fecha y hora de emisión
    fechaEmision: '',

    // Tipo de comprobante (del SAT)
    tipoComprobante: 'I', // I=Ingreso, E=Egreso, T=Traslado, N=Nómina, P=Pago

    // Forma de pago (Catálogo SAT c_FormaPago)
    formaPago: '01', // 01=Efectivo, 02=Cheque, 03=Transferencia, etc.

    // Método de pago (Catálogo SAT c_MetodoPago)
    metodoPago: 'PUE', // PUE=Pago en una sola exhibición, PPD=Pago en parcialidades

    // Moneda
    moneda: 'MXN',
    tipoCambio: 1,

    // Receptor (Cliente) - Se obtiene del customer seleccionado
    receptorRfc: '',
    receptorNombre: '',
    receptorDomicilioFiscal: '',
    receptorRegimenFiscal: '',
    receptorUsoCFDI: 'G03', // G03=Gastos en general

    // Totales (se calculan automáticamente de los conceptos)
    subtotal: 0,
    descuento: 0,
    totalImpuestosTrasladados: 0,
    totalImpuestosRetenidos: 0,
    total: 0,

    // Información adicional
    condicionesDePago: '',
    observaciones: '',

    // UUID (se genera al timbrar)
    uuid: '',

    // Estado de timbrado
    estatus: 'PENDIENTE' // PENDIENTE, TIMBRADA, CANCELADA
  };

  // Catálogos SAT
  tiposComprobante: any[] = [];
  formasPago: any[] = [];
  metodosPago: any[] = [];
  monedas: any[] = [];
  usosFactura: any[] = [];
  regimenesFiscales: any[] = [];
  clavesProdServ: any[] = [];
  clavesUnidad: any[] = [];

  // Control de UI
  isGeneratingXML: boolean = false;
  isStamping: boolean = false;
  generatedXML: string = '';
  stampedXML: string = '';
  pdfUrl: string = '';

  constructor() {
    // Effect para detectar cambios en el ingreso seleccionado
    effect(() => {
      this.idIncomeExpense = this.signalsService.getIdIncomeAndExpense()();
      this.idRoot = this.signalsService.getRootSelectedBySidebar()();

      if (this.idIncomeExpense && this.idRoot) {
        this.loadInvoiceData();
      } else {
        this.resetForm();
      }
    }, { allowSignalWrites: true });
  }

  ngOnInit(): void {
    this.loadCatalogs();
    this.setDefaultValues();
  }

  setDefaultValues(): void {
    // Establecer fecha y hora actual
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const hours = String(today.getHours()).padStart(2, '0');
    const minutes = String(today.getMinutes()).padStart(2, '0');
    const seconds = String(today.getSeconds()).padStart(2, '0');
    this.electronicInvoice.fechaEmision = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
  }

  loadCatalogs(): void {
    forkJoin({
      tiposComprobante: this.facturacionService.getTipoComprobante(),
      formasPago: this.facturacionService.getFormaPago(),
      metodosPago: this.facturacionService.getMetodoPago(),
      monedas: this.facturacionService.getMoneda(),
      usosFactura: this.facturacionService.getUsoCfdi(),
      regimenesFiscales: this.administrationService.getFiscalRegimes(),
      clavesProdServ: this.facturacionService.getProductosServicios(),
      clavesUnidad: this.facturacionService.getClaveUnidad()
    }).subscribe({
      next: (data: any) => {
        this.tiposComprobante = data.tiposComprobante.map((item: any) => ({
          ...item,
          display: `${item.tipoDeComprobante} - ${item.descripcion}`
        }));

        this.formasPago = data.formasPago.map((item: any) => ({
          ...item,
          display: `${item.formaPagoValue} - ${item.descripcion}`
        }));

        this.metodosPago = data.metodosPago.map((item: any) => ({
          ...item,
          display: `${item.metodoPagoValue} - ${item.descripcion}`
        }));

        this.monedas = data.monedas.map((item: any) => ({
          ...item,
          display: `${item.cMoneda} - ${item.descripcion}`
        }));

        this.usosFactura = data.usosFactura.map((item: any) => ({
          ...item,
          display: `${item.cUsoCFDI} - ${item.descripcion}`
        }));

        this.regimenesFiscales = data.regimenesFiscales.map((item: any) => ({
          ...item,
          display: `${item.id} - ${item.description}`
        }));

        this.clavesProdServ = data.clavesProdServ || [];
        this.clavesUnidad = data.clavesUnidad || [];
      },
      error: (err) => {
        console.error('Error cargando catálogos SAT:', err);
        alerts.basicAlert('Error', 'No se pudieron cargar los catálogos del SAT.', 'error');
      }
    });
  }

  loadInvoiceData(): void {
    if (!this.idIncomeExpense || !this.idRoot) {
      return;
    }

    forkJoin({
      income: this.incomesAndExpensesService.getIncomeAndExpenseById(this.idIncomeExpense),
      concepts: this.incomesAndExpensesService.getConceptsFromIncomesAndExpenses(this.idIncomeExpense),
      billingConfig: this.administrationService.getBillingManagementInfo(this.idRoot)
    }).subscribe({
      next: (data: any) => {
        // Datos del ingreso
        this.incomeData = Array.isArray(data.income) ? data.income[0] : data.income;
        this.conceptsData = data.concepts || [];
        this.billingConfig = Array.isArray(data.billingConfig) ? data.billingConfig[0] : data.billingConfig;

        // Asignar serie y folio del prefijo
        if (this.billingConfig) {
          this.electronicInvoice.serie = this.billingConfig.prefix || '';
          this.electronicInvoice.folio = this.incomeData.numberDocument || '';
        }

        // Cargar datos del cliente si existe
        if (this.incomeData.idCustomer) {
          this.loadCustomerData(this.incomeData.idCustomer);
        }

        // Asignar totales del documento
        this.electronicInvoice.subtotal = this.incomeData.subtotal || 0;
        this.electronicInvoice.totalImpuestosTrasladados = this.incomeData.tax || 0;
        this.electronicInvoice.total = this.incomeData.total || 0;

        // Si ya tiene UUID, está timbrada
        if (this.incomeData.uuid && this.incomeData.uuid !== 'NA') {
          this.electronicInvoice.uuid = this.incomeData.uuid;
          this.electronicInvoice.estatus = 'TIMBRADA';
        }

        this.trackingService.addLog(
          this.trackingService.getnameComp(),
          'Carga de datos para factura electrónica',
          'Menu Administracion Ingresos - Factura Electrónica',
          this.trackingService.getEmail()
        );
      },
      error: (err) => {
        console.error('Error cargando datos del ingreso:', err);
        alerts.basicAlert('Error', 'No se pudieron cargar los datos del ingreso.', 'error');
      }
    });
  }

  loadCustomerData(idCustomer: number): void {
    // Buscar el cliente en CustomersBilling configurados para facturación
    this.customersService.getCustomersBilling(this.idRoot).subscribe({
      next: (customers: any) => {
        const customer = Array.isArray(customers)
          ? customers.find((c: any) => c.idCustomer === idCustomer)
          : null;

        if (customer) {
          this.customerData = customer;

          // Asignar datos del receptor desde CustomersBilling
          this.electronicInvoice.receptorRfc = customer.rfc || '';
          this.electronicInvoice.receptorNombre = customer.nombreFiscal || '';
          this.electronicInvoice.receptorDomicilioFiscal = customer.codigoPostal || '';
          this.electronicInvoice.receptorRegimenFiscal = customer.regimenFiscal || '';
          this.electronicInvoice.receptorUsoCFDI = customer.usoCfdi || 'G03';
        }
      },
      error: (err) => {
        console.error('Error cargando datos del cliente de facturación:', err);
      }
    });
  }

  generateXML(): void {
    // Validaciones previas
    if (!this.validateInvoiceData()) {
      return;
    }

    if (!this.idIncomeExpense) {
      alerts.basicAlert('Error', 'No hay un ingreso seleccionado.', 'error');
      return;
    }

    this.isGeneratingXML = true;

    // Llamar al backend para generar XML (sin timbrar)
    this.administrationService.generateXml(this.idIncomeExpense).subscribe({
      next: (response: any) => {
        if (response.success) {
          this.generatedXML = response.xml || response.xmlContent || '';
          this.isGeneratingXML = false;

          alerts.basicAlert(
            'XML Generado',
            'El XML de la factura ha sido generado correctamente. Puede proceder al timbrado.',
            'success'
          );

          this.trackingService.addLog(
            this.trackingService.getnameComp(),
            'Generación de XML para factura electrónica',
            'Menu Administracion Ingresos - Factura Electrónica',
            this.trackingService.getEmail()
          );
        } else {
          this.isGeneratingXML = false;
          alerts.basicAlert('Error', response.error || 'No se pudo generar el XML.', 'error');
        }
      },
      error: (err) => {
        console.error('Error generando XML:', err);
        this.isGeneratingXML = false;

        const errorMessage = err.error?.error || err.error?.message || err.message || 'Error al generar XML.';
        alerts.basicAlert('Error al Generar XML', errorMessage, 'error');
      }
    });
  }

  validateInvoiceData(): boolean {
    if (!this.billingConfig || !this.billingConfig.emisorRfc) {
      alerts.basicAlert('Error', 'No se ha configurado la información del emisor. Vaya a Configuración > Facturación.', 'error');
      return false;
    }

    if (!this.electronicInvoice.receptorRfc) {
      alerts.basicAlert('Error', 'Debe seleccionar un cliente con RFC válido.', 'error');
      return false;
    }

    if (!this.conceptsData || this.conceptsData.length === 0) {
      alerts.basicAlert('Error', 'Debe agregar al menos un concepto a la factura.', 'error');
      return false;
    }

    if (!this.electronicInvoice.tipoComprobante) {
      alerts.basicAlert('Error', 'Debe seleccionar el tipo de comprobante.', 'error');
      return false;
    }

    if (!this.electronicInvoice.formaPago) {
      alerts.basicAlert('Error', 'Debe seleccionar la forma de pago.', 'error');
      return false;
    }

    if (!this.electronicInvoice.metodoPago) {
      alerts.basicAlert('Error', 'Debe seleccionar el método de pago.', 'error');
      return false;
    }

    return true;
  }

  buildCFDI40XML(): string {
    // Construcción básica del XML CFDI 4.0
    // En producción, se recomienda usar una librería especializada

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante
  xmlns:cfdi="http://www.sat.gob.mx/cfd/4"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd"
  Version="4.0"
  Serie="${this.electronicInvoice.serie}"
  Folio="${this.electronicInvoice.folio}"
  Fecha="${this.electronicInvoice.fechaEmision}"
  TipoDeComprobante="${this.electronicInvoice.tipoComprobante}"
  FormaPago="${this.electronicInvoice.formaPago}"
  MetodoPago="${this.electronicInvoice.metodoPago}"
  Moneda="${this.electronicInvoice.moneda}"
  ${this.electronicInvoice.tipoCambio !== 1 ? `TipoCambio="${this.electronicInvoice.tipoCambio}"` : ''}
  SubTotal="${this.electronicInvoice.subtotal.toFixed(2)}"
  ${this.electronicInvoice.descuento > 0 ? `Descuento="${this.electronicInvoice.descuento.toFixed(2)}"` : ''}
  Total="${this.electronicInvoice.total.toFixed(2)}"
  LugarExpedicion="${this.billingConfig.emisorCp}"
  ${this.electronicInvoice.condicionesDePago ? `CondicionesDePago="${this.electronicInvoice.condicionesDePago}"` : ''}
>

  <cfdi:Emisor
    Rfc="${this.billingConfig.emisorRfc}"
    Nombre="${this.billingConfig.emisorNombre}"
    RegimenFiscal="${this.billingConfig.fiscalRegime}"
  />

  <cfdi:Receptor
    Rfc="${this.electronicInvoice.receptorRfc}"
    Nombre="${this.electronicInvoice.receptorNombre}"
    DomicilioFiscalReceptor="${this.electronicInvoice.receptorDomicilioFiscal}"
    RegimenFiscalReceptor="${this.electronicInvoice.receptorRegimenFiscal}"
    UsoCFDI="${this.electronicInvoice.receptorUsoCFDI}"
  />

  <cfdi:Conceptos>
${this.buildConceptsXML()}
  </cfdi:Conceptos>

  ${this.electronicInvoice.totalImpuestosTrasladados > 0 ? this.buildImpuestosXML() : ''}

</cfdi:Comprobante>`;

    return xml;
  }

  buildConceptsXML(): string {
    return this.conceptsData.map((concepto, index) => {
      const cantidad = concepto.quantity || 1;
      const valorUnitario = concepto.price || 0;
      const importe = (cantidad * valorUnitario).toFixed(2);
      const descripcion = concepto.description || 'Concepto sin descripción';
      const unidad = concepto.unit || 'Pieza';

      return `    <cfdi:Concepto
      ClaveProdServ="01010101"
      Cantidad="${cantidad}"
      ClaveUnidad="ACT"
      Unidad="${unidad}"
      Descripcion="${descripcion}"
      ValorUnitario="${valorUnitario.toFixed(2)}"
      Importe="${importe}"
      ObjetoImp="${concepto.iva ? '02' : '01'}"
    >${concepto.iva ? `
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="${importe}" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="${concepto.iva2.toFixed(2)}" />
        </cfdi:Traslados>
      </cfdi:Impuestos>` : ''}
    </cfdi:Concepto>`;
    }).join('\n');
  }

  buildImpuestosXML(): string {
    return `  <cfdi:Impuestos TotalImpuestosTrasladados="${this.electronicInvoice.totalImpuestosTrasladados.toFixed(2)}">
    <cfdi:Traslados>
      <cfdi:Traslado Base="${this.electronicInvoice.subtotal.toFixed(2)}" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="${this.electronicInvoice.totalImpuestosTrasladados.toFixed(2)}" />
    </cfdi:Traslados>
  </cfdi:Impuestos>`;
  }

  stampInvoice(): void {
    // Validar que no esté ya timbrada
    if (this.electronicInvoice.estatus === 'TIMBRADA' || (this.incomeData?.uuid && this.incomeData.uuid !== 'NA')) {
      alerts.basicAlert('Advertencia', 'Esta factura ya ha sido timbrada.', 'warning');
      return;
    }

    if (!this.idIncomeExpense) {
      alerts.basicAlert('Error', 'No hay un ingreso seleccionado.', 'error');
      return;
    }

    // Validaciones previas
    if (!this.validateInvoiceData()) {
      return;
    }

    this.isStamping = true;

    // Llamar al backend que hace todo: genera XML, firma y timbra con Finkok
    this.administrationService.stampInvoice(this.idIncomeExpense).subscribe({
      next: (response: any) => {
        if (response.success) {
          // Respuesta exitosa según documentación backend
          this.stampedXML = response.stampedXml || '';
          this.electronicInvoice.uuid = response.uuid || '';
          this.electronicInvoice.estatus = 'TIMBRADA';

          // Actualizar datos locales
          if (this.incomeData) {
            this.incomeData.uuid = response.uuid;
            this.incomeData.facturado = true;
          }

          this.isStamping = false;

          alerts.basicAlert(
            'Factura Timbrada',
            `La factura ha sido timbrada exitosamente.\n\nUUID: ${this.electronicInvoice.uuid}\nFecha: ${response.fechaTimbrado || ''}`,
            'success'
          );

          this.trackingService.addLog(
            this.trackingService.getnameComp(),
            `Timbrado de factura electrónica - UUID: ${this.electronicInvoice.uuid}`,
            'Menu Administracion Ingresos - Factura Electrónica',
            this.trackingService.getEmail()
          );

          // Refrescar datos del income
          this.signalsService.triggerUpdateIncAndExp();
        } else {
          this.isStamping = false;
          const errorMsg = response.error || response.errorDetail || 'Error desconocido al timbrar.';
          alerts.basicAlert('Error al Timbrar', errorMsg, 'error');
        }
      },
      error: (err) => {
        console.error('Error al timbrar factura:', err);
        this.isStamping = false;

        // Manejar estructura de error del backend
        let errorMessage = 'Error desconocido al timbrar la factura.';

        if (err.error) {
          if (err.error.error) {
            errorMessage = err.error.error;
          } else if (err.error.errorDetail) {
            errorMessage = `${err.error.errorDetail}\n\nCódigo: ${err.error.errorCode || 'N/A'}`;
          } else if (err.error.message) {
            errorMessage = err.error.message;
          } else if (typeof err.error === 'string') {
            errorMessage = err.error;
          }
        } else if (err.message) {
          errorMessage = err.message;
        }

        alerts.basicAlert('Error al Timbrar', errorMessage, 'error');
      }
    });
  }

  updateIncomeWithUUID(uuid: string): void {
    if (!this.incomeData) return;

    const updatedIncome = {
      ...this.incomeData,
      uuid: uuid
    };

    this.incomesAndExpensesService.updateIncomesAndExpenses(this.idIncomeExpense, updatedIncome).subscribe({
      next: () => {
        this.signalsService.triggerUpdateIncAndExp();
      },
      error: (err) => {
        console.error('Error actualizando UUID:', err);
      }
    });
  }

  downloadXML(): void {
    if (!this.generatedXML) {
      alerts.basicAlert('Error', 'No hay XML generado para descargar.', 'warning');
      return;
    }

    const xmlToDownload = this.stampedXML || this.generatedXML;
    const blob = new Blob([xmlToDownload], { type: 'application/xml' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `factura_${this.electronicInvoice.serie}${this.electronicInvoice.folio}.xml`;
    link.click();
    window.URL.revokeObjectURL(url);

    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Descarga de XML de factura electrónica',
      'Menu Administracion Ingresos - Factura Electrónica',
      this.trackingService.getEmail()
    );
  }

  downloadPDF(): void {
    if (!this.idIncomeExpense) {
      alerts.basicAlert('Error', 'No hay un ingreso seleccionado.', 'error');
      return;
    }

    if (!this.incomeData?.uuid || this.incomeData.uuid === 'NA') {
      alerts.basicAlert('Error', 'La factura debe estar timbrada para generar el PDF.', 'warning');
      return;
    }

    // Llamar al backend para generar PDF
    this.administrationService.getPdfInvoice(this.idIncomeExpense).subscribe({
      next: (blob: Blob) => {
        // Crear URL del blob y descargar
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `factura_${this.electronicInvoice.serie}${this.electronicInvoice.folio}.pdf`;
        link.click();
        window.URL.revokeObjectURL(url);

        this.trackingService.addLog(
          this.trackingService.getnameComp(),
          'Descarga de PDF de factura electrónica',
          'Menu Administracion Ingresos - Factura Electrónica',
          this.trackingService.getEmail()
        );
      },
      error: (err) => {
        console.error('Error descargando PDF:', err);
        alerts.basicAlert('Error', 'No se pudo generar el PDF. Intente nuevamente.', 'error');
      }
    });
  }

  cancelInvoice(): void {
    if (!this.incomeData?.uuid || this.incomeData.uuid === 'NA') {
      alerts.basicAlert('Error', 'Solo se pueden cancelar facturas timbradas.', 'warning');
      return;
    }

    if (!this.idIncomeExpense) {
      alerts.basicAlert('Error', 'No hay un ingreso seleccionado.', 'error');
      return;
    }

    // Solicitar motivo de cancelación
    alerts.inputAlert(
      'Motivo de Cancelación',
      'Seleccione el motivo de cancelación según el catálogo del SAT:',
      'text',
      '02',
      {
        inputAttributes: {
          placeholder: '01, 02, 03 o 04'
        },
        confirmButtonText: 'Cancelar Factura',
        showCancelButton: true,
        cancelButtonText: 'Cerrar'
      }
    ).then((result) => {
      if (result.isConfirmed && result.value) {
        const motivoCancelacion = result.value.trim();

        // Validar motivo
        const motivosValidos = ['01', '02', '03', '04'];
        if (!motivosValidos.includes(motivoCancelacion)) {
          alerts.basicAlert('Error', 'Motivo de cancelación inválido. Use: 01, 02, 03 o 04', 'error');
          return;
        }

        // Confirmar cancelación
        alerts.confirmAlert(
          '¿Cancelar Factura?',
          `Esta acción es irreversible.\n\nMotivo: ${this.getDescripcionMotivo(motivoCancelacion)}\n\n¿Está seguro de cancelar esta factura?`,
          'warning',
          'Sí, cancelar factura'
        ).then((confirmResult) => {
          if (confirmResult.isConfirmed) {
            this.processCancellation(motivoCancelacion);
          }
        });
      }
    });
  }

  private getDescripcionMotivo(motivo: string): string {
    const motivos: { [key: string]: string } = {
      '01': '01 - Comprobantes emitidos con errores con relación',
      '02': '02 - Comprobantes emitidos con errores sin relación',
      '03': '03 - No se llevó a cabo la operación',
      '04': '04 - Operación nominativa relacionada en factura global'
    };
    return motivos[motivo] || motivo;
  }

  private processCancellation(motivoCancelacion: string): void {
    this.administrationService.cancelInvoice(this.idIncomeExpense, motivoCancelacion).subscribe({
      next: (response: any) => {
        if (response.success) {
          this.electronicInvoice.estatus = 'CANCELADA';
          if (this.incomeData) {
            this.incomeData.cancelado = true;
          }

          alerts.basicAlert(
            'Factura Cancelada',
            `La factura ha sido cancelada exitosamente.\n\nUUID: ${this.electronicInvoice.uuid}\nMotivo: ${this.getDescripcionMotivo(motivoCancelacion)}`,
            'success'
          );

          this.trackingService.addLog(
            this.trackingService.getnameComp(),
            `Cancelación de factura electrónica - UUID: ${this.electronicInvoice.uuid} - Motivo: ${motivoCancelacion}`,
            'Menu Administracion Ingresos - Factura Electrónica',
            this.trackingService.getEmail()
          );

          // Refrescar datos
          this.signalsService.triggerUpdateIncAndExp();
        } else {
          alerts.basicAlert('Error', response.error || 'No se pudo cancelar la factura.', 'error');
        }
      },
      error: (err) => {
        console.error('Error cancelando factura:', err);
        const errorMessage = err.error?.error || err.error?.message || err.message || 'Error al cancelar la factura.';
        alerts.basicAlert('Error al Cancelar', errorMessage, 'error');
      }
    });
  }

  resetForm(): void {
    this.incomeData = null;
    this.conceptsData = [];
    this.customerData = null;
    this.generatedXML = '';
    this.stampedXML = '';
    this.pdfUrl = '';

    this.electronicInvoice = {
      serie: '',
      folio: '',
      fechaEmision: '',
      tipoComprobante: 'I',
      formaPago: '01',
      metodoPago: 'PUE',
      moneda: 'MXN',
      tipoCambio: 1,
      receptorRfc: '',
      receptorNombre: '',
      receptorDomicilioFiscal: '',
      receptorRegimenFiscal: '',
      receptorUsoCFDI: 'G03',
      subtotal: 0,
      descuento: 0,
      totalImpuestosTrasladados: 0,
      totalImpuestosRetenidos: 0,
      total: 0,
      condicionesDePago: '',
      observaciones: '',
      uuid: '',
      estatus: 'PENDIENTE'
    };

    this.setDefaultValues();
  }

  previewXML(): void {
    if (!this.generatedXML) {
      alerts.basicAlert('Error', 'No hay XML generado para previsualizar.', 'warning');
      return;
    }

    // Abrir modal o ventana con el XML formateado
    const xmlWindow = window.open('', '_blank');
    if (xmlWindow) {
      xmlWindow.document.write('<pre>' + this.escapeHtml(this.generatedXML) + '</pre>');
      xmlWindow.document.close();
    }
  }

  private escapeHtml(text: string): string {
    const map: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }

  // Validar factura con SAT (validación directa sin PAC)
  validateWithSAT(): void {
    if (!this.incomeData?.uuid || this.incomeData.uuid === 'NA') {
      alerts.basicAlert('Error', 'La factura debe estar timbrada para validarla con el SAT.', 'warning');
      return;
    }

    if (!this.idIncomeExpense) {
      alerts.basicAlert('Error', 'No hay un ingreso seleccionado.', 'error');
      return;
    }

    this.administrationService.validateWithSat(this.idIncomeExpense).subscribe({
      next: (response: any) => {
        if (response.success && response.isValid) {
          alerts.basicAlert(
            'Validación SAT Exitosa',
            `Estado: ${response.estado}\nCódigo: ${response.codigoEstatus}\n\n${response.message}`,
            'success'
          );
        } else {
          alerts.basicAlert(
            'Validación SAT',
            response.message || 'La factura no pudo ser validada con el SAT.',
            'warning'
          );
        }

        this.trackingService.addLog(
          this.trackingService.getnameComp(),
          `Validación con SAT - UUID: ${this.electronicInvoice.uuid} - Estado: ${response.estado}`,
          'Menu Administracion Ingresos - Factura Electrónica',
          this.trackingService.getEmail()
        );
      },
      error: (err) => {
        console.error('Error validando con SAT:', err);
        const errorMessage = err.error?.error || err.error?.message || err.message || 'Error al validar con el SAT.';
        alerts.basicAlert('Error de Validación', errorMessage, 'error');
      }
    });
  }
}
