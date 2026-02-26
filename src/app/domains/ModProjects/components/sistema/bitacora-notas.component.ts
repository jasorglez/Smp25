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
  readonly editableCols  = ['title'];
  private readonly maxContentLength = 4000;
  private _colDefs: ColDef[] = [];
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
          // Rebuild cached column defs when catalog changes
          this._colDefs = [];
          this.gridApi?.setGridOption('columnDefs', this.colDefs);
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
    if (this._colDefs.length > 0) return this._colDefs;
    this._colDefs = [
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
        tooltipValueGetter: (params) => this.normalizeContentValue(params.value),
        cellRenderer: (params) => this.formatContentPreview(params.value),
        cellStyle: {
          'white-space': 'pre-wrap',
          'word-wrap': 'break-word',
          'line-height': '18px',
          'padding': '4px',
          'cursor': 'pointer',
        },
      },
      {
        colId: 'contentEdit',
        headerName: '',
        width: 44,
        pinned: 'right',
        sortable: false,
        filter: false,
        resizable: false,
        cellRenderer: () => '<button class="btn btn-sm btn-outline-primary p-0 px-1" title="Editar">✎</button>',
        cellStyle: { 'text-align': 'center' },
      },
    ];
    return this._colDefs;
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

    alerts.largeTextAlert(
      'Editar Descripción',
      'Ingrese la descripción:',
      currentValue,
      {
        maxLength: this.maxContentLength,
        placeholder: 'Escriba aquí la descripción...',
        showCancelButton: true,
        confirmButtonText: 'Guardar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#28a745',
        cancelButtonColor: '#6c757d',
        swalOptions: {
          width: '98vw',
          grow: 'fullscreen',
          heightAuto: false,
          padding: '1rem 1.5rem'
        }
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
    this.gridApi?.stopEditing();
    alerts.largeTextAlert(
      'Editar Descripción',
      'Ingrese la descripción:',
      currentValue || '',
      {
        maxLength: this.maxContentLength,
        placeholder: 'Escriba aquí la descripción...',
        showCancelButton: true,
        confirmButtonText: 'Guardar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#28a745',
        cancelButtonColor: '#6c757d',
        swalOptions: {
          width: '98vw',
          grow: 'fullscreen',
          heightAuto: false,
          padding: '1rem 1.5rem'
        }
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

  override onCellDoubleClicked(event: any): void {
    if (event?.colDef?.field === 'content') {
      const currentValue = this.normalizeContentValue(event.value);
      this.openContentModal(currentValue, event.node);
    }
  }

  override onCellClicked(event: any): void {
    if (event?.colDef?.colId === 'contentEdit') {
      const currentValue = this.normalizeContentValue(event.data?.content);
      this.openContentModal(currentValue, event.node);
    }
  }

  private normalizeContentValue(value: any): string {
    return value === null || value === undefined ? '' : String(value);
  }

  private formatContentPreview(value: any): string {
    const text = this.normalizeContentValue(value).replace(/\r\n/g, '\n').trim();
    if (!text) return '';
    const firstLine = text.split('\n')[0];
    return firstLine.length > 140 ? `${firstLine.slice(0, 140)}...` : firstLine;
  }
}
