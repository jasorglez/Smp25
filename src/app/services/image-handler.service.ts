import { inject, Injectable } from '@angular/core';
import { StoragesService } from './storages.service';
import { ICellRendererParams } from 'ag-grid-enterprise';
import { alerts } from 'app/helpers/alerts';

@Injectable({
  providedIn: 'root'
})
export class ImageHandlerService {

  private storagesService = inject(StoragesService);

  // Guardar imagen
  imageCellRenderer(params: ICellRendererParams) {
    const cellContainer = document.createElement('div');
    cellContainer.style.width = '100%';
    cellContainer.style.height = '100%';
    cellContainer.style.display = 'flex';
    cellContainer.style.alignItems = 'center';
    cellContainer.style.justifyContent = 'center';
    cellContainer.style.cursor = 'pointer';

    const img = document.createElement('img');
    img.src = params.value || './assets/img/default.png';
    img.style.maxWidth = '100%';
    img.style.maxHeight = '100%';
    img.style.objectFit = 'contain';

    cellContainer.addEventListener('dblclick', () => {
      if (params.colDef.cellRendererParams && params.colDef.cellRendererParams.clicked) {
        params.colDef.cellRendererParams.clicked(params);
      }
    });

    cellContainer.appendChild(img);
    return cellContainer;
  }

  onImageCellClicked(params: ICellRendererParams) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg, image/png'; // Actualizado para que solo acepte jpg y png
    input.onchange = (event: any) => this.uploadImage(event, params);
    input.click();
  }

  uploadImage(event: any, params: ICellRendererParams) {
    const file = event.target.files[0];
    if (!file || (file.type !== 'image/jpeg' && file.type !== 'image/png')) {
      alerts.basicAlert('Subir imagen', 'Solo se permiten imágenes en JPG o PNG, por favor seleccione otra imagen.', 'error');
      return;
    }

    const field = params.colDef.cellRendererParams?.field as string;
    const path = `images/${this.storagesService.generateRandom()}${file.name}`;

    this.storagesService.uploadFile(file, path)
      .then(url => {
        params.node.setDataValue(field, url);
        alerts.basicAlert('Subir imagen', 'Imagen subida exitosamente.', 'success');
      })
      .catch(error => {
        console.error("Error uploading file", error);
        alerts.basicAlert('Subir imagen', 'Error al subir la imagen. Por favor, intente nuevamente.', 'error');
      });
  }


  // NUEVO MÉTODO para subir videos a Firebase
  uploadFileToFirebase(file: File, folder: string = 'videos'): Promise<string> {
    return new Promise((resolve, reject) => {
      const path = `${folder}/${this.storagesService.generateRandom()}${file.name}`;
      
      this.storagesService.uploadFile(file, path)
        .then(url => {
          resolve(url);
        })
        .catch(error => {
          console.error("Error uploading file to Firebase", error);
          reject(error);
        });
    });
  }

  // NUEVO MÉTODO para manejar videos en el grid
  onVideoCellClicked(params: ICellRendererParams) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/*';
    input.onchange = (event: any) => this.uploadVideo(event, params);
    input.click();
  }

// MÉTODO CORREGIDO para subir videos
uploadVideo(event: any, params: any) {
  const file = event.target.files[0];
  if (!file) return;

  // Validar que sea un archivo de video
  if (!file.type.startsWith('video/')) {
    alerts.basicAlert('Subir video', 'Solo se permiten archivos de video.', 'error');
    return;
  }

  // Validar tamaño del archivo (máximo 100MB)
  const maxSize = 100 * 1024 * 1024;
  if (file.size > maxSize) {
    alerts.basicAlert('Subir video', 'El archivo es demasiado grande. Tamaño máximo: 100MB', 'error');
    return;
  }

  const path = `videos/${this.storagesService.generateRandom()}${file.name}`;

  this.storagesService.uploadFile(file, path)
    .then(url => {
      // Actualizar directamente los datos en lugar de usar setDataValue
      params.data.imageUrl = url;
      
      // Marcar como modificado para que se guarde
      params.data.__modified = true;
      
      // Refrescar la celda para mostrar el cambio
      if (params.node && params.node.gridApi) {
        params.node.gridApi.refreshCells({ rowNodes: [params.node] });
      }
      
      alerts.basicAlert('Subir video', 'Video subido exitosamente.', 'success');
    })
    .catch(error => {
      console.error("Error uploading video", error);
      alerts.basicAlert('Subir video', 'Error al subir el video. Por favor, intente nuevamente.', 'error');
    });
}
}
