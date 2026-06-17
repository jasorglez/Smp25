import { effect, inject, Injectable, NgZone } from '@angular/core';
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
import { BehaviorSubject, catchError, firstValueFrom, map, Observable, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { Ilogin } from 'app/interface/ilogin';
import { SignalsService } from './signals.service';
import { SafeUserData, ApiResponse, sanitizeUserData } from 'app/interface/safe-user.interface';
import Swal from 'sweetalert2';

interface UserPermissions {
  id: number;
  idUser: number;
  indicators: boolean;
  administration: boolean;
  warehouses: boolean;
  maintenance: boolean;
  hr: boolean;
  sales: boolean;
  setup: boolean;
  active: boolean;
}

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
  private signalsService = inject(SignalsService);
  private ngZone = inject(NgZone);

  idBranch: number;
  isAdvanced: boolean = false;

  // Timers para el manejo de expiración del token
  private sessionWarningTimer: any = null;
  private sessionExpireTimer: any = null;

  // Minutos antes de expirar para mostrar la advertencia
  private readonly WARNING_BEFORE_EXPIRY_MS = 2 * 60 * 1000; // 2 minutos

  constructor() {
    effect(() => {
      this.idBranch = this.signalsService.getBranchSelectedBySidebar()();
      this.isAdvanced = this.signalsService.getIsAdvanced();
    });
  }

  login(data: Ilogin) {
    return this.http.post(environment.urlSecurity + '/Auth/login', data);
  }

  // ─── Inicia los timers de sesión una vez que el token está en localStorage ───
  startSessionTimers(): void {
    this.clearSessionTimers();

    const token = localStorage.getItem('token');
    if (!token) return;

    const expiry = this.getTokenExpiry(token);
    if (!expiry) return;

    const now = Date.now();
    const msUntilExpiry = expiry - now;

    if (msUntilExpiry <= 0) {
      // Token ya expiró
      this.logout();
      return;
    }

    const msUntilWarning = msUntilExpiry - this.WARNING_BEFORE_EXPIRY_MS;

    if (msUntilWarning > 0) {
      // Programar advertencia 2 minutos antes de expirar
      this.sessionWarningTimer = setTimeout(() => {
        this.ngZone.run(() => this.showSessionWarning(this.WARNING_BEFORE_EXPIRY_MS));
      }, msUntilWarning);
    } else {
      // Menos de 2 minutos, mostrar advertencia con el tiempo real restante
      this.ngZone.run(() => this.showSessionWarning(msUntilExpiry));
    }

    // Programar cierre de sesión automático al expirar
    this.sessionExpireTimer = setTimeout(() => {
      this.ngZone.run(() => {
        Swal.close();
        this.logout();
      });
    }, msUntilExpiry);
  }

  // ─── Muestra alerta de advertencia con cuenta regresiva ───
  private showSessionWarning(msRemaining: number): void {
    const secondsRemaining = Math.floor(msRemaining / 1000);

    let timerInterval: any;

    Swal.fire({
      title: '⏰ Sesión por expirar',
      html: `Tu sesión cerrará en <strong id="swal-countdown">${secondsRemaining}</strong> segundos.<br><br>¿Deseas continuar trabajando?`,
      icon: 'warning',
      showCancelButton: false,
      confirmButtonText: 'Entendido',
      confirmButtonColor: '#3085d6',
      allowOutsideClick: false,
      allowEscapeKey: false,
      timer: msRemaining,
      timerProgressBar: true,
      didOpen: () => {
        const countdownEl = document.getElementById('swal-countdown');
        let remaining = secondsRemaining;
        timerInterval = setInterval(() => {
          remaining--;
          if (countdownEl) countdownEl.textContent = String(remaining > 0 ? remaining : 0);
        }, 1000);
      },
      willClose: () => {
        clearInterval(timerInterval);
      }
    }).then((_result) => {
      // Si el usuario hizo clic en "Entendido" → no hacer nada.
      // El sessionExpireTimer cerrará la sesión cuando el token realmente expire.
      // Si el timer del Swal se agotó (dismiss = timer), el sessionExpireTimer
      // ya llamó Swal.close() + logout(), así que tampoco es necesario actuar aquí.
    });
  }

  // ─── Decodifica el JWT y retorna la fecha de expiración en ms ───
  private getTokenExpiry(token: string): number | null {
    try {
      const payload = token.split('.')[1];
      const decoded = JSON.parse(atob(payload));
      if (decoded.exp) {
        return decoded.exp * 1000; // exp está en segundos, convertir a ms
      }
      return null;
    } catch (e) {
      console.error('Error decodificando el token:', e);
      return null;
    }
  }

  isTokenExpired(): boolean {
    const token = localStorage.getItem('token');
    if (!token) return true;
    const expiry = this.getTokenExpiry(token);
    if (!expiry) return true;
    return Date.now() >= expiry;
  }

  // ─── Limpia los timers existentes ───
  clearSessionTimers(): void {
    if (this.sessionWarningTimer) {
      clearTimeout(this.sessionWarningTimer);
      this.sessionWarningTimer = null;
    }
    if (this.sessionExpireTimer) {
      clearTimeout(this.sessionExpireTimer);
      this.sessionExpireTimer = null;
    }
  }

  async register(email: string, password: string): Promise<User | null> {
    try {
      const result = await createUserWithEmailAndPassword(
        this.auth,
        email,
        password
      );

      if (result.user) {
        await sendEmailVerification(result.user);
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
      throw error;
    }
  }

  async logout() {
    this.clearSessionTimers();
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
      localStorage.removeItem('userRoot');
      this.signalsService.deleteSignals();
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
      const idToken = await this.getIdToken(email, password);
      await firstValueFrom(
        this.http.post(`${this.firebaseAuthUrl}:delete?key=${this.apiKey}`, {
          idToken: idToken,
        })
      );
      console.log('Usuario eliminado exitosamente.');
    } catch (error) {
      console.error('Error al eliminar el usuario:', error);
      throw error;
    }
  }

  async updatePassword(email: string, oldPassword: string, newPassword: string) {
    try {
      const idToken = await this.getIdToken(email, oldPassword);
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
      throw error;
    }
  }

  private async getIdToken(email: string, password: string) {
    const signInResponse = await firstValueFrom(
      this.http.post<any>(
        `${this.firebaseAuthUrl}:signInWithPassword?key=${this.apiKey}`,
        {
          email: email,
          password: password,
          returnSecureToken: true,
        }
      )
    );
    return signInResponse.idToken;
  }

  // ─── Permisos ───────────────────────────────────────────────────────────────

  private userPermissions: any;

  getUserId(email: string): Observable<number> {
    return this.http.get<ApiResponse<any>>(`${environment.urlSecurity}/User/email/${email}`,
      { headers: this.trackingService.getHeaders() }
    ).pipe(
      map(response => {
        const safeData = sanitizeUserData(response.data);
        return safeData.id;
      }),
      catchError(error => {
        console.error('Error al obtener el ID del usuario:', error);
        this.router.navigateByUrl('/login');
        return throwError(() => error);
      })
    );
  }

  fetchUserPermissions(userId: number): Observable<any> {
    return this.http.get(`${environment.urlSecurity}/UserSystemPermissions/guard/${userId}`, { headers: this.trackingService.getHeaders() });
  }

  fetchUserPermissionsAdvanced(userId: number, idBranch: number): Observable<any> {
    return this.http.get(`${environment.urlSecurity}/UserSystemPermissions/guardAdvanced/${userId}/${idBranch}`, { headers: this.trackingService.getHeaders() });
  }

  setUserPermissions(permissions: any): void {
    console.log(permissions);
    this.userPermissions = permissions;
  }

  getUserPermissions(): any {
    return this.userPermissions;
  }

  isRoot(): boolean {
    const email = this.signalsService.getemailChoose() || localStorage.getItem('mail') || '';
    return email.toLowerCase() === environment.root.toLowerCase();
  }

  hasMasterPermission(masterPermissionKey: string): boolean {
    return this.userPermissions?.[masterPermissionKey]?.active === true;
  }

  hasDetailedPermission(masterPermissionKey: string, detailedPermissionKey: string): boolean {
    const section = this.userPermissions?.[masterPermissionKey];
    const subSection = section?.children?.[detailedPermissionKey];
    return section?.active === true && subSection?.active === true;
  }

  hasSubDetailedPermission(masterPermissionKey: string, detailedPermissionKey: string, subdetailedPermissionKey: string): boolean {
    const section = this.userPermissions?.[masterPermissionKey];
    const subSection = section?.children?.[detailedPermissionKey];
    const subSubSection = subSection?.children?.[subdetailedPermissionKey];
    return section?.active === true && subSection?.active === true && subSubSection?.active === true;
  }

  getCrudPermission(
    masterPermissionKey: string,
    detailedPermissionKey: string,
    subdetailedPermissionKey: string,
    menu: string,
    capa: string,
    action: 'create' | 'read' | 'update' | 'delete'
  ): boolean {
    const section = this.userPermissions?.[masterPermissionKey];
    const subSection = section?.children?.[detailedPermissionKey];
    const subSubSection = subSection?.children?.[subdetailedPermissionKey];

    if (
      section?.active !== true ||
      subSection?.active !== true ||
      subSubSection?.active !== true
    ) {
      return false;
    }

    if (
      subSubSection?.name !== menu ||
      subSubSection?.description !== capa
    ) {
      return false;
    }

    const crudMap = {
      create: subSubSection.crud?.canCreate,
      read: subSubSection.crud?.canRead,
      update: subSubSection.crud?.canUpdate,
      delete: subSubSection.crud?.canDelete
    };

    return crudMap[action] === true;
  }

  getCrudPermissionDetail(
    masterPermissionKey: string,
    detailedPermissionKey: string,
    subdetailedPermissionKey: string,
    action: 'create' | 'read' | 'update' | 'delete'
  ): boolean {
    const section = this.userPermissions?.[masterPermissionKey];
    const subSection = section?.children?.[detailedPermissionKey];
    const subSubSection = subSection?.children?.[subdetailedPermissionKey];

    if (
      section?.active !== true ||
      subSection?.active !== true ||
      subSubSection?.active !== true
    ) {
      return false;
    }

    const crudMap = {
      create: subSubSection.crud?.canCreate,
      read: subSubSection.crud?.canRead,
      update: subSubSection.crud?.canUpdate,
      delete: subSubSection.crud?.canDelete
    };

    return crudMap[action] === true;
  }
}