import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef } from 'ag-grid-enterprise';
import { BitacoraBaseComponent, BITACORA_TEMPLATE, BITACORA_STYLES, DATE_COL } from './bitacora-base.component';
import { alerts } from 'app/helpers/alerts';

@Component({
  selector: 'app-bitacora-personal',
  standalone: true,
  imports: [CommonModule, AgGridModule],
  template: BITACORA_TEMPLATE,
  styles: BITACORA_STYLES,
})
export class BitacoraPersonalComponent extends BitacoraBaseComponent {
  readonly bitacoraType  = 'personal';
  readonly typeNoteValue = 'PERSONAL';
  readonly editableCols  = ['position', 'quantity', 'start', 'end', 'description'];
  readonly requiredFields = [
    { field: 'position', label: 'Puesto'   },
    { field: 'quantity', label: 'Cantidad' },
  ];

  get colDefs(): ColDef[] {
    return [
      { headerName: '#', width: 45, valueGetter: (p) => p.node!.rowIndex! + 1, pinned: 'left', editable: false },
      {
        field: 'position', headerName: 'Puesto', editable: true, width: 260,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: () => ({ values: this.posicionesValues }),
        valueFormatter: (p) => p.value || '',
      },
      { field: 'quantity',    headerName: 'Cantidad',    editable: true, width: 150,  type: 'numericColumn' },
      { field: 'start',       headerName: 'Inicio',      editable: true, width: 150  },
      { field: 'end',         headerName: 'Término',     editable: true, width: 150  },
    ];
  }

  override addRow(): void {
    const newRow = {
      id: `temp_${this.tempIdCounter++}`,
      idReporte: this.reportData?.id,
      position: '',
      quantity: 1,
      start: null,
      end: null,
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
      event.data.quantity = 1;
      this.gridApi.refreshCells({ rowNodes: [event.node], columns: ['quantity'], force: true });
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

  buildPayload(item: any): any {
    return {
      ...this.basePayload(item),
      description: item.description?.trim() || null,
      position:    item.position    ?? null,
      start:       item.start       ?? null,
      end:         item.end         ?? null,
      idResource:  item.idResource  ?? null,
    };
  }
}
