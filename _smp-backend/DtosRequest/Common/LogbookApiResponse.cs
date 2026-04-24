namespace SMP.DtosRequest.Common
{
    public class LogbookApiResponse<T>
    {
        public bool Success { get; set; }
        public string Message { get; set; } = string.Empty;
        public T? Data { get; set; }
        public List<string>? Errors { get; set; }
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;

        public static LogbookApiResponse<T> CreateSuccess(T data, string message = "Operación exitosa")
        {
            return new LogbookApiResponse<T>
            {
                Success = true,
                Message = message,
                Data = data
            };
        }

        public static LogbookApiResponse<T> CreateError(string message, List<string>? errors = null)
        {
            return new LogbookApiResponse<T>
            {
                Success = false,
                Message = message,
                Errors = errors
            };
        }
    }
}