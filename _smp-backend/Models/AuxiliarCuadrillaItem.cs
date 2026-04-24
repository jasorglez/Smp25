using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SMP.Models
{
    [Table("auxiliar_cuadrilla_item", Schema = "pu")]
    public class AuxiliarCuadrillaItem
    {
        [Key][DatabaseGenerated(DatabaseGeneratedOption.Identity)][Column("id")]
        public int Id { get; set; }

        [Column("id_cuadrilla")]
        public int IdCuadrilla { get; set; }

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
