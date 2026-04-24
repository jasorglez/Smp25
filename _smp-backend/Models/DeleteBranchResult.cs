public class DeleteBranchResult
{
    public bool Success { get; set; }
    public string Message { get; set; }
    public int? CanDelete { get; set; }
    public string Reasons { get; set; }
}