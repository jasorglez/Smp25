import { Component, OnInit, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as XLSX from 'xlsx';
import { alerts } from 'app/helpers/alerts';
import { EquipmentService } from 'app/services/equipment.service';
import { SignalsService } from 'app/services/signals.service';
import { WorkorderService } from 'app/services/workorder.service';

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

  idcompany: number = 0;
  exportingReportId: string | null = null;
  exportingFormat: string | null = null;
  selectedFormatByReport: Record<string, string> = {};

  reports: Report[] = [
    {
      id: 'REP-001',
      name: 'Informe de Activos',
      description: 'Catálogo completo de activos con estado y ubicación',
      icon: 'fas fa-cogs',
      category: 'Activos'
    },
    {
      id: 'REP-002',
      name: 'Órdenes de Trabajo',
      description: 'Historial completo de órdenes de trabajo por período',
      icon: 'fas fa-clipboard-list',
      category: 'Mantenimiento'
    },
    {
      id: 'REP-003',
      name: 'Costos de Mantenimiento',
      description: 'Análisis de costos por tipo de mantenimiento y período',
      icon: 'fas fa-dollar-sign',
      category: 'Financiero'
    },
    {
      id: 'REP-004',
      name: 'Disponibilidad de Equipos',
      description: 'Tiempo de actividad y downtime por equipo',
      icon: 'fas fa-chart-line',
      category: 'Operativo'
    },
    {
      id: 'REP-005',
      name: 'Mantenimiento Preventivo',
      description: 'Calendario y cumplimiento de mantenimientos preventivos',
      icon: 'fas fa-calendar-check',
      category: 'Mantenimiento'
    }
  ];

  categories: string[] = ['Todos', 'Activos', 'Mantenimiento', 'Financiero', 'Operativo', 'Recursos Humanos'];
  selectedCategory: string = 'Todos';

  ngOnInit(): void {
    this.updateCompanyId();
    for (const report of this.reports) {
      this.selectedFormatByReport[report.id] = 'CSV';
    }
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
    const selectedFormat = this.getSelectedFormat(reportId);
    this.exportReport(reportId, selectedFormat);
  }

  exportReport(reportId: string, format: string): void {
    if (!this.ensureValidCompanyId()) {
      return;
    }

    if (format !== 'CSV' && format !== 'Excel') {
      alerts.basicAlert(
        'Formato no disponible',
        'Por ahora solo están disponibles CSV y Excel.',
        'warning'
      );
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

    const report = this.reports.find((r) => r.id === reportId);
    alerts.basicAlert(
      'Pendiente',
      `La exportación de "${report?.name || reportId}" aún no está implementada.`,
      'info'
    );
  }

  private exportAssetsReport(format: string): void {
    const reportId = 'REP-001';
    this.exportingReportId = reportId;
    this.exportingFormat = format;

    this.equipmentService.getEquipment(this.idcompany).subscribe({
      next: (assets: any[]) => {
        const rows = this.mapAssetsForReport(assets || []);

        if (format === 'CSV') {
          this.downloadCsv(
            rows,
            [
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
            ],
            this.buildFileName('informe_activos', 'csv')
          );
        } else {
          this.downloadExcel(
            rows,
            'Activos',
            this.buildFileName('informe_activos', 'xlsx')
          );
        }

        alerts.basicAlert(
          'Éxito',
          `Informe de Activos exportado en ${format}.`,
          'success'
        );
        this.exportingReportId = null;
        this.exportingFormat = null;
      },
      error: (error) => {
        console.error('Error exporting asset report:', error);
        alerts.basicAlert(
          'Error',
          'No fue posible obtener los activos para generar el reporte.',
          'error'
        );
        this.exportingReportId = null;
        this.exportingFormat = null;
      }
    });
  }

  private exportWorkOrdersReport(format: string): void {
    const reportId = 'REP-002';
    this.exportingReportId = reportId;
    this.exportingFormat = format;

    this.workorderService.getAll(this.idcompany.toString()).subscribe({
      next: (workOrders: any[]) => {
        const rows = this.mapWorkOrdersForReport(workOrders || []);

        if (format === 'CSV') {
          this.downloadCsv(
            rows,
            [
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
            ],
            this.buildFileName('informe_workorders', 'csv')
          );
        } else {
          this.downloadExcel(
            rows,
            'WorkOrders',
            this.buildFileName('informe_workorders', 'xlsx')
          );
        }

        alerts.basicAlert(
          'Éxito',
          `Informe de Órdenes de Trabajo exportado en ${format}.`,
          'success'
        );
        this.exportingReportId = null;
        this.exportingFormat = null;
      },
      error: (error) => {
        console.error('Error exporting work orders report:', error);
        alerts.basicAlert(
          'Error',
          'No fue posible obtener las órdenes de trabajo para generar el reporte.',
          'error'
        );
        this.exportingReportId = null;
        this.exportingFormat = null;
      }
    });
  }

  private exportMaintenanceCostsReport(format: string): void {
    const reportId = 'REP-003';
    this.exportingReportId = reportId;
    this.exportingFormat = format;

    this.workorderService.getAll(this.idcompany.toString()).subscribe({
      next: (workOrders: any[]) => {
        const rows = this.mapMaintenanceCostsForReport(workOrders || []);

        if (format === 'CSV') {
          this.downloadCsv(
            rows,
            [
              'Periodo',
              'TipoMantenimiento',
              'TotalOrdenes',
              'OrdenesCompletadas',
              'CostoManoObra',
              'CostoRefacciones',
              'CostoTotal',
              'PromedioPorOrden'
            ],
            this.buildFileName('informe_costos_mantenimiento', 'csv')
          );
        } else {
          this.downloadExcel(
            rows,
            'CostosMantenimiento',
            this.buildFileName('informe_costos_mantenimiento', 'xlsx')
          );
        }

        alerts.basicAlert(
          'Éxito',
          `Informe de Costos de Mantenimiento exportado en ${format}.`,
          'success'
        );
        this.exportingReportId = null;
        this.exportingFormat = null;
      },
      error: (error) => {
        console.error('Error exporting maintenance costs report:', error);
        alerts.basicAlert(
          'Error',
          'No fue posible obtener las órdenes para generar el informe de costos.',
          'error'
        );
        this.exportingReportId = null;
        this.exportingFormat = null;
      }
    });
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

  private mapAssetsForReport(assets: any[]): any[] {
    return assets.map((asset) => ({
      ID: asset.id ?? '',
      Descripcion: asset.description ?? '',
      Medida: asset.measure ?? '',
      Cantidad: asset.quantity ?? 0,
      DiasTrabajo: asset.dayswork ?? 0,
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
      return;
    }

    const companyFromStorage = localStorage.getItem('company');
    if (companyFromStorage) {
      const parsedCompany = Number(companyFromStorage);
      if (!Number.isNaN(parsedCompany)) {
        this.idcompany = parsedCompany;
      }
    }
  }

  private ensureValidCompanyId(): boolean {
    if (this.idcompany !== null && this.idcompany !== undefined && !Number.isNaN(Number(this.idcompany))) {
      return true;
    }

    alerts.basicAlert(
      'Contexto incompleto',
      'No se encontró la compañía activa. Selecciona una compañía e intenta nuevamente.',
      'warning'
    );
    return false;
  }
}
