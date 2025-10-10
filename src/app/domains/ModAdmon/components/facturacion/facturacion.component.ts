import { Component, inject, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { FacturacionService } from 'app/services/facturacion.service';
import { AdministrationService } from 'app/services/administration.service';
import { CustomersService } from 'app/services/customers.service';
import { SignalsService } from 'app/services/signals.service';

@Component({
  selector: 'app-facturacion',
  standalone: true,
  imports: [CommonModule, FormsModule, NgSelectModule],
  templateUrl: './facturacion.component.html',
  styleUrl: './facturacion.component.scss'
})
export class FacturacionComponent implements OnInit {

  private facturacionService = inject(FacturacionService);
  private administrationService = inject(AdministrationService);
  private customersService = inject(CustomersService);
  private signalsService = inject(SignalsService);

  constructor() {
    // Effect para reaccionar cuando cambie la compañía seleccionada
    effect(() => {
      const currentCompany = this.signalsService.getRootSelectedBySidebar()();

      if (currentCompany) {
        this.loadCustomers(currentCompany);
      } else {
        this.clientes = [];
      }
    });
  }

  // Datos del comprobante
  comprobante = {
    regimenFiscal: '',
    codigoPostal: '',
    fechaEmision: '',
    tipoFactura: '',
    formaPago: '',
    metodoPago: ''
  };

  // Datos generales
  datosGenerales = {
    moneda: '',
    tipoCambio: null
  };

  // Datos del cliente
  cliente = {
    clienteSeleccionado: '',
    nombreRazonSocial: '',
    codigoPostal: '',
    regimenFiscal: '',
    usoFactura: ''
  };

  // Productos y servicios
  productos: any[] = [];

  // Catálogos SAT
  regimenesFiscales: any[] = [];
  tiposComprobante: any[] = [];
  formasPago: any[] = [];
  metodosPago: any[] = [];
  monedas: any[] = [];
  usosFactura: any[] = [];
  objetosImpuesto: any[] = [];
  clientes: any[] = [];

  // Stamping
  invoiceXml: string = '';
  stampedXml: string = '';

  ngOnInit(): void {
    this.setDefaultValues();
    this.loadCatalogs();
  }

  setDefaultValues(): void {
    // Establecer fecha de hoy por defecto
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const hours = String(today.getHours()).padStart(2, '0');
    const minutes = String(today.getMinutes()).padStart(2, '0');
    this.comprobante.fechaEmision = `${year}-${month}-${day}T${hours}:${minutes}`;

    // Nota: La moneda se establece después de cargar los catálogos en datosGenerales
  }

  loadCatalogs(): void {
    // Cargar régimen fiscal desde AdministrationService
    this.administrationService.getFiscalRegimes().subscribe({
      next: (data: any[]) => {
        this.regimenesFiscales = data.map(item => ({ ...item, display: `${item.id} - ${item.description}` }));
      },
      error: (error) => {
        console.error('Error loading Regimenes Fiscales:', error);
        this.regimenesFiscales = [];
      }
    });

    // Cargar tipos de comprobante
    this.facturacionService.getTipoComprobante().subscribe({
      next: (data: any[]) => {
        this.tiposComprobante = data.map(item => ({ ...item, display: `${item.tipoDeComprobante} - ${item.descripcion}` }));
      },
      error: (error) => {
        console.error('Error loading Tipos Comprobante:', error);
        this.tiposComprobante = [];
      }
    });

    // Cargar formas de pago
    this.facturacionService.getFormaPago().subscribe({
      next: (data: any[]) => {
        this.formasPago = data.map(item => ({ ...item, display: `${item.formaPagoValue} - ${item.descripcion}` }));
      },
      error: (error) => {
        console.error('Error loading Formas Pago:', error);
        this.formasPago = [];
      }
    });

    // Cargar métodos de pago
    this.facturacionService.getMetodoPago().subscribe({
      next: (data: any[]) => {
        this.metodosPago = data.map(item => ({ ...item, display: `${item.metodoPagoValue} - ${item.descripcion}` }));
      },
      error: (error) => {
        console.error('Error loading Metodos Pago:', error);
        this.metodosPago = [];
      }
    });

    // Cargar monedas
    this.facturacionService.getMoneda().subscribe({
      next: (data: any[]) => {
        this.monedas = data.map(item => ({ ...item, display: `${item.cMoneda} - ${item.descripcion}` }));
        // Establecer Peso Mexicano por defecto después de cargar las monedas
        const pesoMexicano = this.monedas.find(mon => mon.cMoneda === 'MXN  ');
        if (pesoMexicano) {
          this.datosGenerales.moneda = 'MXN  ';
        }
      },
      error: (error) => {
        console.error('Error loading Monedas:', error);
        this.monedas = [];
      }
    });

    // Cargar usos CFDI para "Uso de la Factura"
    this.facturacionService.getUsoCfdi2fields().subscribe({
      next: (data: any[]) => {
        this.usosFactura = data.map(item => ({ ...item, display: `${item.cUsoCFDI} - ${item.descripcion}` }));
      },
      error: (error) => {
        console.error('Error loading Usos CFDI:', error);
        this.usosFactura = [];
      }
    });

    // Cargar objetos de impuesto
    this.administrationService.getObjetosImpuesto().subscribe({
      next: (data: any[]) => {
        this.objetosImpuesto = data.map(item => ({ ...item, display: `${item.id} - ${item.descripcion}` }));
      },
      error: (error) => {
        console.error('Error loading Objetos Impuesto:', error);
        this.objetosImpuesto = [];
      }
    });

    // Los clientes se cargan mediante el effect que reacciona a getRootSelectedBySidebar
  }

  loadCustomers(currentCompany: number): void {
    this.customersService.getCustomersByCompany(currentCompany, 'CUSTOMERS').subscribe({
      next: (data: any[]) => {
        this.clientes = data.map(item => ({ ...item, display: `${item.id} - ${item.name}` }));
      },
      error: (error) => {
        console.error('Error loading Clientes:', error);
        this.clientes = [];
      }
    });
  }

  agregarProducto(): void {
    const nuevoProducto = {
      descripcionDetallada: '',
      productoServicio: '',
      unidadMedida: '',
      cantidad: 1,
      valorUnitario: 0,
      importe: 0,
      objetoImpuesto: '',
      numeroIdentificacion: ''
    };
    this.productos.push(nuevoProducto);
  }

  eliminarProducto(index: number): void {
    this.productos.splice(index, 1);
  }

  calcularImporte(index: number): void {
    const producto = this.productos[index];
    if (producto.cantidad && producto.valorUnitario) {
      producto.importe = producto.cantidad * producto.valorUnitario;
    } else {
      producto.importe = 0;
    }
  }

  calcularTotal(): number {
    return this.productos.reduce((total, producto) => total + (producto.importe || 0), 0);
  }

  onClienteSeleccionado(): void {
    const clienteId = this.cliente.clienteSeleccionado;

    if (clienteId) {
      const clienteEncontrado = this.clientes.find(c => c.id === clienteId);

      if (clienteEncontrado) {
        // Llenar código postal si existe, de lo contrario dejar en blanco
        this.cliente.codigoPostal = clienteEncontrado.cp || '';
      }
    } else {
      // Si no hay cliente seleccionado, limpiar el campo
      this.cliente.codigoPostal = '';
    }
  }

  stampInvoice(): void {
    // NOTA: Este componente es un demo/ejemplo.
    // Para facturación real, usar el componente income -> pestaña "Facturación Electrónica"

    alert('Este es un componente de demostración.\n\nPara facturación electrónica real, use:\nMenú -> Administración -> Ingresos -> Facturación Electrónica');

    // Si deseas mantener esta funcionalidad de demo con XML manual, descomenta lo siguiente:
    /*
    if (!this.invoiceXml.trim()) {
      alert('Por favor, ingrese el XML de la factura.');
      return;
    }

    const idRoot = this.signalsService.getRootSelectedBySidebar()();

    // Necesitarías crear un endpoint diferente para esto
    this.administrationService.stampInvoiceWithXml(idRoot, this.invoiceXml)
      .subscribe({
        next: (response: any) => {
          this.stampedXml = response.stampedXml || response;
          alert('Factura timbrada exitosamente.');
        },
        error: (err) => {
          console.error('Error stamping invoice:', err);
          alert('Error al timbrar la factura.');
        }
      });
    */
  }

}