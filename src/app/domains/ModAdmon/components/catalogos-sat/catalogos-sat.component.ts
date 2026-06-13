import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { FacturacionService } from 'app/services/facturacion.service';

@Component({
  selector: 'app-catalogos-sat',
  standalone: true,
  imports: [CommonModule, RouterModule, AgGridModule],
  templateUrl: './catalogos-sat.component.html',
  styleUrl: './catalogos-sat.component.scss'
})
export class CatalogosSatComponent {

}
