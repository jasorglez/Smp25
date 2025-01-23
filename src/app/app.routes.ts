import { Routes } from '@angular/router';
import { MainPageComponent } from './pages/main-page/main-page.component';
import { SharedModule } from './shared/shared.module';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./login/pages/login-page/login-page.component').then(m => m.LoginPageComponent)
  },
  {
    path: '',
    component: MainPageComponent,
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'proceswar',
        loadComponent: () => import('./domains/Warehouse/pages/procwareh/procwareh.component').then(w => w.ProcwarehComponent)
      },
      {
        path: 'dashboard',
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
              ...SharedModule.getRoutes(),
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
                loadComponent: () => import('./domains/Indicadores/components/ind01/controlchanges/controlchanges.component').then(a => a.ControlChangesComponent)
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
        loadComponent: () => import('./domains/SMP/Pages/procsmp/proccsmp.component').then(s => s.ProccsmpComponent),
        children: [
          { path: '', redirectTo: 'SMP', pathMatch: 'full' }, ...SharedModule.getRoutes(),
          {
            path: 'users',
            loadComponent: () => import('./domains/SMP/Components/users/users-menu.component').then(u => u.UsersMenuComponent)
          },
          {
            path: 'providers',
            loadComponent: () => import('./domains/SMP/Components/providers/providers.component').then(p => p.ProvidersComponent)
          },
          {
            path: 'contracts',
            loadComponent: () => import('./domains/SMP/Components/contracts/contracts.component').then(c => c.ContractsComponent)
          },
          {
            path: 'projects',
            loadComponent: () => import('./domains/SMP/Components/projects/projects.component').then(p => p.ProjectsComponent)
          },
          {
            path: 'oilfields',
            loadComponent: () => import('./domains/SMP/Components/oilfields/oilfields.component').then(o => o.OilfieldsComponent)
          },
          {
            path: 'root',
            loadComponent: () => import('./domains/SMP/Components/root/root.component').then(r => r.RootComponent)
          },
          {
            path: 'branches',
            loadComponent: () => import('./domains/SMP/Components/branches/branches.component').then(u => u.BranchesComponent)
          },
          {
            path: 'estimates',
            loadComponent: () => import('./domains/SMP/Components/estimates/estimates.component').then(r => r.EstimatesComponent)
          }
        ]
      },

      {
        path: 'proceswar',
        loadComponent: () => import('./domains/Warehouse/pages/procwareh/procwareh.component').then(s => s.ProcwarehComponent),
        children: [
          { path: '', redirectTo: 'Warehouse', pathMatch: 'full' }, ...SharedModule.getRoutes(),
          {
            path: 'warehousees',
            loadComponent: () => import('./domains/Warehouse/components/warehouses/warehouses.component').then(w => w.WarehousesComponent)
          },
          {
            path: 'materials',
            loadComponent: () => import('./domains/Warehouse/components/materials/materials.component').then(m => m.MaterialsComponent)
          },
          {
            path: 'requisitions',
            loadComponent: () => import('./domains/Warehouse/components/requisitions/requisitions.component').then(r => r.RequisitionsComponent)
          }

        ]
      },

      {
        path: 'procmodadmon',
        loadComponent: () => import('./domains/ModAdmon/pages/procmodadmon/procmodadmon.component').then(a => a.ProcmodadmonComponent),
        children: [
          { path: '', redirectTo: 'ModAdmon', pathMatch: 'full' }, ...SharedModule.getRoutes(),
          {
            path: 'setupadm',
            loadComponent: () => import('./domains/ModAdmon/components/setup/setup.component').then(s => s.SetupComponent),
          },
          {
            path: 'income',
            loadComponent: () => import('./domains/ModAdmon/components/income/income.component').then(i => i.IncomeComponent)
          },
          {
            path: 'expend',
            loadComponent: () => import('./domains/ModAdmon/components/expenditure/expenditure.component').then(e => e.ExpenditureComponent)
          },
          {
            path: 'customer',
            loadComponent: () => import('./domains/ModAdmon/components/customers/customers.component').then(e => e.CustomersComponent)
          },
          {
            path: 'page01',
            loadComponent: () => import('./domains/ModAdmon/pages/pages01/page01.component').then(p => p.Page01Component),
            children: [
              { path: '', redirectTo: 'convenios', pathMatch: 'full' },
              ...SharedModule.getRoutes(),

              {
                path: 'banks',
                loadComponent: () => import('./domains/ModAdmon/components/banks/banks.component').then(b => b.BanksComponent)
              },
              {
                path: 'accountbanks',
                loadComponent: () => import('./domains/ModAdmon/components/accountbanks/accountbanks.component').then(a => a.AccountbanksComponent)
              }
            ]
          },
        ]
      },

      {
        path: 'procmodmaintenance',
        loadComponent: () => import('./domains/ModMaintenance/pages/procmodmaintenance/procmodmaintenance.component').then(m => m.ProcmodmaintenanceComponent),
        children: [
          { path: '', redirectTo: 'ModMaintenance', pathMatch: 'full' }, ...SharedModule.getRoutes(),
          {
            path: 'setup',
            loadComponent: () => import('./domains/ModMaintenance/components/setup/setup.component').then(s => s.SetupComponent)
          },
          {
            path: 'equipments',
            loadComponent: () => import('./domains/ModMaintenance/components/equipments/equipments.component').then(e => e.EquipmentsComponent)
          },
          {
            path: 'personal',
            loadComponent: () => import('./domains/ModMaintenance/components/personal/personal.component').then(p => p.PersonalComponent)
          }

        ]
      },
      {
        path: 'procsales',
        loadComponent: () => import('./domains/ModSales/pages/procsales/procsales.component').then(s => s.ProcsalesComponent),
        children: [
          { path: '', redirectTo: 'pos', pathMatch: 'full' }, ...SharedModule.getRoutes(),
          {
            path: 'setup-sales',
            loadComponent: () => import('./domains/ModSales/components/setup/setup.component').then(s => s.PosSetupComponent)
          },
          {
            path: 'pos',
            loadComponent: () => import('./domains/ModSales/components/pos/pos.component').then(s => s.PosComponent)
          }
        ]
      },
      {
        path: 'procreshuman',
        loadComponent: () => import('./domains/ModReshumans/pages/procreshuman/procreshuman.component').then(h => h.ProcreshumanComponent),
        children: [
          { path: '', redirectTo: 'ModReshumans', pathMatch: 'full' }, ...SharedModule.getRoutes(),
          {
            path: 'setup-rh',
            loadComponent: () => import('./domains/ModReshumans/components/setup/setup.component').then(s => s.SetupComponent)
          },
          {
            path: 'employees',
            loadComponent: () => import('./domains/ModReshumans/components/employees/employees.component').then(s => s.EmployeesComponent)
          },
          {
            path: 'personal',
            loadComponent: () => import('./domains/ModReshumans/components/personal/personal.component').then(p => p.PersonalComponent)
          },
          {
            path: 'equipments',
            loadComponent: () => import('./domains/ModReshumans/components/reservations/reservations.component').then(r => r.ReservationsComponent)
          },

        ]
      }

    ]
  },
  { path: '**', redirectTo: '' }
];