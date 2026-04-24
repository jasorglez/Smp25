using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace MicroServicioTracking.Models
{
    [Table("presupuesto", Schema = "presupuesto")]
    public class Presupuesto
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        [Column("id")]
        public int Id { get; set; }

        [Column("id_project")]
        [JsonPropertyName("id_project")]
        public int IdProject { get; set; }

        [Column("numrevision")]
        public int Numrevision { get; set; } = 0;

        [Column("nombre")]
        public string Nombre { get; set; } = string.Empty;

        [Column("motivo")]
        public string? Motivo { get; set; }

        [Column("fecha_inicio")]
        [JsonPropertyName("fecha_inicio")]
        public DateTime? FechaInicio { get; set; }

        [Column("fecha_fin")]
        [JsonPropertyName("fecha_fin")]
        public DateTime? FechaFin { get; set; }

        [Column("vigente")]
        public bool Vigente { get; set; } = false;

        [Column("usuario_responsable")]
        [JsonPropertyName("usuario_responsable")]
        public string? UsuarioResponsable { get; set; }

        [Column("id_version_anterior")]
        [JsonPropertyName("id_version_anterior")]
        public int? IdVersionAnterior { get; set; }

        [Column("idCompany")]
        public int IdCompany { get; set; }

        [Column("fecha_creacion")]
        [JsonPropertyName("fecha_creacion")]
        public DateTime FechaCreacion { get; set; } = DateTime.Now;

        [Column("active")]
        public bool Active { get; set; } = true;
    }
}
