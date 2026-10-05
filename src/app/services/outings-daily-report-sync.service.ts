import { inject, Injectable } from '@angular/core';
import { catchError, firstValueFrom, of } from 'rxjs';
import { BranchsService } from './branchs.service';
import { DailyReportService } from './daily-report.service';
import { InandoutService } from './inandout.service';
import { LogbookService } from './logbook.service';
import { PermitionsService } from './permitions.service';
import { SignalsService } from './signals.service';
import { TrackingService } from './tracking.service';
import { WarehousesService } from './warehouses.service';

export interface OutingsDailyReportSyncResult {
  outings: number;
  materials: number;
  reportsCreated: number;
}

@Injectable({ providedIn: 'root' })
export class OutingsDailyReportSyncService {
  private branchesService = inject(BranchsService);
  private warehousesService = inject(WarehousesService);
  private permissionsService = inject(PermitionsService);
  private inandoutService = inject(InandoutService);
  private dailyReportService = inject(DailyReportService);
  private logbookService = inject(LogbookService);
  private signalsService = inject(SignalsService);
  private trackingService = inject(TrackingService);

  async syncProjectOutings(idRoot: number, idProject: number): Promise<OutingsDailyReportSyncResult> {
    const result: OutingsDailyReportSyncResult = { outings: 0, materials: 0, reportsCreated: 0 };
    const email = this.trackingService.getEmail();
    if (!idRoot || !idProject || !email) return result;

    const [permissionResponse, branchResponse] = await Promise.all([
      firstValueFrom(this.permissionsService.getPermisionswarehousexEmail(email).pipe(catchError(() => of([])))),
      firstValueFrom(this.branchesService.getBranches2fields(idRoot).pipe(catchError(() => of([])))),
    ]);
    const permittedIds = new Set((Array.isArray(permissionResponse) ? permissionResponse : [])
      .map((warehouse: any) => this.warehouseId(warehouse)).filter((id: number) => id > 0));
    const branches: any[] = Array.isArray(branchResponse) ? branchResponse : [];

    const warehouseGroups = await Promise.all(branches.map(async branch => {
      const response = await firstValueFrom(this.warehousesService.getWarehouses(Number(branch.id)).pipe(catchError(() => of([]))));
      return Array.isArray(response) ? response : [];
    }));
    const warehouseIds = [...new Set(warehouseGroups.flat()
      .map((warehouse: any) => this.warehouseId(warehouse))
      .filter((id: number) => id > 0 && permittedIds.has(id)))];
    if (!warehouseIds.length) return result;

    const outingGroups = await Promise.all(warehouseIds.map(async idWarehouse => {
      const response = await firstValueFrom(this.inandoutService
        .getInAndOuts(idProject, idWarehouse, 'OUT')
        .pipe(catchError(() => of([]))));
      return Array.isArray(response) ? response : [];
    }));
    const uniqueOutings = new Map<number, any>();
    outingGroups.flat().forEach((outing: any) => {
      const id = Number(outing?.id);
      if (id > 0 && (outing.idProject == null || Number(outing.idProject) === Number(idProject)) && outing.active !== false && outing.active !== 0) {
        uniqueOutings.set(id, outing);
      }
    });
    if (!uniqueOutings.size) return result;

    const detailsByOuting = await Promise.all([...uniqueOutings.values()].map(async outing => {
      const response = await firstValueFrom(this.inandoutService.getInAndOutItems(Number(outing.id)).pipe(catchError(() => of([]))));
      const details: any[] = Array.isArray(response) ? response : [];
      return {
        outing,
        items: details.filter(item => item?.active !== false && item?.active !== 0 && Number(item?.quantity) > 0),
      };
    }));

    const byDate = new Map<string, Array<{ outing: any; items: any[] }>>();
    detailsByOuting.forEach(group => {
      if (!group.items.length) return;
      const date = this.dateOnly(group.outing.date || group.outing.deliveryDate);
      const dated = byDate.get(date) || [];
      dated.push(group);
      byDate.set(date, dated);
    });

    let reports: any[] = await this.getReports(idProject);
    for (const [date, outings] of byDate) {
      let report = reports.find(candidate =>
        candidate?.active !== false && this.dateOnly(candidate.date) === date
      );
      if (!report) {
        report = await this.createDailyReport(idProject, date, outings[0].outing, reports.length + 1);
        reports.push(report);
        result.reportsCreated++;
      }
      const idReport = Number(report?.id);
      if (!idReport) continue;

      const response = await firstValueFrom(this.logbookService.getInfoByReporte(idReport, 'MATERIAL'));
      const logbookRows: any[] = response?.success === false ? [] : (response?.data || []);
      const grouped = this.groupMaterialSources(outings);
      let newRows = 0;
      let dateMaterials = 0;

      for (const group of grouped.values()) {
        const existing = logbookRows.find(row => group.idResource
          ? Number(row.idResource) === group.idResource
          : String(row.description || '').trim().toLowerCase() === group.description.trim().toLowerCase());
        const existingNote = String(existing?.supervisor || '');
        const existingReferences = new Set(existingNote.split('|').map(reference => reference.trim()));
        const missingSources = group.sources.filter(source => !existingReferences.has(source.reference));
        if (!missingSources.length) continue;

        const note = [...new Set([
          existingNote,
          ...missingSources.map(source => source.reference),
        ].filter(Boolean))].join(' | ');
        const payload = {
          idReporte: idReport,
          idProject,
          typeNote: 'MATERIAL',
          date,
          orden: existing?.orden || logbookRows.length + newRows + 1,
          quantity: Number(existing?.quantity || 0) + missingSources.reduce((sum, source) => sum + source.quantity, 0),
          description: existing?.description || group.description,
          supervisor: note,
          position: existing?.position || group.measure || null,
          idResource: group.idResource || null,
        };

        if (existing?.id) {
          await firstValueFrom(this.logbookService.updateDataForOt(Number(existing.id), payload));
          Object.assign(existing, payload);
        } else {
          const added = await firstValueFrom(this.logbookService.addDataForOt(payload));
          logbookRows.push({ ...payload, id: added?.id ?? added?.data?.id });
          newRows++;
        }
        result.materials += missingSources.length;
        dateMaterials += missingSources.length;
      }

      if (dateMaterials > 0 || newRows > 0) {
        await firstValueFrom(this.dailyReportService.updateBitacoraCount(idReport, 'MATERIAL', logbookRows.length));
      }
    }

    result.outings = uniqueOutings.size;
    if (result.materials > 0) {
      this.trackingService.addLog(
        this.trackingService.getnameComp(),
        `Sincronizó ${result.materials} material(es) de salidas existentes al Reporte diario del proyecto ${idProject}`,
        'Almacenes / Reporte diario',
        this.trackingService.getEmail()
      );
    }
    return result;
  }

  private async getReports(idProject: number): Promise<any[]> {
    const response = await firstValueFrom(this.dailyReportService.getDailyReportsByProject(idProject));
    return Array.isArray(response) ? response : (response?.data || []);
  }

  private async createDailyReport(idProject: number, date: string, outing: any, sequence: number): Promise<any> {
    const projectNumber = this.signalsService.getProjectNumberBySidebar()();
    const created = await firstValueFrom(this.dailyReportService.addDailyReport({
      idOt: outing?.idOt || null,
      idProject,
      date,
      startTime: '07:52:00',
      endTime: '17:02:00',
      type: 'CORTE',
      description: `Creado automáticamente desde salida ${outing?.folio || `#${outing?.id}`}`,
      idConvention: this.signalsService.getConventionVigente()()?.id ?? null,
      numReporte: projectNumber ? `${projectNumber}-${String(sequence).padStart(3, '0')}` : String(sequence).padStart(3, '0'),
      totalPay: 0,
      close: false,
      paid: true,
      tiempos: 0,
      personal: 0,
      fotos: 0,
      videos: 0,
      material: 0,
      equipos: 0,
      conceptos: 0,
      notas: 0,
      active: true,
    }));
    let report = created?.data || created;
    if (!report?.id) {
      const refreshed = await this.getReports(idProject);
      report = refreshed.find(item => this.dateOnly(item.date) === date);
    }
    if (!report?.id) throw new Error(`No se pudo recuperar el reporte diario para ${date}.`);
    return report;
  }

  private groupMaterialSources(outings: Array<{ outing: any; items: any[] }>): Map<string, any> {
    const grouped = new Map<string, any>();
    outings.forEach(({ outing, items }) => {
      const reference = `Salida ${outing?.folio || `#${outing?.id}`}`;
      items.forEach(item => {
        const idResource = Number(item?.idProduct || 0) || null;
        const description = String(item?.description || item?.materialName || `Material #${idResource || ''}`).trim();
        const key = idResource ? `id:${idResource}` : `description:${description.toLowerCase()}`;
        const group = grouped.get(key) || {
          idResource,
          description,
          measure: item?.measure || item?.unit || '',
          sources: [],
        };
        group.sources.push({ reference, quantity: Number(item.quantity) || 0 });
        grouped.set(key, group);
      });
    });
    return grouped;
  }

  private warehouseId(warehouse: any): number {
    return Number(warehouse?.idAlmacen ?? warehouse?.idWarehouse ?? warehouse?.warehouseId ?? warehouse?.id ?? 0);
  }

  private dateOnly(value: any): string {
    const raw = String(value || '').trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.substring(0, 10);
    const parsed = new Date(value || Date.now());
    return isNaN(parsed.getTime()) ? new Date().toISOString().substring(0, 10) : parsed.toISOString().substring(0, 10);
  }
}
