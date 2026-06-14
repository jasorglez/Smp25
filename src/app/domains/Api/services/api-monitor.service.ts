import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';

export interface ApiResumen {
  totalPeriodo: number;
  totalHoy: number;
  usuariosUnicos: number;
  avgDuracionMs: number;
  errores4xx: number;
  errores5xx: number;
  solicitudesOk: number;
  distribucionMetodos: { metodo: string; total: number }[];
  distribucionStatus: { status: number; total: number }[];
}

export interface ApiPorHora {
  fecha: string;
  hora: number;
  total: number;
  avgMs: number;
  errores: number;
}

export interface ApiTopEndpoint {
  endpoint: string;
  method: string;
  totalLlamadas: number;
  avgMs: number;
  maxMs: number;
  errores: number;
  ultimaVez: string;
}

export interface ApiLogItem {
  id: number;
  fechaHora: string;
  endpoint: string;
  method: string;
  statusCode: number;
  durationMs: number;
  idUser: number | null;
  userEmail: string | null;
  idCompany: number | null;
  microservicio: string | null;
  ipAddress: string | null;
  userAgent: string | null;
}

export interface ApiLogsResponse {
  total: number;
  page: number;
  pageSize: number;
  items: ApiLogItem[];
}

export interface ApiUsuarioActivo {
  idUser: number;
  email: string;
  solicitudes: number;
  ultimaVez: string;
}

export interface LoginLogItem {
  id: number;
  idUser: number;
  displayName: string | null;
  email: string | null;
  idCompany: number | null;
  branch: string | null;
  fechaLogin: string;
}

export interface ServerMetrics {
  cpu:     { usedPct: number };
  ram:     { totalMb: number; usedMb: number; freeMb: number; usedPct: number };
  disks:   { dev: string; mount: string; totalGb: number; usedGb: number; freeGb: number; usedPct: number }[];
  network: { name: string; rxMb: number; txMb: number }[];
  uptime:  { seconds: number; formatted: string };
  load:    { load1: number; load5: number; load15: number };
}

@Injectable({ providedIn: 'root' })
export class ApiMonitorService {
  private http = inject(HttpClient);
  private base = `${environment.urlSecurity}/ApiLog`;

  private buildParams(startDate?: string, endDate?: string): HttpParams {
    let p = new HttpParams();
    if (startDate) p = p.set('startDate', startDate);
    if (endDate)   p = p.set('endDate',   endDate);
    return p;
  }

  getResumen(startDate?: string, endDate?: string): Observable<ApiResumen> {
    return this.http.get<ApiResumen>(`${this.base}/resumen`, { params: this.buildParams(startDate, endDate) });
  }

  getPorHora(startDate?: string, endDate?: string): Observable<ApiPorHora[]> {
    return this.http.get<ApiPorHora[]>(`${this.base}/por-hora`, { params: this.buildParams(startDate, endDate) });
  }

  getTopEndpoints(startDate?: string, endDate?: string, limit = 25): Observable<ApiTopEndpoint[]> {
    const params = this.buildParams(startDate, endDate).set('limit', limit);
    return this.http.get<ApiTopEndpoint[]>(`${this.base}/top-endpoints`, { params });
  }

  getLogs(options: {
    startDate?: string; endDate?: string;
    page?: number; pageSize?: number;
    endpoint?: string; idCompany?: number; email?: string;
    statusCode?: number; method?: string;
  } = {}): Observable<ApiLogsResponse> {
    let p = this.buildParams(options.startDate, options.endDate);
    if (options.page)       p = p.set('page',       options.page);
    if (options.pageSize)   p = p.set('pageSize',   options.pageSize);
    if (options.endpoint)   p = p.set('endpoint',   options.endpoint);
    if (options.idCompany)  p = p.set('idCompany',  options.idCompany);
    if (options.email)      p = p.set('email',       options.email);
    if (options.statusCode) p = p.set('statusCode', options.statusCode);
    if (options.method)     p = p.set('method',     options.method);
    return this.http.get<ApiLogsResponse>(`${this.base}/logs`, { params: p });
  }

  getErrores(startDate?: string, endDate?: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/errores`, { params: this.buildParams(startDate, endDate) });
  }

  getUsuariosActivos(): Observable<ApiUsuarioActivo[]> {
    return this.http.get<ApiUsuarioActivo[]>(`${this.base}/usuarios-activos`);
  }

  getLoginsRecientes(startDate?: string, endDate?: string, limit = 50): Observable<LoginLogItem[]> {
    let p = this.buildParams(startDate, endDate).set('limit', limit);
    return this.http.get<LoginLogItem[]>(`${this.base}/logins-recientes`, { params: p });
  }

  getServerMetrics(): Observable<ServerMetrics> {
    return this.http.get<ServerMetrics>(`${environment.urlSecurity}/ServerMetrics`);
  }
}
