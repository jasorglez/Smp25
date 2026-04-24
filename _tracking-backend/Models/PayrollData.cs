using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations.Schema;
using System.ComponentModel.DataAnnotations;

namespace MicroServicioTracking.Models
{
    public class PayrollData
    {
        public decimal? bonus { get; set; }
        public decimal? discount { get; set; }
        public decimal? savings { get; set; }
    }
}

