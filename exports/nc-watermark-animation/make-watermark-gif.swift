import AppKit
import Foundation
import ImageIO
import UniformTypeIdentifiers

let exportURL = URL(fileURLWithPath: CommandLine.arguments.dropFirst().first ?? ".")
let framesURL = exportURL.appendingPathComponent("frames", isDirectory: true)
let outputURL = exportURL.appendingPathComponent("nc-watermark-animation-transparent.gif")
let frameCount = 120
let fps = 30.0

enum ExportError: Error {
  case cannotCreateDestination
  case cannotLoadFrame(URL)
  case cannotFinalize
}

func frameURL(_ index: Int) -> URL {
  framesURL.appendingPathComponent(String(format: "nc_watermark_%04d.png", index))
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
  let url = frameURL(index)
  guard
    let source = CGImageSourceCreateWithURL(url as CFURL, nil),
    let image = CGImageSourceCreateImageAtIndex(source, 0, nil)
  else {
    throw ExportError.cannotLoadFrame(url)
  }

  CGImageDestinationAddImage(destination, image, frameProperties as CFDictionary)
}

guard CGImageDestinationFinalize(destination) else {
  throw ExportError.cannotFinalize
}

print(outputURL.path)
