using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MicroServicioTracking.Models
{
    [Table("RemisionesDetalle", Schema = "logistica")]
    public class RemisionDetalle
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }

        [Column("idRemision")]
        public int IdRemision { get; set; }

        [Column("idDetallePedido")]
        public int IdDetallePedido { get; set; }

        [Column("cantidadRemitida", TypeName = "decimal(18,2)")]
        public decimal CantidadRemitida { get; set; }

        [StringLength(500)]
        [Column("comentario")]
        public string? Comentario { get; set; }

        [Column("fechaCreacion")]
        public DateTime FechaCreacion { get; set; }

        [Column("active")]
        public bool Active { get; set; } = true;
    }
}
