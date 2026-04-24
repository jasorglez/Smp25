using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MicroServicioTracking.Models
{
    [Table("documentoscomprobados")]
    public class DocumentsComprobados
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Required]
        [Column("id_incorexp")]
        public int Idincorexp { get; set; }

        [Required]
        [Column("id_spend")]
        public int IdSpend { get; set; }

        [Required]
        [StringLength(20)]
        [Column("tipo_documento")]
        public string TipoDocumento { get; set; }   // XML, PDF, IMG, RECIBO

        [StringLength(36)]
        [Column("uuid_cfdi")]
        public string? UuidCfdi { get; set; }

        [StringLength(500)]
        [Column("nombre_archivo")]
        public string? NombreArchivo { get; set; }

     
        [Column("valido")]
        public bool Valido { get; set; } = false;

        [StringLength(50)]
        [Column("created_by")]
        public string? CreatedBy { get; set; }

        [Required]
        [Column("created_at")]
        public DateTime CreatedAt { get; set; }

        [StringLength(50)]
        [Column("modified_by")]
        public string? ModifiedBy { get; set; }

        [Column("modified_at")]
        public DateTime? ModifiedAt { get; set; }

        [Required]
        [Column("active")]
        public bool Active { get; set; } = true;
    }
}
