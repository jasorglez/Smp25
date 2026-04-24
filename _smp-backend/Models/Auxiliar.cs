using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SMP.Models
{
    [Table("auxiliares", Schema = "pu")]
    public class Auxiliar
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        [Column("Id")]
        public int Id { get; set; }

        [Column("id_company")]
        public int? IdCompany { get; set; }

        [Column("description", TypeName = "varchar(180)")]
        public string Description { get; set; } = string.Empty;

        [Column("unit", TypeName = "varchar(20)")]
        public string Unit { get; set; } = "M2";

        [Column("cost_mn", TypeName = "decimal(15,2)")]
        public decimal CostMN { get; set; } = 0;

        [Column("has_personal")]
        public bool HasPersonal { get; set; } = false;

        [Column("has_material")]
        public bool HasMaterial { get; set; } = false;

        [Column("has_herramienta")]
        public bool HasHerramienta { get; set; } = false;

        [Column("has_equipo")]
        public bool HasEquipo { get; set; } = false;

        [Column("active")]
        public bool Active { get; set; } = true;
    }
}
