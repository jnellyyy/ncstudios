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

struct Variant {
  let name: String
  let red: UInt8
  let green: UInt8
  let blue: UInt8
}

let variants = [
  Variant(name: "gold", red: 216, green: 183, blue: 110),
  Variant(name: "white", red: 247, green: 239, blue: 227),
  Variant(name: "cream", red: 239, green: 225, blue: 204),
  Variant(name: "black", red: 5, green: 5, blue: 4)
]

enum RenderError: Error {
  case cannotCreatePixelBuffer
  case cannotLoadFrame(URL)
  case cannotCreateContext
  case cannotAddInput
  case appendFailed(Int)
  case writerFailed(String)
}

func frameURL(_ index: Int) -> URL {
  framesURL.appendingPathComponent(String(format: "nc_watermark_%04d.png", index))
}

func makePixelBuffer(from url: URL, pool: CVPixelBufferPool, variant: Variant) throws -> CVPixelBuffer {
  var maybeBuffer: CVPixelBuffer?
  let status = CVPixelBufferPoolCreatePixelBuffer(nil, pool, &maybeBuffer)
  guard status == kCVReturnSuccess, let buffer = maybeBuffer else {
    throw RenderError.cannotCreatePixelBuffer
  }

  guard
    let source = CGImageSourceCreateWithURL(url as CFURL, nil),
    let image = CGImageSourceCreateImageAtIndex(source, 0, nil)
  else {
    throw RenderError.cannotLoadFrame(url)
  }

  let bytesPerPixel = 4
  let sourceBytesPerRow = width * bytesPerPixel
  var sourcePixels = [UInt8](repeating: 0, count: sourceBytesPerRow * height)
  let colorSpace = CGColorSpaceCreateDeviceRGB()
  let bitmapInfo = CGBitmapInfo.byteOrder32Big.rawValue | CGImageAlphaInfo.premultipliedFirst.rawValue

  guard let sourceContext = CGContext(
    data: &sourcePixels,
    width: width,
    height: height,
    bitsPerComponent: 8,
    bytesPerRow: sourceBytesPerRow,
    space: colorSpace,
    bitmapInfo: bitmapInfo
  ) else {
    throw RenderError.cannotCreateContext
  }

  let rect = CGRect(x: 0, y: 0, width: width, height: height)
  sourceContext.clear(rect)
  sourceContext.draw(image, in: rect)

  CVPixelBufferLockBaseAddress(buffer, [])
  defer { CVPixelBufferUnlockBaseAddress(buffer, []) }

  guard let baseAddress = CVPixelBufferGetBaseAddress(buffer) else {
    throw RenderError.cannotCreatePixelBuffer
  }

  let bytesPerRow = CVPixelBufferGetBytesPerRow(buffer)

  let pixels = baseAddress.assumingMemoryBound(to: UInt8.self)
  for y in 0..<height {
    for x in 0..<width {
      let offset = y * bytesPerRow + x * 4
      let sourceOffset = y * sourceBytesPerRow + x * bytesPerPixel
      let alpha = sourcePixels[sourceOffset]

      let inverse = UInt16(255 - alpha)
      pixels[offset] = 255
      pixels[offset + 1] = UInt8((UInt16(variant.red) * UInt16(alpha) + 0 * inverse) / 255)
      pixels[offset + 2] = UInt8((UInt16(variant.green) * UInt16(alpha) + 255 * inverse) / 255)
      pixels[offset + 3] = UInt8((UInt16(variant.blue) * UInt16(alpha) + 0 * inverse) / 255)
    }
  }

  return buffer
}

func writeVariant(_ variant: Variant) throws {
  let outputURL = exportURL.appendingPathComponent("nc-watermark-animation-\(variant.name)-green-key-upright.mp4")
  try? FileManager.default.removeItem(at: outputURL)

  let videoSettings: [String: Any] = [
    AVVideoCodecKey: AVVideoCodecType.h264,
    AVVideoWidthKey: width,
    AVVideoHeightKey: height,
    AVVideoCompressionPropertiesKey: [
      AVVideoAverageBitRateKey: 12_000_000,
      AVVideoMaxKeyFrameIntervalKey: fps
    ]
  ]

  let writer = try AVAssetWriter(outputURL: outputURL, fileType: .mp4)
  let input = AVAssetWriterInput(mediaType: .video, outputSettings: videoSettings)
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

    let buffer = try makePixelBuffer(from: frameURL(index), pool: adaptor.pixelBufferPool!, variant: variant)
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

  print(outputURL.path)
}

for variant in variants {
  try writeVariant(variant)
}
