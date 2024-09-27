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
    const img = document.createElement('img');
    img.src = params.value || './assets/img/profile.png';
    img.style.height = '100%';
    img.style.cursor = 'pointer';
    img.addEventListener('dblclick', () => {
      if (params.colDef.cellRendererParams && params.colDef.cellRendererParams.clicked) {
        params.colDef.cellRendererParams.clicked(params);
      }
    });
    return img;
  }

  onImageCellClicked(params: ICellRendererParams) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg';
    input.onchange = (event: any) => this.uploadImage(event, params);
    input.click();
  }

  uploadImage(event: any, params: ICellRendererParams) {
    const file = event.target.files[0];
    if (!file || file.type !== 'image/jpeg') {
      alerts.basicAlert('Subir imagen', 'Solo se permiten imágenes en JPG, por favor seleccione otra imagen.', 'error');
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
}
