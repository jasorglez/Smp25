import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-generales',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './generales.component.html',
  styleUrl: './generales.component.scss'
})
export class GeneralesComponent {

}
