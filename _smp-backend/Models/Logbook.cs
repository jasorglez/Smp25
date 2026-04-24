using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Threading.Tasks;

namespace SMP.Models
{
    [Table("logbook")]
    public class Logbook
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Column("id_project")]
        [DefaultValue(0)]
        public int? IdProject { get; set; }

        [Column("id_ot")]
        [DefaultValue(0)]
        public int? IdOt { get; set; }

        [Column("id_resource")]
        public int? IdResource { get; set; }

        [Column("id_reporte")]
        [Required]
        [DefaultValue(0)]
        public int IdReporte { get; set; }

        [Column("id_padre")]
        [Required]
        [DefaultValue(0)]
        public int IdPadre { get; set; }

        [Column("date", TypeName = "date")]
        [DefaultValue("getdate()")]
        public DateTime? Date { get; set; }

        [Column("timexnote", TypeName = "time(7)")]
        [DefaultValue("sysdatetime()")]
        public TimeSpan? Timexnote { get; set; } // Representa la hora del día

        [Column("typenote", TypeName = "varchar(25)")]
        [DefaultValue("ANTECEDENTES")]
        public string TypeNote { get; set; }

        [Column("supervisor", TypeName = "varchar(250)")]
        [DefaultValue("NAME SUPERVISOR")]
        public string? Supervisor { get; set; }

        [Column("descriptionconcept", TypeName = "varchar(150)")]
        public string? Descriptionconcept { get; set; }

        [Column("image", TypeName = "varchar(320)")]
        [DefaultValue("SIN FOTO")]
        public string? ImageUrl { get; set; }

        [Column("description", TypeName = "text")]
        [DefaultValue("NOTAS")]
        public string? Description { get; set; }

        [Column("imageazure", TypeName = "varchar(320)")]
        [DefaultValue("NO FILE")]
        public string? ImageAzure { get; set; }

        [Column("start")]
        public TimeOnly? Start { get; set; }

        [Column("end")]
        public TimeOnly? End { get; set; }

        [Column("quantity")]
        public decimal? Quantity { get; set; }

        [Column("position")]

        public string? Position { get; set; }

        [Column("cuadrilla")]
        public string? Cuadrilla { get; set; }

        [Column("metadata")]
        public string? Metadata { get; set; }

        [Column("orden")]
        public int? Orden { get; set; }

        [Column("validado", TypeName = "varchar(7)")]
        public string? Validado { get; set; } = "PAGO";

        [Column("active")] public short Active { get; set; } = 1;   


    }
}