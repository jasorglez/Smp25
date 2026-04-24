namespace SMP.Models
{
    public class ExcelDataRequestWrapper
    {
        public ExcelDataRequest Data { get; set; } = new ExcelDataRequest();
    }

    public class DateRangeRequest
    {
        public DateTime DateStart { get; set; }
        public DateTime DateEnd { get; set; }
    }

    public class DateRangeRequestType
    {
        public DateTime DateStart { get; set; }
        public DateTime DateEnd { get; set; }
        public int Type { get; set; }
    }
    public class DateRangeRequestExterna
    {
        public DateTime DateStart { get; set; }
        public DateTime DateEnd { get; set; }
        public List<string> Seleccionados { get; set; } = new List<string>();
    }

    public class ExcelDataRequest
    {
        public string NumeroOS { get; set; } = string.Empty;
        public int INMUEBLE { get; set; }
        public string NombreDelServicio { get; set; } = string.Empty;
        public string EquipoEjecutor { get; set; } = string.Empty;
        public string Colonia { get; set; } = string.Empty;
        public string Calle { get; set; } = string.Empty;
        public int Numero { get; set; }
        public string TrabajoRealizado { get; set; } = string.Empty;
        public string ResultadoDelTrabajo { get; set; } = string.Empty;
        public int Cantidad { get; set; }
        public string FechaAsignacion { get; set; } = string.Empty;
        public string FechaEjecucion { get; set; } = string.Empty;
        public int Dias { get; set; }
        public string Area { get; set; } = string.Empty;
        public string Validado { get; set; } = string.Empty;
        public string Observaciones { get; set; } = string.Empty;
        public string INCIDENCIA { get; set; } = string.Empty;
    }

    public class ExcelDataRequestCuadInter
    {
        public string? NumeroOS { get; set; } = string.Empty;
        public int? INMUEBLE { get; set; }
        public string? NombreDelServicio { get; set; } = string.Empty;
        public string? EquipoEjecutor { get; set; } = string.Empty;
        public string? Colonia { get; set; } = string.Empty;
        public string? Calle { get; set; } = string.Empty;
        public int? Numero { get; set; }
        public string? TrabajoRealizado { get; set; } = string.Empty;
        public string? ResultadoDelTrabajo { get; set; } = string.Empty;
        public int? Cantidad { get; set; }
        public string? FechaAsignacion { get; set; } = string.Empty;
        public string? FechaEjecucion { get; set; } = string.Empty;
        public int? Dias { get; set; }
        public string? Area { get; set; } = string.Empty;
        public string? Validado { get; set; } = string.Empty;
        public string? Observaciones { get; set; } = string.Empty;
        public string? INCIDENCIA { get; set; } = string.Empty;
        public object ResaneDeBanqueta { get; set; }
        public object FugaEnMedidor { get; set; }
        public object FugaEnBanqueta { get; set; }
        public object InstMedidor12112Piso { get; set; }
        public object InstMedidor12112Arco { get; set; }
        public object InstMedidor2Caja { get; set; }
        public object InstMedidor3Caja { get; set; }
        public object InstMedidor4Caja { get; set; }
        public object InstValvula12 { get; set; }
        public object CambioMedidor12112 { get; set; }
        public object ReconexionAsfalto { get; set; }
        public object CorteAsfaltoRed { get; set; }
        public object CorteExtMedidorMadera { get; set; }
        public object ReconexionBanqueta { get; set; }
        public object ReconexionTierra { get; set; }
        public object ReconexionMuro { get; set; }
        public object CorteTomaTierra { get; set; }
        public object CorteTomaMuro { get; set; }
        public object CorteBanqueta { get; set; }
        public object CorteAsfaltoPredio { get; set; }
        public object ReconexionDrenaje { get; set; }
        public object CorteDrenajeTapon { get; set; }
        public object CorteDrenajeRegistro { get; set; }
        public object GastoVisitaObra { get; set; }
        public object SondeoTierra { get; set; }
        public object SondeoBanqueta { get; set; }
        public object SondeoPavimento { get; set; }
        public object RetiroTapones { get; set; }

    }
    
     public class ExcelDataRequestCuadExter
    {
        public string? NumeroOS { get; set; } = string.Empty;
        public int? INMUEBLE { get; set; }
        public string? NombreDelServicio { get; set; } = string.Empty;
        public string? EquipoEjecutor { get; set; } = string.Empty;
        public string? Colonia { get; set; } = string.Empty;
        public string? Calle { get; set; } = string.Empty;
        public int? Numero { get; set; }
        public string? TrabajoRealizado { get; set; } = string.Empty;
        public string? ResultadoDelTrabajo { get; set; } = string.Empty;
        public int? Cantidad { get; set; }
        public string? FechaAsignacion { get; set; } = string.Empty;
        public string? FechaEjecucion { get; set; } = string.Empty;
        public int? Dias { get; set; }
        public string? Area { get; set; } = string.Empty;
        public string? Validado { get; set; } = string.Empty;
        public string? Observaciones { get; set; } = string.Empty;
        public string? INCIDENCIA { get; set; } = string.Empty;
        public object ResaneDeBanqueta { get; set; }
        public object FugaEnMedidor { get; set; }
        public object FugaEnBanqueta { get; set; }
        public object InstMedidor12112Piso { get; set; }
        public object InstMedidor12112Arco { get; set; }
        public object InstMedidor2Caja { get; set; }
        public object InstMedidor3Caja { get; set; }
        public object InstMedidor4Caja { get; set; }
        public object InstValvula12 { get; set; }
        public object CambioMedidor12112 { get; set; }
        public object ReconexionAsfalto { get; set; }
        public object CorteAsfaltoRed { get; set; }
        public object CorteExtMedidorMadera { get; set; }
        public object ReconexionBanqueta { get; set; }
        public object ReconexionTierra { get; set; }
        public object ReconexionMuro { get; set; }
        public object CorteTomaTierra { get; set; }
        public object CorteTomaMuro { get; set; }
        public object CorteBanqueta { get; set; }
        public object CorteTomaPavimento { get; set; }
        public object CorteAsfaltoPredio { get; set; }
        public object ReconexionDrenaje { get; set; }
        public object CorteDrenajeTapon { get; set; }
        public object CorteDrenajeRegistro { get; set; }
        public object GastoVisitaObra { get; set; }
        public object SondeoTierra { get; set; }
        public object SondeoBanqueta { get; set; }
        public object SondeoPavimento { get; set; }
        public object RetiroTapones { get; set; }
        
    }
}