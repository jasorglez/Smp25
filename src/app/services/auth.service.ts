import { ApplicationRef, effect, inject, Injectable, NgZone } from '@angular/core';
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
import { BehaviorSubject, catchError, firstValueFrom, map, Observable, of, switchMap, tap, throwError } from 'rxjs';
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
  private appRef = inject(ApplicationRef);

  idBranch: number;
  isAdvanced: boolean = false;

  // Timer de cierre al expirar el JWT (sin modal de advertencia previa).
  private sessionExpireTimer: any = null;

  /** Cierre por inactividad (sin eventos de usuario en el documento). */
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly IDLE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutos
  private readonly ACTIVITY_THROTTLE_MS = 800;
  private lastActivityThrottleAt = 0;
  private idleListenersAttached = false;
  private readonly onIdleActivity = (): void => this.recordUserActivity();

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

    this.startIdleWatch();

    const expiry = this.getTokenExpiry(token);
    if (!expiry) return;

    const now = Date.now();
    const msUntilExpiry = expiry - now;

    if (msUntilExpiry <= 0) {
      // Token ya expiró
      this.logout();
      return;
    }

    // Programar cierre de sesión automático al expirar (sin alerta "Sesión por expirar")
    this.sessionExpireTimer = setTimeout(() => {
      this.ngZone.run(() => {
        Swal.close();
        this.logout();
      });
    }, msUntilExpiry);
  }

  /**
   * Reinicia el temporizador de inactividad. El evento `scroll` en document no se dispara al hacer
   * scroll dentro de contenedores con overflow (p. ej. cuerpo de ag-Grid); por eso también se
   * escucha `wheel` y `mousemove` (con throttle) para no cerrar sesión mientras se navega la tabla.
   */
  startIdleWatch(): void {
    this.stopIdleWatch();
    if (!localStorage.getItem('token')) {
      return;
    }
    this.attachIdleListeners();
    this.scheduleIdleTimeout();
  }

  private attachIdleListeners(): void {
    if (this.idleListenersAttached || typeof document === 'undefined') {
      return;
    }
    const opts: AddEventListenerOptions = { capture: true, passive: true };
    const optsNonPassive: AddEventListenerOptions = { capture: true, passive: false };
    document.addEventListener('keydown', this.onIdleActivity, optsNonPassive);
    document.addEventListener('mousedown', this.onIdleActivity, opts);
    document.addEventListener('touchstart', this.onIdleActivity, opts);
    document.addEventListener('click', this.onIdleActivity, opts);
    document.addEventListener('scroll', this.onIdleActivity, opts);
    document.addEventListener('wheel', this.onIdleActivity, opts);
    this.idleListenersAttached = true;
  }

  private stopIdleWatch(): void {
    if (typeof document !== 'undefined' && this.idleListenersAttached) {
      document.removeEventListener('keydown', this.onIdleActivity, { capture: true } as any);
      document.removeEventListener('mousedown', this.onIdleActivity, { capture: true } as any);
      document.removeEventListener('touchstart', this.onIdleActivity, { capture: true } as any);
      document.removeEventListener('click', this.onIdleActivity, { capture: true } as any);
      document.removeEventListener('scroll', this.onIdleActivity, { capture: true } as any);
      document.removeEventListener('wheel', this.onIdleActivity, { capture: true } as any);
      document.removeEventListener('mousemove', this.onIdleActivity, { capture: true } as any);
      this.idleListenersAttached = false;
    }
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  private recordUserActivity(): void {
    if (!localStorage.getItem('token')) {
      return;
    }
    const now = Date.now();
    if (now - this.lastActivityThrottleAt < this.ACTIVITY_THROTTLE_MS) {
      return;
    }
    this.lastActivityThrottleAt = now;
    this.scheduleIdleTimeout();
  }

  private scheduleIdleTimeout(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    this.idleTimer = setTimeout(() => {
      this.idleTimer = null;
      this.ngZone.run(() => this.onIdleTimeout());
    }, this.IDLE_TIMEOUT_MS);
  }

  private onIdleTimeout(): void {
    if (!localStorage.getItem('token')) {
      this.stopIdleWatch();
      return;
    }
    Swal.close();
    try {
      sessionStorage.setItem('idleLogoutNotice', '1');
    } catch {
      /* ignorar quota / modo privado */
    }
    void this.logout();
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

  // ─── Limpia los timers existentes ───
  clearSessionTimers(): void {
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
        } else {
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
    this.stopIdleWatch();
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
  /** Árbol básico global de UserSystemPermissions; no depende de sucursal. */
  private baseUserSystemPermissions: any = null;

  /**
   * Jerarquía de `GET .../UserSystemPermissions/guard/{userId}` (tabla UserSystem / permisos maestros).
   * Las pestañas horizontales de Administración deben basarse aquí, no en `userPermissions` cuando
   * éste viene de `guardAdvanced` (CRUD por sucursal puede marcar más detalles activos que el modal).
   */
  private menuUserPermissions: any = null;

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

  /**
   * Regla única del permiso efectivo de sesión.
   * - `idBranch === 0` o inválido: usa `guard` básico.
   * - sucursal concreta / Todas las sucursales (id negativo): usa `guardAdvanced`
   *   y lo mezcla con el árbol base.
   * - `preferUserSystemGuard`: fuerza árbol básico (Permisos maestros).
   */
  fetchEffectivePermissionsTree(
    userId: number,
    idBranch: number | null | undefined,
    preferUserSystemGuard = false
  ): Observable<any> {
    const branch = idBranch != null ? Number(idBranch) : NaN;
    const useAdvanced =
      !preferUserSystemGuard && !Number.isNaN(branch) && branch !== 0;

    if (!useAdvanced) {
      return this.fetchUserPermissions(userId).pipe(
        tap((data: any) => {
          this.baseUserSystemPermissions = data?.permissions ?? {};
        }),
        map((data: any) => data?.permissions ?? {})
      );
    }

    return this.fetchUserPermissionsAdvanced(userId, branch).pipe(
      switchMap((advancedData: any) => {
        const advanced = advancedData?.permissions;
        return this.fetchUserPermissions(userId).pipe(
          tap((basicData: any) => {
            this.baseUserSystemPermissions = basicData?.permissions ?? {};
          }),
          map((basicData: any) =>
            this.mergeGuardAdvancedIntoBase(basicData?.permissions ?? {}, advanced)
          )
        );
      })
    );
  }

  applyEffectivePermissionsTree(tree: any): void {
    this.setUserPermissions(tree);
    this.setMenuUserPermissions(tree);
  }

  /**
   * Vuelve a pedir el árbol de permisos del usuario de la sesión (misma lógica que AppComponent)
   * y actualiza `userPermissions`. Útil tras cambios en UserSystemPermissions / CRUD sin recargar la página.
   *
   * @param options.idBranchOverride Si el modal guardó permisos para otra sucursal que la del sidebar,
   *        pasar esa sucursal para que `guardAdvanced` coincida con lo guardado (p. ej. Almacenes).
   *        También puede ser negativa para la opción "Todas las sucursales".
   * @param options.preferUserSystemGuard Si es true, usa solo `guard/{userId}` (tabla UserSystem / Permisos maestros).
   *        Útil tras guardar desde el modal solo `updateUserPermissions`: `guardAdvanced` sigue leyendo CrudPermissions
   *        y no refleja el cambio hasta F5; el menú (p. ej. pestaña Sucursales) debe alinearse con UserSystem.
   */
  /** Reload agresivo que fuerza refetch sin caché después de cambios de permisos */
  forceReloadPermissions(options?: {
    idBranchOverride?: number | null;
    preferUserSystemGuard?: boolean;
  }): Observable<any> {
    // Primero recarga normal
    return this.reloadCurrentSessionGuard(options).pipe(
      // Luego recarga nuevamente después de un pequeño delay para asegurar que el servidor procesó cambios
      switchMap(() =>
        new Promise<any>(resolve => {
          setTimeout(() => {
            this.reloadCurrentSessionGuard(options).subscribe(
              result => resolve(result),
              err => resolve(null) // No fallar en el segundo reload
            );
          }, 300);
        })
      )
    );
  }

  reloadCurrentSessionGuard(options?: {
    idBranchOverride?: number | null;
    preferUserSystemGuard?: boolean;
  }): Observable<any> {
    const email = localStorage.getItem('mail');
    if (!email) {
      return throwError(() => new Error('Sin email en sesión'));
    }
    if (options?.preferUserSystemGuard === true) {
      return this.getUserId(email).pipe(
        switchMap((userId) =>
          this.fetchEffectivePermissionsTree(userId, 0, true).pipe(
            tap((tree) => this.applyEffectivePermissionsTree(tree))
          )
        ),
        tap(() => {
          this.signalsService.bumpGuardRefreshTick();
          try {
            this.appRef.tick();
          } catch {
            /* ignorar si no hay árbol de aplicación */
          }
        })
      );
    }
    const sidebarBranch = Number(this.signalsService.getBranchSelectedBySidebar()());
    const override =
      options?.idBranchOverride != null ? Number(options.idBranchOverride) : NaN;
    const idBranch = !Number.isNaN(override) && override !== 0 ? override : sidebarBranch;

    return this.getUserId(email).pipe(
      switchMap((userId) =>
        this.fetchEffectivePermissionsTree(userId, idBranch).pipe(
          tap((tree) => this.applyEffectivePermissionsTree(tree))
        )
      ),
      tap(() => {
        this.signalsService.bumpGuardRefreshTick();
        try {
          this.appRef.tick();
        } catch {
          /* ignorar si no hay árbol de aplicación */
        }
      })
    );
  }

  /**
   * Combina `guard` (árbol UserSystem completo) con `guardAdvanced` (CRUD por sucursal).
   * El backend solo incluye en guardAdvanced maestros con filas CrudPermissions para esa sucursal.
   * - Si solo se usara advanced, faltarían maestros con permiso en UserSystem pero sin clave en la respuesta.
   * - Si solo se mezclaran las claves presentes en advanced, los maestros no devueltos seguirían activos
   *   por el básico y el menú mostraría más módulos de los que el CRUD de esa sucursal permite.
   * Regla: partir del básico, aplicar cada maestro que venga en advanced y desactivar el subárbol de los
   * maestros del básico que no figuren en advanced para esta sucursal.
   */
  mergeGuardAdvancedIntoBase(basePermissions: any, advancedPermissions: any): any {
    if (basePermissions == null || typeof basePermissions !== 'object') {
      return advancedPermissions != null && typeof advancedPermissions === 'object'
        ? advancedPermissions
        : {};
    }
    if (
      advancedPermissions == null ||
      typeof advancedPermissions !== 'object' ||
      Object.keys(advancedPermissions).length === 0
    ) {
      return basePermissions;
    }
    const merged = this.deepClonePlainObject(basePermissions);
    for (const masterKey of Object.keys(merged)) {
      if (Object.prototype.hasOwnProperty.call(advancedPermissions, masterKey)) {
        merged[masterKey] = this.mergeAdvancedPermissionNodes(
          merged[masterKey],
          advancedPermissions[masterKey]
        );
      }
      // Si el master está en el árbol base (rol) pero no en advanced (depto/sucursal),
      // se conserva activo: los permisos del rol son aditivos, no restrictivos.
    }
    for (const masterKey of Object.keys(advancedPermissions)) {
      if (!Object.prototype.hasOwnProperty.call(merged, masterKey)) {
        merged[masterKey] = this.deepClonePlainObject(advancedPermissions[masterKey]);
      }
    }
    return merged;
  }

  private deactivatePermissionSubtree(node: any): any {
    if (node == null || typeof node !== 'object') {
      return node;
    }
    const out: any = Array.isArray(node) ? [...node] : { ...node };
    out.active = false;
    if (out.children != null && typeof out.children === 'object' && !Array.isArray(out.children)) {
      const nextChildren: any = {};
      for (const ck of Object.keys(out.children)) {
        nextChildren[ck] = this.deactivatePermissionSubtree(out.children[ck]);
      }
      out.children = nextChildren;
    }
    return out;
  }

  private deepClonePlainObject<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj)) as T;
  }

  private mergeAdvancedPermissionNodes(baseNode: any, advNode: any): any {
    if (advNode == null || typeof advNode !== 'object') {
      return baseNode;
    }
    if (baseNode == null || typeof baseNode !== 'object') {
      return this.deepClonePlainObject(advNode);
    }
    const out: any = { ...baseNode };
    for (const k of Object.keys(advNode)) {
      if (k === 'children' && advNode.children != null && typeof advNode.children === 'object') {
        const bc = baseNode.children;
        const bcObj = bc != null && typeof bc === 'object' ? bc : {};
        const oc = advNode.children as Record<string, unknown>;
        out.children = { ...bcObj };
        const childKeys = new Set([...Object.keys(bcObj), ...Object.keys(oc)]);
        for (const ck of childKeys) {
          if (Object.prototype.hasOwnProperty.call(oc, ck)) {
            out.children[ck] = this.mergeAdvancedPermissionNodes(bcObj[ck], oc[ck]);
          } else {
            out.children[ck] = bcObj[ck];
          }
        }
      } else if (k !== 'children') {
        out[k] = advNode[k];
      }
    }
    if (!('children' in advNode) && baseNode.children != null) {
      out.children = baseNode.children;
    }
    return out;
  }

  setUserPermissions(permissions: any): void {
    this.userPermissions = permissions;
  }

  /** Árbol guard básico (UserSystem) para visibilidad de menús alineada al modal de permisos maestros. */
  setMenuUserPermissions(permissions: any): void {
    this.menuUserPermissions = permissions ?? null;
  }

  getUserPermissions(): any {
    return this.userPermissions;
  }

  /**
   * Pestañas / ítems de menú que deben coincidir con permisos maestros (UserSystem).
   * Si aún no se ha cargado `guard/{userId}`, se usa el árbol actual como respaldo para no dejar el menú vacío.
   */
  hasMenuDetailedPermission(masterPermissionKey: string, detailedPermissionKey: string): boolean {
    const tree = this.menuUserPermissions;
    if (tree && typeof tree === 'object' && Object.keys(tree).length > 0) {
      const section = tree[masterPermissionKey];
      const subSection = section?.children?.[detailedPermissionKey];
      return section?.active === true && subSection?.active === true;
    }
    return this.hasDetailedPermission(masterPermissionKey, detailedPermissionKey);
  }

  hasMenuMasterPermission(masterPermissionKey: string): boolean {
    const tree = this.menuUserPermissions;
    if (tree && typeof tree === 'object' && Object.keys(tree).length > 0) {
      return tree[masterPermissionKey]?.active === true;
    }
    return this.hasMasterPermission(masterPermissionKey);
  }

  hasMasterPermission(masterPermissionKey: string): boolean {
    return this.userPermissions?.[masterPermissionKey]?.active === true;
  }

  hasDetailedPermission(masterPermissionKey: string, detailedPermissionKey: string): boolean {
    const section = this.userPermissions?.[masterPermissionKey];
    const subSection = section?.children?.[detailedPermissionKey];
    return section?.active === true && subSection?.active === true;
  }

  /**
   * Pestaña "Almacenes" en Setup usuarios: el permiso activado en el modal (Setup Usuarios › Almacenes)
   * puede llegar al guard como `warehouses`, `almacenes` u otro identificador bajo `users-setup`
   * o un maestro cuyo identificador combine setup + usuario.
   */
  hasUsersMenuWarehousesAccess(): boolean {
    const baseTree = this.baseUserSystemPermissions;
    if (baseTree?.['users-setup']?.active === true &&
        baseTree?.['users-setup']?.children?.['warehouses']?.active === true) {
      return true;
    }
    if (baseTree?.['users-setup']?.active === true &&
        baseTree?.['users-setup']?.children?.['almacenes']?.active === true) {
      return true;
    }
    const perms = baseTree ?? this.userPermissions;
    if (!perms || typeof perms !== 'object') {
      return false;
    }
    for (const [masterKey, masterRaw] of Object.entries(perms)) {
      const mk = String(masterKey).toLowerCase();
      const isSetupUsersMaster =
        mk === 'users-setup' || (mk.includes('setup') && mk.includes('usuario'));
      if (!isSetupUsersMaster) {
        continue;
      }
      const master = masterRaw as Record<string, unknown>;
      const masterChildren = master['children'];
      if (master?.['active'] !== true || !masterChildren || typeof masterChildren !== 'object') {
        continue;
      }
      for (const [detKey, detRaw] of Object.entries(masterChildren as Record<string, unknown>)) {
        const dk = String(detKey).toLowerCase();
        if (!dk.includes('almacen') && !dk.includes('warehouse')) {
          continue;
        }
        if ((detRaw as { active?: boolean })?.active === true) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Operador puede gestionar el árbol empresa › sucursales › departamentos cuando su sesión
   * tiene el detalle «Departamento» bajo Setup Usuarios (claves `department` / `departamento` u homólogos en el guard).
   */
  hasUsersMenuDepartmentAccess(): boolean {
    const baseTree = this.baseUserSystemPermissions;
    if (baseTree?.['users-setup']?.active === true &&
        baseTree?.['users-setup']?.children?.['department']?.active === true) {
      return true;
    }
    if (baseTree?.['users-setup']?.active === true &&
        baseTree?.['users-setup']?.children?.['departamento']?.active === true) {
      return true;
    }
    const perms = baseTree ?? this.userPermissions;
    if (!perms || typeof perms !== 'object') {
      return false;
    }
    for (const [masterKey, masterRaw] of Object.entries(perms)) {
      const mk = String(masterKey).toLowerCase();
      const isSetupUsersMaster =
        mk === 'users-setup' || (mk.includes('setup') && mk.includes('usuario'));
      if (!isSetupUsersMaster) {
        continue;
      }
      const master = masterRaw as Record<string, unknown>;
      const masterChildren = master['children'];
      if (master?.['active'] !== true || !masterChildren || typeof masterChildren !== 'object') {
        continue;
      }
      for (const [detKey, detRaw] of Object.entries(masterChildren as Record<string, unknown>)) {
        const dk = String(detKey).toLowerCase();
        if (
          dk.includes('department') ||
          dk.includes('departamento')
        ) {
          if ((detRaw as { active?: boolean })?.active === true) {
            return true;
          }
        }
      }
    }
    return false;
  }

  /**
   * Operador: detalle «Security» bajo Setup Usuarios (UserSystem / guard).
   */
  hasUsersMenuSecurityAccess(): boolean {
    const baseTree = this.baseUserSystemPermissions;
    if (baseTree?.['users-setup']?.active === true &&
        baseTree?.['users-setup']?.children?.['security']?.active === true) {
      return true;
    }
    const perms = baseTree ?? this.userPermissions;
    if (!perms || typeof perms !== 'object') {
      return false;
    }
    for (const [masterKey, masterRaw] of Object.entries(perms)) {
      const mk = String(masterKey).toLowerCase();
      const isSetupUsersMaster =
        mk === 'users-setup' || (mk.includes('setup') && mk.includes('usuario'));
      if (!isSetupUsersMaster) {
        continue;
      }
      const master = masterRaw as Record<string, unknown>;
      const masterChildren = master['children'];
      if (master?.['active'] !== true || !masterChildren || typeof masterChildren !== 'object') {
        continue;
      }
      for (const [detKey, detRaw] of Object.entries(masterChildren as Record<string, unknown>)) {
        const dk = String(detKey).toLowerCase();
        if (dk.includes('security') || dk.includes('seguridad')) {
          if ((detRaw as { active?: boolean })?.active === true) {
            return true;
          }
        }
      }
    }
    return false;
  }

  /**
   * Operador: detalle «Permisos» bajo Setup Usuarios (UserSystem / guard).
   */
  hasUsersMenuPermissionsAccess(): boolean {
    const baseTree = this.baseUserSystemPermissions;
    if (baseTree?.['users-setup']?.active === true &&
        baseTree?.['users-setup']?.children?.['permissions']?.active === true) {
      return true;
    }
    const perms = baseTree ?? this.userPermissions;
    if (!perms || typeof perms !== 'object') {
      return false;
    }
    for (const [masterKey, masterRaw] of Object.entries(perms)) {
      const mk = String(masterKey).toLowerCase();
      const isSetupUsersMaster =
        mk === 'users-setup' || (mk.includes('setup') && mk.includes('usuario'));
      if (!isSetupUsersMaster) {
        continue;
      }
      const master = masterRaw as Record<string, unknown>;
      const masterChildren = master['children'];
      if (master?.['active'] !== true || !masterChildren || typeof masterChildren !== 'object') {
        continue;
      }
      for (const [detKey, detRaw] of Object.entries(masterChildren as Record<string, unknown>)) {
        const dk = String(detKey).toLowerCase();
        if (dk.includes('permission') || dk.includes('permiso')) {
          if ((detRaw as { active?: boolean })?.active === true) {
            return true;
          }
        }
      }
    }
    return false;
  }

  hasSubDetailedPermission(masterPermissionKey: string, detailedPermissionKey: string, subdetailedPermissionKey: string): boolean {
    const section = this.userPermissions?.[masterPermissionKey];
    const subSection = section?.children?.[detailedPermissionKey];
    const subSubSection = subSection?.children?.[subdetailedPermissionKey];
    return section?.active === true && subSection?.active === true && subSubSection?.active === true;
  }

  getActiveSubDetailedByTipo(masterKey: string, detailedKey: string, tipo: string): any[] {
    const section = this.userPermissions?.[masterKey];
    const subSection = section?.children?.[detailedKey];
    if (section?.active !== true || subSection?.active !== true || !subSection?.children) return [];
    return Object.values(subSection.children).filter(
      (item: any) => item?.active === true && (item?.tipo ?? '').toLowerCase() === tipo.toLowerCase()
    );
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
