import { CommonModule } from '@angular/common';
import { Component, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MaterialsService } from 'app/services/materials.service';
import { SignalsService } from 'app/services/signals.service';
import { SubcontractorContextService } from 'app/services/subcontractor-context.service';

@Component({ selector: 'app-subcontractors', standalone: true, imports: [CommonModule, FormsModule, RouterModule], templateUrl: './subcontractors.component.html', styleUrl: './subcontractors.component.scss' })
export class SubcontractorsComponent {
  private materials = inject(MaterialsService);
  private signals = inject(SignalsService);
  context = inject(SubcontractorContextService);
  providers: any[] = [];
  selectedId: number | null = this.context.selected()?.id || null;

  constructor() {
    effect(() => {
      const root = Number(this.signals.getRootSelectedBySidebar()()) || 0;
      if (root) this.materials.getProvidersxmaterials(root).subscribe({ next: (data: any) => this.providers = data || [], error: () => this.providers = [] });
    });
  }
  selectProvider(id: number | null) {
    this.selectedId = id;
    const provider = this.providers.find(x => Number(x.id) === Number(id));
    if (provider) this.context.set(provider); else this.context.clear();
  }
}
