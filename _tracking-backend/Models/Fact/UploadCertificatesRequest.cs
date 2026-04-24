namespace MicroServicioTracking.Models.Fact
{
    public class UploadCertificatesRequest
    {
        public IFormFile? CerFile { get; set; }
        public IFormFile? KeyFile { get; set; }
    }
}
