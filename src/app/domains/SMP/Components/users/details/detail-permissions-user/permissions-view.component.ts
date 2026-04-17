import { Component, inject, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RolesService, CrudxDetailedPermission, RolesxDetailedPermission } from 'app/services/roles.service';
import { SignalsService } from 'app/services/signals.service';
import { EMPTY, forkJoin, lastValueFrom, Observable, of } from 'rxjs';
import { take, map, catchError, switchMap } from 'rxjs/operators';
import { TimeService } from 'app/services/time.service';
import { alerts } from 'app/helpers/alerts';
import { ICellRendererParams } from 'ag-grid-enterprise';
import { TrackingService } from 'app/services/tracking.service';
import { PermitionsService } from 'app/services/permitions.service';
import { MasterPermissions2Service } from 'app/services/master-permissions-2.service';
import { AuthService } from 'app/services/auth.service';

// --- Interfaces ---
interface CrudPermission {
  name: string;
  canRead: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  idMasterPermission: number;
  idDetailedPermission: number;
  idShowPermition: number;
  active?: boolean;
  __original: any;
}

interface SubdetailPermission {
  subdetailedPermissionName: string;
  principal: CrudPermission | null;
  children: CrudPermission[];
}

interface DetailedPermission {
  detailedPermissionName: string;
  detailedRead: boolean;
  subdetails: SubdetailPermission[];
}

interface MasterPermission {
  masterPermissionName: string;
  aplica: boolean;
  masterRead: boolean;
  details: DetailedPermission[];
}

type PermissionsScope = 'userSystem' | 'position';

@Component({
  selector: 'app-permissions-view-by-user',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './permissions-view.component.html',
  styleUrls: ['./permissions-view.component.scss']
})
export class PermissionsViewByUserComponent implements OnInit, OnChanges {
  private rolesService = inject(RolesService);
  private permitionsService = inject(PermitionsService);
  private systemPermissionsService = inject(MasterPermissions2Service);
  private signalsService = inject(SignalsService);
  private timeService = inject(TimeService);
  private trackingService = inject(TrackingService);
  private authService = inject(AuthService);

  /** Ids de permisos detallados (misma fuente que Permisos maestros / UserSystemPermissions). */
  private userSystemPermissionIds: number[] = [];
  /** Copia al cargar datos: detectar cambios sin guardar y revertir. */
  private userSystemPermissionIdsBaseline: number[] = [];
  /**
   * true cuando el modal se abrió con la plantilla rol+posición pre-cargada y el usuario aún
   * NO tiene UserSystemPermissions guardados. En ese estado los checks de "dirty" devuelven
   * false (plantilla == baseline), pero el usuario ESPERA poder guardar la plantilla.
   * Se resetea a false tras guardar o al recargar datos.
   */
  private isSeededFromTemplate = false;
  /** true cuando se abre desde dept row y el usuario ya tiene CRUD propios guardados.
   *  syncMasterLeftSwitchesFromUserSys debe derivar los switches izquierdos solo del lado
   *  derecho (detailedRead), ignorando el fallback de UserSystem IDs. */
  private forceDeriveLeftFromRight = false;

  /** Misma respuesta que Permisos maestros: `getMasterPermissions` (acordeón). */
  private masterPermissionsCatalog: any[] = [];

  /**
   * Nombres normalizados de maestros que alguna vez vinieron en el CRUD de este modal (mismo usuario/sucursal/rol/posición).
   * Solo esos pueden reinyectarse desde el catálogo al apagar todo un módulo; no se lista el catálogo completo de la empresa.
   */
  private modalSidebarMasterKeys = new Set<string>();
  /**
   * Universe de tarjetas (details) permitido por la plantilla `rol+posición`,
   * por nombre de maestro normalizado.
   * Usado para no “inyectar” tarjetas extra al merge desde el catálogo.
   */
  private modalSidebarDetailKeysByMaster = new Map<string, Set<string>>();
  /**
   * CRUD completo de la plantilla `rol+posición` (RolesxDetailedPermissionsSummary).
   * Se usa para reponer `subdetails` cuando el catálogo inyecta masters/details
   * pero sin estructura CRUD (solo nombres).
   */
  private roleTemplateCrudRows: any[] = [];
  private lastPermissionsModalContextKey = '';

  /** Línea base de switches maestros izquierdos tras cargar/ revertir (evita “sucio” falso). */
  private masterReadBaselineByName = new Map<string, boolean>();

  /**
   * Valor de `guardRefreshTick` tras el último `obtenerDatos` completo.
   * El stream de resync solo aplica GET si el tick es **estrictamente mayor**: evita la petición paralela
   * al abrir el modal (misma emisión de toObservable que llega ya con userId listo) y el “todo apagado”.
   * Se resetea a +∞ al iniciar cada carga para no mezclar contextos.
   */
  private lastGuardTickAfterModalDataLoad = Number.POSITIVE_INFINITY;

  @Input() idUserInput: number | string;
  @Input() idBranchInput: number;
  @Input() idRoleInput: number;
  @Input() idPosicionInput: number;
  /** Empresa real del usuario editado. Evita usar la empresa del sidebar cuando root@bi2.mx está logueado. */
  @Input() idCompanyInput: number;
  /** 'userSystem' (default): sincroniza con Permisos maestros / UserSystemPermissions. 'position': permisos por posición (opción B). */
  @Input() scopeInput: 'userSystem' | 'position' = 'userSystem';
  /** Si true (y scopeInput === 'userSystem'), precarga permisos base desde la plantilla rol+posición. */
  @Input() seedFromRolePosInput: boolean = false;
  /** Catálogo rol+posición (Departamento › Ver permisos): solo `RolesxDetailedPermission`, nunca Crud por usuario. */
  @Input() roleTemplateOnlyInput: boolean = false;

  idRole: number;
  idPosicion: number;
  idEmpresa: number;
  params: any;
  userId: number | string;
  userName: string;
  branchId: number;
  branchName: string;
  idCompany: number;
  rawData: any[] = [];
  notSavedChanges: boolean = false;
  groupedPermissions: MasterPermission[] = [];
  masterSeleccionado: MasterPermission | null = null;
  detailSeleccionado: DetailedPermission | null = null;
  subdetailExpandido: SubdetailPermission | null = null;
  pasoActual: number = 1;
  subdetailPaso2: SubdetailPermission | null = null;

  readonly coloresMaster: string[] = [
    '#1a1a2e', '#16213e', '#0f3460', '#533483', '#2b2d42', '#1b4332'
  ];

  // Orden deseado - palabras clave sin acentos para comparación robusta
  readonly ordenMaster: string[] = [
    'administracion',
    'compras',
    'almacenes',
    'recursos',
    'configurac'
  ];

  // Orden de los details según el menú de navegación
  readonly ordenDetails: string[] = [
    'dashboard',
    'configurac',
    'banco',
    'transferenc',
    'ingreso',
    'egreso',
    'cliente',
    'proveedor',
    'factura',
    'cuenta',
    'catalogo'
  ];

  constructor() {
    // Cada bump del guard dispara un GET; switchMap cancela peticiones anteriores.
    // Comparación con lastGuardTickAfterModalDataLoad evita el GET “fantasma” del mismo tick con el que
    // acaba de cargar obtenerDatos (y skip(1), que dejaba el modal sin resync si no había más bumps).
    toObservable(this.signalsService.guardRefreshTick)
      .pipe(
        switchMap((tickValue) => {
          if ((this.scopeInput ?? 'userSystem') === 'position') {
            return EMPTY;
          }
          const uid = this.userId;
          if (uid == null || Number.isNaN(Number(uid)) || Number(uid) <= 0) {
            return EMPTY;
          }
          if (tickValue <= this.lastGuardTickAfterModalDataLoad) {
            return EMPTY;
          }
          return this.systemPermissionsService.getUserPermissions(Number(uid)).pipe(
            take(1),
            catchError((err) => {
              console.error('Resync UserSystem (Permisos maestros ↔ modal)', err);
              return of([] as any[]);
            })
          );
        }),
        takeUntilDestroyed()
      )
      .subscribe((userSys: any) => {
        const list = this.normalizeUserSystemApiList(userSys);
        this.userSystemPermissionIds = this.extractPermissionIdsFromUserSystemRows(list);
        this.userSystemPermissionIdsBaseline = [...this.userSystemPermissionIds];
        // Modal desde «Departamentos › Ver permisos»: el árbol derecho es CRUD rol+sucursal.
        // Alinear ese panel con UserSystem *global* enciende módulos (p. ej. Almacenes) que el usuario
        // puede tener en perfil pero no en este contexto CRUD — tras F5 parece que «solo Compras» se corrompe.
        this.syncReadFlagsFromUserSystemPermissions();
        this.syncMasterLeftSwitchesFromUserSys();
        this.notSavedChanges = false;
      });
  }

  /** Respuesta de `UserSystemPermissions/user/{id}` puede ser array u objeto envuelto. */
  private normalizeUserSystemApiList(userSys: unknown): any[] {
    if (Array.isArray(userSys)) {
      return userSys;
    }
    if (userSys && typeof userSys === 'object') {
      const o = userSys as Record<string, unknown>;
      if (Array.isArray(o['data'])) {
        return o['data'] as any[];
      }
      if (Array.isArray(o['project'])) {
        return o['project'] as any[];
      }
      const vals = Object.values(o).filter((v) => v != null && typeof v === 'object');
      if (
        vals.length > 0 &&
        vals.every(
          (v) =>
            typeof (v as any).permissionId === 'number' ||
            typeof (v as any).PermissionId === 'number' ||
            typeof (v as any).userId === 'number'
        )
      ) {
        return vals as any[];
      }
    }
    return [];
  }

  private extractPermissionIdsFromUserSystemRows(list: any[]): number[] {
    const out: number[] = [];
    for (const p of list) {
      if (p == null) {
        continue;
      }
      if (typeof p === 'number' && Number.isFinite(p)) {
        out.push(p);
        continue;
      }
      const raw =
        p.permissionId ??
        p.PermissionId ??
        p.permission_id ??
        p.detailedPermission?.id ??
        p.DetailedPermission?.Id ??
        p.DetailedPermission?.idDetailedPermission;
      const n = Number(raw);
      if (Number.isFinite(n) && n > 0) {
        out.push(n);
      }
    }
    return out;
  }

  // Normaliza texto: minúsculas y sin acentos
  private normalizar(texto: string): string {
    return (texto ?? '')
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  /** Usuario aún no persistido (`temp_*`) o sin id numérico válido. */
  private isTransientUserId(idUser: unknown): boolean {
    if (idUser == null) return true;
    if (typeof idUser === 'string') {
      const s = idUser.trim();
      if (s === '') return true;
      return s.startsWith('temp_');
    }
    const n = Number(idUser);
    return !Number.isFinite(n) || n <= 0;
  }

  private normalizeCrudArray(data: unknown): any[] {
    if (Array.isArray(data)) return data;
    if (data && typeof data === 'object') {
      const o = data as Record<string, unknown>;
      if (Array.isArray(o['data'])) return o['data'] as any[];
      if (Array.isArray(o['project'])) return o['project'] as any[];
      if (Array.isArray(o['permissions'])) return o['permissions'] as any[];
    }
    return [];
  }

  /**
   * Filas para `transformData`: permisos ya guardados del usuario, o plantilla por rol+posición
   * (`RolesxDetailedPermissionsSummary`) cuando el usuario es nuevo o aún no tiene Crud asignado.
   */
  private getCrudRowsForModal$(
    scope: PermissionsScope,
    idCompany: number,
    idUser: number | string,
    idBranch: number,
    idRole: number,
    idPosicion: number,
    seedFromRolePos: boolean,
    roleTemplateOnly: boolean
  ): Observable<any[]> {
    if (roleTemplateOnly) {
      return this.rolesService.getPermissionsByRoles(idCompany, idRole, idPosicion).pipe(
        map((raw) => this.normalizeCrudArray(raw)),
        catchError(() => of([]))
      );
    }

    const transient = this.isTransientUserId(idUser);
    const userNumeric = Number(idUser);

    if (scope !== 'position') {
      if (transient) {
        return of([]);
      }
      const base$ = this.permitionsService
        .getPermitionsSencillo(idCompany, userNumeric, idBranch, idRole, idPosicion)
        .pipe(map((raw) => this.normalizeCrudArray(raw)), catchError(() => of([])));
      // Solo cuando el modal se abrió desde Dept/Pos para precargar al usuario: fallback a plantilla rol+posición.
      if (!seedFromRolePos) {
        return base$;
      }
      return base$.pipe(
        switchMap((rows) => {
          if (rows.length > 0) return of(rows);
          return this.rolesService.getPermissionsByRoles(idCompany, idRole, idPosicion).pipe(
            map((raw) => this.normalizeCrudArray(raw)),
            catchError(() => of([]))
          );
        })
      );
    }

    if (transient) {
      return this.rolesService.getPermissionsByRoles(idCompany, idRole, idPosicion).pipe(
        map((raw) => this.normalizeCrudArray(raw)),
        catchError(() => of([]))
      );
    }

    return this.permitionsService.getPermitionsSencillo(idCompany, userNumeric, idBranch, idRole, idPosicion).pipe(
      map((raw) => this.normalizeCrudArray(raw)),
      catchError(() => of([])),
      switchMap((rows) => {
        if (rows.length > 0) {
          return of(rows);
        }
        return this.rolesService.getPermissionsByRoles(idCompany, idRole, idPosicion).pipe(
          map((raw) => this.normalizeCrudArray(raw)),
          catchError(() => of([]))
        );
      })
    );
  }

  /** Bloque de catálogo para un permiso maestro (misma lista que el acordeón Permisos maestros). */
  private getMasterCatalogEntry(masterPermissionName: string): any | null {
    const target = this.normalizar(masterPermissionName || '');
    if (!target || !Array.isArray(this.masterPermissionsCatalog)) {
      return null;
    }
    let match = this.masterPermissionsCatalog.find(
      (m) => this.normalizar(m?.permissionName ?? '') === target
    );
    if (!match) {
      match = this.masterPermissionsCatalog.find((m) => {
        const n = this.normalizar(m?.permissionName ?? '');
        return n.length >= 3 && target.length >= 3 && (n.includes(target) || target.includes(n));
      });
    }
    return match ?? null;
  }

  /** IDs `detail.id` del catálogo (idénticos a los switches del acordeón Permisos maestros). */
  private getCatalogDetailedIdsForMasterName(masterPermissionName: string): Set<number> {
    const ids = new Set<number>();
    const match = this.getMasterCatalogEntry(masterPermissionName);
    if (!match) {
      return ids;
    }
    for (const d of match.detailedPermissions || []) {
      if (d?.id != null && d.id !== '') {
        ids.add(Number(d.id));
      }
    }
    return ids;
  }

  /**
   * ID de permiso detallado en UserSystemPermissions para una fila del panel derecho,
   * por nombre de maestro + nombre del detalle (misma pareja que `detail.id` en el acordeón).
   */
  private getCatalogDetailedIdForDetailName(
    masterPermissionName: string,
    detailedPermissionName: string
  ): number | null {
    const catalogMaster = this.getMasterCatalogEntry(masterPermissionName);
    if (!catalogMaster) {
      return null;
    }
    const dn = this.normalizar(detailedPermissionName || '');
    if (!dn) {
      return null;
    }
    const list = catalogMaster.detailedPermissions || [];
    let row = list.find((d: any) => this.normalizar(d?.permissionName ?? '') === dn);
    if (!row) {
      row = list.find((d: any) => {
        const n = this.normalizar(d?.permissionName ?? '');
        return n.length >= 3 && dn.length >= 3 && (n.includes(dn) || dn.includes(n));
      });
    }
    if (row?.id == null || row.id === '') {
      return null;
    }
    return Number(row.id);
  }

  /**
   * Si el nombre del detalle en CRUD no alinea con el del catálogo, localiza la fila por palabra clave
   * (sucursal / departamento / usuario) para el mismo id que Permisos maestros / UserSystemPermissions.
   */
  private resolveConfiguracionEdgeCatalogId(master: MasterPermission, detail: DetailedPermission): number | null {
    const catalogMaster = this.getMasterCatalogEntry(master.masterPermissionName);
    if (!catalogMaster) {
      return null;
    }
    const dn = this.normalizar(detail.detailedPermissionName || '');
    const list = catalogMaster.detailedPermissions || [];
    const pickRow = (key: string) =>
      list.find((d: any) => this.normalizar(d?.permissionName ?? '').includes(key));
    if (dn.includes('sucursal')) {
      const row = pickRow('sucursal');
      if (row?.id != null && row.id !== '') {
        return Number(row.id);
      }
    }
    if (dn.includes('departamento')) {
      const row = pickRow('departamento');
      if (row?.id != null && row.id !== '') {
        return Number(row.id);
      }
    }
    if (dn.includes('usuario')) {
      const row = pickRow('usuario');
      if (row?.id != null && row.id !== '') {
        return Number(row.id);
      }
    }
    return null;
  }

  private findMasterContainingDetail(detail: DetailedPermission): MasterPermission | null {
    for (const m of this.groupedPermissions) {
      if (m.details.some((d) => d === detail)) {
        return m;
      }
    }
    return null;
  }

  /**
   * Varios bloques CRUD con fila "Principal" bajo el mismo detalle (p. ej. Usuarios: Security, Departamento, Permisos).
   * En ese caso cada switch debe usar solo su idDetailedPermission, no el id de catálogo del detalle completo.
   */
  private detailHasMultiplePrincipalSections(detail: DetailedPermission): boolean {
    return detail.subdetails.filter((sd) => sd.principal != null).length >= 2;
  }

  private normalizeDetailedId(raw: any): number | null {
    if (raw == null || raw === '') {
      return null;
    }
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }

  /** Fila CRUD `showColumn` para el switch de sección; el API puede usar otro casing. */
  private isPrincipalShowColumn(showColumn: unknown): boolean {
    return this.normalizar(String(showColumn ?? '')) === 'principal';
  }

  /** En modo por posición: los switches master/detail reflejan el estado de CRUD (canRead). */
  private recomputeReadsFromCrud(): void {
    for (const master of this.groupedPermissions) {
      let anyDetailOn = false;
      for (const detail of master.details) {
        const perms: CrudPermission[] = [];
        for (const sd of detail.subdetails) {
          if (sd.principal) perms.push(sd.principal);
          perms.push(...sd.children);
        }
        const anyOn = perms.some((p) => p.canRead === true);
        detail.detailedRead = anyOn;
        if (anyOn) {
          anyDetailOn = true;
        }
      }
      master.masterRead = anyDetailOn;
    }
  }

  /**
   * Mantiene en UserSystem el id canónico del detalle (tarjeta Usuarios) solo si algún Principal tiene lectura en CRUD.
   */
  private reconcileCanonicalUserSystemForMultiPrincipalDetail(detail: DetailedPermission): void {
    const canonical = this.getDetailedPermissionIdForDetail(detail);
    if (canonical == null) {
      this.syncMasterLeftSwitchesFromUserSys();
      this.checkForChanges();
      return;
    }
    const anyPrincipalRead = detail.subdetails.some((sd) => sd.principal?.canRead === true);
    const next = [...this.userSystemPermissionIds];
    const idx = next.indexOf(canonical);
    if (anyPrincipalRead && idx === -1) {
      next.push(canonical);
    } else if (!anyPrincipalRead && idx !== -1) {
      next.splice(idx, 1);
    }
    this.userSystemPermissionIds = next;
    this.syncReadFlagsFromUserSystemPermissions();
    this.syncMasterLeftSwitchesFromUserSys();
    this.checkForChanges();
  }

  /** Tras sync de lectura: si lectura off → CRUD off; si on → CRUD on (mismo criterio que el cascade previo). */
  private syncPrincipalCrudFromReadForDetail(detail: DetailedPermission): void {
    for (const sd of detail.subdetails) {
      if (sd.principal) {
        if (!sd.principal.canRead) {
          sd.principal.canCreate = false;
          sd.principal.canUpdate = false;
          sd.principal.canDelete = false;
        } else {
          sd.principal.canCreate = true;
          sd.principal.canUpdate = true;
          sd.principal.canDelete = true;
        }
      }
      for (const child of sd.children) {
        if (!child.canRead) {
          child.canCreate = false;
          child.canUpdate = false;
          child.canDelete = false;
        } else {
          child.canCreate = true;
          child.canUpdate = true;
          child.canDelete = true;
        }
      }
    }
  }

  /**
   * Tarjeta del panel derecho cuyo nombre coincide con el maestro (p. ej. "Administración" bajo Administración).
   * El CRUD a veces repite el id homónimo del maestro en todas las filas; no debe usarse como id canónico de otras tarjetas.
   */
  private isHomonymDetailForMaster(master: MasterPermission, detail: DetailedPermission): boolean {
    const mn = this.normalizar(master.masterPermissionName || '');
    const dn = this.normalizar(detail.detailedPermissionName || '');
    return mn.length > 0 && mn === dn;
  }

  /**
   * ID del permiso detallado "principal" del módulo en UserSystemPermissions.
   * Ejemplo: master "Almacenes" -> detail "Almacenes" (como en Permisos Maestros).
   */
  private getCatalogDetailedIdForMasterToggle(masterPermissionName: string): number | null {
    const target = this.normalizar(masterPermissionName || '');
    const match = this.getMasterCatalogEntry(masterPermissionName);
    if (!match || !target) {
      return null;
    }

    const sameNameDetail = (match.detailedPermissions || []).find((d: any) =>
      this.normalizar(d?.permissionName ?? '') === target
    );

    if (sameNameDetail?.id == null || sameNameDetail.id === '') {
      return null;
    }
    return Number(sameNameDetail.id);
  }

  /** Apaga CRUD bajo un módulo (misma lógica que applyMasterOff en la rejilla). */
  private zeroCrudReadsForMaster(master: MasterPermission): void {
    for (const detail of master.details) {
      for (const sd of detail.subdetails) {
        if (sd.principal) {
          sd.principal.canRead = false;
          sd.principal.canCreate = false;
          sd.principal.canUpdate = false;
          sd.principal.canDelete = false;
        }
        for (const child of sd.children) {
          child.canRead = false;
          child.canCreate = false;
          child.canUpdate = false;
          child.canDelete = false;
        }
      }
    }
  }

  /** Módulo "Configuración" del modal (sidebar izquierdo). */
  private isConfiguracionMaster(master: MasterPermission): boolean {
    return this.normalizar(master.masterPermissionName || '').includes('configurac');
  }

  /**
   * Módulo "Almacenes": en Permisos maestros el primer switch "Almacenes" es el permiso
   * homónimo (un id en UserSystemPermissions), no el agregado de todas las tarjetas.
   */
  private isAlmacenesMaster(master: MasterPermission): boolean {
    return this.normalizar(master.masterPermissionName || '').includes('almacen');
  }

  /** Si el maestro Almacenes tiene permiso homónimo en catálogo, no aplicar poda de todo el módulo en sync. */
  private isAlmacenesHomonymLeftSwitchMode(master: MasterPermission): boolean {
    return (
      this.isAlmacenesMaster(master) &&
      this.getCatalogDetailedIdForMasterToggle(master.masterPermissionName) != null
    );
  }

  /**
   * Tarjetas del panel derecho que deben mantener sincronizado el switch maestro "Configuración":
   * Sucursales, Usuarios, Departamentos (mismos nombres que en Permisos maestros).
   */
  private isConfiguracionEdgeCardDetail(detail: DetailedPermission): boolean {
    const n = this.normalizar(detail.detailedPermissionName || '');
    if (!n) {
      return false;
    }
    return n.includes('sucursal') || n.includes('departamento') || n.includes('usuario');
  }

  /** Tarjeta "Usuarios" dentro de Configuración (no Departamentos ni Sucursales de primer nivel). */
  private isUsuariosConfigDetail(master: MasterPermission, detail: DetailedPermission): boolean {
    if (!this.isConfiguracionMaster(master)) {
      return false;
    }
    const n = this.normalizar(detail.detailedPermissionName || '');
    return n.includes('usuario') && !n.includes('sucursal') && !n.includes('departamento');
  }

  /**
   * Tarjetas bajo Configuración › Usuarios cuyo permiso UserSystem es el del acordeón
   * Permisos maestros › Setup Usuarios (mismo `detail.id` que en el catálogo API).
   */
  private isEmpresasOrSucursalesSetupSubdetail(sd: SubdetailPermission): boolean {
    const sn = this.normalizar(sd.subdetailedPermissionName || '');
    const permisosSinMaestros =
      (sn === 'permisos' || sn === 'permissions') && !sn.includes('maestro');
    return (
      sn === 'empresas' ||
      sn === 'sucursales' ||
      sn === 'empresa' ||
      sn === 'sucursal' ||
      sn === 'almacenes' ||
      sn === 'almacen' ||
      sn === 'warehouses' ||
      sn === 'warehouse' ||
      sn.includes('warehouse') ||
      sn === 'security' ||
      sn.includes('security') ||
      sn.includes('seguridad') ||
      sn === 'departamento' ||
      sn === 'department' ||
      sn.includes('departamento') ||
      sn.includes('department') ||
      permisosSinMaestros
    );
  }

  /** Maestro del catálogo API: Setup Usuarios / `users-setup` (Permisos maestros). */
  private findSetupUsuariosCatalogMaster(): any | null {
    if (!Array.isArray(this.masterPermissionsCatalog)) {
      return null;
    }
    return (
      this.masterPermissionsCatalog.find((m) => {
        const n = this.normalizar(m?.permissionName ?? '');
        const idf = String(m?.identifier ?? m?.Identifier ?? '').toLowerCase();
        return idf === 'users-setup' || (n.includes('setup') && n.includes('usuario'));
      }) ?? null
    );
  }

  /**
   * Id en UserSystemPermissions para un ítem del acordeón Setup Usuarios
   * (mismo `detail.id` que Permisos maestros).
   */
  private getCatalogDetailedIdFromSetupUsuariosPermission(detailedName: string): number | null {
    const master = this.findSetupUsuariosCatalogMaster();
    if (!master) {
      return null;
    }
    const dn = this.normalizar(detailedName || '');
    const list = master.detailedPermissions || [];
    let row = list.find((d: any) => this.normalizar(d?.permissionName ?? '') === dn);
    if (!row) {
      row = list.find((d: any) => {
        const idf = String(d?.identifier ?? d?.Identifier ?? '').toLowerCase();
        return idf !== '' && idf === dn;
      });
    }
    if (!row) {
      row = list.find((d: any) => {
        const n = this.normalizar(d?.permissionName ?? '');
        return n.length >= 3 && dn.length >= 3 && (n.includes(dn) || dn.includes(n));
      });
    }
    // CRUD del modal puede traer "warehouses" / "Warehouse"; en catálogo suele ser "Almacenes" + identifier warehouses
    if (
      !row &&
      (dn === 'warehouses' || dn === 'warehouse' || dn.includes('warehouse'))
    ) {
      row = list.find((d: any) => {
        const idf = String(d?.identifier ?? d?.Identifier ?? '').toLowerCase();
        const n = this.normalizar(d?.permissionName ?? '');
        return idf === 'warehouses' || n.includes('almacen');
      });
    }
    if (!row && (dn === 'security' || dn.includes('security') || dn.includes('seguridad'))) {
      row = list.find((d: any) => {
        const idf = String(d?.identifier ?? d?.Identifier ?? '').toLowerCase();
        const n = this.normalizar(d?.permissionName ?? '');
        return idf === 'security' || n.includes('security');
      });
    }
    if (
      !row &&
      (dn === 'department' || dn === 'departamento' || dn.includes('departamento'))
    ) {
      row = list.find((d: any) => {
        const idf = String(d?.identifier ?? d?.Identifier ?? '').toLowerCase();
        return idf === 'department' || idf === 'departamento';
      });
    }
    if (!row && (dn === 'permissions' || dn === 'permisos')) {
      row = list.find((d: any) => {
        const idf = String(d?.identifier ?? d?.Identifier ?? '').toLowerCase();
        const n = this.normalizar(d?.permissionName ?? '');
        return (
          idf === 'permissions' ||
          (n === 'permisos' && !n.includes('maestro'))
        );
      });
    }
    if (row?.id == null || row.id === '') {
      return null;
    }
    return Number(row.id);
  }

  private collectSetupUsuarioEmpresaSucursalIds(): number[] {
    const out: number[] = [];
    const labels = [
      'Empresas',
      'Sucursales',
      'Almacenes',
      'Security',
      'Departamento',
      'Permisos',
    ] as const;
    for (const label of labels) {
      const id = this.getCatalogDetailedIdFromSetupUsuariosPermission(label);
      if (id != null) {
        out.push(id);
      }
    }
    return out;
  }

  /** ¿Algún detalle pertinente encendido para pintar el switch izquierdo del maestro? */
  private anyDetailReadOnForMasterLeftSwitch(master: MasterPermission): boolean {
    if (!master.details?.length) {
      return false;
    }
    if (this.isConfiguracionMaster(master)) {
      return master.details.some(
        (d) => this.isConfiguracionEdgeCardDetail(d) && d.detailedRead === true
      );
    }
    return master.details.some((d) => d.detailedRead === true);
  }

  /**
   * IDs UserSystem al afectar todo el módulo Configuración.
   * `includeSetupUsuarioSubIds`: al apagar el módulo completo, quitar también Empresas/Sucursales
   * del acordeón Setup Usuarios (mismos que en Permisos maestros).
   */
  private collectConfiguracionEdgeAndHomonymIds(
    master: MasterPermission,
    options?: { includeSetupUsuarioSubIds?: boolean }
  ): Set<number> {
    const ids = new Set<number>();
    for (const detail of master.details) {
      if (this.isConfiguracionEdgeCardDetail(detail)) {
        const id = this.getDetailedPermissionIdForDetail(detail);
        if (id != null) {
          ids.add(id);
        }
      }
    }
    const homonym = this.getCatalogDetailedIdForMasterToggle(master.masterPermissionName);
    if (homonym != null) {
      ids.add(homonym);
    }
    if (options?.includeSetupUsuarioSubIds) {
      for (const id of this.collectSetupUsuarioEmpresaSucursalIds()) {
        ids.add(id);
      }
    }
    return ids;
  }

  /**
   * Solo tarjetas encendidas (`detailedRead`), para no volcar en UserSystem los ids de todo el maestro
   * cuando `seedDeptModal` sincroniza tras abrir con CRUD propio (p. ej. encender «Proveedores» no debe
   * marcar Materia prima / Órdenes / … si estaban apagadas).
   */
  private collectActiveDetailedPermissionIdsForMaster(master: MasterPermission): Set<number> {
    const ids = new Set<number>();
    for (const detail of master.details || []) {
      if (!detail.detailedRead) {
        continue;
      }
      const id = this.getDetailedPermissionIdForDetail(detail);
      if (id != null) {
        ids.add(id);
      }
    }
    return ids;
  }

  /** Como `collectConfiguracionEdgeAndHomonymIds` pero solo bordes activos + homónimo si alguno está on. */
  private collectActiveConfiguracionEdgeAndHomonymIds(master: MasterPermission): Set<number> {
    const ids = new Set<number>();
    let anyEdgeOn = false;
    for (const detail of master.details || []) {
      if (!this.isConfiguracionEdgeCardDetail(detail) || !detail.detailedRead) {
        continue;
      }
      anyEdgeOn = true;
      const id = this.getDetailedPermissionIdForDetail(detail);
      if (id != null) {
        ids.add(id);
      }
    }
    if (anyEdgeOn) {
      const homonym = this.getCatalogDetailedIdForMasterToggle(master.masterPermissionName);
      if (homonym != null) {
        ids.add(homonym);
      }
    }
    return ids;
  }

  private zeroCrudReadsForConfiguracionEdges(master: MasterPermission): void {
    for (const detail of master.details) {
      if (!this.isConfiguracionEdgeCardDetail(detail)) {
        continue;
      }
      for (const sd of detail.subdetails) {
        if (sd.principal) {
          sd.principal.canRead = false;
          sd.principal.canCreate = false;
          sd.principal.canUpdate = false;
          sd.principal.canDelete = false;
        }
        for (const child of sd.children) {
          child.canRead = false;
          child.canCreate = false;
          child.canUpdate = false;
          child.canDelete = false;
        }
      }
    }
  }

  /**
   * Ids de catálogo / rejilla que representan “este módulo” en UserSystemPermissions.
   * Incluye el permiso homónimo del maestro (p. ej. Administración) además de los detalles del panel derecho.
   */
  private collectUserSystemIdsRelevantToMaster(master: MasterPermission): Set<number> {
    const ids = new Set<number>();
    if (this.isConfiguracionMaster(master)) {
      for (const id of this.collectConfiguracionEdgeAndHomonymIds(master, {
        includeSetupUsuarioSubIds: true,
      })) {
        ids.add(id);
      }
      return ids;
    }
    for (const id of this.collectDetailedPermissionIdsForMaster(master)) {
      ids.add(id);
    }
    const homonym = this.getCatalogDetailedIdForMasterToggle(master.masterPermissionName);
    if (homonym != null) {
      ids.add(homonym);
    }
    return ids;
  }

  /** ¿El usuario sigue teniendo en BD algún id de este módulo? (evita podar por fallo de nombres en sync). */
  private userSysStillHasAnyIdForMaster(master: MasterPermission): boolean {
    const ids = this.collectUserSystemIdsRelevantToMaster(master);
    return [...ids].some((id) => this.userSystemPermissionIds.includes(id));
  }

  /**
   * Modal «Departamentos de: …» → Ver permisos (`seedFromRolePosition`).
   * La vista debe reflejar la plantilla rol+posición (como Configuración › Departamento),
   * no mezclar switches con `UserSystemPermissions` globales del usuario (otras sucursales/roles).
   */
  private isUserPermissionsSeededFromRolePosition(): boolean {
    return (
      this.seedFromRolePosInput === true &&
      (this.scopeInput ?? 'userSystem') === 'userSystem' &&
      this.userSystemPermissionIds.length === 0
    );
  }

  /**
   * Switch izquierdo: si hay rejilla, refleja "¿algún submódulo encendido?".
   * Si todos los del lado derecho están apagados → maestro apagado y se limpian ids/CRUD del módulo.
   * Almacenes (solo modal, homónimo): si todas las tarjetas derechas están apagadas, apagar el switch izquierdo
   * y quitar el permiso homónimo sin podar el resto del módulo con el branch genérico.
   * Si no hay filas de rejilla, usa el catálogo (acordeón Permisos maestros).
   */
  private syncMasterLeftSwitchesFromUserSys(): void {
    let pruned = false;
    const seedDeptModal = this.isUserPermissionsSeededFromRolePosition() || this.forceDeriveLeftFromRight;
    for (const master of this.groupedPermissions) {
      if (master.details?.length) {
        if (this.isAlmacenesHomonymLeftSwitchMode(master)) {
          const hid = this.getCatalogDetailedIdForMasterToggle(master.masterPermissionName)!;
          const allRightOff = master.details.every((d) => !d.detailedRead);
          if (allRightOff) {
            if (!seedDeptModal && this.userSystemPermissionIds.includes(hid)) {
              // La rejilla puede no reflejar aún el homónimo; si el id sigue en UserSystem, mantener encendido.
              master.masterRead = true;
            } else {
              master.masterRead = false;
              const beforeLen = this.userSystemPermissionIds.length;
              this.userSystemPermissionIds = this.userSystemPermissionIds.filter((id) => id !== hid);
              if (this.userSystemPermissionIds.length !== beforeLen) {
                pruned = true;
              }
            }
          } else {
            master.masterRead = seedDeptModal
              ? this.anyDetailReadOnForMasterLeftSwitch(master)
              : this.userSystemPermissionIds.includes(hid);
          }
          continue;
        }

        let anyDetailOn = this.anyDetailReadOnForMasterLeftSwitch(master);
        master.masterRead = anyDetailOn;
        if (!anyDetailOn) {
          if (!seedDeptModal && this.userSysStillHasAnyIdForMaster(master)) {
            master.masterRead = true;
            for (const detail of master.details) {
              this.syncReadFlagsForSingleDetail(detail);
            }
            continue;
          }
          const beforeLen = this.userSystemPermissionIds.length;
          const toRemove = this.isConfiguracionMaster(master)
            ? this.collectConfiguracionEdgeAndHomonymIds(master, { includeSetupUsuarioSubIds: true })
            : this.collectDetailedPermissionIdsForMaster(master);
          this.userSystemPermissionIds = this.userSystemPermissionIds.filter((id) => !toRemove.has(id));
          if (this.userSystemPermissionIds.length !== beforeLen) {
            pruned = true;
          }
          if (this.isConfiguracionMaster(master)) {
            for (const detail of master.details) {
              if (this.isConfiguracionEdgeCardDetail(detail)) {
                detail.detailedRead = false;
              }
            }
            this.zeroCrudReadsForConfiguracionEdges(master);
          } else {
            for (const detail of master.details) {
              detail.detailedRead = false;
            }
            this.zeroCrudReadsForMaster(master);
          }
        } else if (seedDeptModal) {
          // Cuando derivamos switches izquierdos del lado derecho (CRUD), sincronizamos los IDs
          // de UserSystem para que al guardar, estos módulos queden correctamente en UsersSecurity
          // y aparezcan en el sidebar del usuario.
          // Importante: solo ids de tarjetas realmente encendidas; no todo el maestro (evita encender
          // todas las tarjetas de Compras al activar una sola). También podamos ids viejos del mismo
          // maestro que ya no correspondan a tarjetas activas (corrige estados envenenados previos).
          const idsToAdd = this.isConfiguracionMaster(master)
            ? this.collectActiveConfiguracionEdgeAndHomonymIds(master)
            : this.collectActiveDetailedPermissionIdsForMaster(master);
          const universe = this.isConfiguracionMaster(master)
            ? this.collectConfiguracionEdgeAndHomonymIds(master, { includeSetupUsuarioSubIds: false })
            : this.collectDetailedPermissionIdsForMaster(master);
          if (!this.isConfiguracionMaster(master) && this.isAlmacenesHomonymLeftSwitchMode(master)) {
            const hid = this.getCatalogDetailedIdForMasterToggle(master.masterPermissionName);
            if (hid != null) {
              universe.add(hid);
              if (anyDetailOn) {
                idsToAdd.add(hid);
              }
            }
          }
          let next = this.userSystemPermissionIds.filter((id) => !universe.has(id) || idsToAdd.has(id));
          for (const id of idsToAdd) {
            if (!next.includes(id)) {
              next = [...next, id];
            }
          }
          this.userSystemPermissionIds = next;
        }
      } else {
        const catIds = this.getCatalogDetailedIdsForMasterName(master.masterPermissionName);
        if (catIds.size > 0) {
          if (seedDeptModal) {
            master.masterRead = false;
          } else {
            // Un usuario con permisos parciales del módulo debe ver el maestro encendido (antes: .every exigía todos).
            master.masterRead = [...catIds].some((id) => this.userSystemPermissionIds.includes(id));
          }
        }
      }
    }
    if (pruned && !seedDeptModal) {
      this.syncReadFlagsFromUserSystemPermissions();
    }
  }

  private captureMasterReadBaseline(): void {
    this.masterReadBaselineByName = new Map(
      this.groupedPermissions.map((m) => [m.masterPermissionName, m.aplica])
    );
  }

  /** Mismo usuario que la sesión (perfil o signal) para refrescar menú / guard sin F5. */
  private isEditingSessionUser(): boolean {
    const rowUser = Number(this.userId);
    if (Number.isNaN(rowUser) || rowUser <= 0) {
      return false;
    }
    const profileId = this.signalsService.profile.idUser();
    const fromProfile =
      profileId != null && profileId !== 0 ? Number(profileId) : Number.NaN;
    const fromSignal = Number(this.signalsService.idUser());
    const sessionId =
      !Number.isNaN(fromProfile) && fromProfile > 0
        ? fromProfile
        : !Number.isNaN(fromSignal) && fromSignal > 0
          ? fromSignal
          : Number.NaN;
    return !Number.isNaN(sessionId) && rowUser === sessionId;
  }

  ngOnInit(): void {
    this.idEmpresa = this.signalsService.getRootSelectedBySidebar()();
  }

  ngOnChanges(changes: SimpleChanges): void {
    const idRole = Number(this.idRoleInput);
    const idPosicion = Number(this.idPosicionInput);
    const idBranch = Number(this.idBranchInput);
    const idCompany = Number(this.idCompanyInput ?? this.signalsService.getRootSelectedBySidebar()());
    if (!Number.isFinite(idRole) || !Number.isFinite(idPosicion) || idRole <= 0 || idPosicion <= 0) {
      return;
    }
    if (this.idUserInput === undefined || this.idUserInput === null) {
      return;
    }
    if (!Number.isFinite(idBranch) || idBranch === 0) {
      return;
    }
    if (!Number.isFinite(idCompany) || idCompany <= 0) {
      return;
    }
    this.userId = this.idUserInput;
    this.branchId = idBranch;
    this.idRole = idRole;
    this.idPosicion = idPosicion;
    this.idCompany = idCompany;
    this.obtenerDatos(this.idCompany, this.userId, this.branchId, this.idRole, this.idPosicion);
  }

  agInit(params: ICellRendererParams & { idUser: number, idBranch: number, idRole: number, idPosicion: number }): void {
    const idCompany = Number(this.idCompanyInput ?? this.signalsService.getRootSelectedBySidebar()());
    if (params?.idUser == null || !Number.isFinite(Number(params.idBranch)) || Number(params.idBranch) === 0) {
      return;
    }
    if (!Number.isFinite(Number(params.idRole)) || Number(params.idRole) <= 0) {
      return;
    }
    if (!Number.isFinite(Number(params.idPosicion)) || Number(params.idPosicion) <= 0) {
      return;
    }
    if (!Number.isFinite(idCompany) || idCompany <= 0) {
      return;
    }
    this.params = params;
    this.userId = params.idUser;
    this.branchId = params.idBranch;
    this.idRole = params.idRole;
    this.idPosicion = params.idPosicion;
    this.idCompany = idCompany;
    this.obtenerDatos(this.idCompany, this.userId, this.branchId, this.idRole, this.idPosicion);
  }

  obtenerDatos(
    idCompany: number,
    idUser: number | string,
    idBranch: number,
    idRole: number,
    idPosicion: number,
    options?: { preserveUiSelection?: boolean; onComplete?: () => void }
  ) {
    const company = Number(idCompany);
    const branch = Number(idBranch);
    const role = Number(idRole);
    const posicion = Number(idPosicion);
    const userNumeric = Number(idUser);
    const transientUser = this.isTransientUserId(idUser);
    if (!Number.isFinite(company) || company <= 0) {
      options?.onComplete?.();
      return;
    }
    if (!Number.isFinite(branch) || branch === 0) {
      options?.onComplete?.();
      return;
    }
    if (!Number.isFinite(role) || role <= 0 || !Number.isFinite(posicion) || posicion <= 0) {
      options?.onComplete?.();
      return;
    }
    if (!transientUser && (!Number.isFinite(userNumeric) || userNumeric <= 0)) {
      options?.onComplete?.();
      return;
    }
    const ctx = `${idUser}|${idBranch}|${idRole}|${idPosicion}`;
    if (ctx !== this.lastPermissionsModalContextKey) {
      this.lastPermissionsModalContextKey = ctx;
      this.modalSidebarMasterKeys.clear();
      this.modalSidebarDetailKeysByMaster.clear();
      this.roleTemplateCrudRows = [];
    }

    this.lastGuardTickAfterModalDataLoad = Number.POSITIVE_INFINITY;
    this.isSeededFromTemplate = false; // se actualizará al recibir los datos

    const preserve = options?.preserveUiSelection === true;
    const savedMasterName = preserve ? this.masterSeleccionado?.masterPermissionName : undefined;
    const savedDetailName = preserve ? this.detailSeleccionado?.detailedPermissionName : undefined;

    const scope: PermissionsScope = this.scopeInput ?? 'userSystem';
    const seedFromRolePos = this.seedFromRolePosInput === true;
    const roleTemplateOnly = this.roleTemplateOnlyInput === true;
    const userSysNumeric = Number(idUser);
    const userSys$ =
      scope === 'userSystem' && !this.isTransientUserId(idUser) && Number.isFinite(userSysNumeric) && userSysNumeric > 0
        ? this.systemPermissionsService.getUserPermissions(userSysNumeric)
        : new Observable<any[]>((sub) => {
            sub.next([]);
            sub.complete();
          });

    const roleTemplateRows$ =
      scope === 'userSystem' &&
      !roleTemplateOnly &&
      Number.isFinite(idRole) &&
      idRole > 0 &&
      Number.isFinite(idPosicion) &&
      idPosicion > 0
        ? this.rolesService.getPermissionsByRoles(idCompany, idRole, idPosicion).pipe(
            map((raw) => this.normalizeCrudArray(raw)),
            catchError(() => of([]))
          )
        : of([]);

    forkJoin({
      crud: this.getCrudRowsForModal$(scope, idCompany, idUser, idBranch, idRole, idPosicion, seedFromRolePos, roleTemplateOnly),
      userSys: userSys$,
      catalog:
        scope === 'userSystem'
          ? this.systemPermissionsService.getMasterPermissions(idCompany)
          : new Observable<any[]>((sub) => { sub.next([]); sub.complete(); }),
      roleTemplateRows: roleTemplateRows$,
    }).subscribe({
      next: ({ crud, userSys, catalog, roleTemplateRows }: any) => {
        const debug = localStorage.getItem('debugPermisosView') === '1';
        this.rawData = crud;
        if (debug) {
          const compras = (Array.isArray(this.rawData) ? this.rawData : []).filter((x: any) =>
            this.normalizar(String(x?.masterPermissionName ?? x?.MasterPermissionName ?? '')).includes('compras')
          );
        }
        this.masterPermissionsCatalog = Array.isArray(catalog) ? catalog : [];
        this.unionModalSidebarUniverseFromRoleTemplate(roleTemplateRows ?? []);
        this.roleTemplateCrudRows = this.normalizeCrudArray(roleTemplateRows ?? []);
        const userSysList = this.normalizeUserSystemApiList(userSys);
        this.userSystemPermissionIds = this.extractPermissionIdsFromUserSystemRows(userSysList);
        // Cuando se abre desde “Departamentos de:” y el usuario no tiene datos propios guardados,
        // usar la plantilla como base visual. Si ya tiene datos guardados, mostrarlos tal cual.
        const userHasOwnCrud = Array.isArray(crud) && crud.length > 0;
        let seededFromRoleTemplateVisual = false;
        if (scope === 'userSystem' && seedFromRolePos && this.roleTemplateCrudRows.length > 0 && !userHasOwnCrud) {
          seededFromRoleTemplateVisual = true;
          const seed = new Set<number>();
          // Para switches con lógica especial (ej. Almacenes homónimo), necesitamos
          // saber si ese master está ON en la plantilla aunque el id exacto del toggle
          // no venga explícito en alguna fila del detalle.
          const templateMasterOnByNorm = new Map<string, { masterPermissionName: string; anyOn: boolean }>();
          for (const r of Array.isArray(roleTemplateRows) ? roleTemplateRows : []) {
            const masterName = String((r as any)?.masterPermissionName ?? (r as any)?.MasterPermissionName ?? '').trim();
            const masterNorm = this.normalizar(masterName);
            if (masterNorm) {
              const prev = templateMasterOnByNorm.get(masterNorm);
              if (prev) {
                // Si ya venía ON, se mantiene.
                prev.anyOn = prev.anyOn || false;
              } else {
                templateMasterOnByNorm.set(masterNorm, { masterPermissionName: masterName, anyOn: false });
              }
            }
            const id = this.normalizeDetailedId((r as any)?.idDetailedPermission ?? (r as any)?.IdDetailedPermission);
            if (id == null) continue;
            const anyOn =
              !!(r as any)?.detailedRead ||
              !!(r as any)?.DetailedRead ||
              !!(r as any)?.masterRead ||
              !!(r as any)?.MasterRead ||
              !!(r as any)?.canRead ||
              !!(r as any)?.CanRead ||
              !!(r as any)?.canCreate ||
              !!(r as any)?.CanCreate ||
              !!(r as any)?.canUpdate ||
              !!(r as any)?.CanUpdate ||
              !!(r as any)?.canDelete ||
              !!(r as any)?.CanDelete;
            if (masterNorm && templateMasterOnByNorm.has(masterNorm)) {
              const entry = templateMasterOnByNorm.get(masterNorm)!;
              entry.anyOn = entry.anyOn || anyOn;
            }
            if (anyOn) seed.add(id);
          }

          // Ajuste homónimo: Almacenes (switch maestro) depende de un id específico.
          // Si en la plantilla el master Almacenes está ON, garantizamos que el id del toggle homónimo
          // también esté en `seed` para reflejar el master correctamente en el modal del usuario.
          for (const [mn, entry] of templateMasterOnByNorm.entries()) {
            const entryName = entry.masterPermissionName;
            if (!entry.anyOn) continue;
            const entryNorm = this.normalizar(entryName);
            if (!entryNorm.includes('almacen')) continue;
            const hid = this.getCatalogDetailedIdForMasterToggle(entryName);
            if (hid != null) {
              seed.add(hid);
            }
          }
          // Solo usar el seed del template para los switches izquierdos si el usuario
          // no tiene sus propios UserSystem permissions. Si ya los tiene (config personalizada),
          // se respetan — solo los flags CRUD del lado derecho se toman del template.
          if (this.userSystemPermissionIds.length === 0) {
            this.userSystemPermissionIds = [...seed];
          }
        }
        this.userSystemPermissionIdsBaseline = [...this.userSystemPermissionIds];
        // Cuando se abre desde "Departamentos de:" y el usuario no tiene CRUD rows propios,
        // usar la plantilla como rawData (usuario nuevo sin permisos previos guardados).
        if (seedFromRolePos && this.roleTemplateCrudRows.length > 0 && (!Array.isArray(crud) || crud.length === 0)) {
          this.rawData = [...this.roleTemplateCrudRows];
        }
        this.rebuildGroupedPermissionsFromRaw();
        if (scope === 'userSystem') {
          // Primero alinear rejilla/CRUD con UserSystemPermissions (o plantilla si aplica).
          // Si se llama syncMasterLeftSwitchesFromUserSys() antes, `detailedRead` suele seguir
          // en false y el método interpreta “módulo apagado” y poda ids de usuario → todo apagado
          // y al guardar + recargar parece que se revierte.
          // Cuando se abre desde “Departamentos de:” (seedFromRolePos=true) y hay template,
          // siempre usar applyTemplateCrudFlagsToGroupedPermissions() para que los flags de
          // detalle reflejen la plantilla rol+posición, sin importar si el usuario tiene
          // UserSystemPermissions propios (que son switches maestros, fuente distinta).
          if (seededFromRoleTemplateVisual) {
            this.applyTemplateCrudFlagsToGroupedPermissions();
          } else if (seedFromRolePos && userHasOwnCrud) {
            // El usuario ya tiene sus CRUD rows guardados (con los flags correctos del template).
            // rebuildGroupedPermissionsFromRaw() ya los leyó correctamente — no sobreescribir
            // con syncReadFlagsFromUserSystemPermissions() que usa IDs de espacio distinto.
            this.forceDeriveLeftFromRight = true;
          } else {
            this.syncReadFlagsFromUserSystemPermissions();
          }
          this.syncMasterLeftSwitchesFromUserSys();
          this.forceDeriveLeftFromRight = false;
          // Tras podar ids globales que no aplican a la plantilla (modal desde Departamentos de),
          // la línea base debe coincidir con lo mostrado para no marcar sucio al abrir.
          if (seededFromRoleTemplateVisual) {
            this.userSystemPermissionIdsBaseline = [...this.userSystemPermissionIds];
            // Marcar que el modal está pre-cargado con plantilla: el botón guardar debe estar activo
            // y saveDetailChanges() omitirá el check de dirty para persistir la plantilla al usuario.
            this.isSeededFromTemplate = true;
          }
        } else {
          this.recomputeReadsFromCrud();
        }
        this.captureMasterReadBaseline();

        if (debug) {
          const comprasMaster = this.groupedPermissions.find((m) =>
            this.normalizar(String(m?.masterPermissionName ?? '')).includes('compras')
          );
        }

        if (preserve && savedMasterName) {
          const m = this.groupedPermissions.find((x) => x.masterPermissionName === savedMasterName);
          if (m) {
            this.masterSeleccionado = m;
            this.detailSeleccionado =
              savedDetailName != null && savedDetailName !== ''
                ? m.details.find((d) => d.detailedPermissionName === savedDetailName) ?? null
                : null;
          } else {
            this.masterSeleccionado = null;
            this.detailSeleccionado = null;
          }
        } else {
          this.masterSeleccionado = null;
          this.detailSeleccionado = null;
        }

        this.lastGuardTickAfterModalDataLoad = this.signalsService.guardRefreshTick();
        this.notSavedChanges = false;
        options?.onComplete?.();
      },
      error: (err) => {
        console.error(err);
        options?.onComplete?.();
      },
    });
  }

  modificar() {
    const idCo = this.idEmpresa ?? this.idCompany;
    const scope: PermissionsScope = this.scopeInput ?? 'userSystem';
    const transient = this.isTransientUserId(this.userId);
    const userSysNumeric = Number(this.userId);
    const roleTemplateOnly = this.roleTemplateOnlyInput === true;
    const crudReload$ =
      roleTemplateOnly
        ? this.rolesService.getPermissionsByRoles(idCo, this.idRole, this.idPosicion).pipe(
            map((raw) => this.normalizeCrudArray(raw)),
            catchError(() => of([]))
          )
        : scope === 'position' && transient
        ? this.rolesService.getPermissionsByRoles(idCo, this.idRole, this.idPosicion).pipe(
            map((raw) => this.normalizeCrudArray(raw)),
            catchError(() => of([]))
          )
        : transient
          ? of([])
          : this.permitionsService.getPermitionsDetail(idCo, Number(this.userId), this.branchId, this.idRole, this.idPosicion).pipe(
              map((raw) => this.normalizeCrudArray(raw)),
              catchError(() => of([])),
              switchMap((rows) => {
                if (rows.length > 0 || scope !== 'position') {
                  return of(rows);
                }
                return this.rolesService.getPermissionsByRoles(idCo, this.idRole, this.idPosicion).pipe(
                  map((raw) => this.normalizeCrudArray(raw)),
                  catchError(() => of([]))
                );
              })
            );

    const roleTemplateRowsMod$ =
      scope === 'userSystem' && !roleTemplateOnly && this.idRole > 0 && this.idPosicion > 0
        ? this.rolesService.getPermissionsByRoles(idCo, this.idRole, this.idPosicion).pipe(
            map((raw) => this.normalizeCrudArray(raw)),
            catchError(() => of([]))
          )
        : of([]);

    forkJoin({
      crud: crudReload$,
      userSys:
        scope === 'userSystem' && !transient && Number.isFinite(userSysNumeric) && userSysNumeric > 0
          ? this.systemPermissionsService.getUserPermissions(userSysNumeric)
          : new Observable<any[]>((sub) => { sub.next([]); sub.complete(); }),
      catalog:
        scope === 'userSystem'
          ? this.systemPermissionsService.getMasterPermissions(idCo)
          : new Observable<any[]>((sub) => { sub.next([]); sub.complete(); }),
      roleTemplateRows: roleTemplateRowsMod$,
    }).subscribe({
      next: ({ crud, userSys, catalog, roleTemplateRows }: any) => {
        this.rawData = crud;
        this.masterPermissionsCatalog = Array.isArray(catalog) ? catalog : [];
        this.unionModalSidebarUniverseFromRoleTemplate(roleTemplateRows ?? []);
        this.roleTemplateCrudRows = this.normalizeCrudArray(roleTemplateRows ?? []);
        const userSysList = this.normalizeUserSystemApiList(userSys);
        this.userSystemPermissionIds = this.extractPermissionIdsFromUserSystemRows(userSysList);
        this.userSystemPermissionIdsBaseline = [...this.userSystemPermissionIds];
        this.rebuildGroupedPermissionsFromRaw();
        if (scope === 'userSystem') {
          this.syncReadFlagsFromUserSystemPermissions();
          this.syncMasterLeftSwitchesFromUserSys();
        } else {
          this.recomputeReadsFromCrud();
        }
        this.captureMasterReadBaseline();
        this.lastGuardTickAfterModalDataLoad = this.signalsService.guardRefreshTick();
        this.notSavedChanges = false;
      },
      error: (err) => console.error(err),
    });
  }

  /**
   * IDs de `UserSystemPermissions` alineados con los switches del panel derecho del modal:
   * uno por fila (`detail`), el mismo que `onDetailedReadChange` / Permisos maestros.
   * No recorre `rawData` ni filas CRUD hijas, para no encender ítems del acordeón que no tienen
   * interruptor en esta rejilla (p. ej. Aportaciones, Transferencias, etc.).
   */
  private collectDetailedPermissionIdsForMaster(master: MasterPermission): Set<number> {
    const ids = new Set<number>();
    for (const detail of master.details) {
      const canonical = this.getDetailedPermissionIdForDetail(detail);
      if (canonical != null) {
        ids.add(canonical);
      }
    }
    return ids;
  }

  /** Al apagar el módulo izquierdo: apagar rejilla, paneles CRUD y quitar ids del usuario (en memoria hasta Guardar). */
  private applyMasterOffCascade(master: MasterPermission): void {
    master.masterRead = false;
    let toRemove: Set<number>;
    if (this.isConfiguracionMaster(master)) {
      toRemove = this.collectConfiguracionEdgeAndHomonymIds(master, {
        includeSetupUsuarioSubIds: true,
      });
    } else {
      toRemove = new Set(this.collectDetailedPermissionIdsForMaster(master));
      // Almacenes (homónimo): al encender el maestro se añade `hid` aparte de los ids de tarjetas;
      // al apagar hay que quitarlo también; si no, syncMasterLeft ve allRightOff + hid y vuelve a encender el switch.
      if (this.isAlmacenesHomonymLeftSwitchMode(master)) {
        const hid = this.getCatalogDetailedIdForMasterToggle(master.masterPermissionName);
        if (hid != null) {
          toRemove.add(hid);
        }
      }
    }
    this.userSystemPermissionIds = this.userSystemPermissionIds.filter((id) => !toRemove.has(id));

    if (this.isConfiguracionMaster(master)) {
      for (const detail of master.details) {
        if (this.isConfiguracionEdgeCardDetail(detail)) {
          detail.detailedRead = false;
        }
      }
      this.zeroCrudReadsForConfiguracionEdges(master);
    } else {
      for (const detail of master.details) {
        detail.detailedRead = false;
      }
      this.zeroCrudReadsForMaster(master);
    }

    if (this.masterSeleccionado === master) {
      this.detailSeleccionado = null;
      this.subdetailExpandido = null;
    }
  }

  /** Al encender el módulo izquierdo: encender rejilla, CRUD y añadir ids (en memoria hasta Guardar). */
  private applyMasterOnCascade(master: MasterPermission): void {
    master.masterRead = true;
    const toAdd = this.isConfiguracionMaster(master)
      ? this.collectConfiguracionEdgeAndHomonymIds(master)
      : this.collectDetailedPermissionIdsForMaster(master);
    const next = [...this.userSystemPermissionIds];
    for (const id of toAdd) {
      if (!next.includes(id)) {
        next.push(id);
      }
    }
    this.userSystemPermissionIds = next;

    if (this.isConfiguracionMaster(master)) {
      for (const detail of master.details) {
        if (!this.isConfiguracionEdgeCardDetail(detail)) {
          continue;
        }
        detail.detailedRead = true;
        // Usuarios con Security / Departamento / Permisos: no encender todos los switches al subir el maestro;
        // cada uno sigue su id en UserSystemPermissions (sync abajo).
        if (this.detailHasMultiplePrincipalSections(detail)) {
          continue;
        }
        for (const sd of detail.subdetails) {
          if (sd.principal) {
            sd.principal.canRead = true;
            sd.principal.canCreate = true;
            sd.principal.canUpdate = true;
            sd.principal.canDelete = true;
          }
          for (const child of sd.children) {
            child.canRead = true;
            child.canCreate = true;
            child.canUpdate = true;
            child.canDelete = true;
          }
        }
      }
      for (const detail of master.details) {
        if (!this.isConfiguracionEdgeCardDetail(detail)) {
          continue;
        }
        if (this.detailHasMultiplePrincipalSections(detail)) {
          this.syncReadFlagsForSingleDetail(detail);
          this.syncPrincipalCrudFromReadForDetail(detail);
        }
      }
    } else {
      for (const detail of master.details) {
        detail.detailedRead = true;
        for (const sd of detail.subdetails) {
          if (sd.principal) {
            sd.principal.canRead = true;
            sd.principal.canCreate = true;
            sd.principal.canUpdate = true;
            sd.principal.canDelete = true;
          }
          for (const child of sd.children) {
            child.canRead = true;
            child.canCreate = true;
            child.canUpdate = true;
            child.canDelete = true;
          }
        }
      }
    }
  }

  /**
   * Id en UserSystemPermissions para la fila del panel derecho: prioriza el catálogo
   * (mismo `id` que el acordeón Permisos maestros); si no hay match, usa CRUD.
   */
  private getDetailedPermissionIdForDetail(detail: DetailedPermission): number | null {
    const master = this.findMasterContainingDetail(detail);
    if (master) {
      let fromCatalog = this.getCatalogDetailedIdForDetailName(
        master.masterPermissionName,
        detail.detailedPermissionName
      );
      if (fromCatalog == null && this.isConfiguracionMaster(master) && this.isConfiguracionEdgeCardDetail(detail)) {
        fromCatalog = this.resolveConfiguracionEdgeCatalogId(master, detail);
      }
      if (fromCatalog != null) {
        return fromCatalog;
      }
    }
    const homonymId =
      master != null ? this.getCatalogDetailedIdForMasterToggle(master.masterPermissionName) : null;
    for (const sd of detail.subdetails) {
      if (sd.principal?.idDetailedPermission != null) {
        const raw = this.normalizeDetailedId(sd.principal.idDetailedPermission);
        if (raw != null) {
          if (
            homonymId != null &&
            raw === homonymId &&
            !this.isHomonymDetailForMaster(master!, detail)
          ) {
            /* seguir buscando: id del maestro homónimo mal replicado en esta tarjeta */
          } else {
            return raw;
          }
        }
      }
      for (const c of sd.children) {
        if (c.idDetailedPermission != null) {
          const raw = this.normalizeDetailedId(c.idDetailedPermission);
          if (raw != null) {
            if (
              homonymId != null &&
              raw === homonymId &&
              !this.isHomonymDetailForMaster(master!, detail)
            ) {
              continue;
            }
            return raw;
          }
        }
      }
    }
    return null;
  }

  /** Una fila del panel derecho + sus subdetalles CRUD, alineada con UserSystemPermissions. */
  private syncReadFlagsForSingleDetail(detail: DetailedPermission): void {
    const canonical = this.getDetailedPermissionIdForDetail(detail);
    const multiPrincipal = this.detailHasMultiplePrincipalSections(detail);

    if (canonical != null) {
      if (multiPrincipal) {
        // UserSystem solo tiene el permiso detallado padre; cada switch Principal vive en CRUD.
        const anyPrincipalRead = detail.subdetails.some((sd) => sd.principal?.canRead === true);
        detail.detailedRead =
          anyPrincipalRead || this.userSystemPermissionIds.includes(canonical);
      } else {
        detail.detailedRead = this.userSystemPermissionIds.includes(canonical);
      }
    }
    for (const sd of detail.subdetails) {
      if (sd.principal) {
        if (multiPrincipal) {
          // Id en UserSystem: mismo criterio que Permisos maestros › Setup Usuarios para Empresas/Sucursales.
          let pid = this.normalizeDetailedId(sd.principal.idDetailedPermission);
          const m = this.findMasterContainingDetail(detail);
          if (
            m &&
            this.isUsuariosConfigDetail(m, detail) &&
            this.isEmpresasOrSucursalesSetupSubdetail(sd)
          ) {
            const sid = this.getCatalogDetailedIdFromSetupUsuariosPermission(sd.subdetailedPermissionName);
            if (sid != null) {
              pid = sid;
            }
          }
          if (pid != null && pid !== canonical) {
            sd.principal.canRead = this.userSystemPermissionIds.includes(pid);
          }
        } else {
          const pid = this.normalizeDetailedId(sd.principal.idDetailedPermission);
          let pidUse = canonical != null ? canonical : pid;
          const mPr = this.findMasterContainingDetail(detail);
          const homonymPr = mPr ? this.getCatalogDetailedIdForMasterToggle(mPr.masterPermissionName) : null;
          if (
            homonymPr != null &&
            pidUse === homonymPr &&
            mPr &&
            !this.isHomonymDetailForMaster(mPr, detail)
          ) {
            pidUse = null;
          }
          if (pidUse != null) {
            sd.principal.canRead = this.userSystemPermissionIds.includes(pidUse);
          }
        }
      }
      // Hijos: normalmente se sincronizan salvo bajo principal en multiPrincipal (antes quedaban solo en CRUD).
      // Configuración › Usuarios › Acciones adicionales: Security / Departamento / Permisos usan los mismos ids
      // que Permisos maestros (Setup Usuarios), y deben reflejar `userSystemPermissionIds`.
      if (!(multiPrincipal && sd.principal != null)) {
        for (const child of sd.children) {
          const cid = this.normalizeDetailedId(child.idDetailedPermission);
          if (cid != null) {
            const mCh = this.findMasterContainingDetail(detail);
            const homonymCh = mCh ? this.getCatalogDetailedIdForMasterToggle(mCh.masterPermissionName) : null;
            if (
              homonymCh != null &&
              cid === homonymCh &&
              mCh &&
              !this.isHomonymDetailForMaster(mCh, detail)
            ) {
              continue;
            }
            child.canRead = this.userSystemPermissionIds.includes(cid);
          }
        }
      } else {
        const mKids = this.findMasterContainingDetail(detail);
        if (mKids && this.isUsuariosConfigDetail(mKids, detail)) {
          for (const child of sd.children) {
            const setupId = this.getCatalogDetailedIdFromSetupUsuariosPermission(child.name);
            if (setupId != null) {
              const on = this.userSystemPermissionIds.includes(setupId);
              child.canRead = on;
              if (!on) {
                child.canCreate = false;
                child.canUpdate = false;
                child.canDelete = false;
              } else {
                child.canCreate = true;
                child.canUpdate = true;
                child.canDelete = true;
              }
            }
          }
        }
      }
    }
    if (canonical == null && !multiPrincipal) {
      detail.detailedRead = detail.subdetails.some(
        (sd) =>
          !!sd.principal?.canRead || sd.children.some((c) => !!c.canRead)
      );
    }
  }

  /** Alinea lectura (rejilla + cada Principal/hijo por su idDetailedPermission) con UserSystemPermissions. */
  private syncReadFlagsFromUserSystemPermissions(): void {
    for (const master of this.groupedPermissions) {
      for (const detail of master.details) {
        this.syncReadFlagsForSingleDetail(detail);
      }
    }
  }

  /** Actualiza solo en memoria; el PUT va en Guardar. */
  private applyUserSystemPermissionLocal(
    detailPermissionId: number,
    enabled: boolean,
    onAfter?: () => void
  ): void {
    const next = [...this.userSystemPermissionIds];
    if (enabled) {
      if (!next.includes(detailPermissionId)) {
        next.push(detailPermissionId);
      }
    } else {
      const idx = next.indexOf(detailPermissionId);
      if (idx !== -1) {
        next.splice(idx, 1);
      }
    }
    this.userSystemPermissionIds = next;
    this.syncReadFlagsFromUserSystemPermissions();
    onAfter?.();
    this.syncMasterLeftSwitchesFromUserSys();
    this.syncReadFlagsFromUserSystemPermissions();
    this.checkForChanges();
  }

  private areUserSystemPermissionsDirty(): boolean {
    const a = [...this.userSystemPermissionIds].sort((x, y) => x - y);
    const b = [...this.userSystemPermissionIdsBaseline].sort((x, y) => x - y);
    if (a.length !== b.length) {
      return true;
    }
    return a.some((id, i) => id !== b[i]);
  }

  /** Crear/Actualizar/Borrar y master lateral (no los switches de UserSystem). */
  private hasNonUserSysCrudDirty(): boolean {
    for (const master of this.groupedPermissions) {
      if (this.masterReadBaselineByName.has(master.masterPermissionName)) {
        const origMr = this.masterReadBaselineByName.get(master.masterPermissionName)!;
        if (master.aplica !== origMr) {
          return true;
        }
      }

      for (const detail of master.details) {
        for (const sd of detail.subdetails) {
          const all: CrudPermission[] = [];
          if (sd.principal) {
            all.push(sd.principal);
          }
          all.push(...sd.children);
          for (const p of all) {
            const o = p.__original;
            if (!o) {
              continue;
            }
            if (o['detailedRead'] !== undefined && !!o['detailedRead'] !== !!detail.detailedRead) {
              return true;
            }
            if (o['active'] !== undefined && p.active !== o['active']) {
              return true;
            }
            if (
              !!o.aplica !== !!master.aplica ||
              p.canRead !== !!o.canRead ||
              p.canCreate !== !!o.canCreate ||
              p.canUpdate !== !!o.canUpdate ||
              p.canDelete !== !!o.canDelete
            ) {
              return true;
            }
          }
        }
      }
    }
    return false;
  }

  private propagarActivacionCrudTrasLectura(permission: CrudPermission, parentSubdetail?: SubdetailPermission | null): void {
    if (permission.canRead && this.detailSeleccionado && this.masterSeleccionado) {
      this.detailSeleccionado.detailedRead = true;
      this.masterSeleccionado.masterRead = true;
      permission.canCreate = true;
      permission.canUpdate = true;
      permission.canDelete = true;
      // Si se activó un hijo, también activar el switch principal del subdetail padre
      if (parentSubdetail?.principal && !parentSubdetail.principal.canRead) {
        parentSubdetail.principal.canRead = true;
        parentSubdetail.principal.canCreate = true;
        parentSubdetail.principal.canUpdate = true;
        parentSubdetail.principal.canDelete = true;
      }
    }
    if (!permission.canRead) {
      permission.canCreate = false;
      permission.canUpdate = false;
      permission.canDelete = false;
    }
  }

  /** Switch de lectura en panel CRUD (Principal / hijos): misma API que Permisos maestros. */
  onPermisoReadCrudChange(permission: CrudPermission): void {
    if ((this.scopeInput ?? 'userSystem') === 'position') {
      this.propagarActivacionCrudTrasLectura(permission);
      this.recomputeReadsFromCrud();
      this.checkForChanges();
      return;
    }
    const master = this.masterSeleccionado;
    const detail = this.detailSeleccionado;
    let id: number | null = this.normalizeDetailedId(permission.idDetailedPermission);
    // Una sola sección Principal: el switch alinea con UserSystem vía id canónico del detalle.
    // Varias (Security / Departamento / Permisos): UserSystem solo tiene el padre; cada switch es solo CRUD + reconcile.
    if (this.isPrincipalShowColumn(permission.name) && master && detail) {
      if (this.detailHasMultiplePrincipalSections(detail)) {
        this.propagarActivacionCrudTrasLectura(permission);
        const canonical = this.getDetailedPermissionIdForDetail(detail);
        const sub = detail.subdetails.find((s) => s.principal === permission) ?? null;
        let userSysId = this.normalizeDetailedId(permission.idDetailedPermission);
        if (
          this.isUsuariosConfigDetail(master, detail) &&
          sub &&
          this.isEmpresasOrSucursalesSetupSubdetail(sub)
        ) {
          const setupId = this.getCatalogDetailedIdFromSetupUsuariosPermission(sub.subdetailedPermissionName);
          if (setupId != null) {
            userSysId = setupId;
          }
        }
        if (userSysId != null && userSysId !== canonical) {
          this.applyUserSystemPermissionLocal(userSysId, permission.canRead, () =>
            this.reconcileCanonicalUserSystemForMultiPrincipalDetail(detail)
          );
        } else {
          this.reconcileCanonicalUserSystemForMultiPrincipalDetail(detail);
        }
        return;
      }
      const canonical = this.getDetailedPermissionIdForDetail(detail);
      if (canonical != null) {
        id = canonical;
      }
    }
    // Hijos bajo principal en sección multiPrincipal: por defecto solo CRUD local.
    // Excepción Configuración › Usuarios: hijos alineados con Setup Usuarios actualizan `userSystemPermissionIds`
    // en memoria; el PUT y mensaje de guardado ocurren solo al pulsar Guardar.
    const parentSubdetail = detail?.subdetails.find((sd) => sd.children.includes(permission));
    if (detail && this.detailHasMultiplePrincipalSections(detail) && parentSubdetail?.principal != null) {
      const masterCtx = this.masterSeleccionado;
      if (
        masterCtx &&
        this.isUsuariosConfigDetail(masterCtx, detail) &&
        parentSubdetail.children.includes(permission)
      ) {
        const setupUsuariosId = this.getCatalogDetailedIdFromSetupUsuariosPermission(permission.name);
        if (setupUsuariosId != null) {
          this.applyUserSystemPermissionLocal(setupUsuariosId, permission.canRead, () =>
            this.propagarActivacionCrudTrasLectura(permission, parentSubdetail)
          );
          return;
        }
      }
      this.propagarActivacionCrudTrasLectura(permission, parentSubdetail);
      this.checkForChanges();
      return;
    }
    if (id != null) {
      this.applyUserSystemPermissionLocal(id, permission.canRead, () =>
        this.propagarActivacionCrudTrasLectura(permission, parentSubdetail)
      );
      return;
    }
    this.propagarActivacionCrudTrasLectura(permission, parentSubdetail);
    this.checkForChanges();
  }

  seleccionarMaster(master: MasterPermission) {
    this.masterSeleccionado = master;
    this.detailSeleccionado = null;
  }

  onMasterAplicaChange(master: MasterPermission) {
    if (!master.aplica) {
      master.masterRead = false;
      for (const detail of master.details) {
        detail.detailedRead = false;
      }
      this.zeroCrudReadsForMaster(master);

      const idsToRemove = this.isConfiguracionMaster(master)
        ? this.collectConfiguracionEdgeAndHomonymIds(master, { includeSetupUsuarioSubIds: true })
        : this.collectDetailedPermissionIdsForMaster(master);
      this.userSystemPermissionIds = this.userSystemPermissionIds.filter((id) => !idsToRemove.has(id));

      if (this.masterSeleccionado === master) {
        this.detailSeleccionado = null;
        this.subdetailExpandido = null;
      }
    }
    this.checkForChanges();
  }

  seleccionarDetail(detail: DetailedPermission) {
    if (this.detailSeleccionado === detail) {
      this.detailSeleccionado = null;
      this.subdetailExpandido = null;
      return;
    }
    this.detailSeleccionado = detail;
    this.subdetailExpandido = null;

    // No forzar valores al seleccionar - respetar los valores existentes

    this.checkForChanges();
  }

  getColorMaster(index: number): string {
    return this.coloresMaster[index % this.coloresMaster.length];
  }

  getIndexMasterSeleccionado(): number {
    return this.groupedPermissions.indexOf(this.masterSeleccionado);
  }

  // Verifica si un detail tiene al menos un subdetail con children
  tieneChildren(detail: DetailedPermission): boolean {
    return detail.subdetails.some(sd => sd.children && sd.children.length > 0);
  }

  /**
   * Visibilidad del panel CRUD del detalle seleccionado. Además de `detailedRead`, Almacenes en modo homónimo
   * puede tener el switch maestro y el id en UserSystem activos mientras el detalle aún no marca lectura.
   */
  mostrarPanelCrudParaDetalleSeleccionado(): boolean {
    const detail = this.detailSeleccionado;
    const master = this.masterSeleccionado;
    if (!detail || !master) {
      return false;
    }
    if (detail.subdetails && detail.subdetails.length > 0) {
      return true;
    }
    if (!this.isAlmacenesHomonymLeftSwitchMode(master)) {
      return false;
    }
    const hid = this.getCatalogDetailedIdForMasterToggle(master.masterPermissionName);
    return hid != null && this.userSystemPermissionIds.includes(hid);
  }

  // Navega al paso 2 mostrando las acciones adicionales del subdetail
  toggleChildren(subdetail: SubdetailPermission) {
    this.subdetailPaso2 = subdetail;
    this.irPaso(2);
  }

  // Navega entre pasos
  irPaso(paso: number) {
    this.pasoActual = paso;
  }

  private transformData(data: any[]): MasterPermission[] {
    const masterMap = new Map<string, MasterPermission>();
    const detailMap = new Map<string, DetailedPermission>();

    data.forEach(item => {
      if (!masterMap.has(item.masterPermissionName)) {
        masterMap.set(item.masterPermissionName, {
          masterPermissionName: item.masterPermissionName,
          aplica: item.aplica ?? true,
          masterRead: item.masterRead,
          details: []
        });
      }

      const masterGroup = masterMap.get(item.masterPermissionName)!;

      const detailKey = `${item.masterPermissionName}|${item.detailedPermissionName}`;
      let detailGroup = detailMap.get(detailKey);
      if (!detailGroup) {
        detailGroup = {
          detailedPermissionName: item.detailedPermissionName,
          detailedRead: item.detailedRead,
          subdetails: []
        };
        detailMap.set(detailKey, detailGroup);
        masterGroup.details.push(detailGroup);
      }

      let subdetailGroup = detailGroup.subdetails.find(sd => sd.subdetailedPermissionName === item.subdetailedPermissionName);
      if (!subdetailGroup) {
        subdetailGroup = {
          subdetailedPermissionName: item.subdetailedPermissionName,
          principal: null,
          children: []
        };
        detailGroup.subdetails.push(subdetailGroup);
      }

      const crudItem: CrudPermission = {
        name: item.showColumn,
        canRead: item.canRead,
        canCreate: item.canCreate === false ? false : true,
        canUpdate: item.canUpdate === false ? false : true,
        canDelete: item.canDelete === false ? false : true,
        idMasterPermission: item.idMasterPermission,
        idDetailedPermission: item.idDetailedPermission,
        idShowPermition: item.idShowPermition,
        active: item.active,
        __original: { ...item }
      };

      if (this.isPrincipalShowColumn(item.showColumn)) {
        subdetailGroup.principal = crudItem;
      } else {
        subdetailGroup.children.push(crudItem);
      }
    });

    // Ordenar según ordenMaster con normalización de acentos
    const result = Array.from(masterMap.values());
    result.sort((a, b) => {
      const nameA = this.normalizar(a.masterPermissionName);
      const nameB = this.normalizar(b.masterPermissionName);

      const indexA = this.ordenMaster.findIndex(o => nameA.includes(o));
      const indexB = this.ordenMaster.findIndex(o => nameB.includes(o));

      const posA = indexA === -1 ? 999 : indexA;
      const posB = indexB === -1 ? 999 : indexB;
      return posA - posB;
    });

    // Ordenar details dentro de cada master según ordenDetails
    result.forEach(master => {
      master.details.sort((a, b) => {
        const nameA = this.normalizar(a.detailedPermissionName);
        const nameB = this.normalizar(b.detailedPermissionName);
        const indexA = this.ordenDetails.findIndex(o => nameA.includes(o));
        const indexB = this.ordenDetails.findIndex(o => nameB.includes(o));
        const posA = indexA === -1 ? 999 : indexA;
        const posB = indexB === -1 ? 999 : indexB;
        return posA - posB;
      });
    });

    return result;
  }

  /**
   * El API de filas CRUD puede omitir módulos sin permisos guardados; el catálogo de maestros
   * (mismo que Permisos maestros) define la lista completa del sidebar izquierdo.
   */
  private catalogMasterAlreadyInGrouped(grouped: MasterPermission[], catRow: any): boolean {
    const catId = Number(catRow?.id ?? catRow?.Id);
    if (Number.isFinite(catId) && catId > 0) {
      for (const m of grouped) {
        const hit = this.getMasterCatalogEntry(m.masterPermissionName);
        const hid = Number(hit?.id ?? hit?.Id);
        if (hit != null && Number.isFinite(hid) && hid === catId) {
          return true;
        }
      }
    }
    const cname = this.normalizar(String(catRow?.permissionName ?? catRow?.PermissionName ?? ''));
    if (!cname) {
      return false;
    }
    for (const m of grouped) {
      const mn = this.normalizar(m.masterPermissionName || '');
      if (mn === cname) {
        return true;
      }
      if (mn.length >= 3 && cname.length >= 3 && (mn.includes(cname) || cname.includes(mn))) {
        return true;
      }
    }
    return false;
  }

  /** ¿Este maestro (nombre ya normalizado) pertenece al subconjunto CRUD de este modal? */
  private isMasterInModalSidebarUniverse(catalogNameNorm: string): boolean {
    if (!catalogNameNorm) {
      return false;
    }
    if (this.modalSidebarMasterKeys.has(catalogNameNorm)) {
      return true;
    }
    // "Compras" genérico no debe considerarse del universo solo porque exista "Compras delison"
    // (substring); si no, al apagar Compras delison el merge del catálogo añade una fila "Compras".
    if (catalogNameNorm === 'compras' || catalogNameNorm === 'compra') {
      return (
        this.modalSidebarMasterKeys.has('compras') ||
        this.modalSidebarMasterKeys.has('compra')
      );
    }
    for (const k of this.modalSidebarMasterKeys) {
      if (
        k.length >= 3 &&
        catalogNameNorm.length >= 3 &&
        (k.includes(catalogNameNorm) || catalogNameNorm.includes(k))
      ) {
        return true;
      }
    }
    return false;
  }

  private unionModalSidebarUniverseFromGrouped(grouped: MasterPermission[]): void {
    for (const m of grouped) {
      const k = this.normalizar(m.masterPermissionName || '');
      if (k) {
        this.modalSidebarMasterKeys.add(k);
      }
    }
    for (const row of Array.isArray(this.rawData) ? this.rawData : []) {
      const mn = this.normalizar(String((row as any)?.masterPermissionName ?? (row as any)?.MasterPermissionName ?? ''));
      if (mn) {
        this.modalSidebarMasterKeys.add(mn);
      }
    }
  }

  /** Los maestros del sidebar coinciden con la plantilla rol+posición (siempre N filas aunque el CRUD del usuario omita módulos apagados). */
  private unionModalSidebarUniverseFromRoleTemplate(templateRows: any[]): void {
    for (const row of Array.isArray(templateRows) ? templateRows : []) {
      const mn = this.normalizar(
        String((row as any)?.masterPermissionName ?? (row as any)?.MasterPermissionName ?? '')
      );
      if (mn) {
        this.modalSidebarMasterKeys.add(mn);

        const dn = this.normalizar(
          String(
            (row as any)?.detailedPermissionName ??
              (row as any)?.DetailedPermissionName ??
              ''
          )
        );
        if (dn) {
          let set = this.modalSidebarDetailKeysByMaster.get(mn);
          if (!set) {
            set = new Set<string>();
            this.modalSidebarDetailKeysByMaster.set(mn, set);
          }
          set.add(dn);
        }
      }
    }
  }

  /**
   * Añade maestros del catálogo que no vinieron en `rawData` (p. ej. módulo apagado tras guardar),
   * para que el switch izquierdo no «desaparezca».
   * Solo maestros que ya formaron parte del CRUD de este contexto (`modalSidebarMasterKeys`), no todo el catálogo.
   */
  private mergeCatalogMastersIntoGrouped(grouped: MasterPermission[]): MasterPermission[] {
    if ((this.scopeInput ?? 'userSystem') !== 'userSystem') {
      return grouped;
    }
    const catalog = this.masterPermissionsCatalog;
    if (!Array.isArray(catalog) || catalog.length === 0) {
      return grouped;
    }
    const extras: MasterPermission[] = [];
    for (const cat of catalog) {
      if (this.catalogMasterAlreadyInGrouped(grouped, cat)) {
        continue;
      }
      const name = String(cat?.permissionName ?? cat?.PermissionName ?? '').trim();
      if (!name) {
        continue;
      }
      const nameNorm = this.normalizar(name);
      if (!this.isMasterInModalSidebarUniverse(nameNorm)) {
        continue;
      }
      const allowedDetailKeys = this.modalSidebarDetailKeysByMaster.get(nameNorm);
      const details: DetailedPermission[] = [];
      for (const d of cat.detailedPermissions ?? []) {
        const dn = String(d?.permissionName ?? d?.PermissionName ?? '').trim();
        if (!dn) {
          continue;
        }
        if (allowedDetailKeys && allowedDetailKeys.size > 0) {
          const dnNorm = this.normalizar(dn);
          if (!allowedDetailKeys.has(dnNorm)) {
            continue;
          }
        }
        details.push({
          detailedPermissionName: dn,
          detailedRead: false,
          subdetails: [],
        });
      }
      extras.push({
        masterPermissionName: name,
        aplica: true,
        masterRead: false,
        details,
      });
    }
    if (extras.length === 0) {
      return grouped;
    }
    const combined = [...grouped, ...extras];
    combined.sort((a, b) => {
      const nameA = this.normalizar(a.masterPermissionName);
      const nameB = this.normalizar(b.masterPermissionName);
      const posA = this.ordenMaster.findIndex((o) => nameA.includes(o));
      const posB = this.ordenMaster.findIndex((o) => nameB.includes(o));
      return (posA === -1 ? 999 : posA) - (posB === -1 ? 999 : posB);
    });
    combined.forEach((master) => {
      master.details.sort((a, b) => {
        const nameA = this.normalizar(a.detailedPermissionName);
        const nameB = this.normalizar(b.detailedPermissionName);
        const indexA = this.ordenDetails.findIndex((o) => nameA.includes(o));
        const indexB = this.ordenDetails.findIndex((o) => nameB.includes(o));
        return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
      });
    });
    return combined;
  }

  /**
   * Si en el contexto existe "Compras delison", no mostrar además el maestro genérico "Compras"
   * (mismo slot; no afecta a "Compras TD" u otros nombres compuestos).
   */
  private dedupeGenericComprasWhenComprasDelisonPresent(grouped: MasterPermission[]): MasterPermission[] {
    const hasComprasDelison = grouped.some((m) => {
      const n = this.normalizar(m.masterPermissionName || '');
      return n.includes('delison') && n.includes('compras');
    });
    if (!hasComprasDelison) {
      return grouped;
    }
    return grouped.filter((m) => {
      const n = this.normalizar(m.masterPermissionName || '');
      if (n === 'compras' || n === 'compra') {
        return false;
      }
      return true;
    });
  }

  /**
   * Recorta los details del panel derecho al universo permitido por la plantilla
   * `rol+posición` (si existe ese universo para el maestro).
   *
   * Esto evita que se muestren “tarjetas extra” incluso si el CRUD ya traía más de las esperadas.
   */
  private filterDetailsToRoleTemplateUniverse(grouped: MasterPermission[]): MasterPermission[] {
    if (!this.modalSidebarDetailKeysByMaster || this.modalSidebarDetailKeysByMaster.size === 0) {
      return grouped;
    }
    return grouped.map((master) => {
      const mn = this.normalizar(master.masterPermissionName || '');
      const allowed = this.modalSidebarDetailKeysByMaster.get(mn);
      if (!allowed || allowed.size === 0) {
        return master;
      }
      return {
        ...master,
        details: (master.details || []).filter((d) => {
          const dn = this.normalizar(d.detailedPermissionName || '');
          return allowed.has(dn);
        }),
      };
    });
  }

  /**
   * Si el catálogo inyecta masters/details pero no trae la estructura CRUD completa
   * (subdetalles vacíos), repone esa estructura desde la plantilla rol+posición.
   */
  private hydrateMissingSubdetailsFromRoleTemplate(grouped: MasterPermission[]): MasterPermission[] {
    if (!Array.isArray(this.roleTemplateCrudRows) || this.roleTemplateCrudRows.length === 0) {
      return grouped;
    }

    const templateGrouped = this.transformData(this.roleTemplateCrudRows);
    const templateMasterByNorm = new Map<string, MasterPermission>();
    for (const m of templateGrouped) {
      const mn = this.normalizar(m.masterPermissionName || '');
      if (mn) {
        templateMasterByNorm.set(mn, m);
      }
    }

    const cloneCrudPermission = (p: CrudPermission): CrudPermission => ({
      name: p.name,
      canRead: p.canRead,
      canCreate: p.canCreate,
      canUpdate: p.canUpdate,
      canDelete: p.canDelete,
      idMasterPermission: p.idMasterPermission,
      idDetailedPermission: p.idDetailedPermission,
      idShowPermition: p.idShowPermition,
      active: p.active,
      __original: { ...(p.__original ?? {}) },
    });

    const cloneSubdetail = (sd: SubdetailPermission): SubdetailPermission => ({
      subdetailedPermissionName: sd.subdetailedPermissionName,
      principal: sd.principal ? cloneCrudPermission(sd.principal) : null,
      children: Array.isArray(sd.children) ? sd.children.map(cloneCrudPermission) : [],
    });

    return grouped.map((master) => {
      const mn = this.normalizar(master.masterPermissionName || '');
      const tMaster = templateMasterByNorm.get(mn);
      if (!tMaster) {
        return master;
      }

      const nextDetails = (master.details || []).map((detail) => {
        const dn = this.normalizar(detail.detailedPermissionName || '');
        const tDetail = (tMaster.details || []).find(
          (d) => this.normalizar(d.detailedPermissionName || '') === dn
        );
        if (!tDetail) {
          return detail;
        }
        if (Array.isArray(detail.subdetails) && detail.subdetails.length > 0) {
          return detail;
        }
        return {
          ...detail,
          subdetails: (tDetail.subdetails || []).map(cloneSubdetail),
        };
      });

      return {
        ...master,
        details: nextDetails,
      };
    });
  }

  /**
   * Cuando el modal del usuario se precarga desde la plantilla rol+posición,
   * algunos backends no llenan bien `detailedRead/masterRead` en el CRUD del usuario.
   * Para que el panel derecho coincida 1:1 con el modal de Departamento+Posición,
   * aplicamos los flags `canRead/canCreate/canUpdate/canDelete` desde la plantilla
   * directamente sobre `groupedPermissions` (principal/children) y recalculamos
   * `detailedRead`/`masterRead`.
   */
  private applyTemplateCrudFlagsToGroupedPermissions(): void {
    if (!Array.isArray(this.roleTemplateCrudRows) || this.roleTemplateCrudRows.length === 0) {
      return;
    }
    if (!Array.isArray(this.groupedPermissions) || this.groupedPermissions.length === 0) {
      return;
    }

    // Match lo más robusto posible: por IDs, no por nombres/texto.
    // key1: `${idDetailedPermission}-${idShowPermition}`
    // key2 (fallback): `${idDetailedPermission}` si no hay idShowPermition.
    const templateByKey = new Map<string, { canRead: boolean; canCreate: boolean; canUpdate: boolean; canDelete: boolean }>();
    const templateByDetailOnly = new Map<string, { canRead: boolean; canCreate: boolean; canUpdate: boolean; canDelete: boolean }>();

    for (const r of this.roleTemplateCrudRows) {
      const did = Number((r as any)?.idDetailedPermission ?? (r as any)?.IdDetailedPermission);
      const sid = Number((r as any)?.idShowPermition ?? (r as any)?.IdShowPermition);
      if (!Number.isFinite(did) || did <= 0) continue;

      const canRead = (r as any)?.canRead ?? (r as any)?.CanRead ?? (r as any)?.detailedRead ?? (r as any)?.DetailedRead ?? false;
      const canCreate = (r as any)?.canCreate ?? (r as any)?.CanCreate ?? (canRead ? true : false);
      const canUpdate = (r as any)?.canUpdate ?? (r as any)?.CanUpdate ?? (canRead ? true : false);
      const canDelete = (r as any)?.canDelete ?? (r as any)?.CanDelete ?? (canRead ? true : false);

      const v = { canRead: !!canRead, canCreate: !!canCreate, canUpdate: !!canUpdate, canDelete: !!canDelete };

      const detailKey = `${did}`;
      const existingDetail = templateByDetailOnly.get(detailKey);
      if (existingDetail) {
        existingDetail.canRead = existingDetail.canRead || v.canRead;
        existingDetail.canCreate = existingDetail.canCreate || v.canCreate;
        existingDetail.canUpdate = existingDetail.canUpdate || v.canUpdate;
        existingDetail.canDelete = existingDetail.canDelete || v.canDelete;
      } else {
        templateByDetailOnly.set(detailKey, { ...v });
      }

      if (Number.isFinite(sid) && sid > 0) {
        const key = `${did}-${sid}`;
        const existing = templateByKey.get(key);
        if (existing) {
          existing.canRead = existing.canRead || v.canRead;
          existing.canCreate = existing.canCreate || v.canCreate;
          existing.canUpdate = existing.canUpdate || v.canUpdate;
          existing.canDelete = existing.canDelete || v.canDelete;
        } else {
          templateByKey.set(key, { ...v });
        }
      }
    }

    // Aplicar flags al árbol actual
    for (const master of this.groupedPermissions) {
      let anyDetailOn = false;
      for (const detail of master.details || []) {
        let detailAny = false;
        for (const sd of detail.subdetails || []) {
          if (sd.principal) {
            const pid = sd.principal.idDetailedPermission;
            const pShow = sd.principal.idShowPermition;
            const key1 = Number.isFinite(pid) && Number.isFinite(pShow) && pShow > 0 ? `${pid}-${pShow}` : null;
            const key2 = Number.isFinite(pid) ? `${pid}` : null;
            const t = (key1 ? templateByKey.get(key1) : undefined) ?? (key2 ? templateByDetailOnly.get(key2) : undefined);
            if (t) {
              sd.principal.canRead = t.canRead;
              sd.principal.canCreate = t.canCreate;
              sd.principal.canUpdate = t.canUpdate;
              sd.principal.canDelete = t.canDelete;
            }
          }
          for (const child of sd.children || []) {
            const cid = child.idDetailedPermission;
            const cShow = child.idShowPermition;
            const key1 = Number.isFinite(cid) && Number.isFinite(cShow) && cShow > 0 ? `${cid}-${cShow}` : null;
            const key2 = Number.isFinite(cid) ? `${cid}` : null;
            const t = (key1 ? templateByKey.get(key1) : undefined) ?? (key2 ? templateByDetailOnly.get(key2) : undefined);
            if (t) {
              child.canRead = t.canRead;
              child.canCreate = t.canCreate;
              child.canUpdate = t.canUpdate;
              child.canDelete = t.canDelete;
            }
          }
        }

        // Recalcular detallado
        const detailAnyOn = (detail.subdetails || []).some((sd) => {
          const principalOn = sd.principal?.canRead === true;
          const childrenOn = (sd.children || []).some((c) => c.canRead === true);
          return principalOn || childrenOn;
        });
        detail.detailedRead = detailAnyOn;
        if (detailAnyOn) {
          detailAny = true;
          anyDetailOn = true;
        }
      }

      master.masterRead = anyDetailOn;
    }
  }

  /**
   * Añade tarjetas de detalle (cards del panel derecho) que existen en la plantilla
   * rol+posición pero no están en el CRUD guardado del usuario.
   * Necesario cuando el usuario ya tiene filas CRUD propias pero faltan algunas
   * tarjetas que el template sí incluye (p. ej. Configuración / Catálogos en Compras).
   */
  private hydrateDetailCardsFromRoleTemplate(grouped: MasterPermission[]): MasterPermission[] {
    if (!Array.isArray(this.roleTemplateCrudRows) || this.roleTemplateCrudRows.length === 0) {
      return grouped;
    }
    const templateGrouped = this.transformData(this.roleTemplateCrudRows);
    const templateMasterByNorm = new Map<string, MasterPermission>();
    for (const m of templateGrouped) {
      const mn = this.normalizar(m.masterPermissionName || '');
      if (mn) templateMasterByNorm.set(mn, m);
    }

    return grouped.map((master) => {
      const mn = this.normalizar(master.masterPermissionName || '');
      const tMaster = templateMasterByNorm.get(mn);
      if (!tMaster) return master;

      const existingNorms = new Set(
        (master.details || []).map((d) => this.normalizar(d.detailedPermissionName || ''))
      );

      const missingDetails: DetailedPermission[] = [];
      for (const tDetail of tMaster.details || []) {
        const dn = this.normalizar(tDetail.detailedPermissionName || '');
        if (existingNorms.has(dn)) continue;
        missingDetails.push({
          detailedPermissionName: tDetail.detailedPermissionName,
          detailedRead: false,
          subdetails: (tDetail.subdetails || []).map((sd) => ({
            subdetailedPermissionName: sd.subdetailedPermissionName,
            principal: sd.principal
              ? { ...sd.principal, canRead: false, canCreate: false, canUpdate: false, canDelete: false }
              : null,
            children: (sd.children || []).map((c) => ({
              ...c,
              canRead: false,
              canCreate: false,
              canUpdate: false,
              canDelete: false,
            })),
          })),
        });
      }
      if (missingDetails.length === 0) return master;
      return { ...master, details: [...(master.details || []), ...missingDetails] };
    });
  }

  private rebuildGroupedPermissionsFromRaw(): void {
    let next = this.transformData(this.rawData);
    this.unionModalSidebarUniverseFromGrouped(next);
    next = this.mergeCatalogMastersIntoGrouped(next);
    next = this.dedupeGenericComprasWhenComprasDelisonPresent(next);
    next = this.filterDetailsToRoleTemplateUniverse(next);
    next = this.hydrateDetailCardsFromRoleTemplate(next);
    next = this.hydrateMissingSubdetailsFromRoleTemplate(next);
    this.groupedPermissions = next;
  }

  checkForChanges() {
    const scope: PermissionsScope = this.scopeInput ?? 'userSystem';
    // En modo "position" NO debe tocar permisos maestros (UserSystemPermissions).
    // Solo consideramos cambios de CRUD.
    // Si se pre-cargó desde plantilla, consideramos siempre hay cambios pendientes (la plantilla
    // aún no fue guardada para este usuario).
    this.notSavedChanges =
      this.isSeededFromTemplate ||
      (scope === 'userSystem' ? this.areUserSystemPermissionsDirty() : false) ||
      this.hasNonUserSysCrudDirty();
  }

  revertChanges() {
    this.rebuildGroupedPermissionsFromRaw();
    this.userSystemPermissionIds = [...this.userSystemPermissionIdsBaseline];
    this.syncReadFlagsFromUserSystemPermissions();
    this.syncMasterLeftSwitchesFromUserSys();
    this.captureMasterReadBaseline();
    this.notSavedChanges = false;
    this.masterSeleccionado = null;
    this.detailSeleccionado = null;
  }

  onMasterReadChange(master: MasterPermission) {
    alerts.userPermissionToggleNotice(master.masterPermissionName, master.masterRead);
    // En modo por posición, los switches del sidebar izquierdo NO deben sincronizarse con permisos maestros.
    // Solo afectan el CRUD local.
    if ((this.scopeInput ?? 'userSystem') === 'position') {
      if (master.masterRead) {
        // Encender: activa lectura + CRUD (C/U/D) en todos los permisos del master
        for (const detail of master.details) {
          detail.detailedRead = true;
          for (const sd of detail.subdetails) {
            if (sd.principal) {
              sd.principal.canRead = true;
              sd.principal.canCreate = true;
              sd.principal.canUpdate = true;
              sd.principal.canDelete = true;
            }
            for (const child of sd.children) {
              child.canRead = true;
              child.canCreate = true;
              child.canUpdate = true;
              child.canDelete = true;
            }
          }
        }
      } else {
        // Apagar: limpia lectura + CRUD
        for (const detail of master.details) {
          detail.detailedRead = false;
        }
        this.zeroCrudReadsForMaster(master);
      }
      this.recomputeReadsFromCrud();
      this.checkForChanges();
      return;
    }

    const masterToggleId = this.getCatalogDetailedIdForMasterToggle(master.masterPermissionName);
    // Almacenes (homónimo): al encender el maestro izquierdo, encender todas las tarjetas del panel derecho
    // y los ids de usuario; al apagar, solo el homónimo (comportamiento previo).
    if (this.isAlmacenesHomonymLeftSwitchMode(master)) {
      if (master.masterRead) {
        this.applyMasterOnCascade(master);
        if (masterToggleId != null && !this.userSystemPermissionIds.includes(masterToggleId)) {
          this.userSystemPermissionIds = [...this.userSystemPermissionIds, masterToggleId];
        }
        this.syncReadFlagsFromUserSystemPermissions();
        this.syncMasterLeftSwitchesFromUserSys();
        this.seleccionarMaster(master);
      } else {
        // Antes solo se quitaba el id homónimo; las tarjetas del panel derecho seguían encendidas.
        this.applyMasterOffCascade(master);
        this.syncMasterLeftSwitchesFromUserSys();
      }
      this.checkForChanges();
      return;
    }
    // Configuración se gobierna por las tarjetas Sucursales / Usuarios / Departamentos (no solo el homónimo).
    if (masterToggleId != null && !this.isConfiguracionMaster(master)) {
      this.applyUserSystemPermissionLocal(masterToggleId, master.masterRead, () => {
        if (master.masterRead) {
          this.seleccionarMaster(master);
        }
      });
      return;
    }

    if (master.masterRead) {
      this.applyMasterOnCascade(master);
      this.seleccionarMaster(master);
    } else {
      this.applyMasterOffCascade(master);
    }
    this.checkForChanges();
  }

  onDetailedReadChange(detail: DetailedPermission) {
    // En modo por posición, el switch de detalle solo gobierna CRUD (no UserSystem).
    if ((this.scopeInput ?? 'userSystem') === 'position') {
      if (!detail.detailedRead) {
        for (const sd of detail.subdetails) {
          if (sd.principal) {
            sd.principal.canRead = false;
            sd.principal.canCreate = false;
            sd.principal.canUpdate = false;
            sd.principal.canDelete = false;
          }
          for (const child of sd.children) {
            child.canRead = false;
            child.canCreate = false;
            child.canUpdate = false;
            child.canDelete = false;
          }
        }
      } else {
        for (const sd of detail.subdetails) {
          if (sd.principal) {
            sd.principal.canRead = true;
            sd.principal.canCreate = true;
            sd.principal.canUpdate = true;
            sd.principal.canDelete = true;
          }
          for (const child of sd.children) {
            child.canRead = true;
            child.canCreate = true;
            child.canUpdate = true;
            child.canDelete = true;
          }
        }
      }
      this.recomputeReadsFromCrud();
      this.checkForChanges();
      return;
    }

    const master = this.findMasterContainingDetail(detail);
    if (master && this.detailHasMultiplePrincipalSections(detail)) {
      if (detail.detailedRead) {
        const canonical = this.getDetailedPermissionIdForDetail(detail);
        if (canonical != null && !this.userSystemPermissionIds.includes(canonical)) {
          this.userSystemPermissionIds = [...this.userSystemPermissionIds, canonical];
        }
        this.seleccionarDetail(detail);
      } else {
        for (const sd of detail.subdetails) {
          if (sd.principal) {
            sd.principal.canRead = false;
            sd.principal.canCreate = false;
            sd.principal.canUpdate = false;
            sd.principal.canDelete = false;
          }
        }
        if (master && this.isUsuariosConfigDetail(master, detail)) {
          for (const sd of detail.subdetails) {
            if (!this.isEmpresasOrSucursalesSetupSubdetail(sd)) {
              continue;
            }
            const sid = this.getCatalogDetailedIdFromSetupUsuariosPermission(sd.subdetailedPermissionName);
            if (sid != null) {
              const idx = this.userSystemPermissionIds.indexOf(sid);
              if (idx !== -1) {
                this.userSystemPermissionIds.splice(idx, 1);
              }
            }
          }
        }
        this.reconcileCanonicalUserSystemForMultiPrincipalDetail(detail);
      }
      this.syncReadFlagsFromUserSystemPermissions();
      this.syncMasterLeftSwitchesFromUserSys();
      this.checkForChanges();
      return;
    }

    const id = this.getDetailedPermissionIdForDetail(detail);
    if (id == null) {
      if (detail.detailedRead) {
        this.seleccionarDetail(detail);
      }
      this.checkForChanges();
      return;
    }
    this.applyUserSystemPermissionLocal(id, detail.detailedRead, () => {
      if (detail.detailedRead) {
        this.seleccionarDetail(detail);
        detail.subdetails.forEach((sd) => {
          if (sd.principal?.canRead) {
            sd.principal.canCreate = true;
            sd.principal.canUpdate = true;
            sd.principal.canDelete = true;
          }
        });
      }
    });
  }

  onCrudChange(permission: CrudPermission) {
    this.propagarActivacionCrudTrasLectura(permission);
    this.checkForChanges();
  }

  onSwitchChange(permission: CrudPermission) {
    // El switch solo controla canRead, no toca canCreate/canUpdate/canDelete
    this.checkForChanges();
  }

  async saveDetailChanges() {
    const scope: PermissionsScope = this.scopeInput ?? 'userSystem';
    const roleTemplateOnly = this.roleTemplateOnlyInput === true;
    if (!roleTemplateOnly && this.isTransientUserId(this.userId)) {
      alerts.basicAlert(
        'Usuario pendiente de guardar',
        'Guarda primero el usuario en la tabla principal; después podrás persistir los permisos por departamento y posición.',
        'info'
      );
      return;
    }
    const persistedUserId = Number(this.userId);
    // Si se pre-cargó desde plantilla (usuario sin permisos previos), forzar guardado completo
    // aunque los checks de dirty devuelvan false (plantilla == baseline artificialmente igualados).
    const forceFromTemplate = this.isSeededFromTemplate;
    const userSysDirty = forceFromTemplate
      ? (scope === 'userSystem' && this.userSystemPermissionIds.length > 0)
      : (scope === 'userSystem' ? this.areUserSystemPermissionsDirty() : false);
    const crudDirty = forceFromTemplate ? true : this.hasNonUserSysCrudDirty();

    if (!userSysDirty && !crudDirty) {
      alerts.userBasicAlert('Sin cambios', 'No hay cambios para guardar.', 'info');
      return;
    }

    const requests: Observable<any>[] = [];

    if (userSysDirty) {
      requests.push(
        this.systemPermissionsService.updateUserPermissions(persistedUserId, [...this.userSystemPermissionIds])
      );
    }

    if (crudDirty) {
      if (roleTemplateOnly) {
        const modifiedPermissions = this.untransformTemplateDirtyOnly(this.groupedPermissions);
        if (modifiedPermissions.length === 0) {
          alerts.userBasicAlert('Sin cambios', 'No hay cambios para guardar.', 'info');
          return;
        }
        const changesMap = new Map<string, RolesxDetailedPermission>();
        for (const perm of modifiedPermissions) {
          const uniqueKey = `${perm.idDetailedPermission}-${perm.idShowPermition}`;
          if (!changesMap.has(uniqueKey)) {
            changesMap.set(uniqueKey, {
              idMasterPermission: perm.idMasterPermission,
              aplica: perm.aplica,
              masterRead: perm.masterRead,
              idDetailedPermission: perm.idDetailedPermission,
              detailedRead: perm.detailedRead,
              subdetailedPermissionName: perm.name,
              idShowPermition: perm.idShowPermition,
              idRole: this.idRole,
              idPosicion: this.idPosicion,
              canCreate: perm.canCreate,
              canRead: perm.canRead,
              canUpdate: perm.canUpdate,
              canDelete: perm.canDelete,
              active: perm.active ?? true,
            });
          }
        }
        for (const payload of changesMap.values()) {
          requests.push(this.rolesService.addDetailedPermissionsxRoles(payload));
        }
      } else {
        const modifiedPermissions = this.untransformData(this.groupedPermissions);
        const changesMap = new Map<string, any>();
        for (const perm of modifiedPermissions) {
          const uniqueKey = `${perm.idDetailedPermission}-${perm.idShowPermition}`;
          if (!changesMap.has(uniqueKey)) {
            const payload: CrudxDetailedPermission = {
              idUser: persistedUserId,
              idBranch: this.branchId,
              idMasterPermission: perm.idMasterPermission,
              aplica: perm.aplica,
              masterRead: perm.masterRead,
              idDetailedPermission: perm.idDetailedPermission,
              detailedRead: perm.detailedRead,
              subdetailedPermissionName: perm.name,
              idShowPermition: perm.idShowPermition,
              idRole: this.idRole,
              idPosicion: this.idPosicion,
              canCreate: perm.canCreate,
              canRead: perm.canRead,
              canUpdate: perm.canUpdate,
              canDelete: perm.canDelete,
              active: perm.active ?? true,
            };
            changesMap.set(uniqueKey, payload);
          }
        }
        for (const payload of changesMap.values()) {
          requests.push(this.permitionsService.addPermitions(payload));
        }
      }
    }

    try {
      alerts.showLoading('Guardando permisos', 'Cargando permisos...');
      await lastValueFrom(forkJoin(requests));
      alerts.closeLoading();

      const sameSessionUser = scope === 'userSystem' && this.isEditingSessionUser();
      const needsModalReload = crudDirty || userSysDirty;

      if (userSysDirty) {
        this.userSystemPermissionIdsBaseline = [...this.userSystemPermissionIds];
        this.trackingService.addLog(
          this.trackingService.getnameComp(),
          'Update UserSystemPermissions (modal usuarios)',
          'Menu Administracion Permisos Maestros',
          this.trackingService.getEmail()
        );
      }

      if (crudDirty) {
        this.trackingService.addLog(
          this.trackingService.getnameComp(),
          roleTemplateOnly
            ? 'Update plantilla RolesxDetailedPermission (modal Departamento)'
            : 'Update/Add Registros en Detalle de Roles',
          'Menu Administracion Detalle de Roles',
          this.trackingService.getEmail()
        );
      }

      // Recargar primero el árbol del modal para que la UI coincida con BD antes de la alerta
      // y antes de bump/reload de sesión (evita parpadeo «todo apagado» con el aviso encima).
      if (needsModalReload) {
        await new Promise<void>((resolve) => {
          this.obtenerDatos(this.idCompany, this.userId, this.branchId, this.idRole, this.idPosicion, {
            preserveUiSelection: true,
            onComplete: () => resolve(),
          });
        });
      }

      // Menú lateral / guards: tras tener el modal al día; reload agresivo de sesión
      if (scope === 'userSystem' && sameSessionUser && Number.isFinite(Number(this.branchId)) && Number(this.branchId) !== 0) {
        try {
          console.log('🔄 Forzando reload de permisos...');
          await lastValueFrom(
            this.authService.forceReloadPermissions({
              idBranchOverride: this.branchId,
              ...(userSysDirty ? { preferUserSystemGuard: true as const } : {}),
            })
          );
          console.log('✅ Reload completado');
        } catch (err) {
          console.error(
            'Error al actualizar permisos del menú lateral tras guardar',
            err
          );
        }
      } else if (userSysDirty) {
        this.signalsService.bumpGuardRefreshTick();
      }

      alerts.userSaveSuccessToast('Permisos guardados', 'Los permisos se han guardado correctamente.');
      this.notSavedChanges = false;
      this.isSeededFromTemplate = false; // ya guardado, dejar de forzar el save
      if (!crudDirty) {
        this.captureMasterReadBaseline();
      }
    } catch (error) {
      alerts.closeLoading();
      console.error('Error al guardar los permisos:', error);
      alerts.userSaveErrorToast('Error', 'Ocurrió un error al guardar los datos.');
    }
  }

  private untransformData(data: MasterPermission[]): any[] {
    const modifiedList = [];

    data.forEach(master => {
      master.details.forEach(detail => {
        detail.subdetails.forEach(subdetail => {
          const allPermissions = [];
          if (subdetail.principal) allPermissions.push(subdetail.principal);
          allPermissions.push(...subdetail.children);
          allPermissions.forEach(permission => {
            const applies = master.aplica !== false;
            modifiedList.push({
              ...permission,
              aplica: applies,
              masterRead: applies ? master.masterRead : false,
              detailedRead: applies ? detail.detailedRead : false,
              canRead: applies ? permission.canRead : false,
              canCreate: applies ? permission.canCreate : false,
              canUpdate: applies ? permission.canUpdate : false,
              canDelete: applies ? permission.canDelete : false
            });
          });
        });
      });
    });

    return modifiedList;
  }

  /** Igual que `rolesDelison-detailed`: solo filas realmente distintas del `__original` (plantilla por rol/posición). */
  private untransformTemplateDirtyOnly(data: MasterPermission[]): any[] {
    const modifiedList: any[] = [];
    data.forEach((master) => {
      master.details.forEach((detail) => {
        detail.subdetails.forEach((subdetail) => {
          const allPermissions: CrudPermission[] = [];
          if (subdetail.principal) allPermissions.push(subdetail.principal);
          allPermissions.push(...subdetail.children);
          allPermissions.forEach((permission) => {
            const original = permission.__original;
            const applies = master.aplica !== false;
            const isModified =
              original &&
              (original.aplica !== applies ||
                original.masterRead !== (applies ? master.masterRead : false) ||
                original.detailedRead !== (applies ? detail.detailedRead : false) ||
                original.canRead !== (applies ? permission.canRead : false) ||
                original.canCreate !== (applies ? permission.canCreate : false) ||
                original.canUpdate !== (applies ? permission.canUpdate : false) ||
                original.canDelete !== (applies ? permission.canDelete : false) ||
                original.active !== permission.active);
            const hasAnyPermission =
              applies &&
              (master.masterRead ||
                detail.detailedRead ||
                permission.canRead ||
                permission.canCreate ||
                permission.canUpdate ||
                permission.canDelete);
            const isNewAndHasPermissions = original && !original.id && hasAnyPermission;
            if (isModified || isNewAndHasPermissions) {
              modifiedList.push({
                ...permission,
                aplica: applies,
                masterRead: applies ? master.masterRead : false,
                detailedRead: applies ? detail.detailedRead : false,
                canRead: applies ? permission.canRead : false,
                canCreate: applies ? permission.canCreate : false,
                canUpdate: applies ? permission.canUpdate : false,
                canDelete: applies ? permission.canDelete : false,
              });
            }
          });
        });
      });
    });
    return modifiedList;
  }
}
