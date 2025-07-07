import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-ordenes',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './ordenes.component.html',
  styleUrl: './ordenes.component.scss'
})
export class OrdenesComponent {

}