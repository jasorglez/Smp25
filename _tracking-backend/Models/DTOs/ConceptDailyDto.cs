namespace MicroServicioTracking.Models
{
    public class ConceptDailyDto
    {
        public DateTime DateExpend   { get; set; }
        public decimal  Total        { get; set; }
        public decimal  Iva2         { get; set; }
        public decimal  TotalFinal   { get; set; }
        public string?  TypeExpense  { get; set; }
        public string?  EntityName   { get; set; }
        public string?  EntityType   { get; set; }
        public int?     IdAccount    { get; set; }
        public string?  Description  { get; set; }
        public decimal  Quantity     { get; set; }
        public decimal  Price        { get; set; }
        public string?  NumberDocument { get; set; }
    }
}
