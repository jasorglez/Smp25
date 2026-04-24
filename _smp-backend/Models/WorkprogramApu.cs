using System.ComponentModel;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SMP.Models
{
    [Table("workprogram_apu", Schema = "pu")]
    public class WorkprogramApu
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        [Column("id")]
        public int Id { get; set; }

        [Column("id_workprogram")]
        public int IdWorkprogram { get; set; }

        /// <summary>PERSONAL | MATERIAL | EQUIPO</summary>
        [Column("type", TypeName = "varchar(10)")]
        public string Type { get; set; } = string.Empty;

        /// <summary>ID suave al catálogo origen (materials.id, equipments.Id, posicion.Id)</summary>
        [Column("id_reference")]
        public int? IdReference { get; set; }

        /// <summary>Snapshot del nombre en el momento de agregar</summary>
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

        [Column("unit_cost_dll", TypeName = "decimal(18,4)")]
        public decimal? UnitCostDll { get; set; }

        /// <summary>Columna calculada: quantity * unit_cost — solo lectura</summary>
        [DatabaseGenerated(DatabaseGeneratedOption.Computed)]
        [Column("total", TypeName = "decimal(18,4)")]
        public decimal? Total { get; set; }

        [Column("apply_to_cost")]
        [DefaultValue(false)]
        public bool ApplyToCost { get; set; }

        [Column("active")]
        [DefaultValue(true)]
        public bool Active { get; set; } = true;
    }
}
