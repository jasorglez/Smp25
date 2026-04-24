using System.ComponentModel.DataAnnotations.Schema;

namespace MicroServicioTracking.Models.View
{
    [Table("allbranchs")]
    public class AllBranchsView
    {
        public int Id { get; set; }
        public int Id_User { get; set; }
        public int IdPerm { get; set; }
        public string Type { get; set; }
        public string? Name { get; set; }
        public int? Id_Company { get; set; }
    }
}
