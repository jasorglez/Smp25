using System.ComponentModel.DataAnnotations.Schema;
using System.ComponentModel.DataAnnotations;

namespace SMP.Models
{

    [Table("analysis")]
    public class Analysi
    {

        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }

        [Column("id_identification")]
        public int? IdIdentification { get; set; }

        [StringLength(20)]
        [Column("idwp")]
        public string Idwp { get; set; }

        [Column("datestart")]
        public DateTime? DateStart { get; set; }

        [Column("dateend")]
        public DateTime? DateEnd { get; set; }

        [StringLength(2)]
        [Column("routecritica")]
        public string RouteCritica { get; set; } = "Si";

        [Column("severity")]
        public int? Severity { get; set; } = 1;

        [StringLength(20)]
        [Column("phase")]
        public string Phase { get; set; } = "Construccion";

        [Column("active")]
        public short Active { get; set; } = 1;
    }
}

