using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SMP.Models.FE
{
    [Table("ClaveProdServ", Schema = "FE")]
    public class ClaveProdServ
    {
        [Key]
        public int Id { get; set; }

        [Column("ClaveProdServ")]
        public int? ClaveProdServValue { get; set; }

        [Column("Descripcion")]
        [StringLength(150)]
        public string? Descripcion { get; set; }

        [Column("IncluirIVATraslado")]
        [StringLength(50)]
        public string? IncluirIVATraslado { get; set; }

        [Column("IncluirIEPSTraslado")]
        [StringLength(50)]
        public string? IncluirIEPSTraslado { get; set; }

        [Column("Complemento")]
        [StringLength(50)]
        public string? Complemento { get; set; }

        [Column("iniciovigencia")]
        public DateTime? Iniciovigencia { get; set; }

        [Column("finvigencia")]
        public DateTime? Finvigencia { get; set; }

        [Column("EstimuloFranja")]
        public bool? EstimuloFranja { get; set; }

        [Column("PalabrasSimilares")]
        [StringLength(250)]
        public string? PalabrasSimilares { get; set; }

        [Column("active")]
        [Required]
        public bool Active { get; set; } = true;
    }
}