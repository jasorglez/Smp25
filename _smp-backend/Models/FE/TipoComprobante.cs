using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SMP.Models.FE
{
    [Table("tipocomprobante", Schema = "FE")]
    public class TipoComprobante
    {
        [Key]
        public int Id { get; set; }

        [Column("tipodecomprobante")]
        [StringLength(1)]
        public string? TipoDeComprobante { get; set; }

        [Column("descripcion")]
        [StringLength(9)]
        public string? Descripcion { get; set; }

        [Column("valormaximo")]
        [StringLength(25)]
        public string? ValorMaximo { get; set; }

        [Column("iniciovigencia")]
        public DateTime? Iniciovigencia { get; set; }

        [Column("finvigencia")]
        public DateTime? Finvigencia { get; set; }

        [Column("active")]
        [Required]
        public bool Active { get; set; } = true;
    }
}