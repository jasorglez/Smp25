import { CommonModule } from '@angular/common';
import { Component, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { alerts } from 'app/helpers/alerts';
import { FollowprojectsService } from 'app/services/followprojects.service';
import { IncomesAndExpensesService } from 'app/services/incomes-and-expenses.service';
import { ProjectsService } from 'app/services/projects.service';
import { SignalsService } from 'app/services/signals.service';
import { forkJoin } from 'rxjs';

interface OperativeReportRow {
  empresa: string;
  proyecto: string;
  fi: string;
  ft: string;
  montoContratado: number;
  montoFacturado: number;
  montoCobrado: number;
  montoPendienteCobro: number;
  montoErogado: number;
  margenBruto: number;
  retiroUtilidadSocial: number;
  margenNeto: number;
  porcentaje: number;
}

interface AssetInvestmentRow {
  activo: string;
  valoresPorEmpresa: Record<string, number>;
  total: number;
}

@Component({
  selector: 'app-reporte-operativo-sin-iva',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reporte-operativo-sin-iva.component.html',
  styleUrl: './reporte-operativo-sin-iva.component.scss'
})
export class ReporteOperativoSinIvaComponent {
  private signalsService = inject(SignalsService);
  private incomesAndExpensesService = inject(IncomesAndExpensesService);
  private projectsService = inject(ProjectsService);
  private followprojectsService = inject(FollowprojectsService);

  public rootId: number;
  public startDate: string = '';
  public endDate: string = '';
  public isLoading = false;
  public today = new Date();

  private projectMap = new Map<number, any>();
  private contractAmountById = new Map<number, number>();
  private ingresosData: any[] = [];
  private egresosData: any[] = [];

  public rows: OperativeReportRow[] = [];
  public totals: OperativeReportRow = this.createEmptyTotals();
  public companyColumns: string[] = [];
  public assetRows: AssetInvestmentRow[] = [];
  public assetTotals: Record<string, number> = {};
  public totalActivos = 0;

  constructor() {
    const today = new Date();
    const yearStart = new Date(today.getFullYear(), 0, 1);
    this.startDate = yearStart.toISOString().split('T')[0];
    this.endDate = today.toISOString().split('T')[0];

    effect(() => {
      this.rootId = this.signalsService.getRootSelectedBySidebar()();
      if (this.rootId) {
        this.loadData(this.rootId);
      }
    }, { allowSignalWrites: true });
  }

  public onFilterChange(): void {
    this.buildReport();
  }

  private loadData(rootId: number): void {
    this.isLoading = true;

    forkJoin({
      movements: this.incomesAndExpensesService.getIncomesAndExpenses(rootId),
      projects: this.projectsService.getProjectListByCompany(rootId),
      contracts: this.followprojectsService.getContractsByRoot(rootId)
    }).subscribe({
      next: ({ movements, projects, contracts }) => {
        const allMovements = Array.isArray(movements) ? movements : [];
        const allProjects = Array.isArray(projects) ? projects : [];
        const allContracts = Array.isArray(contracts) ? contracts : [];

        this.ingresosData = allMovements.filter(item => String(item?.type ?? '').toUpperCase() === 'DEPOSITO');
        this.egresosData = allMovements.filter(item => String(item?.type ?? '').toUpperCase() === 'GASTO');

        this.projectMap = new Map(
          allProjects
            .filter((project: any) => Number.isFinite(Number(project?.id)) && Number(project.id) > 0)
            .map((project: any) => [Number(project.id), project])
        );

        this.contractAmountById = new Map(
          allContracts
            .map((contract: any) => {
              const id = Number(contract?.id ?? contract?.idContrato);
              const amount = Number(contract?.amountMx ?? 0);
              return [id, Number.isFinite(amount) ? amount : 0] as [number, number];
            })
            .filter(([id]) => Number.isFinite(id) && id > 0)
        );

        this.buildReport();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error cargando reporte operativo sin IVA:', error);
        this.isLoading = false;
        alerts.basicAlert('Error', 'No fue posible cargar el reporte operativo.', 'error');
      }
    });
  }

  private buildReport(): void {
    const ingresos = this.filterByDateRange(this.ingresosData, true);
    const egresos = this.filterByDateRange(this.egresosData, false);
    const rowsByProject = new Map<string, OperativeReportRow>();

    const getOrCreateRow = (projectId: number | null): OperativeReportRow => {
      const key = projectId ? String(projectId) : 'SIN_PROYECTO';
      if (rowsByProject.has(key)) {
        return rowsByProject.get(key)!;
      }

      const project = projectId ? this.projectMap.get(projectId) : null;
      const contractId = Number(project?.idContrato);
      const montoContratado = Number.isFinite(this.contractAmountById.get(contractId))
        ? Number(this.contractAmountById.get(contractId))
        : 0;

      const row: OperativeReportRow = {
        empresa: String(project?.company ?? project?.empresa ?? 'SIN EMPRESA').toUpperCase(),
        proyecto: String(project?.name ?? project?.number ?? 'SIN PROYECTO').toUpperCase(),
        fi: this.formatDateForView(project?.programStart ?? project?.fi ?? project?.startDate),
        ft: this.formatDateForView(project?.programEnd ?? project?.ft ?? project?.endDate),
        montoContratado,
        montoFacturado: 0,
        montoCobrado: 0,
        montoPendienteCobro: 0,
        montoErogado: 0,
        margenBruto: 0,
        retiroUtilidadSocial: 0,
        margenNeto: 0,
        porcentaje: 0
      };

      rowsByProject.set(key, row);
      return row;
    };

    ingresos.forEach(item => {
      const projectId = this.getProjectId(item);
      const row = getOrCreateRow(projectId);
      const total = this.getMonto(item);
      row.montoFacturado += total;
      if (this.isCollectedIncome(item)) {
        row.montoCobrado += total;
      }
      row.retiroUtilidadSocial += this.getRetiroUtilidad(item);
    });

    egresos.forEach(item => {
      const projectId = this.getProjectId(item);
      const row = getOrCreateRow(projectId);
      row.montoErogado += this.getMonto(item);
      row.retiroUtilidadSocial += this.getRetiroUtilidad(item);
    });

    this.rows = Array.from(rowsByProject.values())
      .map(row => {
        const montoContratado = row.montoContratado > 0 ? row.montoContratado : row.montoFacturado;
        const montoPendienteCobro = Math.max(0, row.montoFacturado - row.montoCobrado);
        const margenBruto = row.montoCobrado - row.montoErogado;
        const margenNeto = margenBruto - row.retiroUtilidadSocial;
        const porcentaje = row.montoCobrado > 0 ? (margenNeto / row.montoCobrado) * 100 : 0;
        return {
          ...row,
          montoContratado,
          montoPendienteCobro,
          margenBruto,
          margenNeto,
          porcentaje
        };
      })
      .sort((a, b) => `${a.empresa}-${a.proyecto}`.localeCompare(`${b.empresa}-${b.proyecto}`, 'es'));

    this.totals = this.rows.reduce((acc, row) => ({
      empresa: '',
      proyecto: '',
      fi: '',
      ft: '',
      montoContratado: acc.montoContratado + row.montoContratado,
      montoFacturado: acc.montoFacturado + row.montoFacturado,
      montoCobrado: acc.montoCobrado + row.montoCobrado,
      montoPendienteCobro: acc.montoPendienteCobro + row.montoPendienteCobro,
      montoErogado: acc.montoErogado + row.montoErogado,
      margenBruto: acc.margenBruto + row.margenBruto,
      retiroUtilidadSocial: acc.retiroUtilidadSocial + row.retiroUtilidadSocial,
      margenNeto: acc.margenNeto + row.margenNeto,
      porcentaje: 0
    }), this.createEmptyTotals());

    this.totals.porcentaje = this.totals.montoCobrado > 0
      ? (this.totals.margenNeto / this.totals.montoCobrado) * 100
      : 0;

    this.buildAssetInvestmentTable(egresos);
  }

  private buildAssetInvestmentTable(egresos: any[]): void {
    const categories = ['BIBLIOGRAFIA', 'EQ. COMPUTO', 'EQ. ESPECIAL', 'SOFWARE', 'VEHICULOS'];
    const companySet = new Set<string>(this.rows.map(row => row.empresa).filter(Boolean));

    egresos.forEach(item => {
      const projectId = this.getProjectId(item);
      const project = projectId ? this.projectMap.get(projectId) : null;
      const company = String(project?.company ?? project?.empresa ?? 'SIN EMPRESA').toUpperCase();
      companySet.add(company);
    });

    this.companyColumns = Array.from(companySet).filter(Boolean).sort((a, b) => a.localeCompare(b, 'es'));
    if (this.companyColumns.length === 0) {
      this.companyColumns = ['GENERAL'];
    }

    const rowMap = new Map<string, AssetInvestmentRow>();
    categories.forEach(category => {
      const valoresPorEmpresa: Record<string, number> = {};
      this.companyColumns.forEach(company => valoresPorEmpresa[company] = 0);
      rowMap.set(category, {
        activo: category,
        valoresPorEmpresa,
        total: 0
      });
    });

    egresos.forEach(item => {
      const category = this.getAssetCategory(item);
      if (!category || !rowMap.has(category)) return;

      const projectId = this.getProjectId(item);
      const project = projectId ? this.projectMap.get(projectId) : null;
      const company = String(project?.company ?? project?.empresa ?? 'SIN EMPRESA').toUpperCase();

      if (!this.companyColumns.includes(company)) return;
      const row = rowMap.get(category)!;
      row.valoresPorEmpresa[company] += this.getMonto(item);
      row.total += this.getMonto(item);
    });

    this.assetRows = Array.from(rowMap.values());
    this.assetTotals = {};
    this.companyColumns.forEach(company => {
      this.assetTotals[company] = this.assetRows.reduce((sum, row) => sum + (row.valoresPorEmpresa[company] || 0), 0);
    });
    this.totalActivos = this.assetRows.reduce((sum, row) => sum + row.total, 0);
  }

  private createEmptyTotals(): OperativeReportRow {
    return {
      empresa: '',
      proyecto: '',
      fi: '',
      ft: '',
      montoContratado: 0,
      montoFacturado: 0,
      montoCobrado: 0,
      montoPendienteCobro: 0,
      montoErogado: 0,
      margenBruto: 0,
      retiroUtilidadSocial: 0,
      margenNeto: 0,
      porcentaje: 0
    };
  }

  private getProjectId(item: any): number | null {
    const candidates = [item?.idProject, item?.id_project, item?.projectId, item?.idProyecto];
    for (const candidate of candidates) {
      const value = Number(candidate);
      if (Number.isFinite(value) && value > 0) return value;
    }
    return null;
  }

  private getRetiroUtilidad(item: any): number {
    const candidates = [item?.retiroUtilidad, item?.withdrawal, item?.socialWithdrawal, item?.retiro];
    for (const candidate of candidates) {
      const value = Number(candidate);
      if (Number.isFinite(value) && value > 0) return value;
    }
    return 0;
  }

  private getAssetCategory(item: any): string | null {
    const text = String(
      item?.description ??
      item?.expenseTypeText ??
      item?.tipoGastoTexto ??
      item?.tipoGasto ??
      ''
    ).toUpperCase();

    if (text.includes('BIBLIO') || text.includes('LIBRO')) return 'BIBLIOGRAFIA';
    if (text.includes('COMPUTO') || text.includes('COMPUT') || text.includes('LAPTOP') || text.includes('IMPRESORA')) return 'EQ. COMPUTO';
    if (text.includes('ESPECIAL')) return 'EQ. ESPECIAL';
    if (text.includes('SOFTWARE') || text.includes('LICENCIA') || text.includes('SUSCRIPCION')) return 'SOFWARE';
    if (text.includes('VEHIC') || text.includes('CAMION') || text.includes('AUTO') || text.includes('TRANSPORTE')) return 'VEHICULOS';
    return null;
  }

  private isCollectedIncome(item: any): boolean {
    const status = String(item?.status ?? '').toUpperCase();
    return ['PAGADA', 'ENTREGADA', 'COBRADA', 'APLICADA', 'COMPLETADA'].includes(status);
  }

  private filterByDateRange(data: any[], usePaymentDate: boolean): any[] {
    if (!this.startDate || !this.endDate) return data;
    const start = this.parseDateValue(this.startDate);
    const end = this.parseDateValue(this.endDate);
    if (!start || !end) return data;
    end.setHours(23, 59, 59, 999);

    return data.filter(item => {
      const itemDate = this.getItemDate(item, usePaymentDate);
      if (!itemDate) return false;
      return itemDate >= start && itemDate <= end;
    });
  }

  private getItemDate(item: any, usePaymentDate: boolean): Date | null {
    const rawDate = usePaymentDate
      ? (item?.date ?? item?.paymentDate ?? item?.fechaPago ?? item?.dateStamped ?? item?.datestamped)
      : (item?.date ?? item?.dateexpend ?? item?.dateStamped ?? item?.datestamped ?? item?.fecha);
    return this.parseDateValue(rawDate);
  }

  private parseDateValue(value: any): Date | null {
    if (!value) return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

    const asString = String(value).trim();
    if (!asString) return null;

    const directDate = new Date(asString);
    if (!Number.isNaN(directDate.getTime())) return directDate;

    const ddmmyyyy = asString.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
    if (ddmmyyyy) {
      const day = Number(ddmmyyyy[1]);
      const month = Number(ddmmyyyy[2]);
      const year = Number(ddmmyyyy[3]);
      const parsed = new Date(year, month - 1, day);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    return null;
  }

  private getMonto(item: any): number {
    const total = Number(item?.total);
    return Number.isFinite(total) ? total : 0;
  }

  private formatDateForView(value: any): string {
    const date = this.parseDateValue(value);
    if (!date) return '-';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }
}
