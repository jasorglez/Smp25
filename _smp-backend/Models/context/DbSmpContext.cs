using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using SMP.Models.TD;
using SMP.Models.FE;
using SMP.Models.Views;

namespace SMP.Models.context
{
    public class DbSmpContext : DbContext
    {
        public DbSmpContext()
        { }

        public DbSmpContext(DbContextOptions<DbSmpContext> options)
            : base(options)
        { }

        public virtual DbSet<Advanced> Advanceds { get; set; }
        public virtual DbSet<Analysi> Analysis { get; set; }
        public virtual DbSet<Analysisrisk> Analysisrisks { get; set; }
        public virtual DbSet<Attach> Attaches { get; set; }
        public virtual DbSet<Branch> Branchs { get; set; }
        public virtual DbSet<Catalog> Catalogs { get; set; }
        public virtual DbSet<Changescontrol> Changes { get; set; }
        public virtual DbSet<Contract> Contracts { get; set; }
        public virtual DbSet<Contingencyaction> Contigencyactions { get; set; }
        public virtual DbSet<Convention> Conventions { get; set; }
        public virtual DbSet<DailyReport> DailyReports { get; set; }
        public virtual DbSet<Estimate> Estimates { get; set; }
        public virtual DbSet<Equipment> Equipments { get; set; }
        public virtual DbSet<Grallog> Grallogs { get; set; }
        public virtual DbSet<Generator> Generators { get; set; }
        public virtual DbSet<Identification> Identifications { get; set; }           
        public virtual DbSet<Identificationrisk> Identificationrisks { get; set; }
        public virtual DbSet<Implementationrisk> Implementationrisks { get; set; }
        public virtual DbSet<ItemsGeneradoresEstimate> ItemsGeneradoresEstimates { get; set; }
        public virtual DbSet<Project> Projects { get; set; }
        public virtual DbSet<Oilfield> Oilfields { get; set; }
        public virtual DbSet<Provider> Providers { get; set; }
        public virtual DbSet<Logbook> Logbooks { get; set; }
        public virtual DbSet<Link> Links { get; set; }
        public virtual DbSet<PlanificationRisk> PlanificationRisks { get; set; }
        public virtual DbSet<Root> Roots { get; set; }
        public virtual DbSet<GruposCorporativo> GruposCorporativos { get; set; }
        public virtual DbSet<Stakeholder> Stakeholders { get; set; }
        public virtual DbSet<Timeinactive> Timeinactives { get; set; }
        public virtual DbSet<Workprogram> Workprograms { get; set; }
        public virtual DbSet<CanDeleteBranchView> CanDeleteBranch { get; set; }
        public virtual DbSet<CanDeleteBranchesxReasonView> CanDeleteBranchesxReason { get; set; }
        public virtual DbSet<ActiveBranchIdsView> ActiveBranchIds { get; set; }
        public virtual DbSet<AllBranchesView> Allbranchs { get; set; }
        public virtual DbSet<CompanyAndBranchView> Companyandbranch { get; set; }
        public virtual DbSet<LogbookDetalladaView> LogbookDetallada { get; set; }
        public virtual DbSet<ContractDetails> ContractDetails { get; set; }
        public virtual DbSet<ConventionDetails> ConventionDetails { get; set; }
        public virtual DbSet<OT> OTs { get; set; }
        public virtual DbSet<PersonalByProyect> PersonalByProyect { get; set; }
        public virtual DbSet<EmployeesFromAdministrationView> Employees { get; set; }
        public virtual DbSet<RegistroOT> RegistroOTs { get; set; }
        public virtual DbSet<RegistroOTEmpleado> RegistroOTEmpleados { get; set; }
        public virtual DbSet<MultimediaMetadata> MultimediaMetadatas { get; set; }
        public virtual DbSet<OtReportView> OtReportViews { get; set; }
        public virtual DbSet<otandlogbookxreport> Otandlogbookxreports { get; set; }
        public virtual DbSet<Concepts> Concepts { get; set; }
        public virtual DbSet<WorkprogramApu> WorkprogramApus { get; set; }
        public virtual DbSet<WorkprogramApuFactor> WorkprogramApuFactors { get; set; }
        public virtual DbSet<WorkprogramApuCuadrilla> WorkprogramApuCuadrillas { get; set; }
        public virtual DbSet<WorkprogramApuCuadrillaItem> WorkprogramApuCuadrillaItems { get; set; }
        public virtual DbSet<Herramienta> Herramientas { get; set; }
        public virtual DbSet<Auxiliar> Auxiliares { get; set; }
        public virtual DbSet<AuxiliarItem> AuxiliarItems { get; set; }
        public virtual DbSet<AuxiliarCuadrilla> AuxiliarCuadrillas { get; set; }
        public virtual DbSet<AuxiliarCuadrillaItem> AuxiliarCuadrillaItems { get; set; }
        public virtual DbSet<Distribution> Distributions { get; set; }
        public virtual DbSet<ManoObra> ManoObras { get; set; }

        public virtual DbSet<ClaveProdServ> ClaveProdServs { get; set; }
        public virtual DbSet<ClaveUnidad> ClaveUnidads { get; set; }
        public virtual DbSet<FormaPago> FormaPagos { get; set; }
        public virtual DbSet<MetodoPago> MetodoPagos { get; set; }
        public virtual DbSet<Moneda> Monedas { get; set; }
        public virtual DbSet<ObjetoImpuesto> ObjetoImpuestos { get; set; }
        public virtual DbSet<TipoComprobante> TipoComprobantes { get; set; }
        public virtual DbSet<UsoCfdi> UsoCfdis { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<otandlogbookxreport>(entity =>
            {
                entity.ToView("Otandlogbookxreportdiary");
                entity.HasNoKey();
            });

            modelBuilder.Entity<OtReportView>(entity =>
            {
                entity.ToView("vw_OtReports");
                entity.HasNoKey();
            });

            modelBuilder.Entity<Workprogram>(entity =>
            {
                entity.Property(w => w.Id)
                    .UseIdentityColumn()
                    .HasColumnName("id");

                // Columna calculada en SQL Server: no incluir en INSERT/UPDATE
                entity.Property(w => w.Total)
                    .HasComputedColumnSql("[quantity]*[costMX]")
                    .ValueGeneratedOnAddOrUpdate();
            });

            modelBuilder.Entity<WorkprogramApu>(entity =>
            {
                entity.ToTable("workprogram_apu", "pu");
                entity.Property(a => a.Total)
                    .HasComputedColumnSql("[quantity]*[unit_cost]")
                    .ValueGeneratedOnAddOrUpdate();
            });

            modelBuilder.Entity<WorkprogramApuFactor>(entity =>
            {
                entity.ToTable("workprogram_apu_factors", "pu");
            });

            modelBuilder.Entity<WorkprogramApuCuadrilla>(entity =>
            {
                entity.ToTable("workprogram_apu_cuadrilla", "pu");
            });

            modelBuilder.Entity<WorkprogramApuCuadrillaItem>(entity =>
            {
                entity.ToTable("workprogram_apu_cuadrilla_item", "pu");
            });

            modelBuilder.Entity<Project>()
                .HasOne(p => p.NavOilfield)
                .WithMany()
                .HasForeignKey(p => p.IdOilfield);

            modelBuilder.Entity<Project>()
               .HasOne(p => p.NavContract)
               .WithMany()
               .HasForeignKey(p => p.IdContrato);


            modelBuilder.Entity<AllBranchesView>(entity =>
            {
                entity.HasNoKey(); 
                entity.ToView("allbranchs");
            });
            modelBuilder.Entity<CompanyAndBranchView>(entity =>
            {
                entity.HasNoKey();
                entity.ToView("companyandbranch");
            });
            modelBuilder.Entity<LogbookDetalladaView>(entity =>
            {
                entity.HasNoKey();
                entity.ToView("LogbookDetalladaView");
            });
            modelBuilder.Entity<EmployeesFromAdministrationView>(entity =>
            {
                entity.ToView("vw_EmployeesFromAdministration");
                entity.HasNoKey();
            });

            // Configuración para RegistroOT
            modelBuilder.Entity<RegistroOT>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).UseIdentityColumn();
                entity.Property(e => e.OT).HasMaxLength(50).IsRequired();
                entity.Property(e => e.Descripcion).HasMaxLength(1000);
                entity.Property(e => e.Observaciones).HasMaxLength(2000);
                entity.Property(e => e.Resultados).HasMaxLength(2000);
                entity.Property(e => e.FechaCreacion).HasDefaultValueSql("GETUTCDATE()");
                
                entity.HasMany(e => e.RegistroOTEmpleados)
                    .WithOne(e => e.RegistroOT)
                    .HasForeignKey(e => e.RegistroOTId)
                    .OnDelete(DeleteBehavior.Cascade);
                    
                entity.HasMany(e => e.ArchivosMultimedia)
                    .WithOne(e => e.RegistroOT)
                    .HasForeignKey(e => e.RegistroOTId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            // Configuración para RegistroOTEmpleado
            modelBuilder.Entity<RegistroOTEmpleado>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).UseIdentityColumn();
                entity.Property(e => e.FechaAsignacion).HasDefaultValueSql("GETUTCDATE()");
            });

            // Configuración para MultimediaMetadata
            modelBuilder.Entity<MultimediaMetadata>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).UseIdentityColumn();
                entity.Property(e => e.UrlFirebase).HasMaxLength(500).IsRequired();
                entity.Property(e => e.TipoArchivo).HasMaxLength(10).IsRequired();
                entity.Property(e => e.NombreArchivo).HasMaxLength(200).IsRequired();
                entity.Property(e => e.FechaCreacion).HasDefaultValueSql("GETUTCDATE()");
            });


            modelBuilder.Entity<TD.OT>(entity =>
            {
                entity.Property(e => e.Results)
                    .HasColumnType("NVARCHAR(MAX)")
                    .HasMaxLength(-1);
            });

            base.OnModelCreating(modelBuilder);
        }
    }
}