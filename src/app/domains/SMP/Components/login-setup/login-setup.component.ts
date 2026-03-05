import { Component, ViewChild, ElementRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-community';
import { ImageHandlerService } from 'app/services/image-handler.service';
import { alerts } from 'app/helpers/alerts';

const STORAGE_KEY = 'smp_login_images';

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
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const data = stored ? JSON.parse(stored) : [];
      this.rowData = Array.isArray(data) ? [...data] : [];
      this.originalRowData = JSON.parse(JSON.stringify(this.rowData));
      this.hasUnsavedChanges = false;
      if (this.gridApi) {
        this.gridApi.setGridOption('rowData', this.rowData);
      }
    } catch (e) {
      console.error('Error loading login images:', e);
      this.rowData = [];
      this.originalRowData = [];
    }
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

    alerts.showLoading('Subiendo imagen', 'Cargando imagen WEBP...');
    this.imageHandlerService
      .uploadFileToFirebase(file, 'login/images')
      .then((url) => {
        const nombre = file.name.replace(/\.webp$/i, '') || `Imagen ${Date.now()}`;
        const newRow = {
          id: `temp_${Date.now()}`,
          nombre,
          url,
          __isNew: true
        };
        this.rowData = [...this.rowData, newRow];
        this.gridApi.setGridOption('rowData', this.rowData);
        this.hasUnsavedChanges = true;
        alerts.closeLoading();
        alerts.basicAlert('Imagen cargada', 'La imagen WEBP se subió correctamente. Guarda los cambios para persistir.', 'success');
      })
      .catch((err) => {
        console.error('Error uploading WEBP:', err);
        alerts.closeLoading();
        alerts.basicAlert('Error', 'No se pudo subir la imagen. Intenta de nuevo.', 'error');
      });
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
        try {
          alerts.showLoading('Subiendo imagen', 'Actualizando imagen WEBP...');
          const url = await this.imageHandlerService.uploadFileToFirebase(file, 'login/images');
          params.data.url = url;
          params.data.__modified = true;
          this.gridApi.refreshCells({ rowNodes: [params.node] });
          this.hasUnsavedChanges = true;
          alerts.closeLoading();
          alerts.basicAlert('Imagen actualizada', 'Se actualizó la imagen correctamente.', 'success');
        } catch (err) {
          alerts.closeLoading();
          alerts.basicAlert('Error', 'No se pudo subir la imagen.', 'error');
        }
      } else if (file) {
        alerts.basicAlert('Formato no válido', 'Solo se permiten imágenes WEBP.', 'error');
      }
      document.body.removeChild(input);
    };
    input.click();
  }

  saveChanges(): void {
    const toStore = this.rowData.map((row) => ({
      id: row.id,
      nombre: row.nombre ?? '',
      url: row.url ?? ''
    }));
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
      this.originalRowData = JSON.parse(JSON.stringify(this.rowData));
      this.hasUnsavedChanges = false;
      alerts.basicAlert('Guardado', 'Cambios guardados correctamente.', 'success');
    } catch (e) {
      alerts.basicAlert('Error', 'No se pudieron guardar los cambios.', 'error');
    }
  }

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

  onCellValueChanged(): void {
    this.hasUnsavedChanges = true;
  }
}
