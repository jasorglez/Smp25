import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import {
  Auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendEmailVerification,
  User,
  authState,
} from '@angular/fire/auth';
import { TrackingService } from './tracking.service';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { Ilogin } from 'app/interface/ilogin';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private firebaseAuthUrl =
    'https://identitytoolkit.googleapis.com/v1/accounts';

  private apiKey = environment.firebase.apiKey;
  private trackingService = inject(TrackingService);
  private router = inject(Router);
  private auth = inject(Auth);
  private http = inject(HttpClient);

  login(data: Ilogin) {
    //Aquí creamos el Token
    const dataLogin = {
      email: data.email,
      password: data.password
    };
    return this.http.post(environment.urlSecurity+'/Auth/login', dataLogin)
  }

  async register(email: string, password: string): Promise<User | null> {
    try {
      const result = await createUserWithEmailAndPassword(
        this.auth,
        email,
        password
      );

      if (result.user) {
        // Enviar verificación de correo electrónico
        await sendEmailVerification(result.user);

        // Verificar si el correo electrónico está verificado
        if (result.user.emailVerified) {
          console.log('El correo electrónico ha sido verificado.');
        } else {
          console.log('El correo electrónico aún no ha sido verificado.');
        }
        return result.user;
      } else {
        console.error('El usuario no existe en el resultado.');
        return null;
      }
    } catch (error) {
      console.error('Error registrando el usuario:', error);
      throw error; // Propagate the error
    }
  }

  async logout() {
    try {
      this.trackingService.addLog(
        '',
        'Salio del Sistema - Cierre de sesion',
        'Menu Side Bar',
        ''
      );
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('project');
      localStorage.removeItem('company');
      localStorage.removeItem('branch');
      localStorage.removeItem('mail');
      localStorage.removeItem('sqlToken');

      this.router.navigateByUrl('/login');

      await signOut(this.auth);
    } catch (error) {
      console.log(error);
    }
  }

  getCurrentUser(): Promise<User | null> {
    return new Promise((resolve, reject) => {
      const unsubscribe = this.auth.onAuthStateChanged((user) => {
        unsubscribe();
        resolve(user);
      }, reject);
    });
  }

  async removeUserByEmail(email: string, password: string) {
    try {
      // Primero, necesitamos obtener el ID token del usuario
      // Este es el de Firebase, nada que ver con el microservicio
      // de SQL
      const idToken = await this.getIdToken(email, password);

      // Ahora podemos eliminar la cuenta usando el ID token
      await firstValueFrom(
        this.http.post(`${this.firebaseAuthUrl}:delete?key=${this.apiKey}`, {
          idToken: idToken,
        })
      );

      console.log('Usuario eliminado exitosamente.');
    } catch (error) {
      console.error('Error al eliminar el usuario:', error);
      throw error; // Re-lanza el error para que pueda ser manejado por el componente
    }
  }

  async updatePassword(
    email: string,
    oldPassword: string,
    newPassword: string
  ) {
    try {
      // Inicia sesión con el correo y la contraseña actual
      const idToken = await this.getIdToken(email, oldPassword);

      // Actualiza la contraseña
      await firstValueFrom(
        this.http.post(`${this.firebaseAuthUrl}:update?key=${this.apiKey}`, {
          idToken: idToken,
          password: newPassword,
          returnSecureToken: false,
        })
      );

      console.log(`Contraseña actualizada para el correo ${email}`);
    } catch (error) {
      console.error('Error al actualizar la contraseña:', error);
      throw error; // Re-lanza el error para que pueda ser manejado por el componente
    }
  }

  // private async getIdToken(): Promise<string | null> {
  //   try {
  //     const user = await this.getCurrentUser();
  //     if (user) {
  //       const idToken = await user.getIdToken();
  //       return idToken;
  //     } else {
  //       throw new Error('No hay usuario actual');
  //     }
  //   } catch (error) {
  //     console.error('Error al obtener el token de ID:', error);
  //     return null;
  //   }
  // }

  private async getIdToken(email: string, password: string) {
    const signInResponse = await firstValueFrom(
      this.http.post<any>(
        `${this.firebaseAuthUrl}:signInWithPassword?key=${this.apiKey}`,
        {
          email: email,
          password: password, // Necesitarás la contraseña actual del usuario
          returnSecureToken: true,
        }
      )
    );
    return signInResponse.idToken;
  }
}