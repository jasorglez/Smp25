import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { Procindic01Component } from '../procindic01/procindic01.component';
import { Procindic02Component } from '../procindic02/procindic02.component';

@Component({
  selector: 'app-procindicgrals',
  standalone: true,
  imports: [RouterModule,Procindic01Component, Procindic02Component],
  templateUrl: './procindicgrals.component.html',
  styleUrl: './procindicgrals.component.scss'
})
export class ProcindicgralsComponent {

}
