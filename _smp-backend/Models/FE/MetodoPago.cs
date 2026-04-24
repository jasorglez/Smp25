using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SMP.Models.FE
{
    [Table("metodopago", Schema = "FE")]
    public class MetodoPago
    {
        [Key]
        public int Id { get; set; }

        [Column("metodopago")]
        [StringLength(3)]
        public string? MetodoPagoValue { get; set; }

        [Column("descripcion")]
        [StringLength(40)]
        public string? Descripcion { get; set; }

        [Column("iniciovigencia")]
        public DateTime? Iniciovigencia { get; set; }

        [Column("finvigencia")]
        public DateTime? Finvigencia { get; set; }

        [Column("active")]
        [Required]
        public bool Active { get; set; } = true;
    }
}