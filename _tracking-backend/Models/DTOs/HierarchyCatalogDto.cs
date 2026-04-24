namespace MicroServicioTracking.Models.DTOs
{

    public class HierarchyCatalogDto
    {
        public int Id { get; set; }
        public int IdCompany { get; set; }
        public string Description { get; set; } = string.Empty;
        public string ValueAddition { get; set; } = string.Empty;
        public string ValueAddition2 { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty;
        public int ParentId { get; set; }
        public int IdElection { get; set; }
        public int Active { get; set; }
        public int Level { get; set; }
        public string SortPath { get; set; } = string.Empty;
        public string DisplayHierarchy { get; set; } = string.Empty;
    }
}