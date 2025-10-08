$method = Get-Content 'temp_method.txt' -Raw 
$content = Get-Content 'C:\Developer\Visual Studio 22\c#\MicroservicioTracking\Tracking\Tracking\Services\BillingManagementService.cs' 
$newContent | Set-Content 'C:\Developer\Visual Studio 22\c#\MicroservicioTracking\Tracking\Tracking\Services\BillingManagementService.cs'
