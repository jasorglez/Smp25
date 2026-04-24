using System.ComponentModel.DataAnnotations.Schema;
using System.ComponentModel.DataAnnotations;

namespace MicroServicioTracking.Models
{
    [Table("incomeandexpensexroot")]
   public class IncomeAndExpenseRoot
    {
        // Root properties
        [Key]
        public int IdRoot { get; set; }

        [StringLength(100)]
        public string Name { get; set; }

        public int Id_branch { get; set; }

        [StringLength(100)]
        public string Namebranch { get; set; }

        public int? IdMaster { get; set; }

        [StringLength(50)]
        public string? Numberdocument { get; set; }

        public int? Id_account { get; set; }

        [Column("id_businnes")]
        public int? Id_business { get; set; }


        public DateTime? Date { get; set; }

        public int? Id_customer { get; set; }

        public int? Id_expend { get; set; }

        [StringLength(50)]
        public string? Uuid { get; set; }

        public DateTime? Datestamped { get; set; }

        [StringLength(20)]
        public string? Payment_month { get; set; }

        [StringLength(255)]
        public string? Description { get; set; }

        [StringLength(10)]
        [Column("type")]
        public string? Type { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? Subtotal { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? Tax { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? Total { get; set; }

        [StringLength(50)]
        public string CreatedBy { get; set; }

        public DateTime? CreatedAt { get; set; }

        [StringLength(50)]
        public string? ModifiedBy { get; set; }

        public DateTime? ModifiedAt { get; set; }

        [StringLength(50)]
        public string Status { get; set; }

        public bool? Active { get; set; }

        // Detalle properties
        public int? IdDetalle { get; set; }

        public int? Id_incorexp { get; set; }

        [StringLength(50)]
        public string Typeexpense { get; set; }

        public int? Id_spend { get; set; }

        public DateTime? Dateexpend { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? Quantity { get; set; }

        [StringLength(255)]
        public string Descdetalle { get; set; }

        [StringLength(50)]
        public string? Unit { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? Price { get; set; }
        public bool? Iva { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? Iva2 { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? TotalDetalle { get; set; }

        [StringLength(255)]
        public string Comment { get; set; }

        public bool? ActiveDetalle { get; set; }
    }
}