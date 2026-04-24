using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MicroServicioTracking.Models.View
{
    [Table("ActiveBranchIds")]
    public class ActiveBranchIds
    {

        [Column("id_company")]
        public int idCompany { get; set; }

        [Column("namesmall")]
        public string? NameSmall { get; set; }

        [Column("Branch_ids")]
        public string? BranchIds { get; set; }
    }
}