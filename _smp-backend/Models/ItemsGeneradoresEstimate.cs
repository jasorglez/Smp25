using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.ComponentModel;

namespace SMP.Models
{
    [Table("itemsgeneradoresestimates")]
    public class ItemsGeneradoresEstimate
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        [Column("Id", TypeName = "int")]
        public int Id { get; set; }

        [Column("id_type", TypeName = "int")]
        public int? IdType { get; set; }

        [Column("id_resource", TypeName = "int")]
        public int? IdResource { get; set; }

        [Column("quantity", TypeName = "decimal(14,2)")]
        public decimal? Quantity { get; set; }

        [Column("accumulate", TypeName = "decimal(14,2)")]
        public decimal? Accumulate { get; set; }

        [Column("type", TypeName = "varchar(10)")]
        public string? Type { get; set; }

        [Column("comment", TypeName = "varchar(20)")]
        public string? Comment { get; set; }

        [Column("active", TypeName = "bit")]
        [DefaultValue(1)]
        public bool Active { get; set; } = true;
    }
}
