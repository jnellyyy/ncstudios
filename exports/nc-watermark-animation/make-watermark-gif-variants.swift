import AppKit
import Foundation
import ImageIO
import UniformTypeIdentifiers

let exportURL = URL(fileURLWithPath: CommandLine.arguments.dropFirst().first ?? ".")
let framesURL = exportURL.appendingPathComponent("frames", isDirectory: true)
let frameCount = 120
let fps = 30.0
let width = 1920
let height = 1080

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

enum ExportError: Error {
  case cannotCreateDestination(URL)
  case cannotLoadFrame(URL)
  case cannotCreateContext
  case cannotFinalize(URL)
}

func frameURL(_ index: Int) -> URL {
  framesURL.appendingPathComponent(String(format: "nc_watermark_%04d.png", index))
}

func recoloredFrame(from url: URL, variant: Variant) throws -> CGImage {
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
    let alpha = pixels[offset + 3]
    guard alpha > 0 else { continue }

    pixels[offset] = UInt8((UInt16(variant.red) * UInt16(alpha)) / 255)
    pixels[offset + 1] = UInt8((UInt16(variant.green) * UInt16(alpha)) / 255)
    pixels[offset + 2] = UInt8((UInt16(variant.blue) * UInt16(alpha)) / 255)
  }

  guard let output = context.makeImage() else {
    throw ExportError.cannotCreateContext
  }

  return output
}

func writeGIF(variant: Variant) throws {
  let outputURL = exportURL.appendingPathComponent("nc-watermark-animation-\(variant.name)-transparent.gif")
  try? FileManager.default.removeItem(at: outputURL)

  guard let destination = CGImageDestinationCreateWithURL(
    outputURL as CFURL,
    UTType.gif.identifier as CFString,
    frameCount,
    nil
  ) else {
    throw ExportError.cannotCreateDestination(outputURL)
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
    let frame = try recoloredFrame(from: frameURL(index), variant: variant)
    CGImageDestinationAddImage(destination, frame, frameProperties as CFDictionary)
  }

  guard CGImageDestinationFinalize(destination) else {
    throw ExportError.cannotFinalize(outputURL)
  }

  print(outputURL.path)
}

for variant in variants {
  try writeGIF(variant: variant)
}
