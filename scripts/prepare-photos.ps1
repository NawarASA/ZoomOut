# Gets photos ready for the game: turns them the right way up, shrinks them to
# at most 2048 px on the long side, and saves them as JPEG with no metadata
# (no GPS location, camera details or date taken).
#
#   npm run photos                     every photo in new-photos/
#   powershell -ExecutionPolicy Bypass -File scripts/prepare-photos.ps1 photos/2026-10-07.jpg
#                                      specific files
#
# Photos are replaced in place. A .png or .webp becomes a .jpg with the same name.
param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Paths)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing
$root = Split-Path $PSScriptRoot -Parent
$maxSide = 2048

if (-not $Paths) {
  $Paths = Get-ChildItem (Join-Path $root "new-photos") -File |
    Where-Object { $_.Extension -match '^\.(jpe?g|png|webp|heic)$' } | ForEach-Object FullName
}
if (-not $Paths) { Write-Host "No photos in new-photos/."; exit 0 }

# EXIF orientation value -> how to turn the pixels so the photo shows upright without it.
$turn = @{ 2 = "RotateNoneFlipX"; 3 = "Rotate180FlipNone"; 4 = "Rotate180FlipX"; 5 = "Rotate90FlipX"
           6 = "Rotate90FlipNone"; 7 = "Rotate270FlipX"; 8 = "Rotate270FlipNone" }
$jpeg = [Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object MimeType -eq "image/jpeg"
$quality = New-Object Drawing.Imaging.EncoderParameters 1
$quality.Param[0] = New-Object Drawing.Imaging.EncoderParameter([Drawing.Imaging.Encoder]::Quality, [long]85)

$done = 0
foreach ($p in $Paths) {
  $file = if ([IO.Path]::IsPathRooted($p)) { $p } else { Join-Path $root $p }
  $name = Split-Path $file -Leaf
  if ($file -match '\.heic$') { Write-Host "skipped  ${name}: HEIC can't be read here. Export it as JPEG (or set iPhone Camera > Formats > Most Compatible)."; continue }

  # Read into memory so the original file isn't locked while it's replaced.
  $src = [Drawing.Image]::FromStream((New-Object IO.MemoryStream (, [IO.File]::ReadAllBytes($file))))
  $hadGps = $src.PropertyIdList -contains 0x0002
  if ($src.PropertyIdList -contains 0x0112) {
    $o = [int]$src.GetPropertyItem(0x0112).Value[0]
    if ($turn.ContainsKey($o)) { $src.RotateFlip([Drawing.RotateFlipType]$turn[$o]) }
  }

  $scale = [Math]::Min(1.0, $maxSide / [Math]::Max($src.Width, $src.Height))
  $w = [int][Math]::Round($src.Width * $scale); $h = [int][Math]::Round($src.Height * $scale)
  # Drawing onto a fresh bitmap leaves every bit of metadata behind.
  $bmp = New-Object Drawing.Bitmap $w, $h
  $g = [Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = "HighQualityBicubic"; $g.PixelOffsetMode = "HighQuality"; $g.SmoothingMode = "HighQuality"
  $g.DrawImage($src, 0, 0, $w, $h)
  $g.Dispose(); $src.Dispose()

  $out = [IO.Path]::ChangeExtension($file, ".jpg")
  $bmp.Save($out, $jpeg, $quality); $bmp.Dispose()
  if ($out -ne $file) { Remove-Item $file }

  $kb = [Math]::Round((Get-Item $out).Length / 1KB)
  Write-Host ("ready    {0}  {1}x{2}, {3} KB{4}" -f (Split-Path $out -Leaf), $w, $h, $kb, $(if ($hadGps) { ", GPS location removed" } else { "" }))
  $done++
}
Write-Host "`n$done photo(s) ready."
