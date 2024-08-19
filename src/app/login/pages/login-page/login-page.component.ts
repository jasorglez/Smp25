 import { Component } from '@angular/core';
import { ComploginComponent } from '../../components/complogin/complogin.component';



@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [ComploginComponent],
  templateUrl: './login-page.component.html',
  styleUrl: './login-page.component.scss'
})
export class LoginPageComponent {

}
