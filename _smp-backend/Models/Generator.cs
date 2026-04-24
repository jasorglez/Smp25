
using System.ComponentModel.DataAnnotations.Schema;
using System.ComponentModel.DataAnnotations;

namespace SMP.Models
{
    [Table("generators")]
    public class Generator
    {
        [Key]
        public int Id { get; set; }

        [Column("id_estimacion")]
        public int? IdEstimacion { get; set; }

        [Column("numero")]
        [StringLength(15)]
        public string? Numero { get; set; }

        [Column("datestart")]
        [DataType(DataType.Date)]
        public DateTime? DateStart { get; set; }

        [Column("dateend")]
        [DataType(DataType.Date)]
        public DateTime? DateEnd { get; set; }

        [Column("aplicaisometrico")]
        public bool AplicaIsometrico { get; set; } = false;

        [Column("creado")]
        public int? Creado { get; set; }

        [Column("revisado")]
        public int? Revisado { get; set; }

        [Column("autorizado")]
        public int? Autorizado { get; set; }

        [Column("fase")]
        [StringLength(20)]
        public string? Fase { get; set; }

        [Column("comment")]
        [StringLength(20)]
        public string? Comment { get; set; }

        [Column("active")]
        public bool Active { get; set; } = true;
    }
}