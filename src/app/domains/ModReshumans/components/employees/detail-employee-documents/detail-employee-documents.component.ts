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

type DocKind = 'pdf' | 'image' | 'office' | null;

function detectKind(url: string, fileExt?: string): DocKind {
  if (!url) return null;
  // Para archivos pendientes (blob URL) usamos la extensión guardada en el row
  if (fileExt) {
    if (fileExt === 'pdf') return 'pdf';
    if (['jpg', 'jpeg', 'png'].includes(fileExt)) return 'image';
    return 'office';
  }
  // Para URLs de Firebase: .includes porque terminan en ?alt=media&token=...
  const lower = url.toLowerCase();
  if (lower.includes('.pdf')) return 'pdf';
  if (/\.(jpe?g|png)/.test(lower)) return 'image';
  return 'office';
}

function officeIcon(name: string): string {
  const lower = name.toLowerCase();
  if (/\.xlsx?/.test(lower)) return 'bi-file-earmark-excel text-success';
  if (/\.docx?/.test(lower)) return 'bi-file-earmark-word text-primary';
  if (/\.pptx?/.test(lower)) return 'bi-file-earmark-ppt text-danger';
  return 'bi-file-earmark text-secondary';
}

// ── Preview detail (nested master-detail renderer) ──────────────────────────
@Component({
  selector: 'app-document-preview-detail',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div style="height:500px; padding:8px; background:#f8f9fa; display:flex; align-items:center; justify-content:center;">
      <!-- PDF -->
      <iframe *ngIf="kind === 'pdf'" [src]="safeUrl"
        style="width:100%;height:100%;border:none;border-radius:4px;box-shadow:0 2px 8px rgba(0,0,0,.15);">
      </iframe>
      <!-- Imagen -->
      <img *ngIf="kind === 'image'" [src]="safeUrl"
        style="max-width:100%;max-height:100%;border-radius:4px;box-shadow:0 2px 8px rgba(0,0,0,.15);" alt="Documento">
      <!-- Office: sin vista previa nativa -->
      <div *ngIf="kind === 'office'" class="text-center">
        <i class="bi {{ iconClass }}" style="font-size:4rem;"></i>
        <p class="mt-2 text-muted" style="font-size:0.85rem;">Vista previa no disponible para este formato.</p>
        <a *ngIf="!isPending" [href]="rawUrl" target="_blank" rel="noopener" class="btn btn-sm btn-outline-primary mt-1">
          <i class="bi bi-download me-1"></i> Descargar archivo
        </a>
        <p *ngIf="isPending" class="text-warning mt-2" style="font-size:0.8rem;">
          <i class="bi bi-clock-history me-1"></i>Pendiente de guardar
        </p>
      </div>
      <!-- Sin archivo -->
      <div *ngIf="!kind">
        <p class="text-muted">Sin documento adjunto</p>
      </div>
    </div>`,
})
export class DocumentPreviewDetailComponent {
  safeUrl: SafeResourceUrl | null = null;
  rawUrl = '';
  kind: DocKind = null;
  iconClass = '';
  isPending = false;
  private sanitizer = inject(DomSanitizer);

  agInit(params: any) {
    const url: string = params.data?.urlDocument ?? null;
    if (!url) return;
    this.rawUrl = url;
    this.isPending = url.startsWith('blob:');
    const fileExt: string | undefined = params.data?.__pendingFileExt;
    this.kind = detectKind(url, fileExt);
    const iconSrc = params.data?.__pendingFile?.name ?? url;
    this.iconClass = this.kind === 'office' ? officeIcon(iconSrc) : '';
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
  private expandedRowId: any = null;

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
        return `<span style="font-size:0.72rem;color:#aaa;">Sin archivo</span>`;
      },
      onCellClicked: (params) => {
        if (!params.data?.urlDocument) return;
        const expanding = !params.node.expanded;
        params.api.forEachNode((n: any) => { if (n.expanded) n.setExpanded(false); });
        if (expanding) {
          this.expandedRowId = params.data?.id ?? params.node.id;
          params.node.setExpanded(true);
        } else {
          this.expandedRowId = null;
        }
        params.api.onFilterChanged();
        params.api.refreshCells({ rowNodes: [params.node], columns: ['urlDocument'], force: true });
      },
    },
    {
      headerName: 'Archivo',
      field: 'urlDocument',
      colId: 'urlDocumentUpload',
      width: 180,
      editable: false,
      cellRenderer: (params) => {
        const pendingFile: File | undefined = params.data?.__pendingFile;
        if (pendingFile) {
          const icon = officeIcon(pendingFile.name)
            .replace('text-success', 'color:#198754')
            .replace('text-primary', 'color:#0d6efd')
            .replace('text-danger', 'color:#dc3545')
            .replace('text-secondary', 'color:#6c757d');
          const [cls] = icon.split(' ');
          const col = icon.match(/color:[^;]+/)?.[0] ?? 'color:#555';
          return `<i class="bi ${cls}" style="font-size:0.85rem;vertical-align:middle;margin-right:4px;${col}"></i>
                  <span style="font-size:0.72rem;color:#856404;" title="${pendingFile.name}">${pendingFile.name} ⏳</span>`;
        }
        if (params.value) {
          const icon = officeIcon(params.value)
            .replace('text-success', 'color:#198754')
            .replace('text-primary', 'color:#0d6efd')
            .replace('text-danger', 'color:#dc3545')
            .replace('text-secondary', 'color:#6c757d');
          const [cls] = icon.split(' ');
          const col = icon.match(/color:[^;]+/)?.[0] ?? 'color:#555';
          return `<i class="bi ${cls}" style="font-size:1rem;vertical-align:middle;margin-right:4px;${col}"></i>
                  <span style="font-size:0.72rem;color:#555;">Doble clic p/ reemplazar</span>`;
        }
        return `<span style="font-size:0.72rem;color:#888;">Doble clic p/ subir (PDF/JPG/PNG/Office)</span>`;
      },
      onCellDoubleClicked: async (params) => {
        try {
          const { file, localUrl } = await this.attachHandlerService.selectEmployeeDoc();
          // Liberar blob URL anterior si existía
          if (params.data.__pendingFile && params.data.urlDocument?.startsWith('blob:')) {
            URL.revokeObjectURL(params.data.urlDocument);
          }
          params.data.__pendingFile = file;
          params.data.__pendingFileExt = file.name.split('.').pop()?.toLowerCase() ?? '';
          params.node.setDataValue('urlDocument', localUrl);
          params.data.__modified = true;
          this.hasUnsavedChanges = true;
          params.api.refreshCells({ rowNodes: [params.node], force: true });
        } catch {
          // usuario canceló
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
    isExternalFilterPresent: () => this.expandedRowId !== null,
    doesExternalFilterPass: (node: any) => node.data?.id === this.expandedRowId,
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
      alerts.userSaveErrorToast('Guardar documentos', 'Cada documento necesita nombre y archivo.');
      return;
    }

    // Subir archivos pendientes a Firebase antes de guardar en BD
    for (const row of this.rowData) {
      if (row.__pendingFile) {
        try {
          const realUrl = await this.attachHandlerService.uploadFileToStorage(row.__pendingFile);
          URL.revokeObjectURL(row.urlDocument);
          row.urlDocument = realUrl;
          delete row.__pendingFile;
        } catch {
          alerts.userSaveErrorToast('Error', `No se pudo subir el archivo "${row.documentName}".`);
          return;
        }
      }
    }

    const newRows = this.rowData.filter((r) => r.__isNew);
    const modifiedRows = this.rowData.filter((r) => r.__modified && !r.__isNew);
    const adds = newRows.map((r) => this.employeesService.addEmployeeDocument(this.cleanRow(r)));
    const updates = modifiedRows.map((r) => this.employeesService.updateEmployeeDocument(r.id, this.cleanRow(r)));
    try {
      await lastValueFrom(concat(...adds, ...updates).pipe(toArray()));
      alerts.userSaveSuccessToast('Documentos', 'Guardado correctamente.');
      this.hasUnsavedChanges = false;
      this.loadData();
    } catch {
      alerts.userSaveErrorToast('Error', 'No se pudieron guardar los documentos.');
    }
  }

  revertChanges() {
    // Liberar blob URLs pendientes
    this.rowData.forEach((r) => {
      if (r.__pendingFile && r.urlDocument?.startsWith('blob:')) {
        URL.revokeObjectURL(r.urlDocument);
      }
      delete r.__pendingFile;
      delete r.__pendingFileExt;
    });
    this.loadData();
    this.hasUnsavedChanges = false;
  }

  deleteEntry() {
    const selected = this.gridApi?.getSelectedNodes();
    if (!selected?.length) {
      alerts.userSaveErrorToast('Eliminar', 'Seleccione un documento para eliminar.');
      return;
    }
    const data = selected[0].data;
    if (data.__isNew) {
      if (data.__pendingFile && data.urlDocument?.startsWith('blob:')) {
        URL.revokeObjectURL(data.urlDocument);
      }
      this.rowData = this.rowData.filter((r) => r.id !== data.id);
      this.hasUnsavedChanges = this.rowData.some((r) => r.__isNew || r.__modified);
      return;
    }
    this.employeesService.deleteEmployeeDocument(data.id)
      .pipe(catchError(() => {
        alerts.userSaveErrorToast('Error', 'No se pudo eliminar el documento.');
        return EMPTY;
      }))
      .subscribe(() => {
        alerts.userDeleteSuccessToast('Eliminar', 'Documento eliminado.');
        this.loadData();
      });
  }

  private cleanRow(row: any): any {
    const clean = { ...row };
    delete clean.__isNew;
    delete clean.__modified;
    delete clean.__pendingFile;
    delete clean.__pendingFileExt;
    if (typeof clean.id === 'string' && clean.id.startsWith('temp_')) delete clean.id;
    return clean;
  }
}
