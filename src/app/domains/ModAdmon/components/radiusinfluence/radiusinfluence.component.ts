import { Component, AfterViewInit } from '@angular/core';
import * as L from 'leaflet';

@Component({
  selector: 'app-radiusinfluence',
  standalone: true,
  imports: [],
  templateUrl: './radiusinfluence.component.html',
  styleUrl: './radiusinfluence.component.scss'
})
export class RadiusinfluenceComponent implements AfterViewInit {
  private map: L.Map;
  
  // Use AfterViewInit instead of OnInit to ensure the DOM is fully rendered
  ngAfterViewInit(): void {
    console.log('RadiusinfluenceComponent initialized');
    
    // Short timeout to ensure the map container is fully rendered
    setTimeout(() => {
      this.initializeMap();
    }, 100);
  }
  
  private initializeMap(): void {
    // Coordenadas para el código postal 68310
    const cp = '68310';
    const coordinates = this.getCoordinatesFromCP(cp);
    
    if (coordinates) {
      // Inicializa el mapa centrado en las coordenadas del código postal 68310
      this.map = L.map('map').setView(coordinates, 10); // Reduced initial zoom level to show more area
      
      // Agrega una capa de mapa base (OpenStreetMap)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(this.map);
      
      // Agrega un marcador en las coordenadas del código postal 68310
      const marker = L.marker(coordinates).addTo(this.map);
      marker.bindPopup(`Código Postal: ${cp}`).openPopup();
      
      // Agrega un círculo de 20 km de radio alrededor del marcador
      const circle = L.circle(coordinates, {
        color: 'blue',
        fillColor: '#87CEEB',
        fillOpacity: 0.5,
        radius: 20000 // 20 km
      }).addTo(this.map);
      
      // Ajusta el zoom para asegurar que el círculo completo sea visible
      const bounds = circle.getBounds();
      this.map.fitBounds(bounds);
      
      // Invalidate size after a short delay to ensure map is properly rendered
      setTimeout(() => {
        this.map.invalidateSize();
      }, 200);
    } else {
      console.error('No se encontraron coordenadas para el código postal:', cp);
    }
  }
  
  private getCoordinatesFromCP(cp: string): [number, number] | null {
    // Implementa la lógica para obtener las coordenadas del CP
    switch (cp) {
      case '68310':
        return [18.0842745, -96.1288426]; // Coordenadas reales para el código postal 68310
      case '76000':
        return [20.076989, -98.392631]; // Ejemplo para Santiago de Querétaro
      default:
        return null;
    }
  }
}