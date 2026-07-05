import AppKit
import AVFoundation
import CoreGraphics
import CoreText
import CoreVideo
import Foundation
import ImageIO
import UniformTypeIdentifiers

let exportURL = URL(fileURLWithPath: CommandLine.arguments.dropFirst().first ?? ".", isDirectory: true)
let width = 1920
let height = 1080
let fps: Int32 = 30
let frameCount = 80

struct RGB {
  let red: CGFloat
  let green: CGFloat
  let blue: CGFloat

  init(_ red: Int, _ green: Int, _ blue: Int) {
    self.red = CGFloat(red) / 255
    self.green = CGFloat(green) / 255
    self.blue = CGFloat(blue) / 255
  }

  var cgColor: CGColor {
    CGColor(red: red, green: green, blue: blue, alpha: 1)
  }
}

struct WordBeat {
  let text: String
  let delay: Double
  let scale: CGFloat
  let horizontalShift: CGFloat
  let verticalShift: CGFloat
  let mixedColor: RGB
}

struct Variant {
  let name: String
  let solidColor: RGB?
}

let white = RGB(255, 255, 255)
let gold = RGB(215, 182, 108)
let goldLight = RGB(241, 221, 169)
let cream = RGB(241, 231, 215)
let black = RGB(8, 8, 6)

let beats = [
  WordBeat(text: "PEOPLE", delay: 0.00, scale: 1.14, horizontalShift: 0.00, verticalShift: 0.00, mixedColor: white),
  WordBeat(text: "ENERGY", delay: 0.42, scale: 0.92, horizontalShift: -0.04, verticalShift: 0.18, mixedColor: goldLight),
  WordBeat(text: "MOMENTS", delay: 0.84, scale: 1.04, horizontalShift: 0.03, verticalShift: -0.16, mixedColor: white),
  WordBeat(text: "MOTION", delay: 1.26, scale: 0.88, horizontalShift: 0.00, verticalShift: 0.08, mixedColor: gold),
  WordBeat(text: "FEELING", delay: 1.68, scale: 1.08, horizontalShift: -0.02, verticalShift: -0.08, mixedColor: white),
  WordBeat(text: "NC STUDIO", delay: 2.10, scale: 0.84, horizontalShift: 0.00, verticalShift: 0.00, mixedColor: goldLight)
]

let variants = [
  Variant(name: "brand-mix", solidColor: nil),
  Variant(name: "gold", solidColor: gold),
  Variant(name: "white", solidColor: white),
  Variant(name: "cream", solidColor: cream),
  Variant(name: "black", solidColor: black)
]

enum RenderError: Error {
  case cannotCreatePixelBuffer
  case cannotCreateContext
  case cannotAddInput
  case cannotCreateImage
  case appendFailed(Int)
  case writerFailed(String)
}

func isVisible(_ beat: WordBeat, at time: Double) -> Bool {
  let visibleDuration = 0.56 * 0.82
  return time >= beat.delay && time <= beat.delay + visibleDuration
}

func drawWords(in context: CGContext, frame: Int, variant: Variant) {
  let time = Double(frame) / Double(fps)
  let baseFontSize: CGFloat = 240
  let baseCenterY = CGFloat(height) * 0.55

  context.setShouldAntialias(true)
  context.setAllowsAntialiasing(true)
  context.setShouldSmoothFonts(true)
  context.setAllowsFontSmoothing(true)

  for beat in beats where isVisible(beat, at: time) {
    let fontSize = baseFontSize * beat.scale
    let nsFont = NSFont.systemFont(ofSize: fontSize, weight: .heavy)
    let color = variant.solidColor ?? beat.mixedColor
    let attributed = NSAttributedString(
      string: beat.text,
      attributes: [
        .font: nsFont,
        .foregroundColor: NSColor(cgColor: color.cgColor)!,
        .kern: -0.085 * fontSize
      ]
    )
    let line = CTLineCreateWithAttributedString(attributed)
    let bounds = CTLineGetBoundsWithOptions(line, [.useOpticalBounds])
    let xShift = beat.horizontalShift * CGFloat(width)
    let yShift = beat.verticalShift * baseFontSize
    let origin = CGPoint(
      x: (CGFloat(width) - bounds.width) / 2 - bounds.minX + xShift,
      y: baseCenterY - bounds.midY + yShift
    )

    context.textPosition = origin
    CTLineDraw(line, context)
  }
}

func makePixelBuffer(pool: CVPixelBufferPool, frame: Int, variant: Variant) throws -> CVPixelBuffer {
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

  let context = CGContext(
    data: baseAddress,
    width: width,
    height: height,
    bitsPerComponent: 8,
    bytesPerRow: CVPixelBufferGetBytesPerRow(buffer),
    space: CGColorSpaceCreateDeviceRGB(),
    bitmapInfo: CGBitmapInfo.byteOrder32Big.rawValue | CGImageAlphaInfo.premultipliedFirst.rawValue
  )

  guard let context else {
    throw RenderError.cannotCreateContext
  }

  context.clear(CGRect(x: 0, y: 0, width: width, height: height))
  drawWords(in: context, frame: frame, variant: variant)

  if variant.name == "brand-mix", frame == 63, let image = context.makeImage() {
    let previewURL = exportURL.appendingPathComponent("nc-loading-word-flash-overlap-preview.png")
    if let destination = CGImageDestinationCreateWithURL(
      previewURL as CFURL,
      UTType.png.identifier as CFString,
      1,
      nil
    ) {
      CGImageDestinationAddImage(destination, image, nil)
      _ = CGImageDestinationFinalize(destination)
    }
  }

  return buffer
}

func writeVariant(_ variant: Variant) throws {
  let outputURL = exportURL.appendingPathComponent("nc-loading-word-flash-\(variant.name)-transparent.mov")
  try? FileManager.default.removeItem(at: outputURL)

  let settings: [String: Any] = [
    AVVideoCodecKey: AVVideoCodecType.proRes4444,
    AVVideoWidthKey: width,
    AVVideoHeightKey: height
  ]

  let writer = try AVAssetWriter(outputURL: outputURL, fileType: .mov)
  let input = AVAssetWriterInput(mediaType: .video, outputSettings: settings)
  input.expectsMediaDataInRealTime = false

  guard writer.canAdd(input) else {
    throw RenderError.cannotAddInput
  }
  writer.add(input)

  let attributes: [String: Any] = [
    kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32ARGB,
    kCVPixelBufferWidthKey as String: width,
    kCVPixelBufferHeightKey as String: height,
    kCVPixelBufferCGImageCompatibilityKey as String: true,
    kCVPixelBufferCGBitmapContextCompatibilityKey as String: true
  ]

  let adaptor = AVAssetWriterInputPixelBufferAdaptor(
    assetWriterInput: input,
    sourcePixelBufferAttributes: attributes
  )

  guard writer.startWriting() else {
    throw RenderError.writerFailed(writer.error?.localizedDescription ?? "Could not start writer")
  }

  writer.startSession(atSourceTime: .zero)
  let frameDuration = CMTime(value: 1, timescale: fps)

  for frame in 0..<frameCount {
    while !input.isReadyForMoreMediaData {
      Thread.sleep(forTimeInterval: 0.01)
    }

    guard let pool = adaptor.pixelBufferPool else {
      throw RenderError.cannotCreatePixelBuffer
    }
    let buffer = try makePixelBuffer(pool: pool, frame: frame, variant: variant)
    let presentationTime = CMTimeMultiply(frameDuration, multiplier: Int32(frame))
    guard adaptor.append(buffer, withPresentationTime: presentationTime) else {
      throw RenderError.appendFailed(frame)
    }
  }

  input.markAsFinished()
  let semaphore = DispatchSemaphore(value: 0)
  writer.finishWriting { semaphore.signal() }
  semaphore.wait()

  guard writer.status == .completed else {
    throw RenderError.writerFailed(writer.error?.localizedDescription ?? "Writer did not complete")
  }

  print(outputURL.path)
}

try FileManager.default.createDirectory(at: exportURL, withIntermediateDirectories: true)
for variant in variants {
  try writeVariant(variant)
}
