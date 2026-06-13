import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef } from 'ag-grid-enterprise';
import { BitacoraBaseComponent, BITACORA_TEMPLATE, BITACORA_STYLES } from './bitacora-base.component';
import { CatalogsService } from 'app/services/catalogs.service';
import { alerts } from 'app/helpers/alerts';

const NOTAS_MODAL_TEMPLATE = `
<div *ngIf="showTypeNoteModal" class="modal d-block" tabindex="-1" style="background:rgba(0,0,0,.45);">
  <div class="modal-dialog modal-dialog-centered" style="max-width:380px;">
    <div class="modal-content">
      <div class="modal-header bg-primary text-white py-2">
        <h6 class="modal-title mb-0"><i class="bi bi-plus-circle me-1"></i> Nuevo Tipo de Nota</h6>
        <button type="button" class="btn-close btn-close-white" (click)="closeTypeNoteModal()"></button>
      </div>
      <div class="modal-body py-3">
        <label class="form-label fw-semibold">Descripción <span class="text-muted small">(máx. 100 caracteres)</span></label>
        <input type="text" class="form-control" [(ngModel)]="newTypeNoteName"
               maxlength="100" placeholder="Ej. Reunión, Incidente..."
               (keydown.enter)="confirmNewTypeNote()">
        <div class="text-end mt-1">
          <small class="text-muted">{{ newTypeNoteName.length }}/100</small>
        </div>
      </div>
      <div class="modal-footer py-2">
        <button class="btn btn-secondary btn-sm" (click)="closeTypeNoteModal()">Cancelar</button>
        <button class="btn btn-primary btn-sm" (click)="confirmNewTypeNote()" [disabled]="!newTypeNoteName.trim()">
          <i class="bi bi-check-lg me-1"></i> Agregar
        </button>
      </div>
    </div>
  </div>
</div>
`;

// DB no tiene title → se mapea a supervisor
// Al leer: supervisor→title, description→content

@Component({
  selector: 'app-bitacora-notas',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  template: BITACORA_TEMPLATE + NOTAS_MODAL_TEMPLATE,
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

  showTypeNoteModal   = false;
  newTypeNoteName     = '';
  private pendingTypeNoteNode: any = null;

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
          values: [...(this.typeNotesCatalog?.map((item) => item.description) || []), '+ Agregar Nuevo'],
        }),
        valueFormatter: (params) => {
          if (!params.value) return '+ Agregar Nuevo';
          const foundItem = this.typeNotesCatalog?.find(item => item.id == params.value);
          return foundItem ? foundItem.description : params.value;
        },
        cellStyle: (params: any) => params.value
          ? {}
          : { color: '#0d6efd', fontStyle: 'italic', cursor: 'pointer' },
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
      date: this.reportData?.date ? String(this.reportData.date).substring(0, 10) : new Date().toISOString().split('T')[0],
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
    if (event.colDef.field === 'title' && event.newValue === '+ Agregar Nuevo') {
      event.data.title = event.oldValue || null;
      this.gridApi?.refreshCells({ rowNodes: [event.node] });
      this.pendingTypeNoteNode = event.node;
      this.showTypeNoteModal = true;
      return;
    }
    if (!event.data.__isNew) event.data.__modified = true;
    this.hasUnsavedChanges = true;
  }

  confirmNewTypeNote(): void {
    const name = this.newTypeNoteName.trim();
    if (!name) return;
    const idRoot = this.signalsService.getRootSelectedBySidebar()();
    const payload = { type: 'TYPENOTE', idCompany: idRoot, description: name };
    this.catalogService.addCatalog(payload).subscribe({
      next: (saved: any) => {
        const newItem = { id: saved.id, description: name };
        this.typeNotesCatalog = [...this.typeNotesCatalog, newItem];
        this._colDefs = [];
        this.gridApi?.setGridOption('columnDefs', this.colDefs);
        if (this.pendingTypeNoteNode) {
          this.pendingTypeNoteNode.data.title      = name;
          this.pendingTypeNoteNode.data.idResource = saved.id;
          if (!this.pendingTypeNoteNode.data.__isNew) this.pendingTypeNoteNode.data.__modified = true;
          this.gridApi?.refreshCells({ rowNodes: [this.pendingTypeNoteNode] });
          this.hasUnsavedChanges = true;
        }
        this.closeTypeNoteModal();
      },
      error: (err) => {
        console.error('Error al guardar tipo de nota:', err);
      }
    });
  }

  closeTypeNoteModal(): void {
    this.showTypeNoteModal   = false;
    this.newTypeNoteName     = '';
    this.pendingTypeNoteNode = null;
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
