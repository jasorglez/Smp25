import { CommonModule } from '@angular/common';
import { Component, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IncomesAndExpensesService } from 'app/services/incomes-and-expenses.service';
import { SignalsService } from 'app/services/signals.service';
import { ProjectsService } from 'app/services/projects.service';
import { RootService } from 'app/services/root.service';
import { BranchsService } from 'app/services/branchs.service';
import { CuentasContablesService } from 'app/services/cuentas-contables.service';
import { CustomersService } from 'app/services/customers.service';
import { Base64EncodeService } from 'app/services/base64encode.service';
import { TrackingService } from 'app/services/tracking.service';
import { PdfWorkerService } from 'app/services/pdf-worker.service';
import { AdministrationService } from 'app/services/administration.service';
import { alerts } from 'app/helpers/alerts';
import { lastValueFrom } from 'rxjs';
import { Workbook } from 'exceljs';

// Interfaz para los datos del reporte de proyectos
export interface ProyectoReporte {
  cliente: string;
  proyecto: string;
  idProyecto: number;
  fechaInicio: string;
  fechaTermino: string;
  montoContratado: number;
  montoFacturado: number;
  montoCobrado: number;
  montoPendienteCobro: number;
  montoErogado: number;
  margenBruto: number;
  retiroUtilidad: number;
  margenNeto: number;
  porcentaje: number;
}

// Interfaz para inversión de activos
export interface InversionActivo {
  tipoEquipo: string;
  empresas: { [key: string]: number };
  total: number;
}

// Interfaz para aportación de socios
export interface AportacionSocio {
  socio: string;
  idSocio: number;
  aportacionBanco: number;
  aportacionEfectivo: number;
  retornoInversion: number;
  totalUtilidad: number;
}

// Interfaz para flujo de cuentas bancarias
export interface FlujoItem {
  concepto: string;
  importeCorte: number;
  importeActual: number;
}

@Component({
  selector: 'app-reporte-operativo-sin-iva',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reporte-operativo-sin-iva.component.html',
  styleUrl: './reporte-operativo-sin-iva.component.scss'
})
export class ReporteOperativoSinIvaComponent {
  private incomesAndExpensesService = inject(IncomesAndExpensesService);
  private projectsService = inject(ProjectsService);
  private signalsService = inject(SignalsService);
  private rootService = inject(RootService);
  private branchsService = inject(BranchsService);
  private cuentasContablesService = inject(CuentasContablesService);
  private base64EncodeService = inject(Base64EncodeService);
  private trackingService = inject(TrackingService);
  private pdfWorkerService = inject(PdfWorkerService);
  private customersService = inject(CustomersService);
  private administrationService = inject(AdministrationService);

  // Estado del componente
  public rootId: number;
  public companyName: string = '';
  public fechaCorte: string = '';
  public fechaActual: string = '';
  public isExportingPdf = false;
  public isExportingXlsx = false;
  public isLoading = true;

  // Filtros de fecha
  public startDate: string = '';
  public endDate: string = '';

  // Datos crudos
  private proyectos: any[] = [];
  private customers: any[] = [];
  private ingresos: any[] = [];
  private egresos: any[] = [];
  private retiros: any[] = [];
  private aportaciones: any[] = [];
  private empresas: any[] = [];
  private cuentasContablesNivel2: any[] = [];
  private allRoots: any[] = [];
  private empresasCorporativo: any[] = [];
  private transferenciasRecibidas: any[] = [];
  private transferenciasEnviadas: any[] = [];
  private cuentasBancarias: any[] = [];
  private corporativos: any[] = [];
  private corporativoActual: any = null;

  // Flujo de cuentas bancarias
  public flujoData: FlujoItem[] = [];
  public totalFlujoCorte: number = 0;
  public totalFlujoActual: number = 0;
  public fechaFlujoActual: string = '';

  // Datos procesados para el reporte
  public proyectosReporte: ProyectoReporte[] = [];
  public inversionActivos: InversionActivo[] = [];
  public empresasColumnas: string[] = [];
  public aportacionesSocios: AportacionSocio[] = [];

  // Totales
  public totales = {
    montoContratado: 0,
    montoFacturado: 0,
    montoCobrado: 0,
    montoPendienteCobro: 0,
    montoErogado: 0,
    margenBruto: 0,
    retiroUtilidad: 0,
    margenNeto: 0
  };

  public totalesInversion: { [key: string]: number } = {};
  public granTotalInversion: number = 0;

  // Totales aportación socios
  public totalesAportacion = {
    aportacionBanco: 0,
    aportacionEfectivo: 0,
    retornoInversion: 0,
    totalUtilidad: 0
  };

  constructor() {
    // Establecer fechas
    const today = new Date();
    this.fechaActual = this.formatDateDisplay(today);

    // Fecha de corte: último día del mes anterior
    const lastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
    this.fechaCorte = this.formatDateDisplay(lastMonth);

    // Inicializar filtros de fecha (últimos 24 meses por defecto)
    const twentyFourMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 24, 1);
    this.startDate = this.formatDateForInput(twentyFourMonthsAgo);
    this.endDate = this.formatDateForInput(today);

    effect(() => {
      this.rootId = this.signalsService.getRootSelectedBySidebar()();
      if (this.rootId) {
        this.loadAllData();
      }
    }, { allowSignalWrites: true });
  }

  private formatDateForInput(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  public onFilterChange(): void {
    if (this.rootId && !this.isLoading) {
      this.processData();
    }
  }

  private formatDateDisplay(date: Date): string {
    const day = date.getDate().toString().padStart(2, '0');
    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    const month = months[date.getMonth()];
    const year = date.getFullYear().toString().slice(-2);
    return `${day}-${month}-${year}`;
  }

  private formatDate(value: string): string {
    if (!value) return '';
    const date = new Date(value);
    if (isNaN(date.getTime())) return '';
    return [
      date.getDate().toString().padStart(2, '0'),
      (date.getMonth() + 1).toString().padStart(2, '0'),
      date.getFullYear()
    ].join('/');
  }

  private async loadAllData(): Promise<void> {
    this.isLoading = true;
    try {
      // Cargar datos en paralelo
      const [rootData, proyectosData, incomesData, empresasData, cuentasData, allRootsData, customersData, corporativosData] = await Promise.all([
        lastValueFrom(this.rootService.getRootbyId(this.rootId)),
        lastValueFrom(this.projectsService.getProjectListByCompany(this.rootId)),
        lastValueFrom(this.incomesAndExpensesService.getIncomesAndExpenses(this.rootId)),
        lastValueFrom(this.branchsService.getBrancheswoa(this.rootId)),
        lastValueFrom(this.cuentasContablesService.getByNivel(this.rootId, 2)),
        lastValueFrom(this.rootService.getRoot()),
        lastValueFrom(this.customersService.getCustomersByCompany(this.rootId, 'CUSTOMERS')),
        lastValueFrom(this.rootService.getCorporativos())
      ]);

      const currentRoot = rootData as any;
      this.companyName = currentRoot?.name || currentRoot?.nameCompany || 'Empresa';
      this.proyectos = Array.isArray(proyectosData) ? proyectosData : [];
      this.empresas = Array.isArray(empresasData) ? empresasData : [];
      const customersArray = Array.isArray(customersData) ? customersData : [];
      this.customers = customersArray.map((c: any) => ({
        id: c.id,
        name: c.company || c.nameContact || c.name || ''
      }));
      this.cuentasContablesNivel2 = Array.isArray(cuentasData) ? cuentasData : [];
      this.allRoots = Array.isArray(allRootsData) ? allRootsData : [];
      this.corporativos = Array.isArray(corporativosData) ? corporativosData : [];
      const idCorporativoActual = (currentRoot as any)?.idCorporativo;
      this.corporativoActual = idCorporativoActual
        ? this.corporativos.find(c => c.id === idCorporativoActual) ?? null
        : null;

      // Separar ingresos, egresos y retiros de utilidad de socios
      const allData = Array.isArray(incomesData) ? incomesData : [];
      this.ingresos = allData.filter(item => String(item?.type ?? '').toUpperCase() === 'DEPOSITO');
      this.egresos = allData.filter(item => String(item?.type ?? '').toUpperCase() === 'GASTO');
      this.retiros = allData.filter(item => ['RETIRO', 'UTILIDADES'].includes(String(item?.type ?? '').toUpperCase()));
      this.aportaciones = allData.filter(item => String(item?.type ?? '').toUpperCase() === 'APORTACION');

      // Obtener empresas del mismo corporativo
      const idCorporativo = currentRoot?.idCorporativo;
      if (idCorporativo) {
        this.empresasCorporativo = this.allRoots.filter(r => r.idCorporativo === idCorporativo && r.id !== this.rootId);
      } else {
        this.empresasCorporativo = [];
      }

      // Cargar cuentas bancarias (manejo independiente por posible 404)
      try {
        const cuentasBancariasData: any = await lastValueFrom(this.administrationService.getAccountBanks(this.rootId));
        this.cuentasBancarias = Array.isArray(cuentasBancariasData) ? cuentasBancariasData : [];
      } catch {
        this.cuentasBancarias = [];
      }

      // Cargar transferencias corporativo y flujo bancario en paralelo
      await Promise.all([
        this.loadTransferenciasCorporativo(),
        this.processFlujoData()
      ]);

      console.log('Datos cargados:', {
        proyectos: this.proyectos.length,
        ingresos: this.ingresos.length,
        egresos: this.egresos.length,
        empresas: this.empresas.length,
        empresasCorporativo: this.empresasCorporativo.length
      });

      this.processData();
    } catch (error) {
      console.error('Error cargando datos:', error);
      alerts.basicAlert('Error', 'Error al cargar los datos del reporte', 'error');
    } finally {
      this.isLoading = false;
    }
  }

  private async loadTransferenciasCorporativo(): Promise<void> {
    // Transferencias RECIBIDAS: DEPOSITOs en la empresa actual que tienen idTransferRef (vienen de otra empresa)
    this.transferenciasRecibidas = this.ingresos.filter(ing => ing.idTransferRef != null);

    // Transferencias ENVIADAS: GAStos en la empresa actual que tienen idTransferRef (van a otra empresa)
    this.transferenciasEnviadas = this.egresos.filter(eg => eg.idTransferRef != null);

    // Cargar también los registros de las otras empresas del corporativo para saber el origen/destino
    for (const empresa of this.empresasCorporativo) {
      try {
        const records: any = await lastValueFrom(
          this.incomesAndExpensesService.getIncomesAndExpenses(empresa.id)
        );
        if (Array.isArray(records)) {
          // Buscar gastos de otras empresas que apuntan a nuestra empresa (transferencias recibidas)
          const gastosOtraEmpresa = records.filter(r =>
            r.type === 'GASTO' && r.idTransferRef != null
          );
          // Agregar info de empresa origen
          gastosOtraEmpresa.forEach(g => {
            g._empresaOrigenId = empresa.id;
            g._empresaOrigenName = empresa.nameSmall || empresa.name;
          });

          // Vincular con nuestros depósitos recibidos
          this.transferenciasRecibidas.forEach(dep => {
            const gastoOrigen = gastosOtraEmpresa.find(g =>
              g.idTransferRef === dep.id || g.id === dep.idTransferRef
            );
            if (gastoOrigen) {
              dep._empresaOrigenId = gastoOrigen._empresaOrigenId;
              dep._empresaOrigenName = gastoOrigen._empresaOrigenName;
            }
          });

          // Vincular nuestros gastos enviados con el destino
          const depositosOtraEmpresa = records.filter(r =>
            r.type === 'DEPOSITO' && r.idTransferRef != null
          );
          this.transferenciasEnviadas.forEach(gasto => {
            const depositoDestino = depositosOtraEmpresa.find(d =>
              d.idTransferRef === gasto.id || d.id === gasto.idTransferRef
            );
            if (depositoDestino) {
              gasto._empresaDestinoId = empresa.id;
              gasto._empresaDestinoName = empresa.nameSmall || empresa.name;
            }
          });
        }
      } catch {
        // Ignorar errores de empresas individuales
      }
    }
  }

  private async processFlujoData(): Promise<void> {
    if (this.cuentasBancarias.length === 0) {
      this.flujoData = [];
      this.totalFlujoCorte = 0;
      this.totalFlujoActual = 0;
      return;
    }

    const today = new Date();
    const firstDayCurrentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const day8CurrentMonth = new Date(today.getFullYear(), today.getMonth(), 8);
    const lastDayCurrentMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const firstDayStr = this.formatDateForInput(firstDayCurrentMonth);
    const day8Str = this.formatDateForInput(day8CurrentMonth);
    const endStr = this.formatDateForInput(lastDayCurrentMonth);

    const months = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
    this.fechaFlujoActual = `07-${months[today.getMonth()]}`;

    const results = await Promise.all(this.cuentasBancarias.map(async (cuenta) => {
      try {
        const [resCorte, resActual] = await Promise.all([
          lastValueFrom(this.administrationService.getSaldoEIngresosMes(cuenta.id, firstDayStr, endStr)),
          lastValueFrom(this.administrationService.getSaldoEIngresosMes(cuenta.id, day8Str, endStr))
        ]);
        return {
          concepto: cuenta.nameAccount || '',
          importeCorte: (resCorte as any)?.data?.saldoInicial ?? 0,
          importeActual: (resActual as any)?.data?.saldoInicial ?? 0
        };
      } catch {
        return { concepto: cuenta.nameAccount || '', importeCorte: 0, importeActual: 0 };
      }
    }));

    this.flujoData = results.sort((a, b) => a.concepto.localeCompare(b.concepto));
    this.totalFlujoCorte = this.flujoData.reduce((sum, f) => sum + f.importeCorte, 0);
    this.totalFlujoActual = this.flujoData.reduce((sum, f) => sum + f.importeActual, 0);
  }

  private processData(): void {
    this.processProyectosReporte();
    this.processInversionActivos();
    this.processAportacionesSocios();
  }

  private filterByDateRange(data: any[]): any[] {
    if (!this.startDate || !this.endDate) return data;

    const start = new Date(this.startDate);
    const end = new Date(this.endDate);
    end.setHours(23, 59, 59, 999);

    return data.filter(item => {
      const dateStr = item.date || item.dateStamped;
      if (!dateStr) return false;
      const itemDate = new Date(dateStr);
      if (isNaN(itemDate.getTime())) return false;
      return itemDate >= start && itemDate <= end;
    });
  }

  private processProyectosReporte(): void {
    // Filtrar por rango de fechas
    const ingresosFiltered = this.filterByDateRange(this.ingresos);
    const egresosFiltered = this.filterByDateRange(this.egresos);
    const retirosFiltered = this.filterByDateRange(this.retiros);

    // Agrupar por par (idProyecto, idCliente) para desglose completo
    const ingresosPorClienteProyecto = new Map<string, { facturado: number; cobrado: number; idCliente: number; idProyecto: number }>();
    const egresosPorProyecto = new Map<number, number>();
    const retirosPorProyecto = new Map<number, number>();

    // Procesar retiros por proyecto
    retirosFiltered.forEach(retiro => {
      const idProyecto = retiro.idProject;
      if (!idProyecto) return;
      const monto = Number(retiro.subtotal) || Number(retiro.total) || 0;
      retirosPorProyecto.set(idProyecto, (retirosPorProyecto.get(idProyecto) || 0) + monto);
    });

    // Procesar ingresos agrupados por (proyecto, cliente)
    ingresosFiltered.forEach(ingreso => {
      const idProyecto = ingreso.idProject;
      const idCliente = ingreso.idCustomer;
      if (!idProyecto || !idCliente) return;

      const key = `${idProyecto}_${idCliente}`;
      const current = ingresosPorClienteProyecto.get(key) || { facturado: 0, cobrado: 0, idCliente, idProyecto };
      const subtotal = Number(ingreso.subtotal) || 0;

      if (ingreso.dateStamped) {
        current.facturado += subtotal;
      }
      if (ingreso.status === 'Pagada') {
        current.cobrado += subtotal;
      }

      ingresosPorClienteProyecto.set(key, current);
    });

    // Procesar egresos por proyecto (los gastos son a nivel proyecto, no cliente)
    egresosFiltered.forEach(egreso => {
      const idProyecto = egreso.idProject;
      if (!idProyecto) return;
      const subtotal = Number(egreso.subtotal) || 0;
      egresosPorProyecto.set(idProyecto, (egresosPorProyecto.get(idProyecto) || 0) + subtotal);
    });

    // Construir una fila por cada par (proyecto, cliente)
    this.proyectosReporte = [];
    ingresosPorClienteProyecto.forEach(({ facturado, cobrado, idCliente, idProyecto }) => {
      const proyecto = this.proyectos.find(p => p.id === idProyecto);
      if (!proyecto) return;

      const customer = this.customers.find(c => c.id === idCliente);
      const erogado = egresosPorProyecto.get(idProyecto) || 0;
      const montoContratado = Number(proyecto.budgetManagement) || facturado;
      const montoPendienteCobro = facturado - cobrado;
      const margenBruto = cobrado - erogado;
      const retiroUtilidad = retirosPorProyecto.get(idProyecto) || 0;
      const margenNeto = margenBruto - retiroUtilidad;
      const porcentaje = cobrado > 0 ? (margenNeto / cobrado) * 100 : 0;

      this.proyectosReporte.push({
        cliente: customer?.name || '',
        proyecto: proyecto.name || proyecto.number || `Proyecto ${idProyecto}`,
        idProyecto,
        fechaInicio: this.formatDate(proyecto.programStart),
        fechaTermino: this.formatDate(proyecto.programEnd),
        montoContratado,
        montoFacturado: facturado,
        montoCobrado: cobrado,
        montoPendienteCobro,
        montoErogado: erogado,
        margenBruto,
        retiroUtilidad,
        margenNeto,
        porcentaje
      });
    });

    this.proyectosReporte.sort((a, b) => {
      const cmp = a.cliente.localeCompare(b.cliente);
      return cmp !== 0 ? cmp : a.proyecto.localeCompare(b.proyecto);
    });

    // Calcular totales
    this.totales = this.proyectosReporte.reduce((acc, p) => ({
      montoContratado: acc.montoContratado + p.montoContratado,
      montoFacturado: acc.montoFacturado + p.montoFacturado,
      montoCobrado: acc.montoCobrado + p.montoCobrado,
      montoPendienteCobro: acc.montoPendienteCobro + p.montoPendienteCobro,
      montoErogado: acc.montoErogado + p.montoErogado,
      margenBruto: acc.margenBruto + p.margenBruto,
      retiroUtilidad: acc.retiroUtilidad + p.retiroUtilidad,
      margenNeto: acc.margenNeto + p.margenNeto
    }), {
      montoContratado: 0,
      montoFacturado: 0,
      montoCobrado: 0,
      montoPendienteCobro: 0,
      montoErogado: 0,
      margenBruto: 0,
      retiroUtilidad: 0,
      margenNeto: 0
    });
  }

  private processInversionActivos(): void {
    // Obtener empresas únicas de los proyectos
    const empresasSet = new Set<string>();
    this.proyectosReporte.forEach(p => empresasSet.add(p.cliente));
    this.empresasColumnas = Array.from(empresasSet).sort();

    // Agrupar egresos por tipo de gasto (cuenta contable nivel 2) y empresa
    const inversionMap = new Map<string, { empresas: { [key: string]: number }; total: number }>();

    // Filtrar egresos cuya subclasificación apunta a una cuenta contable con activo = true
    const egresosInversion = this.egresos.filter(egreso => {
      const idSubclasif = egreso.idSubclasificacion;
      if (!idSubclasif) return false;
      const cuenta = this.cuentasContablesNivel2.find(c => c.id === idSubclasif);
      return cuenta?.activo === true;
    });

    // Mapa idProject → nombre de cliente (via ingresos que tienen idCustomer)
    const proyectoACliente = new Map<number, string>();
    this.ingresos.forEach(ing => {
      if (ing.idProject && ing.idCustomer && !proyectoACliente.has(ing.idProject)) {
        const customer = this.customers.find(c => c.id === ing.idCustomer);
        if (customer?.name) proyectoACliente.set(ing.idProject, customer.name);
      }
    });

    egresosInversion.forEach(egreso => {
      const cuenta = this.cuentasContablesNivel2.find(c => c.id === egreso.idSubclasificacion);
      const tipoEquipo = cuenta ? cuenta.nombre : 'SIN CLASIFICAR';
      const subtotal = Number(egreso.subtotal) || 0;

      // Obtener cliente: campo directo idCustomer o via idProject
      let clienteNombre: string | null = null;
      if (egreso.idCustomer) {
        const customer = this.customers.find(c => c.id === egreso.idCustomer);
        clienteNombre = customer?.name || null;
      }
      if (!clienteNombre && egreso.idProject) {
        clienteNombre = proyectoACliente.get(egreso.idProject) || null;
      }
      if (!clienteNombre) return;

      const current = inversionMap.get(tipoEquipo) || { empresas: {}, total: 0 };
      current.empresas[clienteNombre] = (current.empresas[clienteNombre] || 0) + subtotal;
      current.total += subtotal;
      inversionMap.set(tipoEquipo, current);
    });

    // Convertir a array
    this.inversionActivos = Array.from(inversionMap.entries())
      .map(([tipoEquipo, data]) => ({
        tipoEquipo,
        empresas: data.empresas,
        total: data.total
      }))
      .sort((a, b) => a.tipoEquipo.localeCompare(b.tipoEquipo));

    // Calcular totales por empresa
    this.totalesInversion = {};
    this.granTotalInversion = 0;

    this.inversionActivos.forEach(inv => {
      this.empresasColumnas.forEach(empresa => {
        this.totalesInversion[empresa] = (this.totalesInversion[empresa] || 0) + (inv.empresas[empresa] || 0);
      });
      this.granTotalInversion += inv.total;
    });
  }

  private processAportacionesSocios(): void {
    const aportacionesFiltradas = this.filterByDateRange(this.aportaciones);
    const retirosFiltrados = this.filterByDateRange(this.retiros);

    // Clave: nombre del socio en mayúsculas; valor: montos acumulados
    const sociosMap = new Map<string, {
      aportacionBanco: number;
      aportacionEfectivo: number;
      retornoInversion: number;
    }>();

    // Pre-poblar con los socios del corporativo actual (aunque tengan $0)
    if (this.corporativoActual) {
      ['partner1', 'partner2', 'partner3', 'partner4', 'partner5'].forEach(field => {
        const nombre = (this.corporativoActual[field] || '').trim().toUpperCase();
        if (nombre) {
          sociosMap.set(nombre, { aportacionBanco: 0, aportacionEfectivo: 0, retornoInversion: 0 });
        }
      });
    }

    // Procesar APORTACIONES: type='APORTACION', socio en description, banco/efectivo por idAccount→cash
    aportacionesFiltradas.forEach(ap => {
      const match = (ap.description || '').match(/^Aportaci[oó]n de (.+?) - /i);
      const nombreSocio = match ? match[1].trim().toUpperCase() : '';
      if (!nombreSocio) return;

      const cuenta = this.cuentasBancarias.find(c => c.id === ap.idAccount);
      const esCash = cuenta?.cash === true;
      const monto = Number(ap.subtotal) || Number(ap.total) || 0;

      const current = sociosMap.get(nombreSocio) || { aportacionBanco: 0, aportacionEfectivo: 0, retornoInversion: 0 };
      if (esCash) {
        current.aportacionEfectivo += monto;
      } else {
        current.aportacionBanco += monto;
      }
      sociosMap.set(nombreSocio, current);
    });

    // Procesar RETIROS/UTILIDADES: idCustomer = corporativoId * 10 + partnerNumber
    retirosFiltrados.forEach(retiro => {
      const idCustomer = Number(retiro.idCustomer);
      if (!idCustomer) return;

      const partnerNumber = idCustomer % 10;
      const corporativoId = Math.floor(idCustomer / 10);
      const corp = this.corporativos.find(c => c.id === corporativoId);
      if (!corp) return;

      const nombreSocio = (corp[`partner${partnerNumber}`] || '').trim().toUpperCase();
      if (!nombreSocio) return;

      const monto = Number(retiro.subtotal) || Number(retiro.total) || 0;
      const current = sociosMap.get(nombreSocio) || { aportacionBanco: 0, aportacionEfectivo: 0, retornoInversion: 0 };
      current.retornoInversion += monto;
      sociosMap.set(nombreSocio, current);
    });

    // Convertir a array y calcular totales
    this.aportacionesSocios = Array.from(sociosMap.entries())
      .map(([nombre, data]) => ({
        socio: nombre,
        idSocio: 0,
        aportacionBanco: data.aportacionBanco,
        aportacionEfectivo: data.aportacionEfectivo,
        retornoInversion: data.retornoInversion,
        totalUtilidad: data.aportacionBanco + data.aportacionEfectivo - data.retornoInversion
      }))
      .sort((a, b) => a.socio.localeCompare(b.socio));

    // Calcular totales
    this.totalesAportacion = this.aportacionesSocios.reduce((acc, s) => ({
      aportacionBanco: acc.aportacionBanco + s.aportacionBanco,
      aportacionEfectivo: acc.aportacionEfectivo + s.aportacionEfectivo,
      retornoInversion: acc.retornoInversion + s.retornoInversion,
      totalUtilidad: acc.totalUtilidad + s.totalUtilidad
    }), {
      aportacionBanco: 0,
      aportacionEfectivo: 0,
      retornoInversion: 0,
      totalUtilidad: 0
    });
  }

  public formatCurrency(value: number): string {
    if (!Number.isFinite(value)) return '$0.00';
    return value.toLocaleString('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  // Formato corto de moneda para PDF (sin decimales, más compacto)
  private formatCurrencyShort(value: number): string {
    if (!Number.isFinite(value)) return '$0';
    return '$' + value.toLocaleString('es-MX', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
  }

  public formatPercent(value: number): string {
    if (!Number.isFinite(value)) return '0%';
    return `${value.toFixed(0)}%`;
  }

  public getInversionValue(inversion: InversionActivo, empresa: string): number {
    return inversion.empresas[empresa] || 0;
  }

  public async exportToPdf(): Promise<void> {
    if (this.isExportingPdf || this.isExportingXlsx) return;
    this.isExportingPdf = true;

    try {
      // Obtener logo
      const rootData: any = await lastValueFrom(this.rootService.getRootbyId(this.rootId));
      let logoBase64: string | null = null;
      if (rootData?.picture) {
        try {
          logoBase64 = await this.base64EncodeService.convertImageToBase64(rootData.picture);
        } catch (e) {
          console.warn('No se pudo cargar el logo');
        }
      }

      const content = this.buildPdfContent();

      const docDefinition: any = {
        pageSize: 'TABLOID',
        pageOrientation: 'landscape',
        pageMargins: [15, 60, 15, 30],
        header: this.buildPdfHeader(logoBase64),
        content,
        styles: {
          tableHeader: { fontSize: 7, bold: true, color: '#FFFFFF', fillColor: '#1a365d' },
          tableCell: { fontSize: 7, color: '#333333' },
          tableCellRight: { fontSize: 7, color: '#333333', alignment: 'right' },
          tableCellMoney: { fontSize: 7, color: '#333333', alignment: 'right' },
          totalRow: { fontSize: 7, bold: true, fillColor: '#e2e8f0' },
          sectionTitle: { fontSize: 10, bold: true, color: '#1a365d', margin: [0, 15, 0, 8] }
        }
      };

      const footerTemplate = { text: 'Página {cp} de {pc}', alignment: 'center', fontSize: 7, margin: [0, 10, 0, 0] };
      const fileName = `reporte-ejecutivo-proyectos-${new Date().toISOString().split('T')[0]}.pdf`;
      await this.pdfWorkerService.generateAndDownload(docDefinition, fileName, footerTemplate);

      this.trackingService.addLog(
        this.trackingService.getnameComp(),
        'Exportación PDF - Reporte Ejecutivo Proyectos',
        'Reporte Operativo',
        this.trackingService.getEmail()
      );
    } catch (error) {
      console.error('Error exportando PDF:', error);
      alerts.basicAlert('Error', 'Error al generar el PDF', 'error');
    } finally {
      this.isExportingPdf = false;
    }
  }

  private buildPdfHeader(logoBase64: string | null): any {
    const logoCell = logoBase64
      ? { image: logoBase64, width: 60, alignment: 'left' }
      : { text: 'HCO', bold: true, fontSize: 14, alignment: 'left' };

    return {
      margin: [15, 10, 15, 0],
      table: {
        widths: ['15%', '*', '20%'],
        body: [[
          logoCell,
          {
            stack: [
              { text: 'REPORTE EJECUTIVO PROYECTOS HCO', fontSize: 12, bold: true, alignment: 'center', color: '#1a365d' },
              { text: 'Sistema de Gestión de Calidad', fontSize: 8, alignment: 'center', color: '#666' }
            ]
          },
          {
            stack: [
              { text: 'Referencia: HCO-ADM-SGC-005', fontSize: 7, alignment: 'right', color: '#666' },
              { text: 'Código: HCO-ADM-FO-018', fontSize: 7, alignment: 'right', color: '#666' },
              { text: 'Rev.: 00', fontSize: 7, alignment: 'right', color: '#666' },
              { text: `Fecha Corte: ${this.fechaCorte}`, fontSize: 7, alignment: 'right', color: '#333' },
              { text: `Fecha Actual: ${this.fechaActual}`, fontSize: 7, alignment: 'right', color: '#333' }
            ]
          }
        ]]
      },
      layout: 'noBorders'
    };
  }

  private buildPdfContent(): any[] {
    const content: any[] = [];

    // Tabla de proyectos
    const proyectosTable = this.buildProyectosTable();
    content.push(proyectosTable);

    // Sección de Inversión de Activos
    if (this.inversionActivos.length > 0) {
      content.push({ text: 'INVERSIÓN DE ACTIVOS', style: 'sectionTitle' });
      content.push(this.buildInversionTable());
    }

    // Sección de Aportación de Socios
    if (this.aportacionesSocios.length > 0) {
      content.push({ text: 'APORTACIÓN SOCIOS', style: 'sectionTitle' });
      content.push(this.buildAportacionesTable());
    }

    // Sección de Flujo Bancario (al final)
    if (this.flujoData.length > 0) {
      content.push({ text: 'FLUJO DE CUENTAS BANCARIAS', style: 'sectionTitle' });
      content.push(this.buildFlujoTable());
    }

    return content;
  }

  private buildProyectosTable(): any {
    // Encabezados abreviados para caber en LETTER
    const headers = [
      'Cliente', 'Proyecto', 'FI', 'FT', 'Contratado', 'Facturado',
      'Cobrado', 'Pend. Cobro', 'Erogado', 'Margen Bruto',
      'Retiro Util.', 'Margen Neto', '%'
    ];

    const body: any[] = [
      headers.map(h => ({ text: h, style: 'tableHeader', alignment: 'center' }))
    ];

    this.proyectosReporte.forEach(p => {
      body.push([
        { text: p.cliente, style: 'tableCell' },
        { text: p.proyecto, style: 'tableCell' },
        { text: p.fechaInicio, style: 'tableCell', alignment: 'center' },
        { text: p.fechaTermino, style: 'tableCell', alignment: 'center' },
        { text: this.formatCurrencyShort(p.montoContratado), style: 'tableCellMoney' },
        { text: this.formatCurrencyShort(p.montoFacturado), style: 'tableCellMoney' },
        { text: this.formatCurrencyShort(p.montoCobrado), style: 'tableCellMoney' },
        { text: this.formatCurrencyShort(p.montoPendienteCobro), style: 'tableCellMoney' },
        { text: this.formatCurrencyShort(p.montoErogado), style: 'tableCellMoney' },
        { text: this.formatCurrencyShort(p.margenBruto), style: 'tableCellMoney' },
        { text: this.formatCurrencyShort(p.retiroUtilidad), style: 'tableCellMoney', fillColor: p.retiroUtilidad > 0 ? '#fef3c7' : null },
        { text: this.formatCurrencyShort(p.margenNeto), style: 'tableCellMoney' },
        { text: this.formatPercent(p.porcentaje), style: 'tableCellRight' }
      ]);
    });

    // Fila de totales
    body.push([
      { text: 'TOTAL', style: 'totalRow', bold: true },
      { text: '', style: 'totalRow' },
      { text: '', style: 'totalRow' },
      { text: '', style: 'totalRow' },
      { text: this.formatCurrencyShort(this.totales.montoContratado), style: 'totalRow', alignment: 'right' },
      { text: this.formatCurrencyShort(this.totales.montoFacturado), style: 'totalRow', alignment: 'right' },
      { text: this.formatCurrencyShort(this.totales.montoCobrado), style: 'totalRow', alignment: 'right' },
      { text: this.formatCurrencyShort(this.totales.montoPendienteCobro), style: 'totalRow', alignment: 'right' },
      { text: this.formatCurrencyShort(this.totales.montoErogado), style: 'totalRow', alignment: 'right' },
      { text: this.formatCurrencyShort(this.totales.margenBruto), style: 'totalRow', alignment: 'right' },
      { text: this.formatCurrencyShort(this.totales.retiroUtilidad), style: 'totalRow', alignment: 'right', fillColor: '#fef3c7' },
      { text: this.formatCurrencyShort(this.totales.margenNeto), style: 'totalRow', alignment: 'right' },
      { text: this.totales.montoCobrado > 0 ? this.formatPercent((this.totales.margenNeto / this.totales.montoCobrado) * 100) : '0%', style: 'totalRow', alignment: 'right' }
    ]);

    return {
      table: {
        headerRows: 1,
        widths: ['*', '*', 52, 52, 80, 80, 80, 74, 76, 80, 70, 80, 28],
        body
      },
      layout: 'siafStripe'
    };
  }

  private buildFlujoTable(): any {
    const buildSingleFlujo = (titulo: string, getImporte: (f: FlujoItem) => number, total: number) => {
      const body: any[] = [
        [
          { text: titulo, style: 'tableHeader', alignment: 'center', colSpan: 2, fillColor: '#155e75' },
          {}
        ],
        [
          { text: 'CONCEPTO', style: 'tableHeader', alignment: 'center', fillColor: '#0e7490' },
          { text: 'IMPORTE', style: 'tableHeader', alignment: 'center', fillColor: '#0e7490' }
        ]
      ];

      this.flujoData.forEach((f, i) => {
        body.push([
          { text: f.concepto, style: 'tableCell', fillColor: i % 2 === 0 ? '#f0f9ff' : null },
          { text: this.formatCurrencyShort(getImporte(f)), style: 'tableCellMoney', fillColor: i % 2 === 0 ? '#f0f9ff' : null }
        ]);
      });

      body.push([
        { text: 'TOTAL', style: 'totalRow', bold: true, fillColor: '#e2e8f0' },
        { text: this.formatCurrencyShort(total), style: 'totalRow', alignment: 'right', bold: true, fillColor: '#e2e8f0' }
      ]);

      return {
        table: { headerRows: 2, widths: ['*', 80], body },
        layout: 'siafSubTable'
      };
    };

    return {
      columns: [
        buildSingleFlujo('FLUJO AL CORTE', (f) => f.importeCorte, this.totalFlujoCorte),
        { width: 20, text: '' },
        buildSingleFlujo(`FLUJO ACTUAL ${this.fechaFlujoActual}`, (f) => f.importeActual, this.totalFlujoActual)
      ]
    };
  }

  private buildAportacionesTable(): any {
    const headers = ['SOCIOS', 'APORTACIÓN BANCO', 'APORTACIÓN EFECTIVO', 'RETORNO DE INVERSIÓN', 'TOTAL UTILIDAD'];

    const body: any[] = [
      headers.map(h => ({ text: h, style: 'tableHeader', alignment: 'center', fillColor: '#1e40af' }))
    ];

    this.aportacionesSocios.forEach(s => {
      body.push([
        { text: s.socio, style: 'tableCell' },
        { text: this.formatCurrencyShort(s.aportacionBanco), style: 'tableCellMoney' },
        { text: this.formatCurrencyShort(s.aportacionEfectivo), style: 'tableCellMoney' },
        { text: this.formatCurrencyShort(s.retornoInversion), style: 'tableCellMoney', color: '#dc2626' },
        { text: this.formatCurrencyShort(s.totalUtilidad), style: 'tableCellMoney', bold: true }
      ]);
    });

    // Fila de totales
    body.push([
      { text: '', style: 'totalRow' },
      { text: this.formatCurrencyShort(this.totalesAportacion.aportacionBanco), style: 'totalRow', alignment: 'right' },
      { text: this.formatCurrencyShort(this.totalesAportacion.aportacionEfectivo), style: 'totalRow', alignment: 'right' },
      { text: this.formatCurrencyShort(this.totalesAportacion.retornoInversion), style: 'totalRow', alignment: 'right', color: '#dc2626' },
      { text: this.formatCurrencyShort(this.totalesAportacion.totalUtilidad), style: 'totalRow', alignment: 'right', bold: true }
    ]);

    return {
      table: {
        headerRows: 1,
        widths: [100, '*', '*', '*', '*'],
        body
      },
      layout: 'siafStripeBlue'
    };
  }

  private buildInversionTable(): any {
    const headers = ['EQUIPOS', ...this.empresasColumnas, 'TOTAL'];

    const body: any[] = [
      headers.map(h => ({ text: h, style: 'tableHeader', alignment: 'center' }))
    ];

    this.inversionActivos.forEach(inv => {
      const row = [
        { text: inv.tipoEquipo, style: 'tableCell' },
        ...this.empresasColumnas.map(emp => ({
          text: inv.empresas[emp] ? this.formatCurrency(inv.empresas[emp]) : '-',
          style: 'tableCellMoney'
        })),
        { text: this.formatCurrency(inv.total), style: 'tableCellMoney', bold: true }
      ];
      body.push(row);
    });

    // Fila de totales
    const totalRow = [
      { text: 'Total Resultado', style: 'totalRow', bold: true },
      ...this.empresasColumnas.map(emp => ({
        text: this.formatCurrency(this.totalesInversion[emp] || 0),
        style: 'totalRow',
        alignment: 'right'
      })),
      { text: this.formatCurrency(this.granTotalInversion), style: 'totalRow', alignment: 'right', bold: true }
    ];
    body.push(totalRow);

    const colWidths = [80, ...this.empresasColumnas.map(() => '*'), 60];

    return {
      table: {
        headerRows: 1,
        widths: colWidths,
        body
      },
      layout: 'siafStripe'
    };
  }

  public async exportToXlsx(): Promise<void> {
    if (this.isExportingPdf || this.isExportingXlsx) return;
    this.isExportingXlsx = true;

    try {
      const workbook = new Workbook();
      const worksheet = workbook.addWorksheet('Reporte Ejecutivo');

      // Configuración
      worksheet.views = [{ showGridLines: false }];

      // Título
      worksheet.mergeCells('A1:M1');
      const titleCell = worksheet.getCell('A1');
      titleCell.value = 'REPORTE EJECUTIVO PROYECTOS HCO';
      titleCell.font = { bold: true, size: 14, color: { argb: 'FF1A365D' } };
      titleCell.alignment = { horizontal: 'center' };

      // Fechas
      worksheet.getCell('A2').value = `Fecha Corte: ${this.fechaCorte}`;
      worksheet.getCell('A3').value = `Fecha Actual: ${this.fechaActual}`;

      // Encabezados de la tabla
      const headers = [
        'Cliente', 'Proyecto', 'FI', 'FT', 'Monto Contratado', 'Monto Facturado',
        'Monto Cobrado', 'Monto Pendiente de Cobro', 'Monto Erogado', 'Margen Bruto',
        'Retiro de Utilidad socios', 'Margen Neto', '%'
      ];

      const headerRow = worksheet.getRow(5);
      headers.forEach((header, index) => {
        const cell = headerRow.getCell(index + 1);
        cell.value = header;
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A365D' } };
        cell.alignment = { horizontal: 'center' };
      });

      // Datos
      let rowIndex = 6;
      this.proyectosReporte.forEach(p => {
        const row = worksheet.getRow(rowIndex);
        row.getCell(1).value = p.cliente;
        row.getCell(2).value = p.proyecto;
        row.getCell(3).value = p.fechaInicio;
        row.getCell(4).value = p.fechaTermino;
        row.getCell(5).value = p.montoContratado;
        row.getCell(5).numFmt = '"$"#,##0.00';
        row.getCell(6).value = p.montoFacturado;
        row.getCell(6).numFmt = '"$"#,##0.00';
        row.getCell(7).value = p.montoCobrado;
        row.getCell(7).numFmt = '"$"#,##0.00';
        row.getCell(8).value = p.montoPendienteCobro;
        row.getCell(8).numFmt = '"$"#,##0.00';
        row.getCell(9).value = p.montoErogado;
        row.getCell(9).numFmt = '"$"#,##0.00';
        row.getCell(10).value = p.margenBruto;
        row.getCell(10).numFmt = '"$"#,##0.00';
        row.getCell(11).value = p.retiroUtilidad;
        row.getCell(11).numFmt = '"$"#,##0.00';
        row.getCell(12).value = p.margenNeto;
        row.getCell(12).numFmt = '"$"#,##0.00';
        row.getCell(13).value = p.porcentaje / 100;
        row.getCell(13).numFmt = '0%';
        rowIndex++;
      });

      // Fila de totales
      const totalRow = worksheet.getRow(rowIndex);
      totalRow.getCell(1).value = 'TOTAL';
      totalRow.font = { bold: true };
      totalRow.getCell(5).value = this.totales.montoContratado;
      totalRow.getCell(5).numFmt = '"$"#,##0.00';
      totalRow.getCell(6).value = this.totales.montoFacturado;
      totalRow.getCell(6).numFmt = '"$"#,##0.00';
      totalRow.getCell(7).value = this.totales.montoCobrado;
      totalRow.getCell(7).numFmt = '"$"#,##0.00';
      totalRow.getCell(8).value = this.totales.montoPendienteCobro;
      totalRow.getCell(8).numFmt = '"$"#,##0.00';
      totalRow.getCell(9).value = this.totales.montoErogado;
      totalRow.getCell(9).numFmt = '"$"#,##0.00';
      totalRow.getCell(10).value = this.totales.margenBruto;
      totalRow.getCell(10).numFmt = '"$"#,##0.00';
      totalRow.getCell(11).value = this.totales.retiroUtilidad;
      totalRow.getCell(11).numFmt = '"$"#,##0.00';
      totalRow.getCell(12).value = this.totales.margenNeto;
      totalRow.getCell(12).numFmt = '"$"#,##0.00';
      totalRow.getCell(13).value = this.totales.montoCobrado > 0 ? this.totales.margenNeto / this.totales.montoCobrado : 0;
      totalRow.getCell(13).numFmt = '0%';

      // Ajustar anchos de columna
      worksheet.columns = [
        { width: 15 }, { width: 20 }, { width: 12 }, { width: 12 },
        { width: 15 }, { width: 15 }, { width: 15 }, { width: 18 },
        { width: 15 }, { width: 15 }, { width: 18 }, { width: 15 }, { width: 8 }
      ];

      // Hoja de Inversión de Activos
      if (this.inversionActivos.length > 0) {
        const invSheet = workbook.addWorksheet('Inversión Activos');
        invSheet.views = [{ showGridLines: false }];

        const invHeaders = ['EQUIPOS', ...this.empresasColumnas, 'TOTAL'];
        invSheet.mergeCells(`A1:${String.fromCharCode(64 + invHeaders.length)}1`);
        const invTitle = invSheet.getCell('A1');
        invTitle.value = 'INVERSIÓN DE ACTIVOS';
        invTitle.font = { bold: true, size: 12, color: { argb: 'FF1A365D' } };
        invTitle.alignment = { horizontal: 'center' };

        const invHeaderRow = invSheet.getRow(2);
        invHeaders.forEach((h, i) => {
          const cell = invHeaderRow.getCell(i + 1);
          cell.value = h;
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A365D' } };
          cell.alignment = { horizontal: 'center' };
        });

        let invRow = 3;
        this.inversionActivos.forEach(inv => {
          const row = invSheet.getRow(invRow);
          row.getCell(1).value = inv.tipoEquipo;
          this.empresasColumnas.forEach((emp, i) => {
            row.getCell(i + 2).value = inv.empresas[emp] || 0;
            row.getCell(i + 2).numFmt = '"$"#,##0.00';
          });
          row.getCell(this.empresasColumnas.length + 2).value = inv.total;
          row.getCell(this.empresasColumnas.length + 2).numFmt = '"$"#,##0.00';
          invRow++;
        });

        const invTotalRow = invSheet.getRow(invRow);
        invTotalRow.font = { bold: true };
        invTotalRow.getCell(1).value = 'TOTAL';
        this.empresasColumnas.forEach((emp, i) => {
          invTotalRow.getCell(i + 2).value = this.totalesInversion[emp] || 0;
          invTotalRow.getCell(i + 2).numFmt = '"$"#,##0.00';
        });
        invTotalRow.getCell(this.empresasColumnas.length + 2).value = this.granTotalInversion;
        invTotalRow.getCell(this.empresasColumnas.length + 2).numFmt = '"$"#,##0.00';

        invSheet.columns = [
          { width: 30 },
          ...this.empresasColumnas.map(() => ({ width: 18 })),
          { width: 15 }
        ];
      }

      // Hoja de Aportación de Socios
      if (this.aportacionesSocios.length > 0) {
        const sociosSheet = workbook.addWorksheet('Aportación Socios');
        sociosSheet.views = [{ showGridLines: false }];

        sociosSheet.mergeCells('A1:E1');
        const sociosTitle = sociosSheet.getCell('A1');
        sociosTitle.value = 'APORTACIÓN DE SOCIOS';
        sociosTitle.font = { bold: true, size: 12, color: { argb: 'FF1A365D' } };
        sociosTitle.alignment = { horizontal: 'center' };

        const sociosHeaders = ['SOCIOS', 'APORTACIÓN BANCO', 'APORTACIÓN EFECTIVO', 'RETORNO DE INVERSIÓN', 'TOTAL UTILIDAD'];
        const sociosHeaderRow = sociosSheet.getRow(2);
        sociosHeaders.forEach((h, i) => {
          const cell = sociosHeaderRow.getCell(i + 1);
          cell.value = h;
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A365D' } };
          cell.alignment = { horizontal: 'center' };
        });

        let sociosRow = 3;
        this.aportacionesSocios.forEach(s => {
          const row = sociosSheet.getRow(sociosRow);
          row.getCell(1).value = s.socio;
          row.getCell(2).value = s.aportacionBanco;
          row.getCell(2).numFmt = '"$"#,##0.00';
          row.getCell(3).value = s.aportacionEfectivo;
          row.getCell(3).numFmt = '"$"#,##0.00';
          row.getCell(4).value = s.retornoInversion;
          row.getCell(4).numFmt = '"$"#,##0.00';
          row.getCell(5).value = s.totalUtilidad;
          row.getCell(5).numFmt = '"$"#,##0.00';
          sociosRow++;
        });

        const sociosTotalRow = sociosSheet.getRow(sociosRow);
        sociosTotalRow.font = { bold: true };
        sociosTotalRow.getCell(1).value = 'TOTAL';
        sociosTotalRow.getCell(2).value = this.totalesAportacion.aportacionBanco;
        sociosTotalRow.getCell(2).numFmt = '"$"#,##0.00';
        sociosTotalRow.getCell(3).value = this.totalesAportacion.aportacionEfectivo;
        sociosTotalRow.getCell(3).numFmt = '"$"#,##0.00';
        sociosTotalRow.getCell(4).value = this.totalesAportacion.retornoInversion;
        sociosTotalRow.getCell(4).numFmt = '"$"#,##0.00';
        sociosTotalRow.getCell(5).value = this.totalesAportacion.totalUtilidad;
        sociosTotalRow.getCell(5).numFmt = '"$"#,##0.00';

        sociosSheet.columns = [{ width: 30 }, { width: 20 }, { width: 22 }, { width: 22 }, { width: 18 }];
      }

      // Hoja de Flujo Bancario
      if (this.flujoData.length > 0) {
        const flujoSheet = workbook.addWorksheet('Flujo Bancario');
        flujoSheet.views = [{ showGridLines: false }];

        flujoSheet.mergeCells('A1:C1');
        const flujoTitle = flujoSheet.getCell('A1');
        flujoTitle.value = 'FLUJO DE CUENTAS BANCARIAS';
        flujoTitle.font = { bold: true, size: 12, color: { argb: 'FF155E75' } };
        flujoTitle.alignment = { horizontal: 'center' };

        const flujoHeaders = flujoSheet.getRow(2);
        ['CONCEPTO', 'FLUJO AL CORTE', `FLUJO ACTUAL ${this.fechaFlujoActual}`].forEach((h, i) => {
          const cell = flujoHeaders.getCell(i + 1);
          cell.value = h;
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0E7490' } };
          cell.alignment = { horizontal: 'center' };
        });

        let flujoRow = 3;
        this.flujoData.forEach(f => {
          const row = flujoSheet.getRow(flujoRow);
          row.getCell(1).value = f.concepto;
          row.getCell(2).value = f.importeCorte;
          row.getCell(2).numFmt = '"$"#,##0.00';
          row.getCell(3).value = f.importeActual;
          row.getCell(3).numFmt = '"$"#,##0.00';
          flujoRow++;
        });

        const flujoTotalRow = flujoSheet.getRow(flujoRow);
        flujoTotalRow.getCell(1).value = 'TOTAL';
        flujoTotalRow.font = { bold: true };
        flujoTotalRow.getCell(2).value = this.totalFlujoCorte;
        flujoTotalRow.getCell(2).numFmt = '"$"#,##0.00';
        flujoTotalRow.getCell(3).value = this.totalFlujoActual;
        flujoTotalRow.getCell(3).numFmt = '"$"#,##0.00';

        flujoSheet.columns = [{ width: 45 }, { width: 18 }, { width: 18 }];
      }

      // Generar archivo
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `reporte-ejecutivo-proyectos-${new Date().toISOString().split('T')[0]}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);

      this.trackingService.addLog(
        this.trackingService.getnameComp(),
        'Exportación XLSX - Reporte Ejecutivo Proyectos',
        'Reporte Operativo',
        this.trackingService.getEmail()
      );

      alerts.basicAlert('Éxito', 'Archivo Excel generado correctamente', 'success');
    } catch (error) {
      console.error('Error exportando XLSX:', error);
      alerts.basicAlert('Error', 'Error al generar el archivo Excel', 'error');
    } finally {
      this.isExportingXlsx = false;
    }
  }
}
