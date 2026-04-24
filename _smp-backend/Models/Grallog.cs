using System.ComponentModel.DataAnnotations.Schema;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel;

namespace SMP.Models
{
    [Table("grallog")]
    public class Grallog
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }

        [Column("id_project")]
        [DefaultValue(0)]
        public int? IdProject { get; set; }

        [Column("id_reporte")]
        [DefaultValue(0)]
        public int? IdReporte { get; set; }

        [Column("date")]
        public DateTime? Date { get; set; }

        [Column("id_log")]
        [DefaultValue(0)]
        public int? IdLog { get; set; }

        [Column("time")]
        [DefaultValue("sysdatetime()")]
        public TimeSpan? Time { get; set; }

        [Column("quantity")]
        [DefaultValue(0)]
        [Required]
        public int Quantity { get; set; }

        [Column("img")]
        [DefaultValue("IMAGEN")]
        [StringLength(250)]
        public string? Img { get; set; }

        [Column("type")]
        [DefaultValue("STAKEHOLD")]
        [Required]
        [StringLength(10)]
        public string Type { get; set; } = "STAKEHOLD";

        [Column("active")]
        [DefaultValue(true)]
        [Required]
        public bool Active { get; set; } = true;
    }
}