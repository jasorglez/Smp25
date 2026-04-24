using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SMP.Models.FE
{
    [Table("moneda", Schema = "FE")]
    public class Moneda
    {
        [Key]
        public int Id { get; set; }

        [Column("c_Moneda")]
        [StringLength(5)]
        public string? CMoneda { get; set; }

        [Column("descripcion")]
        [StringLength(100)]
        public string? Descripcion { get; set; }

        [Column("decimales")]
        [StringLength(10)]
        public string? Decimales { get; set; }

        [Column("porcentaje")]
        [StringLength(5)]
        public string? Porcentaje { get; set; }

        [Column("iniciovigencia")]
        public DateTime? Iniciovigencia { get; set; }

        [Column("finvigencia")]
        public DateTime? Finvigencia { get; set; }

        [Column("active")]
        [Required]
        public bool Active { get; set; } = true;
    }
}