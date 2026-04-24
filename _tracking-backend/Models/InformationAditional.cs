using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MicroServicioTracking.Models
{
    [Table("informationaditional")]
    public class InformationAditional
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }

        [Column("id_incorexp")]
        public int? IdIncorexp { get; set; }

        [Column("ordernumber")]
        [StringLength(25)]
        public string? OrderNumber { get; set; }

        [Column("id_typepay")]
        public int? IdTypepay { get; set; }

        [Column("quote")]
        [StringLength(15)]
        public string? Quote { get; set; }

        [Column("id_conditionspay")]
        public int? IdConditionspay { get; set; }

        [Column("purchaseorder")]
        [StringLength(15)]
        public string? PurchaseOrder { get; set; }
        
        [Column("id_typemoney")]
        public int? IdTypemoney { get; set; }

        [Column("numberentry")]
        [StringLength(20)]
        public string? NumberEntry { get; set; }

        [Column("foliofiscal")]
        [StringLength(80)]
        public string? FolioFiscal { get; set; }

        [Column("active")]
        public bool? Active { get; set; } = true;
    }
}