namespace MicroServicioTracking.Models.Fact;

/// <summary>
/// Respuesta del servicio de timbrado de Finkok
/// </summary>
public class FinkokStampResponse
{
    public bool Success { get; set; }
    public string? Uuid { get; set; }
    public string? StampedXml { get; set; }
    public DateTime? FechaTimbrado { get; set; }
    public string? SelloSat { get; set; }
    public string? NoCertificadoSat { get; set; }
    public FinkokError? Error { get; set; }
}

/// <summary>
/// Errores detallados de Finkok
/// </summary>
public class FinkokError
{
    public string Code { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string DetailedMessage { get; set; } = string.Empty;
    public string? IncidenceId { get; set; }
    public DateTime ErrorDate { get; set; } = DateTime.Now;
}

/// <summary>
/// Códigos de error comunes de Finkok
/// </summary>
public static class FinkokErrorCodes
{
    // Errores de timbrado
    public const string ALREADY_STAMPED = "307";  // CFDI ya contiene timbre previo

    // Errores de autenticación
    public const string USER_INACTIVE = "402";
    public const string USER_SUSPENDED = "403";

    // Errores de XML
    public const string INVALID_XML = "301";
    public const string SCHEMA_VALIDATION_ERROR = "302";
    public const string INVALID_CERTIFICATE = "303";
    public const string INVALID_SEAL = "304";
    public const string INVALID_ORIGINAL_STRING = "305";

    // Errores de certificados
    public const string CERTIFICATE_EXPIRED = "401";
    public const string CERTIFICATE_REVOKED = "404";
    public const string CERTIFICATE_NOT_FOUND = "405";

    // Errores de facturación
    public const string DUPLICATE_INVOICE = "702";
    public const string INVALID_RFC = "703";
    public const string INVALID_DATE = "704";
    public const string INVALID_TOTAL = "705";

    // Errores del SAT
    public const string SAT_SERVICE_UNAVAILABLE = "601";
    public const string SAT_TIMEOUT = "602";

    // Errores de créditos/cuenta
    public const string INSUFFICIENT_CREDITS = "501";
    public const string ACCOUNT_BLOCKED = "502";

    public static string GetErrorDescription(string code)
    {
        return code switch
        {
            ALREADY_STAMPED => "El CFDI ya fue timbrado previamente. Usa un folio diferente o recupera el XML timbrado existente.",
            USER_INACTIVE => "Usuario de Finkok inactivo. Contacta a soporte de Finkok.",
            USER_SUSPENDED => "Usuario de Finkok suspendido. Contacta a soporte de Finkok.",

            INVALID_XML => "El XML generado tiene un formato inválido. Verifica la estructura del CFDI.",
            SCHEMA_VALIDATION_ERROR => "El XML no cumple con el esquema XSD del SAT. Verifica los campos obligatorios.",
            INVALID_CERTIFICATE => "El certificado digital (.cer) es inválido o está corrupto.",
            INVALID_SEAL => "El sello digital es inválido. Verifica tu llave privada (.key) y contraseña.",
            INVALID_ORIGINAL_STRING => "La cadena original no coincide con el XML. Error en la firma digital.",

            CERTIFICATE_EXPIRED => "El certificado digital ha expirado. Renueva tu certificado ante el SAT.",
            CERTIFICATE_REVOKED => "El certificado ha sido revocado por el SAT.",
            CERTIFICATE_NOT_FOUND => "No se encontró el certificado. Verifica que esté cargado correctamente.",

            DUPLICATE_INVOICE => "La factura ya fue timbrada previamente. Serie y folio duplicados.",
            INVALID_RFC => "El RFC del emisor o receptor es inválido según el SAT.",
            INVALID_DATE => "La fecha de emisión es inválida. No puede ser mayor a la actual ni menor a 72 horas.",
            INVALID_TOTAL => "El total de la factura no coincide con la suma de conceptos e impuestos.",

            SAT_SERVICE_UNAVAILABLE => "El servicio del SAT no está disponible temporalmente. Intenta más tarde.",
            SAT_TIMEOUT => "Tiempo de espera agotado al conectar con el SAT. Intenta nuevamente.",

            INSUFFICIENT_CREDITS => "Créditos insuficientes en tu cuenta de Finkok. Recarga tu cuenta.",
            ACCOUNT_BLOCKED => "Cuenta de Finkok bloqueada. Contacta a soporte de Finkok.",

            _ => $"Error desconocido: {code}. Contacta a soporte técnico."
        };
    }
}
