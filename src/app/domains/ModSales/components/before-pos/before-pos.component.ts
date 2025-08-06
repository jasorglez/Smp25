import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { NgSelectModule } from '@ng-select/ng-select';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-before-pos',
  standalone: true,
  imports: [NgSelectModule, FormsModule],
  templateUrl: './before-pos.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BeforePosComponent  implements OnInit {
  constructor(private router: Router) { }
  dbStore = [
    {id: 1, location: "Tuxtepec", cajas:[{idCaja: 1, NoCaja:1}, {idCaja: 2, NoCaja:2}, {idCaja: 3, NoCaja:3}]},
    {id: 2, location: "Loma", cajas: [{idCaja: 1, NoCaja:1}, {idCaja: 2, NoCaja:2}]},
    {id: 3, location: "Otatitlan",cajas: [{idCaja: 1, NoCaja:1}]},
  ];

  idLocation: number | null = null; // Para almacenar el ID de la ubicación seleccionada
  selectedLocation: any = null; // Para almacenar el objeto de la ubicación seleccionada
  cajasDisponibles: any[] = []; // Array para almacenar las cajas de la ubicación seleccionada
  idCajaSeleccionada: number | null = null; // Para almacenar el ID de la caja seleccionada
  selectedCaja: any = null;
  condition: boolean = false;
  ngOnInit(): void {
    if(this.condition == false){
      this.router.navigate(['/procsales/pos']); 
    }
  }

  onLocationSelect(location: any): void {
    if (location) {
      this.selectedLocation = location.location;
      this.cajasDisponibles = location.cajas;
      this.idLocation = location.id; 
    } else {
      this.selectedLocation = null;
      this.cajasDisponibles = [];
      this.idLocation = null;
      this.idCajaSeleccionada = null;
    }
  }

  onBoxSelect(caja: any): void {
    if (caja) {
      this.idCajaSeleccionada = caja.idCaja;
      this.selectedCaja = caja.NoCaja
    } else {
      this.idCajaSeleccionada = null;
    }
  }

  onPuntoVenta(){
    console.log("Se encuentra en : " , this.selectedLocation, " Y la caja es: ", this.selectedCaja)
  }
}
