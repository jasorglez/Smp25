using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SMP.Models
{
    [Table("auxiliar_items", Schema = "pu")]
    public class AuxiliarItem
    {
        [Key][DatabaseGenerated(DatabaseGeneratedOption.Identity)][Column("id")]
        public int Id { get; set; }

        [Column("id_auxiliar")]
        public int IdAuxiliar { get; set; }

        [Column("type", TypeName = "varchar(10)")]
        public string Type { get; set; } = string.Empty;

        [Column("id_reference")]
        public int? IdReference { get; set; }

        [Column("description", TypeName = "varchar(180)")]
        public string Description { get; set; } = string.Empty;

        [Column("unit", TypeName = "varchar(20)")]
        public string? Unit { get; set; }

        [Column("quantity", TypeName = "decimal(18,4)")]
        public decimal Quantity { get; set; }

        [Column("unit_cost", TypeName = "decimal(18,4)")]
        public decimal UnitCost { get; set; }

        [Column("active")]
        public bool Active { get; set; } = true;
    }
}
