using System.ComponentModel.DataAnnotations.Schema;
using System.ComponentModel.DataAnnotations;

namespace SMP.Models.Views;

[Table("companyandbranch")]
public class CompanyAndBranchView
{
    public int Id { get; set; }
    public int Id_User { get; set; }
    public int IdPerm { get; set; }
    public string Type { get; set; }
    public string? Namesmall { get; set; }
    public bool? Advanced { get; set; }
    public int Orden { get; set; }
}
