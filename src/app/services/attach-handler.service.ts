import { inject, Injectable } from '@angular/core';
import { StoragesService } from './storages.service';
import { alerts } from 'app/helpers/alerts';

@Injectable({
  providedIn: 'root'
})
export class AttachHandlerService {

  private storagesService = inject(StoragesService);

  // Guardar imagen
  uploadImg(): Promise<string> {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/jpeg, image/png';
      input.onchange = (event: any) => {
        this.uploadImage(event)
          .then(url => resolve(url))
          .catch(error => reject(error));
      };
      input.click();
    });
  }

  uploadPdf(): Promise<string> {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/pdf';
      input.onchange = (event: any) => {
        this.uploadDocument(event)
          .then(url => resolve(url))
          .catch(error => reject(error));
      };
      input.click();
    });
  }

  private uploadImage(event: any): Promise<string> {
    return new Promise((resolve, reject) => {
      const file = event.target.files[0];
      if (!file || (file.type !== 'image/jpeg' && file.type !== 'image/png')) {
        alerts.basicAlert('Subir imagen', 'Solo se permiten imágenes en JPG o PNG, por favor seleccione otra imagen.', 'error');
        reject('Tipo de archivo no válido');
        return;
      }

      const path = `images/${this.storagesService.generateRandom()}${file.name}`;
      this.storagesService.uploadFile(file, path)
        .then(url => {
          resolve(url);
        })
        .catch(error => {
          console.error("Error uploading file", error);
          alerts.basicAlert('Subir imagen', 'Error al subir la imagen. Por favor, intente nuevamente.', 'error');
          reject(error);
        });
    });
  }

  private uploadDocument(event: any): Promise<string> {
    return new Promise((resolve, reject) => {
      const file = event.target.files[0];
      if (!file || (file.type !== 'application/pdf')) {
        alerts.basicAlert('Subir archivo', 'Solo se permiten documentos en PDF, por favor seleccione otro archivo.', 'error');
        reject('Tipo de archivo no válido');
        return;
      }

      const path = `pdf/${Date.now()}_${file.name}`;
      this.storagesService.uploadFile(file, path)
        .then(url => {
          resolve(url);
        })
        .catch(error => {
          console.error("Error uploading file", error);
          alerts.basicAlert('Subir archivo', 'Error al subir el archivo. Por favor, intente nuevamente.', 'error');
          reject(error);
        });
    });
  }

  getBaseFilenameFromUrl(url: string): string {
    // Decodifica la URL para manejar caracteres especiales
    const decodedUrl = decodeURIComponent(url);
    // Divide la URL por '/' y toma el último segmento
    const segments = decodedUrl.split('/');
    const filename = segments[segments.length - 1];
    // Remueve cualquier parámetro de consulta
    const baseFilename = filename.split('?')[0];
    return baseFilename;
  }
}
