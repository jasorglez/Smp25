import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ConventionsComponent } from "../../components/ind01/conventions/conventions.component";
import { AdvancesComponent } from "../../components/ind01/advances/advances.component";

@Component({
  selector: 'app-procindic01',
  standalone: true,
  imports: [RouterModule,ConventionsComponent, AdvancesComponent],
  templateUrl: './procindic01.component.html',
  styleUrl: './procindic01.component.scss'
})
export class Procindic01Component {

}
