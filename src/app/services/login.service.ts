import { Injectable } from '@angular/core';
import { Ilogin } from '../interface/ilogin';
import { HttpClient } from '@angular/common/http';
import  {map} from 'rxjs/operators'
import { environment } from '../../environments/environment';
import { TrackingService } from './tracking.service';


@Injectable({
  providedIn: 'root'
})
export class LoginService {

	constructor(private http: HttpClient,
    private trackingService : TrackingService) { }

/*=============================================
LOGIN en Firebase Authentication
=============================================*/

login(data: Ilogin){

    return this.http.post(environment.urlLogin, data).pipe(
    map((resp:any)=>{
      // Capturamos el idToken y refreshToken
      localStorage.setItem('token', resp.idToken);
      localStorage.setItem('refreshToken', resp.refreshToken);
    })

);
}


}
