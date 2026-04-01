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
            './domains/ModWarehouse/pages/procwareh/procwareh.component'
          ).then((w) => w.ProcwarehComponent),
        canActivate: [MasterPermissionsGuard],
        data: { permissions: { master: 'shopping' } },
        children: [
          { path: '', redirectTo: 'Warehouse', pathMatch: 'full' },
          ...SharedModule.getRoutes(),
          {
            path: 'warehouses',
            loadComponent: () =>
              import(
                './domains/ModWarehouse/components/warehouses/warehouses.component'
              ).then((w) => w.WarehousesComponent),
            canDeactivate: [UnsavedChangesGuard],
          },
          {
            path: 'page02typemat',
            loadComponent: () =>
              import(
                './domains/ModWarehouse/pages/page02typemat/page02typemat.component'
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
                    './domains/ModWarehouse/components/materials/materials.component'
                  ).then((m) => m.MaterialsComponent),
                data: { type: 'CONSUMABLE' }, // Paso el Parámetro para materials
                canDeactivate: [UnsavedChangesGuard],
              },
              {
                path: 'materials',
                loadComponent: () =>
                  import(
                    './domains/ModWarehouse/components/detailMaterials/detailMaterials.component'
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
                './domains/ModWarehouse/components/raw-materials/raw-materials.component'
              ).then((s) => s.RawMaterialsComponent)
          },

          {
            path: 'purchaseorder',
            loadComponent: () => import('./domains/ModWarehouse/components/purchaseorder/purchaseorder.component').then((p) => p.PurchaseOrderComponent),
            canDeactivate: [UnsavedChangesGuard],
          },

          {
            path: 'entrances',
            loadComponent: () => import('./domains/ModWarehouse/components/entrances/entrances.component').then((i) => i.EntrancesComponent),
            canDeactivate: [UnsavedChangesGuard],
          },

          {
            path: 'outings-st',
            loadComponent: () => import('./domains/ModWareHousesTD/components/inandout-st/inandout-st.component').then((i) => i.InandoutStComponent),
            canDeactivate: [UnsavedChangesGuard],
            data: { movementType: 'OUT' }
          },

          {
            path: 'requisitions',
            loadComponent: () => import('./domains/ModWarehouse/components/requisitions/requisitions.component').then((r) => r.RequisitionsComponent),
            canDeactivate: [UnsavedChangesGuard],
          },

          {
            path: 'catalogs',
            loadComponent: () => import('./domains/SMP/Components/catalogs/catalogs.component').then((s) => s.CatalogsComponent),
            canDeactivate: [UnsavedChangesGuard],
            children: [
              {
                path: ':section',
                loadComponent: () => import('./domains/SMP/Components/catalogs/catalogs.component').then(p => p.CatalogsComponent)
              },
              /*{
                path: 'MATERIALES2',
                loadComponent: () => import('./domains/ModWarehouse/components/catalogs/catalogs.component').then(p => p.CatalogsComponent)
              },*/
            ],
          },

          {
            path: 'page03',
            loadComponent: () =>
              import('./domains/ModWarehouse/pages/pages03/pages03.component').then(
                (p) => p.Pages03Component
              ),
            children: [
              { path: '', redirectTo: 'providers', pathMatch: 'full' },
              ...SharedModule.getRoutes(),
              {
                path: 'providers',
                loadComponent: () =>
                  import(
                    './domains/ModWarehouse/components/providers/providers.component'
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
                './domains/ModWarehouse/components/configwarehouse/configwarehouse.component'
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
            path: 'materia-prima',
            loadComponent: () =>
              import(
                './domains/Almacenes/pages/materia-prima/materia-prima.component'
              ).then((m) => m.MateriaPrimaComponent),
            children: [
              { path: '', redirectTo: 'proveedores', pathMatch: 'full' },
              {
                path: 'proveedores',
                loadComponent: () =>
                  import(
                    './domains/ModWarehouse/components/providers/providers.component'
                  ).then((p) => p.ProvidersComponent),
                data: { type: 'PROVIDERS' },
                canDeactivate: [UnsavedChangesGuard],
              },
              {
                path: 'fam-sub',
                loadComponent: () =>
                  import(
                    './domains/Almacenes/components/FamilySubFamily/FamilySubFamily.component'
                  ).then((m) => m.FamilySubFamilyComponent),
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
            ],
          },
          {
            path: 'producto-terminado',
            loadComponent: () =>
              import(
                './domains/Almacenes/pages/producto-terminado/producto-terminado.component'
              ).then((p) => p.ProductoTerminadoComponent),
            canDeactivate: [UnsavedChangesGuard],
            children: [
              { path: '', redirectTo: 'catalogo', pathMatch: 'full' },
              {
                path: 'catalogo',
                loadComponent: () =>
                  import(
                    './domains/Almacenes/components/producto-terminado/producto-terminado.component'
                  ).then((m) => m.ProductoTerminadoComponent),
                canDeactivate: [UnsavedChangesGuard],
              },
              {
                path: 'materiales-maestro',
                loadComponent: () =>
                  import(
                    './domains/Almacenes/components/materiales-maestro/materiales-maestro.component'
                  ).then((m) => m.MaterialesMaestroComponent),
                canDeactivate: [UnsavedChangesGuard],
              },
              {
                path: 'productos-terminados',
                loadComponent: () =>
                  import(
                    './domains/Almacenes/pages/productos-terminados/productos-terminados.component'
                  ).then((p) => p.ProductosTerminadosComponent),
                canDeactivate: [UnsavedChangesGuard],
              },
            ],
          },
          {
            path: 'catalogo',
            loadComponent: () =>
              import('./domains/SMP/Components/catalogs/catalogs.component')
                .then((s) => s.CatalogsComponent),
            canDeactivate: [UnsavedChangesGuard],
            children: [
              {
                path: 'MATERIA PRIMA',
                loadComponent: () => import('./domains/SMP/Components/catalogs/catalogs.component').then(p => p.CatalogsComponent)
              },
              {
                path: 'COMPRAS',
                loadComponent: () => import('./domains/SMP/Components/catalogs/catalogs.component').then(p => p.CatalogsComponent)
              },
              {
                path: 'cat-fam-sub',
                loadComponent: () => import('./domains/SMP/Components/catalogs/catalogs.component').then(p => p.CatalogsComponent)
              },
              {
                path: ':section',
                loadComponent: () => import('./domains/SMP/Components/catalogs/catalogs.component').then(p => p.CatalogsComponent)
              },
              {
                path: 'materia-prima',
                loadComponent: () =>
                  import('./domains/Almacenes/components/cat-fam-sub/cat-fam-sub.component')
                    .then((m) => m.CatFamSubComponent),
                canDeactivate: [UnsavedChangesGuard],
              },
              {
                path: 'producto-terminado',
                loadComponent: () =>
                  import('./domains/Almacenes/components/producto-terminado/producto-terminado.component')
                    .then((m) => m.ProductoTerminadoComponent),
                canDeactivate: [UnsavedChangesGuard],
              },
            ],
          },
          {
            path: 'configuracion',
            loadComponent: () =>
              import(
                './domains/ModWarehouse/components/configwarehouse/configwarehouse.component'
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
            path: 'concepts',
            loadComponent: () =>
              import('./domains/ModProjects/components/concepts/concepts.component')
                .then((c) => c.ConceptsComponent),
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
            path: 'sistema',
            loadComponent: () =>
              import(
                './domains/ModProjects/components/sistema/sistema.component'
              ).then((s) => s.SistemaComponent),
            canActivate: [MasterPermissionsGuard],
            data: {
              permissions: { master: 'projects', detailed: 'sistema' }
            },
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
                path: 'conexion',
                loadComponent: () =>
                  import(
                    './domains/ModProjects/components/ot2/conexion/conexion.component'
                  ).then((c) => c.ConexionComponent),
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
            path: 'corporativos',
            loadComponent: () =>
              import('./domains/SMP/Components/corporativos/corporativos.component').then(
                (c) => c.CorporativosComponent
              ),
            canActivate: [TrackingGuard],
            data: {
              tracking: {
                logMessage: 'Click en Pestaña Configuración Módulo Corporativos',
                category: 'Setup'
              }
            }
          },
          {
            path: 'root',
            loadComponent: () =>
              import('./domains/SMP/Components/root/root.component').then(
                (r) => r.RootComponent
              ),
            canActivate: [MasterPermissionsGuard, TrackingGuard],
            data: {
              permissions: { master: 'setup', detailed: 'root' },
              tracking: {
                logMessage: 'Click en Pestaña Configuración Módulo Root',
                category: 'Setup'
              }
            }
          },

          {
            path: 'menu',
            loadComponent: () =>
              import('./domains/SMP/Pages/proccreatemenus/proccreatemenus.component').then(
                (r) => r.ProccreatemenusComponent
              ),
            canActivate: [TrackingGuard],
            data: {
              tracking: {
                logMessage: 'Click en Pestaña Configuración Módulo Menu',
                category: 'Setup'
              }
            },
            children: [
              { path: '', redirectTo: '', pathMatch: 'full' },
              ...SharedModule.getRoutes(),
              {
                path: 'menuasig',
                loadComponent: () =>
                  import(
                    './domains/SMP/Components/menus/menu.component'
                  ).then((m) => m.menuComponent),
              },
              {
                path: 'permisos',
                loadComponent: () =>
                  import(
                    './domains/SMP/Components/permission/permission.component'
                  ).then((p) => p.PermissionComponent),
              },
              {
                path: 'columnHider',
                loadComponent: () =>
                  import('./domains/SMP/Components/columnHider/columnHider.component').then(
                    (r) => r.columnHiderComponent),
              }
            ],

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
            path: 'providers-st',
            loadComponent: () => import('./domains/ModWarehouse/components/providers/providers.component').then((p) => p.ProvidersComponent),
            data: { type: 'PROVIDERS' },
            canDeactivate: [UnsavedChangesGuard],
          },
          {
            path: 'dashmodadmon',
            redirectTo: 'tablero/dashmodadmon',
            pathMatch: 'full'
          },
          {
            path: 'dashboard-hco',
            redirectTo: 'tablero/dashboard-hco',
            pathMatch: 'full'
          },
          {
            path: 'tablero',
            loadComponent: () =>
              import('./domains/ModAdmon/pages/tablero/tablero.component'
              ).then((t) => t.TableroComponent),
            children: [
              {
                path: 'dashmodadmon',
                loadComponent: () =>
                  import('./domains/ModAdmon/components/dashboardmodadmon/dashboarhost/dashboarhost.component'
                  ).then((s) => s.DashboarhostComponent),
                canActivate: [MasterPermissionsGuard, TrackingGuard],
                data: {
                  permissions: { master: 'administration', detailed: 'dashboard' },
                  tracking: {
                    logMessage: 'Click en Pestaña Dashboard Modulo Administracion',
                    category: 'Administration'
                  }
                }
              },
              {
                path: 'dashboard-hco',
                loadComponent: () =>
                  import('./domains/ModAdmon/pages/dashboard-hco/dashboard-hco.component'
                  ).then((d) => d.DashboardHcoComponent),
                canActivate: [MasterPermissionsGuard, TrackingGuard],
                data: {
                  permissions: { master: 'administration', detailed: 'dashboard-hco' },
                  tracking: {
                    logMessage: 'Click en Dashboard HCO - SIAF',
                    category: 'Administration'
                  }
                }
              },
              {
                path: 'reporte-operativo-sin-iva',
                loadComponent: () =>
                  import('./domains/ModAdmon/pages/reporte-operativo-sin-iva/reporte-operativo-sin-iva.component'
                  ).then((r) => r.ReporteOperativoSinIvaComponent),
                canActivate: [MasterPermissionsGuard, TrackingGuard],
                data: {
                  permissions: { master: 'administration', detailed: 'dashboard-hco' },
                  tracking: {
                    logMessage: 'Click en Reporte Operativo sin IVA',
                    category: 'Administration'
                  }
                }
              },
              {
                path: 'reporte-facturacion-anual',
                loadComponent: () =>
                  import('./domains/ModAdmon/pages/reporte-facturacion-anual/reporte-facturacion-anual.component'
                  ).then((r) => r.ReporteFacturacionAnualComponent),
                canActivate: [MasterPermissionsGuard, TrackingGuard],
                data: {
                  permissions: { master: 'administration', detailed: 'dashboard-hco' },
                  tracking: {
                    logMessage: 'Click en Reporte Facturación Anual',
                    category: 'Administration'
                  }
                }
              },
              {
                path: 'compuesto-negocio',
                loadComponent: () =>
                  import('./domains/ModAdmon/pages/compuesto-negocio/compuesto-negocio.component'
                  ).then((r) => r.CompuestoNegocioComponent),
                canActivate: [MasterPermissionsGuard, TrackingGuard],
                data: {
                  permissions: { master: 'administration', detailed: 'dashboard-hco' },
                  tracking: {
                    logMessage: 'Click en Compuesto Negocio',
                    category: 'Administration'
                  }
                }
              },
              {
                path: 'control-facturacion-ingresos',
                loadComponent: () =>
                  import('./domains/ModAdmon/pages/control-facturacion-ingresos/control-facturacion-ingresos.component'
                  ).then((r) => r.ControlFacturacionIngresosComponent),
                canActivate: [MasterPermissionsGuard, TrackingGuard],
                data: {
                  permissions: { master: 'administration', detailed: 'dashboard-hco' },
                  tracking: {
                    logMessage: 'Click en Control Facturación e Ingresos',
                    category: 'Administration'
                  }
                }
              },
              {
                path: 'concentrado-egresos',
                loadComponent: () =>
                  import('./domains/ModAdmon/pages/concentrado-egresos/concentrado-egresos.component'
                  ).then((r) => r.ConcentradoEgresosComponent),
                canActivate: [MasterPermissionsGuard, TrackingGuard],
                data: {
                  permissions: { master: 'administration', detailed: 'dashboard-hco' },
                  tracking: {
                    logMessage: 'Click en Concentrado de Egresos',
                    category: 'Administration'
                  }
                }
              }
            ]
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
            path: 'transferencias',
            loadComponent: () =>
              import(
                './domains/ModAdmon/components/transferencias/transferencias.component'
              ).then((t) => t.TransferenciasComponent),
            canActivate: [TrackingGuard],
            data: {
              tracking: {
                logMessage: 'Click en Pestaña Transferencias',
                category: 'Administration'
              }
            },
            canDeactivate: [UnsavedChangesGuard]
          },

          {
            path: 'aportaciones',
            loadComponent: () =>
              import(
                './domains/ModAdmon/components/aportaciones/aportaciones.component'
              ).then((m) => m.AportacionesComponent),
            canActivate: [TrackingGuard],
            data: {
              tracking: {
                logMessage: 'Click en Pestaña Aportaciones',
                category: 'Administration'
              }
            }
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
            path: 'stakeholder-expend',
            loadComponent: () =>
              import(
                './domains/ModAdmon/components/stakeholder-expend/stakeholder-expend.component'
              ).then((s) => s.StakeholderExpendComponent),
            canActivate: [MasterPermissionsGuard, TrackingGuard],
            data: {
              permissions: { master: 'administration', detailed: 'stakeholder-expend' },
              tracking: {
                logMessage: 'Click en Pestaña Retiro de Socios',
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
                loadComponent: () => import(
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

              {
                path: 'providers',
                loadComponent: () => import('./domains/ModWarehouse/components/providers/providers.component').then((p) => p.ProvidersComponent),
                canDeactivate: [UnsavedChangesGuard],
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

          {
            path: 'palacio-municipal',
            loadComponent: () =>
              import(
                './domains/ModAdmon/pages/palacio-municipal/palacio-municipal.component'
              ).then((p) => p.PalacioMunicipalComponent),
            canActivate: [TrackingGuard],
            data: {
              tracking: {
                logMessage: 'Click en Pestaña Palacio Municipal',
                category: 'Administration'
              }
            },
            children: [
              { path: '', redirectTo: 'clasificador', pathMatch: 'full' },
              {
                path: 'clasificador',
                loadComponent: () =>
                  import(
                    './domains/ModAdmon/components/object-classifier/object-classifier.component'
                  ).then((o) => o.ObjectClassifierComponent),
                canActivate: [TrackingGuard],
                data: {
                  tracking: {
                    logMessage: 'Click en Clasificador por Objeto del Gasto - Palacio Municipal',
                    category: 'Administration'
                  }
                }
              },
              {
                path: 'ingresos',
                loadComponent: () =>
                  import(
                    './domains/ModAdmon/components/ingresos-palacio/ingresos-palacio.component'
                  ).then((i) => i.IngresosPalacioComponent),
                canActivate: [TrackingGuard],
                data: {
                  tracking: {
                    logMessage: 'Click en Ingresos - Palacio Municipal',
                    category: 'Administration'
                  }
                },
                canDeactivate: [UnsavedChangesGuard]
              },
              {
                path: 'egresos',
                loadComponent: () =>
                  import(
                    './domains/ModAdmon/components/egresos-palacio/egresos-palacio.component'
                  ).then((e) => e.EgresosPalacioComponent),
                canActivate: [TrackingGuard],
                data: {
                  tracking: {
                    logMessage: 'Click en Egresos - Palacio Municipal',
                    category: 'Administration'
                  }
                },
                canDeactivate: [UnsavedChangesGuard]
              },
              {
                path: 'saldos',
                loadComponent: () =>
                  import(
                    './domains/ModAdmon/components/saldos-palacio/saldos-palacio.component'
                  ).then((s) => s.SaldosPalacioComponent),
                canActivate: [TrackingGuard],
                data: {
                  tracking: {
                    logMessage: 'Click en Saldos - Palacio Municipal',
                    category: 'Administration'
                  }
                }
              },
              {
                path: 'cat-ingresos-palacio',
                loadComponent: () =>
                  import(
                    './domains/ModAdmon/pages/palacio-municipal/cat-ingresos-palacio/cat-ingresos-palacio.component'
                  ).then((c) => c.CatIngresosPalacioComponent),
                canActivate: [TrackingGuard],
                data: {
                  tracking: {
                    logMessage: 'Click en Catálogo Ingresos - Palacio Municipal',
                    category: 'Administration'
                  }
                },
                canDeactivate: [UnsavedChangesGuard]
              },
              {
                path: 'cat-egresos-palacio',
                loadComponent: () =>
                  import(
                    './domains/ModAdmon/pages/palacio-municipal/cat-egresos-palacio/cat-egresos-palacio.component'
                  ).then((c) => c.CatEgresosPalacioComponent),
                canActivate: [TrackingGuard],
                data: {
                  tracking: {
                    logMessage: 'Click en Catálogo Egresos - Palacio Municipal',
                    category: 'Administration'
                  }
                },
                canDeactivate: [UnsavedChangesGuard]
              },

              {
                path: 'dashboard-palacio',
                loadComponent: () =>
                  import('./domains/ModAdmon/pages/palacio-municipal/dashboards-pal/dashboards-pal.component'
                  ).then((c) => c.DashboardsPalComponent),
                canActivate: [TrackingGuard],
                data: {
                  tracking: {
                    logMessage: 'Click en Dashboard - Palacio Municipal',
                    category: 'Administration'
                  }
                },
                canDeactivate: [UnsavedChangesGuard],
                children: [
                  { path: '', redirectTo: 'dasing-pal', pathMatch: 'full' },
                  {
                    path: 'dasing-pal',
                    loadComponent: () =>
                      import('./domains/ModAdmon/pages/palacio-municipal/dasing-pal/dasing-pal.component'
                      ).then((c) => c.DasingPalComponent),
                    canActivate: [TrackingGuard],
                    data: {
                      tracking: {
                        logMessage: 'Click en Dashboard Ingresos - Palacio Municipal',
                        category: 'Administration'
                      }
                    },
                    canDeactivate: [UnsavedChangesGuard]
                  },
                  {
                    path: 'dashegr-pal',
                    loadComponent: () =>
                      import('./domains/ModAdmon/pages/palacio-municipal/dashegr-pal/dashegr-pal.component'
                      ).then((c) => c.DashegrPalComponent),
                    canActivate: [TrackingGuard],
                    data: {
                      tracking: {
                        logMessage: 'Click en Dashboard Egresos - Palacio Municipal',
                        category: 'Administration'
                      }
                    },
                    canDeactivate: [UnsavedChangesGuard]
                  },
                  {
                    path: 'dastot-pal',
                    loadComponent: () =>
                      import('./domains/ModAdmon/pages/palacio-municipal/dastot-pal/dastot-pal.component'
                      ).then((c) => c.DastotPalComponent),
                    canActivate: [TrackingGuard],
                    data: {
                      tracking: {
                        logMessage: 'Click en Dashboard Total - Palacio Municipal',
                        category: 'Administration'
                      }
                    }
                  }
                ]
              },
              {
                path: 'contribuyentes',
                loadComponent: () =>
                  import(
                    './domains/ModAdmon/components/palacio-contribuyente/palacio-contribuyente.component'
                  ).then((c) => c.PalacioContribuyenteComponent),
                canActivate: [TrackingGuard],
                data: {
                  type: 'CUSTOMERS',
                  tracking: {
                    logMessage: 'Click en Contribuyentes - Palacio Municipal',
                    category: 'Administration'
                  }
                },
                canDeactivate: [UnsavedChangesGuard]
              }

            ]
          },

          {
            path: 'cuentas-contables',
            loadComponent: () =>
              import(
                './domains/ModAdmon/components/cuentas-contables/cuentas-contables.component'
              ).then((c) => c.CuentasContablesComponent),
            canActivate: [TrackingGuard],
            data: {
              tracking: {
                logMessage: 'Click en Catálogo de Cuentas Contables',
                category: 'Administration'
              }
            }
          },

        ],
      },

      {
        path: 'procmodmaintenance',
        loadComponent: () =>
          import(
            './domains/ModMaintenance/pages/procmodmaintenance/procmodmaintenance.component'
          ).then((m) => m.ProcmodmaintenanceComponent),
        children: [
          { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
          ...SharedModule.getRoutes(),
          {
            path: 'dashboard',
            loadComponent: () =>
              import(
                './domains/ModMaintenance/pages/dashboard/dashboard.component'
              ).then((d) => d.DashboardComponent),
          },
          {
            path: 'assets',
            loadComponent: () =>
              import(
                './domains/ModMaintenance/pages/assets/assets.component'
              ).then((a) => a.AssetsComponent),
          },
          {
            path: 'workorders',
            loadComponent: () =>
              import(
                './domains/ModMaintenance/pages/workorders/workorders.component'
              ).then((w) => w.WorkordersComponent),
          },
          {
            path: 'newworkorder',
            loadComponent: () =>
              import(
                './domains/ModMaintenance/pages/newworkorder/newworkorder.component'
              ).then((n) => n.NewworkorderComponent),
          },
          {
            path: 'equipos',
            loadComponent: () =>
              import(
                './domains/ModMaintenance/pages/equipos/equipos.component'
              ).then((e) => e.EquiposComponent),
          },
          {
            path: 'reportes',
            loadComponent: () =>
              import(
                './domains/ModMaintenance/pages/reportes/reportes.component'
              ).then((r) => r.ReportesComponent),
          },
          {
            path: 'newasset',
            loadComponent: () =>
              import(
                './domains/ModMaintenance/pages/newasset/newasset.component'
              ).then((n) => n.NewassetComponent),
          },
          {
            path: 'setup',
            loadComponent: () =>
              import(
                './domains/ModMaintenance/components/setup/setup.component'
              ).then((s) => s.SetupComponent),
          },
          {
            path: 'catalogos',
            loadComponent: () =>
              import(
                './domains/ModMaintenance/pages/catalogos/catalogos.component'
              ).then((c) => c.CatalogosMaintenanceComponent),
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
          { path: '', redirectTo: '', pathMatch: 'full' },
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
        path: 'shoppingTD',
        loadComponent: () =>
          import(
            './domains/ModShoppingTD/pages/procshoppingTD.component'
          ).then((a) => a.ProcShoppingTDComponent),
        canActivate: [MasterPermissionsGuard],
        data: { permissions: { master: 'shoppingTD' } },
        children: [
          { path: '', redirectTo: '', pathMatch: 'full' },

          {
            path: 'materials-st',
            loadComponent: () => import('./domains/ModProjects/components/materials/materials.component').then((c) => c.MaterialsComponent),
          },

          {
            path: 'requisitions-st',
            loadComponent: () => import('./domains/ModWarehouse/components/requisitions/requisitions.component').then((r) => r.RequisitionsComponent),
            canDeactivate: [UnsavedChangesGuard],
          },

          {
            path: 'quotes-st',
            loadComponent: () => import('./domains/ModWarehouse/components/quote/quote.component').then((q) => q.QuoteComponent),
            canDeactivate: [UnsavedChangesGuard],
          },

          {
            path: 'purchaseorder-st',
            loadComponent: () => import('./domains/ModWarehouse/components/purchaseorder/purchaseorder.component').then((p) => p.PurchaseOrderComponent),
            canDeactivate: [UnsavedChangesGuard],
          },

          {
            path: 'providers-st',
            loadComponent: () => import('./domains/ModWarehouse/components/providers/providers.component').then((p) => p.ProvidersComponent),
            canDeactivate: [UnsavedChangesGuard],
          },

          {
            path: 'setupwarehouse',
            loadComponent: () => import('./domains/ModWarehouse/components/setupwarehouse/setupwarehouse.component').then((s) => s.SetupwarehouseComponent),
            canDeactivate: [UnsavedChangesGuard],
          },

          {
            path: 'catalogs',
            loadComponent: () => import('./domains/SMP/Components/catalogs/catalogs.component').then((s) => s.CatalogsComponent),
            canDeactivate: [UnsavedChangesGuard],
          },

          {
            path: 'fam-subfam',
            loadComponent: () => import('./domains/ModShoppingTD/components/fam-subfam/fam-subfam.component').then((c) => c.FamSubfamComponent),
          },

        ]
      },
      {
        path: 'warehousesTD',
        loadComponent: () =>
          import(
            './domains/ModWareHousesTD/pages/procwarehousesTD.component'
          ).then((a) => a.ProcWarehousesTDComponent),
        canActivate: [MasterPermissionsGuard],
        data: { permissions: { master: 'warehousesTD' } },
        children: [
          { path: '', redirectTo: 'setup-st', pathMatch: 'full' },
          {
            path: 'setup-st',
            loadComponent: () =>
              import('./domains/ModWareHousesTD/components/setup-ts/setup-st.component').then(
                (c) => c.SetupStComponent
              ),
          },
          {
            path: 'warehouses',
            loadComponent: () => import('./domains/ModWarehouse/components/warehouses/warehouses.component').then((w) => w.WarehousesComponent),
            canDeactivate: [UnsavedChangesGuard],
          },
          {
            path: 'materials-st',
            loadComponent: () => import('./domains/ModProjects/components/materials/materials.component').then((c) => c.MaterialsComponent),
          },
          {
            path: 'providers-st', loadComponent: () => import('./domains/ModWarehouse/components/providers/providers.component').then((e) => e.ProvidersComponent),
            data: { type: 'PROVIDERS' }, // Parámetro para proveedores
            canDeactivate: [UnsavedChangesGuard],
          },
          {
            path: 'inventory-st',
            loadComponent: () => import('./domains/ModWareHousesTD/components/inventory-st/inventory-st.component').then(c => c.InventoryStComponent)
          },
          {
            path: 'entry-st',
            loadComponent: () => import('./domains/ModWareHousesTD/components/inandout-st/inandout-st.component').then(c => c.InandoutStComponent),
            data: { movementType: 'IN' }
          },
          {
            path: 'outings-st',
            loadComponent: () => import('./domains/ModWareHousesTD/components/inandout-st/inandout-st.component').then(c => c.InandoutStComponent),
            data: { movementType: 'OUT' }
          }
        ]
      },
      {
        path: 'shoppingDelison',
        loadComponent: () =>
          import(
            './domains/ModShoppingDelison/pages/procshoppingDelison.component'
          ).then((a) => a.ProcShoppingDelisonComponent),
        canActivate: [MasterPermissionsGuard],
        data: { permissions: { master: 'shoppingDelison' } },
        children: [
          { path: '', redirectTo: '', pathMatch: 'full' },
          {
            path: 'providers',
            loadComponent: () =>
              import(
                './domains/ModWarehouse/components/providers/providers.component'
              ).then((c) => c.ProvidersComponent),
            data: { type: 'PROVIDERS' },
            canDeactivate: [UnsavedChangesGuard],
          },
          {
            path: 'materia-prima',
            loadComponent: () =>
              import(
                './domains/ModShoppingDelison/pages/materia-prima/materia-prima.component'
              ).then((m) => m.MateriaPrimaComponent),
            children: [
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
            ],
          },
          {
            path: 'requisitions',
            loadComponent: () =>
              import(
                './domains/ModShoppingDelison/pages/requisitions-delison/requisitions-delison.component'
              ).then((c) => c.RequisitionsDelisonComponent),
            children: [
              { path: '', redirectTo: 'requisitions', pathMatch: 'full' },
              {
                path: 'requisitions',
                loadComponent: () =>
                  import(
                    './domains/ModWarehouse/components/requisitionsdelison/requisitionsdelison.component'
                  ).then((c) => c.RequisitionsDelisonComponent),
                canDeactivate: [UnsavedChangesGuard],
              },
              {
                path: 'quotes',
                loadComponent: () =>
                  import(
                    './domains/ModShoppingDelison/pages/quote-delison/quote-delison.component'
                  ).then((c) => c.QuoteDelisonComponent),
              },
            ],
          },
          {
            path: 'purchas_eorder',
            loadComponent: () =>
              import(
                './domains/ModWarehouse/components/purchaseorderdelison/purchaseorderdelison.component'
              ).then((c) => c.PurchaseOrderDelisonComponent),
            canDeactivate: [UnsavedChangesGuard],
          },

          {
            path: 'catalogs',
            loadComponent: () =>
              import('./domains/SMP/Components/catalogs/catalogs.component')
                .then((s) => s.CatalogsComponent),
            canActivate: [MasterPermissionsGuard],
            data: { permissions: { master: 'shoppingDelison', detailed: 'catalogs' } },
            children: [
              {
                path: 'cat-fam-sub',
                loadComponent: () =>
                  import(
                    './domains/Almacenes/components/cat-fam-sub/cat-fam-sub.component'
                  ).then((m) => m.CatFamSubComponent),
              },
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
                './domains/ModShoppingDelison/pages/subPages/configSubPage/configSubPage.component'
              ).then((c) => c.configShoppingDelisonComponent),
          },
        ],
      },
      {
        path: 'presupuestos',
        loadComponent: () =>
          import(
            './domains/ModPresupuestos/pages/procpresupuestos/procpresupuestos.component'
          ).then((s) => s.ProcpresupuestosComponent),
        canActivate: [MasterPermissionsGuard],
        data: { permissions: { master: 'presupuestos' } },
        children: [
          { path: '', redirectTo: 'presupuesto', pathMatch: 'full' },
          ...SharedModule.getRoutes(),
          {
            path: 'presupuesto',
            loadComponent: () =>
              import(
                './domains/ModPresupuestos/components/presupuesto/presupuesto.component'
              ).then((c) => c.PresupuestoComponent),
          },
          {
            path: 'preregistro',
            loadComponent: () =>
              import(
                './domains/ModPresupuestos/components/preregistro-gasto/preregistro-gasto.component'
              ).then((c) => c.PreregistroGastoComponent),
          },
          {
            path: 'migraciones',
            loadComponent: () =>
              import(
                './domains/ModPresupuestos/components/migraciones/migraciones.component'
              ).then((c) => c.MigracionesComponent),
          },
          {
            path: 'incrementos',
            loadComponent: () =>
              import(
                './domains/ModPresupuestos/components/incrementos/incrementos.component'
              ).then((c) => c.IncrementosComponent),
          },
          {
            path: 'reporte',
            loadComponent: () =>
              import(
                './domains/ModPresupuestos/components/reporte-desempeno/reporte-desempeno.component'
              ).then((c) => c.ReporteDesempenoComponent),
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
  { path: '**', redirectTo: '' },
];
