using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MicroServicioTracking.Models
{
    [Table("salesxconcept")]
    public class Salesxconcept
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }

        [Column("id_product")]
        public int? IdProduct { get; set; }

        [Column("id_sale")]
        public int? IdSale { get; set; }

        [Column("quantity", TypeName = "decimal(18,2)")]
        public decimal? Quantity { get; set; }

        [Column("pu", TypeName = "decimal(18,2)")]
        public decimal? Pu { get; set; }

        // La propiedad total es calculada por la base de datos
        [Column("total", TypeName = "decimal(18,2)")]
        [DatabaseGenerated(DatabaseGeneratedOption.Computed)]
        public decimal? Total { get; set; }

        [Column("unit")]
        public bool? Unit { get; set; }

        [Column("boxnumber")]
        public int? BoxNumber { get; set; }

        [Column("unitnumber")]
        public int? UnitNumber { get; set; }

        [Column("active")]
        public bool? Active { get; set; } = true;

        // Navigation properties
        [ForeignKey("IdSale")]
        public virtual Salesxcustomer? Sale { get; set; }
    }
}