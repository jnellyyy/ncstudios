import AppKit
import AVFoundation
import CoreGraphics
import CoreVideo
import Foundation

let exportURL = URL(fileURLWithPath: CommandLine.arguments.dropFirst().first ?? ".")
let framesURL = exportURL.appendingPathComponent("frames", isDirectory: true)
let width = 1920
let height = 1080
let fps: Int32 = 30
let frameCount = 120

enum RenderError: Error {
  case cannotCreateWriter
  case cannotAddInput
  case cannotCreatePixelBuffer
  case cannotLoadFrame(URL)
  case appendFailed(Int)
  case writerFailed(String)
}

func frameURL(_ index: Int) -> URL {
  framesURL.appendingPathComponent(String(format: "nc_watermark_%04d.png", index))
}

func makePixelBuffer(from url: URL, pool: CVPixelBufferPool, blackBackground: Bool) throws -> CVPixelBuffer {
  var maybeBuffer: CVPixelBuffer?
  let status = CVPixelBufferPoolCreatePixelBuffer(nil, pool, &maybeBuffer)
  guard status == kCVReturnSuccess, let buffer = maybeBuffer else {
    throw RenderError.cannotCreatePixelBuffer
  }

  guard
    let image = NSImage(contentsOf: url),
    let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil)
  else {
    throw RenderError.cannotLoadFrame(url)
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
    throw RenderError.cannotCreatePixelBuffer
  }

  let rect = CGRect(x: 0, y: 0, width: width, height: height)
  context.clear(rect)
  if blackBackground {
    context.setFillColor(NSColor.black.cgColor)
    context.fill(rect)
  }

  context.translateBy(x: 0, y: CGFloat(height))
  context.scaleBy(x: 1, y: -1)
  context.draw(cgImage, in: rect)

  return buffer
}

func writeVideo(outputURL: URL, fileType: AVFileType, codec: AVVideoCodecType, blackBackground: Bool) throws {
  try? FileManager.default.removeItem(at: outputURL)

  let settings: [String: Any] = [
    AVVideoCodecKey: codec,
    AVVideoWidthKey: width,
    AVVideoHeightKey: height
  ]

  let writer = try AVAssetWriter(outputURL: outputURL, fileType: fileType)
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

  for index in 0..<frameCount {
    while !input.isReadyForMoreMediaData {
      Thread.sleep(forTimeInterval: 0.01)
    }

    let buffer = try makePixelBuffer(from: frameURL(index), pool: adaptor.pixelBufferPool!, blackBackground: blackBackground)
    let presentationTime = CMTimeMultiply(frameDuration, multiplier: Int32(index))

    guard adaptor.append(buffer, withPresentationTime: presentationTime) else {
      throw RenderError.appendFailed(index)
    }
  }

  input.markAsFinished()

  let semaphore = DispatchSemaphore(value: 0)
  writer.finishWriting {
    semaphore.signal()
  }
  semaphore.wait()

  guard writer.status == .completed else {
    throw RenderError.writerFailed(writer.error?.localizedDescription ?? "Writer did not complete")
  }
}

do {
  let mp4URL = exportURL.appendingPathComponent("nc-watermark-animation-black-bg.mp4")
  try writeVideo(outputURL: mp4URL, fileType: .mp4, codec: .h264, blackBackground: true)
  print("mp4", mp4URL.path)

  let movURL = exportURL.appendingPathComponent("nc-watermark-animation-transparent.mov")
  do {
    if #available(macOS 10.15, *) {
      try writeVideo(outputURL: movURL, fileType: .mov, codec: .hevcWithAlpha, blackBackground: false)
    } else {
      try writeVideo(outputURL: movURL, fileType: .mov, codec: .proRes4444, blackBackground: false)
    }
    print("mov", movURL.path)
  } catch {
    fputs("transparent mov skipped: \(error)\n", stderr)
  }
} catch {
  fputs("video export failed: \(error)\n", stderr)
  exit(1)
}
