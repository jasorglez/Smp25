import { Component, effect, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgApexchartsModule } from 'ng-apexcharts';
import { ProspectosService, ESTADOS_PROSPECTO, calcularScore, nivelScore } from 'app/services/prospectos.service';
import { PosService } from 'app/services/pos.service';
import { SignalsService } from 'app/services/signals.service';
import { Timestamp } from '@angular/fire/firestore';
import { PosDashboardComponent } from '../pos-dashboard/pos-dashboard.component';

interface KpiCrm {
  label: string;
  valor: number;
  icon: string;
  color: string;
  tooltip: string;
}

@Component({
  selector: 'app-crm-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, NgApexchartsModule, PosDashboardComponent],
  templateUrl: './crm-dashboard.component.html',
  styleUrls: ['./crm-dashboard.component.scss'],
})
export class CrmDashboardComponent implements OnInit {
  private prospectosSvc = inject(ProspectosService);
  private signalsSvc    = inject(SignalsService);

  tab: 'pos' | 'crm' | 'reportes' = 'crm';
  idCompany = 0;
  cargando  = false;

  kpis: KpiCrm[] = [];
  prospectos: any[] = [];

  // Prospectos por etapa para el mini-funnel
  etapas = ESTADOS_PROSPECTO.filter(e => !['ganado','perdido'].includes(e.value));
  conteoPorEtapa: Record<string, number> = {};

  // Seguimientos vencidos hoy
  vencidosHoy:   any[] = [];
  demosHoy:      any[] = [];
  proximos7dias: any[] = [];

  constructor() {
    effect(() => {
      this.idCompany = this.signalsSvc.getRootSelectedBySidebar()() ?? 0;
      if (this.idCompany) this.cargarCrm();
    });
  }

  ngOnInit() {}

  cargarCrm() {
    if (!this.idCompany) return;
    this.cargando = true;
    this.prospectosSvc.getProspectosByCompany(this.idCompany).subscribe({
      next: (prospectos) => {
        this.calcularKpis(prospectos);
        this.cargando = false;
      },
      error: () => { this.cargando = false; }
    });
  }

  private calcularKpis(prospectos: any[]) {
    this.prospectos = prospectos;
    const hoy    = new Date(); hoy.setHours(0,0,0,0);
    const manana = new Date(hoy); manana.setDate(manana.getDate() + 1);

    const toDate = (v: any): Date | null => {
      if (!v) return null;
      if (v?.toDate) return v.toDate();
      return new Date(v);
    };

    // Conteo por etapa
    this.conteoPorEtapa = {};
    ESTADOS_PROSPECTO.forEach(e => this.conteoPorEtapa[e.value] = 0);
    prospectos.forEach(p => {
      if (this.conteoPorEtapa[p.estado] !== undefined) this.conteoPorEtapa[p.estado]++;
    });

    // KPI: Nuevos hoy
    const nuevosHoy = prospectos.filter(p => {
      const f = toDate(p.fechaCreacion);
      return f && f >= hoy && f < manana;
    }).length;

    // KPI: Seguimientos vencidos (fecha < hoy, no ganado/perdido)
    const activos = prospectos.filter(p => !['ganado','perdido'].includes(p.estado));
    this.vencidosHoy = activos.filter(p => {
      const f = toDate(p.fechaProximoSeguimiento);
      return f && f < hoy;
    });

    // KPI: Demos hoy
    this.demosHoy = prospectos.filter(p => {
      if (p.estado !== 'demo_agendada') return false;
      const f = toDate(p.fechaProximoSeguimiento);
      return f && f >= hoy && f < manana;
    });

    // KPI: Cotizaciones pendientes
    const cotizacionesPendientes = prospectos.filter(p => p.estado === 'cotizacion_enviada').length;

    // KPI: En negociación
    const enNegociacion = prospectos.filter(p => p.estado === 'negociacion').length;

    // Próximos 7 días con seguimiento
    const en7dias = new Date(hoy); en7dias.setDate(en7dias.getDate() + 7);
    this.proximos7dias = prospectos.filter(p => {
      const f = toDate(p.fechaProximoSeguimiento);
      return f && f >= manana && f <= en7dias;
    }).sort((a, b) => {
      const fa = toDate(a.fechaProximoSeguimiento);
      const fb = toDate(b.fechaProximoSeguimiento);
      return (fa?.getTime() ?? 0) - (fb?.getTime() ?? 0);
    });

    this.kpis = [
      {
        label: 'Prospectos nuevos hoy',
        valor: nuevosHoy,
        icon: 'bi-person-plus',
        color: 'bg-primary',
        tooltip: 'Registrados hoy',
      },
      {
        label: 'Seguimientos vencidos',
        valor: this.vencidosHoy.length,
        icon: 'bi-alarm',
        color: this.vencidosHoy.length > 0 ? 'bg-danger' : 'bg-success',
        tooltip: 'Fecha de seguimiento ya pasó',
      },
      {
        label: 'Demos hoy',
        valor: this.demosHoy.length,
        icon: 'bi-camera-video',
        color: this.demosHoy.length > 0 ? 'bg-warning' : 'bg-secondary',
        tooltip: 'Demos agendadas para hoy',
      },
      {
        label: 'Cotizaciones enviadas',
        valor: cotizacionesPendientes,
        icon: 'bi-file-earmark-text',
        color: 'bg-info',
        tooltip: 'Esperando respuesta del cliente',
      },
      {
        label: 'En negociación',
        valor: enNegociacion,
        icon: 'bi-handshake',
        color: 'bg-orange',
        tooltip: 'Comparando opciones',
      },
      {
        label: 'Pipeline activo',
        valor: activos.length,
        icon: 'bi-funnel',
        color: 'bg-dark',
        tooltip: 'Total de prospectos activos',
      },
    ];
  }

  // ── Reportes CRM ──────────────────────────────────────────────────────────

  get tasaCierre(): number {
    const g = this.prospectos.filter(p => p.estado === 'ganado').length;
    const per = this.prospectos.filter(p => p.estado === 'perdido').length;
    return (g + per) > 0 ? Math.round(g / (g + per) * 100) : 0;
  }

  get promInteracciones(): number {
    if (!this.prospectos.length) return 0;
    return Math.round(this.prospectos.reduce((a, p) => a + (p.countInteracciones ?? 0), 0) / this.prospectos.length);
  }

  get sinActividad7(): number {
    const limite = Date.now() - 7 * 86_400_000;
    const activos = this.prospectos.filter(p => !['ganado', 'perdido'].includes(p.estado));
    return activos.filter(p => {
      const ts = p.fechaUltimaInteraccion;
      if (!ts) return true;
      const ms = ts?.toDate ? ts.toDate().getTime() : new Date(ts).getTime();
      return ms < limite;
    }).length;
  }

  get rankingVendedores() {
    const map = new Map<string, { ganados: number; total: number; perdidos: number }>();
    this.prospectos.forEach(p => {
      const v = p.nombreVendedorActual || 'Sin asignar';
      if (!map.has(v)) map.set(v, { ganados: 0, total: 0, perdidos: 0 });
      const e = map.get(v)!;
      e.total++;
      if (p.estado === 'ganado')  e.ganados++;
      if (p.estado === 'perdido') e.perdidos++;
    });
    return [...map.entries()]
      .map(([nombre, d]) => ({
        nombre, total: d.total, ganados: d.ganados, perdidos: d.perdidos,
        tasa: (d.ganados + d.perdidos) > 0 ? Math.round(d.ganados / (d.ganados + d.perdidos) * 100) : 0,
      }))
      .sort((a, b) => b.ganados - a.ganados)
      .slice(0, 8);
  }

  get porGiro() {
    const map = new Map<string, number>();
    this.prospectos.forEach(p => map.set(p.giro || 'Sin giro', (map.get(p.giro || 'Sin giro') ?? 0) + 1));
    const total = this.prospectos.length || 1;
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([giro, count]) => ({ giro, count, pct: Math.round(count / total * 100) }));
  }

  get scoreDistrib() {
    const total = this.prospectos.length || 1;
    const hot  = this.prospectos.filter(p => calcularScore(p) >= 70).length;
    const warm = this.prospectos.filter(p => { const s = calcularScore(p); return s >= 40 && s < 70; }).length;
    const cold = this.prospectos.filter(p => calcularScore(p) < 40).length;
    return [
      { label: '🔥 Hot',  count: hot,  pct: Math.round(hot  / total * 100), color: 'danger'  },
      { label: '👍 Warm', count: warm, pct: Math.round(warm / total * 100), color: 'warning' },
      { label: '❄️ Cold', count: cold, pct: Math.round(cold / total * 100), color: 'info'    },
    ];
  }

  get conversionFunnel() {
    const total = this.prospectos.length || 1;
    return ESTADOS_PROSPECTO.map(e => ({
      ...e,
      count: this.conteoPorEtapa[e.value] || 0,
      pct:   Math.round((this.conteoPorEtapa[e.value] || 0) / total * 100),
    }));
  }

  porcentajeFunnel(etapa: string): number {
    const total = Object.values(this.conteoPorEtapa)
      .filter((_, i) => i < this.etapas.length)
      .reduce((a, b) => a + b, 0);
    if (!total) return 0;
    return Math.round((this.conteoPorEtapa[etapa] || 0) / total * 100);
  }

  getEtapa(value: string) {
    return ESTADOS_PROSPECTO.find(e => e.value === value);
  }

  formatFecha(v: any): string {
    if (!v) return '';
    const d = v?.toDate ? v.toDate() : new Date(v);
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
  }
}
