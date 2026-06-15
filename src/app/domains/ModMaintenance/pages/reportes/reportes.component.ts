import { Component, OnInit, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as XLSX from 'xlsx';
import pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';
(pdfMake as any).vfs = (pdfFonts as any).pdfMake?.vfs || (pdfFonts as any).default?.pdfMake?.vfs;
import { alerts } from 'app/helpers/alerts';
import { EquipmentService } from 'app/services/equipment.service';
import { SignalsService } from 'app/services/signals.service';
import { WorkorderService } from 'app/services/workorder.service';
import { TrackingService } from 'app/services/tracking.service';
import { RootService } from 'app/services/root.service';
import { Base64EncodeService } from 'app/services/base64encode.service';
import { forkJoin, lastValueFrom } from 'rxjs';

interface Report {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
}

@Component({
  selector: 'app-reportes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reportes.component.html',
  styleUrl: './reportes.component.scss'
})
export class ReportesComponent implements OnInit {
  private equipmentService = inject(EquipmentService);
  private signalsService = inject(SignalsService);
  private workorderService = inject(WorkorderService);
  private trackingService = inject(TrackingService);
  private rootService = inject(RootService);
  private base64Service = inject(Base64EncodeService);

  idcompany: number = 0;
  idBranch: number = 0;
  exportingReportId: string | null = null;
  exportingFormat: string | null = null;
  selectedFormatByReport: Record<string, string> = {};

  reports: Report[] = [
    {
      id: 'REP-001',
      name: 'Informe de Activos',
      description: 'Catálogo completo de activos con estado y ubicación',
      icon: 'bi bi-gear-fill',
      category: 'Activos'
    },
    {
      id: 'REP-002',
      name: 'Órdenes de Trabajo',
      description: 'Historial completo de órdenes de trabajo por período',
      icon: 'bi bi-clipboard-check',
      category: 'Mantenimiento'
    },
    {
      id: 'REP-003',
      name: 'Costos de Mantenimiento',
      description: 'Análisis de costos por tipo de mantenimiento y período',
      icon: 'bi bi-currency-dollar',
      category: 'Financiero'
    },
    {
      id: 'REP-004',
      name: 'Disponibilidad de Equipos',
      description: 'Tiempo de actividad y downtime por equipo',
      icon: 'bi bi-graph-up',
      category: 'Operativo'
    },
    {
      id: 'REP-005',
      name: 'Mantenimiento Preventivo',
      description: 'Calendario y cumplimiento de mantenimientos preventivos',
      icon: 'bi bi-calendar-check',
      category: 'Mantenimiento'
    }
  ];

  categories: string[] = ['Todos', 'Activos', 'Mantenimiento', 'Financiero', 'Operativo', 'Recursos Humanos'];
  selectedCategory: string = 'Todos';
  dateRangeByReport: Record<string, { from: string; to: string }> = {};

  ngOnInit(): void {
    this.updateCompanyId();
    for (const report of this.reports) {
      this.selectedFormatByReport[report.id] = 'CSV';
      if (this.requiresDateRange(report.id)) {
        this.dateRangeByReport[report.id] = { from: '', to: '' };
      }
    }
    this.trackingService.addLog(
      String(this.idcompany),
      'Acceso a Reportes de Mantenimiento',
      'ModMaintenance/Reportes',
      ''
    );
  }

  constructor() {
    effect(() => {
      this.updateCompanyId();
    });
  }

  getFilteredReports(): Report[] {
    if (this.selectedCategory === 'Todos') {
      return this.reports;
    }
    return this.reports.filter(report => report.category === this.selectedCategory);
  }

  generateReport(reportId: string): void {
    if (this.requiresDateRange(reportId) && !this.ensureValidDateRange(reportId)) {
      return;
    }

    const selectedFormat = this.getSelectedFormat(reportId);
    this.exportReport(reportId, selectedFormat);
  }

  exportReport(reportId: string, format: string): void {
    if (!this.ensureValidContext()) {
      return;
    }

    if (format !== 'CSV' && format !== 'Excel' && format !== 'PDF') {
      alerts.basicAlert(
        'Formato no disponible',
        'Los formatos disponibles son CSV, Excel y PDF.',
        'warning'
      );
      return;
    }

    if (this.requiresDateRange(reportId) && !this.ensureValidDateRange(reportId)) {
      return;
    }

    if (reportId === 'REP-001') {
      this.exportAssetsReport(format);
      return;
    }

    if (reportId === 'REP-002') {
      this.exportWorkOrdersReport(format);
      return;
    }

    if (reportId === 'REP-003') {
      this.exportMaintenanceCostsReport(format);
      return;
    }

    if (reportId === 'REP-004') {
      this.exportEquipmentAvailabilityReport(format);
      return;
    }

    if (reportId === 'REP-005') {
      this.exportPreventiveMaintenanceReport(format);
      return;
    }

    const report = this.reports.find((r) => r.id === reportId);
    alerts.basicAlert(
      'Pendiente',
      `La exportación de "${report?.name || reportId}" aún no está implementada.`,
      'info'
    );
  }

  private async exportAssetsReport(format: string): Promise<void> {
    const reportId = 'REP-001';
    this.exportingReportId = reportId;
    this.exportingFormat = format;

    try {
      const assets = await lastValueFrom(this.equipmentService.getEquipmentByBranch(this.idBranch));
      const rows = this.mapAssetsForReport(assets || []);
      const headers = [
        'ID',
        'Descripcion',
        'Medida',
        'Cantidad',
        'DiasTrabajo',
        'CostoMN',
        'CostoUSD',
        'PrecioMN',
        'PrecioUSD',
        'Cobrado',
        'Imprimir',
        'Estado'
      ];

      if (format === 'CSV') {
        this.downloadCsv(rows, headers, this.buildFileName('informe_activos', 'csv'));
      } else if (format === 'Excel') {
        this.downloadExcel(rows, 'Activos', this.buildFileName('informe_activos', 'xlsx'));
      } else if (format === 'PDF') {
        await this.downloadPdf(
          'Informe de Activos',
          'Catálogo completo de activos con estado y ubicación',
          rows,
          headers,
          this.buildFileName('informe_activos', 'pdf')
        );
      }

      this.trackingService.addLog(
        String(this.idcompany),
        `Reporte exportado: Informe de Activos (${format})`,
        'ModMaintenance/Reportes',
        ''
      );
      alerts.basicAlert('Éxito', `Informe de Activos exportado en ${format}.`, 'success');
    } catch (error) {
      console.error('Error exporting asset report:', error);
      alerts.basicAlert('Error', 'No fue posible obtener los activos para generar el reporte.', 'error');
    } finally {
      this.exportingReportId = null;
      this.exportingFormat = null;
    }
  }

  private async exportWorkOrdersReport(format: string): Promise<void> {
    const reportId = 'REP-002';
    this.exportingReportId = reportId;
    this.exportingFormat = format;

    try {
      const workOrders = await lastValueFrom(this.workorderService.getAll(this.idBranch.toString()));
      const filteredWorkOrders = this.filterWorkOrdersByDateRange(workOrders || [], reportId);
      const rows = this.mapWorkOrdersForReport(filteredWorkOrders);
      const headers = [
        'Folio',
        'Titulo',
        'Tipo',
        'Prioridad',
        'Estado',
        'AsignadoA',
        'Activo',
        'FechaProgramada',
        'HorasEstimadas',
        'CostoTotal'
      ];
      const allHeaders = [
        'ID',
        'Folio',
        'Titulo',
        'Tipo',
        'Prioridad',
        'Estado',
        'SolicitadoPor',
        'AsignadoA',
        'Departamento',
        'Activo',
        'FechaProgramada',
        'HorasEstimadas',
        'HorasReales',
        'CostoManoObra',
        'CostoRefacciones',
        'CostoTotal',
        'FechaCreacion',
        'FechaCompletada',
        'Descripcion',
        'DescripcionFalla',
        'Observaciones',
        'ActivoRegistro'
      ];

      if (format === 'CSV') {
        this.downloadCsv(rows, allHeaders, this.buildFileName('informe_workorders', 'csv'));
      } else if (format === 'Excel') {
        this.downloadExcel(rows, 'WorkOrders', this.buildFileName('informe_workorders', 'xlsx'));
      } else if (format === 'PDF') {
        const range = this.dateRangeByReport[reportId];
        const subtitle = range?.from && range?.to
          ? `Período: ${this.formatDateValue(range.from)} - ${this.formatDateValue(range.to)}`
          : 'Historial completo de órdenes de trabajo';
        await this.downloadPdf('Órdenes de Trabajo', subtitle, rows, headers, this.buildFileName('informe_workorders', 'pdf'));
      }

      this.trackingService.addLog(
        String(this.idcompany),
        `Reporte exportado: Órdenes de Trabajo (${format})`,
        'ModMaintenance/Reportes',
        ''
      );
      alerts.basicAlert('Éxito', `Informe de Órdenes de Trabajo exportado en ${format}.`, 'success');
    } catch (error) {
      console.error('Error exporting work orders report:', error);
      alerts.basicAlert('Error', 'No fue posible obtener las órdenes de trabajo para generar el reporte.', 'error');
    } finally {
      this.exportingReportId = null;
      this.exportingFormat = null;
    }
  }

  private async exportMaintenanceCostsReport(format: string): Promise<void> {
    const reportId = 'REP-003';
    this.exportingReportId = reportId;
    this.exportingFormat = format;

    try {
      const workOrders = await lastValueFrom(this.workorderService.getAll(this.idBranch.toString()));
      const rows = this.mapMaintenanceCostsForReport(workOrders || []);
      const headers = [
        'Periodo',
        'TipoMantenimiento',
        'TotalOrdenes',
        'OrdenesCompletadas',
        'CostoManoObra',
        'CostoRefacciones',
        'CostoTotal',
        'PromedioPorOrden'
      ];

      if (format === 'CSV') {
        this.downloadCsv(rows, headers, this.buildFileName('informe_costos_mantenimiento', 'csv'));
      } else if (format === 'Excel') {
        this.downloadExcel(rows, 'CostosMantenimiento', this.buildFileName('informe_costos_mantenimiento', 'xlsx'));
      } else if (format === 'PDF') {
        await this.downloadPdf(
          'Costos de Mantenimiento',
          'Análisis de costos por tipo de mantenimiento y período',
          rows,
          headers,
          this.buildFileName('informe_costos_mantenimiento', 'pdf')
        );
      }

      this.trackingService.addLog(
        String(this.idcompany),
        `Reporte exportado: Costos de Mantenimiento (${format})`,
        'ModMaintenance/Reportes',
        ''
      );
      alerts.basicAlert('Éxito', `Informe de Costos de Mantenimiento exportado en ${format}.`, 'success');
    } catch (error) {
      console.error('Error exporting maintenance costs report:', error);
      alerts.basicAlert('Error', 'No fue posible obtener las órdenes para generar el informe de costos.', 'error');
    } finally {
      this.exportingReportId = null;
      this.exportingFormat = null;
    }
  }

  private async exportPreventiveMaintenanceReport(format: string): Promise<void> {
    const reportId = 'REP-005';
    this.exportingReportId = reportId;
    this.exportingFormat = format;

    try {
      const workOrders = await lastValueFrom(this.workorderService.getAll(this.idBranch.toString()));
      const rows = this.mapPreventiveMaintenanceForReport(workOrders || []);
      const headers = [
        'Periodo',
        'Folio',
        'Activo',
        'Departamento',
        'Estado',
        'FechaProgramada',
        'FechaCompletada',
        'DiasAtraso',
        'Cumplimiento'
      ];

      if (format === 'CSV') {
        this.downloadCsv(rows, headers, this.buildFileName('informe_mantenimiento_preventivo', 'csv'));
      } else if (format === 'Excel') {
        this.downloadExcel(rows, 'MantenimientoPreventivo', this.buildFileName('informe_mantenimiento_preventivo', 'xlsx'));
      } else if (format === 'PDF') {
        await this.downloadPdf(
          'Mantenimiento Preventivo',
          'Calendario y cumplimiento de mantenimientos preventivos',
          rows,
          headers,
          this.buildFileName('informe_mantenimiento_preventivo', 'pdf')
        );
      }

      this.trackingService.addLog(
        String(this.idcompany),
        `Reporte exportado: Mantenimiento Preventivo (${format})`,
        'ModMaintenance/Reportes',
        ''
      );
      alerts.basicAlert('Éxito', `Informe de Mantenimiento Preventivo exportado en ${format}.`, 'success');
    } catch (error) {
      console.error('Error exporting preventive maintenance report:', error);
      alerts.basicAlert('Error', 'No fue posible obtener las órdenes para generar el reporte preventivo.', 'error');
    } finally {
      this.exportingReportId = null;
      this.exportingFormat = null;
    }
  }

  private async exportEquipmentAvailabilityReport(format: string): Promise<void> {
    const reportId = 'REP-004';
    this.exportingReportId = reportId;
    this.exportingFormat = format;

    try {
      const result = await lastValueFrom(forkJoin({
        assets: this.equipmentService.getEquipmentByBranch(this.idBranch),
        workOrders: this.workorderService.getAll(this.idBranch.toString())
      })) as any;

      const filteredWorkOrders = this.filterWorkOrdersByDateRange(result.workOrders || [], reportId);
      const rows = this.mapEquipmentAvailabilityForReport(result.assets || [], filteredWorkOrders, reportId);
      const headers = [
        'IDActivo',
        'Activo',
        'Periodo',
        'TotalOT',
        'OTCorrectivas',
        'HorasInactividad',
        'HorasPeriodo',
        'Disponibilidad',
        'EstadoDisponibilidad'
      ];

      if (format === 'CSV') {
        this.downloadCsv(rows, headers, this.buildFileName('informe_disponibilidad_equipos', 'csv'));
      } else if (format === 'Excel') {
        this.downloadExcel(rows, 'DisponibilidadEquipos', this.buildFileName('informe_disponibilidad_equipos', 'xlsx'));
      } else if (format === 'PDF') {
        const range = this.dateRangeByReport[reportId];
        const subtitle = range?.from && range?.to
          ? `Período: ${this.formatDateValue(range.from)} - ${this.formatDateValue(range.to)}`
          : 'Tiempo de actividad y downtime por equipo';
        await this.downloadPdf(
          'Disponibilidad de Equipos',
          subtitle,
          rows,
          headers,
          this.buildFileName('informe_disponibilidad_equipos', 'pdf')
        );
      }

      this.trackingService.addLog(
        String(this.idcompany),
        `Reporte exportado: Disponibilidad de Equipos (${format})`,
        'ModMaintenance/Reportes',
        ''
      );
      alerts.basicAlert('Éxito', `Informe de Disponibilidad de Equipos exportado en ${format}.`, 'success');
    } catch (error) {
      console.error('Error exporting equipment availability report:', error);
      alerts.basicAlert('Error', 'No fue posible obtener los datos para generar el reporte de disponibilidad.', 'error');
    } finally {
      this.exportingReportId = null;
      this.exportingFormat = null;
    }
  }

  isExporting(reportId: string, format: string): boolean {
    return this.exportingReportId === reportId && this.exportingFormat === format;
  }

  setSelectedFormat(reportId: string, format: string): void {
    this.selectedFormatByReport[reportId] = format;
  }

  getSelectedFormat(reportId: string): string {
    return this.selectedFormatByReport[reportId] || 'CSV';
  }

  canGenerateByBranch(): boolean {
    return this.idBranch > 0;
  }

  getDateFrom(reportId: string): string {
    return this.dateRangeByReport[reportId]?.from || '';
  }

  getDateTo(reportId: string): string {
    return this.dateRangeByReport[reportId]?.to || '';
  }

  setDateFrom(reportId: string, value: string): void {
    const current = this.dateRangeByReport[reportId] || { from: '', to: '' };
    this.dateRangeByReport[reportId] = { ...current, from: value || '' };
  }

  setDateTo(reportId: string, value: string): void {
    const current = this.dateRangeByReport[reportId] || { from: '', to: '' };
    this.dateRangeByReport[reportId] = { ...current, to: value || '' };
  }

  hasDateRange(reportId: string): boolean {
    if (!this.requiresDateRange(reportId)) {
      return true;
    }
    const range = this.dateRangeByReport[reportId];
    return !!range?.from && !!range?.to;
  }

  requiresDateRange(reportId: string): boolean {
    return reportId === 'REP-002' || reportId === 'REP-004';
  }

  private mapAssetsForReport(assets: any[]): any[] {
    return assets.map((asset) => ({
      ID: asset.id ?? '',
      Descripcion: asset.description ?? '',
      Medida: asset.measure ?? '',
      Cantidad: asset.quantity ?? 0,
      DiasTrabajo: asset.daysWork ?? asset.dayswork ?? 0,
      CostoMN: asset.costMN ?? asset.costoMN ?? 0,
      CostoUSD: asset.costDLL ?? asset.costoDLL ?? 0,
      PrecioMN: asset.priceMN ?? asset.ventaMN ?? 0,
      PrecioUSD: asset.priceDLL ?? asset.ventaDLL ?? 0,
      Cobrado: asset.charged ? 'Si' : 'No',
      Imprimir: asset.imprimir ? 'Si' : 'No',
      Estado: asset.active ? 'Activo' : 'Inactivo'
    }));
  }

  private mapWorkOrdersForReport(workOrders: any[]): any[] {
    return workOrders.map((workOrder) => ({
      ID: workOrder.id ?? '',
      Folio: workOrder.folio ?? '',
      Titulo: workOrder.title ?? '',
      Tipo: workOrder.type ?? '',
      Prioridad: workOrder.priority ?? '',
      Estado: workOrder.status ?? '',
      SolicitadoPor: workOrder.requestedBy ?? '',
      AsignadoA: workOrder.assignedTo ?? '',
      Departamento: workOrder.department ?? '',
      Activo: workOrder.assetName ?? '',
      FechaProgramada: this.formatDateValue(workOrder.scheduledDate),
      HorasEstimadas: workOrder.estimatedHours ?? 0,
      HorasReales: workOrder.actualHours ?? 0,
      CostoManoObra: workOrder.costLabor ?? 0,
      CostoRefacciones: workOrder.costParts ?? 0,
      CostoTotal: workOrder.totalCost ?? 0,
      FechaCreacion: this.formatDateValue(workOrder.createdDate),
      FechaCompletada: this.formatDateValue(workOrder.completedDate),
      Descripcion: workOrder.description ?? '',
      DescripcionFalla: workOrder.failureDescription ?? '',
      Observaciones: workOrder.observations ?? '',
      ActivoRegistro: workOrder.active ? 'Si' : 'No'
    }));
  }

  private mapMaintenanceCostsForReport(workOrders: any[]): any[] {
    const groups: Record<string, any> = {};

    for (const workOrder of workOrders) {
      const period = this.getPeriodKey(workOrder.scheduledDate || workOrder.createdDate);
      const type = workOrder.type || 'sin-tipo';
      const groupKey = `${period}|${type}`;
      const costLabor = this.normalizeNumber(workOrder.costLabor);
      const costParts = this.normalizeNumber(workOrder.costParts);
      const totalCost = this.normalizeNumber(workOrder.totalCost) || (costLabor + costParts);

      if (!groups[groupKey]) {
        groups[groupKey] = {
          Periodo: period,
          TipoMantenimiento: type,
          TotalOrdenes: 0,
          OrdenesCompletadas: 0,
          CostoManoObra: 0,
          CostoRefacciones: 0,
          CostoTotal: 0
        };
      }

      groups[groupKey].TotalOrdenes += 1;
      if ((workOrder.status || '').toLowerCase() === 'completada') {
        groups[groupKey].OrdenesCompletadas += 1;
      }
      groups[groupKey].CostoManoObra += costLabor;
      groups[groupKey].CostoRefacciones += costParts;
      groups[groupKey].CostoTotal += totalCost;
    }

    const rows = Object.values(groups).map((group: any) => ({
      ...group,
      CostoManoObra: this.round2(group.CostoManoObra),
      CostoRefacciones: this.round2(group.CostoRefacciones),
      CostoTotal: this.round2(group.CostoTotal),
      PromedioPorOrden: this.round2(
        group.TotalOrdenes > 0 ? group.CostoTotal / group.TotalOrdenes : 0
      )
    }));

    rows.sort((a: any, b: any) => {
      if (a.Periodo === b.Periodo) {
        return a.TipoMantenimiento.localeCompare(b.TipoMantenimiento);
      }
      return a.Periodo.localeCompare(b.Periodo);
    });

    return rows;
  }

  private mapPreventiveMaintenanceForReport(workOrders: any[]): any[] {
    const preventiveOrders = (workOrders || [])
      .filter((wo: any) => (wo.type || '').toLowerCase() === 'preventivo')
      .map((workOrder: any) => {
        const scheduledDate = workOrder.scheduledDate || null;
        const completedDate = workOrder.completedDate || null;
        const status = (workOrder.status || '').toLowerCase();
        const isClosed = status === 'completada' || status === 'cancelada';
        const delayDays = this.getDelayDays(scheduledDate, isClosed ? completedDate : null);

        return {
          Periodo: this.getPeriodKey(scheduledDate || workOrder.createdDate),
          Folio: workOrder.folio ?? '',
          Activo: workOrder.assetName ?? '',
          Departamento: workOrder.department ?? '',
          Estado: workOrder.status ?? '',
          FechaProgramada: this.formatDateValue(scheduledDate),
          FechaCompletada: this.formatDateValue(completedDate),
          DiasAtraso: delayDays,
          Cumplimiento: status === 'completada' ? 'Cumplido' : 'Pendiente'
        };
      });

    preventiveOrders.sort((a: any, b: any) => {
      if (a.Periodo === b.Periodo) {
        return (a.Folio || '').localeCompare(b.Folio || '');
      }
      return a.Periodo.localeCompare(b.Periodo);
    });

    return preventiveOrders;
  }

  private mapEquipmentAvailabilityForReport(assets: any[], workOrders: any[], reportId: string): any[] {
    const currentPeriod = this.getDateRangeLabel(reportId);
    const periodHours = this.getDateRangeHours(reportId);

    const rows = (assets || []).map((asset: any) => {
      const assetId = String(asset?.id ?? '');
      const assetName = String(asset?.description ?? '');
      const relatedOrders = (workOrders || []).filter((wo: any) => {
        const byId = String(wo?.assetId ?? '') === assetId;
        const byName = String(wo?.assetName ?? '').trim().toLowerCase() === assetName.trim().toLowerCase();
        return byId || byName;
      });

      const activeOrders = relatedOrders.filter((wo: any) => (wo?.status || '').toLowerCase() !== 'cancelada');
      const correctiveOrders = activeOrders.filter((wo: any) => (wo?.type || '').toLowerCase() === 'correctivo');
      const downtimeHours = activeOrders.reduce((sum: number, wo: any) => {
        const actual = this.normalizeNumber(wo?.actualHours);
        const estimated = this.normalizeNumber(wo?.estimatedHours);
        return sum + (actual > 0 ? actual : estimated);
      }, 0);

      const rawAvailability = periodHours > 0 ? ((periodHours - downtimeHours) / periodHours) * 100 : 100;
      const availability = Math.max(0, Math.min(100, rawAvailability));

      return {
        IDActivo: asset?.id ?? '',
        Activo: assetName,
        Periodo: currentPeriod,
        TotalOT: activeOrders.length,
        OTCorrectivas: correctiveOrders.length,
        HorasInactividad: this.round2(downtimeHours),
        HorasPeriodo: periodHours,
        Disponibilidad: `${this.round2(availability)}%`,
        EstadoDisponibilidad: this.getAvailabilityState(availability)
      };
    });

    rows.sort((a: any, b: any) => a.Activo.localeCompare(b.Activo));
    return rows;
  }

  private downloadCsv(rows: any[], headers: string[], fileName: string): void {
    const csvRows = [
      headers.join(','),
      ...rows.map((row) =>
        headers
          .map((header) => this.escapeCsvValue(row[header]))
          .join(',')
      )
    ];

    const csvContent = '\ufeff' + csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  private downloadExcel(rows: any[], sheetName: string, fileName: string): void {
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    XLSX.writeFile(workbook, fileName);
  }

  private async downloadPdf(title: string, subtitle: string, rows: any[], headers: string[], fileName: string): Promise<void> {
    // Fetch company logos (standard 2-logo header)
    const tryB64 = async (url: string): Promise<string | null> => {
      try { return await this.base64Service.convertImageToBase64(url); } catch { return null; }
    };

    let logoB64: string | null = null;
    let logo2B64: string | null = null;
    let companyName = '';

    try {
      const root: any = await lastValueFrom(this.rootService.getRootbyId(this.idcompany));
      companyName = root?.name || '';
      logoB64  = root?.picture  ? await tryB64(root.picture)  : null;
      logo2B64 = root?.picture2 ? await tryB64(root.picture2) : logoB64;
    } catch { /* logos opcionales */ }

    const imgs: Record<string, string> = {};
    if (logoB64)  imgs['logo']  = logoB64;
    if (logo2B64) imgs['logo2'] = logo2B64;

    const logoLeft:  any = logoB64  ? { image: 'logo',  width: 70, alignment: 'left'  } : { text: companyName, bold: true, fontSize: 10 };
    const logoRight: any = logo2B64 ? { image: 'logo2', width: 70, alignment: 'right' } : { text: '' };

    // Build table body
    const tableBody: any[][] = [];
    tableBody.push(
      headers.map((header) => ({
        text: this.formatHeaderLabel(header),
        style: 'tableHeader',
        alignment: 'center'
      }))
    );
    for (const row of rows) {
      tableBody.push(
        headers.map((header) => {
          const value = row[header] ?? '';
          const isNumeric = typeof value === 'number' || !isNaN(Number(value));
          return { text: String(value), alignment: isNumeric ? 'right' : 'left', fontSize: 8 };
        })
      );
    }

    const columnWidths = this.calculateColumnWidths(headers, rows);

    const docDefinition: any = {
      pageSize: 'LETTER',
      pageOrientation: headers.length > 6 ? 'landscape' : 'portrait',
      pageMargins: [30, 100, 30, 50],
      images: Object.keys(imgs).length > 0 ? imgs : undefined,
      header: (_currentPage: number, _pageCount: number) => ({
        margin: [30, 15, 30, 5],
        stack: [
          {
            table: {
              widths: ['*', '*', '*'],
              body: [[
                logoLeft,
                {
                  stack: [
                    { text: companyName, bold: true, fontSize: 11, color: '#1e3a5f', alignment: 'center' },
                    { text: title, fontSize: 13, bold: true, color: '#1e40af', alignment: 'center', margin: [0, 2, 0, 0] },
                    { text: subtitle, fontSize: 8, color: '#64748b', alignment: 'center', margin: [0, 2, 0, 0] }
                  ]
                },
                logoRight
              ]]
            },
            layout: 'noBorders'
          },
          { canvas: [{ type: 'line', x1: 0, y1: 4, x2: 555, y2: 4, lineWidth: 1, lineColor: '#1e40af' }] }
        ]
      }),
      footer: (currentPage: number, pageCount: number) => ({
        columns: [
          { text: `Generado: ${this.formatDateValue(new Date().toISOString())}`, alignment: 'left', fontSize: 7, margin: [30, 0, 0, 0] },
          { text: `Página ${currentPage} de ${pageCount}`, alignment: 'right', fontSize: 7, margin: [0, 0, 30, 0] }
        ]
      }),
      content: [
        {
          table: { headerRows: 1, widths: columnWidths, body: tableBody },
          layout: {
            fillColor: (rowIndex: number) => (rowIndex === 0 ? '#1e40af' : (rowIndex % 2 === 0 ? '#f8fafc' : null)),
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => '#cbd5e1',
            vLineColor: () => '#cbd5e1'
          }
        },
        { text: `Total de registros: ${rows.length}`, style: 'totalRecords', margin: [0, 10, 0, 0] }
      ],
      styles: {
        tableHeader: { fontSize: 8, bold: true, color: '#ffffff' },
        totalRecords: { fontSize: 9, italics: true, color: '#64748b' }
      },
      defaultStyle: { fontSize: 9 }
    };

    pdfMake.createPdf(docDefinition).download(fileName);
  }

  private formatHeaderLabel(header: string): string {
    const labels: Record<string, string> = {
      ID: 'ID',
      IDActivo: 'ID Activo',
      Descripcion: 'Descripción',
      Medida: 'Medida',
      Cantidad: 'Cantidad',
      DiasTrabajo: 'Días Trabajo',
      CostoMN: 'Costo MXN',
      CostoUSD: 'Costo USD',
      PrecioMN: 'Precio MXN',
      PrecioUSD: 'Precio USD',
      Cobrado: 'Cobrado',
      Imprimir: 'Imprimir',
      Estado: 'Estado',
      Folio: 'Folio',
      Titulo: 'Título',
      Tipo: 'Tipo',
      Prioridad: 'Prioridad',
      SolicitadoPor: 'Solicitado Por',
      AsignadoA: 'Asignado A',
      Departamento: 'Departamento',
      Activo: 'Activo',
      FechaProgramada: 'Fecha Programada',
      HorasEstimadas: 'Horas Est.',
      HorasReales: 'Horas Reales',
      CostoManoObra: 'Costo M.O.',
      CostoRefacciones: 'Costo Refacc.',
      CostoTotal: 'Costo Total',
      FechaCreacion: 'Fecha Creación',
      FechaCompletada: 'Fecha Completada',
      DescripcionFalla: 'Desc. Falla',
      Observaciones: 'Observaciones',
      ActivoRegistro: 'Registro Activo',
      Periodo: 'Período',
      TipoMantenimiento: 'Tipo Mant.',
      TotalOrdenes: 'Total OTs',
      OrdenesCompletadas: 'OTs Completadas',
      PromedioPorOrden: 'Prom./Orden',
      TotalOT: 'Total OT',
      OTCorrectivas: 'OT Correctivas',
      HorasInactividad: 'Hrs Inactividad',
      HorasPeriodo: 'Hrs Período',
      Disponibilidad: 'Disponibilidad',
      EstadoDisponibilidad: 'Estado Disp.',
      DiasAtraso: 'Días Atraso',
      Cumplimiento: 'Cumplimiento'
    };
    return labels[header] || header;
  }

  private calculateColumnWidths(headers: string[], rows: any[]): (string | number)[] {
    const totalColumns = headers.length;
    if (totalColumns <= 4) {
      return Array(totalColumns).fill('*');
    }
    if (totalColumns <= 6) {
      return Array(totalColumns).fill('auto');
    }
    return Array(totalColumns).fill('auto');
  }

  private buildFileName(prefix: string, extension: string): string {
    const now = new Date();
    const pad = (value: number) => value.toString().padStart(2, '0');
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
    return `${prefix}_${stamp}.${extension}`;
  }

  private formatDateValue(value: string | null | undefined): string {
    if (!value) {
      return '';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  private getPeriodKey(value: string | null | undefined): string {
    if (!value) {
      return 'sin-fecha';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return 'sin-fecha';
    }

    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${date.getFullYear()}-${month}`;
  }

  private getDelayDays(
    scheduledDateValue: string | null | undefined,
    completedDateValue: string | null | undefined
  ): number {
    if (!scheduledDateValue) {
      return 0;
    }

    const scheduledDate = new Date(scheduledDateValue);
    if (Number.isNaN(scheduledDate.getTime())) {
      return 0;
    }

    const reference = completedDateValue ? new Date(completedDateValue) : new Date();
    if (Number.isNaN(reference.getTime())) {
      return 0;
    }

    const diffTime = reference.getTime() - scheduledDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  }

  private filterWorkOrdersByDateRange(workOrders: any[], reportId: string): any[] {
    const range = this.dateRangeByReport[reportId];
    if (!range?.from || !range?.to) {
      return workOrders || [];
    }

    const fromDate = new Date(`${range.from}T00:00:00`);
    const toDate = new Date(`${range.to}T23:59:59`);

    return (workOrders || []).filter((workOrder: any) => {
      const workOrderDate = this.getWorkOrderDate(workOrder);
      if (!workOrderDate) {
        return false;
      }
      return workOrderDate >= fromDate && workOrderDate <= toDate;
    });
  }

  private getWorkOrderDate(workOrder: any): Date | null {
    const value = workOrder?.scheduledDate || workOrder?.createdDate;
    if (!value) {
      return null;
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return date;
  }

  private getDateRangeLabel(reportId: string): string {
    const range = this.dateRangeByReport[reportId];
    if (!range?.from || !range?.to) {
      return 'sin-rango';
    }
    return `${range.from} a ${range.to}`;
  }

  private getDateRangeHours(reportId: string): number {
    const range = this.dateRangeByReport[reportId];
    if (!range?.from || !range?.to) {
      return 0;
    }

    const fromDate = new Date(`${range.from}T00:00:00`);
    const toDate = new Date(`${range.to}T00:00:00`);
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      return 0;
    }

    const diffMs = toDate.getTime() - fromDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
    return diffDays > 0 ? diffDays * 24 : 0;
  }

  private ensureValidDateRange(reportId: string): boolean {
    const range = this.dateRangeByReport[reportId];
    if (!range?.from || !range?.to) {
      alerts.basicAlert(
        'Rango requerido',
        'Selecciona fecha inicial y fecha final para generar este reporte.',
        'warning'
      );
      return false;
    }

    const fromDate = new Date(`${range.from}T00:00:00`);
    const toDate = new Date(`${range.to}T00:00:00`);
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime()) || fromDate > toDate) {
      alerts.basicAlert(
        'Rango inválido',
        'Verifica que la fecha inicial sea menor o igual a la fecha final.',
        'warning'
      );
      return false;
    }

    return true;
  }

  private getAvailabilityState(availability: number): string {
    if (availability >= 95) {
      return 'Alta';
    }
    if (availability >= 85) {
      return 'Media';
    }
    return 'Baja';
  }

  private normalizeNumber(value: any): number {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : 0;
  }

  private round2(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private escapeCsvValue(value: any): string {
    const stringValue = String(value ?? '');
    if (
      stringValue.includes(',') ||
      stringValue.includes('"') ||
      stringValue.includes('\n')
    ) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }

    return stringValue;
  }

  private updateCompanyId(): void {
    const signalCompanyId = this.signalsService.getRootSelectedBySidebar()();
    if (signalCompanyId !== null && signalCompanyId !== undefined) {
      this.idcompany = Number(signalCompanyId);
    } else {
      const companyFromStorage = localStorage.getItem('company');
      if (companyFromStorage) {
        const parsedCompany = Number(companyFromStorage);
        if (!Number.isNaN(parsedCompany)) {
          this.idcompany = parsedCompany;
        }
      }
    }

    const signalBranchId = this.signalsService.getBranchSelectedBySidebar()();
    this.idBranch = signalBranchId !== null && signalBranchId !== undefined ? Number(signalBranchId) : 0;
  }

  private ensureValidContext(): boolean {
    const hasCompany = this.idcompany !== null && this.idcompany !== undefined && !Number.isNaN(Number(this.idcompany));
    const hasBranch = this.idBranch !== null && this.idBranch !== undefined && !Number.isNaN(Number(this.idBranch)) && Number(this.idBranch) > 0;
    if (hasCompany && hasBranch) {
      return true;
    }

    alerts.basicAlert(
      'Contexto incompleto',
      'No se encontró el contexto activo (compañía/sucursal). Selecciona una sucursal e intenta nuevamente.',
      'warning'
    );
    return false;
  }
}
