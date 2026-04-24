using System.ComponentModel.DataAnnotations.Schema;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel;

namespace SMP.Models
{

        [Table("workprogram")]
        public class Workprogram
        {
            [Key]
            [DatabaseGenerated(DatabaseGeneratedOption.Identity)]

            [Column("id", TypeName = "int")]
            public int Id { get; set; }

            [Column("id_contract", TypeName = "int")]
            public int IdContract { get; set; } = 0;

            [Column("id_project", TypeName = "int")]
            public int IdProject { get; set; } = 0;

            [Column("id_convention", TypeName = "int")]
            public int? IdConvention { get; set; }

            [Column("idtask", TypeName = "bigint")]
            public long IdTask { get; set; } = 0;

            [Column("type", TypeName = "varchar(10)")]
            public string? Type { get; set; }

            [Column("criticroute", TypeName = "varchar(2)")]
            [DefaultValue("No")]
            public string CriticRoute { get; set; }

            [Column("parent", TypeName = "bigint")]
            [DefaultValue(0)]
            public long Parent { get; set; }

            [Column("progress", TypeName = "decimal(16, 2)")]
            [DefaultValue(0)]
            public decimal Progress { get; set; }

            [Column("activity", TypeName = "varchar(20)")]
            public string Activity { get; set; }

            [Column("typeactivity", TypeName = "varchar(10)")]
            [DefaultValue("Activity")]
            public string? TypeActivity { get; set; }

            [Column("especification", TypeName = "varchar(20)")]
            public string? Especification { get; set; }

            [Column("description", TypeName = "nvarchar(max)")]
            public string Text { get; set; }

            [Column("startdate", TypeName = "date")]
            public DateTime? StartDate { get; set; }

            [Column("endate", TypeName = "date")]
            public DateTime? EndDate { get; set; }

            [Column("distribution", TypeName = "decimal(16, 2)")]
            [DefaultValue(0.0)]
            public decimal Distribution { get; set; }

            [Column("costMX", TypeName = "decimal(16, 2)")]
            public decimal? CostMX { get; set; }

            [Column("costDLL", TypeName = "decimal(16, 2)")]
            public decimal? CostDLL { get; set; }

            [DatabaseGenerated(DatabaseGeneratedOption.Computed)]
            [Column("total", TypeName = "decimal(16, 2)")]
            public decimal? Total { get; set; }

            [Column("ponderado", TypeName = "decimal(10, 3)")]
            public decimal? Ponderado { get; set; }

            [Column("measure", TypeName = "varchar(10)")]
            public string? Measure { get; set; }

            [Column("predecesor", TypeName = "int")]
            [DefaultValue(0)]
            public int Predecesor { get; set; }

            [Column("quantity", TypeName = "decimal(16, 2)")]
            [DefaultValue(0.0)]
            public decimal Quantity { get; set; }
        
            [Column("phase", TypeName = "varchar(30)")]
            public string? Phase { get; set; }

            [Column("color", TypeName= "varchar(10)")]
            public string? Color { get; set; }

            [Column("active", TypeName = "smallint")]
            [DefaultValue(0)]
            public short Active { get; set; }

            [Column("sortorder", TypeName = "int")]
            [DefaultValue(0)]
            public int Sortorder { get; set; }
        }
    }
