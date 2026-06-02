import { Component, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProspectosService, Prospecto, ESTADOS_PROSPECTO } from 'app/services/prospectos.service';
import { SignalsService } from 'app/services/signals.service';
import { Timestamp } from '@angular/fire/firestore';

@Component({
  selector: 'app-kanban-prospectos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './kanban-prospectos.component.html',
  styleUrls: ['./kanban-prospectos.component.scss'],
})
export class KanbanProspectosComponent {
  private svc        = inject(ProspectosService);
  private signalsSvc = inject(SignalsService);

  readonly etapas = ESTADOS_PROSPECTO;
  prospectos: Prospecto[] = [];
  idCompany = 0;
  cargando  = false;

  // Prospecto seleccionado para detalle/mover
  selected: Prospecto | null = null;
  mostrarDetalle = false;

  // Filtro rápido
  filtroVendedor = '';
  filtroGiro     = '';

  constructor() {
    effect(() => {
      this.idCompany = this.signalsSvc.getRootSelectedBySidebar()() ?? 0;
      if (this.idCompany) this.cargar();
    });
  }

  cargar() {
    this.cargando = true;
    this.svc.getProspectosByCompany(this.idCompany).subscribe({
      next: (data) => { this.prospectos = data; this.cargando = false; },
      error: () => { this.cargando = false; }
    });
  }

  prospectosPorEtapa(etapa: string): Prospecto[] {
    return this.prospectos.filter(p => {
      const estadoOk = p.estado === etapa;
      const vendOk   = !this.filtroVendedor || (p.nombreVendedorActual ?? '').toLowerCase().includes(this.filtroVendedor.toLowerCase());
      const giroOk   = !this.filtroGiro || (p.giro ?? '') === this.filtroGiro;
      return estadoOk && vendOk && giroOk;
    });
  }

  countEtapa(etapa: string): number {
    return this.prospectos.filter(p => p.estado === etapa).length;
  }

  seleccionar(p: Prospecto) {
    this.selected      = { ...p };
    this.mostrarDetalle = true;
  }

  cerrarDetalle() {
    this.selected      = null;
    this.mostrarDetalle = false;
  }

  async moverA(nuevoEstado: string) {
    if (!this.selected?.id) return;
    await this.svc.cambiarEstado(
      this.selected.id, nuevoEstado,
      this.signalsSvc.idUser() ?? 0,
      this.signalsSvc.getDisplayName()() ?? ''
    );
    this.cerrarDetalle();
  }

  formatFecha(v: any): string {
    if (!v) return '';
    const d = v?.toDate ? v.toDate() : new Date(v);
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: '2-digit' });
  }

  estaVencido(v: any): boolean {
    if (!v) return false;
    const d = v?.toDate ? v.toDate() : new Date(v);
    return d < new Date();
  }

  getEtapa(value: string) {
    return ESTADOS_PROSPECTO.find(e => e.value === value);
  }

  vendedoresUnicos(): string[] {
    return [...new Set(this.prospectos.map(p => p.nombreVendedorActual).filter(Boolean))];
  }

  girosUnicos(): string[] {
    return [...new Set(this.prospectos.map(p => p.giro ?? '').filter(Boolean))];
  }

  // Etapas a las que se puede mover (excluyendo la actual)
  etapasSiguientes(): typeof ESTADOS_PROSPECTO {
    return ESTADOS_PROSPECTO.filter(e => e.value !== this.selected?.estado);
  }
}
