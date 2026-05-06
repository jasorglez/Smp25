
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { RouterModule, Routes } from '@angular/router';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

export const sharedRoutes: Routes = [
  /* { 
    path: 'conventions', 
    loadComponent: () => import('../domains/ModProjects/components/projects/conventions/conventions.component').then(a => a.ConventionsComponent)
  } */
  {
    path: 'doc',
    loadComponent: () => import('../domains/shared/components/public-doc-viewer/public-doc-viewer.component').then(m => m.PublicDocViewerComponent)
  },
  {
    path: 'registrocursos',
    loadComponent: () => import('../public/registro-cursos/registro-cursos.component').then(m => m.RegistroCursosComponent)
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
