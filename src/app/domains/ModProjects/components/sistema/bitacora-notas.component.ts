import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef } from 'ag-grid-enterprise';
import { BitacoraBaseComponent, BITACORA_TEMPLATE, BITACORA_STYLES, DATE_COL } from './bitacora-base.component';

// DB no tiene title → se mapea a supervisor
// Al leer: supervisor→title, description→content

@Component({
  selector: 'app-bitacora-notas',
  standalone: true,
  imports: [CommonModule, AgGridModule],
  template: BITACORA_TEMPLATE,
  styles: BITACORA_STYLES,
})
export class BitacoraNotasComponent extends BitacoraBaseComponent {
  readonly bitacoraType  = 'notas';
  readonly typeNoteValue = 'NOTE';
  readonly editableCols  = ['date', 'title', 'content'];
  readonly requiredFields = [
    { field: 'date',    label: 'Fecha'     },
    { field: 'title',   label: 'Título'    },
    { field: 'content', label: 'Contenido' },
  ];

  // DB supervisor → title, DB description → content
  protected override remapFromDb(item: any): any {
    return {
      ...item,
      title:   item.supervisor,
      content: item.description,
    };
  }

  get colDefs(): ColDef[] {
    return [
      { headerName: '#', width: 45, valueGetter: (p) => p.node!.rowIndex! + 1, pinned: 'left', editable: false },
      DATE_COL(),
      { field: 'title',   headerName: 'Título',    editable: true, width: 200 },
      { field: 'content', headerName: 'Contenido', editable: true, flex: 1   },
    ];
  }

  buildPayload(item: any): any {
    return {
      ...this.basePayload(item),
      supervisor:  item.title?.trim()   || null,  // título   → supervisor
      description: item.content?.trim() || null,  // contenido → description
    };
  }
}
