import { Component } from '@angular/core';
import { MarinesComponent } from "../../components/marines/marines.component";
import { MarinepipesComponent } from "../../components/marinepipes/marinepipes.component";
import { ElectmarinesComponent } from "../../components/electmarines/electmarines.component";
import { LocalizationsComponent } from "../../components/localizations/localizations.component";
import { LandpipesComponent } from "../../components/landpipes/landpipes.component";
import { PlantbatComponent } from "../../components/plantbat/plantbat.component";
import { ElectlandComponent } from "../../components/electland/electland.component";

@Component({
  selector: 'app-procdash',
  standalone: true,
  imports: [MarinesComponent, MarinepipesComponent, ElectmarinesComponent, LocalizationsComponent,
     LandpipesComponent, PlantbatComponent, ElectlandComponent],
  templateUrl: './procdash.component.html',
  styleUrl: './procdash.component.scss'
})
export class ProcdashComponent {


}
