import { Component, inject } from '@angular/core';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { AgGridModule } from 'ag-grid-angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { alerts } from 'app/helpers/alerts';
import { EmployeesService } from 'app/services/employees.service';
import { AttachHandlerService } from 'app/services/attach-handler.service';
import { catchError, concat, EMPTY, lastValueFrom, toArray } from 'rxjs';

// ── Preview detail (nested master-detail renderer) ──────────────────────────
@Component({
  selector: 'app-document-preview-detail',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div style="height:500px; padding:8px; background:#f8f9fa;">
      <iframe *ngIf="safeUrl && ispdf" [src]="safeUrl"
        style="width:100%;height:100%;border:none;border-radius:4px;box-shadow:0 2px 8px rgba(0,0,0,.15);">
      </iframe>
      <div *ngIf="safeUrl && !ispdf"
        class="d-flex justify-content-center align-items-center h-100">
        <img [src]="safeUrl" style="max-width:100%;max-height:100%;border-radius:4px;box-shadow:0 2px 8px rgba(0,0,0,.15);" alt="Documento">
      </div>
      <div *ngIf="!safeUrl" class="d-flex justify-content-center align-items-center h-100">
        <p class="text-muted">Sin documento adjunto</p>
      </div>
    </div>`,
})
export class DocumentPreviewDetailComponent {
  safeUrl: SafeResourceUrl | null = null;
  ispdf = false;
  private sanitizer = inject(DomSanitizer);

  agInit(params: any) {
    const url: string = params.data?.urlDocument ?? null;
    if (!url) return;
    this.ispdf = url.includes('/pdf/') || url.toLowerCase().includes('.pdf');
    this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }
}

// ── Documents panel (main detail renderer for the employee row) ──────────────
@Component({
  selector: 'app-detail-employee-documents',
  standalone: true,
  imports: [CommonModule, AgGridModule, FormsModule],
  templateUrl: './detail-employee-documents.component.html',
})
export class DetailEmployeeDocumentsComponent {
  private employeesService = inject(EmployeesService);
  private attachHandlerService = inject(AttachHandlerService);

  idEmployee: number | null = null;
  rowData: any[] = [];
  gridApi: GridApi;
  hasUnsavedChanges = false;
  quickFilter = '';
  private tempIdCounter = 0;

  // Register the nested preview renderer
  components = { documentPreview: DocumentPreviewDetailComponent };

  agInit(params: any) {
    this.idEmployee = params.data?.id ?? null;
    this.loadData();
  }

  columnDefs: ColDef[] = [
    {
      headerName: 'Nombre Documento',
      field: 'documentName',
      flex: 1,
      editable: (params) => !!params.data?.__isNew,
    },
    {
      headerName: 'Vista previa',
      field: 'urlDocument',
      width: 120,
      editable: false,
      cellRenderer: (params) => {
        if (params.value) {
          const label = params.node.expanded ? 'Cerrar' : 'Ver';
          const icon  = params.node.expanded ? 'bi-eye-slash' : 'bi-eye';
          return `<button class="btn btn-sm btn-outline-primary py-0 px-2" style="font-size:0.72rem;line-height:1.4;">
                    <i class="bi ${icon} me-1"></i>${label}
                  </button>`;
        }
        return `<span style="font-size:0.72rem;color:#aaa;">Sin PDF</span>`;
      },
      onCellClicked: (params) => {
        if (!params.data?.urlDocument) return;
        const expanding = !params.node.expanded;
        // Colapsar otros primero
        params.api.forEachNode((n: any) => { if (n.expanded) n.setExpanded(false); });
        if (expanding) params.node.setExpanded(true);
        // Refrescar celda para actualizar label/icono
        params.api.refreshCells({ rowNodes: [params.node], columns: ['urlDocument'], force: true });
      },
    },
    {
      headerName: 'Archivo',
      field: 'urlDocument',
      colId: 'urlDocumentUpload',
      width: 150,
      editable: false,
      cellRenderer: (params) => {
        if (params.value) {
          return `<i class="bi bi-paperclip" style="font-size:1rem;vertical-align:middle;margin-right:4px;"></i>
                  <span style="font-size:0.72rem;color:#555;">Doble clic p/ reemplazar</span>`;
        }
        return `<span style="font-size:0.72rem;color:#888;">Doble clic p/ subir (PDF/JPG/PNG)</span>`;
      },
      onCellDoubleClicked: async (params) => {
        try {
          const { url } = await this.attachHandlerService.uploadEmployeeDoc();
          params.node.setDataValue('urlDocument', url);
          params.data.__modified = true;
          this.hasUnsavedChanges = true;
        } catch {
          // user cancelled
        }
      },
    },
  ];

  gridOptions: any = {
    headerHeight: 25,
    rowHeight: 24,
    rowSelection: 'single',
    stopEditingWhenCellsLoseFocus: true,
    defaultColDef: { resizable: true, sortable: true },
    masterDetail: true,
    isRowMaster: (data: any) => !!data?.urlDocument,
    detailCellRendererSelector: () => ({ component: 'documentPreview' }),
    detailRowHeight: 516,
    // Refresh "Ver/Cerrar" button label when a row collapses
    onRowGroupOpened: (event: any) => {
      event.api.refreshCells({ rowNodes: [event.node], columns: ['urlDocument'], force: true });
    },
  };

  loadData() {
    if (!this.idEmployee) return;
    this.employeesService.getEmployeeDocuments(this.idEmployee).subscribe({
      next: (data) => { this.rowData = data ?? []; },
      error: (err) => console.error('Error cargando documentos:', err),
    });
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  onQuickFilter(value: string) {
    this.gridApi?.setGridOption('quickFilterText', value);
  }

  clearFilter() {
    this.quickFilter = '';
    this.gridApi?.setGridOption('quickFilterText', '');
  }

  onCellValueChanged(event: any) {
    event.data.__modified = true;
    this.hasUnsavedChanges = true;
  }

  addRow() {
    const newRow = {
      id: `temp_${this.tempIdCounter++}`,
      idEmployee: this.idEmployee,
      documentName: null,
      urlDocument: null,
      active: true,
      __isNew: true,
    };
    this.rowData = [newRow, ...this.rowData];
    this.hasUnsavedChanges = true;
    setTimeout(() => {
      this.gridApi?.getDisplayedRowAtIndex(0)?.setSelected(true);
      this.gridApi?.startEditingCell({ rowIndex: 0, colKey: 'documentName' });
    });
  }

  async saveChanges() {
    const valid = this.rowData.every((r) => r.documentName && r.urlDocument);
    if (!valid) {
      alerts.basicAlert('Guardar documentos', 'Cada documento necesita nombre y archivo PDF.', 'error');
      return;
    }
    const newRows = this.rowData.filter((r) => r.__isNew);
    const modifiedRows = this.rowData.filter((r) => r.__modified && !r.__isNew);
    const adds = newRows.map((r) => this.employeesService.addEmployeeDocument(this.cleanRow(r)));
    const updates = modifiedRows.map((r) => this.employeesService.updateEmployeeDocument(r.id, this.cleanRow(r)));
    try {
      await lastValueFrom(concat(...adds, ...updates).pipe(toArray()));
      alerts.basicAlert('Documentos', 'Guardado correctamente.', 'success');
      this.hasUnsavedChanges = false;
      this.loadData();
    } catch {
      alerts.basicAlert('Error', 'No se pudieron guardar los documentos.', 'error');
    }
  }

  revertChanges() {
    this.loadData();
    this.hasUnsavedChanges = false;
  }

  deleteEntry() {
    const selected = this.gridApi?.getSelectedNodes();
    if (!selected?.length) {
      alerts.basicAlert('Eliminar', 'Seleccione un documento para eliminar.', 'error');
      return;
    }
    const data = selected[0].data;
    if (data.__isNew) {
      this.rowData = this.rowData.filter((r) => r.id !== data.id);
      this.hasUnsavedChanges = this.rowData.some((r) => r.__isNew || r.__modified);
      return;
    }
    this.employeesService.deleteEmployeeDocument(data.id)
      .pipe(catchError(() => {
        alerts.basicAlert('Error', 'No se pudo eliminar el documento.', 'error');
        return EMPTY;
      }))
      .subscribe(() => {
        alerts.basicAlert('Eliminar', 'Documento eliminado.', 'success');
        this.loadData();
      });
  }

  private cleanRow(row: any): any {
    const clean = { ...row };
    delete clean.__isNew;
    delete clean.__modified;
    if (typeof clean.id === 'string' && clean.id.startsWith('temp_')) delete clean.id;
    return clean;
  }
}
