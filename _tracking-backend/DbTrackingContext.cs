using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Diagnostics.Contracts;
using MicroServicioTracking.Services;
using MicroServicioTracking.Models.DTOs;
using MicroServicioTracking.Models.Fact;
using MicroServicioTracking.Models.View;
using MicroServicioTracking.Models.Palacio;

namespace MicroServicioTracking.Models
{
    public class DbTrackingContext : DbContext
    {
        public DbTrackingContext(DbContextOptions<DbTrackingContext> options) : base(options) { }

        public virtual DbSet<Bank> Banks { get; set; }
        public virtual DbSet<ConceptsxIncorExp> ConceptsxIncorExps { get; set; }
        public virtual DbSet<DocumentsComprobados> DocumentosComprobados { get; set; }
        public virtual DbSet<Customer> Customers { get; set; }        
        public virtual DbSet<PosSetup> PosSetups { get; set; }
        public virtual DbSet<Creditxcustomer> Creditxcustomers { get; set; }
        public virtual DbSet<AccountBank> AccountBanks { get; set; }
        public virtual DbSet<Employee> Employees { get; set; }
        public virtual DbSet<expensecategory> expensecategorys { get; set; }
        public virtual DbSet<Incomeandexpense> Incomeandexpenses { get; set; }
        public virtual DbSet<InformationAditional> InformationAditionals { get; set; }
        public virtual DbSet<Loanandcredit> Loanandcredits { get; set; } 
        public virtual DbSet<ConceptsxLoansCredit> ConceptsxLoansCredits { get; set; }
        public virtual DbSet<Salesxconcept> Salesxconcepts { get; set; }
        public virtual DbSet<HierarchyCatalogDto> HierarchyCatalogDtos { get; set; }
        public virtual DbSet<Salesxcustomer> Salesxcustomers { get; set; }        
        public virtual DbSet<CashRegisters> CashRegisters { get; set; }        
        public virtual DbSet<Stores> Stores { get; set; }        
        public virtual DbSet<EmployeesxLoans> EmployeesxLoans { get; set; }
        public virtual DbSet<ZipCodes> ZipCodes { get; set; }
        public virtual DbSet<SetupManagement> SetupManagement { get; set; }
        public virtual DbSet<BillingManagement> BillingManagement { get; set; }
        public virtual DbSet<FiscalRegime> FiscalRegimes { get; set; }
        public virtual DbSet<HRManagement> HRManagement { get; set; }
        public virtual DbSet<HRManagementByRoot> HRManagementByRoot { get; set; }
        public virtual DbSet<PayrollRecord> PayrollRecords { get; set; }
        public virtual DbSet<PayrollEmployee> PayrollEmployees { get; set; }
        public virtual DbSet<EmployeesXClock> EmployeesXClocks { get; set; }
        public virtual DbSet<EmployeesxCheckInsOuts> EmployeesxChecks { get; set; }
        public virtual DbSet<EmployeesxCheckInsOutsView> EmployeesxCheckInsOutsViews { get; set; }
        public virtual DbSet<NormalPayroll> NormalPayrolls { get; set; }
        public virtual DbSet<EmployeesByPayroll> EmployeesByPayroll { get; set; }
        public virtual DbSet<IdBlockPeriod> IdBlockPeriods { get; set; }
        public virtual DbSet<PaymentsCreditsxCustomers> PaymentsCreditsxCustomers { get; set; }
        public virtual DbSet<Tracking> Trackings { get; set; }
        public virtual DbSet<EmployeesxBonus> EmployeesxBonus { get; set; }        
        public virtual DbSet<CashRegisterXBranchs> CashRegisterXBranchs {get; set;}
        public virtual DbSet<Employeexbranch> Employeexbranchs { get; set; }
        public virtual DbSet<Catalog> Catalogs { get; set; }
        public virtual DbSet<Customerxbranchsxcatalog> Customerbranchxcatalogs { get; set; }
        public virtual DbSet<EmployeeCheckInOutSummaryView> EmployeeCheckInOutSummaryViews { get; set; }
        public virtual DbSet<EmployeesByBranchNameOrder> EmployeesByBranchNameOrder {get; set;}
        public virtual DbSet<IncomeAndExpenseRoot> IncomeAndExpenseRoots { get; set; }
        public virtual DbSet<SpecialExtraHours> SpecialExtraHours { get; set; }
        public virtual DbSet<EmployeeBonusValues> EmployeeBonusValues { get; set; }
        public virtual DbSet<CatalogByType> CatalogByType { get; set; }
        public virtual DbSet<EmployeesxDiscrepancesChecksView> EmployeesxDiscrepancesChecksViews { get; set; }
        public virtual DbSet<CustomersByBranch> CustomersByBranch { get; set; }
        public virtual DbSet<Cuentasproveedor> Cuentasproveedor { get; set; }
        public virtual DbSet<EmployeesClockByBranch> EmployeesClockByBranch { get; set; }
        public virtual DbSet<CuentasContables> CuentasContables { get; set; }
        public virtual DbSet<CuentasContablesHierarchyDto> CuentasContablesHierarchyDtos { get; set; }
        public virtual DbSet<ObjetoGasto> ObjetoGasto { get; set; }
        public virtual DbSet<ObjetoGastoHierarchyDto> ObjetoGastoHierarchyDtos { get; set; }
        public virtual DbSet<Pedido> Pedidos { get; set; }
        public virtual DbSet<DetallesPedido> DetallesPedidos { get; set; }
        public virtual DbSet<Remision> Remisiones { get; set; }
        public virtual DbSet<RemisionDetalle> RemisionesDetalle { get; set; }
        public virtual DbSet<LogisticaRemisionResumen> LogisticaRemisionesResumen { get; set; }

        // Módulo Presupuestos SIAF
        public virtual DbSet<Presupuesto> Presupuestos { get; set; }
        public virtual DbSet<PresupuestoLinea> PresupuestoLineas { get; set; }
        public virtual DbSet<PresupuestoMes> PresupuestoMeses { get; set; }
        public virtual DbSet<PreregistroGasto> PreregistroGastos { get; set; }
        public virtual DbSet<PresupuestoMigracion> PresupuestoMigraciones { get; set; }
        public virtual DbSet<PresupuestoIncremento> PresupuestoIncrementos { get; set; }
        //Vistas
        public virtual DbSet<ViewEgresos> ViewEgresos { get; set; }
        public virtual DbSet<AllBranchsView> Allbranchs { get; set; }
        public virtual DbSet<ActiveBranchIds> ActiveBranchIds { get; set; }
        public virtual DbSet<Incomexroot> Incomexroots { get; set; }
        public virtual DbSet<Expensexroot> Expensexroots { get; set; }
        public virtual DbSet<CustomersBilling> CustomersBillings { get; set; }

        // Facturacion
        public virtual DbSet<UsosCfdi> UsosCfdis { get; set; }
        public virtual DbSet<MetodosPago> MetodosPagos { get; set; }
        public virtual DbSet<RegimenesFiscales> RegimenesFiscales { get; set; }
        public virtual DbSet<ClavesUnidades> ClavesUnidades { get; set; }
        public virtual DbSet<FormasPago> FormasPagos { get; set; }
        public virtual DbSet<ProductosServicios> ProductosServicios { get; set; }
        public virtual DbSet<CodigosPostales> CodigosPostales { get; set; }

        public virtual DbSet<CourserInfo> CourserInfo { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<Expensexroot>(entity =>
            {
                entity.HasKey(e => e.Idincomeorexpense);
                entity.ToView("expensexroot"); // 👈 nombre de la vista en la DB                               
                    // Configurar precisión de decimales
                    entity.Property(e => e.Subtotal).HasColumnType("decimal(18,2)");
                    entity.Property(e => e.Tax).HasColumnType("decimal(18,2)");
                    entity.Property(e => e.Total).HasColumnType("decimal(18,2)");
                    entity.Property(e => e.Quantity).HasColumnType("decimal(18,2)");
                    entity.Property(e => e.Price).HasColumnType("decimal(18,2)");
                    entity.Property(e => e.Iva2).HasColumnType("decimal(18,2)");
                    entity.Property(e => e.Totalconcepto).HasColumnType("decimal(18,2)");
               

                base.OnModelCreating(modelBuilder);

            });

            modelBuilder.Entity<Incomexroot>(entity =>
            {
                entity.HasNoKey();
                entity.ToView("incomexroot"); // 👈 nombre de la vista en la DB
            });

            modelBuilder.Entity<CustomersByBranch>(entity =>
            {
                entity.HasNoKey();
                entity.ToView("customersByBranch"); // 👈 nombre de la vista en la DB
            });

            modelBuilder.Entity<Cuentasproveedor>(entity =>
            {
                entity.HasNoKey();
                entity.ToView("cuentasproveedor"); // 👈 nombre de la vista en la DB
            });

            modelBuilder.Entity<EmployeesxDiscrepancesChecksView>(entity =>
            {
                entity.HasNoKey();
                entity.ToView("vw_employee_time_discrepancies"); // 👈 nombre de la vista en la DB
            });

            modelBuilder.Entity<ViewEgresos>(entity =>
            {
                entity.HasNoKey();
                entity.ToView("vw_conceptos_nivel4_base"); // 👈 nombre de la vista en la DB
            });

            modelBuilder.Entity<EmployeesClockByBranch>(entity =>
            {
                entity.HasNoKey();
                entity.ToView("employeesClockByBranch"); // 👈 nombre de la vista en la DB
            });

            modelBuilder.Entity<CuentasContablesHierarchyDto>(entity =>
            {
                entity.HasNoKey();
            });

            modelBuilder.Entity<ObjetoGastoHierarchyDto>(entity =>
            {
                entity.HasNoKey();
            });

            modelBuilder.Entity<EmployeesxCheckInsOutsView>(entity =>
            {
                entity.HasNoKey();
                entity.ToView("v_employee_checkinsouts"); // 👈 nombre de la vista en la DB
            });

            modelBuilder.Entity<IncomeAndExpenseRoot>(entity =>
            {
                entity.HasNoKey();
                entity.ToView("incomeandexpensexroot"); // 👈 nombre de la vista en la DB
            });

            //configuracion vista Customerxbranchsxcatalog
            modelBuilder.Entity<Customerxbranchsxcatalog>(entity =>
            {
                entity.HasNoKey();
                entity.ToView("customersxbranchsxcatalog"); // 👈 nombre de la vista en la DB
            });

            modelBuilder.Entity<CustomersByBranch>(entity =>
            {
                entity.HasNoKey();
                entity.ToView("customersByBranch"); // 👈 nombre de la vista en la DB
            });

            // Configuracion vista EmployeeCheckInOutSummary
            modelBuilder.Entity<EmployeeCheckInOutSummaryView>(entity =>
            {
                entity.HasNoKey();
                entity.ToView("EmployeeCheckInOutSummary"); // 👈 nombre de la vista en la DB
            });



            //configuracion vista Employeexbranchs
            modelBuilder.Entity<Employeexbranch>(entity =>
            {
                entity.HasNoKey();
                entity.ToView("employeesxbranch"); // 👈 nombre de la vista en la DB
            });

            //configuracion vista ActiveBranchids
            modelBuilder.Entity<ActiveBranchIds>(entity =>
            {
                entity.HasNoKey();
                entity.ToView("ActiveBranchIds"); // 👈 nombre de la vista en la DB
            });

            //configuracion vista CatalogByType
            modelBuilder.Entity<CatalogByType>(entity =>
            {
                entity.HasNoKey();
                entity.ToView("CatalogByType"); // 👈 nombre de la vista en la DB
            });

            //configuracion vista ActiveBranchids
            modelBuilder.Entity<CashRegisterXBranchs>(entity =>
            {
                entity.HasNoKey();
                entity.ToView("CashRegisterXBranchs"); // 👈 nombre de la vista en la DB
            });

            // Configure the relationship between PayrollRecord and PayrollEmployee
            modelBuilder.Entity<PayrollEmployee>()
                .HasOne(e => e.PayrollRecord)
                .WithMany(p => p.PayrollEmployees)
                .HasForeignKey(e => e.PayrollId)
                .OnDelete(DeleteBehavior.Cascade);

            // Add an index on PayrollEmployee.Name for faster searches
            modelBuilder.Entity<PayrollEmployee>()
                .HasIndex(e => e.Name);

            // Agregar la configuración para NormalPayroll
            modelBuilder.Entity<NormalPayroll>().ToTable("normalpayroll");

            modelBuilder.Entity<NormalPayroll>()
                .Property(p => p.Id).HasColumnName("Id");
            modelBuilder.Entity<NormalPayroll>()
                .Property(p => p.IdBranch).HasColumnName("id_branch");
            modelBuilder.Entity<NormalPayroll>()
                .Property(p => p.StartDate).HasColumnName("startdate");
            modelBuilder.Entity<NormalPayroll>()
                .Property(p => p.EndDate).HasColumnName("enddate");
            modelBuilder.Entity<NormalPayroll>()
                .Property(p => p.TotalBaseWorkingHours).HasColumnName("totalbaseworkinghours");
            modelBuilder.Entity<NormalPayroll>()
                .Property(p => p.TotalBaseExtraHours).HasColumnName("totalbaseextrahours");
            modelBuilder.Entity<NormalPayroll>()
                .Property(p => p.TotalSubtotal).HasColumnName("totalsubtotal")
                .HasPrecision(18, 2);
            modelBuilder.Entity<NormalPayroll>()
                .Property(p => p.TotalDescuentos).HasColumnName("totaldescuentos")
                .HasPrecision(18, 2);

            modelBuilder.Entity<NormalPayroll>()
                .Property(p => p.Total).HasColumnName("total")
                .HasPrecision(18, 2);

            modelBuilder.Entity<NormalPayroll>()
                .Property(p => p.Active).HasColumnName("active");

            base.OnModelCreating(modelBuilder);

            // Configuración de las nuevas entidades de nómina
            ConfigurePayrollEntities(modelBuilder);

            // Configuración de la tabla logistica.pedidos
            ConfigurePedidoEntity(modelBuilder);

            // Configuración de la tabla logistica.detallespedidos
            ConfigureDetallesPedidoEntity(modelBuilder);

            // Configuración de remisiones de logística
            ConfigureRemisionEntity(modelBuilder);
            ConfigureRemisionDetalleEntity(modelBuilder);
            ConfigureRemisionResumenViewEntity(modelBuilder);
        }

        private void ConfigurePayrollEntities(ModelBuilder modelBuilder)
        {
            // Configuración de la tabla normalpayroll
            modelBuilder.Entity<NormalPayroll>(entity =>
            {
                entity.ToTable("normalpayroll");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.IdBranch).HasColumnName("id_branch");
                entity.Property(e => e.StartDate).HasColumnName("startdate");
                entity.Property(e => e.EndDate).HasColumnName("enddate");
                entity.Property(e => e.TotalBaseWorkingHours).HasColumnName("totalbaseworkinghours").HasColumnType("decimal(18,2)");
                entity.Property(e => e.TotalBaseExtraHours).HasColumnName("totalbaseextrahours").HasColumnType("money");
                entity.Property(e => e.TotalSubtotal).HasColumnName("totalsubtotal").HasColumnType("money");
                entity.Property(e => e.TotalDescuentos).HasColumnName("totaldescuentos").HasColumnType("money");
                entity.Property(e => e.Total).HasColumnName("total").HasColumnType("money");
                entity.Property(e => e.Active).HasColumnName("active");
                
                // Índices para mejorar rendimiento en búsquedas por fechas
                entity.HasIndex(e => new { e.StartDate, e.EndDate });
            });
            
            // Configuración de la tabla employeesbypayroll
            modelBuilder.Entity<EmployeesByPayroll>(entity =>
            {
                entity.ToTable("employeesbypayroll");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.Id_employee).HasColumnName("id_employee");
                entity.Property(e => e.Id_normalpayroll).HasColumnName("id_normalpayroll");
                entity.Property(e => e.PriceXHour).HasColumnName("pricexhour").HasColumnType("decimal(18,2)");
                entity.Property(e => e.WorkedHours).HasColumnName("workedhours").HasColumnType("decimal(18,2)");
                entity.Property(e => e.ExtraWorkedHours).HasColumnName("extraworkedhours").HasColumnType("decimal(18,2)");
                entity.Property(e => e.BaseSalary).HasColumnName("baseSalary").HasColumnType("decimal(18,2)");
                entity.Property(e => e.ExtraSalary).HasColumnName("extraSalary").HasColumnType("decimal(18,2)");
                entity.Property(e => e.Bonus).HasColumnName("bonus").HasColumnType("decimal(18,2)");
                entity.Property(e => e.PercentageDiscount).HasColumnName("percentagediscount");
                entity.Property(e => e.realDiscount).HasColumnName("realdiscount").HasColumnType("decimal(18,2)");
                entity.Property(e => e.DigitalPayment).HasColumnName("digitalpayment").HasColumnType("decimal(18,2)");
                entity.Property(e => e.Savings).HasColumnName("savings").HasColumnType("decimal(18,2)");
                entity.Property(e => e.Total).HasColumnName("total").HasColumnType("decimal(18,2)");
                entity.Property(e => e.Active).HasColumnName("active");
                
                // Relaciones
                entity.HasOne(e => e.NormalPayroll)
                    .WithMany(p => p.EmployeesByPayroll)
                    .HasForeignKey(e => e.Id_normalpayroll)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(e => e.Employee)
                    .WithMany() // Ajusta esto según la estructura de tu Employee existente
                    .HasForeignKey(e => e.Id_employee)
                    .OnDelete(DeleteBehavior.Restrict);    
            });
        }

        private void ConfigurePedidoEntity(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<Pedido>(entity =>
            {
                entity.ToTable("pedidos", "logistica");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.IdCompany).HasColumnName("id_company");
                entity.Property(e => e.Numero).HasColumnName("numero").HasMaxLength(15);
                entity.Property(e => e.Fecha).HasColumnName("fecha");
                entity.Property(e => e.NumArticulos).HasColumnName("numarticulos");
                entity.Property(e => e.Comentario).HasColumnName("comentario").HasMaxLength(30);
                entity.Property(e => e.Active).HasColumnName("active");

                entity.HasIndex(e => new { e.IdCompany });
                entity.HasIndex(e => new { e.IdCompany, e.Numero });
            });
        }

        private void ConfigureDetallesPedidoEntity(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<DetallesPedido>(entity =>
            {
                entity.ToTable("detallespedidos", "logistica");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("Id");
                entity.Property(e => e.IdPedido).HasColumnName("id_pedido");
                entity.Property(e => e.IdCliente).HasColumnName("id_cliente");
                entity.Property(e => e.Producto).HasColumnName("producto").HasMaxLength(150);
                entity.Property(e => e.Plataforma).HasColumnName("plataforma").HasMaxLength(40);
                entity.Property(e => e.AplicaImpuestos).HasColumnName("aplicaimpuestos");
                entity.Property(e => e.Comentario).HasColumnName("comentario").HasMaxLength(50);
                entity.Property(e => e.Active).HasColumnName("active");

                // Relación FK con Pedido
                entity.HasOne<Pedido>()
                    .WithMany()
                    .HasForeignKey(e => e.IdPedido)
                    .HasPrincipalKey(p => p.Id);
            });
        }

        private void ConfigureRemisionEntity(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<Remision>(entity =>
            {
                entity.ToTable("Remisiones", "logistica");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.IdCompany).HasColumnName("idCompany");
                entity.Property(e => e.IdCliente).HasColumnName("idCliente");
                entity.Property(e => e.Folio).HasColumnName("folio").HasMaxLength(30);
                entity.Property(e => e.FechaCreacion).HasColumnName("fechaCreacion");
                entity.Property(e => e.FechaCierre).HasColumnName("fechaCierre");
                entity.Property(e => e.Estado).HasColumnName("estado").HasMaxLength(20);
                entity.Property(e => e.Comentario).HasColumnName("comentario").HasMaxLength(500);
                entity.Property(e => e.CreatedBy).HasColumnName("createdBy").HasMaxLength(150);
                entity.Property(e => e.ClosedBy).HasColumnName("closedBy").HasMaxLength(150);
                entity.Property(e => e.Active).HasColumnName("active");
            });
        }

        private void ConfigureRemisionDetalleEntity(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<RemisionDetalle>(entity =>
            {
                entity.ToTable("RemisionesDetalle", "logistica");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.IdRemision).HasColumnName("idRemision");
                entity.Property(e => e.IdDetallePedido).HasColumnName("idDetallePedido");
                entity.Property(e => e.CantidadRemitida).HasColumnName("cantidadRemitida").HasColumnType("decimal(18,2)");
                entity.Property(e => e.Comentario).HasColumnName("comentario").HasMaxLength(500);
                entity.Property(e => e.FechaCreacion).HasColumnName("fechaCreacion");
                entity.Property(e => e.Active).HasColumnName("active");
            });
        }

        private void ConfigureRemisionResumenViewEntity(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<LogisticaRemisionResumen>(entity =>
            {
                entity.HasNoKey();
                entity.ToView("vw_LogisticaRemisionesResumen", "logistica");
            });
        }
    }
}
  
