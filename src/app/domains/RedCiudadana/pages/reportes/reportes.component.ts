import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { RedMiembrosService } from 'app/services/red-miembros.service';
import { SignalsService } from 'app/services/signals.service';
import { IRedMiembro } from 'app/interface/ired-miembro';

interface Stat { label: string; total: number; afiliados: number; pct: number; }

@Component({
  selector: 'app-red-reportes',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './reportes.component.html',
  styleUrl: './reportes.component.scss',
})
export class RedReportesComponent implements OnInit {
  private redService     = inject(RedMiembrosService);
  private signalsService = inject(SignalsService);

  isLoading = false;
  miembros: IRedMiembro[] = [];

  get total()          { return this.miembros.length; }
  get totalAfiliados() { return this.miembros.filter(m => m.afiliado).length; }
  get pctAfiliacion()  { return this.total ? Math.round(this.totalAfiliados / this.total * 100) : 0; }

  get porEstado(): Stat[] {
    const map = new Map<string, { total: number; afiliados: number }>();
    for (const m of this.miembros) {
      const key = m.estado?.trim() || '(Sin estado)';
      const entry = map.get(key) ?? { total: 0, afiliados: 0 };
      entry.total++;
      if (m.afiliado) entry.afiliados++;
      map.set(key, entry);
    }
    return Array.from(map.entries())
      .map(([label, v]) => ({ label, ...v, pct: Math.round(v.afiliados / v.total * 100) }))
      .sort((a, b) => b.total - a.total);
  }

  get porMunicipio(): Stat[] {
    const map = new Map<string, { total: number; afiliados: number }>();
    for (const m of this.miembros) {
      const key = m.municipio?.trim() || '(Sin municipio)';
      const entry = map.get(key) ?? { total: 0, afiliados: 0 };
      entry.total++;
      if (m.afiliado) entry.afiliados++;
      map.set(key, entry);
    }
    return Array.from(map.entries())
      .map(([label, v]) => ({ label, ...v, pct: Math.round(v.afiliados / v.total * 100) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }

  ngOnInit() {
    const idRoot = this.signalsService.getRootSelectedBySidebar()();
    this.isLoading = true;
    this.redService.getByRoot(idRoot).subscribe({
      next:  (data) => { this.miembros = data; this.isLoading = false; },
      error: ()     => { this.isLoading = false; }
    });
  }
}
