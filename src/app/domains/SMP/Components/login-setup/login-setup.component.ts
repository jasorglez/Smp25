import { Component, ViewChild, ElementRef, inject, ChangeDetectorRef} from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-community';
import { ImageHandlerService } from 'app/services/image-handler.service';
import { LoginImageService } from 'app/services/login-image.service';
import { alerts } from 'app/helpers/alerts';

@Component({
  selector: 'app-login-setup',
  standalone: true,
  imports: [CommonModule, AgGridModule],
  templateUrl: './login-setup.component.html',
  styleUrl: './login-setup.component.scss'
})
export class LoginSetupComponent {
  @ViewChild('fileInput') fileInput: ElementRef<HTMLInputElement>;

  private imageHandlerService = inject(ImageHandlerService);
  private readonly cdr = inject(ChangeDetectorRef);
  private loginSetupService = inject(LoginImageService);

  rowData: any[] = [];
  originalRowData: any[] = [];
  selectedRowData: any = null;
  hasUnsavedChanges = false;
  gridApi!: GridApi;
  gridHeight = '60vh';

  defaultColDef: ColDef = {
    sortable: true,
    resizable: true,
    minWidth: 100
  };

  columnDefs: ColDef[] = [
    {
      field: 'id',
      headerName: 'ID',
      hide: true,
      filter: 'agTextColumnFilter',
      width: 80
    },
    {
      headerName: '#',
      valueGetter: (params: any) => (params.node?.rowIndex ?? 0) + 1,
      width: 55,
      minWidth: 55,
      sortable: false,
      resizable: false,
      pinned: 'left' as const
    },
    {
      field: 'nombre',
      headerName: 'Nombre',
      editable: true,
      filter: true,
      flex: 1
    },
    {
      field: 'url',
      headerName: 'Imagen (WEBP)',
      cellRenderer: (params: any) => {
        const url = params.value || '';
        if (url) {
          return `<img src="${url}" alt="Preview" style="width:80px;height:50px;object-fit:contain;cursor:pointer;" title="Clic para cambiar imagen"/>`;
        }
        return `<div style="width:80px;height:50px;border:1px dashed #ccc;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:11px;" title="Clic para cargar imagen WEBP">WEBP</div>`;
      },
      onCellClicked: (params: any) => this.onImageCellClicked(params),
      editable: false,
      flex: 1,
      minWidth: 140
    }
  ];

  onGridReady(params: GridReadyEvent): void {
    this.gridApi = params.api;
    this.loadData();
  }

  loadData(): void {
    this.loginSetupService.getAll().subscribe({
      next: (data) => {
        this.rowData = (data || []).map((item) => ({
          id: item.id,
          nombre: item.nombre,
          url: item.url
        }));
        this.originalRowData = JSON.parse(JSON.stringify(this.rowData));
        this.hasUnsavedChanges = false;
        if (this.gridApi) {
          this.gridApi.setGridOption('rowData', this.rowData);
        }
      },
      error: (err) => {
        console.error('Error loading login images:', err);
        this.rowData = [];
        this.originalRowData = [];
        if (this.gridApi) {
          this.gridApi.setGridOption('rowData', this.rowData);
        }
        // No mostrar alerta si no hay imágenes aún (404) o lista vacía — solo en fallos reales del servidor
        const status = err?.status ?? err?.statusCode;
        if (status !== 404 && status !== 0) {
          alerts.basicAlert('Error', 'No se pudieron cargar las imágenes del login.', 'error');
        }
      }
    });
  }

  addRow(): void {
    if (this.fileInput?.nativeElement) {
      this.fileInput.nativeElement.value = '';
      this.fileInput.nativeElement.click();
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (file.type !== 'image/webp') {
      alerts.basicAlert('Formato no válido', 'Solo se permiten imágenes en formato WEBP.', 'error');
      input.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alerts.basicAlert('Archivo muy grande', 'La imagen no puede superar 5MB.', 'error');
      input.value = '';
      return;
    }

    const nombre = file.name.replace(/\.webp$/i, '') || `Imagen ${Date.now()}`;
    if (this.isNombreDuplicado(nombre)) {
      alerts.basicAlert('Nombre duplicado', `Ya existe una imagen llamada "${nombre}". Renombra el archivo antes de subir.`, 'warning');
      input.value = '';
      return;
    }

    // Solo mostrar preview local y guardar el File para subirlo al guardar
    const previewUrl = URL.createObjectURL(file);
    const newRow: any = {
      id: `temp_${Date.now()}`,
      nombre,
      url: previewUrl,
      __isNew: true,
      __localFile: file
    };
    this.rowData = [...this.rowData, newRow];
    this.gridApi.setGridOption('rowData', this.rowData);
    this.hasUnsavedChanges = true;
    alerts.basicAlert('Imagen cargada', 'La imagen se ha agregado. Pulsa Guardar para subirla definitivamente.', 'info');
    input.value = '';
  }

  onImageCellClicked(params: any): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.webp,image/webp';
    input.style.display = 'none';
    document.body.appendChild(input);
    input.onchange = async (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file && file.type === 'image/webp') {
        if (file.size > 5 * 1024 * 1024) {
          alerts.basicAlert('Archivo muy grande', 'La imagen no puede superar 5MB.', 'error');
          document.body.removeChild(input);
          return;
        }
        // Solo actualizar preview y marcar el File para subirlo al guardar
        const previewUrl = URL.createObjectURL(file);
        params.data.url = previewUrl;
        params.data.__localFile = file;
        params.data.__modified = true;
        this.gridApi.refreshCells({ rowNodes: [params.node] });
        this.hasUnsavedChanges = true;
        alerts.basicAlert('Imagen actualizada', 'La nueva imagen se mostrará al guardar los cambios.', 'info');
      } else if (file) {
        alerts.basicAlert('Formato no válido', 'Solo se permiten imágenes WEBP.', 'error');
      }
      document.body.removeChild(input);
    };
    input.click();
  }

  async saveChanges(): Promise<void> {
    try {
      alerts.showLoading('Guardando', 'Subiendo imágenes y guardando cambios...');

      // 1) Subir a Firebase las filas que tengan archivo local pendiente
      for (const row of this.rowData as any[]) {
        const file: File | undefined = row.__localFile;
        if (file) {
          const url = await this.imageHandlerService.uploadFileToFirebase(file, 'login/images');
          row.url = url;
          delete row.__localFile;
        }
      }

      // 2) Enviar al backend: POST por cada item y DELETE de los que se quitaron
      const toSend = this.rowData.map((row) => {
        const id = typeof row.id === 'number' && row.id > 0 ? row.id : 0;
        return { id, nombre: row.nombre ?? '', url: row.url ?? '' };
      });
      const originalIds = (this.originalRowData as any[])
        .map((r) => r.id)
        .filter((id: unknown) => typeof id === 'number' && id > 0);

      const saved = await this.loginSetupService.saveAllAsync(toSend, originalIds);

      this.rowData = (saved || []).map((item) => ({
        id: item.id,
        nombre: item.nombre,
        url: item.url
      }));
      this.originalRowData = JSON.parse(JSON.stringify(this.rowData));
      this.hasUnsavedChanges = false;
      if (this.gridApi) {
        this.gridApi.setGridOption('rowData', this.rowData);
      }
      alerts.closeLoading();
      alerts.basicAlert('Guardado', 'Cambios guardados correctamente en el servidor.', 'success');
    } catch (err) {
      console.error('Error saving login images:', err);
      alerts.closeLoading();
      alerts.basicAlert('Error', 'No se pudieron guardar los cambios en el servidor.', 'error');
    }
  
    this.cdr.detectChanges();}

  revertChanges(): void {
    this.rowData = JSON.parse(JSON.stringify(this.originalRowData));
    this.hasUnsavedChanges = false;
    if (this.gridApi) {
      this.gridApi.setGridOption('rowData', this.rowData);
    }
    alerts.basicAlert('Deshacer', 'Se revirtieron los cambios.', 'info');
  }

  deleteRow(): void {
    if (!this.selectedRowData) {
      alerts.basicAlert('Sin selección', 'Selecciona una fila para borrar.', 'warning');
      return;
    }
    alerts.confirmAlert('¿Borrar imagen?', 'Esta acción no se puede deshacer.', 'warning', 'Sí, borrar').then((result) => {
      if (result.isConfirmed) {
        this.rowData = this.rowData.filter((row) => row !== this.selectedRowData);
        this.gridApi.setGridOption('rowData', this.rowData);
        this.selectedRowData = null;
        this.hasUnsavedChanges = true;
        alerts.basicAlert('Eliminado', 'Fila eliminada. Guarda los cambios para aplicar.', 'success');
      }
    });
  }

  onSelectionChanged(event: any): void {
    const nodes = event.api.getSelectedNodes();
    this.selectedRowData = nodes.length > 0 ? nodes[0].data : null;
  }

  onCellValueChanged(event: any): void {
    if (event.colDef.field === 'nombre') {
      const nuevoNombre = (event.newValue ?? '').trim();
      if (!nuevoNombre) {
        event.data.nombre = event.oldValue;
        this.gridApi.refreshCells({ rowNodes: [event.node] });
        alerts.basicAlert('Nombre inválido', 'El nombre no puede estar vacío.', 'warning');
        return;
      }
      if (this.isNombreDuplicado(nuevoNombre, event.data.id)) {
        event.data.nombre = event.oldValue;
        this.gridApi.refreshCells({ rowNodes: [event.node] });
        alerts.basicAlert('Nombre duplicado', `Ya existe una imagen llamada "${nuevoNombre}".`, 'warning');
        return;
      }
    }
    this.hasUnsavedChanges = true;
  }

  private isNombreDuplicado(nombre: string, excludeId?: any): boolean {
    return this.rowData.some(
      (row) => row.nombre?.toLowerCase() === nombre.toLowerCase() && row.id !== excludeId
    );
  }
}
