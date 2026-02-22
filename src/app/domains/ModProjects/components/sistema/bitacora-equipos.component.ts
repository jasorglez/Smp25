import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef } from 'ag-grid-enterprise';
import { BitacoraBaseComponent, BITACORA_TEMPLATE, BITACORA_STYLES } from './bitacora-base.component';
import { alerts } from 'app/helpers/alerts';
import { EquipmentService } from 'app/services/equipment.service';

@Component({
  selector: 'app-bitacora-equipos',
  standalone: true,
  imports: [CommonModule, AgGridModule],
  template: BITACORA_TEMPLATE,
  styles: BITACORA_STYLES,
})
export class BitacoraEquiposComponent extends BitacoraBaseComponent {
  private equipmentService = inject(EquipmentService);
  
  readonly bitacoraType  = 'equipos';
  readonly typeNoteValue = 'EQUIPMENT';
  readonly editableCols  = ['name', 'quantity', 'hours', 'description'];
  readonly requiredFields = [
    { field: 'name',     label: 'Equipo'   },
    { field: 'quantity', label: 'Cantidad' },
  ];

  equiposCatalog: any[] = [];

  protected override onLoadCatalogs(idRoot: number): void {
    this.equipmentService.getEquipment(idRoot).subscribe({
      next: (resp: any[]) => { 
        this.equiposCatalog = resp.filter(e => e.active !== false);
        console.log('📦 Equipos cargados:', this.equiposCatalog.slice(0, 3));
      },
      error: () => {},
    });
  }

  // DB description → nombre equipo, DB supervisor → nota usuario,
  // DB idResource  → id equipo,     DB position   → horas
  protected override remapFromDb(item: any): any {
    return {
      ...item,
      name:        item.description,
      description: item.supervisor,
      idEquipment: item.idResource,
      hours:       item.position,
    };
  }

  get colDefs(): ColDef[] {
    return [
      { headerName: '#', width: 45, valueGetter: (p) => p.node!.rowIndex! + 1, pinned: 'left', editable: false },
      {
        field: 'name', headerName: 'Equipo', editable: true, flex: 1,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: () => ({ values: this.equiposCatalog.map(e => e.description || e.name) }),
        valueSetter: (p) => {
          const eq = this.equiposCatalog.find(e => (e.description || e.name) === p.newValue);
          if (eq) {
            p.data.name = eq.description || eq.name;
            p.data.idEquipment = eq.id;
          } else {
            p.data.name = p.newValue;
          }
          return true;
        },
      },
      { field: 'quantity',    headerName: 'Cantidad',    editable: true, width: 90, type: 'numericColumn' },
      { field: 'hours',       headerName: 'Horas',       editable: true, width: 80              },
   //   { field: 'description', headerName: 'Descripción', editable: true, width: 180             },
    ];
  }

  override addRow(): void {
    const newRow = {
      id: `temp_${this.tempIdCounter++}`,
      idReporte: this.reportData?.id,
      name: '',
      quantity: 1,
      hours: null,
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

    if (event.colDef.field === 'name' && event.newValue) {
      const duplicateExists = this.rowData.some((row, index) =>
        index !== event.rowIndex &&
        row.name === event.newValue
      );

      if (duplicateExists) {
        alerts.basicAlert(
          'Equipo repetido',
          `El equipo "${event.newValue}" ya está agregado. No se permiten equipos repetidos.`,
          'warning'
        );
        event.node.setDataValue('name', event.oldValue);
        return;
      }
    }

    if (!event.data.__isNew) event.data.__modified = true;
    this.hasUnsavedChanges = true;
  }

  buildPayload(item: any): any {
    return {
      ...this.basePayload(item),
      description: item.name?.trim()        || null,  // nombre equipo → description
      supervisor:  item.description?.trim() || null,  // nota usuario  → supervisor
      position:    item.hours != null ? String(item.hours) : null, // horas → position
      idResource:  item.idEquipment         ?? null,  // id equipo     → idResource
    };
  }
}
