using System.ComponentModel.DataAnnotations.Schema;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel;
using Microsoft.EntityFrameworkCore;

namespace SMP.Models
{
    [Table("timeinactives")]
    public class Timeinactive
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        [Column("id")]
        public int Id { get; set; }

        [Column("id_project", TypeName = "int")]
        public int? IdProject { get; set; }

        [Column("date", TypeName = "date")]
        public DateTime? Date { get; set; }

        [Column("id_area", TypeName = "int")]
        public int? IdArea { get; set; }

        [Column("id_clasification", TypeName = "int")]
        public int? IdClasification { get; set; }

        [Column("timestart", TypeName = "time(7)")]
        public TimeSpan? TimeStart { get; set; }

        [Column("timeend", TypeName = "time(7)")]
        public TimeSpan? TimeEnd { get; set; }

        [Column("id_reporte", TypeName = "int")]
        public int? IdReporte { get; set; }

        [Column("total", TypeName = "decimal(16,2)")]
        [DatabaseGenerated(DatabaseGeneratedOption.Computed)]
        public decimal Total { get; set; }

        [Column("id_program", TypeName = "int")]
        public int? IdProgram { get; set; }

        [Column("cause", TypeName = "nvarchar(max)")]
        public string Cause { get; set; }

        [Column("personal", TypeName = "int")]
        public int? Personal { get; set; }

        [Column("active")]
        [Required]
        [DefaultValue(true)]
        public bool Active { get; set; }
    }
}
