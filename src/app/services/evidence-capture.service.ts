import { Injectable } from '@angular/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { alerts } from 'app/helpers/alerts';
import Swal from 'sweetalert2';

export interface EvidenceFile {
  id: string;
  type: 'image' | 'video';
  dataUrl: string;
  filename: string;
  timestamp: Date;
}

@Injectable({
  providedIn: 'root'
})
export class EvidenceCaptureService {
  private evidenceFiles: EvidenceFile[] = [];

  constructor() {}

  async presentImageSourceOptions(): Promise<void> {
    const { value: option } = await Swal.fire({
      title: 'Agregar Evidencia',
      showCancelButton: true,
      confirmButtonText: 'Seleccionar',
      cancelButtonText: 'Cancelar',
      input: 'radio',
      inputOptions: {
        camera: 'Tomar Foto',
        gallery: 'Seleccionar de Galería',
        video: 'Grabar Video'
      },
      inputValidator: (value) => {
        if (!value) {
          return 'Debes seleccionar una opción';
        }
        return null;
      }
    });

    if (option) {
      switch (option) {
        case 'camera':
          await this.captureFromCamera();
          break;
        case 'gallery':
          await this.selectFromGallery();
          break;
        case 'video':
          await this.captureVideo();
          break;
      }
    }
  }

  private async captureFromCamera(): Promise<void> {
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera
      });

      if (image.dataUrl) {
        const evidence: EvidenceFile = {
          id: this.generateId(),
          type: 'image',
          dataUrl: image.dataUrl,
          filename: `foto_${Date.now()}.jpg`,
          timestamp: new Date()
        };
        
        this.evidenceFiles.push(evidence);
      }
    } catch (error) {
      console.error('Error capturing image:', error);
      alerts.basicAlert('Error', 'No se pudo tomar la foto', 'error');
    }
  }

  private async selectFromGallery(): Promise<void> {
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Photos
      });

      if (image.dataUrl) {
        const evidence: EvidenceFile = {
          id: this.generateId(),
          type: 'image',
          dataUrl: image.dataUrl,
          filename: `imagen_${Date.now()}.jpg`,
          timestamp: new Date()
        };
        
        this.evidenceFiles.push(evidence);
      }
    } catch (error) {
      console.error('Error selecting image:', error);
      alerts.basicAlert('Error', 'No se pudo seleccionar la imagen', 'error');
    }
  }

  private async captureVideo(): Promise<void> {
    alerts.basicAlert('Info', 'Funcionalidad de video en desarrollo', 'info');
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  getEvidenceFiles(): EvidenceFile[] {
    return [...this.evidenceFiles];
  }

  removeEvidenceFile(id: string): void {
    this.evidenceFiles = this.evidenceFiles.filter(file => file.id !== id);
  }

  clearAllEvidence(): void {
    this.evidenceFiles = [];
  }

  getEvidenceCount(): number {
    return this.evidenceFiles.length;
  }
}