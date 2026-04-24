using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SMP.Models
{
    [Table("mano_obra", Schema = "pu")]
    public class ManoObra
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        [Column("id")]
        public int Id { get; set; }

        [Column("id_company")]
        public int? IdCompany { get; set; }

        [Column("description", TypeName = "varchar(100)")]
        public string Description { get; set; } = string.Empty;

        [Column("unit", TypeName = "varchar(20)")]
        public string Unit { get; set; } = "JORNADA";

        [Column("unit_price", TypeName = "decimal(15,2)")]
        public decimal UnitPrice { get; set; } = 0;

        [Column("costo", TypeName = "decimal(15,2)")]
        public decimal? Costo { get; set; } = 0;

        [Column("quantity", TypeName = "decimal(15,4)")]
        public decimal Quantity { get; set; } = 1;

        [Column("active")]
        public bool Active { get; set; } = true;
    }
}
