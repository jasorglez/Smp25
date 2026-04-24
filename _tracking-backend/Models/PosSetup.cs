using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MicroServicioTracking.Models;

[Table("setupadministration")]
public class PosSetup
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    [Column("id")]
    public int Id { get; set; }
    
    [Column("id_branch")]
    public int IdBranch { get; set; }
    
    [Column("id_customer")]
    public int IdCustomer { get; set; }

    [Column("id_document_type")]
    public int? IdDocumentType { get; set; }

    [Column("prefix")]
    [MaxLength(50)]
    public string? Prefix { get; set; }
    
    [Column("consecutive")]
    public int? Consecutive { get; set; }
    
    [Column("salesexistence")]
    public bool? SalesExistence { get; set; }
    
    [Column("printscreen")]
    public bool? PrintScreen { get; set; }
    
    [Required]
    public bool Active { get; set; } = true;    
}