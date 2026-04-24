using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SMP.Models
{

    [Table("contractdetails")]
    public class ContractDetails
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        [Column("id")]
        public int Id { get; set; }

        [Column("id_contract")]
        public int IdContract { get; set; }

        [Column("document_name")]
        public string DocumentName { get; set; }

        [Column("url_document")]
        public string UrlDocument { get; set; }

        [Column("active")]
        public bool Active { get; set; } = true;
    }
}