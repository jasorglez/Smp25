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

  uploadEmployeeDoc(): Promise<{ url: string }> {
    const ACCEPTED_MIME = [
      'application/pdf',
      'image/jpeg', 'image/png',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ];

    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.pdf,.jpg,.jpeg,.png,.xls,.xlsx,.doc,.docx,.ppt,.pptx';
      input.onchange = async (event: any) => {
        const file: File = event.target.files[0];
        if (!file) { reject('Sin archivo'); return; }
        if (!ACCEPTED_MIME.includes(file.type)) {
          alerts.userSaveErrorToast('Subir archivo', 'Formato no permitido. Use PDF, JPG, PNG, XLS(X), DOC(X) o PPT(X).');
          reject('Tipo no válido');
          return;
        }
        const isPdf  = file.type === 'application/pdf';
        const isImage = file.type.startsWith('image/');
        const path = isPdf   ? `pdf/${Date.now()}_${file.name}`
                   : isImage ? `images/${this.storagesService.generateRandom()}${file.name}`
                             : `docs/${Date.now()}_${file.name}`;
        try {
          const url = await this.storagesService.uploadFile(file, path);
          resolve({ url });
        } catch (error) {
          alerts.userSaveErrorToast('Subir archivo', 'Error al subir el archivo.');
          reject(error);
        }
      };
      input.click();
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
