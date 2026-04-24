namespace MicroServicioTracking.Models
{
    public class NormalPayrollResult
    {
        public int NormalPayrollId { get; set; }
        public bool Success { get; set; }
        public string Message { get; set; }

        public NormalPayrollResult(int normalpayrollid, string message) {
           switch (normalpayrollid)
            {
                case 1:
                    NormalPayrollId = normalpayrollid;
                    Success = false;
                    Message = message;
                break;
                // no hay nominas digitales cargadas con estas fechas
                case 2:
                    NormalPayrollId = normalpayrollid;
                    Success = false;
                    Message = message;
                break;
                // ya existe nómina con esas fechas
                case 3:
                    NormalPayrollId = normalpayrollid;
                    Success = false;
                    Message = message;
                break;
                 // Creación exitosa de nómina
                case 5:
                    NormalPayrollId = normalpayrollid;
                    Success = true;
                    Message = message;
                break;

                case 6:  //delete
                    NormalPayrollId = normalpayrollid;
                    Success = true;
                    Message = message;
                break;

                case 7:  //delete no encontrado
                    NormalPayrollId = normalpayrollid;
                    Success = false;
                    Message = message;
                break; 
                
                case 8:  //delete error
                    NormalPayrollId = normalpayrollid;
                    Success = false;
                    Message = message;
                break;
            }
        }
    }
}