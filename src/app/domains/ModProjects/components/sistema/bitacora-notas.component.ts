import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef } from 'ag-grid-enterprise';
import { BitacoraBaseComponent, BITACORA_TEMPLATE, BITACORA_STYLES } from './bitacora-base.component';
import { CatalogsService } from 'app/services/catalogs.service';
import { alerts } from 'app/helpers/alerts';

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
  readonly editableCols  = ['title', 'content'];
  readonly requiredFields = [
    { field: 'title',   label: 'Título'    },
    { field: 'content', label: 'Contenido' },
  ];

  private catalogService = inject(CatalogsService);
  typeNotesCatalog: any[] = [];

  constructor() {
    super();
    this.loadTypeNotesCatalog();
  }

  private loadTypeNotesCatalog(): void {
    const idRoot = this.signalsService.getRootSelectedBySidebar()();
    if (idRoot) {
      this.catalogService.getTypeNote(idRoot).subscribe({
        next: (data: any) => {
          this.typeNotesCatalog = data;
        },
        error: (error) => {
          console.error('Error fetching type notes:', error);
          this.typeNotesCatalog = [];
        }
      });
    }
  }

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
      {
        field: 'title',
        headerName: 'Notas',
        editable: true,
        width: 250,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: () => ({
          values: this.typeNotesCatalog?.map((item) => item.description) || [],
        }),
        valueFormatter: (params) => {
          if (!params.value) return '';
          const foundItem = this.typeNotesCatalog?.find(item => item.id == params.value);
          return foundItem ? foundItem.description : params.value;
        },
        valueGetter: (params) => {
          if (!params.data?.title) return '';
          const foundItem = this.typeNotesCatalog?.find(item => item.description === params.data.title);
          return foundItem ? foundItem.description : params.data.title;
        },
        valueSetter: (params) => {
          if (!params.newValue) {
            params.data.title = null;
            return true;
          }
          const foundItem = this.typeNotesCatalog?.find(item => item.description === params.newValue);
          if (foundItem) {
            params.data.title = foundItem.description;
            params.data.idResource = foundItem.id;
            return true;
          }
          params.data.title = params.newValue;
          return true;
        },
      },
      {
        field: 'content',
        headerName: 'Descripción',
        editable: false,
        flex: 1,
        wrapText: true,
        autoHeight: true,
        cellStyle: {
          'white-space': 'normal',
          'word-wrap': 'break-word',
          'line-height': '20px',
          'padding': '5px 8px',
        },
        cellRenderer: (params: any) => {
          if (!params.value) {
            const div = document.createElement('div');
            div.style.cssText = 'color:#999;font-style:italic;font-size:12px';
            div.textContent = 'Click para agregar descripción...';
            return div;
          }
          const div = document.createElement('div');
          div.style.cssText = 'white-space:normal;word-break:break-word;line-height:20px;color:#333';
          div.textContent = String(params.value).toUpperCase();
          return div;
        },
        onCellClicked: (event: any) => {
          if (event.colDef.field === 'content') {
            this.openContentModal(event.value || '', event.node);
          }
        },
      },
    ];
  }

  override addRow(): void {
    const newRow = {
      id: `temp_${this.tempIdCounter++}`,
      idReporte: this.reportData?.id,
      date: new Date().toISOString().split('T')[0],
      title: '',
      content: '',
      idResource: null,
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
    if (!event.data.__isNew) event.data.__modified = true;
    this.hasUnsavedChanges = true;
  }

  openDescriptionModal(event: any): void {
    const currentValue = event.value || '';
    const fieldName = event.colDef.field;

    alerts.inputAlert(
      'Editar Descripción',
      'Ingrese la descripción:',
      'textarea',
      currentValue,
      {
        inputAttributes: {
          maxlength: '1000',
          rows: '8',
          cols: '80',
          style: 'min-height: 200px; min-width: 400px; resize: both;',
          placeholder: 'Escriba aquí la descripción...'
        },
        showCancelButton: true,
        confirmButtonText: 'Guardar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#28a745',
        cancelButtonColor: '#6c757d'
      }
    ).then((result) => {
      if (result.isConfirmed && result.value !== undefined) {
        event.node.setDataValue(fieldName, result.value);
        if (event.data) {
          event.data.__modified = true;
          this.hasUnsavedChanges = true;
        }
      }
    });
  }

  openContentModal(currentValue: string, node: any): void {
    alerts.inputAlert(
      'Editar Descripción',
      'Ingrese la descripción:',
      'textarea',
      currentValue || '',
      {
        inputAttributes: {
          maxlength: '1000',
          rows: '8',
          cols: '80',
          style: 'min-height: 200px; min-width: 400px; resize: both;',
          placeholder: 'Escriba aquí la descripción...'
        },
        showCancelButton: true,
        confirmButtonText: 'Guardar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#28a745',
        cancelButtonColor: '#6c757d'
      }
    ).then((result) => {
      if (result.isConfirmed && result.value !== undefined) {
        node.setDataValue('content', result.value);
        const rowNode = this.gridApi?.getRowNode(node.id);
        if (rowNode && rowNode.data) {
          rowNode.data.__modified = true;
          rowNode.data.content = result.value;
          this.hasUnsavedChanges = true;
        }
      }
    });
  }

  buildPayload(item: any): any {
    return {
      ...this.basePayload(item),
      supervisor:  item.title?.trim()   || null,
      description: item.content?.trim() || null,
      idResource: item.idResource ?? null,
    };
  }
}
