import AppKit
import AVFoundation
import CoreGraphics
import CoreVideo
import Foundation

let exportURL = URL(fileURLWithPath: CommandLine.arguments.dropFirst().first ?? ".")
let width = 1920
let height = 1080
let fps: Int32 = 30
let frameCount = 60

struct Transition {
  let name: String
  let style: Style
}

enum Style {
  case scanWipe
  case bracketShutter
  case gridPulse
  case signalBreak
}

let transitions = [
  Transition(name: "nc-transition-gold-scan-wipe-upright", style: .scanWipe),
  Transition(name: "nc-transition-gold-bracket-shutter-upright", style: .bracketShutter),
  Transition(name: "nc-transition-gold-grid-pulse-upright", style: .gridPulse),
  Transition(name: "nc-transition-gold-signal-break-upright", style: .signalBreak)
]

enum RenderError: Error {
  case cannotCreatePixelBuffer
  case cannotCreateContext
  case cannotAddInput(URL)
  case appendFailed(URL, Int)
  case writerFailed(URL, String)
}

func color(_ red: CGFloat, _ green: CGFloat, _ blue: CGFloat, _ alpha: CGFloat) -> CGColor {
  CGColor(red: red / 255, green: green / 255, blue: blue / 255, alpha: alpha)
}

let gold = color(216, 183, 110, 1)
let brightGold = color(240, 220, 168, 1)
let deepGold = color(143, 111, 47, 1)
let keyGreen = color(0, 255, 0, 1)

func clamp(_ value: CGFloat, _ minValue: CGFloat = 0, _ maxValue: CGFloat = 1) -> CGFloat {
  min(max(value, minValue), maxValue)
}

func smoothstep(_ edge0: CGFloat, _ edge1: CGFloat, _ value: CGFloat) -> CGFloat {
  let x = clamp((value - edge0) / (edge1 - edge0))
  return x * x * (3 - 2 * x)
}

func pulse(_ center: CGFloat, _ width: CGFloat, _ t: CGFloat) -> CGFloat {
  let distance = abs(t - center)
  return clamp(1 - distance / width)
}

func random(_ seed: Int) -> CGFloat {
  var x = UInt64(bitPattern: Int64(seed &* 1103515245 &+ 12345))
  x ^= x >> 12
  x ^= x << 25
  x ^= x >> 27
  let result = x &* 2685821657736338717
  return CGFloat(result % 10000) / 10000
}

func fill(_ context: CGContext, _ rect: CGRect, _ fillColor: CGColor, alpha: CGFloat = 1) {
  context.saveGState()
  context.setAlpha(alpha)
  context.setFillColor(fillColor)
  context.fill(rect)
  context.restoreGState()
}

func strokeLine(_ context: CGContext, from: CGPoint, to: CGPoint, color strokeColor: CGColor, width lineWidth: CGFloat, alpha: CGFloat = 1) {
  context.saveGState()
  context.setAlpha(alpha)
  context.setStrokeColor(strokeColor)
  context.setLineWidth(lineWidth)
  context.move(to: from)
  context.addLine(to: to)
  context.strokePath()
  context.restoreGState()
}

func glowRect(_ context: CGContext, _ rect: CGRect, _ fillColor: CGColor, alpha: CGFloat, blur: CGFloat) {
  context.saveGState()
  context.setShadow(offset: .zero, blur: blur, color: fillColor.copy(alpha: alpha * 0.65))
  context.setFillColor(fillColor.copy(alpha: alpha) ?? fillColor)
  context.fill(rect)
  context.restoreGState()
}

func renderTransition(_ transition: Transition, frame: Int, context: CGContext) {
  let t = CGFloat(frame) / CGFloat(frameCount - 1)

  switch transition.style {
  case .scanWipe:
    renderScanWipe(frame: frame, t: t, context: context)
  case .bracketShutter:
    renderBracketShutter(frame: frame, t: t, context: context)
  case .gridPulse:
    renderGridPulse(frame: frame, t: t, context: context)
  case .signalBreak:
    renderSignalBreak(frame: frame, t: t, context: context)
  }
}

func renderScanWipe(frame: Int, t: CGFloat, context: CGContext) {
  let sweep = -360 + (CGFloat(width) + 720) * smoothstep(0.03, 0.94, t)
  let fade = sin(t * .pi)
  let bandHeight: CGFloat = 18 + 18 * pulse(0.5, 0.32, t)
  glowRect(context, CGRect(x: sweep - 120, y: 0, width: 42, height: CGFloat(height)), brightGold, alpha: 0.16 * fade, blur: 28)
  glowRect(context, CGRect(x: sweep, y: 0, width: 5, height: CGFloat(height)), brightGold, alpha: 0.56 * fade, blur: 18)

  for index in 0..<16 {
    let y = CGFloat(index) * CGFloat(height) / 15 + CGFloat(Int(random(frame + index) * 38) - 19)
    let offset = CGFloat(index % 4) * 74
    let x = sweep - 520 + offset
    let alpha = (0.14 + random(index * 44 + frame) * 0.42) * fade
    fill(context, CGRect(x: x, y: y, width: 380 + random(index) * 520, height: 2), gold, alpha: alpha)
  }

  let centerBandY = CGFloat(height) * (0.52 + 0.03 * sin(t * .pi * 3))
  glowRect(context, CGRect(x: sweep - 620, y: centerBandY, width: 820, height: bandHeight), gold, alpha: 0.30 * fade, blur: 20)
  fill(context, CGRect(x: sweep - 650, y: centerBandY + bandHeight + 10, width: 470, height: 2), brightGold, alpha: 0.50 * fade)
  fill(context, CGRect(x: sweep - 420, y: centerBandY - 18, width: 210, height: 2), brightGold, alpha: 0.34 * fade)
}

func renderBracketShutter(frame: Int, t: CGFloat, context: CGContext) {
  let reveal = smoothstep(0.05, 0.48, t)
  let release = smoothstep(0.52, 0.98, t)
  let hold = 1 - release
  let alpha = sin(t * .pi)
  let gap = CGFloat(width) * (0.38 - 0.28 * reveal + 0.18 * release)
  let centerX = CGFloat(width) / 2
  let leftX = centerX - gap - 190
  let rightX = centerX + gap + 128
  let topY: CGFloat = 220
  let bottomY: CGFloat = CGFloat(height) - 220

  glowRect(context, CGRect(x: leftX, y: topY, width: 28, height: bottomY - topY), gold, alpha: 0.46 * alpha, blur: 14)
  glowRect(context, CGRect(x: rightX, y: topY, width: 28, height: bottomY - topY), gold, alpha: 0.46 * alpha, blur: 14)
  fill(context, CGRect(x: leftX, y: topY, width: 160, height: 18), brightGold, alpha: 0.55 * alpha)
  fill(context, CGRect(x: leftX, y: bottomY - 18, width: 160, height: 18), brightGold, alpha: 0.55 * alpha)
  fill(context, CGRect(x: rightX - 132, y: topY, width: 160, height: 18), brightGold, alpha: 0.55 * alpha)
  fill(context, CGRect(x: rightX - 132, y: bottomY - 18, width: 160, height: 18), brightGold, alpha: 0.55 * alpha)

  for index in 0..<10 {
    let localAlpha = pulse(0.5, 0.36, t) * (0.10 + random(index) * 0.22)
    let y = CGFloat(120 + index * 84)
    strokeLine(context, from: CGPoint(x: 180, y: y), to: CGPoint(x: CGFloat(width - 180), y: y), color: deepGold, width: 1, alpha: localAlpha * hold)
  }

  let flash = pulse(0.49, 0.05, t)
  glowRect(context, CGRect(x: 0, y: CGFloat(height) / 2 - 20, width: CGFloat(width), height: 40), brightGold, alpha: 0.16 * flash, blur: 30)
}

func renderGridPulse(frame: Int, t: CGFloat, context: CGContext) {
  let alpha = sin(t * .pi)
  let gridAlpha = 0.24 * alpha
  let marginX: CGFloat = 150
  let marginY: CGFloat = 96
  let columns = [marginX, CGFloat(width) * 0.28, CGFloat(width) * 0.50, CGFloat(width) * 0.72, CGFloat(width) - marginX]
  let rows = [marginY, CGFloat(height) * 0.28, CGFloat(height) * 0.50, CGFloat(height) * 0.72, CGFloat(height) - marginY]

  for x in columns {
    strokeLine(context, from: CGPoint(x: x, y: marginY), to: CGPoint(x: x, y: CGFloat(height) - marginY), color: gold, width: 1, alpha: gridAlpha)
  }

  for y in rows {
    strokeLine(context, from: CGPoint(x: marginX, y: y), to: CGPoint(x: CGFloat(width) - marginX, y: y), color: gold, width: 1, alpha: gridAlpha)
  }

  let center = CGPoint(x: CGFloat(width) / 2, y: CGFloat(height) / 2)
  let ring = 170 + 130 * smoothstep(0.1, 0.88, t)
  context.saveGState()
  context.setStrokeColor(brightGold.copy(alpha: 0.32 * alpha) ?? brightGold)
  context.setLineWidth(2)
  context.setShadow(offset: .zero, blur: 10, color: brightGold.copy(alpha: 0.24 * alpha))
  context.strokeEllipse(in: CGRect(x: center.x - ring, y: center.y - ring, width: ring * 2, height: ring * 2))
  context.restoreGState()

  for pointIndex in 0..<18 {
    let x = marginX + random(pointIndex * 99) * (CGFloat(width) - marginX * 2)
    let y = marginY + random(pointIndex * 199 + 7) * (CGFloat(height) - marginY * 2)
    let size = 18 + random(pointIndex * 77) * 28
    let localAlpha = alpha * (0.10 + random(frame + pointIndex * 13) * 0.38)
    strokeLine(context, from: CGPoint(x: x - size / 2, y: y), to: CGPoint(x: x + size / 2, y: y), color: brightGold, width: 1.5, alpha: localAlpha)
    strokeLine(context, from: CGPoint(x: x, y: y - size / 2), to: CGPoint(x: x, y: y + size / 2), color: brightGold, width: 1.5, alpha: localAlpha)
  }
}

func renderSignalBreak(frame: Int, t: CGFloat, context: CGContext) {
  let alpha = sin(t * .pi)
  let mainFlash = max(pulse(0.24, 0.08, t), pulse(0.55, 0.06, t), pulse(0.78, 0.08, t))

  for index in 0..<34 {
    let group = Int(t * 12)
    let r1 = random(index * 331 + group * 17)
    let r2 = random(index * 997 + group * 41)
    let y = r1 * CGFloat(height)
    let w = 80 + random(index * 53 + group) * 540
    let h = 3 + random(index * 71 + group) * 22
    let x = -120 + r2 * CGFloat(width + 240)
    let localAlpha = alpha * (0.06 + random(index * 117 + frame) * 0.32) * (0.42 + mainFlash)
    let useBright = index % 4 == 0
    fill(context, CGRect(x: x, y: y, width: w, height: h), useBright ? brightGold : gold, alpha: localAlpha)
  }

  for index in 0..<8 {
    let y = CGFloat(height) * (0.20 + CGFloat(index) * 0.075)
    let slide = CGFloat(width) * (smoothstep(0.15, 0.86, t) - 0.5)
    let x = CGFloat(width) / 2 - 520 + slide * (index % 2 == 0 ? 1 : -1)
    glowRect(context, CGRect(x: x, y: y, width: 1040, height: 9), brightGold, alpha: 0.10 * alpha, blur: 8)
  }

  let cutAlpha = pulse(0.5, 0.12, t)
  fill(context, CGRect(x: 0, y: CGFloat(height) * 0.50 - 2, width: CGFloat(width), height: 4), brightGold, alpha: 0.58 * cutAlpha)
  fill(context, CGRect(x: CGFloat(width) * 0.50 - 2, y: 0, width: 4, height: CGFloat(height)), gold, alpha: 0.18 * cutAlpha)
}

func makePixelBuffer(pool: CVPixelBufferPool, transition: Transition, frame: Int, greenKey: Bool) throws -> CVPixelBuffer {
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

  guard let context = CGContext(
    data: baseAddress,
    width: width,
    height: height,
    bitsPerComponent: 8,
    bytesPerRow: bytesPerRow,
    space: colorSpace,
    bitmapInfo: bitmapInfo
  ) else {
    throw RenderError.cannotCreateContext
  }

  let rect = CGRect(x: 0, y: 0, width: width, height: height)
  if greenKey {
    context.setFillColor(keyGreen)
    context.fill(rect)
  } else {
    context.clear(rect)
  }

  renderTransition(transition, frame: frame, context: context)
  return buffer
}

func writeTransition(_ transition: Transition, outputURL: URL, fileType: AVFileType, codec: AVVideoCodecType, greenKey: Bool) throws {
  try? FileManager.default.removeItem(at: outputURL)

  var videoSettings: [String: Any] = [
    AVVideoCodecKey: codec,
    AVVideoWidthKey: width,
    AVVideoHeightKey: height
  ]

  if codec == .h264 {
    videoSettings[AVVideoCompressionPropertiesKey] = [
      AVVideoAverageBitRateKey: 14_000_000,
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

    let buffer = try makePixelBuffer(pool: adaptor.pixelBufferPool!, transition: transition, frame: frame, greenKey: greenKey)
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

try FileManager.default.createDirectory(at: exportURL, withIntermediateDirectories: true)

for transition in transitions {
  try writeTransition(
    transition,
    outputURL: exportURL.appendingPathComponent("\(transition.name)-transparent.mov"),
    fileType: .mov,
    codec: .proRes4444,
    greenKey: false
  )

  try writeTransition(
    transition,
    outputURL: exportURL.appendingPathComponent("\(transition.name)-green-key.mp4"),
    fileType: .mp4,
    codec: .h264,
    greenKey: true
  )
}
