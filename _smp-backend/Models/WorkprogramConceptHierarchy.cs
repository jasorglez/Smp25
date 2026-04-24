using System.Collections.Generic;

namespace SMP.Models
{
    public class WorkprogramConceptSystemDto
    {
        public long IdTask { get; set; }
        public string Activity { get; set; } = string.Empty;
        public string Text { get; set; } = string.Empty;
        public List<WorkprogramConceptSubpartidaDto> Subpartidas { get; set; } = new();
    }

    public class WorkprogramConceptSubpartidaDto
    {
        public int Id { get; set; }        // DB identity id del workprogram (para idPadre en logbook)
        public long IdTask { get; set; }
        public string Activity { get; set; } = string.Empty;
        public string Text { get; set; } = string.Empty;
        public List<WorkprogramConceptoDto> Conceptos { get; set; } = new();
    }

    public class WorkprogramConceptoDto
    {
        public long IdTask { get; set; }
        public string Activity { get; set; } = string.Empty;
        public string Text { get; set; } = string.Empty;
        public decimal? Quantity { get; set; }
    }
}
