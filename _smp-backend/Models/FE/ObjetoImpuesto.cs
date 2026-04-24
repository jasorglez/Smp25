using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SMP.Models.FE
{
    [Table("objetoimpuesto", Schema = "FE")]
    public class ObjetoImpuesto
    {
        [Key]
        public int Id { get; set; }

        [Column("objeto")]
        [StringLength(3)]
        public string? Objeto { get; set; }

        [Column("descripcion")]
        [StringLength(50)]
        public string? Descripcion { get; set; }

        [Column("iniciovigencia")]
        public DateTime? InicioVigencia { get; set; }

        [Column("finvigencia")]
        public DateTime? FinVigencia { get; set; }

        [Column("active")]
        [Required]
        public bool Active { get; set; } = true;
    }
}