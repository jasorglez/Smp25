using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MicroServicioTracking.Models.View
{
    [Table("cashregisterxbranchs")]
    public class CashRegisterXBranchs
    {

        [Column("idstore")]
        public int IdStore { get; set; }

        [Column("idcaja")]
        public int IdCaja { get; set; }

        [Column("description")]
        public string? Description { get; set; }

        [Column("desccashregister")]
        public string? DescCashRegister { get; set; }

        [Column("idbranch")]
        public int IdBranch { get; set; }

        [Column("name")]
        public string? Name { get; set; }

        [Column("idroot")]
        public int IdRoot { get; set; }

        [Column("namesmall")]
        public string? NameSmall { get; set; }
    }
}