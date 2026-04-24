using System.ComponentModel.DataAnnotations.Schema;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel;

namespace SMP.Models
{
    [Table("identificationrisk")]
    public class Identificationrisk
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }

        [Column("id_project")]
        [DefaultValue(0)]
        public int? IdProject { get; set; }

        [Column("classification")]
        [StringLength(10)]
        [DefaultValue("Tecnico")]
        public string Classification { get; set; }

        [Column("date")]
        [DatabaseGenerated(DatabaseGeneratedOption.Computed)]
        public DateTime? Date { get; set; }

        [Column("description")]
        [DefaultValue("Description")]
        public string Description { get; set; }

        [Column("cause")]
        [DefaultValue("Cause")]
        public string Cause { get; set; }

        [Column("typerisk")]
        [StringLength(10)]
        [DefaultValue("Negativo")]
        public string TypeRisk { get; set; }

        [Column("ownerrisk")]
        [StringLength(10)]
        [DefaultValue("Pemex")]
        public string OwnerRisk { get; set; }

        [Column("active")]
        [Required]
        [DefaultValue(true)]
        public bool Active { get; set; }
    }
}