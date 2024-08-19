import { Routes } from '@angular/router';

import { ComploginComponent } from './login/components/complogin/complogin.component';

export const routes: Routes = [
  
  { path: '', redirectTo: 'login', pathMatch: 'full'},
  { path: 'login', loadComponent: () => import('./login/pages/login-page/login-page.component').then(m => m.LoginPageComponent) },


];
