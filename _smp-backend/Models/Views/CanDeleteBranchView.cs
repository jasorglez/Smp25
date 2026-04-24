using System.ComponentModel.DataAnnotations.Schema;
using System.ComponentModel.DataAnnotations;

namespace SMP.Models.Views;

[Table("CanDeleteBranch")]
public class CanDeleteBranchView
{
    [Key]
    public int BranchId { get; set; }
    public int CanDelete { get; set; }
}
