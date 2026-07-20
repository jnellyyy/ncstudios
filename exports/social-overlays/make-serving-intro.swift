import AppKit
import AVFoundation
import CoreGraphics
import CoreText
import CoreVideo
import Foundation

let outputDirectory = URL(fileURLWithPath: CommandLine.arguments.dropFirst().first ?? ".")
let width = 1080
let height = 1920
let fps: Int32 = 30
let frameCount = 120

enum RenderError: Error {
  case cannotCreatePixelBuffer
  case cannotCreateContext
  case cannotAddInput(URL)
  case appendFailed(URL, Int)
  case writerFailed(URL, String)
}

func clamp(_ value: CGFloat, _ low: CGFloat = 0, _ high: CGFloat = 1) -> CGFloat {
  min(max(value, low), high)
}

func smoothstep(_ edge0: CGFloat, _ edge1: CGFloat, _ value: CGFloat) -> CGFloat {
  let x = clamp((value - edge0) / (edge1 - edge0))
  return x * x * (3 - 2 * x)
}

func entrance(_ t: CGFloat, start: CGFloat) -> CGFloat {
  let x = smoothstep(start, start + 0.14, t)
  let overshoot = 1 + 0.08 * sin(x * .pi) * (1 - x)
  return x * overshoot
}

func makeColor(_ r: CGFloat, _ g: CGFloat, _ b: CGFloat, _ a: CGFloat = 1) -> CGColor {
  CGColor(red: r / 255, green: g / 255, blue: b / 255, alpha: a)
}

let white = makeColor(255, 255, 255)
let yellow = makeColor(255, 201, 0)
let keyGreen = makeColor(0, 255, 0)
let setupFont = CTFontCreateWithName("HelveticaNeue-CondensedBold" as CFString, 62, nil)
let mainFont = CTFontCreateWithName("HelveticaNeue-CondensedBlack" as CFString, 178, nil)
let quoteFont = CTFontCreateWithName("HelveticaNeue-CondensedBlack" as CFString, 150, nil)

func drawText(_ text: String, font: CTFont, color: CGColor, context: CGContext,
              centerX: CGFloat, baselineY: CGFloat, alpha: CGFloat, scale: CGFloat) {
  let attributes: [CFString: Any] = [
    kCTFontAttributeName: font,
    kCTForegroundColorAttributeName: color.copy(alpha: alpha) ?? color
  ]
  let attributed = CFAttributedStringCreate(nil, text as CFString, attributes as CFDictionary)!
  let line = CTLineCreateWithAttributedString(attributed)
  let bounds = CTLineGetBoundsWithOptions(line, [.useGlyphPathBounds])

  context.saveGState()
  context.translateBy(x: centerX, y: baselineY)
  context.scaleBy(x: scale, y: scale)
  context.textMatrix = .identity
  context.textPosition = CGPoint(x: -bounds.midX, y: -bounds.minY)
  CTLineDraw(line, context)
  context.restoreGState()
}

func drawFrame(context: CGContext, frame: Int) {
  let t = CGFloat(frame) / CGFloat(frameCount - 1)
  let fadeOut = 1 - smoothstep(0.88, 0.99, t)
  let setup = entrance(t, start: 0.03)
  let lines = [
    ("HOW MANY", CGFloat(1200), CGFloat(0.25)),
    ("YEARS HAVE", CGFloat(995), CGFloat(0.275)),
    ("YOU BEEN", CGFloat(790), CGFloat(0.30)),
    ("SERVING?", CGFloat(585), CGFloat(0.325))
  ]

  drawText("WE ASKED FIRST LOVERS", font: setupFont, color: white, context: context,
           centerX: 540, baselineY: 1435 + (1 - setup) * 34,
           alpha: setup * fadeOut, scale: 0.94 + setup * 0.06)

  for (text, y, start) in lines {
    let amount = entrance(t, start: start)
    drawText(text, font: mainFont, color: yellow, context: context,
             centerX: 540, baselineY: y - (1 - amount) * 70,
             alpha: amount * fadeOut, scale: 0.68 + amount * 0.32)
  }

  let quoteIn = entrance(t, start: 0.25)
  drawText("“", font: quoteFont, color: yellow, context: context,
           centerX: 108, baselineY: 1320, alpha: quoteIn * fadeOut, scale: quoteIn)
  let quoteOut = entrance(t, start: 0.34)
  drawText("”", font: quoteFont, color: yellow, context: context,
           centerX: 960, baselineY: 505, alpha: quoteOut * fadeOut, scale: quoteOut)
}

func makePixelBuffer(pool: CVPixelBufferPool, frame: Int, greenKey: Bool) throws -> CVPixelBuffer {
  var maybeBuffer: CVPixelBuffer?
  guard CVPixelBufferPoolCreatePixelBuffer(nil, pool, &maybeBuffer) == kCVReturnSuccess,
        let buffer = maybeBuffer else { throw RenderError.cannotCreatePixelBuffer }

  CVPixelBufferLockBaseAddress(buffer, [])
  defer { CVPixelBufferUnlockBaseAddress(buffer, []) }
  guard let baseAddress = CVPixelBufferGetBaseAddress(buffer) else { throw RenderError.cannotCreatePixelBuffer }

  guard let context = CGContext(
    data: baseAddress,
    width: width,
    height: height,
    bitsPerComponent: 8,
    bytesPerRow: CVPixelBufferGetBytesPerRow(buffer),
    space: CGColorSpaceCreateDeviceRGB(),
    bitmapInfo: CGBitmapInfo.byteOrder32Big.rawValue | CGImageAlphaInfo.premultipliedFirst.rawValue
  ) else { throw RenderError.cannotCreateContext }

  let canvas = CGRect(x: 0, y: 0, width: width, height: height)
  context.clear(canvas)
  if greenKey {
    context.setFillColor(keyGreen)
    context.fill(canvas)
  }
  drawFrame(context: context, frame: frame)
  return buffer
}

func writeVideo(name: String, fileType: AVFileType, codec: AVVideoCodecType, greenKey: Bool) throws {
  let outputURL = outputDirectory.appendingPathComponent(name)
  try? FileManager.default.removeItem(at: outputURL)

  var compression: [String: Any] = [:]
  if codec == .h264 {
    compression = [AVVideoAverageBitRateKey: 10_000_000, AVVideoMaxKeyFrameIntervalKey: fps]
  }
  var settings: [String: Any] = [
    AVVideoCodecKey: codec,
    AVVideoWidthKey: width,
    AVVideoHeightKey: height
  ]
  if !compression.isEmpty { settings[AVVideoCompressionPropertiesKey] = compression }

  let writer = try AVAssetWriter(outputURL: outputURL, fileType: fileType)
  let input = AVAssetWriterInput(mediaType: .video, outputSettings: settings)
  input.expectsMediaDataInRealTime = false
  guard writer.canAdd(input) else { throw RenderError.cannotAddInput(outputURL) }
  writer.add(input)

  let adaptor = AVAssetWriterInputPixelBufferAdaptor(
    assetWriterInput: input,
    sourcePixelBufferAttributes: [
      kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32ARGB,
      kCVPixelBufferWidthKey as String: width,
      kCVPixelBufferHeightKey as String: height,
      kCVPixelBufferCGImageCompatibilityKey as String: true,
      kCVPixelBufferCGBitmapContextCompatibilityKey as String: true
    ]
  )

  guard writer.startWriting() else {
    throw RenderError.writerFailed(outputURL, writer.error?.localizedDescription ?? "Could not start writer")
  }
  writer.startSession(atSourceTime: .zero)

  for frame in 0..<frameCount {
    while !input.isReadyForMoreMediaData { Thread.sleep(forTimeInterval: 0.005) }
    let buffer = try makePixelBuffer(pool: adaptor.pixelBufferPool!, frame: frame, greenKey: greenKey)
    let time = CMTime(value: Int64(frame), timescale: fps)
    guard adaptor.append(buffer, withPresentationTime: time) else {
      throw RenderError.appendFailed(outputURL, frame)
    }
  }

  input.markAsFinished()
  let semaphore = DispatchSemaphore(value: 0)
  writer.finishWriting { semaphore.signal() }
  semaphore.wait()
  guard writer.status == .completed else {
    throw RenderError.writerFailed(outputURL, writer.error?.localizedDescription ?? "Writer did not complete")
  }
  print(outputURL.path)
}

do {
  try FileManager.default.createDirectory(at: outputDirectory, withIntermediateDirectories: true)
  try writeVideo(name: "how-many-years-serving-intro-transparent.mov", fileType: .mov, codec: .proRes4444, greenKey: false)
  try writeVideo(name: "how-many-years-serving-intro-phone.mp4", fileType: .mp4, codec: .h264, greenKey: false)
} catch {
  fputs("Export failed: \(error)\n", stderr)
  exit(1)
}
