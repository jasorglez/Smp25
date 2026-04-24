namespace MicroServicioTracking.Models.DTOs
{
    public class NormalPayrollDTO
    {
        public int Id { get; set; }
        public int IdBranch { get; set; }
        public int? IdBlockPeriod { get; set; }
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        public decimal? TotalBaseWorkingHours { get; set; }
        public decimal? TotalBaseExtraHours { get; set; }
        
        public decimal? TotalBaseExtraHoursSpecial { get; set; }

        public decimal? TotalBaseSalary { get; set; }

        public decimal? TotalExtraSalary { get; set; }

        public decimal? TotalSpecialSalary { get; set; }
        public decimal? TotalBonos { get; set; }
        public decimal? TotalSubtotal { get; set; }
        public decimal? TotalDescuentos { get; set; }

        public decimal? TotalDigitalPayment { get; set; }
        public decimal? TotalAbsence { get; set; }
        public decimal? TotalDelays { get; set; }

        public decimal? TotalSavings { get; set; }
        public bool? NomDigital { get; set; }
        public decimal? Total { get; set; }
        public bool? Closed { get; set; }
        public bool Active { get; set; }
    }
}
