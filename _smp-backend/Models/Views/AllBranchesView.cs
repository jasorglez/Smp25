using System.ComponentModel.DataAnnotations.Schema;
using System.ComponentModel.DataAnnotations;

namespace SMP.Models.Views;

[Table("allbranchs")]
public class AllBranchesView
{
    public int Id { get; set; }
    public int Id_User { get; set; }
    public int IdPerm { get; set; }
    public string Type { get; set; }
    public string? Name { get; set; }    
    public int? Id_Company { get; set; }
}
