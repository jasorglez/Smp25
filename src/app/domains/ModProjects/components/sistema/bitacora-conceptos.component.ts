import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef } from 'ag-grid-enterprise';
import { BitacoraBaseComponent, BITACORA_TEMPLATE, BITACORA_STYLES, DATE_COL } from './bitacora-base.component';

// DB no tiene unitPrice/total → se mapean a supervisor/position (como string)
// Al leer: description→description(concepto), supervisor→unitPrice, position→total

@Component({
  selector: 'app-bitacora-conceptos',
  standalone: true,
  imports: [CommonModule, AgGridModule],
  template: BITACORA_TEMPLATE,
  styles: BITACORA_STYLES,
})
export class BitacoraConceptosComponent extends BitacoraBaseComponent {
  readonly bitacoraType  = 'conceptos';
  readonly typeNoteValue = 'CONCEPT';
  readonly editableCols  = ['date', 'description', 'quantity', 'unitPrice', 'total'];
  readonly requiredFields = [
    { field: 'date',        label: 'Fecha'        },
    { field: 'description', label: 'Concepto'     },
    { field: 'quantity',    label: 'Cantidad'     },
    { field: 'unitPrice',   label: 'Precio Unit.' },
  ];

  // DB supervisor → unitPrice (número), DB position → total (número)
  protected override remapFromDb(item: any): any {
    return {
      ...item,
      unitPrice: item.supervisor ? parseFloat(item.supervisor) : null,
      total:     item.position   ? parseFloat(item.position)   : null,
    };
  }

  get colDefs(): ColDef[] {
    const mxn = (p: any) => p.value != null
      ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(p.value) : '';
    return [
      { headerName: '#', width: 45, valueGetter: (p) => p.node!.rowIndex! + 1, pinned: 'left', editable: false },
      DATE_COL(),
      { field: 'description', headerName: 'Concepto',     editable: true, flex: 1                                     },
      { field: 'quantity',    headerName: 'Cantidad',     editable: true, width: 90,  type: 'numericColumn'            },
      { field: 'unitPrice',   headerName: 'Precio Unit.', editable: true, width: 130, type: 'numericColumn', valueFormatter: mxn },
      { field: 'total',       headerName: 'Total',        editable: true, width: 130, type: 'numericColumn', valueFormatter: mxn },
      { field: 'idResource',  headerName: 'ID Recurso',   editable: true, width: 100                                   },
    ];
  }

  buildPayload(item: any): any {
    return {
      ...this.basePayload(item),
      description: item.description?.trim()                      || null,  // concepto → description
      supervisor:  item.unitPrice != null ? String(item.unitPrice) : null, // precio   → supervisor
      position:    item.total     != null ? String(item.total)     : null, // total    → position
      idResource:  item.idResource ?? null,
    };
  }
}
