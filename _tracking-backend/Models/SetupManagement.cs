using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MicroServicioTracking.Models;

[Table(("setupmanagement"))]
public class SetupManagement
{
    [Key]
    [Column("id")]
    public int Id { get; set; }
    
    [Column("id_root")]
    public int IdRoot { get; set; }
    
    [Column("directorname")]
    public string DirectorName { get; set; }
    
    [Column("directortitle")]
    public string DirectorTitle { get; set; }
    
    [Column("gerencyname")]
    public string GerencyName { get; set; }
    
    [Column("gerencytitle")]
    public string GerencyTitle { get; set; }
    
    [Column("administratorname")]
    public string AdministratorName { get; set; }
    
    [Column("administratortitle")]
    public string AdministratorTitle { get; set; }
    
    [Column("operatorname")]
    public string OperatorName { get; set; }
    
    [Column("operatortitle")]
    public string OperatorTitle { get; set; }
    
    [Column("consecutive_receipt")]
    public int ConsecutiveReceipt { get; set; }
    
    [Column("consecutive_credit_note")]
    public int ConsecutiveCreditNote { get; set; }
    
    [Column("iva")]
    public Decimal Iva { get; set; }

    [Column("active")]
    public bool Active { get; set; } = true;

}