
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MicroServicioTracking.Models
{
    [Table("expensecategories")]
    public class expensecategory
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }

        [Column("id_businnes")]
        public int? IdBusinnes { get; set; }

        [Required]
        [MaxLength(20)]
        public string Code { get; set; }

        [Required]
        [MaxLength(100)]
        public string Name { get; set; }

        [MaxLength(20)]
        [Column("type")]
        public string Type { get; set; } = "Variable";

        [ForeignKey("ParentCategory")]
        public int? ParentCategoryId { get; set; }

        [Column(TypeName = "decimal(18, 2)")]
        public decimal? MaxAmount { get; set; } = 0;

        public bool? RequiresApproval { get; set; } = false;

        public byte? ApprovalLevel { get; set; } = 0;

        [MaxLength(50)]
        public string? CostCenter { get; set; }

        [MaxLength(50)]
        public string? AccountingCode { get; set; }

        [Required]
        [MaxLength(20)]
        public string? TaxType { get; set; } = "0.16";

        [Column(TypeName = "decimal(5, 2)")]
        public decimal? DeductiblePercentage { get; set; } = 0;

        public bool? RequiresVoucher { get; set; } = true;

        [Required]
        [MaxLength(50)]
        public string CreatedBy { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.Now;

        [MaxLength(50)]
        public string? ModifiedBy { get; set; }

        public DateTime? ModifiedAt { get; set; }

        public bool Active { get; set; } = true;

        // Navigation Property
        public virtual expensecategory ParentCategory { get; set; }
    }
}
