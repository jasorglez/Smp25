import { inject, Injectable } from '@angular/core';
import { catchError, from, map, mergeMap, Observable, of, toArray } from 'rxjs';
import { DailyReportService } from './daily-report.service';
import { LogbookService } from './logbook.service';
import { ProjectsService } from './projects.service';

@Injectable({ providedIn: 'root' })
export class DailyReportBitacoraUsageService {
  private projectsService = inject(ProjectsService);
  private dailyReportService = inject(DailyReportService);
  private logbookService = inject(LogbookService);

  getResourceKeys(companyId: number, typeNote: 'EQUIPMENT' | 'PERSONAL'): Observable<Set<string>> {
    return this.projectsService.getProjectListByCompany(companyId).pipe(
      map((response: any) => this.asArray(response)),
      catchError(() => of([] as any[])),
      mergeMap(projects => from(projects).pipe(
        mergeMap((project: any) => this.dailyReportService.getDailyReportsByProject(Number(project.id)).pipe(
          map((response: any) => this.asArray(response).filter(report => this.isActive(report))),
          catchError(() => of([] as any[]))
        ), 6),
        toArray(),
        map(reportGroups => reportGroups.flat())
      )),
      mergeMap(reports => from(reports).pipe(
        mergeMap((report: any) => this.logbookService.getInfoByReporte(Number(report.id), typeNote).pipe(
          map((response: any) => this.asArray(response).filter(row => this.isActive(row))),
          catchError(() => of([] as any[]))
        ), 8),
        toArray(),
        map(logbookGroups => this.toResourceKeys(logbookGroups.flat(), typeNote))
      ))
    );
  }

  private asArray(response: any): any[] {
    const payload = response?.data ?? response?.items ?? response?.result ?? response;
    return Array.isArray(payload) ? payload : [];
  }

  private isActive(record: any): boolean {
    return record?.active !== false && !(record?.active != null && Number(record.active) === 0);
  }

  private toResourceKeys(rows: any[], typeNote: 'EQUIPMENT' | 'PERSONAL'): Set<string> {
    const keys = new Set<string>();
    rows.forEach(row => {
      if (typeNote === 'EQUIPMENT') {
        const id = String(row?.idResource ?? row?.idEquipment ?? '').trim();
        if (id) keys.add(`id:${id}`);
        return;
      }

      const position = String(row?.position ?? '').trim().toLocaleLowerCase();
      if (position) keys.add(`position:${position.normalize('NFD').replace(/[\u0300-\u036f]/g, '')}`);
    });
    return keys;
  }
}
