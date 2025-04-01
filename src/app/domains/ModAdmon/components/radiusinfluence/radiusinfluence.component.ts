import { Component, AfterViewInit, OnInit, inject } from '@angular/core';
import { AdministrationService } from 'app/services/administration.service';
import { SignalsService } from 'app/services/signals.service';
import * as L from 'leaflet';

@Component({
  selector: 'app-radiusinfluence',
  standalone: true,
  imports: [],
  templateUrl: './radiusinfluence.component.html',
  styleUrl: './radiusinfluence.component.scss'
})
export class RadiusinfluenceComponent implements OnInit, AfterViewInit {

  private administrationService = inject(AdministrationService);
  private signalsService = inject(SignalsService);
  
  localitation: any[] = [];
  private map!: L.Map;
  idRoot!: number;

  ngOnInit() {
    this.idRoot = this.signalsService.getRootSelectedBySidebar()();
    this.obtenerDatos();
  }

  obtenerDatos() {
    this.administrationService.getTypecustomers(this.idRoot).subscribe({
      next: (data: any) => {
        this.localitation = data;
        console.log("Datos obtenidos:", data);

        // Solo inicializa el mapa si hay datos
        if (this.localitation.length > 0) {
          this.initializeMap();
        }
      },
      error: (error) => {
        console.error('Error obteniendo datos:', error);
      }
    });
  }

  ngAfterViewInit(): void {
    console.log('RadiusinfluenceComponent initialized');
  }

  private initializeMap(): void {
    // Inicializa el mapa en la primera ubicación
    this.map = L.map('map').setView([19.432608, -99.133209], 7); // CDMX como centro inicial

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(this.map);

    const bounds = L.latLngBounds([]);

    // Iterar sobre los datos y agregar marcadores y círculos
    this.localitation.forEach((loc) => {
      const lat = parseFloat(loc.latitud);
      const lon = parseFloat(loc.longitud);

      if (!isNaN(lat) && !isNaN(lon)) {
        const coordinates: [number, number] = [lat, lon];

        // Agregar marcador
        const marker = L.marker(coordinates).addTo(this.map);
        marker.bindPopup(`${loc.nameContact}: ${loc.cp}`).openPopup();

        // Agregar círculo
        L.circle(coordinates, {
          color: loc.valueAddition,
          fillColor: loc.valueAddition,
          fillOpacity: 0.5,
          radius: loc.radio * 1000
        }).addTo(this.map);

        // Extender bounds para incluir este punto
        bounds.extend(coordinates);
      }
    });

    // Ajustar zoom para mostrar todos los puntos
    if (this.localitation.length > 0) {
      this.map.fitBounds(bounds);
    }

    setTimeout(() => {
      this.map.invalidateSize();
    }, 200);
  }
}
