import { Routes } from '@angular/router';
import { MainPageComponent } from './pages/main-page/main-page.component';
import { SharedModule } from './shared/shared.module';
import { MasterPermissionsGuard } from './guards/master-permissions.guard';
import { UnsavedChangesGuard } from './guards/unsaved-changes.guard';
import { HistoryPayrollComponent } from './domains/ModReshumans/components/payroll/history-payroll/history-payroll.component';
import { TrackingGuard } from './guards/tracking.guard';

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
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'proceswar',
        loadComponent: () =>
          import(
            './domains/Warehouse/pages/procwareh/procwareh.component'
          ).then((w) => w.ProcwarehComponent),
        canActivate: [MasterPermissionsGuard],
        data: { permissions: { master: 'warehouses' } },
        children: [
          { path: '', redirectTo: 'Warehouse', pathMatch: 'full' },
          ...SharedModule.getRoutes(),
          {
            path: 'warehouses',
            loadComponent: () =>
              import(
                './domains/Warehouse/components/warehouses/warehouses.component'
              ).then((w) => w.WarehousesComponent),
            canDeactivate: [UnsavedChangesGuard],
          },
          {
            path: 'page02typemat',
            loadComponent: () =>
              import(
                './domains/Warehouse/pages/page02typemat/page02typemat.component'
              ).then((p) => p.Page02typematComponent),
            children: [
              { path: '', redirectTo: 'materialsMaster', pathMatch: 'full' },
              ...SharedModule.getRoutes(),
              /*  
                           {
                          path: 'materials',
                             loadComponent: () =>
                               import(
                                 './domains/Warehouse/components/materials/materials.component'
                               ).then((s) => s.MaterialsComponent),
                             data: { type: 'PRODSALES' }, // Paso el Parámetro para materials
                             canDeactivate: [UnsavedChangesGuard],
                           },*/
              {
                path: 'materialsMaster',
                loadComponent: () =>
                  import(
                    './domains/Warehouse/components/materials/materials.component'
                  ).then((m) => m.MaterialsComponent),
                data: { type: 'CONSUMABLE' }, // Paso el Parámetro para materials
                canDeactivate: [UnsavedChangesGuard],
              },
              {
                path: 'materials',
                loadComponent: () =>
                  import(
                    './domains/Warehouse/components/detailMaterials/detailMaterials.component'
                  ).then((m) => m.DetailMaterialsComponent),
                data: { type: 'CONSUMABLE' }, // Paso el Parámetro para materials
                canDeactivate: [UnsavedChangesGuard],
              },
            ],
          },
          {
            path: 'raw-materials',
            loadComponent: () =>
              import(
                './domains/Warehouse/components/raw-materials/raw-materials.component'
              ).then((s) => s.RawMaterialsComponent)
          },
          {
            path: 'purchaseorder',
            loadComponent: () =>
              import(
                './domains/Warehouse/components/purchaseorder/purchaseorder.component'
              ).then((p) => p.PurchaseOrderComponent),
            canDeactivate: [UnsavedChangesGuard],
          },
          {
            path: 'entrances',
            loadComponent: () =>
              import(
                './domains/Warehouse/components/entrances/entrances.component'
              ).then((i) => i.EntrancesComponent),
            canDeactivate: [UnsavedChangesGuard],
          },
          {
            path: 'outings',
            loadComponent: () =>
              import(
                './domains/Warehouse/components/outings/outings.component'
              ).then((i) => i.OutingsComponent),
            canDeactivate: [UnsavedChangesGuard],
          },
          {
            path: 'requisitions',
            loadComponent: () =>
              import(
                './domains/Warehouse/components/requisitions/requisitions.component'
              ).then((r) => r.RequisitionsComponent),
            canDeactivate: [UnsavedChangesGuard],
          },

          {
            path: 'catalogs',
            loadComponent: () =>
              import('./domains/SMP/Components/catalogs/catalogs.component')
                .then((s) => s.CatalogsComponent),
            canDeactivate: [UnsavedChangesGuard],
            children: [
              {
                path: ':section',
                loadComponent: () => import('./domains/SMP/Components/catalogs/catalogs.component').then(p => p.CatalogsComponent)
              },
              /*{
                path: 'MATERIALES2',
                loadComponent: () => import('./domains/Warehouse/components/catalogs/catalogs.component').then(p => p.CatalogsComponent)
              },*/
            ],
          },
          {
            path: 'page03',
            loadComponent: () =>
              import('./domains/Warehouse/pages/pages03/pages03.component').then(
                (p) => p.Pages03Component
              ),
            children: [
              { path: '', redirectTo: 'providers', pathMatch: 'full' },
              ...SharedModule.getRoutes(),
              {
                path: 'providers',
                loadComponent: () =>
                  import(
                    './domains/Warehouse/components/providers/providers.component'
                  ).then((e) => e.ProvidersComponent),
                data: { type: 'PROVIDERS' }, // Parámetro para proveedores
                canDeactivate: [UnsavedChangesGuard],
              },
              {
                path: 'historical',
                loadComponent: () =>
                  import(
                    './domains/ModAdmon/components/historical/historical.component'
                  ).then((e) => e.HistoricalComponent),
              },
            ],
          },
          {
            path: 'setupwh',
            loadComponent: () =>
              import(
                './domains/Warehouse/components/configwarehouse/configwarehouse.component'
              ).then((r) => r.ConfigwarehouseComponent),
          },
        ],
      },
      {
        path: 'almacenes',
        loadComponent: () =>
          import(
            './domains/Almacenes/pages/procalmacenes/procalmacenes.component'
          ).then((a) => a.ProcalmacenesComponent),
        canActivate: [MasterPermissionsGuard],
        data: { permissions: { master: 'warehouses' } },
        children: [
          { path: '', redirectTo: 'materia-prima', pathMatch: 'full' },
          {
            path: 'proveedores',
            loadComponent: () =>
              import(
                './domains/Warehouse/components/providers/providers.component'
              ).then((p) => p.ProvidersComponent),
            data: { type: 'PROVIDERS' },
            canDeactivate: [UnsavedChangesGuard],
          },
          {
            path: 'materia-prima',
            loadComponent: () =>
              import(
                './domains/Almacenes/pages/materia-prima/materia-prima.component'
              ).then((m) => m.MateriaPrimaComponent),
            children: [
              { path: '', redirectTo: 'materiales-maestro', pathMatch: 'full' },
              {
                path: 'materiales-maestro',
                loadComponent: () =>
                  import(
                    './domains/Almacenes/components/materiales-maestro/materiales-maestro.component'
                  ).then((m) => m.MaterialesMaestroComponent),
                canDeactivate: [UnsavedChangesGuard],
              },
              {
                path: 'cat-fam-sub',
                loadComponent: () =>
                  import(
                    './domains/Almacenes/components/cat-fam-sub/cat-fam-sub.component'
                  ).then((m) => m.CatFamSubComponent),
                canDeactivate: [UnsavedChangesGuard],
              },
              {
                path: 'primera-fase',
                loadComponent: () =>
                  import(
                    './domains/Warehouse/components/materials/materials.component'
                  ).then((m) => m.MaterialsComponent),
                data: { type: 'PRIMERA_FASE' },
                canDeactivate: [UnsavedChangesGuard],
              },
              {
                path: 'primera-fase-historico',
                loadComponent: () =>
                  import(
                    './domains/Warehouse/components/materials/materials.component'
                  ).then((m) => m.MaterialsComponent),
                data: { type: 'PRIMERA_FASE_HISTORICO' },
              },
              {
                path: 'segunda-fase',
                loadComponent: () =>
                  import(
                    './domains/Warehouse/components/materials/materials.component'
                  ).then((m) => m.MaterialsComponent),
                data: { type: 'SEGUNDA_FASE' },
                canDeactivate: [UnsavedChangesGuard],
              },
              {
                path: 'segunda-fase-historico',
                loadComponent: () =>
                  import(
                    './domains/Warehouse/components/materials/materials.component'
                  ).then((m) => m.MaterialsComponent),
                data: { type: 'SEGUNDA_FASE_HISTORICO' },
              },
            ],
          },
          {
            path: 'requisiciones',
            loadComponent: () =>
              import(
                './domains/Warehouse/components/requisitionsdelison/requisitionsdelison.component'
              ).then((r) => r.RequisitionsDelisonComponent),
            canDeactivate: [UnsavedChangesGuard],
          },
          {
            path: 'ordenes-compra',
            loadComponent: () =>
              import(
                './domains/Warehouse/components/purchaseorderdelison/purchaseorderdelison.component'
              ).then((p) => p.PurchaseOrderDelisonComponent),
            canDeactivate: [UnsavedChangesGuard],
          },
          {
            path: 'catalogo',
            loadComponent: () =>
              import('./domains/SMP/Components/catalogs/catalogs.component')
                .then((s) => s.CatalogsComponent),
            canDeactivate: [UnsavedChangesGuard],
            children: [
              {
                path: ':section',
                loadComponent: () => import('./domains/SMP/Components/catalogs/catalogs.component').then(p => p.CatalogsComponent)
              },
            ],
          },
          {
            path: 'configuracion',
            loadComponent: () =>
              import(
                './domains/Warehouse/components/configwarehouse/configwarehouse.component'
              ).then((c) => c.ConfigwarehouseComponent),
          },
        ],
      },
      {
        path: 'dashboardgrales',
        canActivate: [MasterPermissionsGuard],
        data: { permissions: { master: 'dashboard' } },
        loadComponent: () =>
          import('./domains/Dashboards/pages/procdash/procdash.component').then(
            (a) => a.ProcdashComponent
          ),
        children: [
          { path: '', redirectTo: 'procdash1', pathMatch: 'full' },
          ...SharedModule.getRoutes(),
          {
            path: 'procdash1',
            loadComponent: () =>
              import(
                './domains/Dashboards/pages/procdash1/procdash1.component'
              ).then((d) => d.Procdash1Component),
            children: [
              { path: '', redirectTo: 'procdash', pathMatch: 'full' },
              ...SharedModule.getRoutes(),
              {
                path: 'dashboard',
                loadComponent: () =>
                  import(
                    './domains/Dashboards/components/marines/marines.component'
                  ).then((m) => m.MarinesComponent),
              },
            ],
          },
          {
            path: 'procdash2',
            loadComponent: () =>
              import(
                './domains/Dashboards/pages/procdash2/procdash2.component'
              ).then((a) => a.Procdash2Component),
          },
          {
            path: 'procdash3',
            loadComponent: () =>
              import(
                './domains/Dashboards/pages/procdash3/procdash3.component'
              ).then((a) => a.Procdash3Component),
          },
        ],
      },
      {
        path: 'admon',
        loadComponent: () =>
          import('./domains/Admonapp/Pages/procadmon/procadmon.component').then(
            (a) => a.ProcadmonComponent
          ),
        canActivate: [MasterPermissionsGuard],
        data: { permissions: { master: 'administration' } },
      },
      {
        path: 'indicgrals',
        loadComponent: () =>
          import(
            './domains/Indicadores/pages/procindicgrals/procindicgrals.component'
          ).then((a) => a.ProcindicgralsComponent),
        canActivate: [MasterPermissionsGuard],
        data: { permissions: { master: 'indicators' } },
        children: [
          { path: '', redirectTo: 'indicad01', pathMatch: 'full' },
          {
            path: 'indicad01',
            loadComponent: () =>
              import(
                './domains/Indicadores/pages/procindic01/procindic01.component'
              ).then((a) => a.Procindic01Component),
            children: [
              { path: '', redirectTo: 'convenios', pathMatch: 'full' },
              ...SharedModule.getRoutes(),
              {
                path: 'issues',
                loadComponent: () =>
                  import(
                    './domains/Indicadores/components/ind01/issues/issues.component'
                  ).then((a) => a.IssuesComponent),
              },
              {
                path: 'alternatives',
                loadComponent: () =>
                  import(
                    './domains/Indicadores/components/ind01/alternatives/alternatives.component'
                  ).then((a) => a.AlternativesComponent),
              },
              {
                path: 'controlchanges',
                loadComponent: () =>
                  import(
                    './domains/Indicadores/components/ind01/controlchanges/controlchanges.component'
                  ).then((a) => a.ControlChangesComponent),
              },
              {
                path: 'riskmatrix',
                loadComponent: () =>
                  import(
                    './domains/Indicadores/components/ind01/riskmatrix/riskmatrix.component'
                  ).then((a) => a.RiskmatrixComponent),
              },
              {
                path: 'timeinactives',
                loadComponent: () =>
                  import(
                    './domains/Indicadores/components/ind01/timeinactives/timeinactives.component'
                  ).then((a) => a.TimeinactivesComponent),
              },
              {
                path: 'stakeholders',
                loadComponent: () =>
                  import(
                    './domains/Indicadores/components/ind01/stakeholders/stakeholders.component'
                  ).then((a) => a.StakeholdersComponent),
              },
            ],
          },
          {
            path: 'indicad02',
            loadComponent: () =>
              import(
                './domains/Indicadores/pages/procindic02/procindic02.component'
              ).then((a) => a.Procindic02Component),
          },
          {
            path: 'indicad03',
            loadComponent: () =>
              import(
                './domains/Indicadores/pages/procindic03/procindic03.component'
              ).then((a) => a.Procindic03Component),
          },
        ],
      },
      {
        path: 'projects',
        loadComponent: () =>
          import(
            './domains/ModProjects/pages/procprojects/procprojects.component'
          ).then((s) => s.ProcprojectsComponent),
        canActivate: [MasterPermissionsGuard],
        data: { permissions: { master: 'projects' } },
        children: [
          { path: '', redirectTo: 'ot', pathMatch: 'full' },
          ...SharedModule.getRoutes(),
          {
            path: 'providers',
            loadComponent: () =>
              import(
                './domains/ModProjects/components/providers/providers.component'
              ).then((p) => p.ProvidersComponent),
          },
          {
            path: 'contracts',
            loadComponent: () =>
              import(
                './domains/ModProjects/components/contracts/contracts.component'
              ).then((c) => c.ContractsComponent),
          },
          {
            path: 'catalogs',
            loadComponent: () =>
              import('./domains/SMP/Components/catalogs/catalogs.component')
                .then((s) => s.CatalogsComponent),
            canDeactivate: [UnsavedChangesGuard],
            children: [
              {
                path: ':section',
                loadComponent: () => import('./domains/SMP/Components/catalogs/catalogs.component').then(p => p.CatalogsComponent)
              },
            ],
          },
          {
            path: 'materials',
            loadComponent: () =>
              import(
                './domains/ModProjects/components/materials/materials.component'
              ).then((c) => c.MaterialsComponent),
          },
          {
            path: 'equipment',
            loadComponent: () =>
              import(
                './domains/ModProjects/components/equipment/equipment.component'
              ).then((c) => c.EquipmentComponent),
          },
          {
            path: 'projects',
            loadComponent: () =>
              import(
                './domains/ModProjects/components/projects/projects.component'
              ).then((p) => p.ProjectsComponent),
          },
          {
            path: 'oilfields',
            loadComponent: () =>
              import(
                './domains/ModProjects/components/oilfields/oilfields.component'
              ).then((o) => o.OilfieldsComponent),
          },
          {
            path: 'estimates',
            loadComponent: () =>
              import(
                './domains/ModProjects/pages/procestimates/procestimates.component'
              ).then((r) => r.ProcesstimatesComponent),
            children: [
              { path: '', redirectTo: 'estimates', pathMatch: 'full' },
              {
                path: 'estimates',
                loadComponent: () =>
                  import(
                    './domains/ModProjects/components/estimates/estimates.component'
                  ).then((r) => r.EstimatesComponent),
              },
              {
                path: 'reportes-estimaciones',
                loadComponent: () =>
                  import(
                    './domains/ModProjects/components/estimates/reportes-estimaciones/reportes-estimaciones.component'
                  ).then((r) => r.ReportesEstimacionesComponent),
              },
              {
                path: 'reportes-generadores',
                loadComponent: () =>
                  import(
                    './domains/ModProjects/components/estimates/reportes-generadores/reportes-generadores.component'
                  ).then((r) => r.ReportesGeneradoresComponent),
              },
              {
                path: 'diarios-semanales',
                loadComponent: () =>
                  import(
                    './domains/ModProjects/components/estimates/diarios-semanales/diarios-semanales.component'
                  ).then((r) => r.DiariosSemánalesComponent),
              },
            ],
          },
          {
            path: 'ot',
            loadComponent: () =>
              import(
                './domains/ModProjects/pages/procot/procot.component'
              ).then((o) => o.ProcotComponent),
              canActivate: [MasterPermissionsGuard],
            data: {
              permissions:
              {
                master: 'projects',
                detailed: 'ot'
              }
            },
            children: [
              { path: '', redirectTo: 'ordenes', pathMatch: 'full' },
              ...SharedModule.getRoutes(),
              {
                path: 'ordenes',
                loadComponent: () =>
                  import(
                    './domains/ModProjects/components/ot/ordenes/ordenes.component'
                  ).then((o) => o.OrdenesComponent),
              },
              {
                path: 'catastrales',
                loadComponent: () =>
                  import(
                    './domains/ModProjects/components/ot/OtManuals/historicoOT.component'
                  ).then((c) => c.HistoricoOTComponent),
              },
              {
                path: 'generales',
                loadComponent: () =>
                  import(
                    './domains/ModProjects/components/ot/generales/generales.component'
                  ).then((g) => g.GeneralesComponent),
              },
              
              {
                path: 'inspeccion',
                loadComponent: () =>
                  import(
                    './domains/ModProjects/components/ot/totalDailyreport/inspeccion.component'
                  ).then((i) => i.InspeccionComponent),
              },
              {
                path: 'unidad',
                loadComponent: () =>
                  import(
                    './domains/ModProjects/components/ot/Graficas/unidad.component'
                  ).then((u) => u.UnidadComponent),
              },
             
              {
                path: 'details',
                loadComponent: () =>
                  import(
                    './domains/ModProjects/components/ot/details/details.component'
                  ).then((d) => d.DetailsComponent),
              },
              {
                path: 'details/:id',
                loadComponent: () =>
                  import(
                    './domains/ModProjects/components/ot/details/details.component'
                  ).then((d) => d.DetailsComponent),
              },
            ],
          }
        ],
      },
      {
        path: 'smp',
        loadComponent: () =>
          import('./domains/SMP/Pages/procsmp/proccsmp.component').then(
            (s) => s.ProccsmpComponent
          ),
        canActivate: [MasterPermissionsGuard],
        data: { permissions: { master: 'setup' } },
        children: [
          { path: '', redirectTo: 'users', pathMatch: 'full' },
          ...SharedModule.getRoutes(),
          {
            path: 'users',
            loadComponent: () =>
              import(
                './domains/SMP/Components/users/users-menu.component'
              ).then((u) => u.UsersMenuComponent),
            canActivate: [MasterPermissionsGuard, TrackingGuard],
            data: {
              permissions: { master: 'setup', detailed: 'users' },
              tracking: {
                logMessage: 'Click en Pestaña Configuración Módulo Usuarios',
                category: 'Setup'
              }
            }
            // canDeactivate: [UnsavedChangesGuard],
          },
          {
            path: 'root',
            loadComponent: () =>
              import('./domains/SMP/Components/root/root.component').then(
                (r) => r.RootComponent
              ),
            canActivate: [TrackingGuard],
            data: {
              tracking: {
                logMessage: 'Click en Pestaña Configuración Módulo Root',
                category: 'Setup'
              }
            }
          },
          {
            path: 'roles',
            loadComponent: () =>
              import('./domains/SMP/Components/rolesDelison/rolesDelison.component').then(
                (r) => r.RolesDelisonComponent
              ),
            canActivate: [MasterPermissionsGuard, TrackingGuard],
            data: {
              permissions: { master: 'setup', detailed: 'roles' },
              tracking: {
                logMessage: 'Click en Pestaña Configuración Módulo Roles',
                category: 'Setup'
              }
            }
          },
          {
            path: 'branches',
            loadComponent: () =>
              import(
                './domains/SMP/Components/branches/branches.component'
              ).then((u) => u.BranchesComponent),
            canActivate: [MasterPermissionsGuard, TrackingGuard],
            data: {
              permissions: { master: 'setup', detailed: 'branches' },
              tracking: {
                logMessage: 'Click en Pestaña Configuración Módulo Sucursales',
                category: 'Setup'
              }
            },
            canDeactivate: [UnsavedChangesGuard],
          },
          {
            path: 'stores',
            loadComponent: () =>
              import('./domains/SMP/Components/store/store.component').then(
                (u) => u.StoreComponent
              ),
            canActivate: [MasterPermissionsGuard, TrackingGuard],
            data: {
              permissions: { master: 'setup', detailed: 'stores' },
              tracking: {
                logMessage: 'Click en Pestaña Configuración Módulo Tiendas',
                category: 'Setup'
              }
            },
            canDeactivate: [UnsavedChangesGuard],
          },
          {
            path: 'cashRegisters',
            loadComponent: () =>
              import(
                './domains/SMP/Components/cashRegisters/cashRegisters.component'
              ).then((u) => u.CashRegistersComponent),
            canActivate: [MasterPermissionsGuard, TrackingGuard],
            data: {
              permissions: { master: 'setup', detailed: 'cash-registers' },
              tracking: {
                logMessage: 'Click en Pestaña Configuración Módulo Cajas Registradoras',
                category: 'Setup'
              }
            },
            canDeactivate: [UnsavedChangesGuard],
          },
          {
            path: 'logs',
            loadComponent: () =>
              import('./domains/SMP/Components/kardex/kardex.component').then(
                (k) => k.KardexComponent
              ),
            canActivate: [MasterPermissionsGuard, TrackingGuard],
            data: {
              permissions: { master: 'setup', detailed: 'log' },
              tracking: {
                logMessage: 'Click en Pestaña Configuración Módulo Logs',
                category: 'Setup'
              }
            }
          },
          {
            path: 'catalog',
            loadComponent: () =>
              import(
                './domains/SMP/Components/catalogs/catalogs.component'
              ).then((c) => c.CatalogsComponent),
          },
        ],
      },

      {
        path: 'procmodadmon',
        loadComponent: () =>
          import(
            './domains/ModAdmon/pages/procmodadmon/procmodadmon.component'
          ).then((a) => a.ProcmodadmonComponent),
        canActivate: [MasterPermissionsGuard],
        data: { permissions: { master: 'administration' } },
        children: [
          { path: '', redirectTo: 'ModAdmon', pathMatch: 'full' },
          ...SharedModule.getRoutes(),
          {
            path: 'dashmodadmon',
            loadComponent: () =>
              import(
                './domains/ModAdmon/components/dashboardmodadmon/dashboarhost/dashboarhost.component'
              ).then((s) => s.DashboarhostComponent),
            canActivate: [TrackingGuard],
            data: {
              tracking: {
                logMessage: 'Click en Pestaña Dashboard Modulo Administracion',
                category: 'Administration'
              }
            }
          },

          {
            path: 'setup',
            loadComponent: () =>
              import(
                './domains/ModAdmon/components/setup/setup.component'
              ).then((s) => s.SetupAdmonComponent),
            canActivate: [TrackingGuard],
            data: {
              tracking: {
                logMessage: 'Click en Pestaña Setup Modulo Administracion',
                category: 'Administration'
              }
            }
          },

          {
            path: 'catalogs',
            loadComponent: () =>
              import('./domains/SMP/Components/catalogs/catalogs.component')
                .then((s) => s.CatalogsComponent),
            canActivate: [TrackingGuard],
            data: {
              tracking: {
                logMessage: 'Click en Pestaña CATALOGOS Modulo Administracion',
                category: 'Administration'
              }
            },
            canDeactivate: [UnsavedChangesGuard],
            children: [
              {
                path: ':section',
                loadComponent: () => import('./domains/SMP/Components/catalogs/catalogs.component').then(p => p.CatalogsComponent)
              },
            ],
          },

          {
            path: 'income',
            loadComponent: () =>
              import(
                './domains/ModAdmon/components/income/income.component'
              ).then((i) => i.IncomeComponent),
            canActivate: [TrackingGuard],
            data: {
              tracking: {
                logMessage: 'Click en Pestaña Ingreso Administracion',
                category: 'Administration'
              }
            },

            canDeactivate: [UnsavedChangesGuard]
          },

          {
            path: 'expend',
            loadComponent: () =>
              import(
                './domains/ModAdmon/components/expenditure/expenditure.component'
              ).then((e) => e.ExpenditureComponent),
            canActivate: [TrackingGuard],
            data: {
              tracking: {
                logMessage: 'Click en Pestaña Egreso Administracion',
                category: 'Administration'
              }
            },
            canDeactivate: [UnsavedChangesGuard]
          },

          {
            path: 'masterExpenses',
            loadComponent: () =>
              import(
                './domains/ModAdmon/components/masterExpenses/masterExpenses.component'
              ).then((e) => e.MasterExpensesComponent),
            canActivate: [TrackingGuard],
            data: {
              tracking: {
                logMessage: 'Click en Pestaña Master Egreso Administracion',
                category: 'Administration'
              }
            },
            canDeactivate: [UnsavedChangesGuard]
          },

          {
            path: 'radiusinfluence',
            loadComponent: () =>
              import(
                './domains/ModAdmon/components/radiusinfluence/radiusinfluence.component'
              ).then((r) => r.RadiusinfluenceComponent),
          },

          {
            path: 'page01',
            loadComponent: () =>
              import('./domains/ModAdmon/pages/pages01/page01.component').then(
                (p) => p.Page01Component),
            canActivate: [TrackingGuard],
            data: {
              tracking: {
                logMessage: 'Click en Pestaña Radio Influencia Administracion',
                category: 'Administration'
              }
            },
            children: [
              { path: '', redirectTo: 'banks', pathMatch: 'full' },
              ...SharedModule.getRoutes(),

              {
                path: 'banks',
                loadComponent: () =>
                  import(
                    './domains/ModAdmon/components/banks/banks.component'
                  ).then((b) => b.BanksComponent),
                canActivate: [TrackingGuard],
                data: {
                  tracking: {
                    logMessage: 'Click en Pestaña Bancos Administracion',
                    category: 'Administration'
                  }
                },
                canDeactivate: [UnsavedChangesGuard],
              },
              {
                path: 'accountbanks',
                loadComponent: () =>
                  import(
                    './domains/ModAdmon/components/accountbanks/accountbanks.component'
                  ).then((a) => a.AccountbanksComponent),
                canActivate: [TrackingGuard],
                data: {
                  tracking: {
                    logMessage: 'Click en Pestaña Master Cuentas Bancos Administracion',
                    category: 'Administration'
                  }
                },
              },
            ],
          },
          {
            path: 'page02',
            loadComponent: () =>
              import('./domains/ModAdmon/pages/pages02/pages02.component').then(
                (p) => p.Pages02Component),
            canActivate: [TrackingGuard],
            data: {
              tracking: {
                logMessage: 'Click en Pestaña Clientes Administracion',
                category: 'Administration'
              }
            },
            children: [
              { path: '', redirectTo: 'customer', pathMatch: 'full' },
              ...SharedModule.getRoutes(),

              {
                path: 'customer',
                loadComponent: () =>
                  import(
                    './domains/ModAdmon/components/customers/customers.component'
                  ).then((e) => e.CustomersComponent),

                data: { type: 'CUSTOMERS' }, // Parámetro para clientes
                canDeactivate: [UnsavedChangesGuard],
              },

              {
                path: 'historical',
                loadComponent: () =>
                  import(
                    './domains/ModAdmon/components/historical/historical.component'
                  ).then((e) => e.HistoricalComponent),
                canActivate: [TrackingGuard],
                data: {
                  tracking: {
                    logMessage: 'Click en Pestaña Historicos Administracion',
                    category: 'Administration'
                  }
                },
              },

              {
                path: 'maps',
                loadComponent: () =>
                  import(
                    './domains/ModAdmon/components/radiusinfluence/radiusinfluence.component'
                  ).then((r) => r.RadiusinfluenceComponent),
                canActivate: [TrackingGuard],
                data: {
                  tracking: {
                    logMessage: 'Click en Pestaña Mapas Administracion',
                    category: 'Administration'
                  }
                },
              },

            ],
          },
              {
                path: 'page04',
                loadComponent: () =>
                  import('./domains/ModAdmon/pages/pages04/pages04.component').then(
                    (p) => p.Pages04Component),
                canActivate: [TrackingGuard],
                data: {
                  tracking: {
                    logMessage: 'Click en Pestaña Facturacion Electronica',
                    category: 'Administration'
                  }
                },
                children: [
                  { path: '', redirectTo: 'facturacion', pathMatch: 'full' },
                  ...SharedModule.getRoutes(),
   
                  {
                    path: 'facturacion',
                    loadComponent: () =>
                      import(
                        './domains/ModAdmon/components/facturacion/facturacion.component'
                      ).then((f) => f.FacturacionComponent),
                    canActivate: [TrackingGuard],
                    data: {
                      tracking: {
                        logMessage: 'Click en Pestaña Facturacion',
                        category: 'Administration'
                      }
                    },
                  },
   
                  {
                    path: 'catalogos-sat',
                    loadComponent: () =>
                      import(
                        './domains/ModAdmon/components/catalogos-sat/catalogos-sat.component'
                      ).then((c) => c.CatalogosSatComponent),
                    children: [
                      {
                        path: 'clave-unidad',
                        loadComponent: () =>
                          import(
                            './domains/ModAdmon/components/catalogos-sat/components/clave-unidad/clave-unidad.component'
                          ).then((c) => c.ClaveUnidadComponent),
                      },
                      {
                        path: 'forma-pago',
                        loadComponent: () =>
                          import(
                            './domains/ModAdmon/components/catalogos-sat/components/forma-pago/forma-pago.component'
                          ).then((f) => f.FormaPagoComponent),
                      },
                      {
                        path: 'metodo-pago',
                        loadComponent: () =>
                          import(
                            './domains/ModAdmon/components/catalogos-sat/components/metodo-pago/metodo-pago.component'
                          ).then((m) => m.MetodoPagoComponent),
                      },
                      {
                        path: 'moneda',
                        loadComponent: () =>
                          import(
                            './domains/ModAdmon/components/catalogos-sat/components/moneda/moneda.component'
                          ).then((m) => m.MonedaComponent),
                      },
                      {
                        path: 'tipo-comprobante',
                        loadComponent: () =>
                          import(
                            './domains/ModAdmon/components/catalogos-sat/components/tipo-comprobante/tipo-comprobante.component'
                          ).then((t) => t.TipoComprobanteComponent),
                      },
                      {
                        path: 'uso-cfdi',
                        loadComponent: () =>
                          import(
                            './domains/ModAdmon/components/catalogos-sat/components/uso-cfdi/uso-cfdi.component'
                          ).then((u) => u.UsoCfdiComponent),
                      },
                      {
                        path: 'productos-servicios',
                        loadComponent: () =>
                          import(
                            './domains/ModAdmon/components/catalogos-sat/components/productos-servicios/productos-servicios.component'
                          ).then((p) => p.ProductosServiciosComponent),
                      },
                      {
                        path: '',
                        redirectTo: 'clave-unidad',
                        pathMatch: 'full'
                      }
                    ],
                    canDeactivate: [UnsavedChangesGuard],
                  },
   
                ],
              },


        ],
      },

      {
        path: 'procmodmaintenance',
        loadComponent: () =>
          import(
            './domains/ModMaintenance/pages/procmodmaintenance/procmodmaintenance.component'
          ).then((m) => m.ProcmodmaintenanceComponent),
        canActivate: [MasterPermissionsGuard],
        data: { permissions: { master: 'maintenance' } },
        children: [
          { path: '', redirectTo: 'ModMaintenance', pathMatch: 'full' },
          ...SharedModule.getRoutes(),
          {
            path: 'setup',
            loadComponent: () =>
              import(
                './domains/ModMaintenance/components/setup/setup.component'
              ).then((s) => s.SetupComponent),
          },
          {
            path: 'equipments',
            loadComponent: () =>
              import(
                './domains/ModMaintenance/components/equipments/equipments.component'
              ).then((e) => e.EquipmentsComponent),
          },
          {
            path: 'personal',
            loadComponent: () =>
              import(
                './domains/ModMaintenance/components/personal/personal.component'
              ).then((p) => p.PersonalComponent),
          },
        ],
      },
      {
        path: 'procsales',
        loadComponent: () =>
          import('./domains/ModSales/pages/procsales/procsales.component').then(
            (s) => s.ProcsalesComponent
          ),
        canActivate: [MasterPermissionsGuard],
        data: { permissions: { master: 'sales' } },
        children: [
          {
            path: '',
            redirectTo: 'ModSales',
            pathMatch: 'full',
          },
          ...SharedModule.getRoutes(),
          {
            path: 'setup-sales',
            loadComponent: () =>
              import(
                './domains/ModSales/components/setup/setup.component'
              ).then((s) => s.PosSetupComponent),
            canActivate: [MasterPermissionsGuard],
            data: { permissions: { master: 'sales', detailed: 'setup' } },
          },
          {
            path: 'cash-register',
            loadComponent: () =>
              import(
                './domains/ModSales/components/cash-register/cash-register.component'
              ).then((s) => s.CashRegisterComponent),
            canActivate: [MasterPermissionsGuard],
            data: {
              permissions: { master: 'sales', detailed: 'cash-register' },
            },
          },
          {
            path: 'before-pos',
            loadComponent: () =>
              import(
                './domains/ModSales/components/before-pos/before-pos.component'
              ).then((s) => s.BeforePosComponent),
            canActivate: [MasterPermissionsGuard],
            data: { permissions: { master: 'sales', detailed: 'pos' } },
          },
          {
            path: 'pos',
            loadComponent: () =>
              import('./domains/ModSales/components/pos/pos.component').then(
                (s) => s.PosComponent
              ),
            canActivate: [MasterPermissionsGuard],
            data: { permissions: { master: 'sales', detailed: 'pos' } },
            // canDeactivate: [UnsavedChangesGuard],
          },
          {
            path: 'cash-closing',
            loadComponent: () =>
              import(
                './domains/ModSales/components/cash-closing/cash-closing.component'
              ).then((s) => s.CashClosingComponent),
            canActivate: [MasterPermissionsGuard],
            data: {
              permissions: { master: 'sales', detailed: 'cash-closing' },
            },
          },
          {
            path: 'returns',
            loadComponent: () =>
              import(
                './domains/ModSales/components/returns/returns.component'
              ).then((s) => s.ReturnsComponent),
            canActivate: [MasterPermissionsGuard],
            data: { permissions: { master: 'sales', detailed: 'returns' } },
          },
          {
            path: 'entrances',
            loadComponent: () =>
              import(
                './domains/ModSales/components/entrances2/entrances2.component'
              ).then((s) => s.Entrances2Component),
            canActivate: [MasterPermissionsGuard],
            data: { permissions: { master: 'sales', detailed: 'entrances' } },
          },
          {
            path: 'inventory',
            loadComponent: () =>
              import(
                './domains/ModSales/components/inventory2/inventory2.component'
              ).then((s) => s.Inventory2Component),
            canActivate: [MasterPermissionsGuard],
            data: { permissions: { master: 'sales', detailed: 'inventory' } },
          },
          {
            path: 'products',
            loadComponent: () =>
              import(
                './domains/ModSales/components/products/products.component'
              ).then((s) => s.ProductsComponent),
            canActivate: [MasterPermissionsGuard],
            data: { permissions: { master: 'sales', detailed: 'products' } },
          },
          {
            path: 'reports',
            loadComponent: () =>
              import(
                './domains/ModSales/components/sales-reports/sales-reports.component'
              ).then((s) => s.SalesReportsComponent),
            canActivate: [MasterPermissionsGuard],
            data: { permissions: { master: 'sales', detailed: 'reports' } },
          },
          {
            path: 'cash-withdrawal',
            loadComponent: () =>
              import(
                './domains/ModSales/components/cash-withdrawal/cash-withdrawal.component'
              ).then((s) => s.CashWithdrawalComponent),
            canActivate: [MasterPermissionsGuard],
            data: {
              permissions: { master: 'sales', detailed: 'cash-withdrawal' },
            },
          },
          {
            path: 'out-pos',
            loadComponent: () =>
              import(
                './domains/ModSales/components/out-pos/out-pos.component'
              ).then((s) => s.OutPosComponent),
            canActivate: [MasterPermissionsGuard],
            data: { permissions: { master: 'sales', detailed: 'out-pos' } },
          },
          {
            path: 'stores',
            loadComponent: () =>
              import(
                './domains/ModSales/components/stores/stores.component'
              ).then((s) => s.StoresComponent),
            canActivate: [MasterPermissionsGuard],
            data: { permissions: { master: 'sales', detailed: 'stores' } },
            canDeactivate: [UnsavedChangesGuard],
          },
          {
            path: 'ProductFinished',
            loadComponent: () =>
              import(
                './domains/ModSales/components/productFinished/productFinished.component'
              ).then((p) => p.ProductFinishedComponent),
            data: { type: 'PRODSALES' }, // Paso el Parámetro para materials
          },
        ],
      },
      {
        path: 'procreshuman',
        loadComponent: () =>
          import(
            './domains/ModReshumans/pages/procreshuman/procreshuman.component'
          ).then((h) => h.ProcreshumanComponent),
        canActivate: [MasterPermissionsGuard],
        data: { permissions: { master: 'hr' } },
        children: [
          { path: '', redirectTo: 'employees', pathMatch: 'full' },
          ...SharedModule.getRoutes(),
          {
            path: 'employees',
            loadComponent: () =>
              import(
                './domains/ModReshumans/components/employees/employees.component'
              ).then((s) => s.EmployeesComponent),
            canActivate: [MasterPermissionsGuard],
            data: {
              permissions:
              {
                master: 'hr',
                detailed: 'employees'
              }
            },
            children: [
              {
                path: '',
                redirectTo: 'employees-table',
                pathMatch: 'full'
              },

              {
                path: 'clock',
                loadComponent: () =>
                  import(
                    './domains/ModReshumans/components/employees/employees-clock/employees-clock.component'
                  ).then((p) => p.EmployeesClockComponent),
                canActivate: [TrackingGuard],
                data: {
                  tracking: {
                    logMessage: 'Click en Pestaña Empleados Módulo Horario de Empleados',
                    category: 'HR'
                  }
                }
              },
              {
                path: 'employees-table',
                loadComponent: () =>
                  import(
                    './domains/ModReshumans/components/employees/table/table.component'
                  ).then((l) => l.EmployeesTableComponent),
                canDeactivate: [UnsavedChangesGuard],
              },
              {
                path: 'history-loans',
                loadComponent: () =>
                  import(
                    './domains/ModReshumans/components/employees/loans-registry/loans-registry.component'
                  ).then((s) => s.LoansRegistryComponent),
                canActivate: [TrackingGuard],
                data: {
                  tracking: {
                    logMessage: 'Click en Pestaña Empleados Módulo Registro de Préstamos',
                    category: 'HR'
                  }
                },
              },
              {
                path: 'history-savings',
                loadComponent: () =>
                  import(
                    './domains/ModReshumans/components/employees/savings-registry/savings-registry.component'
                  ).then((s) => s.SavingsRegistryComponent),
                canActivate: [TrackingGuard],
                data: {
                  tracking: {
                    logMessage: 'Click en Pestaña Empleados Módulo Registro de Ahorros',
                    category: 'HR'
                  }
                },
              },
              /*{
                path: 'catalogs',
                loadComponent: () =>
                  import(
                    './domains/SMP/Components/catalogs/catalogs.component'
                  ).then((s) => s.CatalogsComponent),
                canDeactivate: [UnsavedChangesGuard],
              },*/
            ],
          },

          {
            path: 'payroll',
            loadComponent: () =>
              import(
                './domains/ModReshumans/components/payroll/payroll.component'
              ).then((p) => p.PayrollComponent),
            canActivate: [MasterPermissionsGuard],
            data: { permissions: { master: 'hr', detailed: 'payroll' } },
            children: [
              { path: '', redirectTo: 'master-payroll', pathMatch: 'full' },
              {
                path: 'master-payroll',
                loadComponent: () =>
                  import(
                    './domains/ModReshumans/components/payroll/masterpayroll/masterpayroll.component'
                  ).then((s) => s.MasterPayrollComponent),
                canActivate: [TrackingGuard],
                data: {
                  tracking: {
                    logMessage: 'Click en Pestaña Empleados Módulo Planilla de Pagos',
                    category: 'HR'
                  }
                },
              },
              {
                path: 'bonus',
                loadComponent: () =>
                  import(
                    './domains/ModReshumans/components/payroll/bonus/bonus.component'
                  ).then((s) => s.BonusComponent),
                canActivate: [TrackingGuard],
                data: {
                  tracking: {
                    logMessage: 'Click en Pestaña Empleados Módulo Bonos',
                    category: 'HR'
                  }
                },
                canDeactivate: [UnsavedChangesGuard],
              },
              {
                path: 'history-payroll',
                loadComponent: () =>
                  import(
                    './domains/ModReshumans/components/payroll/history-payroll/history-payroll.component'
                  ).then((s) => s.HistoryPayrollComponent),
                canActivate: [TrackingGuard],
                data: {
                  tracking: {
                    logMessage: 'Click en Pestaña Empleados Módulo Histórico de Nóminas Digitales',
                    category: 'HR'
                  }
                },
                canDeactivate: [UnsavedChangesGuard],
              },

              {
                path: 'setup',
                loadComponent: () =>
                  import(
                    './domains/ModReshumans/components/payroll/setup/setup.component'
                  ).then((s) => s.SetupEmployeesComponent),
                canActivate: [TrackingGuard],
                data: {
                  tracking: {
                    logMessage: 'Click en Pestaña Empleados Módulo Configuración de Nóminas',
                    category: 'HR'
                  }
                },
              },

            ],
          },
          {
            path: 'setup',
            loadComponent: () => import('./domains/ModReshumans/components/setup/setup.component').then(s => s.SetupComponent),
            canActivate: [MasterPermissionsGuard],
            data: { permissions: { master: 'hr', detailed: 'setup' } },
            children: [
              { path: '', redirectTo: 'employees', pathMatch: 'full' },

              {
                path: 'payroll',
                loadComponent: () => import('./domains/ModReshumans/components/setup/payroll/payroll.component').then(p => p.PayrollComponent),
                canActivate: [TrackingGuard],
                data: {
                  tracking: {
                    logMessage: 'Click en Pestaña Empleados Módulo Configuración de Nóminas',
                    category: 'HR'
                  }
                }

              },
              {
                path: 'employees',
                loadComponent: () => import('./domains/ModReshumans/components/setup/employees/employees.component').then(p => p.EmployeesComponent),
                canActivate: [TrackingGuard],
                data: {
                  tracking: {
                    logMessage: 'Click en Pestaña Empleados Módulo Configuración de Empleados',
                    category: 'HR'
                  }
                }
              },
              {
                path: 'clock',
                loadComponent: () => import('./domains/ModReshumans/components/setup/clock/clock.component').then(p => p.ClockComponent),
                canActivate: [TrackingGuard],
                data: {
                  tracking: {
                    logMessage: 'Click en Pestaña Empleados Módulo Configuración de Checador',
                    category: 'HR'
                  }
                }
              },
            ]
          },
          {
            path: 'clock',
            loadComponent: () => import('./domains/ModReshumans/components/checkout/checkout.component').then(s => s.CheckoutComponent),
            canActivate: [MasterPermissionsGuard],
            data: { permissions: { master: 'hr', detailed: 'clock' } },
            children: [
              { path: '', redirectTo: 'master-clock', pathMatch: 'full' },
              {
                path: 'discrepancies',
                loadComponent: () => import('./domains/ModReshumans/components/checkout/discrepancies/discrepancies.component'),
                canActivate: [TrackingGuard],
                data: {
                  tracking: {
                    logMessage: 'Click en Pestaña Empleados Módulo Checador Ajustar Tiempos',
                    category: 'HR'
                  }
                }
              },
              {
                path: 'history-clock',
                loadComponent: () => import('./domains/ModReshumans/components/checkout/db/db.component'),
                canActivate: [TrackingGuard],
                data: {
                  tracking: {
                    logMessage: 'Click en Pestaña Empleados Módulo Checador Histórico Checador',
                    category: 'HR'
                  }
                }
              },
              {
                path: 'detail-clock',
                loadComponent: () => import('./domains/ModReshumans/components/checkout/detail-clock/detail-clock.component'),
                canActivate: [TrackingGuard],
                data: {
                  tracking: {
                    logMessage: 'Click en Pestaña Empleados Módulo Checador Detalles Checador',
                    category: 'HR'
                  }
                }
              },
              {
                path: 'master-clock',
                loadComponent: () => import('./domains/ModReshumans/components/checkout/master-clock/master-clock.component'),
                canActivate: [TrackingGuard],
                data: {
                  tracking: {
                    logMessage: 'Click en Pestaña Empleados Módulo Checador Maestro Checador',
                    category: 'HR'
                  }
                }
              },
              {
                path: 'detail-clock-2',
                loadComponent: () => import('./domains/ModReshumans/components/checkout/detail-clock-2/detail-clock-2.component'),
              },
              {
                path: 'holidays',
                loadComponent: () => import('./domains/ModReshumans/components/checkout/holidays/holidays.component'),
                canActivate: [TrackingGuard],
                data: {
                  tracking: {
                    logMessage: 'Click en Pestaña Empleados Módulo Checador Feriados',
                    category: 'HR'
                  }
                }
              },

            ]
          },
          {
            path: 'catalogs',
            loadComponent: () =>
              import('./domains/SMP/Components/catalogs/catalogs.component')
                .then((s) => s.CatalogsComponent),
            canActivate: [MasterPermissionsGuard],
            data: { permissions: { master: 'hr', detailed: 'catalogs' } },
            canDeactivate: [UnsavedChangesGuard],
            children: [
              {
                path: ':section',
                loadComponent: () => import('./domains/SMP/Components/catalogs/catalogs.component').then(p => p.CatalogsComponent),
                canActivate: [TrackingGuard],
                data: {
                  tracking: {
                    logMessage: 'Click en Pestaña Empleados Módulo Catálogos',
                    category: 'HR'
                  }
                }
              },
            ],
          }
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
  { path: '**', redirectTo: '' },
];
