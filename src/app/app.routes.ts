import { Routes } from '@angular/router';
import { MainPageComponent } from './pages/main-page/main-page.component';

export const routes: Routes = [
  { 
    path: 'login', 
    loadComponent: () => import('./login/pages/login-page/login-page.component').then(m => m.LoginPageComponent) 
  },
  {
    path: '',
    component: MainPageComponent,
    children: [
      { path: '', redirectTo: 'smp', pathMatch: 'full' },
      { 
        path: 'proceswar', 
        loadComponent: () => import('./domains/Warehouse/pages/procwareh/procwareh.component').then(w => w.ProcwarehComponent)
      },
      { 
        path: 'procesdas', 
        loadComponent: () => import('./domains/Dashboards/pages/procdash/procdash.component').then(d => d.ProcdashComponent)
      },
      { 
        path: 'admon', 
        loadComponent: () => import('./domains/Admonapp/Pages/procadmon/procadmon.component').then(a => a.ProcadmonComponent)
      },
      {
        path: 'indicgrals',
        loadComponent: () => import('./domains/Indicadores/pages/procindicgrals/procindicgrals.component').then(a => a.ProcindicgralsComponent),
        children: [
          { path: '', redirectTo: 'indicad01', pathMatch: 'full' },
          { 
            path: 'indicad01', 
            loadComponent: () => import('./domains/Indicadores/pages/procindic01/procindic01.component').then(a => a.Procindic01Component),
            children: [
              { path: '', redirectTo: 'convenios', pathMatch: 'full' },
              { 
                path: 'convenios', 
                loadComponent: () => import('./domains/Indicadores/components/ind01/conventions/conventions.component').then(a => a.ConventionsComponent)
              },
              { 
                path: 'avances', 
                loadComponent: () => import('./domains/Indicadores/components/ind01/advances/advances.component').then(a => a.AdvancesComponent)
              },
              { 
                path: 'workprograms',
                loadComponent: () => import('./domains/Indicadores/components/ind01/workprograms/workprograms.component').then(a => a.WorkprogramsComponent)
              },
              { 
                path: 'issues',
                loadComponent: () => import('./domains/Indicadores/components/ind01/issues/issues.component').then(a => a.IssuesComponent)
              },
              { 
                path: 'alternatives',
                loadComponent: () => import('./domains/Indicadores/components/ind01/alternatives/alternatives.component').then(a => a.AlternativesComponent)
              },
              { 
                path: 'controlchanges',
                loadComponent: () => import('./domains/Indicadores/components/ind01/controlchanges/controlchanges.component').then(a => a.ControlchangesComponent)
              },
              { 
                path: 'riskmatrix',
                loadComponent: () => import('./domains/Indicadores/components/ind01/riskmatrix/riskmatrix.component').then(a => a.RiskmatrixComponent)
              },
              { 
                path: 'timeinactives', 
                loadComponent: () => import('./domains/Indicadores/components/ind01/timeinactives/timeinactives.component').then(a => a.TimeinactivesComponent)
              },
              { 
                path: 'stakeholders',
                loadComponent: () => import('./domains/Indicadores/components/ind01/stakeholders/stakeholders.component').then(a => a.StakeholdersComponent)
              }
              
            ]
          },
          { 
            path: 'indicad02', 
            loadComponent: () => import('./domains/Indicadores/pages/procindic02/procindic02.component').then(a => a.Procindic02Component)
          },
          { 
            path: 'indicad03', 
            loadComponent: () => import('./domains/Indicadores/pages/procindic03/procindic03.component').then(a => a.Procindic03Component)
          }
        ]
      },
      { 
        path: 'smp', 
        loadComponent: () => import('./domains/SMP/Pages/proccbpi/proccbpi.component').then(b => b.ProccbpiComponent)
      }
    ]
  },
  { path: '**', redirectTo: '' }
];