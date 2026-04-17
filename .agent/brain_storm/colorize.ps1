$root = "d:\OneDrive\Documents\New_Life\Schedool\frontend\schedool\app"
$files = Get-ChildItem -Path $root -Recurse -Include "*.tsx" | Where-Object { $_.Name -ne "page.tsx" }
$changedCount = 0
foreach ($file in $files) {
    $content = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
    $original = $content
    $content = $content -replace 'bg-gray-50\b','bg-background'
    $content = $content -replace 'bg-white\b','bg-surface'
    $content = $content -replace 'bg-gray-100\b','bg-surface-alt'
    $content = $content -replace 'bg-gray-200\b','bg-border'
    $content = $content -replace 'text-gray-900\b','text-foreground'
    $content = $content -replace 'text-gray-800\b','text-foreground'
    $content = $content -replace 'text-gray-700\b','text-foreground-muted'
    $content = $content -replace 'text-gray-600\b','text-foreground-muted'
    $content = $content -replace 'text-gray-500\b','text-foreground-muted'
    $content = $content -replace 'text-gray-400\b','text-foreground-muted'
    $content = $content -replace 'border-gray-100\b','border-border'
    $content = $content -replace 'border-gray-200\b','border-border'
    $content = $content -replace 'border-gray-300\b','border-border-strong'
    $content = $content -replace 'text-blue-600\b','text-primary'
    $content = $content -replace 'hover:text-blue-800\b','hover:text-primary'
    $content = $content -replace 'hover:bg-blue-700\b','hover:bg-primary-hover'
    $content = $content -replace 'bg-blue-600\b','bg-primary'
    $content = $content -replace 'bg-blue-50\b','bg-primary-light'
    $content = $content -replace 'bg-blue-100\b','bg-primary-light'
    $content = $content -replace 'text-blue-700\b','text-primary'
    $content = $content -replace 'border-blue-200\b','border-primary-border'
    $content = $content -replace 'border-blue-700\b','border-primary'
    $content = $content -replace 'hover:bg-blue-100\b','hover:bg-primary-light'
    $content = $content -replace 'hover:bg-blue-600\b','hover:bg-primary'
    $content = $content -replace 'focus:ring-blue-500\b','focus:ring-primary'
    $content = $content -replace 'hover:bg-gray-50\b','hover:bg-surface-alt'
    $content = $content -replace 'hover:bg-gray-100\b','hover:bg-surface-alt'
    if ($content -ne $original) {
        [System.IO.File]::WriteAllText($file.FullName, $content, [System.Text.Encoding]::UTF8)
        $changedCount++
        Write-Host "Updated: $($file.Name)"
    }
}
Write-Host "Done. $changedCount files modified."
