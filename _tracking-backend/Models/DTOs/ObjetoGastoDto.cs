namespace MicroServicioTracking.Models.DTOs
{
    public class ObjetoGastoDto
    {
        public int Id { get; set; }
        public string Codigo { get; set; }
        public string Nombre { get; set; }
        public string? Descripcion { get; set; }
        public int Nivel { get; set; }
        public int? IdPadre { get; set; }
        public bool EsHoja { get; set; }
        public bool Active { get; set; }
        public int IdCompany { get; set; }
        public DateTime? CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
    }

    public class ObjetoGastoHierarchyDto
    {
        public int Id { get; set; }
        public string Codigo { get; set; }
        public string Nombre { get; set; }
        public string? Descripcion { get; set; }
        public int Nivel { get; set; }
        public int? IdPadre { get; set; }
        public bool EsHoja { get; set; }
        public bool Active { get; set; }
        public int IdCompany { get; set; }
        public string RutaCompleta { get; set; }
        public string SortPath { get; set; }
        public decimal MontoDirecto { get; set; }
        public decimal MontoAcumulado { get; set; }
    }

    public class ObjetoGastoTreeDto
    {
        public int Id { get; set; }
        public string Codigo { get; set; }
        public string Nombre { get; set; }
        public string? Descripcion { get; set; }
        public int Nivel { get; set; }
        public int? IdPadre { get; set; }
        public bool EsHoja { get; set; }
        public bool Active { get; set; }
        public List<ObjetoGastoTreeDto> Hijos { get; set; } = new List<ObjetoGastoTreeDto>();
    }
}
