using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MicroServicioTracking.Models
{
    [Table("cuentascontables")]
    public class CuentasContables
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        [Column("id")]
        public int Id { get; set; }

        
        [StringLength(20)]
        [Column("codigo")]
        public string? Codigo { get; set; }

        [Required]
        [StringLength(255)]
        [Column("nombre")]
        public string Nombre { get; set; }

        [Column("descripcion")]
        public string? Descripcion { get; set; }
 
        [Column("nivel")]
        public int? Nivel { get; set; }

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
