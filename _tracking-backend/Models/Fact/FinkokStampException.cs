namespace MicroServicioTracking.Models.Fact;

/// <summary>
/// Excepción específica para errores de timbrado con Finkok
/// </summary>
public class FinkokStampException : Exception
{
    public FinkokError? FinkokError { get; }

    public FinkokStampException(string message) : base(message)
    {
    }

    public FinkokStampException(string message, FinkokError? error) : base(message)
    {
        FinkokError = error;
    }

    public FinkokStampException(string message, Exception innerException) : base(message, innerException)
    {
    }

    public FinkokStampException(string message, FinkokError? error, Exception innerException)
        : base(message, innerException)
    {
        FinkokError = error;
    }
}
