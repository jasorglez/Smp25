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
}
