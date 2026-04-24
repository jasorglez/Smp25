using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SMP.Models
{
    [Table("equipments")]
    public class Equipment
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        [Column("Id")]
        public int Id { get; set; }

        [Column("id_company")]
        public int? IdCompany { get; set; }

        [Column("id_branch")]
        public int? IdBranch { get; set; }

        [Column("id_typequipment")]
        public int? IdTypeEquipment { get; set; }

        [Column("description", TypeName = "varchar(480)")]
        public string? Description { get; set; }

        [Column("asset_type", TypeName = "varchar(50)")]
        public string? AssetType { get; set; }

        [Column("measure", TypeName = "varchar(5)")]
        public string Measure { get; set; } = "DIA";

        [Column("quantity", TypeName = "decimal(15,3)")]
        public decimal Quantity { get; set; } = 1;

        [Column("costMN", TypeName = "decimal(15,2)")]
        public decimal CostMN { get; set; } = 0;

        [Column("costDLL", TypeName = "decimal(15,2)")]
        public decimal CostDLL { get; set; } = 0;

        [Column("priceMN", TypeName = "decimal(15,2)")]
        public decimal PriceMN { get; set; } = 0;

        [Column("priceDLL", TypeName = "decimal(15,2)")]
        public decimal PriceDLL { get; set; } = 0;

        [Column("dayswork")]
        public int DaysWork { get; set; } = 8;

        [Column("imprimir")]
        public bool Print { get; set; } = true;

        [Column("charged")]
        public bool Charged { get; set; } = true;

        [Column("active")]
        public bool Active { get; set; } = true;

        [Column("totalMN")]
        [DatabaseGenerated(DatabaseGeneratedOption.Computed)]
        public decimal? TotalMN { get; set; }
    }
}
