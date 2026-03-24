import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef } from 'ag-grid-enterprise';
import { BitacoraBaseComponent, BITACORA_TEMPLATE, BITACORA_STYLES, DATE_COL } from './bitacora-base.component';
import { alerts } from 'app/helpers/alerts';
import { CatalogadmonService } from 'app/services/catalogadmon.service';
import { EmployeesService } from 'app/services/employees.service';

@Component({
  selector: 'app-bitacora-personal',
  standalone: true,
  imports: [CommonModule, AgGridModule],
  template: BITACORA_TEMPLATE,
  styles: BITACORA_STYLES,
})
export class BitacoraPersonalComponent extends BitacoraBaseComponent {
  private catalogAdmonService = inject(CatalogadmonService);
  private employeesService    = inject(EmployeesService);

  readonly bitacoraType  = 'personal';
  readonly typeNoteValue = 'PERSONAL';
  readonly editableCols  = ['position', 'empleado', 'quantity', 'start', 'end', 'asistencia', 'description'];
  readonly requiredFields = [
    { field: 'position', label: 'Puesto'   },
    { field: 'quantity', label: 'Cantidad' },
  ];

  asistenciaValues: string[] = [];
  empleadosCatalog: any[]    = [];
  empleadosValues:  string[] = [];

  protected override onLoadCatalogs(idRoot: number): void {
    this.catalogAdmonService.getCatalogs(idRoot, 'ASISTENCIA').subscribe({
      next: (r: any[]) => { this.asistenciaValues = r.map(a => a.description); },
      error: () => {},
    });
    this.employeesService.getEmployees(-idRoot).subscribe({
      next: (r: any) => {
        this.empleadosCatalog = Array.isArray(r) ? r : (r?.data ?? []);
        this.empleadosValues  = this.empleadosCatalog.map((e: any) => e.name);
      },
      error: () => {},
    });
  }

  get colDefs(): ColDef[] {
    return [
      { headerName: '#', width: 45, valueGetter: (p) => p.node!.rowIndex! + 1, pinned: 'left', editable: false },
      {
        field: 'position', headerName: 'Puesto', editable: true, width: 220,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: () => ({ values: this.posicionesValues }),
        valueFormatter: (p) => p.value || '',
      },
      {
        field: 'empleado', headerName: 'Empleado', editable: true, width: 220,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: () => ({ values: this.empleadosValues }),
        valueGetter: (p: any) => p.data?.empleado ?? '',
        valueSetter: (p: any) => { p.data.empleado = p.newValue ?? null; return true; },
      },
      { field: 'quantity', headerName: 'Cantidad', editable: true, width: 100, type: 'numericColumn' },
      { field: 'start',    headerName: 'Inicio',   editable: true, width: 120 },
      { field: 'end',      headerName: 'Término',  editable: true, width: 120 },
      {
        field: 'asistencia', headerName: 'Asistencia', editable: true, width: 150,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: () => ({ values: this.asistenciaValues }),
        valueFormatter: (p) => p.value || '',
      },
    ];
  }

  override addRow(): void {
    const newRow = {
      id: `temp_${this.tempIdCounter++}`,
      idReporte: this.reportData?.id,
      date: this.reportData?.date ? String(this.reportData.date).substring(0, 10) : new Date().toISOString().split('T')[0],
      empleado: null,
      quantity: 1,
      start: null,
      end: null,
      asistencia: null,
      description: null,
      active: true, __isNew: true, __modified: false,
    };
    this.rowData = [newRow, ...this.rowData];
    this.hasUnsavedChanges = true;
    setTimeout(() => {
      this.gridApi?.setGridOption('rowData', this.rowData);
      this.gridApi?.startEditingCell({ rowIndex: 0, colKey: this.editableCols[0] });
    }, 50);
  }

  override onCellValueChanged(event: any): void {
    if (event.colDef.field === 'quantity') {
      const qty = Number(event.newValue);
      if (!qty || qty < 1) {
        event.data.quantity = 1;
        this.gridApi.refreshCells({ rowNodes: [event.node], columns: ['quantity'], force: true });
      }
    }

    if (event.colDef.field === 'position' && event.newValue) {
      const duplicateExists = this.rowData.some((row, index) =>
        index !== event.rowIndex &&
        row.position === event.newValue
      );

      if (duplicateExists) {
        alerts.basicAlert(
          'Puesto duplicado',
          `El puesto "${event.newValue}" ya está agregado. No se permiten puestos repetidos.`,
          'warning'
        );
        event.node.setDataValue('position', event.oldValue);
        return;
      }
    }

    if (!event.data.__isNew) event.data.__modified = true;
    this.hasUnsavedChanges = true;
  }

  protected override remapFromDb(item: any): any {
    return { ...item, empleado: item.descriptionconcept ?? null, asistencia: item.supervisor ?? null };
  }

  buildPayload(item: any): any {
    return {
      ...this.basePayload(item),
      description:       item.description?.trim() || null,
      position:          item.position     ?? null,
      start:             item.start        ?? null,
      end:               item.end          ?? null,
      supervisor:        item.asistencia   ?? null,
      descriptionconcept: item.empleado    ?? null,
      idResource:        item.idResource   ?? null,
    };
  }
}
