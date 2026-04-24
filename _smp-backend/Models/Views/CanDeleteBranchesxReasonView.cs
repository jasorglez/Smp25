using System.ComponentModel.DataAnnotations.Schema;
using System.ComponentModel.DataAnnotations;

namespace SMP.Models.Views;

[Table("CanDeleteBranchesxReason")]
public class CanDeleteBranchesxReasonView
{
    [Key]
    public int BranchId { get; set; }
    public int CanDelete { get; set; }
    public string Reasons { get; set; } = string.Empty;
}