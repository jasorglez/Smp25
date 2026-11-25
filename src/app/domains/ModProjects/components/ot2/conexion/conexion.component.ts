import { Component, effect, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-community';
import { SignalsService } from 'app/services/signals.service';
import { ConventionsService } from 'app/services/conventions.service';
import { WorkprogramsService } from 'app/services/workprograms.service';
import { alerts } from 'app/helpers/alerts';
import { TranslateModule } from '@ngx-translate/core';
import { injectWorkOrderTranslator } from '../../ot/work-order-i18n';

@Component({
  selector: 'app-conexion',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridAngular, TranslateModule],
  templateUrl: './conexion.component.html',
  styleUrl: './conexion.component.scss'
})
export class ConexionComponent {
  private readonly t = injectWorkOrderTranslator();

  private signalsService    = inject(SignalsService);
  private conventionsService = inject(ConventionsService);
  private workprogramsService = inject(WorkprogramsService);

  // Estado
  idContract: number = null;
  vigenteConvention: { id: number; name: string } | null = null;
  conventions: any[] = [];
  sourceConventionId: number = null;
  isLoading = false;
  isCopying = false;
  workprogramRows: any[] = [];

  private gridApi: GridApi;

  colDefs: ColDef[] = [
    { field: 'activity',    headerName: this.t('grid.activity'),    width: 90 },
    { field: 'text',        headerName: this.t('grid.description'),  flex: 1, minWidth: 200 },
    { field: 'startDate',   headerName: this.t('grid.start'),       width: 105,
      valueFormatter: p => p.value ? new Date(p.value).toLocaleDateString('es-MX') : '' },
    { field: 'endDate',     headerName: this.t('grid.end'),          width: 105,
      valueFormatter: p => p.value ? new Date(p.value).toLocaleDateString('es-MX') : '' },
    { field: 'costMX',      headerName: this.t('grid.costMxn'),  width: 120, type: 'numericColumn',
      valueFormatter: p => p.value != null ? `$${Number(p.value).toLocaleString('es-MX', { minimumFractionDigits: 2 })}` : '' },
    { field: 'costDLL',     headerName: this.t('grid.costUsd'),  width: 120, type: 'numericColumn',
      valueFormatter: p => p.value != null ? `$${Number(p.value).toLocaleString('es-MX', { minimumFractionDigits: 2 })}` : '' },
    { field: 'total',       headerName: this.t('grid.total'),        width: 120, type: 'numericColumn',
      valueFormatter: p => p.value != null ? `$${Number(p.value).toLocaleString('es-MX', { minimumFractionDigits: 2 })}` : '' },
    { field: 'quantity',    headerName: this.t('grid.quantity'),     width: 90,  type: 'numericColumn' },
    { field: 'measure',     headerName: this.t('grid.unit'),       width: 90 },
    { field: 'phase',       headerName: this.t('grid.phase'),         width: 110 },
    { field: 'criticRoute', headerName: this.t('grid.criticalPath'), width: 110 },
  ];

  defaultColDef: ColDef = { sortable: true, resizable: true, suppressSizeToFit: false };

  constructor() {
    effect(() => {
      this.idContract        = this.signalsService.getContractSelectedBySidebar()();
      this.vigenteConvention = this.signalsService.getConventionVigente()();
      if (this.idContract) this.loadConventions();
    });
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  private loadConventions() {
    this.conventionsService.getConventionsByContractOrProject('Contract', this.idContract)
      .subscribe({
        next: (data: any[]) => {
          // Excluir el vigente del dropdown de origen
          this.conventions = data.filter(c => c.id !== this.vigenteConvention?.id && c.active);
        },
        error: () => this.conventions = []
      });
  }

  loadWorkProgram() {
    if (!this.vigenteConvention) {
      alerts.basicAlert(this.t('alerts.warningTitle'), this.t('alerts.noCurrentAgreementSelected'), 'warning');
      return;
    }
    this.isLoading = true;
    this.workprogramsService.getByConvention(this.vigenteConvention.id).subscribe({
      next: rows => {
        this.workprogramRows = rows;
        this.isLoading = false;
      },
      error: () => {
        this.workprogramRows = [];
        this.isLoading = false;
        alerts.basicAlert(this.t('alerts.errorTitle'), this.t('alerts.workProgramLoadFailed'), 'error');
      }
    });
  }

  copyWorkProgram() {
    if (!this.sourceConventionId) {
      alerts.basicAlert(this.t('alerts.warningTitle'), this.t('alerts.selectSourceAgreementToCopy'), 'warning');
      return;
    }
    if (!this.vigenteConvention) {
      alerts.basicAlert(this.t('alerts.warningTitle'), this.t('alerts.noDestinationAgreement'), 'warning');
      return;
    }

    const sourceName = this.conventions.find(c => c.id == this.sourceConventionId)?.name ?? this.sourceConventionId;

    alerts.confirmAlert(
      this.t('alerts.copyWorkProgramTitle'),
      this.t('alerts.copyWorkProgramConfirm', { source: sourceName, target: this.vigenteConvention.name }),
      'question',
      this.t('ui.copy')
    ).then(result => {
      if (!result.isConfirmed) return;
      this.isCopying = true;
      this.workprogramsService.copyFromConvention(+this.sourceConventionId, this.vigenteConvention.id).subscribe({
        next: res => {
          this.isCopying = false;
          alerts.basicAlert(this.t('alerts.doneTitle'), res.message, 'success');
          this.loadWorkProgram();
        },
        error: () => {
          this.isCopying = false;
          alerts.basicAlert(this.t('alerts.errorTitle'), this.t('alerts.workProgramCopyFailed'), 'error');
        }
      });
    });
  }
}
