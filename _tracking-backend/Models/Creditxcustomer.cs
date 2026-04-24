using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MicroServicioTracking.Models
{
    [Table("creditsxcustomers")]
    public class Creditxcustomer
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }

        [Column("id_customer")]
        public int? IdCustomer { get; set; }

        [Column("id_proveedorxtablas")]
        public int? IdProveedorXTablas { get; set; }

        [Column("numbernote")]
        [MaxLength(20)]
        public string? NumberNote { get; set; }

        [Column("date")]
        public DateTime? Date { get; set; }

        [Column("total", TypeName = "decimal(12,2)")]
        public decimal? Total { get; set; }

        [Column("account", TypeName = "decimal(12,2)")]
        public decimal? Account { get; set; }
        
        [Column("remain")]
        [DatabaseGenerated(DatabaseGeneratedOption.Computed)]
        public decimal? Remain => Total - Account;

        [Column("type")]
        [MaxLength(10)]
        public string? Type { get; set; }

        [Column("comments")]
        [MaxLength(200)]
        public string? Comments { get; set; }

        [Column("active")]
        public bool? Active { get; set; } = true;

        // Navigation property for Customer relationship
        [ForeignKey("IdCustomer")]
        public virtual Customer? Customer { get; set; }
    }
}
