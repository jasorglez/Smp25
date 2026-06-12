import { Component, AfterViewInit, OnInit, inject, OnDestroy, effect } from '@angular/core';
import { AdministrationService } from 'app/services/administration.service';
import { SignalsService } from 'app/services/signals.service';
import * as L from 'leaflet';
import { TrackingService } from 'app/services/tracking.service';

@Component({
  selector: 'app-radiusinfluence',
  standalone: true,
  imports: [],
  templateUrl: './radiusinfluence.component.html'
})
export class RadiusinfluenceComponent implements OnInit, AfterViewInit, OnDestroy {
  private administrationService = inject(AdministrationService);
  private signalsService = inject(SignalsService);
  private trackingService = inject(TrackingService);

  localitation: any[] = [];
  private map!: L.Map;
  idRoot!: number;
  private selectedMarker: L.Marker | null = null;
  private markers: L.Marker[] = [];
  private circles: L.Circle[] = [];
  public newLat: string;
  public newlng: string;

  // Configuración del icono
  private defaultIcon = L.icon({
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    shadowSize: [41, 41]
  });

  ngOnInit() {
    this.idRoot = this.signalsService.getRootSelectedBySidebar()();
    this.obtenerDatos();
  }
  constructor(){
    effect(() => {
      this.idRoot = this.signalsService.getRootSelectedBySidebar()();
    this.obtenerDatos();
    })
  }

  obtenerDatos() { 
    this.administrationService.getTypecustomers(this.idRoot).subscribe({
      next: (data: any) => {
        this.localitation = data;

        if (this.localitation.length > 0) {
          this.initializeMap();
          this.addMarkersFromData();
        }
        this.trackingService.addLog(this.trackingService.getnameComp(),'Get Registro en Radios de Influencia', 'Menu Administracion Radios de Influencia',  this.trackingService.getEmail());
      },
      error: (error) => {
        console.error('Error obteniendo datos:', error);
      }
    });
  }

  ngAfterViewInit(): void {
  }

  ngOnDestroy(): void {
    this.cleanMap();
  }

  private initializeMap(): void {
    this.map = L.map('map', {
      preferCanvas: true,
      zoomControl: true
    }).setView([19.432608, -99.133209], 7);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(this.map);

    // Evento para añadir nuevos marcadores con click
    this.map.on('click', (e: L.LeafletMouseEvent) => {
      this.addCustomMarker(e.latlng);
    });
  }

  private addMarkersFromData(): void {
    const bounds = L.latLngBounds([]);


    this.localitation.forEach((loc) => {
      const lat = parseFloat(loc.latitud);
      const lon = parseFloat(loc.longitud);
      const veriCp = loc.cp

      if (!isNaN(lat) && !isNaN(lon) && veriCp != "0"  && lat != 0) {
        const coordinates: L.LatLngExpression = [lat, lon];

        // Agregar marcador
        const marker = L.marker(coordinates, {
          icon: this.defaultIcon,
          draggable: true
        }).addTo(this.map);
        
        marker.bindPopup(`
          <b>${loc.nameContact}</b><br>

          CP: ${loc.cp}<br>
          Radio: ${loc.radio} km
        `);

        marker.on('dragend', (e: L.DragEndEvent) => {
          const newPos = (e.target as L.Marker).getLatLng();
          // Aquí podrías actualizar tus datos si es necesario
        });

        this.markers.push(marker);

        // Agregar círculo
        const circle = L.circle(coordinates, {
          color: loc.valueAddition,
          fillColor: loc.valueAddition,
          fillOpacity: 0.5,
          radius: loc.radio * 1000
        }).addTo(this.map);

        this.circles.push(circle);
        bounds.extend(coordinates);
      }
    });

    if (this.localitation.length > 0) {
      this.map.fitBounds(bounds.pad(0.2));
    }

    setTimeout(() => {
      this.map.invalidateSize();
    }, 200);
  }

  private addCustomMarker(latlng: L.LatLng): void {
    // Eliminar marcador anterior si existe
    if (this.selectedMarker) {
      this.map.removeLayer(this.selectedMarker);
    }

    // Crear nuevo marcador
    this.selectedMarker = L.marker(latlng, {
      draggable: true,
      icon: this.defaultIcon
    }).addTo(this.map);

    // Configurar popup
    this.selectedMarker.bindPopup(`
      <b>Nueva ubicación</b><br>
      Latitud: ${this.newLat = latlng.lat.toFixed(6)}<br>
      Longitud: ${this.newlng = latlng.lng.toFixed(6)}<br>
    `).openPopup();

    // Evento para arrastrar
    this.selectedMarker.on('dragend', (e: L.DragEndEvent) => {
      const marker = e.target as L.Marker;
      const newPos = marker.getLatLng();
      marker.setPopupContent(`
        <b>Ubicación actualizada</b><br>
        Latitud: ${newPos.lat.toFixed(6)}<br>
        Longitud: ${newPos.lng.toFixed(6)}<br>
        <button>añadir</button>
      `);
    });

    // Aquí podrías agregar también un círculo si lo deseas
    const circle = L.circle(latlng, {
      color: '#3388ff',
      fillColor: '#3388ff',
      fillOpacity: 0.2,
      radius: 10000 // 10 km por defecto
    }).addTo(this.map);

    this.circles.push(circle);
  }

  private cleanMap(): void {
    if (this.map) {
      this.markers.forEach(marker => this.map.removeLayer(marker));
      this.circles.forEach(circle => this.map.removeLayer(circle));
      this.map.remove();
      this.markers = [];
      this.circles = [];
      this.trackingService.addLog(this.trackingService.getnameComp(),'Delete Registro en Radios de Influencia', 'Menu Administracion Radios de Influencia',  this.trackingService.getEmail());
    }
  }

  // Método para obtener la ubicación seleccionada
  getSelectedLocation(): L.LatLng | null {
    return this.selectedMarker ? this.selectedMarker.getLatLng() : null;
  }

  // Método para guardar la nueva ubicación
  saveNewLocation(): void {
    if (this.selectedMarker) {
      const newLocation = {
        nameContact: 'Nueva ubicación',
        cp: '00000',
        valueAddition: '#3388ff',
        radio: 10, // Radio en km
        latitud: this.selectedMarker.getLatLng().lat.toString(),
        longitud: this.selectedMarker.getLatLng().lng.toString()
      };
      this.trackingService.addLog(this.trackingService.getnameComp(),'Add Registro en Radios de Influencia', 'Menu Administracion Radios de Influencia',  this.trackingService.getEmail());
      this.localitation.push(newLocation);

      // Aquí podrías llamar a tu servicio para guardar la nueva ubicación
    }
  }
}

