import { Component, EventEmitter, Input, OnChanges, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi } from 'ag-grid-enterprise';
import { WorkprogramApuService } from 'app/services/workprogram-apu.service';
import { PosicionesService } from 'app/services/posiciones.service';
import { EquipmentService } from 'app/services/equipment.service';
import { MaterialsService } from 'app/services/materials.service';
import { SignalsService } from 'app/services/signals.service';
import { alerts } from 'app/helpers/alerts';

@Component({
  selector: 'app-workprogram-apu',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  templateUrl: './workprogram-apu.component.html',
})
export class WorkprogramApuComponent implements OnChanges {
  @Input() visible = false;
  @Input() idWorkprogram: number | null = null;
  @Input() taskName = '';
  @Output() closed = new EventEmitter<void>();
  @Output() costUpdated = new EventEmitter<number>();

  private apuService      = inject(WorkprogramApuService);
  private posService      = inject(PosicionesService);
  private equipService    = inject(EquipmentService);
  private materialService = inject(MaterialsService);
  private signalsService  = inject(SignalsService);

  gridApi!: GridApi;
  rowData: any[] = [];
  displayRows: any[] = [];   // filas del tab activo — array estable, sin parpadeo
  activeType = 'PERSONAL';
  hasChanges = false;
  selectedRow: any = null;
  appliedTotal = 0;

  // Catálogos normalizados: { id, description, unit, cost }
  catalogPersonal: any[] = [];
  catalogEquipo:   any[] = [];
  catalogMaterial: any[] = [];

  private _colDefs: ColDef[] = [];

  readonly types = [
    { key: 'PERSONAL', label: 'Personal', icon: 'bi-people'   },
    { key: 'MATERIAL', label: 'Material', icon: 'bi-box-seam' },
    { key: 'EQUIPO',   label: 'Equipo',   icon: 'bi-truck'    },
  ];

  readonly rowClassRules = {
    'new-row-highlight': (p: any) => !!p.data?.__isNew,
  };

  readonly defaultColDef: ColDef = {
    resizable: true,
    sortable: true,
    minWidth: 80,
  };

  get colDefs(): ColDef[] {
    if (this._colDefs.length > 0) return this._colDefs;
    this._colDefs = [
      { headerName: '#', width: 45, valueGetter: (p) => p.node!.rowIndex! + 1, editable: false },
      {
        field: 'description', headerName: 'Descripcion', flex: 2, editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: (p: any) => ({
          values: this.getCatalogByType(p.data?.type ?? this.activeType).map((i) => i.description),
        }),
        valueSetter: (p: any) => {
          const type = p.data?.type ?? this.activeType;
          const item = this.getCatalogByType(type).find((i) => i.description === p.newValue);
          if (item) {
            const duplicate = this.rowData.find(
              (r) => r !== p.data && r.type === type && r.id_reference === item.id
            );
            if (duplicate) {
              alerts.basicAlert('Duplicado', `"${p.newValue}" ya existe en este APU`, 'warning');
              return false;
            }
            p.data.id_reference = item.id;
            if (!p.data.unit_cost || p.data.unit_cost === 0) p.data.unit_cost = item.cost ?? 0;
            if (!p.data.unit) p.data.unit = item.unit ?? '';
          }
          p.data.description = p.newValue;
          return true;
        },
        cellStyle: (p) => p.data?.__isNew ? { background: '#fffde7' } : {},
      },
      { field: 'unit', headerName: 'Unidad', width: 90, editable: true },
      {
        field: 'quantity', headerName: 'Cantidad', width: 100, editable: true, type: 'numericColumn',
        valueFormatter: (p) => p.value != null ? Number(p.value).toFixed(4) : '',
      },
      {
        field: 'unit_cost', headerName: 'Costo Unit.', width: 120, editable: true, type: 'numericColumn',
        valueFormatter: (p) => p.value != null ? ('$' + Number(p.value).toLocaleString('es-MX', { minimumFractionDigits: 2 })) : '',
      },
      {
        field: 'total', headerName: 'Total', width: 130, editable: false, type: 'numericColumn',
        valueGetter: (p) => (p.data?.quantity ?? 0) * (p.data?.unit_cost ?? 0),
        valueFormatter: (p) => '$' + Number(p.value).toLocaleString('es-MX', { minimumFractionDigits: 2 }),
        cellStyle: { fontWeight: '600', color: '#0e4491' },
      },
      {
        field: 'apply_to_cost', headerName: 'Aplicar', width: 80, editable: false,
        cellRenderer: (p: any) => '<input type="checkbox" ' + (p.value ? 'checked' : '') + ' style="cursor:pointer;width:16px;height:16px;">',
        onCellClicked: (p) => {
          p.data.apply_to_cost = !p.data.apply_to_cost;
          if (!p.data.__isNew) p.data.__modified = true;
          this.hasChanges = true;
          this.recalcAppliedTotal();
          this.gridApi?.refreshCells({ rowNodes: [p.node!] });
        },
      },
    ];
    return this._colDefs;
  }

  private refreshDisplayRows(): void {
    this.displayRows = this.rowData.filter((r) => r.type === this.activeType);
    this.gridApi?.setGridOption('rowData', this.displayRows);
  }

  get allApplied(): boolean {
    return this.displayRows.length > 0 && this.displayRows.every((r) => r.apply_to_cost);
  }

  countByType(type: string): number {
    return this.rowData.filter((r) => r.type === type).length;
  }

  ngOnChanges(): void {
    if (this.visible && this.idWorkprogram) {
      this.loadCatalogs();
      this.loadData();
    }
  }

  private loadCatalogs(): void {
    const idCompany = this.signalsService.getRootSelectedBySidebar()();
    if (!idCompany) return;

    this.posService.getPositionsByCompany(idCompany).subscribe({
      next: (data: any[]) => {
        this.catalogPersonal = data
          .filter((d) => d.active !== false)
          .map((d) => ({ id: d.Id ?? d.id, description: d.description, unit: 'DIA', cost: 0 }));
        this.gridApi?.refreshCells();
      },
    });

    this.equipService.getEquipment(idCompany).subscribe({
      next: (data: any[]) => {
        this.catalogEquipo = data
          .filter((d) => d.active !== false)
          .map((d) => ({ id: d.Id ?? d.id, description: d.description, unit: d.measure ?? 'HR', cost: d.costMN ?? d.costMX ?? 0 }));
        this.gridApi?.refreshCells();
      },
    });

    this.materialService.getMaterialsForApu(idCompany).subscribe({
      next: (data: any[]) => {
        this.catalogMaterial = data
          .map((d) => ({ id: d.id, description: d.description ?? '', unit: d.measure ?? '', cost: d.costoMN ?? 0 }));
        this.gridApi?.refreshCells();
      },
    });
  }

  getCatalogByType(type: string): any[] {
    if (type === 'PERSONAL') return this.catalogPersonal;
    if (type === 'EQUIPO')   return this.catalogEquipo;
    return this.catalogMaterial;
  }

  onGridReady(params: any): void {
    this.gridApi = params.api;
  }

  private loadData(): void {
    this.apuService.getByWorkprogram(this.idWorkprogram!).subscribe({
      next: (data) => {
        this.rowData = data.map((d) => ({ ...d, __isNew: false, __modified: false }));
        this.recalcAppliedTotal();
        this.hasChanges = false;
        this.refreshDisplayRows();
      },
      error: () => alerts.basicAlert('Error', 'No se pudo cargar el APU', 'error'),
    });
  }

  setType(type: string): void {
    this.activeType = type;
    this.selectedRow = null;
    this._colDefs = [];
    this.gridApi?.setGridOption('columnDefs', this.colDefs);
    this.refreshDisplayRows();
  }

  addRow(): void {
    const newRow = {
      id: null,
      id_workprogram: this.idWorkprogram,
      type: this.activeType,
      id_reference: null,
      description: '',
      unit: '',
      quantity: 0,
      unit_cost: 0,
      unit_cost_dll: 0,
      apply_to_cost: false,
      active: true,
      __isNew: true,
      __modified: false,
    };
    this.rowData = [newRow, ...this.rowData];
    this.hasChanges = true;
    this.refreshDisplayRows();
    setTimeout(() => {
      this.gridApi?.startEditingCell({ rowIndex: 0, colKey: 'description' });
    }, 50);
  }

  onCellValueChanged(event: any): void {
    if (!event.data.__isNew) event.data.__modified = true;
    this.hasChanges = true;
    this.recalcAppliedTotal();
    this.gridApi?.refreshCells({ rowNodes: [event.node] });
  }

  onSelectionChanged(event: any): void {
    const rows = this.gridApi?.getSelectedRows();
    this.selectedRow = rows?.length ? rows[0] : null;
  }

  async saveChanges(): Promise<void> {
    const toSave = this.rowData.filter((r) => r.__isNew || r.__modified);
    if (!toSave.length) { this.hasChanges = false; return; }

    try {
      for (const row of toSave) {
        const payload = {
          idWorkprogram: this.idWorkprogram,
          type:          row.type,
          idReference:   row.id_reference ?? null,
          description:   row.description?.trim() ?? '',
          unit:          row.unit?.trim() ?? null,
          quantity:      Number(row.quantity) || 0,
          unitCost:      Number(row.unit_cost) || 0,
          unitCostDll:   Number(row.unit_cost_dll) || 0,
          applyToCost:   row.apply_to_cost ?? false,
          active:        true,
        };
        if (row.__isNew) {
          const saved = await this.apuService.add(payload).toPromise();
          row.id = saved.id;
          row.__isNew = false;
        } else {
          await this.apuService.update(row.id, payload).toPromise();
          row.__modified = false;
        }
      }
      this.hasChanges = false;
      this.recalcAppliedTotal();
      alerts.basicAlert('Guardado', 'APU guardado correctamente', 'success');
    } catch {
      alerts.basicAlert('Error', 'Error al guardar el APU', 'error');
    }
  }

  revertChanges(): void {
    this.loadData();
  }

  deleteSelected(): void {
    if (!this.selectedRow) return;
    alerts.confirmAlert('Eliminar?', 'Se eliminara este item del APU', 'warning', 'Eliminar').then((r) => {
      if (!r.isConfirmed) return;
      if (this.selectedRow.id) {
        this.apuService.delete(this.selectedRow.id).subscribe({
          next: () => {
            this.rowData = this.rowData.filter((x) => x !== this.selectedRow);
            this.selectedRow = null;
            this.recalcAppliedTotal();
            this.refreshDisplayRows();
          },
          error: () => alerts.basicAlert('Error', 'No se pudo eliminar', 'error'),
        });
      } else {
        this.rowData = this.rowData.filter((x) => x !== this.selectedRow);
        this.selectedRow = null;
        this.refreshDisplayRows();
      }
    });
  }

  toggleApplyAll(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.displayRows.forEach((r) => {
      r.apply_to_cost = checked;
      if (!r.__isNew) r.__modified = true;
    });
    this.hasChanges = true;
    this.recalcAppliedTotal();
    this.gridApi?.refreshCells();
  }

  private recalcAppliedTotal(): void {
    this.appliedTotal = this.rowData
      .filter((r) => r.apply_to_cost)
      .reduce((sum, r) => sum + (Number(r.quantity) * Number(r.unit_cost)), 0);
  }

  applyToConcept(): void {
    if (this.appliedTotal === 0) return;
    const msg = 'Se actualizara el Costo MXN del concepto a $' +
      this.appliedTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 }) + '. Continuar?';
    alerts.confirmAlert('Aplicar al Concepto', msg, 'question', 'Si, aplicar').then((r) => {
      if (r.isConfirmed) {
        this.costUpdated.emit(this.appliedTotal);
        this.close();
      }
    });
  }

  close(): void {
    this.visible = false;
    this.rowData = [];
    this.hasChanges = false;
    this.selectedRow = null;
    this._colDefs = [];
    this.closed.emit();
  }
}
