import { Injectable } from '@angular/core';
import { Ilogin } from '../interface/ilogin';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs/operators'
import { environment } from '../../environments/environment';
import { TrackingService } from './tracking.service';

@Injectable({
  providedIn: 'root'
})

export class LoginService {

  constructor(private http: HttpClient,
    private trackingService: TrackingService) { }

  data: any;

  /*=============================================
  LOGIN en Firebase Authentication
  =============================================*/

  login(data: Ilogin) {
    //Aquí creamos el Token
    const dataLogin = {
      email: data.email,
      password: data.password
    };
    return this.http.post(environment.urlLinux, dataLogin)
  }
 
}
