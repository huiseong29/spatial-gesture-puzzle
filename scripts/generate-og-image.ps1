Add-Type -AssemblyName System.Drawing

$OutputPath = Join-Path $PSScriptRoot "..\public\og\og-image.png"
$OutputDir = Split-Path $OutputPath -Parent
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

function New-RoundedRectPath([System.Drawing.RectangleF]$Rect, [float]$Radius) {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $diameter = $Radius * 2
  $path.AddArc($Rect.X, $Rect.Y, $diameter, $diameter, 180, 90)
  $path.AddArc($Rect.X + $Rect.Width - $diameter, $Rect.Y, $diameter, $diameter, 270, 90)
  $path.AddArc($Rect.X + $Rect.Width - $diameter, $Rect.Y + $Rect.Height - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($Rect.X, $Rect.Y + $Rect.Height - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  return $path
}

function Fill-RoundedRect($Graphics, $Brush, [System.Drawing.RectangleF]$Rect, [float]$Radius) {
  $path = New-RoundedRectPath $Rect $Radius
  $Graphics.FillPath($Brush, $path)
  $path.Dispose()
}

function Draw-RoundedRect($Graphics, $Pen, [System.Drawing.RectangleF]$Rect, [float]$Radius) {
  $path = New-RoundedRectPath $Rect $Radius
  $Graphics.DrawPath($Pen, $path)
  $path.Dispose()
}

function New-Font([string[]]$Names, [float]$Size, [System.Drawing.FontStyle]$Style) {
  foreach ($name in $Names) {
    try {
      return New-Object System.Drawing.Font($name, $Size, $Style, [System.Drawing.GraphicsUnit]::Pixel)
    } catch {
      continue
    }
  }

  return New-Object System.Drawing.Font("Arial", $Size, $Style, [System.Drawing.GraphicsUnit]::Pixel)
}

function New-Brush([int]$R, [int]$G, [int]$B, [int]$A = 255) {
  return New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb($A, $R, $G, $B))
}

$width = 1200
$height = 630
$bitmap = New-Object System.Drawing.Bitmap $width, $height
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
$graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

$warmCream = [System.Drawing.Color]::FromArgb(255, 255, 247, 237)
$tomatoRed = [System.Drawing.Color]::FromArgb(255, 229, 72, 72)
$greenLeaf = [System.Drawing.Color]::FromArgb(255, 95, 168, 120)
$creamShine = [System.Drawing.Color]::FromArgb(255, 255, 244, 232)
$charcoal = [System.Drawing.Color]::FromArgb(255, 42, 26, 20)
$mutedText = [System.Drawing.Color]::FromArgb(255, 122, 90, 74)
$border = [System.Drawing.Color]::FromArgb(255, 241, 201, 182)

$graphics.Clear($warmCream)

$gridPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(95, $border.R, $border.G, $border.B), 1)
for ($x = 0; $x -le $width; $x += 48) {
  $graphics.DrawLine($gridPen, $x, 0, $x, $height)
}
for ($y = 0; $y -le $height; $y += 48) {
  $graphics.DrawLine($gridPen, 0, $y, $width, $y)
}

$cardBrush = New-Brush 255 255 255 230
$cardRect = [System.Drawing.RectangleF]::new(64, 64, 1072, 502)
Fill-RoundedRect $graphics $cardBrush $cardRect 36
Draw-RoundedRect $graphics (New-Object System.Drawing.Pen($border, 2)) $cardRect 36

$iconGlow = New-Brush 229 72 72 40
$graphics.FillEllipse($iconGlow, 118, 128, 380, 380)

$iconBg = New-Brush 255 244 232
$iconRect = [System.Drawing.RectangleF]::new(154, 164, 308, 308)
Fill-RoundedRect $graphics $iconBg $iconRect 60

$tomatoBrush = New-Object System.Drawing.SolidBrush($tomatoRed)
$tomatoRect = [System.Drawing.RectangleF]::new(194, 210, 228, 228)
$graphics.FillEllipse($tomatoBrush, $tomatoRect)

$leafBrush = New-Object System.Drawing.SolidBrush($greenLeaf)
$graphics.FillEllipse($leafBrush, 270, 184, 82, 52)

$shineBrush = New-Brush 255 244 232 130
$graphics.FillEllipse($shineBrush, 254, 286, 50, 42)

$capturePen = New-Object System.Drawing.Pen($tomatoRed, 7)
Draw-RoundedRect $graphics $capturePen ([System.Drawing.RectangleF]::new(182, 198, 252, 252)) 50

$puzzlePen = New-Object System.Drawing.Pen($creamShine, 4)
$graphics.DrawLine($puzzlePen, 270, 224, 270, 424)
$graphics.DrawLine($puzzlePen, 346, 224, 346, 424)
$graphics.DrawLine($puzzlePen, 208, 300, 408, 300)
$graphics.DrawLine($puzzlePen, 208, 376, 408, 376)

$gesturePen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(175, $tomatoRed.R, $tomatoRed.G, $tomatoRed.B), 4)
$gesturePen.DashStyle = [System.Drawing.Drawing2D.DashStyle]::Dash
$graphics.DrawLine($gesturePen, 120, 318, 174, 318)
$graphics.DrawLine($gesturePen, 444, 318, 498, 318)
$graphics.FillEllipse($tomatoBrush, 102, 303, 30, 30)
$graphics.FillEllipse($tomatoBrush, 486, 303, 30, 30)

$titleFont = New-Font @("Segoe UI", "Arial") 58 ([System.Drawing.FontStyle]::Bold)
$subtitleFont = New-Font @("Noto Sans KR", "Malgun Gothic", "MS PGothic", "Segoe UI", "Arial") 28 ([System.Drawing.FontStyle]::Regular)
$tagFont = New-Font @("Segoe UI", "Arial") 18 ([System.Drawing.FontStyle]::Regular)

$titleBrush = New-Object System.Drawing.SolidBrush($charcoal)
$accentBrush = New-Object System.Drawing.SolidBrush($tomatoRed)
$mutedBrush = New-Object System.Drawing.SolidBrush($mutedText)

$graphics.DrawString("Tomato Gesture", $titleFont, $titleBrush, 560, 150)
$graphics.DrawString("Puzzle", $titleFont, $accentBrush, 560, 218)

$subtitle = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("7IaQIOygnOyKpOyymOuhnCDsuqHsspjtlZjqs6Ag7Y287KaQ7J2EIOyhsOyeke2VmOuKlArsi6Tsi5zqsIQgQ1YvSENJIOyduO2EsOuemeyFmCDrjbDrqqg="))
$graphics.DrawString($subtitle, $subtitleFont, $mutedBrush, 564, 326)

$accentLinePen = New-Object System.Drawing.Pen($tomatoRed, 5)
$graphics.DrawLine($accentLinePen, 564, 302, 790, 302)

$tagBorderPen = New-Object System.Drawing.Pen($border, 2)
$tagTomatoBrush = New-Brush 229 72 72 24
$tagTextBrush = New-Object System.Drawing.SolidBrush($charcoal)
$tags = @("MediaPipe Hands", "React", "Canvas", "Gesture UI")
$tagX = 564
foreach ($tag in $tags) {
  $tagSize = $graphics.MeasureString($tag, $tagFont)
  $tagRect = [System.Drawing.RectangleF]::new($tagX, 462, $tagSize.Width + 34, 42)
  Fill-RoundedRect $graphics $tagTomatoBrush $tagRect 21
  Draw-RoundedRect $graphics $tagBorderPen $tagRect 21
  $graphics.DrawString($tag, $tagFont, $tagTextBrush, $tagX + 17, 471)
  $tagX += $tagRect.Width + 14
}

$bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)

$graphics.Dispose()
$bitmap.Dispose()

Write-Host "Created $OutputPath"
