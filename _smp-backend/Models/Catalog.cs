using System.ComponentModel.DataAnnotations.Schema;
using System.ComponentModel.DataAnnotations;

namespace SMP.Models
{

        [Table("catalog")]
        public class Catalog
        {
            [Key]
            [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
            public int Id { get; set; }

            [Column("id_company")]
            public int? IdCompany { get; set; }

            [StringLength(100)]
            [Column("description")]
            public string Description { get; set; } = "Description Catalog";

            [StringLength(25)]
            [Column("valueaddition")]
            public string? ValueAddition { get; set; } = "NA";

            [StringLength(25)]
            [Column("valueaddition2")]
            public string? ValueAddition2 { get; set; } = "NA";

            [Column("valueadditionbit")]
            public bool? ValueAdditionBit { get; set; }
            
            [Column("valueadditionbit2")]
            public bool? ValueAdditionBit2 { get; set; } = false;
            [Column("valueadditionbit3")]
            public bool? ValueAdditionBit3 { get; set; } = false;

            [Column("vigente")]
            public bool? Vigente { get; set; }

            [StringLength(13)]
            [Column("type")]
            public string Type { get; set; } = "MEASURE";

            [Column("parent_id")]
            public int? ParentId { get; set; }

            [Column("subparent_id")]
            public int? SubParentId { get; set; }

            [Column("price")]
            public decimal? Price { get; set; }

            [Column("active")]
            public short Active { get; set; } = 1;

    }
}
