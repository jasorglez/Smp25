import { Component, OnInit, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { SignalsService } from 'app/services/signals.service';
import { alerts } from 'app/helpers/alerts';
import { HttpClient } from '@angular/common/http';
import { environment } from '@env/environment';
import { TrackingService } from 'app/services/tracking.service';
import { lastValueFrom } from 'rxjs';

interface AutorizacionMonto {
  id?: number;
  idCompany: number;
  nivel: number;
  montoMin: number;
  montoMax: number | null;
  descripcion: string;
  active: boolean;
  __modified?: boolean;
}

@Component({
  selector: 'app-autorizacion-montos',
  standalone: true,
  imports: [CommonModule, AgGridModule],
  template: `
    <div style="padding: 12px; display: flex; flex-direction: column; gap: 10px; height: 420px;">

      <div style="display: flex; align-items: center; justify-content: space-between;">
        <div>
          <strong>Autorización de compras por monto</strong>
          <span class="text-muted ms-2" style="font-size:0.82rem;">Empresa: {{ idCompany }}</span>
        </div>
        <button class="btn btn-sm btn-primary"
                (click)="save()"
                [disabled]="!hasChanges || saving">
          <i class="bi bi-floppy"></i> Guardar
          <span *ngIf="hasChanges"
                class="position-absolute top-0 start-100 translate-middle p-1 bg-danger border border-light rounded-circle">
          </span>
        </button>
      </div>

      <ag-grid-angular
        class="ag-theme-quartz"
        style="flex: 1; width: 100%;"
        [rowData]="rowData"
        [columnDefs]="colDefs"
        [defaultColDef]="defaultColDef"
        [localeText]="AG_GRID_LOCALE_ES"
        [gridOptions]="gridOptions"
        (gridReady)="onGridReady($event)"
        (cellValueChanged)="onCellValueChanged($event)">
      </ag-grid-angular>

    </div>
  `
})
export class AutorizacionMontosComponent implements OnInit {
  private signalsService = inject(SignalsService);
  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;
  private gridApi!: GridApi;

  idCompany: number = 0;
  rowData: AutorizacionMonto[] = [];
  hasChanges = false;
  saving = false;

  public defaultColDef: ColDef = {
    sortable: false,
    resizable: true,
    filter: false,
    editable: true
  };

  public gridOptions: any = {
    headerHeight: 35,
    rowHeight: 35,
    singleClickEdit: true,
    stopEditingWhenCellsLoseFocus: true,
    rowClassRules: {
      'modified-row': (p: any) => !!p.data?.__modified
    }
  };

  public colDefs: ColDef[] = [
    {
      field: 'nivel',
      headerName: 'Nivel',
      width: 75,
      editable: false,
      cellStyle: { backgroundColor: '#f8f9fa', fontWeight: 'bold', textAlign: 'center' }
    },
    {
      field: 'descripcion',
      headerName: 'Descripción',
      flex: 1,
      minWidth: 200,
      cellEditor: 'agTextCellEditor'
    },
    {
      field: 'montoMin',
      headerName: 'Monto mínimo ($)',
      width: 160,
      type: 'numericColumn',
      cellEditor: 'agNumberCellEditor',
      cellEditorParams: { min: 0, precision: 2 },
      valueFormatter: (p) => p.value != null ? `$${Number(p.value).toLocaleString('es-MX', { minimumFractionDigits: 2 })}` : ''
    },
    {
      field: 'montoMax',
      headerName: 'Monto máximo ($)',
      width: 160,
      type: 'numericColumn',
      cellEditor: 'agNumberCellEditor',
      cellEditorParams: { min: 0, precision: 2 },
      valueFormatter: (p) => p.value != null ? `$${Number(p.value).toLocaleString('es-MX', { minimumFractionDigits: 2 })}` : 'Sin límite',
      valueSetter: (p) => {
        p.data.montoMax = p.newValue === '' || p.newValue == null ? null : Number(p.newValue);
        return true;
      }
    },
  ];

  constructor() {
    effect(() => {
      const idCompany = this.signalsService.getRootSelectedBySidebar()();
      if (idCompany) {
        this.idCompany = idCompany;
        this.loadData(idCompany);
      }
    });
  }

  ngOnInit() {}

  onGridReady(event: GridReadyEvent) {
    this.gridApi = event.api;
  }

  onCellValueChanged(event: any) {
    event.data.__modified = true;
    this.hasChanges = true;
    this.gridApi.refreshCells({ rowNodes: [event.node], force: true });
  }

  private async loadData(idCompany: number) {
    try {
      const data = await lastValueFrom(
        this.http.get<AutorizacionMonto[]>(
          `${environment.urlWarehouse}/AutorizacionMonto/${idCompany}`,
          { headers: this.trackingService.getHeaders() }
        )
      );
      this.rowData = Array.isArray(data) ? data : this.defaultLevels(idCompany);
    } catch {
      // Backend no implementado aún — usar datos locales
      this.rowData = this.defaultLevels(idCompany);
    }
    if (this.gridApi) {
      this.gridApi.setGridOption('rowData', this.rowData);
    }
  }

  private defaultLevels(idCompany: number): AutorizacionMonto[] {
    return [
      { idCompany, nivel: 1, montoMin: 1,      montoMax: 5000,   descripcion: 'Nivel 1: $1 a $5,000',              active: true },
      { idCompany, nivel: 2, montoMin: 5001,    montoMax: 25000,  descripcion: 'Nivel 2: $5,001 a $25,000',         active: true },
      { idCompany, nivel: 3, montoMin: 25001,   montoMax: 100000, descripcion: 'Nivel 3: $25,001 a $100,000',       active: true },
      { idCompany, nivel: 4, montoMin: 100001,  montoMax: null,   descripcion: 'Nivel 4: $100,001 en adelante',     active: true }
    ];
  }

  async save() {
    const modified = this.rowData.filter(r => r.__modified);
    if (modified.length === 0) return;

    this.saving = true;
    try {
      for (const row of modified) {
        const payload = { ...row };
        delete payload.__modified;

        if (row.id) {
          await lastValueFrom(
            this.http.put(
              `${environment.urlWarehouse}/AutorizacionMonto/${row.id}`,
              payload,
              { headers: this.trackingService.getHeaders() }
            )
          );
        } else {
          const created = await lastValueFrom(
            this.http.post<AutorizacionMonto>(
              `${environment.urlWarehouse}/AutorizacionMonto`,
              payload,
              { headers: this.trackingService.getHeaders() }
            )
          );
          row.id = created.id;
        }
        row.__modified = false;
      }

      this.hasChanges = false;
      this.gridApi.redrawRows();
      alerts.basicAlert('Guardado', 'Configuración de montos guardada.', 'success');
    } catch {
      alerts.basicAlert('Error', 'No se pudo guardar. El backend aún no está implementado.', 'warning');
    } finally {
      this.saving = false;
    }
  }
}
