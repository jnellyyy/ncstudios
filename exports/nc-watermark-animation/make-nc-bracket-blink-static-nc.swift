import AppKit
import AVFoundation
import CoreGraphics
import CoreText
import CoreVideo
import Foundation

let exportURL = URL(fileURLWithPath: CommandLine.arguments.dropFirst().first ?? ".")
let repoURL = exportURL.deletingLastPathComponent().deletingLastPathComponent()
let fontURL = repoURL.appendingPathComponent("assets/fonts/NC_Font_.ttf")
let width = 1920
let height = 1080
let fps: Int32 = 30
let frameCount = 120
let fontSize: CGFloat = 268

struct Variant {
  let name: String
  let red: CGFloat
  let green: CGFloat
  let blue: CGFloat
}

let variants = [
  Variant(name: "gold", red: 216, green: 183, blue: 110),
  Variant(name: "white", red: 247, green: 239, blue: 227)
]

enum RenderError: Error {
  case cannotCreatePixelBuffer
  case cannotCreateContext
  case cannotAddInput(URL)
  case cannotLoadFont(URL)
  case appendFailed(URL, Int)
  case writerFailed(URL, String)
}

let fontData = try Data(contentsOf: fontURL)
guard
  let provider = CGDataProvider(data: fontData as CFData),
  let brandCGFont = CGFont(provider)
else {
  throw RenderError.cannotLoadFont(fontURL)
}

let brandFont = CTFontCreateWithGraphicsFont(brandCGFont, fontSize, nil, nil)
let text = "nc" as CFString

func color(_ red: CGFloat, _ green: CGFloat, _ blue: CGFloat, _ alpha: CGFloat) -> CGColor {
  CGColor(red: red / 255, green: green / 255, blue: blue / 255, alpha: alpha)
}

func variantColor(_ variant: Variant, alpha: CGFloat) -> CGColor {
  color(variant.red, variant.green, variant.blue, alpha)
}

let keyGreen = color(0, 255, 0, 1)

func clamp(_ value: CGFloat, _ minValue: CGFloat = 0, _ maxValue: CGFloat = 1) -> CGFloat {
  min(max(value, minValue), maxValue)
}

func smoothstep(_ edge0: CGFloat, _ edge1: CGFloat, _ value: CGFloat) -> CGFloat {
  let x = clamp((value - edge0) / (edge1 - edge0))
  return x * x * (3 - 2 * x)
}

func pulse(_ center: CGFloat, _ width: CGFloat, _ t: CGFloat) -> CGFloat {
  clamp(1 - abs(t - center) / width)
}

func random(_ seed: Int) -> CGFloat {
  var x = UInt64(bitPattern: Int64(seed &* 1103515245 &+ 12345))
  x ^= x >> 12
  x ^= x << 25
  x ^= x >> 27
  let result = x &* 2685821657736338717
  return CGFloat(result % 10000) / 10000
}

func bracketBlinkAlpha(t: CGFloat, frame: Int) -> CGFloat {
  let fadeIn = smoothstep(0.04, 0.12, t)
  let fadeOut = 1 - smoothstep(0.84, 0.98, t)
  let base = fadeIn * fadeOut
  let drop =
    max(
      pulse(0.18, 0.018, t),
      pulse(0.30, 0.014, t),
      pulse(0.55, 0.016, t),
      pulse(0.70, 0.014, t)
    )
  let flash = 0.22 * max(pulse(0.14, 0.014, t), pulse(0.48, 0.014, t), pulse(0.78, 0.016, t))
  let micro = 0.90 + 0.10 * sin(CGFloat(frame) * 1.9)
  return clamp(base * (0.94 - 0.74 * drop) * micro + flash)
}

func drawRect(_ context: CGContext, _ rect: CGRect, _ drawColor: CGColor, alpha: CGFloat, glow: CGFloat = 0) {
  context.saveGState()
  context.setAlpha(alpha)
  if glow > 0 {
    context.setShadow(offset: .zero, blur: glow, color: drawColor.copy(alpha: alpha * 0.72))
  }
  context.setFillColor(drawColor)
  context.fill(rect)
  context.restoreGState()
}

func drawNCText(_ context: CGContext, variant: Variant, alpha: CGFloat) {
  let attributes: [CFString: Any] = [
    kCTFontAttributeName: brandFont,
    kCTForegroundColorAttributeName: variantColor(variant, alpha: alpha)
  ]
  let attributed = CFAttributedStringCreate(nil, text, attributes as CFDictionary)!
  let line = CTLineCreateWithAttributedString(attributed)
  let bounds = CTLineGetBoundsWithOptions(line, [.useGlyphPathBounds])
  let centerX = CGFloat(width) / 2
  let centerY = CGFloat(height) / 2
  let textX = centerX - bounds.width / 2 - bounds.minX
  let textY = centerY - bounds.height / 2 - bounds.minY - 8

  context.saveGState()
  context.setShadow(offset: .zero, blur: 10, color: variantColor(variant, alpha: alpha * 0.12))
  context.textMatrix = .identity
  context.textPosition = CGPoint(x: textX, y: textY)
  CTLineDraw(line, context)
  context.restoreGState()
}

func drawBracketBlinkMark(_ context: CGContext, frame: Int, variant: Variant) {
  let t = CGFloat(frame) / CGFloat(frameCount - 1)
  let markFade = smoothstep(0.04, 0.12, t) * (1 - smoothstep(0.86, 0.98, t))
  let ncAlpha = 0.92 * markFade
  let bracketAlpha = bracketBlinkAlpha(t: t, frame: frame)
  let markColor = variantColor(variant, alpha: 1)
  let brightColor = color(min(255, variant.red + 32), min(255, variant.green + 32), min(255, variant.blue + 32), 1)

  let centerX = CGFloat(width) / 2
  let centerY = CGFloat(height) / 2
  let bracketHeight: CGFloat = 266
  let bracketThickness: CGFloat = 30
  let bracketArm: CGFloat = 92
  let leftX = centerX - 360
  let rightX = centerX + 330
  let topY = centerY - bracketHeight / 2
  let bottomY = centerY + bracketHeight / 2 - bracketThickness

  drawNCText(context, variant: variant, alpha: ncAlpha)

  drawRect(context, CGRect(x: leftX, y: topY, width: bracketThickness, height: bracketHeight), markColor, alpha: bracketAlpha, glow: 14)
  drawRect(context, CGRect(x: leftX, y: topY, width: bracketArm, height: bracketThickness), brightColor, alpha: bracketAlpha, glow: 9)
  drawRect(context, CGRect(x: leftX, y: bottomY, width: bracketArm, height: bracketThickness), brightColor, alpha: bracketAlpha, glow: 9)

  drawRect(context, CGRect(x: rightX, y: topY, width: bracketThickness, height: bracketHeight), markColor, alpha: bracketAlpha, glow: 14)
  drawRect(context, CGRect(x: rightX - bracketArm + bracketThickness, y: topY, width: bracketArm, height: bracketThickness), brightColor, alpha: bracketAlpha, glow: 9)
  drawRect(context, CGRect(x: rightX - bracketArm + bracketThickness, y: bottomY, width: bracketArm, height: bracketThickness), brightColor, alpha: bracketAlpha, glow: 9)

  let scanAlpha = 0.14 * max(pulse(0.18, 0.035, t), pulse(0.58, 0.030, t), pulse(0.77, 0.025, t))
  for index in 0..<4 {
    let y = centerY - 118 + CGFloat(index) * 74 + CGFloat(Int(random(frame + index * 11) * 12) - 6)
    let x = centerX - 430 + CGFloat(Int(random(frame * 3 + index) * 60) - 30)
    let w = 590 + random(index * 23 + frame) * 240
    drawRect(context, CGRect(x: x, y: y, width: w, height: 2), brightColor, alpha: scanAlpha * bracketAlpha * (0.35 + random(index * 9 + frame)), glow: 2)
  }
}

func makePixelBuffer(pool: CVPixelBufferPool, frame: Int, variant: Variant, greenKey: Bool) throws -> CVPixelBuffer {
  var maybeBuffer: CVPixelBuffer?
  let status = CVPixelBufferPoolCreatePixelBuffer(nil, pool, &maybeBuffer)
  guard status == kCVReturnSuccess, let buffer = maybeBuffer else {
    throw RenderError.cannotCreatePixelBuffer
  }

  CVPixelBufferLockBaseAddress(buffer, [])
  defer { CVPixelBufferUnlockBaseAddress(buffer, []) }

  guard let baseAddress = CVPixelBufferGetBaseAddress(buffer) else {
    throw RenderError.cannotCreatePixelBuffer
  }

  let bytesPerRow = CVPixelBufferGetBytesPerRow(buffer)
  let colorSpace = CGColorSpaceCreateDeviceRGB()
  let bitmapInfo = CGBitmapInfo.byteOrder32Big.rawValue | CGImageAlphaInfo.premultipliedFirst.rawValue

  guard let context = CGContext(data: baseAddress, width: width, height: height, bitsPerComponent: 8, bytesPerRow: bytesPerRow, space: colorSpace, bitmapInfo: bitmapInfo) else {
    throw RenderError.cannotCreateContext
  }

  let rect = CGRect(x: 0, y: 0, width: width, height: height)
  if greenKey {
    context.setFillColor(keyGreen)
    context.fill(rect)
  } else {
    context.clear(rect)
  }

  drawBracketBlinkMark(context, frame: frame, variant: variant)
  return buffer
}

func writeVideo(outputURL: URL, variant: Variant, fileType: AVFileType, codec: AVVideoCodecType, greenKey: Bool) throws {
  try? FileManager.default.removeItem(at: outputURL)

  var videoSettings: [String: Any] = [
    AVVideoCodecKey: codec,
    AVVideoWidthKey: width,
    AVVideoHeightKey: height
  ]

  if codec == .h264 {
    videoSettings[AVVideoCompressionPropertiesKey] = [
      AVVideoAverageBitRateKey: 12_000_000,
      AVVideoMaxKeyFrameIntervalKey: fps
    ]
  }

  let writer = try AVAssetWriter(outputURL: outputURL, fileType: fileType)
  let input = AVAssetWriterInput(mediaType: .video, outputSettings: videoSettings)
  input.expectsMediaDataInRealTime = false

  guard writer.canAdd(input) else {
    throw RenderError.cannotAddInput(outputURL)
  }
  writer.add(input)

  let attributes: [String: Any] = [
    kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32ARGB,
    kCVPixelBufferWidthKey as String: width,
    kCVPixelBufferHeightKey as String: height,
    kCVPixelBufferCGImageCompatibilityKey as String: true,
    kCVPixelBufferCGBitmapContextCompatibilityKey as String: true
  ]

  let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: attributes)

  guard writer.startWriting() else {
    throw RenderError.writerFailed(outputURL, writer.error?.localizedDescription ?? "Could not start writer")
  }

  writer.startSession(atSourceTime: .zero)
  let frameDuration = CMTime(value: 1, timescale: fps)

  for frame in 0..<frameCount {
    while !input.isReadyForMoreMediaData {
      Thread.sleep(forTimeInterval: 0.01)
    }

    let buffer = try makePixelBuffer(pool: adaptor.pixelBufferPool!, frame: frame, variant: variant, greenKey: greenKey)
    let presentationTime = CMTimeMultiply(frameDuration, multiplier: Int32(frame))

    guard adaptor.append(buffer, withPresentationTime: presentationTime) else {
      throw RenderError.appendFailed(outputURL, frame)
    }
  }

  input.markAsFinished()

  let semaphore = DispatchSemaphore(value: 0)
  writer.finishWriting {
    semaphore.signal()
  }
  semaphore.wait()

  guard writer.status == .completed else {
    throw RenderError.writerFailed(outputURL, writer.error?.localizedDescription ?? "Writer did not complete")
  }

  print(outputURL.path)
}

func writePreview(outputURL: URL, variant: Variant) throws {
  let bytesPerPixel = 4
  let bytesPerRow = width * bytesPerPixel
  var pixels = [UInt8](repeating: 0, count: bytesPerRow * height)
  let colorSpace = CGColorSpaceCreateDeviceRGB()
  let bitmapInfo = CGBitmapInfo.byteOrder32Big.rawValue | CGImageAlphaInfo.premultipliedFirst.rawValue

  guard let context = CGContext(data: &pixels, width: width, height: height, bitsPerComponent: 8, bytesPerRow: bytesPerRow, space: colorSpace, bitmapInfo: bitmapInfo) else {
    throw RenderError.cannotCreateContext
  }

  context.setFillColor(CGColor(gray: 0, alpha: 1))
  context.fill(CGRect(x: 0, y: 0, width: width, height: height))
  drawBracketBlinkMark(context, frame: 46, variant: variant)
  guard let image = context.makeImage() else {
    throw RenderError.cannotCreateContext
  }
  let rep = NSBitmapImageRep(cgImage: image)
  let data = rep.representation(using: .png, properties: [:])!
  try data.write(to: outputURL)
  print(outputURL.path)
}

for variant in variants {
  try writeVideo(
    outputURL: exportURL.appendingPathComponent("nc-watermark-bracket-blink-static-nc-\(variant.name)-transparent-upright.mov"),
    variant: variant,
    fileType: .mov,
    codec: .proRes4444,
    greenKey: false
  )

  try writeVideo(
    outputURL: exportURL.appendingPathComponent("nc-watermark-bracket-blink-static-nc-\(variant.name)-green-key-upright.mp4"),
    variant: variant,
    fileType: .mp4,
    codec: .h264,
    greenKey: true
  )

  try writePreview(
    outputURL: exportURL.appendingPathComponent("nc-watermark-bracket-blink-static-nc-\(variant.name)-preview.png"),
    variant: variant
  )
}
