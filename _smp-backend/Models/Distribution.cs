using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SMP.Models
{
    [Table("distributions", Schema = "pu")]
    public class Distribution
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        [Column("Id")]
        public int Id { get; set; }

        [Column("id_company")]
        public int? IdCompany { get; set; }

        [Column("id_reference")]
        public int? IdReference { get; set; }

        [Column("type", TypeName = "varchar(15)")]
        public string? Type { get; set; }

        [Column("year")]
        public int? Year { get; set; }

        [Column("month")]
        public int? Month { get; set; }

        [Column("quantity", TypeName = "decimal(15,3)")]
        public decimal Quantity { get; set; } = 0;

        [Column("active")]
        public bool Active { get; set; } = true;
    }
}
