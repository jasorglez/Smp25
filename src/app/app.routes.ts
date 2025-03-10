import { Routes } from '@angular/router';
import { MainPageComponent } from './pages/main-page/main-page.component';
import { SharedModule } from './shared/shared.module';
import { MasterPermissionsGuard } from './guards/master-permissions.guard';

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
        loadComponent: () => import('./domains/Warehouse/pages/procwareh/procwareh.component').then(w => w.ProcwarehComponent),
        canActivate: [MasterPermissionsGuard],
        data: { permissions: { master: 'warehouses' } },
        children: [
          { path: '', redirectTo: 'Warehouse', pathMatch: 'full' }, ...SharedModule.getRoutes(),
          {
            path: 'warehousees',
            loadComponent: () => import('./domains/Warehouse/components/warehouses/warehouses.component').then(w => w.WarehousesComponent)
          },
          {
            path: 'materials',
            loadComponent: () => import('./domains/Warehouse/components/materials/materials.component').then(m => m.MaterialsComponent),
          },
          {
            path: 'purchaseorder',
            loadComponent: () => import('./domains/Warehouse/components/purchaseorder/purchaseorder.component').then(p => p.PurchaseOrderComponent)
          },
          {
            path: 'entrances',
            loadComponent: () => import('./domains/Warehouse/components/entrances/entrances.component').then(i => i.EntrancesComponent)
          },
          {
            path: 'outings',
            loadComponent: () => import('./domains/Warehouse/components/outings/outings.component').then(i => i.OutingsComponent)
          },
          {
            path: 'requisitions',
            loadComponent: () => import('./domains/Warehouse/components/requisitions/requisitions.component').then(r => r.RequisitionsComponent)
          },
          {
            path: 'catalogs',
            loadComponent: () => import('./domains/Warehouse/components/catalogs/catalogs.component').then(r => r.EditFamiliesComponent)
          },
          {
            path: 'setupwh',
            loadComponent: () => import('./domains/Warehouse/components/configwarehouse/configwarehouse.component').then(r => r.ConfigwarehouseComponent)
          }
        ]
      },
      {
        path: 'dashboardgrales',
        loadComponent: () => import('./domains/Dashboards/pages/procdash/procdash.component').then(a => a.ProcdashComponent),
        children: [
          { path: '', redirectTo: 'procdash1', pathMatch: 'full' },
          ...SharedModule.getRoutes(),
          {
            path: 'procdash1',
            loadComponent: () => import('./domains/Dashboards/pages/procdash1/procdash1.component').then(d => d.Procdash1Component),
            children: [
              { path: '', redirectTo: 'procdash', pathMatch: 'full' },
              ...SharedModule.getRoutes(),             
              {
                path: 'dashboard',
                loadComponent: () => import('./domains/Dashboards/components/marines/marines.component').then(m => m.MarinesComponent)
              }
            ]
          },
          {
            path: 'procdash2',
            loadComponent: () => import('./domains/Dashboards/pages/procdash2/procdash2.component').then(a => a.Procdash2Component)
          },
          {
            path: 'procdash3',
            loadComponent: () => import('./domains/Dashboards/pages/procdash3/procdash3.component').then(a => a.Procdash3Component)
          }
        ]
      },
      {
        path: 'admon',
        loadComponent: () => import('./domains/Admonapp/Pages/procadmon/procadmon.component').then(a => a.ProcadmonComponent),
        canActivate: [MasterPermissionsGuard],
        data: { permissions: { master: 'administration' } }
      },
      {
        path: 'indicgrals',
        loadComponent: () => import('./domains/Indicadores/pages/procindicgrals/procindicgrals.component').then(a => a.ProcindicgralsComponent),
        canActivate: [MasterPermissionsGuard],
        data: { permissions: { master: 'indicators' } },
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

        path: 'projects',
        loadComponent: () => import('./domains/ModProjects/pages/procprojects/procprojects.component').then(s => s.ProcprojectsComponent),
        canActivate: [MasterPermissionsGuard],
        data: { permissions: { master: 'projects' } },
        children: [
          { path: '', redirectTo: 'ModProjects', pathMatch: 'full' }, ...SharedModule.getRoutes(),
          {
            path: 'providers',
            loadComponent: () => import('./domains/ModProjects/components/providers/providers.component').then(p => p.ProvidersComponent)
          },
          {
            path: 'contracts',
            loadComponent: () => import('./domains/ModProjects/components/contracts/contracts.component').then(c => c.ContractsComponent)
          },
          {
            path: 'projects',
            loadComponent: () => import('./domains/ModProjects/components/projects/projects.component').then(p => p.ProjectsComponent)
          },
          {
            path: 'oilfields',
            loadComponent: () => import('./domains/ModProjects/components/oilfields/oilfields.component').then(o => o.OilfieldsComponent)
          },
          {
            path: 'estimates',
            loadComponent: () => import('./domains/ModProjects/components/estimates/estimates.component').then(r => r.EstimatesComponent)
          }
        ]
      },
      {
        path: 'smp',
        loadComponent: () => import('./domains/SMP/Pages/procsmp/proccsmp.component').then(s => s.ProccsmpComponent),
        canActivate: [MasterPermissionsGuard],
        data: { permissions: { master: 'setup' } },
        children: [
          { path: '', redirectTo: 'SMP', pathMatch: 'full' }, ...SharedModule.getRoutes(),
          {
            path: 'users',
            loadComponent: () => import('./domains/SMP/Components/users/users-menu.component').then(u => u.UsersMenuComponent)
          },
          {
            path: 'root',
            loadComponent: () => import('./domains/SMP/Components/root/root.component').then(r => r.RootComponent)
          },
          {
            path: 'branches',
            loadComponent: () => import('./domains/SMP/Components/branches/branches.component').then(u => u.BranchesComponent)
          },

        ]
      },

      {
        path: 'procmodadmon',
        loadComponent: () => import('./domains/ModAdmon/pages/procmodadmon/procmodadmon.component').then(a => a.ProcmodadmonComponent),
        canActivate: [MasterPermissionsGuard],
        data: { permissions: { master: 'administration' } },
        children: [
          { path: '', redirectTo: 'ModAdmon', pathMatch: 'full' }, ...SharedModule.getRoutes(),
          {
            path: 'setup',
            loadComponent: () => import('./domains/ModAdmon/components/setup/setup.component').then(s => s.SetupAdmonComponent),
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
            path: 'radiusinfluence',
            loadComponent: () => import('./domains/ModAdmon/components/radiusinfluence/radiusinfluence.component').then(r => r.RadiusinfluenceComponent)
          },
          {
            path: 'page01',
            loadComponent: () => import('./domains/ModAdmon/pages/pages01/page01.component').then(p => p.Page01Component),
            children: [
              { path: '', redirectTo: 'banks', pathMatch: 'full' },
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
          {
            path: 'page02',
            loadComponent: () => import('./domains/ModAdmon/pages/pages02/pages02.component').then(p => p.Pages02Component),
            children: [
              { path: '', redirectTo: 'customer', pathMatch: 'full' },
              ...SharedModule.getRoutes(),

                {
                 path: 'customer',
                 loadComponent: () => import('./domains/ModAdmon/components/customers/customers.component').then(e => e.CustomersComponent),
                 data: { type: 'CUSTOMERS' } // Parámetro para clientes
               },
               {
                 path: 'historical',
                 loadComponent: () => import('./domains/ModAdmon/components/historical/historical.component').then(e => e.HistoricalComponent)
               },
               {
                path: 'maps',
                loadComponent: () => import('./domains/ModAdmon/components/radiusinfluence/radiusinfluence.component').then(r => r.RadiusinfluenceComponent)
              }
            ]
          },
          {
            path: 'page03',
            loadComponent: () => import('./domains/ModAdmon/pages/pages03/pages03.component').then(p => p.Pages03Component),
            children: [
              { path: '', redirectTo: 'providers', pathMatch: 'full' },
              ...SharedModule.getRoutes(),
               {
                path: 'providers',
                loadComponent: () => import('./domains/ModAdmon/components/customers/customers.component').then(e => e.CustomersComponent),
                data: { type: 'PROVIDERS' } // Parámetro para proveedores
               },
               {
                 path: 'historical',
                 loadComponent: () => import('./domains/ModAdmon/components/historical/historical.component').then(e => e.HistoricalComponent)
               }
            ]
          },
        ]
      },

      {
        path: 'procmodmaintenance',
        loadComponent: () => import('./domains/ModMaintenance/pages/procmodmaintenance/procmodmaintenance.component').then(m => m.ProcmodmaintenanceComponent),
        canActivate: [MasterPermissionsGuard],
        data: { permissions: { master: 'maintenance' } },
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
        canActivate: [MasterPermissionsGuard],
        data: { permissions: { master: 'sales' } },
        children: [
          {
            path: '',
            redirectTo: 'ModSales', pathMatch: 'full'
          }, ...SharedModule.getRoutes(),
          {
            path: 'setup-sales',
            loadComponent: () => import('./domains/ModSales/components/setup/setup.component').then(s => s.PosSetupComponent),
            canActivate: [MasterPermissionsGuard],
            data: { permissions: { master: 'sales', detailed: 'setup' } }
          },
          {
            path: 'cash-register',
            loadComponent: () => import('./domains/ModSales/components/cash-register/cash-register.component').then(s => s.CashRegisterComponent),
            canActivate: [MasterPermissionsGuard],
            data: { permissions: { master: 'sales', detailed: 'cash-register' } }
          },
          {
            path: 'pos',
            loadComponent: () => import('./domains/ModSales/components/pos/pos.component').then(s => s.PosComponent),
            canActivate: [MasterPermissionsGuard],
            data: { permissions: { master: 'sales', detailed: 'pos' } }
          },
          {
            path: 'cash-closing',
            loadComponent: () => import('./domains/ModSales/components/cash-closing/cash-closing.component').then(s => s.CashClosingComponent),
            canActivate: [MasterPermissionsGuard],
            data: { permissions: { master: 'sales', detailed: 'cash-closing' } }
          },
          {
            path: 'returns',
            loadComponent: () => import('./domains/ModSales/components/returns/returns.component').then(s => s.ReturnsComponent),
            canActivate: [MasterPermissionsGuard],
            data: { permissions: { master: 'sales', detailed: 'returns' } }
          },
          {
            path: 'entrances',
            loadComponent: () => import('./domains/ModSales/components/entrances2/entrances2.component').then(s => s.Entrances2Component),
            canActivate: [MasterPermissionsGuard],
            data: { permissions: { master: 'sales', detailed: 'entrances' } }
          },
          {
            path: 'inventory',
            loadComponent: () => import('./domains/ModSales/components/inventory2/inventory2.component').then(s => s.Inventory2Component),
            canActivate: [MasterPermissionsGuard],
            data: { permissions: { master: 'sales', detailed: 'inventory' } }
          },
          {
            path: 'products',
            loadComponent: () => import('./domains/ModSales/components/products/products.component').then(s => s.ProductsComponent),
            canActivate: [MasterPermissionsGuard],
            data: { permissions: { master: 'sales', detailed: 'products' } }
          },
          {
            path: 'reports',
            loadComponent: () => import('./domains/ModSales/components/sales-reports/sales-reports.component').then(s => s.SalesReportsComponent),
            canActivate: [MasterPermissionsGuard],
            data: { permissions: { master: 'sales', detailed: 'reports' } }
          },
          {
            path: 'cash-withdrawal',
            loadComponent: () => import('./domains/ModSales/components/cash-withdrawal/cash-withdrawal.component').then(s => s.CashWithdrawalComponent),
            canActivate: [MasterPermissionsGuard],
            data: { permissions: { master: 'sales', detailed: 'cash-withdrawal' } }
          },
          {
            path: 'out-pos',
            loadComponent: () => import('./domains/ModSales/components/out-pos/out-pos.component').then(s => s.OutPosComponent),
            canActivate: [MasterPermissionsGuard],
            data: { permissions: { master: 'sales', detailed: 'out-pos' } }
          },
          {
            path: 'stores',
            loadComponent: () => import('./domains/ModSales/components/stores/stores.component').then(s => s.StoresComponent),
            canActivate: [MasterPermissionsGuard],
            data: { permissions: { master: 'sales', detailed: 'stores' } }
          },
        ]
      },
      {
        path: 'procreshuman',
        loadComponent: () => import('./domains/ModReshumans/pages/procreshuman/procreshuman.component').then(h => h.ProcreshumanComponent),
        canActivate: [MasterPermissionsGuard],
        data: { permissions: { master: 'hr' } },
        children: [
          { path: '', redirectTo: 'employees', pathMatch: 'full' },
          {
            path: 'setup',
            loadComponent: () => import('./domains/ModReshumans/components/setup/setup.component').then(s => s.SetupComponent)
          },
          {
            path: 'employees',
            loadComponent: () => import('./domains/ModReshumans/components/employees/employees.component').then(s => s.EmployeesComponent),
            children: [
              { path: '', redirectTo: 'employees-table', pathMatch: 'full' },
              {
                path: 'clock',
                loadComponent: () => import('./domains/ModReshumans/components/employees/employees-clock/employees-clock.component').then(p => p.EmployeesClockComponent)
              },
              {
                path: 'employees-table',
                loadComponent: () => import('./domains/ModReshumans/components/employees/table/table.component').then(l => l.EmployeesTableComponent)
              },
              {
                path: 'history-loans',
                loadComponent: () => import('./domains/ModReshumans/components/employees/loans-registry/loans-registry.component').then(s => s.LoansRegistryComponent)
              },
              {
                path: 'history-savings',
                loadComponent: () => import('./domains/ModReshumans/components/employees/savings-registry/savings-registry.component').then(s => s.SavingsRegistryComponent)
              },
              {
                path: 'history-clock',
                loadComponent: () => import('./domains/ModReshumans/components/employees/db/db.component').then(s => s.DbComponent)
              }
            ]
          },
          {
            path: 'payroll',
            loadComponent: () => import('./domains/ModReshumans/components/payroll/payroll.component').then(p => p.PayrollComponent),
          },
          {
            path: 'clock',
            loadComponent: () => import('./domains/ModReshumans/components/clock/clock.component').then(p => p.ClockComponent)
          },
        ]
      },
      {
        path: 'unauthorized',
        loadComponent: () => import('./shared/unauthorized/unauthorized.component').then(u => u.UnauthorizedComponent)
      }

    ]
  },
  { path: '**', redirectTo: '' }
];
