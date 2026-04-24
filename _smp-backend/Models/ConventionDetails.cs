using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SMP.Models
{
    [Table("conventiondetails")]
    public class ConventionDetails
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        [Column("id")]
        public int Id { get; set; }

        [Column("id_convention")]
        public int IdConvention { get; set; }

        [Column("document_name")]
        public string DocumentName { get; set; }

        [Column("url_document")]
        public string UrlDocument { get; set; }

        [Column("active")]
        public bool Active { get; set; } = true;
    }
}