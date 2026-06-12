
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { RouterModule, Routes } from '@angular/router';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

export const sharedRoutes: Routes = [
  { 
    path: 'conventions', 
    loadComponent: () => import('../domains/ModProjects/components/projects/conventions/conventions.component').then(a => a.ConventionsComponent)
  },
  { 
    path: 'advances', 
    loadComponent: () => import('../domains/Indicadores/components/ind01/advances/advances.component').then(a => a.AdvancesComponent)
  },
  { 
    path: 'workprograms',
    loadComponent: () => import('../domains/Indicadores/components/ind01/workprograms/workprograms.component').then(a => a.WorkprogramsComponent)
  }
];

@NgModule({
imports: [
    CommonModule,
    TranslateModule,
    RouterModule,
    MatListModule,
    MatIconModule,
    MatTooltipModule,      
  ],
exports: [
    CommonModule,
    TranslateModule,
    RouterModule,
    MatListModule,
    MatIconModule,
    MatTooltipModule
  ]
})
export class SharedModule {
  static getRoutes(): Routes {
    return sharedRoutes;
  }
}
