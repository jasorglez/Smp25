using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MicroServicioTracking.Models.Palacio
{
    [Table("objetogasto")]
    public class ObjetoGasto
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        [Column("id")]
        public int Id { get; set; }

        [Required]
        [StringLength(10)]
        [Column("codigo")]
        public string Codigo { get; set; }

        [Required]
        [StringLength(500)]
        [Column("nombre")]
        public string Nombre { get; set; }

        [Column("descripcion")]
        public string? Descripcion { get; set; }

        [Required]
        [Column("nivel")]
        public int Nivel { get; set; }

        [Column("idPadre")]
        public int? IdPadre { get; set; }

        [Column("esHoja")]
        public bool EsHoja { get; set; } = false;

        [Required]
        [Column("idCompany")]
        public int IdCompany { get; set; }

        [Column("createdAt")]
        public DateTime? CreatedAt { get; set; }

        [Column("updatedAt")]
        public DateTime? UpdatedAt { get; set; }

        [Column("active")]
        public bool Active { get; set; } = true;
    }
}
