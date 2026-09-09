import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { SubcontractorContextService } from 'app/services/subcontractor-context.service';

@Component({ selector: 'app-subcontractor-workflow', standalone: true, imports: [CommonModule, RouterModule], templateUrl: './subcontractor-workflow.component.html', styleUrl: './subcontractors.component.scss' })
export class SubcontractorWorkflowComponent {
  context = inject(SubcontractorContextService);
  private route = inject(ActivatedRoute);
  title = this.route.snapshot.data['title'] || 'Subcontratistas';
  icon = this.route.snapshot.data['icon'] || 'bi-folder';
}
