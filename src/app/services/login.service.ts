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
    //Aquí creamos el sqlToken
    return this.http.post(environment.urlLogin, data).pipe(
      map((resp: any) => {
        // Capturamos el idToken y refreshToken
        localStorage.setItem('token', resp.idToken);
        localStorage.setItem('refreshToken', resp.refreshToken);
        this.getSqlToken(data.email, data.password)
        .then(token => {
          localStorage.setItem('sqlToken', token);
        })
        .catch(error => {
          console.error('Error al obtener el token:', error);
        });
      })
    );
  }
  async getSqlToken(email: string, password: string): Promise<string> {
    const dataLogin = {
      email: email,
      password: password
    };
    try {
      const resp: any = await this.http.post(`${environment.urlAzure2}api/Login`, dataLogin).toPromise();
      if (resp && resp.code === 200 && resp.data && resp.data.token) {
        const token = resp.data.token;
        return token;
      } else {
        throw new Error('Respuesta inválida del servidor');
      }
    } catch (error) {
      console.error('Error al enviar datos', error);
      throw new Error('Ocurrió un error al procesar la solicitud');
    }
  }
}
