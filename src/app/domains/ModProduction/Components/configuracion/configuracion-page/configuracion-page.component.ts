import { Component, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { SignalsService } from 'app/services/signals.service';
import { MaterialsService } from 'app/services/materials.service';
import { MaterialJarabeService } from 'app/services/material-jarabe.service';
import { SelectWithTooltipEditorV2Component } from 'app/shared/select-with-tooltip-editor-v2.component';
import { alerts } from 'app/helpers/alerts';
import { lastValueFrom } from 'rxjs';

@Component({
  selector: 'app-configuracion-page',
  standalone: true,
  imports: [CommonModule, AgGridModule, SelectWithTooltipEditorV2Component],
  template: `
    <div class="container-fluid p-3" style="height: calc(100vh - 80px); display: flex; flex-direction: column;">
      <div class="d-flex align-items-center gap-2 mb-2">
        <h5 class="mb-0">Ingredientes de Jarabe — Preparación 1</h5>
        <div class="d-flex gap-2 ms-auto">
          <button class="btn btn-sm btn-success" (click)="add()" [disabled]="!gridApi">
            <i class="bi bi-plus-lg"></i> Agregar
          </button>
          <button class="btn btn-sm btn-primary position-relative" (click)="saveChanges()" [disabled]="!hasUnsavedChanges">
            <i class="bi bi-floppy"></i> Guardar
            <span *ngIf="hasUnsavedChanges"
                  class="position-absolute top-0 start-100 translate-middle p-2 bg-danger border border-light rounded-circle">
            </span>
          </button>
          <button class="btn btn-sm btn-warning" (click)="revertChanges()">
            <i class="bi bi-arrow-clockwise"></i> Deshacer
          </button>
          <button class="btn btn-sm btn-danger" (click)="deleteSelected()" [disabled]="!selectedRow">
            <i class="bi bi-trash"></i> Borrar
          </button>
        </div>
      </div>
      <ag-grid-angular
        class="ag-theme-quartz small-text-ag-grid"
        style="width: 100%; flex: 1;"
        [rowData]="rowData()"
        [columnDefs]="colDefs"
        [gridOptions]="gridOptions"
        [localeText]="AG_GRID_LOCALE_ES"
        (gridReady)="onGridReady($event)"
        (cellValueChanged)="onCellValueChanged($event)"
        (rowClicked)="onRowClicked($event)"
        (cellEditingStopped)="onCellEditingStopped($event)">
      </ag-grid-angular>
    </div>
  `
})
export class ConfiguracionPageComponent {
  private signalsService   = inject(SignalsService);
  private materialsService = inject(MaterialsService);
  private jarabeService    = inject(MaterialJarabeService);

  gridApi!: GridApi;
  rowData = signal<any[]>([]);
  hasUnsavedChanges = false;
  selectedRow: any = null;

  private originalRowData: any[] = [];
  private allMaterials: any[] = [];
  private allJarabeConfigs: any[] = [];
  private enterPressed = false;
  private readonly editableColumnOrder = ['idArticulo', 'prefijoNota', 'prefijoLote'];

  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  constructor() {
    effect(() => {
      const idCompany = this.signalsService.getRootSelectedBySidebar()();
      if (idCompany) this.loadData(idCompany);
    });
  }

  colDefs: ColDef[] = [
    {
      headerName: '#',
      width: 55,
      valueGetter: p => (p.node?.rowIndex ?? 0) + 1,
      pinned: 'left',
      cellStyle: { backgroundColor: '#f8f9fa', fontWeight: 'bold' }
    },
    {
      field: 'idArticulo',
      headerName: 'Material',
      flex: 1,
      minWidth: 200,
      editable: p => !!p.data?.__isNew,
      cellEditor: SelectWithTooltipEditorV2Component,
      cellEditorParams: () => {
        const usados = new Set(
          this.rowData()
            .filter(r => !r.__deleted)
            .map(r => r.idArticulo)
            .filter(Boolean)
        );
        return {
          options: this.allMaterials
            .filter(m => !usados.has(m.id))
            .map(m => ({ id: m.id, description: m.articulo || m.insumo || '' }))
        };
      },
      valueFormatter: p => {
        if (!p.value) return '';
        const mat = this.allMaterials.find(m => m.id === p.value);
        return mat ? (mat.articulo || mat.insumo || '') : String(p.value);
      },
      cellStyle: p => p.data?.__isNew ? { backgroundColor: '#fff9c4' } : {}
    },
    {
      field: 'prefijoNota',
      headerName: 'Prefijo Nota',
      width: 130,
      editable: true
    },
    {
      field: 'consecutivoNota',
      headerName: 'Consecutivo',
      width: 120,
      editable: true,
      cellEditor: 'agNumberCellEditor'
    },
    {
      field: 'prefijoLote',
      headerName: 'Prefijo Lote',
      width: 130,
      editable: true
    }
  ];

  gridOptions: any = {
    headerHeight: 25,
    rowHeight: 22,
    rowSelection: 'single',
    suppressRowClickSelection: true,
    rowClassRules: { 'new-row-highlight': (p: any) => !!p.data?.__isNew },
    onRowClicked: (e: any) => e.node.setSelected(true),
    defaultColDef: {
      suppressKeyboardEvent: (params: any) => {
        if (params.event.key === 'Enter' && params.editing) {
          this.enterPressed = true;
          setTimeout(() => this.gridApi?.stopEditing(), 0);
          return true;
        }
        return false;
      }
    }
  };

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    const idCompany = this.signalsService.getRootSelectedBySidebar()();
    if (idCompany) this.loadData(idCompany);
  }

  onRowClicked(event: any) {
    this.selectedRow = event.data;
  }

  onCellValueChanged(event: any) {
    if (!event.data.__isNew) {
      event.data.__modified = true;
      this.hasUnsavedChanges = true;
    }
  }

  onCellEditingStopped(event: any) {
    // Al seleccionar material nuevo, marcar cambio
    if (event.data.__isNew && event.column.getColId() === 'idArticulo' && event.data.idArticulo) {
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

  private async loadData(idCompany: number) {
    try {
      const [materials, jarabeConfigs] = await Promise.all([
        lastValueFrom(this.materialsService.getMaterialsxview(idCompany)),
        lastValueFrom(this.jarabeService.getAll())
      ]);

      this.allMaterials = Array.isArray(materials) ? materials : [];
      this.allJarabeConfigs = Array.isArray(jarabeConfigs) ? jarabeConfigs : [];

      const matMap = new Map<number, any>(this.allMaterials.map(m => [Number(m.id), m]));

      const rows = this.allJarabeConfigs
        .filter(j => j.usarEnJarabe)
        .map(j => {
          const mat = matMap.get(Number(j.idMaterial)) ?? {};
          return {
            idArticulo:      j.idMaterial,
            jarabeConfig:    j,
            prefijoNota:     j.prefijoNota   ?? '',
            consecutivoNota: j.consecutivoNota ?? 0,
            prefijoLote:     j.prefijoLote   ?? '',
            __isNew:         false,
            __modified:      false,
          };
        });

      this.originalRowData = JSON.parse(JSON.stringify(rows));
      this.rowData.set(rows);
      this.hasUnsavedChanges = false;
      this.selectedRow = null;
    } catch (error) {
      console.error('Error loading jarabe materials:', error);
    }
  }

  add() {
    const newRow = {
      idArticulo:      null,
      jarabeConfig:    null,
      prefijoNota:     '',
      consecutivoNota: 0,
      prefijoLote:     '',
      __isNew:         true,
      __modified:      false,
    };
    this.rowData.set([newRow, ...this.rowData()]);
    this.hasUnsavedChanges = true;
    setTimeout(() => {
      this.gridApi.startEditingCell({ rowIndex: 0, colKey: 'idArticulo' });
    }, 0);
  }

  async saveChanges() {
    const rows = this.rowData();
    const toSave = rows.filter(r => (r.__isNew && r.idArticulo) || r.__modified);
    if (!toSave.length) return;

    try {
      for (const r of toSave) {
        const existing = this.allJarabeConfigs.find(j => j.idMaterial === r.idArticulo);
        const payload = {
          ...(existing ?? {}),
          idMaterial:      r.idArticulo,
          usarEnJarabe:    true,
          prefijoNota:     r.prefijoNota   || null,
          consecutivoNota: r.consecutivoNota ?? 0,
          prefijoLote:     r.prefijoLote   || null,
          active:          true,
        };
        await lastValueFrom(this.jarabeService.save(r.idArticulo, payload));
      }
      const idCompany = this.signalsService.getRootSelectedBySidebar()();
      if (idCompany) await this.loadData(idCompany);
      alerts.basicAlert('Guardado', 'Cambios guardados correctamente', 'success');
    } catch (error) {
      alerts.basicAlert('Error', 'No se pudo guardar', 'error');
    }
  }

  revertChanges() {
    this.rowData.set(JSON.parse(JSON.stringify(this.originalRowData)));
    this.hasUnsavedChanges = false;
    this.selectedRow = null;
  }

  async deleteSelected() {
    if (!this.selectedRow) return;

    if (this.selectedRow.__isNew) {
      this.rowData.set(this.rowData().filter(r => r !== this.selectedRow));
      this.selectedRow = null;
      this.hasUnsavedChanges = this.rowData().some(r => r.__isNew || r.__modified);
      return;
    }

    const found = this.allMaterials.find(m => Number(m.id) === Number(this.selectedRow.idArticulo));
    const nombre = found ? (found.articulo || found.insumo || '') : String(this.selectedRow.idArticulo);

    const res = await alerts.confirmAlert(
      'Quitar ingrediente',
      `¿Desactivar "${nombre}" de Jarabe?`,
      'warning',
      'Sí, quitar'
    );
    if (!res.isConfirmed) return;

    try {
      await lastValueFrom(
        this.jarabeService.save(this.selectedRow.idArticulo, {
          ...this.selectedRow.jarabeConfig,
          usarEnJarabe: false
        })
      );
      const idCompany = this.signalsService.getRootSelectedBySidebar()();
      this.selectedRow = null;
      if (idCompany) await this.loadData(idCompany);
      alerts.basicAlert('Listo', 'Ingrediente quitado del jarabe', 'success');
    } catch (error) {
      alerts.basicAlert('Error', 'No se pudo actualizar', 'error');
    }
  }
}
