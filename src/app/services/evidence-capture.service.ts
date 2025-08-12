import { Injectable } from '@angular/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { CameraPreview, CameraPreviewPictureOptions, CameraPreviewOptions } from '@capacitor-community/camera-preview';
import { Filesystem, Directory } from '@capacitor/filesystem';
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
    try {
      console.log('🎥 Starting video capture with CameraPreview...');
      
      // Show camera preview in modal with proper z-index handling
      const result = await Swal.fire({
        title: '📹 Grabar Video',
        html: `
          <div style="position: relative; width: 100%; height: 400px; background: #000; border-radius: 8px; overflow: hidden; margin-bottom: 20px;">
            <div id="camera-preview-container" style="width: 100%; height: 100%; position: relative;"></div>
          </div>
          <div id="recording-status" style="margin: 15px 0; font-weight: bold; font-size: 16px; color: #28a745;">
            📱 Preparando cámara...
          </div>
          <div style="display: flex; justify-content: center; gap: 15px; margin-top: 20px;">
            <button id="record-btn" class="btn btn-danger btn-lg" style="padding: 12px 25px; font-size: 16px; border-radius: 25px;">
              🔴 Iniciar Grabación
            </button>
            <button id="stop-btn" class="btn btn-success btn-lg" style="display: none; padding: 12px 25px; font-size: 16px; border-radius: 25px;">
              ⏹️ Detener Grabación
            </button>
          </div>
        `,
        showConfirmButton: false,
        showCancelButton: true,
        cancelButtonText: 'Cerrar Cámara',
        width: '90%',
        heightAuto: false,
        customClass: {
          popup: 'video-recording-modal'
        },
        backdrop: true,
        allowOutsideClick: false,
        didOpen: async () => {
          try {
            // Add custom styles to ensure proper layering
            const style = document.createElement('style');
            style.textContent = `
              .video-recording-modal {
                z-index: 10000 !important;
              }
              .video-recording-modal .swal2-content {
                z-index: 10001 !important;
              }
              .video-recording-modal button {
                z-index: 10002 !important;
                position: relative;
              }
            `;
            document.head.appendChild(style);
            
            // Start camera preview with container as parent
            const cameraPreviewOptions: CameraPreviewOptions = {
              position: 'rear',
              parent: 'camera-preview-container',
              className: 'camera-preview',
              width: window.innerWidth * 0.75,
              height: 400,
              toBack: false, // Keep camera in front but contained
              disableAudio: false
            };
            
            await CameraPreview.start(cameraPreviewOptions);
            console.log('📹 Camera preview started');
            
            const recordBtn = document.getElementById('record-btn')!;
            const stopBtn = document.getElementById('stop-btn')!;
            const statusDiv = document.getElementById('recording-status')!;
            let isRecording = false;
            
            // Update status when camera is ready
            statusDiv.textContent = '📹 Cámara lista - Presiona para grabar';
            statusDiv.style.color = '#28a745';
            
            recordBtn.onclick = async () => {
              try {
                await CameraPreview.startRecordVideo({
                  position: 'rear'
                });
                isRecording = true;
                recordBtn.style.display = 'none';
                stopBtn.style.display = 'inline-block';
                statusDiv.textContent = '🔴 Grabando video...';
                statusDiv.style.color = '#dc3545';
                console.log('🎥 Video recording started');
              } catch (error) {
                console.error('Error starting video recording:', error);
                alerts.basicAlert('Error', 'No se pudo iniciar la grabación', 'error');
              }
            };
            
            stopBtn.onclick = async () => {
              try {
                const videoResult = await CameraPreview.stopRecordVideo();
                isRecording = false;
                console.log('🎥 Video recording stopped:', videoResult);
                
                statusDiv.textContent = '✅ Video grabado correctamente';
                statusDiv.style.color = '#28a745';
                
                // Store result for processing
                (window as any).videoRecordResult = videoResult;
                
                // Auto close modal after 1 second
                setTimeout(() => {
                  Swal.close();
                }, 1000);
                
              } catch (error) {
                console.error('Error stopping video recording:', error);
                alerts.basicAlert('Error', 'No se pudo detener la grabación', 'error');
              }
            };
            
          } catch (error) {
            console.error('Error starting camera preview:', error);
            const statusDiv = document.getElementById('recording-status')!;
            statusDiv.textContent = '❌ Error al iniciar la cámara';
            statusDiv.style.color = '#dc3545';
          }
        },
        willClose: async () => {
          try {
            await CameraPreview.stop();
            console.log('📹 Camera preview stopped');
            
            // Clean up custom styles
            const customStyle = document.querySelector('style:last-of-type');
            if (customStyle && customStyle.textContent?.includes('video-recording-modal')) {
              customStyle.remove();
            }
          } catch (error) {
            console.error('Error stopping camera preview:', error);
          }
        }
      });
      
      // Process recorded video if available
      const videoResult = (window as any).videoRecordResult;
      if (videoResult) {
        await this.processVideoResult(videoResult);
        delete (window as any).videoRecordResult;
      }
      
    } catch (error: any) {
      console.error('Error in video capture:', error);
      alerts.basicAlert('Error', `Error al grabar video: ${error.message}`, 'error');
    }
  }
  
  private async processVideoResult(videoResult: any): Promise<void> {
    if (videoResult && videoResult.videoFilePath) {
      console.log('🎥 Processing recorded video:', videoResult.videoFilePath);
      
      try {
        // Read the video file and convert to base64
        const videoFile = await Filesystem.readFile({
          path: videoResult.videoFilePath
        });
        
        const evidence: EvidenceFile = {
          id: this.generateId(),
          type: 'video',
          dataUrl: `data:video/mp4;base64,${videoFile.data}`,
          filename: `video_${Date.now()}.mp4`,
          timestamp: new Date()
        };
        
        this.evidenceFiles.push(evidence);
        alerts.basicAlert('Éxito', 'Video grabado correctamente', 'success');
        
      } catch (error) {
        console.error('Error processing video file:', error);
        alerts.basicAlert('Error', 'Error al procesar el video', 'error');
      }
    }
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

  async playVideo(evidenceFile: EvidenceFile): Promise<void> {
    if (evidenceFile.type !== 'video') {
      alerts.basicAlert('Error', 'Este archivo no es un video', 'error');
      return;
    }

    try {
      console.log('🎬 Playing video:', evidenceFile.filename);
      
      await Swal.fire({
        title: `📹 ${evidenceFile.filename}`,
        html: `
          <div style="width: 100%; max-width: 600px; margin: 0 auto;">
            <video 
              controls 
              autoplay 
              style="width: 100%; height: auto; max-height: 400px; border-radius: 8px; background: #000;"
              poster="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTggNVYxOUwxOSAxMkw4IDVaIiBmaWxsPSIjNjY2Ii8+Cjwvc3ZnPgo=">
              <source src="${evidenceFile.dataUrl}" type="video/mp4">
              <source src="${evidenceFile.dataUrl}" type="video/webm">
              <p style="color: #666; padding: 20px; text-align: center;">
                Tu navegador no soporta la reproducción de video. 
                <br>
                <a href="${evidenceFile.dataUrl}" download="${evidenceFile.filename}" 
                   style="color: #007bff; text-decoration: none;">
                  📥 Descargar video
                </a>
              </p>
            </video>
            <div style="margin-top: 15px; text-align: center; color: #666; font-size: 14px;">
              <div>📅 Grabado: ${evidenceFile.timestamp.toLocaleString()}</div>
              <div style="margin-top: 5px;">📁 Archivo: ${evidenceFile.filename}</div>
            </div>
          </div>
        `,
        showConfirmButton: true,
        confirmButtonText: 'Cerrar',
        showCancelButton: true,
        cancelButtonText: '📥 Descargar',
        width: '90%',
        customClass: {
          popup: 'video-player-modal'
        },
        didOpen: () => {
          // Add custom styles for video player
          const style = document.createElement('style');
          style.textContent = `
            .video-player-modal .swal2-html-container {
              padding: 0 !important;
              margin: 20px 0 !important;
            }
            .video-player-modal video {
              box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            }
            .video-player-modal video:focus {
              outline: 2px solid #007bff;
              outline-offset: 2px;
            }
          `;
          document.head.appendChild(style);
        },
        willClose: () => {
          // Clean up custom styles
          const customStyle = document.querySelector('style:last-of-type');
          if (customStyle && customStyle.textContent?.includes('video-player-modal')) {
            customStyle.remove();
          }
        }
      }).then((result) => {
        if (result.dismiss === Swal.DismissReason.cancel) {
          // User clicked download
          this.downloadVideo(evidenceFile);
        }
      });

    } catch (error) {
      console.error('Error playing video:', error);
      alerts.basicAlert('Error', 'No se pudo reproducir el video', 'error');
    }
  }

  private downloadVideo(evidenceFile: EvidenceFile): void {
    try {
      // Create download link
      const link = document.createElement('a');
      link.href = evidenceFile.dataUrl;
      link.download = evidenceFile.filename;
      link.style.display = 'none';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      console.log('📥 Video download initiated:', evidenceFile.filename);
      alerts.basicAlert('Descarga', 'Descarga iniciada', 'success');
      
    } catch (error) {
      console.error('Error downloading video:', error);
      alerts.basicAlert('Error', 'No se pudo descargar el video', 'error');
    }
  }

  async previewEvidence(evidenceFile: EvidenceFile): Promise<void> {
    if (evidenceFile.type === 'video') {
      await this.playVideo(evidenceFile);
    } else if (evidenceFile.type === 'image') {
      await Swal.fire({
        title: `📸 ${evidenceFile.filename}`,
        html: `
          <div style="text-align: center;">
            <img 
              src="${evidenceFile.dataUrl}" 
              alt="${evidenceFile.filename}"
              style="max-width: 100%; max-height: 400px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);"
            >
            <div style="margin-top: 15px; color: #666; font-size: 14px;">
              <div>📅 Capturado: ${evidenceFile.timestamp.toLocaleString()}</div>
              <div style="margin-top: 5px;">📁 Archivo: ${evidenceFile.filename}</div>
            </div>
          </div>
        `,
        confirmButtonText: 'Cerrar',
        showCancelButton: true,
        cancelButtonText: '📥 Descargar',
        width: '90%'
      }).then((result) => {
        if (result.dismiss === Swal.DismissReason.cancel) {
          this.downloadImage(evidenceFile);
        }
      });
    }
  }

  private downloadImage(evidenceFile: EvidenceFile): void {
    try {
      const link = document.createElement('a');
      link.href = evidenceFile.dataUrl;
      link.download = evidenceFile.filename;
      link.style.display = 'none';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      console.log('📥 Image download initiated:', evidenceFile.filename);
      alerts.basicAlert('Descarga', 'Descarga iniciada', 'success');
      
    } catch (error) {
      console.error('Error downloading image:', error);
      alerts.basicAlert('Error', 'No se pudo descargar la imagen', 'error');
    }
  }
}