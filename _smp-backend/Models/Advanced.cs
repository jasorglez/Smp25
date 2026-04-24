using System.ComponentModel.DataAnnotations.Schema;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel;

namespace SMP.Models
{

[Table("advanced")]
    public class Advanced
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        [Column("id")]
        public int Id { get; set; }

        [Column("id_contract", TypeName = "int")]
        public int? IdContract { get; set; }

        [Column("id_project", TypeName = "int")]
        public int? IdProject { get; set; }

        [Column("id_convenio")]
        public int IdConvenio { get; set; }

        [StringLength(10)]
        [Column("type", TypeName = "nvarchar(10)")]
        public string Type { get; set; } = "PROYECTO";

        [Column("date")]
        public DateTime? Date { get; set; }

        [Column("physicaladvanced")]
        [DefaultValue(0)]
        public decimal? PhysicalAdvanced { get; set; }

        [Column("programadvanced")]
        [DefaultValue(0)]
        public decimal? ProgramAdvanced { get; set; }

        [Column("accumulateprogram")]
        [DefaultValue(0)]
        public decimal? AccumulateProgram { get; set; }
                        
        [Column("accumulatephysical")]
        [DefaultValue(0)]
        public decimal? AccumulatePhysical { get; set; }

        [Column("active")]
        [Required]
        [DefaultValue(1)]
        public short Active { get; set; }
    }

}
