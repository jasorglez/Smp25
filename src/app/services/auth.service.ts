import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Auth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, sendEmailVerification, User, authState } from '@angular/fire/auth';
import { TrackingService } from './tracking.service';
import { first, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private firebaseAuthUrl = 'https://identitytoolkit.googleapis.com/v1/accounts';

  constructor(
    private trackingService: TrackingService,
    private router: Router,
    private auth: Auth,
    private http: HttpClient
  ) { }

  async login(email: string, password: string) {
    try {
      const result = await signInWithEmailAndPassword(this.auth, email, password);
      return result;
    } catch (error) {
      console.log(error);
      return null;
    }
  }

  async register(email: string, password: string) {
    try {
      const result = await createUserWithEmailAndPassword(this.auth, email, password);

      if (result.user) {
        // Enviar verificación de correo electrónico
        await sendEmailVerification(result.user);

        // Verificar si el correo electrónico está verificado
        if (result.user.emailVerified) {
          console.log('El correo electrónico ha sido verificado.');
        } else {
          console.log('El correo electrónico aún no ha sido verificado.');
        }
      } else {
        console.error('El usuario no existe en el resultado.');
      }
    } catch (error) {
      console.error('Error registrando el usuario:', error);
    }
  }

  async logout() {
    try {
      this.trackingService.addLog('', 'Salio del Sistema - Cierre de sesion', 'Menu Side Bar', '');
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('project');
      localStorage.removeItem('company');
      localStorage.removeItem('branch');
      localStorage.removeItem('mail');

      this.router.navigateByUrl("/login");

      await signOut(this.auth);
    } catch (error) {
      console.log(error);
    }
  }

  getCurrentUser(): Promise<User | null> {
    return new Promise((resolve, reject) => {
      const unsubscribe = this.auth.onAuthStateChanged(user => {
        unsubscribe();
        resolve(user);
      }, reject);
    });
  }

  async removeUserByEmail(email: string) {
    try {
      const queryParams = `?email=${encodeURIComponent(email)}`;
      const response = await this.http.post(`${this.firebaseAuthUrl}:delete${queryParams}`, {}).toPromise();
      console.log('Usuario eliminado exitosamente.');
    } catch (error) {
      console.log('Error al eliminar el usuario:', error);
    }
  }

  private async getIdToken(): Promise<string | null> {
    try {
      const user = await this.getCurrentUser();
      if (user) {
        const idToken = await user.getIdToken();
        return idToken;
      } else {
        throw new Error('No hay usuario actual');
      }
    } catch (error) {
      console.error('Error al obtener el token de ID:', error);
      return null;
    }
  }
}
