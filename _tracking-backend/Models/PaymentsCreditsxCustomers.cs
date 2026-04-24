using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MicroServicioTracking.Models;

[Table("paymentscreditsxcustomers")]
public class PaymentsCreditsxCustomers
{
    [Key]
    [Column("id")]
    public int Id { get; set; }
    
    [Column("id_credit")]
    public int IdCredit { get; set; }

    [Column("comments")]
    public string? Comments { get; set; }
    
    [Column("date_payment")]
    public DateTime? DatePayment { get; set; }
    
    [Column("amount")]
    public decimal Amount { get; set; }

    [Column("active")] public bool Active { get; set; } = true;
}