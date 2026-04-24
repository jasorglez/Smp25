using System.ComponentModel;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SMP.Models
{
    [Table("workprogram_apu_cuadrilla_item", Schema = "pu")]
    public class WorkprogramApuCuadrillaItem
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        [Column("id")]
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
        [DefaultValue(0)]
        public decimal Quantity { get; set; }

        [Column("unit_cost", TypeName = "decimal(18,4)")]
        [DefaultValue(0)]
        public decimal UnitCost { get; set; }

        [Column("active")]
        [DefaultValue(true)]
        public bool Active { get; set; } = true;
    }
}
