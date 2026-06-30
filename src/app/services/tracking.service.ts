import { inject, Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { BehaviorSubject, map } from 'rxjs';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ApiResponse, sanitizeUserData } from 'app/interface/safe-user.interface';

@Injectable({
  providedIn: 'root',
})
export class TrackingService {
  private http = inject(HttpClient);

  private currentProject  = new BehaviorSubject<string>('');
  private emailser        : string = '';
  private namecomp        : string = '';
  private picturecomp     : string = '';
  private picturecomp2    : string = '';
  private picturecomp3    : string = '';
  private fri             : string = '';
  private nameuser        : string = '';
  private pictureuser     : string = '';
  private projectser      : string = '';
  private branchser       : string = '';
  private companyser      : string = '';
  private contract        : string = '';
  private nameproject     : string = '';
  private ubicationproject: string = '';
  private startproject    : string = '';
  private endproject      : string = '';
  public ultimaventana    : string = '';
  public idEmp            : number = 0;
  private fecha           : Date = new Date('2024-01-01');
  private numRes          : string = '';
  private comment         : string = '';
  private idNumSap        : number = 0;
  private cpser           : number = 0;
  private platformser     : number = 0;
  private plataforma      : string = '';
  private platform        : number = 0;
  private numprov         : number = 0;
  private aproject        : string = '';
  private abranch         : string = '';
  private aplatform       : string = '';
  private emailprofile    : string = '';
  private bandform        : string = '';
  private bandformEO      : string = '';
  private idUser          : number = 0;

  // ── Session tracking ──────────────────────────────────────────────────────
  private sessionKey     : string | null = null;
  private sessionModules : string[]      = [];
  private sessionStart   : Date   | null = null;

  private readonly TG_BOT  = '7641233303:AAGlG7PvRq1gOtc_eUtHfUIbayKnsiI_yiI';
  private readonly TG_CHAT = '558058395';

  setId(idUser: number): void {
    this.idUser = idUser;
  }

  getId(): number {
    return this.idUser ;
  }

  public getAuthToken(): string {
    return localStorage.getItem('token') || '';
  }

  setEmail(email: string): void {
    this.emailser = email;
    localStorage.setItem('mail', this.emailser);
  }

  getEmail(): string {
    if (!this.emailser) {
      const storedEmail = localStorage.getItem('mail');
      this.emailser = storedEmail !== null ? storedEmail : '';
    }
    return this.emailser;
  }

  // DATOS DE LA COMPANIA
  setnameComp(namecomp: string): void {
    this.namecomp = namecomp;
  }

  getnameComp(): string {
    return this.namecomp;
  }

  setpictureComp(picturecomp: string): void {
    this.picturecomp = picturecomp;
  }

  setPictureComp2(picturecomp2: string): void {
    this.picturecomp2 = picturecomp2;
  }

  setPictureComp3(picturecomp3: string): void {
    this.picturecomp3 = picturecomp3;
  }

  getpictureComp(): string {
    return this.picturecomp;
  }

  getPictureComp2(): string {
    return this.picturecomp2;
  }

  getPictureComp3(): string {
    return this.picturecomp3;
  }

  // TERMINO DE LA CIA

  setformatrepint(fri: string): void {
    this.fri = fri;
  }

  getformrepint(): string {
    return this.fri;
  }

  setnameUser(name: string): void {
    this.nameuser = name;
  }

  getnameUser(): string {
    return this.nameuser;
  }

  setpictureUser(picture: string): void {
    this.pictureuser = picture;
  }

  getpictureUser(): string {
    return this.pictureuser;
  }

  setProject(project: string): void {
    this.projectser = project;
    localStorage.setItem('project', this.projectser);
  }

  getProject(): string {
    return this.projectser;
  }

  setBranch(branch: string): void {
    this.branchser = branch;
    localStorage.setItem('branch', this.branchser);
  }

  getBranch(): string {
    if (!this.branchser) {
      const storedBranch = localStorage.getItem('branch');
      this.branchser = storedBranch !== null ? storedBranch : '';
    }
    return this.branchser;
  }

  setCompany(company: string): void {
    this.companyser = company;
    localStorage.setItem('company', this.companyser);
  }

  getCompany(): string {
    return this.companyser;
  }

  setContract(contract: string): void {
    this.contract = contract;
  }

  getContract(): string {
    return this.contract;
  }

  setnameProject(name: string): void {
    this.nameproject = name;
  }

  getnameProject(): string {
    return this.nameproject;
  }

  setubicationProject(ubication: string): void {
    this.ubicationproject = ubication;
  }

  getubicationProject(): string {
    return this.ubicationproject;
  }

  setStart(start: string): void {
    this.startproject = start;
  }

  getStart(): string {
    return this.startproject;
  }

  setEnd(end: string): void {
    this.endproject = end;
  }

  getEnd(): string {
    return this.endproject;
  }

  setultimaVentana(ultven: string): void {
    this.ultimaventana = ultven;
  }

  getultimaVentana(): string {
    return this.ultimaventana;
  }

  setidEmp(ne: number): void {
    this.idEmp = ne;
  }

  getidEmp(): number {
    return this.idEmp;
  }

  setfecha(fec: Date): void {
    this.fecha = fec;
  }

  getFecha(): Date {
    return this.fecha;
  }

  setnumRes(nr: string): void {
    this.numRes = nr;
  }

  getnumRes(): string {
    return this.numRes;
  }

  setCommen(co: string): void {
    this.comment = co;
  }

  getCom(): string {
    return this.comment;
  }

  setidnumsap(id: number): void {
    this.idNumSap = id;
  }

  getidNumSap(): number {
    return this.idNumSap;
  }

  setCp(cp: number): void {
    this.cpser = cp;
  }

  getCp(): number {
    return this.cpser;
  }

  setPlatform(pl: number): void {
    this.platformser = pl;
  }

  getPlat(): number {
    return this.platformser;
  }

  setPlataforma(p2: string): void {
    this.plataforma = p2;
  }

  getPlataforma(): string {
    return this.plataforma;
  }

  setIdPlatform(p2: number): void {
    this.platform = p2;
  }

  getIdPlatform(): number {
    return this.platform;
  }

  setnumpro(n: number): void {
    this.numprov = n;
  }

  getnumpro(): number {
    return this.numprov;
  }

  setaproject(ap: string): void {
    this.aproject = ap;
  }

  getaproject(): string {
    return this.aproject;
  }

  setabranch(ab: string): void {
    this.abranch = ab;
  }

  getabranch(): string {
    return this.abranch;
  }

  setaplatform(apl: string): void {
    this.aplatform = apl;
  }

  getaplat(): string {
    return this.aplatform;
  }

  setemailprof(epf: string): void {
    this.emailprofile = epf;
  }

  getemailprof(): string {
    return this.emailprofile;
  }

  setbandform(bandform: string): void {
    this.bandform = bandform;
  }

  getbandform(): string {
    return this.bandform;
  }

  setbandformEO(bandformEO: string): void {
    this.bandformEO = bandformEO;
  }

  getbandformEO(): string {
    return this.bandformEO;
  }

  changeProject(project: string): void {
    this.currentProject.next(project);
  }

  /*=============================================
  Guardar información de la
  =============================================*/
  async addLog(company: string, description: string, origin: string,  user: string  ) {
    // Obtener la fecha actual
    const datetime = new Date();

if (!user) user = this.getEmail();

    const data = {
      company,
      datetime,
      origin,
      description,
      user,
      idn: 0,
    };

    

    try {
      const response: any = await this.http
        .get(
          `${environment.urlFirebase}tracking.json?orderBy="$key"&limitToLast=1`
        )
        .toPromise();

      const lastLogId = Object.keys(response)[0]; // Obtener la clave del último registro
      const lastLog = response[lastLogId] as { idn: number }; // Obtener el último registro completo con la propiedad "id"

      // Asignar el valor de "id" del último registro al nuevo registro
      data['idn'] = lastLog ? lastLog.idn + 1 : 1;

      const postResponse = await this.http
        .post(`${environment.urlFirebase}tracking.json`, data)
        .toPromise();

      /*const postResponseAzu = await this.http
        .post(`${environment.urlAzure}api/Trackings`, data)
        .toPromise();*/

    } catch (error) {
      console.error('Error al crear el log TRACKINGS:', error);
    }

  }

  getDataTracking(valoruser: string) {
    return this.http.get(
      `${environment.urlFirebase}tracking.json?orderBy="user"&equalTo="${valoruser}"&orderBy="$idn"&print=pretty&sortOrder="desc"`
    );
  }

  getTrackingRecordsByUser(user: string) {
    const url = `${environment.urlFirebase}tracking.json`;
    

    return this.http.get(url).pipe(
      map((response: any) => {        
        
        // Ordenar los registros por el campo "idn" en forma ascendente
        const sortedRecords = Object.values(response).sort(
          (a: any, b: any) => a.idn - b.idn
        );

        // Invertir el orden de los registros para que los últimos aparezcan primero
        const reversedRecords = sortedRecords.reverse();

        // Tomar solo los primeros 5000 registros (los más recientes)
        const limitedRecords = reversedRecords.slice(0, 5000);

        return limitedRecords;
      })
    );
  }

  getTrackingRecordsByCompany(company: string) {
    const url = `${environment.urlFirebase}tracking.json?orderBy="company"&equalTo="${company}"&orderBy="$idn"&print=pretty&sortOrder="desc"`;
    return this.http.get(url).pipe(
      map((response: any) => {        
        
        // Ordenar los registros por el campo "idn" en forma ascendente
        const sortedRecords = Object.values(response).sort(
          (a: any, b: any) => a.idn - b.idn
        );

        // Invertir el orden de los registros para que los últimos aparezcan primero
        const reversedRecords = sortedRecords.reverse();

        // Tomar solo los primeros 5000 registros (los más recientes)
        const limitedRecords = reversedRecords.slice(0, 5000);

        return limitedRecords;
      })
    );
  }

  getLast500TrackingRecords() {
    const url = `${environment.urlFirebase}tracking.json?orderBy="idn"&limitToLast=500`;
    

    return this.http.get(url).pipe(
      map((response: any) => {
        // Convertir objeto de Firebase en array y ordenar DESC (idn más alto primero)
        const recordsArray = Object.values(response || {});
        return recordsArray.sort((a: any, b: any) => b.idn - a.idn);
      })
    );
}

  getIdUser(email: string) {
    return this.http.get<ApiResponse<any>>(`${environment.urlSecurity}/User/email/${email}`, {
      headers: this.getHeaders(),
    }).pipe(
      map(response => {
        // Limpiar datos sensibles antes de devolver
        const safeData = sanitizeUserData(response.data);
        return { ...response, data: safeData };
      })
    );
  }

  formatearMoneda(valor: number): string {
    const formatter = new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    });
    return formatter.format(valor);
  }

  public getHeaders(): HttpHeaders {
    const token = this.getAuthToken();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    });
  }

  // Módulos de alto valor comercial — cuentan doble para temperatura
  private readonly HOT_MODULES = ['Dashboard', 'Ventas', 'Inventario', 'Reportes', 'Precios', 'Admon', 'RRHH', 'BPI'];

  // ── IP Geolocation ────────────────────────────────────────────────────────
  async getIpInfo(): Promise<{ country: string; countryCode: string; city: string; ip: string }> {
    try {
      const res: any = await this.http
        .get('https://ip-api.com/json/?fields=status,country,countryCode,city,query')
        .toPromise();
      if (res?.status === 'success') {
        return { country: res.country, countryCode: res.countryCode, city: res.city, ip: res.query };
      }
    } catch {}
    return { country: 'Desconocido', countryCode: '', city: 'Desconocido', ip: '' };
  }

  // ── Contar visitas previas del mismo email ────────────────────────────────
  private async countPriorSessions(email: string): Promise<number> {
    try {
      const url = `${environment.urlFirebase}sessions.json?orderBy="email"&equalTo="${email}"`;
      const res: any = await this.http.get(url).toPromise();
      return res ? Object.keys(res).length : 0;
    } catch {
      return 0;
    }
  }

  // ── Clasificar temperatura del prospecto ─────────────────────────────────
  private classifyTemp(min: number, modules: string[], priorVisits: number): string {
    const hotCount = modules.filter(m => this.HOT_MODULES.some(h => m.toLowerCase().includes(h.toLowerCase()))).length;
    const score    = min + hotCount * 2 + priorVisits * 3;
    if (score >= 10 || min >= 5) return 'CALIENTE 🔥';
    if (score >= 4  || min >= 2) return 'TIBIO 🌡️';
    return 'FRÍO 🧊';
  }

  // ── Iniciar sesión (llamar al login exitoso) ───────────────────────────────
  async startSession(idCompany: number, idBranch: number): Promise<void> {
    const email = this.getEmail();
    const [ipInfo, priorVisits] = await Promise.all([
      this.getIpInfo(),
      this.countPriorSessions(email),
    ]);

    this.sessionStart   = new Date();
    this.sessionModules = [];

    const data = {
      email, idCompany, idBranch,
      ip: ipInfo.ip, country: ipInfo.country, countryCode: ipInfo.countryCode, city: ipInfo.city,
      loginTime: this.sessionStart.toISOString(),
      priorVisits,
      modules: [], active: true,
    };

    try {
      const res: any = await this.http
        .post(`${environment.urlFirebase}sessions.json`, data)
        .toPromise();
      this.sessionKey = res?.name ?? null;
    } catch {}

    // Notificar via backend C# (evita CORS de Telegram directo)
    try {
      await this.http.post(`${environment.urlChatBot}/LoginNotification`, {
        idUser    : this.getId(),
        displayName: this.getnameUser() || email,
        email,
        idCompany,
        branch    : `Sucursal ${idBranch}${priorVisits > 0 ? ` | 🔄 Visita #${priorVisits + 1}` : ''}`,
        ipAddress : ipInfo.ip,
      }).toPromise();
    } catch {}
  }

  // ── Registrar módulo visitado (llamar desde TrackingGuard) ─────────────────
  logModuleVisit(module: string): void {
    if (!this.sessionKey || !module || this.sessionModules.includes(module)) return;
    this.sessionModules.push(module);
    this.http
      .patch(`${environment.urlFirebase}sessions/${this.sessionKey}.json`, { modules: this.sessionModules })
      .subscribe();
  }

  // ── Cerrar sesión (llamar en logout y beforeunload) ───────────────────────
  async endSession(): Promise<void> {
    if (!this.sessionKey || !this.sessionStart) return;

    const end      = new Date();
    const ms       = end.getTime() - this.sessionStart.getTime();
    const min      = Math.floor(ms / 60000);
    const sec      = Math.floor((ms % 60000) / 1000);
    const priorKey = this.sessionKey; // guardar antes de limpiar

    // Leer priorVisits del registro actual
    let priorVisits = 0;
    try {
      const rec: any = await this.http
        .get(`${environment.urlFirebase}sessions/${priorKey}.json`)
        .toPromise();
      priorVisits = rec?.priorVisits ?? 0;
    } catch {}

    const temp = this.classifyTemp(min, this.sessionModules, priorVisits);

    try {
      await this.http
        .patch(`${environment.urlFirebase}sessions/${priorKey}.json`, {
          logoutTime: end.toISOString(), durationMin: min, temperatura: temp, active: false,
        })
        .toPromise();
    } catch {}

    const lines     = this.sessionModules.length
      ? this.sessionModules.map(m => `👀 Vio módulo: ${m}`).join('\n')
      : '(no navegó módulos)';
    const timeStr   = `${min}:${String(sec).padStart(2, '0')} min`;
    const emoji     = temp.startsWith('CALIENTE') ? '🚨 PROSPECTO CALIENTE — dar seguimiento hoy' :
                      temp.startsWith('TIBIO')    ? '⚡ Prospecto tibio — enviar info' : '';
    // Notificar via backend C# (evita CORS de Telegram directo)
    try {
      await this.http.post(`${environment.urlChatBot}/LoginNotification/session-end`, {
        email      : this.getEmail(),
        modules    : this.sessionModules,
        durationMin: min,
        durationSec: sec,
        temperatura: temp,
      }).toPromise();
    } catch {}

    this.sessionKey     = null;
    this.sessionStart   = null;
    this.sessionModules = [];
  }

  // ── Payload sincrónico para sendBeacon (cierre de browser) ──────────────
  getSessionEndPayload(): object | null {
    if (!this.sessionStart) return null;
    const ms  = new Date().getTime() - this.sessionStart.getTime();
    const min = Math.floor(ms / 60000);
    const sec = Math.floor((ms % 60000) / 1000);
    return {
      email      : this.getEmail(),
      modules    : [...this.sessionModules],
      durationMin: min,
      durationSec: sec,
      temperatura: this.classifyTemp(min, this.sessionModules, 0),
    };
  }

  clearSession(): void {
    this.sessionKey     = null;
    this.sessionStart   = null;
    this.sessionModules = [];
  }

  private countryFlag(code: string): string {
    if (!code || code.length !== 2) return '📍';
    const o = 127397;
    return String.fromCodePoint(code.charCodeAt(0) + o) + String.fromCodePoint(code.charCodeAt(1) + o);
  }

}
