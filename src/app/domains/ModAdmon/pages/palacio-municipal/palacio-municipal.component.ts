import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-palacio-municipal',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, TranslateModule, MatIconModule],
  templateUrl: './palacio-municipal.component.html',
  styleUrl: './palacio-municipal.component.scss'
})
export class PalacioMunicipalComponent {

}
