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
import { UsersService } from 'app/services/users.service';
import { lastValueFrom } from 'rxjs';
import Swal from 'sweetalert2';

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
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-sm btn-success"
                  (click)="add()"
                  [disabled]="!gridApi">
            <i class="bi bi-plus-lg"></i> Agregar
          </button>
          <button class="btn btn-sm btn-primary position-relative"
                  (click)="save()"
                  [disabled]="!hasChanges || saving">
            <i class="bi bi-floppy"></i> Guardar
            <span *ngIf="hasChanges"
                  class="position-absolute top-0 start-100 translate-middle p-1 bg-danger border border-light rounded-circle">
            </span>
          </button>
          <button class="btn btn-sm btn-warning"
                  (click)="revertChanges()"
                  [disabled]="!hasChanges">
            <i class="bi bi-arrow-clockwise"></i> Deshacer
          </button>
        </div>
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
  private usersService = inject(UsersService);

  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;
  public gridApi!: GridApi;

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
    },
    getRowStyle: (p: any) => {
      if (p.data?.active === false || p.data?.active === 0) {
        return {
          backgroundColor: '#f5f5f5',
          color: '#757575',
          fontStyle: 'italic',
          borderLeft: '4px solid #bdbdbd'
        };
      }
      return undefined;
    }
  };

  public colDefs: ColDef[] = [
    {
      field: 'active',
      headerName: 'Activo',
      width: 100,
      editable: true,
      cellRenderer: 'agCheckboxCellRenderer',
      cellEditor: 'agCheckboxCellEditor'
    },
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
    if (event.colDef.field === 'active') {
      const desactivando = (event.oldValue === true || event.oldValue === 1) &&
                           (event.newValue === false || event.newValue === 0);
      if (desactivando && event.data.id) {
        this.checkNivelDeactivation(event);
      }
      this.gridApi.redrawRows({ rowNodes: [event.node] });
    } else {
      this.gridApi.refreshCells({ rowNodes: [event.node], force: true });
    }
  }

  private revertActive(event: any) {
    event.node.setDataValue('active', true);
  }

  private async checkNivelDeactivation(event: any) {
    const nivel = event.data;
    try {
      const resp: any = await lastValueFrom(this.usersService.getUsersByNivelMonto(nivel.id));
      const lista: any[] = Array.isArray(resp?.data) ? resp.data : [];
      if (lista.length === 0) {
        return;
      }
      const nombres = lista
        .map((u: any) => u.displayName || u.email || `Usuario ${u.id}`)
        .join(', ');
      const confirm = await alerts.confirmAlert(
        'No puedes desactivar este nivel',
        `El nivel "${nivel.descripcion}" está asignado a ${lista.length} usuario(s):\n\n${nombres}\n\n¿Deseas moverlos a otro nivel?`,
        'warning',
        'Sí, mover'
      );
      if (!confirm.isConfirmed) {
        this.revertActive(event);
        return;
      }
      await this.moverUsuariosYDesactivar(event, nivel);
    } catch (e) {
      console.error('Error verificando usuarios del nivel:', e);
      alerts.basicAlert('Error', 'No se pudo verificar los usuarios del nivel.', 'error');
      this.revertActive(event);
    }
  }

  private async moverUsuariosYDesactivar(event: any, nivel: AutorizacionMonto) {
    const destinos = this.rowData.filter(n =>
      n.id && n.id !== nivel.id && (n.active === true || (n.active as any) === 1)
    );
    if (destinos.length === 0) {
      alerts.basicAlert(
        'Sin nivel destino',
        'No hay otro nivel activo disponible. Active otro nivel antes de desactivar este.',
        'warning'
      );
      this.revertActive(event);
      return;
    }

    const inputOptions: any = {};
    destinos.forEach(n => { inputOptions[n.id!] = n.descripcion; });

    const seleccion = await Swal.fire({
      title: 'Mover usuarios a otro nivel',
      text: `Selecciona el nivel destino para los usuarios del nivel "${nivel.descripcion}".`,
      input: 'select',
      inputOptions,
      inputPlaceholder: 'Selecciona un nivel',
      showCancelButton: true,
      confirmButtonText: 'Mover y desactivar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      inputValidator: (value) => !value ? 'Debes seleccionar un nivel destino' : null
    });

    if (!seleccion.isConfirmed || !seleccion.value) {
      this.revertActive(event);
      return;
    }

    const toNivel = Number(seleccion.value);
    try {
      await lastValueFrom(this.usersService.reasignarNivelMonto(nivel.id!, toNivel));
      const payload: any = { ...nivel, active: false };
      delete payload.__modified;
      await lastValueFrom(
        this.http.put(
          `${environment.urlWarehouse}/AutorizacionMonto/${nivel.id}`,
          payload,
          { headers: this.trackingService.getHeaders() }
        )
      );
      this.hasChanges = false;
      alerts.basicAlert('Listo', 'Usuarios reasignados y nivel desactivado.', 'success');
      this.loadData(this.idCompany);
    } catch (e) {
      console.error('Error moviendo usuarios:', e);
      alerts.basicAlert('Error', 'No se pudo completar la operación.', 'error');
      this.revertActive(event);
    }
  }

  private async loadData(idCompany: number) {
    try {
      const data = await lastValueFrom(
        this.http.get<AutorizacionMonto[]>(
          `${environment.urlWarehouse}/AutorizacionMonto/${idCompany}`,
          { headers: this.trackingService.getHeaders() }
        )
      );
      this.rowData = Array.isArray(data) && data.length > 0 ? data : this.defaultLevels(idCompany);
    } catch (error) {
      console.error('Error loading AutorizacionMonto data:', error);
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

  public revertChanges() {
    this.loadData(this.idCompany);
    this.hasChanges = false;
  }

  public add() {
    const maxNivel = Math.max(...this.rowData.map(r => r.nivel), 0);
    const newRow: AutorizacionMonto = {
      idCompany: this.idCompany,
      nivel: maxNivel + 1,
      montoMin: 0,
      montoMax: null,
      descripcion: `Nivel ${maxNivel + 1}`,
      active: true,
      __modified: true
    };
    this.rowData = [newRow, ...this.rowData];
    this.gridApi.setGridOption('rowData', this.rowData);
    this.hasChanges = true;
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
      alerts.basicAlert('Guardado', 'Configuración de montos guardada.', 'success');
      this.loadData(this.idCompany);
    } catch (error) {
      console.error('Error saving AutorizacionMonto:', error);
      alerts.basicAlert('Error', 'No se pudo guardar la configuración.', 'error');
    } finally {
      this.saving = false;
    }
  }
}
