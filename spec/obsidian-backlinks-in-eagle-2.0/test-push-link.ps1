<#
.SYNOPSIS
    Test connection and push a link to Eagle Extra Links.

.DESCRIPTION
    PowerShell script to test connecting and pushing a link with configurable
    title and URL to the Eagle Extra Links REST IPC server.

.EXAMPLE
    .\test-push-link.ps1
    .\test-push-link.ps1 -Title "Obsidian Note" -Url "obsidian://open?vault=Main&file=Note"
    .\test-push-link.ps1 -Id "MTSPUNN17LBUG" -Title "Figma Spec" -Url "https://figma.com/file/123"
    .\test-push-link.ps1 -Standalone -Title "Test Documentation" -Url "https://eagle.cool"
#>

[CmdletBinding()]
param (
    [Parameter(Position = 0)]
    [string]$Id,

    [Parameter(Position = 1)]
    [string]$Title,

    [Parameter(Position = 2)]
    [string]$Url,

    [int]$Port,

    [string]$HostName,

    [switch]$AllowDuplicates,

    [switch]$Standalone,

    [switch]$RawJson
)

$scriptPath = Join-Path $PSScriptRoot "test-push-link.js"

$nodeArgs = @()
if ($Id) { $nodeArgs += "--id", $Id }
if ($Title) { $nodeArgs += "--title", $Title }
if ($Url) { $nodeArgs += "--url", $Url }
if ($Port) { $nodeArgs += "--port", $Port }
if ($HostName) { $nodeArgs += "--host", $HostName }
if ($AllowDuplicates) { $nodeArgs += "--allow-duplicates" }
if ($Standalone) { $nodeArgs += "--standalone" }
if ($RawJson) { $nodeArgs += "--json" }

node $scriptPath @nodeArgs
