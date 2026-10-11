import { Injectable, inject } from '@angular/core';
import { firstValueFrom, Observable, timeout } from 'rxjs';
import { environment } from '@env/environment';
import { AuthService } from './auth.service';
import { ContractsService } from './contracts.service';
import { IncomesAndExpensesService } from './incomes-and-expenses.service';
import { InventarioWarehouseService } from './inventario-warehouse.service';
import { OcAndReqsService } from './ocandreqs.service';
import { ProjectsService } from './projects.service';
import { SignalsService } from './signals.service';
import { SetupService } from './setup.service';
import { WorkprogramsService } from './workprograms.service';
import { convertDashboardAmount } from 'app/pages/dashboard-home/components/dashboard-currency';
import { DASHBOARD_CATALOG, DashboardContext, DashboardDataset, DashboardPlan, DashboardResult, DashboardSource, aggregateDashboard, inDashboardPeriod, numericValue, validateDashboardPlan } from './dashboard-ai.model';

@Injectable({ providedIn: 'root' })
export class DashboardAiService {
  private readonly auth = inject(AuthService);
  private readonly signals = inject(SignalsService);
  private readonly projects = inject(ProjectsService);
  private readonly contracts = inject(ContractsService);
  private readonly programs = inject(WorkprogramsService);
  private readonly finances = inject(IncomesAndExpensesService);
  private readonly inventory = inject(InventarioWarehouseService);
  private readonly orders = inject(OcAndReqsService);
  private readonly setup = inject(SetupService);

  async createPlan(prompt: string, previous: DashboardPlan | null, signal: AbortSignal): Promise<DashboardPlan> {
    let response: Response;
    try {
      response = await fetch(`${environment.urlChatBot}/DashboardAi/plan`, {
        method: 'POST', signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
        body: JSON.stringify({ prompt: prompt.slice(0, 4000), previous }),
      });
    } catch (error: any) {
      if (signal.aborted) throw error;
      throw new Error('No fue posible conectar con el servicio de IA. Revisa tu conexión e intenta nuevamente.');
    }
    if (response.status === 401) throw new Error('Tu sesión expiró. Inicia sesión nuevamente.');
    if (response.status === 404) throw new Error('El endpoint de IA aún no está publicado en ChatbotTelegram. Es necesario desplegar los cambios del backend.');
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(body?.message || `El servicio de IA no pudo generar el dashboard (HTTP ${response.status}).`);
    return validateDashboardPlan(body);
  }

  async load(plan: DashboardPlan, context: DashboardContext): Promise<DashboardResult[]> {
    if (!context.company || !context.user || !localStorage.getItem('token')) throw new Error('Selecciona una empresa y verifica que tu sesión esté activa.');
    let permissions: any;
    if (context.branch && this.signals.getIsAdvanced()) {
      permissions = await this.read(this.auth.fetchUserPermissionsAdvanced(context.user, context.branch));
      if (!permissions?.permissions || !Object.keys(permissions.permissions).length) permissions = await this.read(this.auth.fetchUserPermissions(context.user));
    } else permissions = await this.read(this.auth.fetchUserPermissions(context.user));
    const sources = [...new Set(plan.widgets.map(widget => widget.source))];
    const datasets = new Map<DashboardSource, DashboardDataset>();
    // Una petición por fuente, aunque haya varios indicadores sobre ella.
    const financeSources = sources.filter(source => ['incomes', 'expenses'].includes(source));
    const financeAllowed = permissions?.permissions?.administration?.active === true;
    const financialData = financeSources.length && financeAllowed
      ? this.read(this.finances.getIncomesAndExpenses(context.company)).then(data => ({ data, error: null })).catch(error => ({ data: [], error }))
      : Promise.resolve({ data: [], error: null });
    await Promise.all(sources.map(async source => {
      try {
        if (permissions?.permissions?.[DASHBOARD_CATALOG[source].module]?.active !== true) throw new Error('No tienes permiso para consultar esta área.');
        let dataset: DashboardDataset;
        if (source === 'projects') dataset = await this.loadProjects(context);
        else if (source === 'orders') dataset = await this.loadOrders(context);
        else if (source === 'inventory') dataset = await this.loadInventory(context);
        else {
          const result = await financialData;
          if (result.error) throw result.error;
          dataset = this.loadFinances(source, this.array(result.data), context);
        }
        datasets.set(source, dataset);
      } catch (error: any) {
        const message = error?.status === 401 ? 'Tu sesión expiró. Inicia sesión nuevamente.' : error?.status === 403 ? 'No tienes permiso para consultar estos datos.' : error?.status ? `No se pudo consultar la fuente (HTTP ${error.status}).` : error?.message || 'No se pudo consultar la fuente.';
        datasets.set(source, { rows: [], notes: [], error: message });
      }
    }));
    return plan.widgets.map(widget => aggregateDashboard(widget, datasets.get(widget.source)!));
  }

  private loadFinances(source: 'incomes' | 'expenses', data: any[], context: DashboardContext): DashboardDataset {
    const type = source === 'incomes' ? 'DEPOSITO' : 'GASTO';
    const records = data.filter(row => Number(row.idBusinnes) === context.company && row.type === type && row.active !== false &&
      (!context.project || Number(row.idProject) === context.project) && (!context.branch || Number(row.idBranch) === context.branch) && inDashboardPeriod(row.date, context));
    // La fuente son documentos padre, no conceptos: evita duplicar el importe.
    const unique = [...new Map(records.map(row => [row.id, row])).values()];
    return { rows: unique.map(row => ({
      id: row.id, name: row.description || row.numberDocument || `Documento ${row.id}`, state: row.status || 'Sin estado', month: String(row.date).slice(0, 7),
      amount: numericValue(row.totalMxn) ?? (numericValue(row.total) === null || !row.moneda ? null : convertDashboardAmount(row.total, row.moneda, row.tipoCambio)),
    })), notes: [`Fuente: documentos ${type}. Periodo ${context.from} a ${context.to}. Importes convertidos con el tipo de cambio capturado; sin tasa de cambio estimada.`] };
  }

  private async loadProjects(context: DashboardContext): Promise<DashboardDataset> {
    const [projectsData, accessData, contractsData] = await Promise.all([
      this.read(this.projects.getProjectListByCompany(context.company)),
      this.read(this.projects.getProjectsByContract(context.user)),
      context.branch ? this.read(this.contracts.getContractsByBranch(context.user, context.branch)) : Promise.resolve([]),
    ]);
    const permitted = new Set(this.array(accessData).map(row => Number(row.idProject)));
    const contracts = new Set(this.array(contractsData).map(row => Number(row.idContract ?? row.id)));
    const projects = this.array(projectsData).filter(row => permitted.has(Number(row.id)) && (!context.project || Number(row.id) === context.project) && (!context.branch || contracts.has(Number(row.idContrato))));
    const rows: DashboardDataset['rows'] = [];
    // Limita las peticiones simultáneas sin truncar el portafolio.
    for (let index = 0; index < projects.length; index += 5) {
      await Promise.all(projects.slice(index, index + 5).map(async project => {
        let progress: number | null = null, planned: number | null = null;
        try {
          const tasks = this.array(await this.read(this.programs.getWorkPrograms(Number(project.id), 'Project')))
            .filter(task => task.active !== 0 && task.active !== false && String(task.typeActivity).toUpperCase() === 'ACTIVITY');
          const weighted = tasks.some(task => Number(task.ponderado) > 0);
          const weights = tasks.map(task => weighted ? Math.max(0, numericValue(task.ponderado) ?? 0) : 1);
          const total = weights.reduce((sum, weight) => sum + weight, 0);
          if (total > 0) {
            const actualValues = tasks.map(task => numericValue(task.progress));
            if (actualValues.every((value, i) => weights[i] === 0 || value !== null)) progress = tasks.reduce((sum, task, i) => sum + weights[i] * Math.min(1, Math.max(0, actualValues[i] ?? 0)), 0) / total * 100;
            const fractions = tasks.map(task => {
              const start = Date.parse(task.startDate), end = Date.parse(task.endDate);
              if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
              return Date.now() >= end ? 1 : Date.now() <= start ? 0 : (Date.now() - start) / (end - start);
            });
            if (fractions.every((value, i) => weights[i] === 0 || value !== null)) planned = fractions.reduce((sum, value, i) => sum + weights[i] * (value ?? 0), 0) / total * 100;
          }
        } catch { /* El proyecto permanece visible; el avance no disponible es null. */ }
        rows.push({ id: project.id, name: project.name || project.number || `Proyecto ${project.id}`, state: project.state || 'Sin estado', month: '', progress, planned });
      }));
    }
    return { rows, notes: ['Estado actual: el periodo no limita este indicador. Avance real = promedio ponderado de progress × 100; si no hay ponderaciones se asigna igual peso a las actividades. Planeado = proporción de tiempo transcurrido entre fechas. Los indicadores globales promedian los proyectos.'] };
  }

  private async loadOrders(context: DashboardContext): Promise<DashboardDataset> {
    const setup = this.array(await this.read(this.setup.getWarehouseSetup(context.company)))[0];
    if (!setup) throw new Error('No hay configuración de almacenes para la empresa.');
    const byProject = [true, 1, '1', 'true'].includes(setup.projectOrBranch);
    const reference = byProject ? context.project : context.branch;
    if (!reference) throw new Error(`Selecciona ${byProject ? 'un proyecto' : 'una sucursal'} para consultar las órdenes de compra.`);
    if (!byProject && context.project) throw new Error('Las compras están configuradas por sucursal; quita el filtro de proyecto para consultar esta fuente.');
    const records = this.array(await this.read(this.orders.getOcAndReqs(byProject ? 'project' : 'branch', reference, 'OC')))
      .filter(row => Number(row.idRoot) === context.company && Number(row.idReference) === reference && row.typeReference === (byProject ? 'project' : 'branch') && inDashboardPeriod(row.dateCreate, context));
    return { rows: records.map(row => ({ id: row.id, name: row.folio || `OC ${row.id}`, state: row.close === true ? 'Cerrada' : row.close === false ? 'Abierta' : 'Sin estado', month: String(row.dateCreate).slice(0, 7) })), notes: [`Órdenes creadas entre ${context.from} y ${context.to}. Abierta/cerrada corresponde al campo de cierre, no a la fecha de entrega.`] };
  }

  private async loadInventory(context: DashboardContext): Promise<DashboardDataset> {
    if (context.branch || context.project) throw new Error('Esta fuente de inventario solo tiene datos por empresa. No permite aplicar los filtros de sucursal o proyecto seleccionados.');
    const records = this.array(await this.read(this.inventory.getInventario(context.company))).filter(row => Number(row.idCompany) === context.company);
    return { rows: records.map(row => ({ id: row.id, name: row.description || row.insumo || `Material ${row.id}`, state: row.estadoStock || 'Sin estado', month: '', amount: numericValue(row.total) })), notes: ['Inventario actual de toda la empresa. No es un corte histórico del periodo. Valor reportado por el ERP en moneda nacional.'] };
  }

  private read<T>(request: Observable<T>): Promise<T> { return firstValueFrom(request.pipe(timeout(30000))); }
  private array(value: any): any[] {
    if (Array.isArray(value)) return value;
    if (Array.isArray(value?.data)) return value.data;
    throw new Error('La fuente devolvió un formato de datos inesperado.');
  }
}
