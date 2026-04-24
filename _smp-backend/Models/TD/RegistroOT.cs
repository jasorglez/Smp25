using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SMP.Models.TD
{
    [Table("RegistroOT")]
    public class RegistroOT
    {
        [Key]
        public int Id { get; set; }
        
        [Required]
        [StringLength(50)]
        public string OT { get; set; } = string.Empty;
        
        [Required]
        public DateTime FechaRegistro { get; set; }
        
        [Required]
        public DateTime FechaPlazo { get; set; }
        
        [StringLength(1000)]
        public string? Descripcion { get; set; }
        
        [StringLength(2000)]
        public string? Observaciones { get; set; }
        
        [StringLength(2000)]
        public string? Resultados { get; set; }
        
        [Required]
        public int TipoResultadoId { get; set; }
        
        public DateTime FechaCreacion { get; set; } = DateTime.UtcNow;
        
        public DateTime? FechaActualizacion { get; set; }
        
        public bool Activo { get; set; } = true;
        
        // Navegación
        public virtual ICollection<RegistroOTEmpleado> RegistroOTEmpleados { get; set; } = new List<RegistroOTEmpleado>();
        public virtual ICollection<MultimediaMetadata> ArchivosMultimedia { get; set; } = new List<MultimediaMetadata>();
    }
    
    [Table("RegistroOTEmpleado")]
    public class RegistroOTEmpleado
    {
        [Key]
        public int Id { get; set; }
        
        [Required]
        public int RegistroOTId { get; set; }
        
        [Required]
        public int EmpleadoId { get; set; }
        
        public DateTime FechaAsignacion { get; set; } = DateTime.UtcNow;
        
        // Navegación
        [ForeignKey("RegistroOTId")]
        public virtual RegistroOT RegistroOT { get; set; } = null!;
    }
    
    [Table("MultimediaMetadata")]
    public class MultimediaMetadata
    {
        [Key]
        public int Id { get; set; }
        
        [Required]
        public int RegistroOTId { get; set; }
        
        [Required]
        [StringLength(500)]
        public string UrlFirebase { get; set; } = string.Empty;
        
        [Required]
        public DateTime FechaCaptura { get; set; }
        
        [Required]
        public DateTime FechaSubida { get; set; }
        
        [Required]
        public long TamanoBytes { get; set; }
        
        [Required]
        [StringLength(10)]
        public string TipoArchivo { get; set; } = string.Empty; // "foto" o "video"
        
        [Required]
        [StringLength(200)]
        public string NombreArchivo { get; set; } = string.Empty;
        
        public DateTime FechaCreacion { get; set; } = DateTime.UtcNow;
        
        public bool Activo { get; set; } = true;
        
        // Navegación
        [ForeignKey("RegistroOTId")]
        public virtual RegistroOT RegistroOT { get; set; } = null!;
    }
}