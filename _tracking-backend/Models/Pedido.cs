using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MicroServicioTracking.Models
{
    [Table("pedidos", Schema = "logistica")]
    public class Pedido
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }

        [Column("id_company")]
        public int? IdCompany { get; set; }

        [StringLength(15)]
        [Column("numero")]
        public string? Numero { get; set; }

        [Column("fecha")]
        public DateTime? Fecha { get; set; }

        [Column("numarticulos")]
        public int? NumArticulos { get; set; }

        [StringLength(30)]
        [Column("comentario")]
        public string? Comentario { get; set; }

        [Column("active")]
        public bool? Active { get; set; }

        [StringLength(150)]
        [Column("banco")]
        public string? Banco { get; set; }

        [Column("totalPagarBanco", TypeName = "decimal(18,2)")]
        public decimal? TotalPagarBanco { get; set; }

        [Column("impuesto", TypeName = "decimal(5,2)")]
        public decimal? Impuesto { get; set; }
    }
}
