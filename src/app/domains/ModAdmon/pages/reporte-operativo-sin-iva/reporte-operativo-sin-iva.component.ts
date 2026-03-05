import { CommonModule } from '@angular/common';
import { Component, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IncomesAndExpensesService } from 'app/services/incomes-and-expenses.service';
import { SignalsService } from 'app/services/signals.service';
import { ProjectsService } from 'app/services/projects.service';
import { RootService } from 'app/services/root.service';
import { BranchsService } from 'app/services/branchs.service';
import { CuentasContablesService } from 'app/services/cuentas-contables.service';
import { Base64EncodeService } from 'app/services/base64encode.service';
import { TrackingService } from 'app/services/tracking.service';
import { alerts } from 'app/helpers/alerts';
import { lastValueFrom } from 'rxjs';
import { Workbook } from 'exceljs';

// Interfaz para los datos del reporte de proyectos
export interface ProyectoReporte {
  empresa: string;
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
  private ingresos: any[] = [];
  private egresos: any[] = [];
  private empresas: any[] = [];
  private cuentasContablesNivel2: any[] = [];
  private allRoots: any[] = [];
  private empresasCorporativo: any[] = [];
  private transferenciasRecibidas: any[] = [];
  private transferenciasEnviadas: any[] = [];

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
      const [rootData, proyectosData, incomesData, empresasData, cuentasData, allRootsData] = await Promise.all([
        lastValueFrom(this.rootService.getRootbyId(this.rootId)),
        lastValueFrom(this.projectsService.getProjectListByCompany(this.rootId)),
        lastValueFrom(this.incomesAndExpensesService.getIncomesAndExpenses(this.rootId)),
        lastValueFrom(this.branchsService.getBrancheswoa(this.rootId)),
        lastValueFrom(this.cuentasContablesService.getByNivel(this.rootId, 2)),
        lastValueFrom(this.rootService.getRoot())
      ]);

      const currentRoot = rootData as any;
      this.companyName = currentRoot?.name || currentRoot?.nameCompany || 'Empresa';
      this.proyectos = Array.isArray(proyectosData) ? proyectosData : [];
      this.empresas = Array.isArray(empresasData) ? empresasData : [];
      this.cuentasContablesNivel2 = Array.isArray(cuentasData) ? cuentasData : [];
      this.allRoots = Array.isArray(allRootsData) ? allRootsData : [];

      // Separar ingresos y egresos
      const allData = Array.isArray(incomesData) ? incomesData : [];
      this.ingresos = allData.filter(item => String(item?.type ?? '').toUpperCase() === 'DEPOSITO');
      this.egresos = allData.filter(item => String(item?.type ?? '').toUpperCase() === 'GASTO');

      // Obtener empresas del mismo corporativo
      const idCorporativo = currentRoot?.idCorporativo;
      if (idCorporativo) {
        this.empresasCorporativo = this.allRoots.filter(r => r.idCorporativo === idCorporativo && r.id !== this.rootId);
      } else {
        this.empresasCorporativo = [];
      }

      // Cargar transferencias del corporativo (para aportación de socios)
      await this.loadTransferenciasCorporativo();

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

    // Agrupar ingresos y egresos por proyecto
    const ingresosPorProyecto = new Map<number, { facturado: number; cobrado: number }>();
    const egresosPorProyecto = new Map<number, number>();

    // Procesar ingresos
    ingresosFiltered.forEach(ingreso => {
      const idProyecto = ingreso.idProject;
      if (!idProyecto) return;

      const current = ingresosPorProyecto.get(idProyecto) || { facturado: 0, cobrado: 0 };
      const subtotal = Number(ingreso.subtotal) || 0;

      // Facturado: todos los ingresos con fecha de factura
      if (ingreso.dateStamped) {
        current.facturado += subtotal;
      }

      // Cobrado: ingresos con estatus "Pagada"
      if (ingreso.status === 'Pagada') {
        current.cobrado += subtotal;
      }

      ingresosPorProyecto.set(idProyecto, current);
    });

    // Procesar egresos
    egresosFiltered.forEach(egreso => {
      const idProyecto = egreso.idProject;
      if (!idProyecto) return;

      const current = egresosPorProyecto.get(idProyecto) || 0;
      const subtotal = Number(egreso.subtotal) || 0;
      egresosPorProyecto.set(idProyecto, current + subtotal);
    });

    // Construir reporte por proyecto
    this.proyectosReporte = this.proyectos
      .filter(proyecto => {
        const idProyecto = proyecto.id;
        return ingresosPorProyecto.has(idProyecto) || egresosPorProyecto.has(idProyecto);
      })
      .map(proyecto => {
        const idProyecto = proyecto.id;
        const ingresos = ingresosPorProyecto.get(idProyecto) || { facturado: 0, cobrado: 0 };
        const erogado = egresosPorProyecto.get(idProyecto) || 0;

        // Obtener empresa del proyecto
        const empresa = this.empresas.find(e => e.id === proyecto.idBranch);
        const empresaNombre = empresa?.name || this.companyName;

        // Calcular métricas
        const montoContratado = Number(proyecto.budgetManagement) || ingresos.facturado;
        const montoFacturado = ingresos.facturado;
        const montoCobrado = ingresos.cobrado;
        const montoPendienteCobro = montoFacturado - montoCobrado;
        const margenBruto = montoCobrado - erogado;
        const retiroUtilidad = 0; // Se puede configurar según reglas de negocio
        const margenNeto = margenBruto - retiroUtilidad;
        const porcentaje = montoCobrado > 0 ? (margenNeto / montoCobrado) * 100 : 0;

        return {
          empresa: empresaNombre,
          proyecto: proyecto.name || proyecto.number || `Proyecto ${idProyecto}`,
          idProyecto: idProyecto,
          fechaInicio: this.formatDate(proyecto.programStart),
          fechaTermino: this.formatDate(proyecto.programEnd),
          montoContratado,
          montoFacturado,
          montoCobrado,
          montoPendienteCobro,
          montoErogado: erogado,
          margenBruto,
          retiroUtilidad,
          margenNeto,
          porcentaje
        };
      })
      .sort((a, b) => a.empresa.localeCompare(b.empresa));

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
    this.proyectosReporte.forEach(p => empresasSet.add(p.empresa));
    this.empresasColumnas = Array.from(empresasSet).sort();

    // Agrupar egresos por tipo de gasto (cuenta contable nivel 2) y empresa
    const inversionMap = new Map<string, { empresas: { [key: string]: number }; total: number }>();

    // Filtrar egresos que corresponden a inversión de activos (cuentas específicas)
    // Típicamente cuentas que empiezan con ciertos códigos como "1.2" o "ACTIVOS"
    const egresosInversion = this.egresos.filter(egreso => {
      const cuenta = this.cuentasContablesNivel2.find(c => c.id === egreso.idExpend);
      if (!cuenta) return false;
      // Filtrar cuentas de activo fijo o inversión
      const codigo = String(cuenta.codigo || '');
      return codigo.startsWith('1.2') ||
             codigo.startsWith('12') ||
             String(cuenta.nombre || '').toUpperCase().includes('ACTIVO') ||
             String(cuenta.nombre || '').toUpperCase().includes('EQUIPO') ||
             String(cuenta.nombre || '').toUpperCase().includes('VEHICULO') ||
             String(cuenta.nombre || '').toUpperCase().includes('COMPUTO') ||
             String(cuenta.nombre || '').toUpperCase().includes('SOFTWARE') ||
             String(cuenta.nombre || '').toUpperCase().includes('BIBLIOGRAFIA');
    });

    egresosInversion.forEach(egreso => {
      const cuenta = this.cuentasContablesNivel2.find(c => c.id === egreso.idExpend);
      const tipoEquipo = cuenta ? cuenta.nombre : 'SIN CLASIFICAR';
      const subtotal = Number(egreso.subtotal) || 0;

      // Obtener empresa del egreso via proyecto
      let empresaNombre = this.companyName;
      if (egreso.idProject) {
        const proyecto = this.proyectos.find(p => p.id === egreso.idProject);
        if (proyecto?.idBranch) {
          const empresa = this.empresas.find(e => e.id === proyecto.idBranch);
          empresaNombre = empresa?.name || this.companyName;
        }
      } else if (egreso.idBranch) {
        const empresa = this.empresas.find(e => e.id === egreso.idBranch);
        empresaNombre = empresa?.name || this.companyName;
      }

      const current = inversionMap.get(tipoEquipo) || {
        empresas: {},
        total: 0
      };

      current.empresas[empresaNombre] = (current.empresas[empresaNombre] || 0) + subtotal;
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
    // Filtrar transferencias por rango de fechas
    const recibidas = this.filterByDateRange(this.transferenciasRecibidas);
    const enviadas = this.filterByDateRange(this.transferenciasEnviadas);

    // Agrupar por socio (empresa origen para recibidas, empresa destino para enviadas)
    const sociosMap = new Map<number, {
      nombre: string;
      aportacionBanco: number;
      aportacionEfectivo: number;
      retornoInversion: number;
    }>();

    // Procesar transferencias RECIBIDAS (aportaciones de socios hacia nosotros)
    recibidas.forEach(trans => {
      const idSocio = trans._empresaOrigenId;
      if (!idSocio) return;

      const nombreSocio = trans._empresaOrigenName || `Empresa ${idSocio}`;
      const current = sociosMap.get(idSocio) || {
        nombre: nombreSocio,
        aportacionBanco: 0,
        aportacionEfectivo: 0,
        retornoInversion: 0
      };

      const monto = Number(trans.subtotal) || Number(trans.total) || 0;
      const formaPago = String(trans.formaPago || '').toLowerCase();

      // Clasificar por forma de pago: 03 = transferencia (banco), 01 = efectivo
      if (formaPago === '01' || formaPago.includes('efectivo')) {
        current.aportacionEfectivo += monto;
      } else {
        // Por defecto es banco (transferencia)
        current.aportacionBanco += monto;
      }

      sociosMap.set(idSocio, current);
    });

    // Procesar transferencias ENVIADAS (retorno de inversión hacia socios)
    enviadas.forEach(trans => {
      const idSocio = trans._empresaDestinoId;
      if (!idSocio) return;

      const nombreSocio = trans._empresaDestinoName || `Empresa ${idSocio}`;
      const current = sociosMap.get(idSocio) || {
        nombre: nombreSocio,
        aportacionBanco: 0,
        aportacionEfectivo: 0,
        retornoInversion: 0
      };

      const monto = Number(trans.subtotal) || Number(trans.total) || 0;
      current.retornoInversion += monto;

      sociosMap.set(idSocio, current);
    });

    // Convertir a array y calcular totales
    this.aportacionesSocios = Array.from(sociosMap.entries())
      .map(([idSocio, data]) => ({
        socio: data.nombre,
        idSocio: idSocio,
        aportacionBanco: data.aportacionBanco,
        aportacionEfectivo: data.aportacionEfectivo,
        retornoInversion: data.retornoInversion,
        totalUtilidad: data.aportacionBanco + data.aportacionEfectivo - data.retornoInversion
      }))
      .filter(s => s.aportacionBanco > 0 || s.aportacionEfectivo > 0 || s.retornoInversion > 0)
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
      const pdfMake = (await import('pdfmake/build/pdfmake')).default;
      const pdfFonts = (await import('pdfmake/build/vfs_fonts')).default;
      (pdfMake as any).vfs = (pdfFonts as any).pdfMake?.vfs || (pdfFonts as any).default?.pdfMake?.vfs;

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
        pageSize: 'LETTER',
        pageOrientation: 'landscape',
        pageMargins: [15, 60, 15, 30],
        header: () => this.buildPdfHeader(logoBase64),
        footer: (currentPage: number, pageCount: number) => ({
          text: `Página ${currentPage} de ${pageCount}`,
          alignment: 'center',
          fontSize: 7,
          margin: [0, 10, 0, 0]
        }),
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

      const pdf = pdfMake.createPdf(docDefinition);
      try {
        pdf.open();
      } catch {
        pdf.download(`reporte-ejecutivo-proyectos-${new Date().toISOString().split('T')[0]}.pdf`);
        alerts.basicAlert('Reporte descargado', 'El navegador bloqueó la ventana emergente. El reporte se descargó automáticamente.', 'info');
      }

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

    // Sección de Aportación de Socios
    if (this.aportacionesSocios.length > 0) {
      content.push({ text: 'APORTACIÓN SOCIOS', style: 'sectionTitle' });
      content.push(this.buildAportacionesTable());
    }

    // Sección de Inversión de Activos
    if (this.inversionActivos.length > 0) {
      content.push({ text: 'INVERSIÓN DE ACTIVOS', style: 'sectionTitle' });
      content.push(this.buildInversionTable());
    }

    return content;
  }

  private buildProyectosTable(): any {
    // Encabezados abreviados para caber en LETTER
    const headers = [
      'Empresa', 'Proyecto', 'FI', 'FT', 'Contratado', 'Facturado',
      'Cobrado', 'Pend. Cobro', 'Erogado', 'Margen Bruto',
      'Retiro Util.', 'Margen Neto', '%'
    ];

    const body: any[] = [
      headers.map(h => ({ text: h, style: 'tableHeader', alignment: 'center' }))
    ];

    this.proyectosReporte.forEach(p => {
      body.push([
        { text: p.empresa, style: 'tableCell' },
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
        widths: [50, 55, 38, 38, 52, 52, 52, 52, 52, 52, 48, 52, 22],
        body
      },
      layout: {
        hLineWidth: (i: number, node: any) => (i === 0 || i === 1 || i === node.table.body.length) ? 1 : 0.3,
        vLineWidth: () => 0.3,
        hLineColor: () => '#aaa',
        vLineColor: () => '#ccc',
        fillColor: (rowIndex: number) => rowIndex === 0 ? '#1a365d' : (rowIndex % 2 === 0 ? '#f8fafc' : null)
      }
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
      layout: {
        hLineWidth: (i: number, node: any) => (i === 0 || i === 1 || i === node.table.body.length) ? 1 : 0.3,
        vLineWidth: () => 0.3,
        hLineColor: () => '#aaa',
        vLineColor: () => '#ccc',
        fillColor: (rowIndex: number) => rowIndex === 0 ? '#1e40af' : (rowIndex % 2 === 0 ? '#f8fafc' : null)
      }
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
      layout: {
        hLineWidth: (i: number, node: any) => (i === 0 || i === 1 || i === node.table.body.length) ? 1 : 0.3,
        vLineWidth: () => 0.3,
        hLineColor: () => '#aaa',
        vLineColor: () => '#ccc',
        fillColor: (rowIndex: number) => rowIndex === 0 ? '#1a365d' : (rowIndex % 2 === 0 ? '#f8fafc' : null)
      }
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
        'Empresa', 'Proyecto', 'FI', 'FT', 'Monto Contratado', 'Monto Facturado',
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
        row.getCell(1).value = p.empresa;
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
