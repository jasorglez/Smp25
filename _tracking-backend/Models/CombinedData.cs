using System.Reflection;

namespace MicroServicioTracking.Models
{
    public class CombinedData
    {
        public int CustomerId { get; set; }
        public int ApiId { get; set; }
        public string Company { get; set; }
        public string ValueAddition { get; set; }
        public string NameContact { get; set; }
        public int IdTypecop { get; set; }
        public string Cp { get; set; }
        public int? Radio { get; set; }
        public string Latitud { get; set; }
        public string Longitud { get; set; }
    }
}
