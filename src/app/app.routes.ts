import { Routes } from '@angular/router';
import { MainPageComponent } from './pages/main-page/main-page.component';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./login/pages/login-page/login-page.component').then(m => m.LoginPageComponent) },
  {
    path: '',
    component: MainPageComponent,
    children: [
      { path: '', redirectTo: 'bpi', pathMatch: 'full' },
      { path: 'allcontract', loadComponent: () => import('./domains/PEP/pages/allcontracts/allcontracts.component').then(a => a.AllcontractsComponent)},
      { path: 'procespep', loadComponent: () => import('./domains/PEP/pages/process/process.component').then(p => p.ProcessComponent)},
      { path: 'proceswar', loadComponent: () => import('./domains/Warehouse/pages/procwareh/procwareh.component').then(w=> w.ProcwarehComponent)},
      { path: 'procesdas', loadComponent: () => import('./domains/Dashboards/pages/procdash/procdash.component').then(d => d.ProcdashComponent)},
      { path: 'admon', loadComponent: () => import ('./domains/Admonapp/Pages/procadmon/procadmon.component'). then(a => a.ProcadmonComponent)},
      { path: 'bpi', loadComponent:  () => import ('./domains/BPI/Pages/proccbpi/proccbpi.component'). then (b => b.ProccbpiComponent)}
    ]
  },
  { path: '**', redirectTo: '' }
];
