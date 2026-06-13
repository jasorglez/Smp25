import { Component, effect, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-community';
import { SignalsService } from 'app/services/signals.service';
import { ConventionsService } from 'app/services/conventions.service';
import { WorkprogramsService } from 'app/services/workprograms.service';
import { alerts } from 'app/helpers/alerts';

@Component({
  selector: 'app-conexion',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridAngular],
  templateUrl: './conexion.component.html',
  styleUrl: './conexion.component.scss'
})
export class ConexionComponent {

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
    { field: 'activity',    headerName: 'Actividad',    width: 90 },
    { field: 'text',        headerName: 'Descripción',  flex: 1, minWidth: 200 },
    { field: 'startDate',   headerName: 'Inicio',       width: 105,
      valueFormatter: p => p.value ? new Date(p.value).toLocaleDateString('es-MX') : '' },
    { field: 'endDate',     headerName: 'Fin',          width: 105,
      valueFormatter: p => p.value ? new Date(p.value).toLocaleDateString('es-MX') : '' },
    { field: 'costMX',      headerName: 'Costo MXN $',  width: 120, type: 'numericColumn',
      valueFormatter: p => p.value != null ? `$${Number(p.value).toLocaleString('es-MX', { minimumFractionDigits: 2 })}` : '' },
    { field: 'costDLL',     headerName: 'Costo USD $',  width: 120, type: 'numericColumn',
      valueFormatter: p => p.value != null ? `$${Number(p.value).toLocaleString('es-MX', { minimumFractionDigits: 2 })}` : '' },
    { field: 'total',       headerName: 'Total',        width: 120, type: 'numericColumn',
      valueFormatter: p => p.value != null ? `$${Number(p.value).toLocaleString('es-MX', { minimumFractionDigits: 2 })}` : '' },
    { field: 'quantity',    headerName: 'Cantidad',     width: 90,  type: 'numericColumn' },
    { field: 'measure',     headerName: 'Unidad',       width: 90 },
    { field: 'phase',       headerName: 'Fase',         width: 110 },
    { field: 'criticRoute', headerName: 'Ruta Crítica', width: 110 },
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
      alerts.basicAlert('Aviso', 'No hay un convenio vigente seleccionado.', 'warning');
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
        alerts.basicAlert('Error', 'No se pudo cargar el programa de trabajo.', 'error');
      }
    });
  }

  copyWorkProgram() {
    if (!this.sourceConventionId) {
      alerts.basicAlert('Aviso', 'Selecciona el convenio origen para copiar.', 'warning');
      return;
    }
    if (!this.vigenteConvention) {
      alerts.basicAlert('Aviso', 'No hay un convenio vigente destino.', 'warning');
      return;
    }

    const sourceName = this.conventions.find(c => c.id == this.sourceConventionId)?.name ?? this.sourceConventionId;

    alerts.confirmAlert(
      '¿Copiar Programa de Trabajo?',
      `Se copiarán todas las tareas del convenio "${sourceName}" al convenio vigente "${this.vigenteConvention.name}".`,
      'question',
      'Copiar'
    ).then(result => {
      if (!result.isConfirmed) return;
      this.isCopying = true;
      this.workprogramsService.copyFromConvention(+this.sourceConventionId, this.vigenteConvention.id).subscribe({
        next: res => {
          this.isCopying = false;
          alerts.basicAlert('Listo', res.message, 'success');
          this.loadWorkProgram();
        },
        error: () => {
          this.isCopying = false;
          alerts.basicAlert('Error', 'No se pudo copiar el programa de trabajo.', 'error');
        }
      });
    });
  }
}
