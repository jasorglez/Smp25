
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SMP.Models
{
    [Table("dailyreport")]
    public class DailyReport
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }

        [Column("id_project")]
        public int? IdProject { get; set; }

        [Column("id_ot")]
        public int? IdOt { get; set; }

        [Column("id_convention")]
        public int? IdConvention { get; set; }

        [Column("date")]
        public DateTime? Date { get; set; } 

        [Column("starttime")]
        public TimeSpan? StartTime { get; set; } = new TimeSpan(7, 52, 0);

        [Column("endtime")]
        public TimeSpan? EndTime { get; set; }=        new TimeSpan(17, 2, 0);

        [StringLength(20)]
        [Column("type")]
        public string? Type { get; set; }

        [StringLength(50)]
        [Column("description")]
        public string? Description { get; set; }
        
        [Column("totalpay")]
        public decimal? TotalPay { get; set; } = 0;

        [Column("close")]
        public bool Close { get; set; }

        [Column("paid")]
        public bool? Paid { get; set; } = true;

        [Column("personal")]
        public short? Personal { get; set; } = 0;

        [Column("fotos")]
        public short? Fotos { get; set; } = 0;

        [Column("videos")]
        public short? Videos { get; set; } = 0;

        [Column("material")]
        public short? Material { get; set; } = 0;

        [Column("equipos")]
        public short? Equipos { get; set; } = 0;

        [Column("conceptos")]
        public short? Conceptos { get; set; } = 0;

        [Column("notas")]
        public short? Notas { get; set; } = 0;

        [Column("tiempos")]
        public short? Tiempos { get; set; } = 0;

        [StringLength(200)]
        [Column("numreporte")]
        public string? NumReporte { get; set; }

        [StringLength(200)]
        [Column("condition")]
        public string? Condition { get; set; }

        [StringLength(200)]
        [Column("ubication")]
        public string? Ubication { get; set; }

        [StringLength(200)]
        [Column("platicasseguridad")]
        public string? PlaticasSeguridad { get; set; }

        [Column("active")]
        public bool Active { get; set; } = true;
    }
}
