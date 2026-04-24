using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SMP.Models
{
    [Table("herramientas", Schema = "pu")]
    public class Herramienta
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
        public string Unit { get; set; } = "HR";

        [Column("cost_mn", TypeName = "decimal(15,2)")]
        public decimal CostMN { get; set; } = 0;

        [Column("active")]
        public bool Active { get; set; } = true;
    }
}
