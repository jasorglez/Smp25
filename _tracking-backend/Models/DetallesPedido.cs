using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace MicroServicioTracking.Models
{
    [Table("detallespedidos", Schema = "logistica")]
    public class DetallesPedido
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }

        [Column("id_pedido")]
        public int? IdPedido { get; set; }

        [Column("id_cliente")]
        public int IdCliente { get; set; }

        [StringLength(150)]
        [Column("producto")]
        public string? Producto { get; set; }

        [Column("cantidad")]
        public int Cantidad { get; set; } = 1;

        [StringLength(40)]
        [Column("plataforma")]
        public string? Plataforma { get; set; }

        [Column("aplicaimpuestos")]
        [JsonPropertyName("aplicaimpuestos")]
        public bool? AplicaImpuestos { get; set; }

        [Column("costo")]
        public decimal? Costo { get; set; }

        [Column("venta")]
        public decimal? Venta { get; set; }

        [Column("impuesto")]
        public decimal? Impuesto { get; set; }

        [StringLength(15)]
        [Column("estado")]
        public string? Estado { get; set; }

        [StringLength(50)]
        [Column("comentario")]
        public string? Comentario { get; set; }

        [Column("active")]
        public bool? Active { get; set; }
    }
}