using System.ComponentModel.DataAnnotations;

namespace SMP.DtosRequest.Logbook
{

    public class LogbookSearchRequest
    {
        [Required(ErrorMessage = "La fecha es requerida")]
        public DateTime Date { get; set; }

        [Required(ErrorMessage = "El ID es requerido")]
        [Range(1, int.MaxValue, ErrorMessage = "El ID debe ser mayor a 0")]
        public int Id { get; set; }

        [Required(ErrorMessage = "El tipo es requerido")]
        [StringLength(50, ErrorMessage = "El tipo no puede exceder 50 caracteres")]
        public string Type { get; set; } = string.Empty;
    }
}