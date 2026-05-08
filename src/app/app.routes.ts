import { Routes } from '@angular/router';
import { MainPageComponent } from './pages/main-page/main-page.component';
import { MasterPermissionsGuard } from './guards/master-permissions.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./login/pages/login-page/login-page.component').then(
        (m) => m.LoginPageComponent
      ),
  },
  {
    path: '',
    component: MainPageComponent,
    children: [
      { path: '', redirectTo: '/login', pathMatch: 'full' },
      {
        path: 'home',
        loadComponent: () =>
          import('./domains/RedCiudadana/pages/menu-principal/menu-principal.component').then(
            (m) => m.MenuPrincipalComponent
          ),
        canActivate: [MasterPermissionsGuard],
        data: { permissions: { master: 'red' } },
      },
      {
        path: 'red-ciudadana',
        loadComponent: () =>
          import('./domains/RedCiudadana/pages/red-ciudadana/red-ciudadana.component').then(
            (r) => r.RedCiudadanaComponent
          ),
        canActivate: [MasterPermissionsGuard],
        data: { permissions: { master: 'red' } },
        children: [
          { path: '', redirectTo: 'procesos', pathMatch: 'full' },
          {
            path: 'procesos',
            loadComponent: () =>
              import('./domains/RedCiudadana/pages/procesos/procesos.component').then(
                (p) => p.RedProcesosComponent
              ),
            canActivate: [MasterPermissionsGuard],
            data: { permissions: { master: 'red', detailed: 'procesos' } },
          },
          {
            path: 'reportes',
            loadComponent: () =>
              import('./domains/RedCiudadana/pages/reportes/reportes.component').then(
                (r) => r.RedReportesComponent
              ),
            canActivate: [MasterPermissionsGuard],
            data: { permissions: { master: 'red', detailed: 'reportes' } },
          },
          {
            path: 'registros',
            loadComponent: () =>
              import('./domains/RedCiudadana/pages/registros/registros.component').then(
                (r) => r.RedRegistrosComponent
              ),
            canActivate: [MasterPermissionsGuard],
            data: { permissions: { master: 'red', detailed: 'registros' } },
          },
          {
            path: 'reporte-falla',
            loadComponent: () =>
              import('./domains/RedCiudadana/pages/reporte-falla/reporte-falla.component').then(
                (r) => r.ReporteFallaComponent
              ),
          },
        ],
      },
      {
        path: 'unauthorized',
        loadComponent: () =>
          import('./shared/unauthorized/unauthorized.component').then(
            (u) => u.UnauthorizedComponent
          ),
      },
    ],
  },
  {
    path: 'public/doc',
    loadComponent: () =>
      import('./domains/shared/components/public-doc-viewer/public-doc-viewer.component')
        .then(m => m.PublicDocViewerComponent)
  },
  {
    path: 'registrocursos',
    loadComponent: () =>
      import('./public/registro-cursos/registro-cursos.component')
        .then(m => m.RegistroCursosComponent)
  },
  { path: '**', redirectTo: '' },
];
