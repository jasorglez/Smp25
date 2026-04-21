import { Component, effect, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { ProspectosService, Prospecto, ESTADOS_PROSPECTO } from 'app/services/prospectos.service';
import { SignalsService } from 'app/services/signals.service';
import { UsersService } from 'app/services/users.service';
import { DetalleInteraccionesComponent } from './detalle-interacciones.component';
import { ButtonCellRendererIncomeComponent } from 'app/domains/ModAdmon/components/income/button-cell-renderer-income.component';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-prospectos',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, DetalleInteraccionesComponent, ButtonCellRendererIncomeComponent],
  templateUrl: './prospectos.component.html',
  styleUrl: './prospectos.component.scss',
})
export class ProspectosComponent implements OnInit {
  private svc        = inject(ProspectosService);
  private signalsSvc = inject(SignalsService);
  private usersSvc   = inject(UsersService);
  private _colDefs: ColDef[] = [];

  constructor() {
    effect(() => {
      const idRoot = this.signalsSvc.getRootSelectedBySidebar()();
      if (idRoot) {
        this.usersSvc.get2fieldsUsers(idRoot).subscribe({
          next: (res: any) => {
            const data: any[] = res?.data ?? res ?? [];
            this.vendedores = data.map((u: any) => ({ id: u.id, displayName: u.displayName ?? u.DisplayName ?? '' }));
          },
        });
      }
    });
  }

  gridApi!: GridApi;
  AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  rowData:          any[]    = [];
  originalData:     any[]    = [];
  selectedItem:     any      = null;
  hasUnsavedChanges = false;
  loading           = false;

  vendedores: { id: number; displayName: string }[] = [];

  get idVendedor()     { return this.signalsSvc.idUser(); }
  get idRoot()         { return this.signalsSvc.getRootSelectedBySidebar()(); }
  get nombreVendedor() { return this.signalsSvc.getDisplayName()(); }

  // ── Enter-key navigation ─────────────────────────────────────────────────
  private editableColumnOrder = ['nombreVendedorActual', 'empresa', 'nombre', 'puesto', 'telefono', 'domicilio', 'estado'];
  private enterPressed = false;

  defaultColDef: ColDef = {
    sortable: true, resizable: true, minWidth: 80,
    suppressKeyboardEvent: (params) => {
      if (params.event.key === 'Enter' && params.editing) {
        this.enterPressed = true;
        setTimeout(() => { if (this.gridApi) this.gridApi.stopEditing(); }, 0);
        return true;
      }
      return false;
    },
  };

  onCellEditingStopped(event: any) {
    if (!event.data.__isNew) {
      event.data.__modified = true;
      this.hasUnsavedChanges = true;
    }
    if (!this.enterPressed) return;
    this.enterPressed = false;
    const idx = this.editableColumnOrder.indexOf(event.column.getColId());
    if (idx !== -1 && idx < this.editableColumnOrder.length - 1) {
      setTimeout(() => {
        this.gridApi.startEditingCell({ rowIndex: event.rowIndex, colKey: this.editableColumnOrder[idx + 1] });
      }, 100);
    }
  }

  // ── Grid Options (master-detail) ──────────────────────────────────────────

  gridOptions: any = {
    headerHeight: 35,
    rowHeight: 28,
    suppressDragLeaveHidesColumns: true,
    rowSelection: 'single',
    masterDetail: true,
    detailRowHeight: 400,
    isRowMaster: () => true,
    detailCellRenderer: DetalleInteraccionesComponent,
    rowClassRules: {
      'new-row-highlight': (p: any) => !!p.data?.__isNew,
      'row-inactivo':      (p: any) => p.data?.activo === false,
      'row-ganado':        (p: any) => !p.data?.__isNew && p.data?.estado === 'ganado',
      'row-perdido':       (p: any) => !p.data?.__isNew && p.data?.estado === 'perdido',
    },
    onRowClicked: (event: any) => {
      const colId = event.column?.getColId();
      if (colId !== 'historial') {
        this.selectedItem = event.data;
      }
    },
  };

  get colDefs(): ColDef[] {
    if (this._colDefs.length > 0) return this._colDefs;

    this._colDefs = [
      {
        field: 'historial',
        headerName: 'Historial',
        width: 105,
        editable: false,
        cellRenderer: ButtonCellRendererIncomeComponent,
        cellRendererParams: {
          onClick: (node: any) => this.toggleCascade(node),
          icon: 'bi-clock-history',
          title: 'Ver interacciones',
        },
        valueGetter: (params) => params.data?.countInteracciones ?? 0,
        cellStyle: { backgroundColor: '#e8f0fb', cursor: 'pointer' },
      },
      {
        field: 'estado', headerName: 'Estado', width: 155,
        editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: { values: ESTADOS_PROSPECTO.map(e => e.value) },
        cellRenderer: (p: any) => {
          if (p.data?.activo === false) {
            return '<span class="badge prospecto-eliminado-badge">Eliminado</span>';
          }
          const e = ESTADOS_PROSPECTO.find(x => x.value === p.value);
          return e ? `<span class="badge bg-${e.color}">${e.icon} ${e.label}</span>` : p.value ?? '';
        },
      },
      {
        field: 'nombreVendedorActual', headerName: 'Vendedor', width: 185, editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: () => ({ values: this.vendedores.map(v => v.displayName) }),
        valueSetter: (params: any) => {
          params.data.nombreVendedorActual = params.newValue;
          const found = this.vendedores.find(v => v.displayName === params.newValue);
          if (found) params.data.idVendedorActual = found.id;
          return true;
        },
      },
      { field: 'empresa',  headerName: 'Empresa',  width: 180, editable: true, filter: true },
      { field: 'nombre',   headerName: 'Nombre',   width: 160, editable: true, filter: true },
      { field: 'puesto',   headerName: 'Puesto',   width: 140, editable: true },
      { field: 'telefono', headerName: 'Teléfono', width: 145, editable: true },
      { field: 'domicilio', headerName: 'Domicilio', width: 220, editable: true, filter: true },
      {
        field: 'fechaUltimaInteraccion',
        headerName: 'Última Interacción', width: 175, editable: false,
        cellRenderer: (p: any) => this.formatFecha(p.value),
      },
      {
        field: 'creadoPor', headerName: 'Canal', width: 90, editable: false,
        cellRenderer: (p: any) => {
          const icon = p.value === 'telegram' ? '📱' : '🖥️';
          return `${icon} ${p.value ?? ''}`;
        },
      },
    ];

    return this._colDefs;
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  // ── Cascada (igual que income) ────────────────────────────────────────────

  toggleCascade(node: any) {
    const api = this.gridApi;
    const isExpanded = node.expanded;

    if (isExpanded) {
      node.setExpanded(false);
      api.forEachNode((n: any) => n.setRowHeight(undefined));
      api.onRowHeightChanged();
    } else {
      // Colapsar cualquier otro expandido
      api.forEachNode((n: any) => {
        if (n.expanded && n.id !== node.id) n.setExpanded(false);
      });
      // Ocultar otras filas
      api.forEachNode((n: any) => {
        if (n.id !== node.id) n.setRowHeight(0);
      });
      api.onRowHeightChanged();

      setTimeout(() => node.setExpanded(true), 0);
    }
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  ngOnInit() {
    this.cargarProspectos();
  }

  private ordenarProspectos(data: any[]) {
    return [...data].sort((a, b) => {
      if (!!a.__isNew !== !!b.__isNew) return a.__isNew ? -1 : 1;
      if ((a.activo !== false) !== (b.activo !== false)) return a.activo === false ? 1 : -1;
      return 0;
    });
  }

  cargarProspectos() {
    this.loading = true;
    this.svc.getProspectos(this.idVendedor).subscribe({
      next: data => {
        this.rowData = this.ordenarProspectos(data.map(p => ({
          ...p,
          activo: (p as any).activo ?? true,
          domicilio: (p as any).domicilio ?? '',
          countInteracciones: (p as any).countInteracciones ?? 0,
          __isNew: false,
          __modified: false,
        })));
        this.originalData = JSON.parse(JSON.stringify(this.rowData));
        this.hasUnsavedChanges = false;
        this.loading = false;
      },
      error: () => { this.loading = false; },
    });
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  add() {
    const nuevo: any = {
      nombre: '', telefono: 'SIN NUMERO', empresa: '', puesto: 'GERENTE', domicilio: 'SIN DOMICILIO', estado: 'nuevo',
      idVendedorActual: this.idVendedor, nombreVendedorActual: this.nombreVendedor,
      chatIdVendedorActual: '', idCompany: this.idRoot,
      creadoPor: 'web', idVendedorCreador: this.idVendedor,
      notas: '', idCustomer: null, activo: true,
      fechaCreacion: null, fechaUltimaInteraccion: null,
      countInteracciones: 0,
      __isNew: true, __modified: false,
    };
    this.rowData = this.ordenarProspectos([nuevo, ...this.rowData]);
    this.hasUnsavedChanges = true;
    setTimeout(() => {
      this.gridApi.setGridOption('rowData', this.rowData);
      this.gridApi.startEditingCell({ rowIndex: 0, colKey: 'empresa' });
    }, 50);
  }

  async saveChanges() {
    this.gridApi?.stopEditing();

    const toSave = this.rowData.filter(p => p.__isNew || p.__modified);
    if (!toSave.length) return;

    const errores: string[] = [];
    for (const p of toSave) {
      const empresa = p.empresa?.trim() ?? '';
      const nombre = p.nombre?.trim() ?? '';

      if (!empresa || !nombre) {
        const camposFaltantes = [
          !empresa ? 'Empresa' : null,
          !nombre ? 'Nombre' : null,
        ].filter(Boolean).join('/');

        errores.push(`Sin ${camposFaltantes}: "${empresa || nombre || '(vacio)'}"`);
        continue;
      }
      try {
        if (p.__isNew) {
          await this.svc.crearProspecto(p);
        } else {
          await this.svc.actualizarProspecto(p.id!, {
            nombre: p.nombre, telefono: p.telefono,
            empresa: p.empresa, puesto: p.puesto, domicilio: p.domicilio, estado: p.estado,
            idVendedorActual: p.idVendedorActual,
            nombreVendedorActual: p.nombreVendedorActual,
          });
        }
      } catch {
        errores.push(`Error al guardar: ${p.nombre}`);
      }
    }

    if (errores.length) {
      Swal.fire('Atención', errores.join('\n'), 'warning');
    } else {
      Swal.fire({ icon: 'success', title: 'Guardado', timer: 1200, showConfirmButton: false });
    }
  }

  revertChanges() {
    this.rowData = JSON.parse(JSON.stringify(this.originalData));
    this.hasUnsavedChanges = false;
    this.gridApi.setGridOption('rowData', this.rowData);
  }

  async deleteSelected() {
    if (!this.selectedItem) return;
    const res = await Swal.fire({
      title: '¿Eliminar prospecto?', text: this.selectedItem.nombre,
      icon: 'warning', showCancelButton: true,
      confirmButtonColor: '#dc3545',
      confirmButtonText: 'Sí, eliminar', cancelButtonText: 'Cancelar',
    });
    if (!res.isConfirmed) return;

    if (this.selectedItem.__isNew) {
      this.rowData = this.rowData.filter(p => p !== this.selectedItem);
      this.gridApi.setGridOption('rowData', this.rowData);
      if (!this.rowData.some(p => p.__isNew || p.__modified)) this.hasUnsavedChanges = false;
      this.selectedItem = null;
      return;
    }
    try {
      await this.svc.actualizarProspecto(this.selectedItem.id!, { activo: false } as any);
      this.selectedItem.activo = false;
      this.selectedItem.__modified = false;
      this.rowData = this.ordenarProspectos(this.rowData);
      this.originalData = JSON.parse(JSON.stringify(this.rowData));
      this.gridApi.setGridOption('rowData', this.rowData);
      this.selectedItem = null;
      Swal.fire({ icon: 'success', title: 'Eliminado', timer: 1200, showConfirmButton: false });
    } catch {
      Swal.fire('Error', 'No se pudo eliminar.', 'error');
    }
  }

  formatFecha(ts: any): string {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
}

