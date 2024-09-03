import { Component, computed } from '@angular/core';
import { UsersService } from 'app/services/users.service';

@Component({
  selector: 'app-usersxoilfields',
  standalone: true,
  imports: [],
  templateUrl: './usersxoilfields.component.html',
  styleUrl: './usersxoilfields.component.scss'
})
export class UsersxoilfieldsComponent {

  signalValue = computed(() => this.usersService.emailUser());
  mensaje: string = this.signalValue() == '' ? 'Seleccione una fila' : this.signalValue();

  constructor(private usersService: UsersService) {}

}
