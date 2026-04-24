
namespace MicroServicioTracking.Models.DTOs
{
    public class CheckWithBlockDto
    {
        public int Id { get; set; }
        public int IdEmployee { get; set; }
        public string Name { get; set; }
        public int IdBranch { get; set; }
        public DateTime TimeStamp { get; set; }
        public int MinuteDiscount { get; set; }
        public string Type { get; set; }
        public bool Valid { get; set; }

        public int IdBlockPeriod { get; set; }
        public string BlockPeriodCode { get; set; }
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
    }
}
