import { Component, OnDestroy, AfterViewInit, ViewChild, ElementRef, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SharedModule } from 'app/shared/shared.module';
import { FallasService, FallaIncidencia } from 'app/services/fallas.service';
import { ImageHandlerService } from 'app/services/image-handler.service';
import { SignalsService } from 'app/services/signals.service';
import { alerts } from 'app/helpers/alerts';
import * as L from 'leaflet';

type LocationStatus = 'idle' | 'loading' | 'success' | 'error';

@Component({
  selector: 'app-reporte-falla',
  standalone: true,
  imports: [CommonModule, FormsModule, SharedModule, DatePipe],
  templateUrl: './reporte-falla.component.html',
  styleUrl: './reporte-falla.component.scss',
})
export class ReporteFallaComponent implements OnDestroy, AfterViewInit {
  private fallasService = inject(FallasService);
  private imageHandler = inject(ImageHandlerService);
  private signalsService = inject(SignalsService);

  @ViewChild('mapContainer') mapContainer?: ElementRef;

  readonly today = new Date();
  readonly TOTAL_STEPS = 3;

  currentView: 'form' | 'success' = 'form';
  currentStep = 1;
  isLoading = false;
  successFolio = '';

  nombre = '';
  descripcion = '';
  fotoFile: File | null = null;
  fotoPreview: string | null = null;
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

  ngAfterViewInit(): void {}

  ngOnDestroy(): void {
    this.leafletMap?.remove();
  }

  get idCompany(): number {
    return +(this.signalsService.getRootSelectedBySidebar()() ?? 0);
  }

  onFotoCapture(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.fotoFile = file;
    const reader = new FileReader();
    reader.onload = (e) => (this.fotoPreview = e.target?.result as string);
    reader.readAsDataURL(file);
  }

  clearFoto(): void {
    this.fotoFile = null;
    this.fotoPreview = null;
  }

  nextStep(): void {
    if (this.currentStep === 1 && !this.descripcion.trim()) {
      alerts.basicAlert('Campo requerido', 'La descripción es obligatoria', 'warning');
      return;
    }
    if (this.currentStep === 2 && !this.fotoFile) {
      alerts.basicAlert('Foto requerida', 'Adjunta una foto del problema', 'warning');
      return;
    }
    if (this.currentStep < this.TOTAL_STEPS) {
      this.currentStep++;
      if (this.currentStep === 3) {
        setTimeout(() => {
          this.initMap();
          this.requestLocation();
        }, 120);
      }
    }
  }

  prevStep(): void {
    if (this.currentStep > 1) this.currentStep--;
  }

  requestLocation(): void {
    if (!navigator.geolocation) {
      this.locationStatus = 'error';
      return;
    }
    this.locationStatus = 'loading';
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.latitud = pos.coords.latitude;
        this.longitud = pos.coords.longitude;
        this.locationStatus = 'success';
        this.updateMapMarker();
      },
      () => { this.locationStatus = 'error'; },
      { enableHighAccuracy: true, timeout: 15000 }
    );
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
      let fotoUrl: string | undefined;
      if (this.fotoFile) {
        fotoUrl = await this.imageHandler.uploadFileToFirebase(this.fotoFile, 'red-ciudadana/fallas');
      }

      const falla: FallaIncidencia = {
        idCompany: this.idCompany,
        ciudadanoNombre: this.nombre.trim() || 'Anónimo',
        descripcionCiudadano: this.descripcion.trim(),
        fotoUrl,
        fechaReporte: new Date().toISOString(),
        latitud: this.latitud ?? undefined,
        longitud: this.longitud ?? undefined,
        canal: 'APP',
        status: 'NUEVO',
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
    this.currentStep = 1;
    this.nombre = '';
    this.descripcion = '';
    this.fotoFile = null;
    this.fotoPreview = null;
    this.latitud = null;
    this.longitud = null;
    this.locationStatus = 'idle';
    this.successFolio = '';
  }
}
