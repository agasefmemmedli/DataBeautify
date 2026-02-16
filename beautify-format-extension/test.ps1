function Get-Greeting {
param(
[string]$Name
)
if ($Name) {
Write-Host "Hello, $Name!"
} else {
Write-Host "Hello, World!"
}
}
<#
    Block comment
#>
$data = @{
    Key = "Value"
}
@"
Here-string
"@
Get-Greeting -Name "Jules"
