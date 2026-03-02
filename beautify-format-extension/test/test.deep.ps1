function Get-DeepTest {
    [CmdletBinding()]
    param (
        [string]$Name,
        [int]$Count = 1
    )

    $var1 = 1
    $longerVar2 = 2
    [string]$longestVar3 = "3"

    # Process items
    if ($Name -eq 'Test') {
        Write-Host "Running Test"
    } else {
        Write-Host "Running $Name"
    }

    # Loop
    foreach ($i in 1..$Count) {
        $result = Get-Process |
            Where-Object { $_.Id -gt 1000 } |
            Select-Object Name, Id

        $hash = @{
            Key1 = 'Value1'
            Key2 = 'Value2'
        }
    }

    $hereString = @"
This is a here-string
with multiple lines
"@
}
