import { Component, OnDestroy, AfterViewInit, ViewChild, ElementRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SharedModule } from 'app/shared/shared.module';
import { FallasService, FallaIncidencia, FallaAnalysis } from 'app/services/fallas.service';
import { ImageHandlerService } from 'app/services/image-handler.service';
import { SignalsService } from 'app/services/signals.service';
import { alerts } from 'app/helpers/alerts';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';
import { environment } from '@env/environment';
import * as L from 'leaflet';

type LocationStatus = 'idle' | 'loading' | 'success' | 'error';

@Component({
  selector: 'app-reporte-falla',
  standalone: true,
  imports: [CommonModule, FormsModule, SharedModule],
  templateUrl: './reporte-falla.component.html',
  styleUrl: './reporte-falla.component.scss',
})
export class ReporteFallaComponent implements OnDestroy, AfterViewInit {
  private fallasService = inject(FallasService);
  private imageHandler = inject(ImageHandlerService);
  private signalsService = inject(SignalsService);

  @ViewChild('mapContainer') mapContainer?: ElementRef;

  currentView: 'form' | 'success' = 'form';
  isLoading = false;
  successFolio = '';

  nombre = '';
  descripcion = '';
  fotoFile: File | null = null;
  fotoPreview: string | null = null;
  fotoUrl: string | null = null;
  analisisIa: FallaAnalysis | null = null;
  analizando = false;
  latitud: number | null = null;
  longitud: number | null = null;
  locationStatus: LocationStatus = 'idle';

  private leafletMap?: L.Map;
  private marker?: L.Marker;

  private readonly mapIcon = L.icon({
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    shadowSize: [41, 41],
  });

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.initMap();
      this.requestLocation();
    }, 120);
  }

  ngOnDestroy(): void {
    this.leafletMap?.remove();
  }

  get idCompany(): number {
    return +(this.signalsService.getRootSelectedBySidebar()() ?? 0);
  }

  async capturarFoto(): Promise<void> {
    try {
      const image = await Camera.getPhoto({
        quality: 85,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Prompt,
      });
      if (!image.dataUrl) return;
      this.fotoPreview = image.dataUrl;
      this.fotoFile    = this.dataUrlToFile(image.dataUrl, 'falla.jpg');
      this.analisisIa  = null;
      await this.subirYAnalizarFoto();
    } catch { /* cancelado por el usuario */ }
  }

  private async subirYAnalizarFoto(): Promise<void> {
    if (!this.fotoFile) return;
    this.analizando = true;
    try {
      this.fotoUrl = await this.imageHandler.uploadFileToFirebase(this.fotoFile, environment.storageFolders.fallas);
      this.analisisIa = await new Promise<FallaAnalysis>((res, rej) =>
        this.fallasService.analizarFoto(this.fotoUrl!).subscribe({ next: res, error: rej })
      );
    } catch {
      alerts.basicAlert('Aviso', 'No se pudo analizar la foto con IA. Puedes continuar de todas formas.', 'warning');
    } finally {
      this.analizando = false;
    }
  }

  clearFoto(): void {
    this.fotoFile   = null;
    this.fotoPreview = null;
    this.fotoUrl    = null;
    this.analisisIa = null;
  }

  private dataUrlToFile(dataUrl: string, filename: string): File {
    const [header, data] = dataUrl.split(',');
    const mime = header.match(/:(.*?);/)![1];
    const bytes = atob(data);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    return new File([arr], filename, { type: mime });
  }

  async requestLocation(): Promise<void> {
    this.locationStatus = 'loading';
    try {
      await Geolocation.requestPermissions();
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000 });
      this.latitud = pos.coords.latitude;
      this.longitud = pos.coords.longitude;
      this.locationStatus = 'success';
      this.updateMapMarker();
    } catch {
      this.locationStatus = 'error';
    }
  }

  private initMap(): void {
    if (!this.mapContainer?.nativeElement || this.leafletMap) return;
    this.leafletMap = L.map(this.mapContainer.nativeElement, { zoomControl: true })
      .setView([23.6345, -102.5528], 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
    }).addTo(this.leafletMap);
  }

  private updateMapMarker(): void {
    if (!this.leafletMap || this.latitud == null || this.longitud == null) return;
    setTimeout(() => {
      this.leafletMap!.invalidateSize();
      this.leafletMap!.setView([this.latitud!, this.longitud!], 16);
      if (this.marker) this.leafletMap!.removeLayer(this.marker);
      this.marker = L.marker([this.latitud!, this.longitud!], { icon: this.mapIcon })
        .addTo(this.leafletMap!)
        .bindPopup('Ubicación del problema')
        .openPopup();
    }, 60);
  }

  async enviar(): Promise<void> {
    if (!this.descripcion.trim()) {
      alerts.basicAlert('Campo requerido', 'La descripción es obligatoria', 'warning');
      return;
    }
    this.isLoading = true;
    try {
      const falla: FallaIncidencia = {
        idCompany:            this.idCompany,
        ciudadanoNombre:      this.nombre.trim() || 'Anónimo',
        descripcionCiudadano: this.descripcion.trim(),
        fotoUrl:              this.fotoUrl ?? undefined,
        fechaReporte:         new Date().toISOString(),
        latitud:              this.latitud ?? undefined,
        longitud:             this.longitud ?? undefined,
        canal:                'APP',
        status:               'NUEVO',
        tipoFalla:            this.analisisIa?.tipoFalla,
        severidadIa:          this.analisisIa?.severidad,
        departamento:         this.analisisIa?.departamento,
        descripcionIa:        this.analisisIa?.descripcion,
      };

      const result = await new Promise<FallaIncidencia>((res, rej) =>
        this.fallasService.create(falla).subscribe({ next: res, error: rej })
      );

      this.successFolio = result.folio ?? '';
      this.currentView = 'success';
    } catch {
      alerts.basicAlert('Error', 'No se pudo enviar el reporte. Inténtalo de nuevo.', 'error');
    } finally {
      this.isLoading = false;
    }
  }

  nuevoReporte(): void {
    this.leafletMap?.remove();
    this.leafletMap = undefined;
    this.marker = undefined;
    this.currentView = 'form';
    this.nombre = '';
    this.descripcion = '';
    this.fotoFile    = null;
    this.fotoPreview = null;
    this.fotoUrl     = null;
    this.analisisIa  = null;
    this.latitud     = null;
    this.longitud = null;
    this.locationStatus = 'idle';
    this.successFolio = '';
    setTimeout(() => {
      this.initMap();
      this.requestLocation();
    }, 120);
  }
}
