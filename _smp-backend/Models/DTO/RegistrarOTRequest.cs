using System.ComponentModel.DataAnnotations;

namespace SMP.Models.DTO
{
    public class RegistrarOTRequest
    {
        [Required]
        public int Id { get; set; }
        
        [Required]
        public int IdProject { get; set; }
        
        [Required]
        public List<int> EmployeeIds { get; set; } = new();
        
        [Required]
        public List<EvidenciaDataDto> Evidencias { get; set; } = new();
        
        public List<int> TipoResultadoId { get; set; } = new();
        
        public string? Resultados { get; set; }
    }

    public class EvidenciaDataDto
    {
        [Required]
        public string Url { get; set; } = string.Empty;
        
        [Required]
        public string Tipo { get; set; } = string.Empty; // "FOTO" o "VIDEO"
        
        public string? Nota { get; set; }
        
        public MediaMetadataDto? Metadata { get; set; }
    }

    public class MediaMetadataDto
    {
        public long? FechaCaptura { get; set; }
        
        public long FechaSubida { get; set; }
        
        public double? Latitud { get; set; }
        
        public double? Longitud { get; set; }
        
        public string Dispositivo { get; set; } = string.Empty;
        
        public string Usuario { get; set; } = string.Empty;
        
        public string? Resolucion { get; set; }
        
        public long? DuracionMs { get; set; }
    }

    public class RegistrarOTResponse
    {
        public bool Success { get; set; }
        public string Message { get; set; } = string.Empty;
        public int? RegistroId { get; set; }
        public DateTime FechaCreacion { get; set; }
    }
}