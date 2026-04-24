using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MicroServicioTracking.Models
{
    [Table("Remisiones", Schema = "logistica")]
    public class Remision
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }

        [Column("idCompany")]
        public int IdCompany { get; set; }

        [Column("idCliente")]
        public int IdCliente { get; set; }

        [StringLength(30)]
        [Column("folio")]
        public string Folio { get; set; } = string.Empty;

        [Column("fechaCreacion")]
        public DateTime FechaCreacion { get; set; }

        [Column("fechaCierre")]
        public DateTime? FechaCierre { get; set; }

        [StringLength(20)]
        [Column("estado")]
        public string Estado { get; set; } = "ABIERTA";

        [StringLength(500)]
        [Column("comentario")]
        public string? Comentario { get; set; }

        [StringLength(150)]
        [Column("createdBy")]
        public string? CreatedBy { get; set; }

        [StringLength(150)]
        [Column("closedBy")]
        public string? ClosedBy { get; set; }

        [Column("active")]
        public bool Active { get; set; } = true;
    }
}
