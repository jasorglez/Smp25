import { Component, effect, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgApexchartsModule } from 'ng-apexcharts';
import { ProspectosService, ESTADOS_PROSPECTO } from 'app/services/prospectos.service';
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

  tab: 'pos' | 'crm' = 'crm';
  idCompany = 0;
  cargando  = false;

  kpis: KpiCrm[] = [];

  // Prospectos por etapa para el mini-funnel
  etapas = ESTADOS_PROSPECTO.filter(e => !['ganado','perdido'].includes(e.value));
  conteoPorEtapa: Record<string, number> = {};

  // Seguimientos vencidos hoy
  vencidosHoy: any[] = [];
  demosHoy:    any[] = [];

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
