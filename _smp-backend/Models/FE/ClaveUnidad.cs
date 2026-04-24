using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SMP.Models.FE
{
    [Table("claveunidad", Schema = "FE")]
    public class ClaveUnidad
    {
        [Key]
        public int Id { get; set; }

        [Column("claveunidad")]
        [StringLength(10)]
        public string? ClaveUnidadValue { get; set; }

        [Column("nombre")]
        [StringLength(150)]
        public string? Nombre { get; set; }

        [Column("descripcion")]
        public string? Descripcion { get; set; }

        [Column("nota")]
        public string? Nota { get; set; }

        [Column("iniciovigencia")]
        public DateTime? Iniciovigencia { get; set; }

        [Column("finvigencia")]
        public DateTime? Finvigencia { get; set; }

        [Column("simbolo")]
        [StringLength(30)]
        public string? Simbolo { get; set; }

        [Column("active")]
        [Required]
        public bool Active { get; set; } = true;
    }
}