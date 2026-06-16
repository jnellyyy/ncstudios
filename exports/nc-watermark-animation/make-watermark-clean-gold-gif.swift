import AppKit
import Foundation
import ImageIO
import UniformTypeIdentifiers

let exportURL = URL(fileURLWithPath: CommandLine.arguments.dropFirst().first ?? ".")
let framesURL = exportURL.appendingPathComponent("frames", isDirectory: true)
let outputURL = exportURL.appendingPathComponent("nc-watermark-animation-gold-transparent-clean.gif")
let frameCount = 120
let fps = 30.0
let width = 1920
let height = 1080
let gold = (red: UInt8(216), green: UInt8(183), blue: UInt8(110))

enum ExportError: Error {
  case cannotCreateDestination
  case cannotLoadFrame(URL)
  case cannotCreateContext
  case cannotFinalize
}

func frameURL(_ index: Int) -> URL {
  framesURL.appendingPathComponent(String(format: "nc_watermark_%04d.png", index))
}

func cleanGoldFrame(from url: URL) throws -> CGImage {
  guard
    let source = CGImageSourceCreateWithURL(url as CFURL, nil),
    let image = CGImageSourceCreateImageAtIndex(source, 0, nil)
  else {
    throw ExportError.cannotLoadFrame(url)
  }

  let bytesPerPixel = 4
  let bytesPerRow = width * bytesPerPixel
  var pixels = [UInt8](repeating: 0, count: bytesPerRow * height)
  let colorSpace = CGColorSpaceCreateDeviceRGB()
  let bitmapInfo = CGBitmapInfo.byteOrder32Big.rawValue | CGImageAlphaInfo.premultipliedLast.rawValue

  guard let context = CGContext(
    data: &pixels,
    width: width,
    height: height,
    bitsPerComponent: 8,
    bytesPerRow: bytesPerRow,
    space: colorSpace,
    bitmapInfo: bitmapInfo
  ) else {
    throw ExportError.cannotCreateContext
  }

  context.clear(CGRect(x: 0, y: 0, width: width, height: height))
  context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))

  for offset in stride(from: 0, to: pixels.count, by: bytesPerPixel) {
    let sourceAlpha = pixels[offset + 3]
    if sourceAlpha > 10 {
      pixels[offset] = gold.red
      pixels[offset + 1] = gold.green
      pixels[offset + 2] = gold.blue
      pixels[offset + 3] = 255
    } else {
      pixels[offset] = 0
      pixels[offset + 1] = 0
      pixels[offset + 2] = 0
      pixels[offset + 3] = 0
    }
  }

  guard let output = context.makeImage() else {
    throw ExportError.cannotCreateContext
  }

  return output
}

try? FileManager.default.removeItem(at: outputURL)

guard let destination = CGImageDestinationCreateWithURL(
  outputURL as CFURL,
  UTType.gif.identifier as CFString,
  frameCount,
  nil
) else {
  throw ExportError.cannotCreateDestination
}

let gifProperties: [String: Any] = [
  kCGImagePropertyGIFDictionary as String: [
    kCGImagePropertyGIFLoopCount as String: 0
  ]
]

let frameProperties: [String: Any] = [
  kCGImagePropertyGIFDictionary as String: [
    kCGImagePropertyGIFDelayTime as String: 1.0 / fps,
    kCGImagePropertyGIFUnclampedDelayTime as String: 1.0 / fps
  ]
]

CGImageDestinationSetProperties(destination, gifProperties as CFDictionary)

for index in 0..<frameCount {
  let frame = try cleanGoldFrame(from: frameURL(index))
  CGImageDestinationAddImage(destination, frame, frameProperties as CFDictionary)
}

guard CGImageDestinationFinalize(destination) else {
  throw ExportError.cannotFinalize
}

print(outputURL.path)
