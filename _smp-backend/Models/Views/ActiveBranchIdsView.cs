using System.ComponentModel.DataAnnotations.Schema;
using System.ComponentModel.DataAnnotations;

namespace SMP.Models.Views;

[Table("ActiveBranchIds")]
public class ActiveBranchIdsView
{
    [Key]
    public int Id_company { get; set; }
    public string? Branch_ids { get; set; }
}
