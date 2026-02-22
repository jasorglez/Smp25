import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef } from 'ag-grid-enterprise';
import { BitacoraBaseComponent, BITACORA_STYLES } from './bitacora-base.component';
import { ImageHandlerService } from 'app/services/image-handler.service';
import { alerts } from 'app/helpers/alerts';

@Component({
  selector: 'app-bitacora-fotos',
  standalone: true,
  imports: [CommonModule, AgGridModule],
  template: `
<div class="detail-grid-container">
  <div class="detail-actions d-flex align-items-center mb-2 gap-1">
    <button class="btn btn-outline-secondary btn-sm" (click)="closeDetail()"><i class="bi bi-x-lg"></i></button>
    <button class="btn btn-primary btn-sm"           (click)="addRow()"><i class="bi bi-plus-lg"></i></button>
    <button class="btn btn-warning btn-sm"           (click)="discardChanges()"><i class="bi bi-arrow-counterclockwise"></i></button>
    <button class="btn btn-danger btn-sm"            (click)="deleteSelected()"><i class="bi bi-trash"></i></button>
    <button class="btn btn-success btn-sm position-relative" (click)="saveChanges()">
      <i class="bi bi-floppy"></i>
      <span class="position-absolute top-0 start-100 translate-middle p-2 bg-danger border border-light rounded-circle"
            *ngIf="hasUnsavedChanges"></span>
    </button>
  </div>

  <ag-grid-angular
    class="ag-theme-quartz small-text-ag-grid"
    [rowData]="rowData"
    [columnDefs]="colDefs"
    [defaultColDef]="defaultColDef"
    [gridOptions]="gridOptions"
    (gridReady)="onGridReady($event)"
    (cellValueChanged)="onCellValueChanged($event)"
    (cellEditingStopped)="onCellEditingStopped($event)"
    (cellClicked)="onGridCellClicked($event)"
    style="height: 350px; width: 100%;">
  </ag-grid-angular>
</div>
  `,
  styles: BITACORA_STYLES,
})
export class BitacoraFotosComponent extends BitacoraBaseComponent {
  private imageHandlerService = inject(ImageHandlerService);
  private currentRow: any = null;

  readonly bitacoraType   = 'fotos';
  readonly typeNoteValue  = 'Photo';
  readonly editableCols   = ['description'];
  readonly requiredFields = [{ field: 'imageUrl', label: 'Foto' }];

  override readonly gridOptions: any = {
    headerHeight: 30, rowHeight: 60, rowSelection: 'single',
    rowClassRules: { 'new-row-highlight': (p: any) => !!p.data?.__isNew },
  };

  get colDefs(): ColDef[] {
    return [
      {
        headerName: '#', width: 45, pinned: 'left', editable: false,
        valueGetter: (p) => p.node!.rowIndex! + 1,
      },
      {
        field: 'imageUrl',
        headerName: 'Foto',
        width: 130,
        editable: false,
        cellRenderer: (params: any) => {
          const container = document.createElement('div');
          container.style.cssText = 'width:100%;height:100%;display:flex;align-items:center;justify-content:center;cursor:pointer;';
          container.title = 'Clic para cambiar foto';
          if (params.value) {
            const img = document.createElement('img');
            img.src = params.value;
            img.style.cssText = 'max-width:100%;max-height:56px;object-fit:contain;border-radius:4px;';
            container.appendChild(img);
          } else {
            container.innerHTML = '<i class="bi bi-camera" style="font-size:1.5rem;color:#adb5bd;"></i><small class="ms-1 text-muted">Subir</small>';
          }
          return container;
        },
      },
      {
        field: 'description',
        headerName: 'Descripción',
        editable: true,
        flex: 1,
      },
    ];
  }

  onGridCellClicked(event: any): void {
    if (event.colDef?.field !== 'imageUrl') return;
    this.currentRow = event.node.data;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp';
    input.style.cssText = 'position:fixed;top:-200px;left:-200px;opacity:0;';
    document.body.appendChild(input);
    input.onchange = (e: any) => {
      this.onFileSelected(e);
      document.body.removeChild(input);
    };
    input.click();
  }

  private onFileSelected(event: any): void {
    const file: File = event.target.files?.[0];
    if (!file || !this.currentRow) return;
    alerts.basicAlert('Subiendo...', 'Por favor espera', 'info');
    this.imageHandlerService.uploadFileToFirebase(file, 'fotos-bitacora')
      .then(url => {
        this.currentRow.imageUrl = url;
        if (!this.currentRow.__isNew) this.currentRow.__modified = true;
        this.hasUnsavedChanges = true;
        this.gridApi.refreshCells({ force: true });
        alerts.basicAlert('Listo', 'Foto subida correctamente', 'success');
      })
      .catch(() => alerts.basicAlert('Error', 'No se pudo subir la foto', 'error'));
  }

  buildPayload(item: any): any {
    return {
      ...this.basePayload(item),
      description: item.description?.trim() || null,
      imageUrl:    item.imageUrl ?? null,
    };
  }
}
