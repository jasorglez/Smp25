import { inject, Component, ChangeDetectorRef} from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-enterprise';
import { CommonModule } from '@angular/common';
import { AttachHandlerService } from 'app/services/attach-handler.service';

@Component({
  selector: 'app-image-cell-renderer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="image-cell-container">
      <!-- Mostrar imagen si existe -->
      <div *ngIf="imageUrl" class="image-preview" (click)="onImageClick()">
        <img [src]="imageUrl" alt="Imagen del material" />
      </div>

      <!-- Botón para subir imagen -->
      <button
        class="upload-btn"
        [class.has-image]="imageUrl"
        (click)="uploadImage($event)"
        title="{{ imageUrl ? 'Cambiar imagen' : 'Subir imagen' }}">
        <i class="bi" [class.bi-cloud-upload]="!imageUrl" [class.bi-pencil]="imageUrl"></i>
      </button>

      <!-- Botón para eliminar imagen (solo si existe) -->
      <button
        *ngIf="imageUrl"
        class="delete-btn"
        (click)="deleteImage($event)"
        title="Eliminar imagen">
        <i class="bi bi-trash"></i>
      </button>
    </div>
  `,
  styles: [`
    .image-cell-container {
      display: flex;
      align-items: center;
      gap: 8px;
      height: 100%;
      padding: 4px;
    }

    .image-preview {
      width: 40px;
      height: 40px;
      border-radius: 4px;
      border: 1px solid #ddd;
      overflow: hidden;
      cursor: pointer;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      flex-shrink: 0;
    }

    .image-preview:hover {
      transform: scale(1.05);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    }

    .image-preview img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .upload-btn,
    .delete-btn {
      padding: 4px 8px;
      border: 1px solid #ccc;
      border-radius: 4px;
      background: white;
      cursor: pointer;
      transition: all 0.2s ease;
      font-size: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .upload-btn {
      color: #2196f3;
      border-color: #2196f3;
    }

    .upload-btn:hover {
      background: #2196f3;
      color: white;
    }

    .upload-btn.has-image {
      color: #ff9800;
      border-color: #ff9800;
    }

    .upload-btn.has-image:hover {
      background: #ff9800;
      color: white;
    }

    .delete-btn {
      color: #f44336;
      border-color: #f44336;
    }

    .delete-btn:hover {
      background: #f44336;
      color: white;
    }

    .upload-btn i,
    .delete-btn i {
      font-size: 14px;
    }
  `]
})
export class ImageCellRendererComponent implements ICellRendererAngularComp {
  private readonly cdr = inject(ChangeDetectorRef);
  imageUrl: string = '';
  private params!: ICellRendererParams;

  constructor(private attachHandler: AttachHandlerService) {}

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.imageUrl = params.value || '';
  
    this.cdr.detectChanges();}

  refresh(params: ICellRendererParams): boolean {
    this.params = params;
    this.imageUrl = params.value || '';
    return true;
  }

  async uploadImage(event: Event): Promise<void> {
    event.stopPropagation();

    try {
      const url = await this.attachHandler.uploadImg();

      if (url) {
        // Actualizar el valor en el grid
        this.imageUrl = url;
        this.params.node.setDataValue(this.params.colDef.field!, url);

        // Marcar como modificado
        if (this.params.data) {
          this.params.data.__modified = true;
        }

        // Notificar al componente padre que hay cambios sin guardar
        if (this.params.context && this.params.context.componentParent) {
          this.params.context.componentParent.hasUnsavedChanges = true;
        }
      }
    } catch (error) {
      console.error('Error uploading image:', error);
    }
  }

  deleteImage(event: Event): void {
    event.stopPropagation();

    // Limpiar la imagen
    this.imageUrl = '';
    this.params.node.setDataValue(this.params.colDef.field!, '');

    // Marcar como modificado
    if (this.params.data) {
      this.params.data.__modified = true;
    }

    // Notificar al componente padre que hay cambios sin guardar
    if (this.params.context && this.params.context.componentParent) {
      this.params.context.componentParent.hasUnsavedChanges = true;
    }
  }

  onImageClick(): void {
    if (this.imageUrl && this.params.context && this.params.context.componentParent) {
      this.params.context.componentParent.openImageModal(this.imageUrl);
    }
  }
}
