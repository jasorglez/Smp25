using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MicroServicioTracking.Models
{
    [Table("salesxcustomer")]
    public class Salesxcustomer
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }

        [Column("id_customer")]
        public int? IdCustomer { get; set; }

        [Column("numbernote")]
        [MaxLength(20)]
        public string? NumberNote { get; set; }

        [Column("date")]
        public DateTime? Date { get; set; }

        [Column("lector")]
        public bool? Lector { get; set; }

        [Column("credit")]
        public bool? Credit { get; set; }

        [Column("amount", TypeName = "decimal(18)")]
        public decimal? Amount { get; set; }

        [Column("active")]
        public bool? Active { get; set; } = true;

        // Navigation property for Customer relationship
        [ForeignKey("IdCustomer")]
        public virtual Customer? Customer { get; set; }
    }
}