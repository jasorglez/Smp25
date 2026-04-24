namespace MicroServicioTracking.Models.DTOs
{
    public class PayrollDTO
    {
        public int IdBranch { get; set; }
        public string Empresa { get; set; }
        public string Periodo { get; set; }
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public string Ejercicio { get; set; }
        public List<EmployeeDTO> Empleados { get; set; }
    }

    public class EmployeeDTO
    {
        public int? IdEmpleado {get; set;} // Contendrá el Id del empleado en la tabla employees
        public string Nombre { get; set; }
        public int DiasTrabajados { get; set; }
        public decimal SalarioDiarioIntegrado { get; set; }
        public decimal SalarioDiario { get; set; }
        public decimal Sueldos { get; set; }
        public decimal TotalPercepciones { get; set; }
        public decimal OtrosIngresos { get; set; }
        public decimal PercepcionesGravadas { get; set; }
        public decimal ImpuestoArt96 { get; set; }
        public decimal SubsidioArt114 { get; set; }
        public decimal TotalSubsidioPEmpleoArt115 { get; set; }
        public decimal SubsidioPEmpleoAcreditado { get; set; }
        public decimal ISPT { get; set; }
        public decimal SubsidioPEmpleo { get; set; }
        public decimal IMSSEnfermedad { get; set; }
        public decimal IMSSCesantiaVejez { get; set; }
        public decimal IMSS { get; set; }
        public decimal RetencionesINFONAVIT { get; set; }
        public decimal PensionAlimenticia { get; set; }
        public decimal Neto { get; set; }
        public string? Firma { get; set; }
    }
}
