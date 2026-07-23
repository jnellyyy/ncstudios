#!/usr/bin/env swift

import AppKit
import AVFoundation
import CoreVideo
import Foundation

let width = 1080
let height = 1920
let fps: Int32 = 30
let duration = 6.0
let typeStart = 0.45
let charInterval = 0.085
let linePause = 0.22
let lines = ["60 SECONDS", "OF RAGE BAITING", "FIRST LOVERS"]
let cream = NSColor(calibratedRed: 1.0, green: 1.0, blue: 0.725, alpha: 1.0)

struct KeyEvent {
    let time: Double
    let line: Int
    let count: Int
}

func makeEvents() -> ([KeyEvent], Double) {
    var result: [KeyEvent] = []
    var moment = typeStart
    for (lineIndex, line) in lines.enumerated() {
        for count in 1...line.count {
            result.append(KeyEvent(time: moment, line: lineIndex, count: count))
            moment += charInterval
        }
        if lineIndex < lines.count - 1 { moment += linePause }
    }
    return (result, moment)
}

let (events, typeEnd) = makeEvents()

func clamp(_ value: Double) -> Double { min(1, max(0, value)) }

func easeInOut(_ value: Double) -> Double {
    let v = clamp(value)
    return v < 0.5 ? 4 * v * v * v : 1 - pow(-2 * v + 2, 3) / 2
}

func fittedFont(for text: String) -> NSFont {
    var size: CGFloat = 205
    while size > 80 {
        let font = NSFont(name: "AvenirNextCondensed-Heavy", size: size)
            ?? NSFont.systemFont(ofSize: size, weight: .black)
        let measured = (text as NSString).size(withAttributes: [.font: font]).width
        if measured <= 920 { return font }
        size -= 2
    }
    return NSFont.systemFont(ofSize: 80, weight: .black)
}

let fonts = lines.map(fittedFont)

func counts(at time: Double) -> [Int] {
    var values = Array(repeating: 0, count: lines.count)
    for event in events {
        if time < event.time { break }
        values[event.line] = event.count
    }
    return values
}

func makePixelBuffer(pool: CVPixelBufferPool, time: Double, transparent: Bool) -> CVPixelBuffer {
    var maybeBuffer: CVPixelBuffer?
    guard CVPixelBufferPoolCreatePixelBuffer(nil, pool, &maybeBuffer) == kCVReturnSuccess,
          let buffer = maybeBuffer else { fatalError("Could not create pixel buffer") }

    CVPixelBufferLockBaseAddress(buffer, [])
    defer { CVPixelBufferUnlockBaseAddress(buffer, []) }
    guard let base = CVPixelBufferGetBaseAddress(buffer) else { fatalError("No pixel buffer base") }
    let bytesPerRow = CVPixelBufferGetBytesPerRow(buffer)
    guard let context = CGContext(
        data: base,
        width: width,
        height: height,
        bitsPerComponent: 8,
        bytesPerRow: bytesPerRow,
        space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: CGBitmapInfo.byteOrder32Little.rawValue | CGImageAlphaInfo.premultipliedFirst.rawValue
    ) else { fatalError("Could not create graphics context") }

    context.clear(CGRect(x: 0, y: 0, width: width, height: height))
    if !transparent {
        context.setFillColor(NSColor(calibratedWhite: 0.125, alpha: 1).cgColor)
        context.fill(CGRect(x: 0, y: 0, width: width, height: height))
    }

    let fadeIn = clamp((time - typeStart) / 0.12)
    let fadeOut = 1 - easeInOut((time - 5.35) / 0.48)
    let alpha = fadeIn * fadeOut
    if alpha <= 0 { return buffer }

    NSGraphicsContext.saveGraphicsState()
    let graphics = NSGraphicsContext(cgContext: context, flipped: true)
    NSGraphicsContext.current = graphics

    let values = counts(at: time)
    let activeLine = values.lastIndex(where: { $0 > 0 }) ?? 0
    let top: CGFloat = 660
    let lineGap: CGFloat = 205
    for lineIndex in 0..<lines.count {
        let count = values[lineIndex]
        if count == 0 { continue }
        let full = lines[lineIndex]
        let font = fonts[lineIndex]
        let attributes: [NSAttributedString.Key: Any] = [
            .font: font,
            .foregroundColor: cream.withAlphaComponent(alpha),
            .kern: -1.5
        ]
        let fullWidth = (full as NSString).size(withAttributes: attributes).width
        let x = (CGFloat(width) - fullWidth) / 2
        let y = top + CGFloat(lineIndex) * lineGap
        let end = full.index(full.startIndex, offsetBy: count)
        let visible = String(full[..<end])
        (visible as NSString).draw(at: CGPoint(x: x, y: y), withAttributes: attributes)

        let cursorOn = time <= typeEnd + 0.08 || Int((time - typeEnd) * 3.5) % 2 == 0
        if lineIndex == activeLine && cursorOn {
            let typedWidth = (visible as NSString).size(withAttributes: attributes).width
            let cursorRect = NSRect(x: x + typedWidth + 9, y: y + 28, width: 10, height: font.pointSize - 13)
            cream.withAlphaComponent(alpha).setFill()
            NSBezierPath(roundedRect: cursorRect, xRadius: 4, yRadius: 4).fill()
        }
    }
    NSGraphicsContext.restoreGraphicsState()
    return buffer
}

func render(filename: String, codec: AVVideoCodecType, transparent: Bool) throws {
    let directory = URL(fileURLWithPath: #filePath).deletingLastPathComponent()
    let output = directory.appendingPathComponent(filename)
    try? FileManager.default.removeItem(at: output)
    let writer = try AVAssetWriter(outputURL: output, fileType: .mov)
    let settings: [String: Any] = [
        AVVideoCodecKey: codec,
        AVVideoWidthKey: width,
        AVVideoHeightKey: height
    ]
    let input = AVAssetWriterInput(mediaType: .video, outputSettings: settings)
    input.expectsMediaDataInRealTime = false
    let attributes: [String: Any] = [
        kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
        kCVPixelBufferWidthKey as String: width,
        kCVPixelBufferHeightKey as String: height
    ]
    let adapter = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: attributes)
    guard writer.canAdd(input) else { fatalError("Could not add video input") }
    writer.add(input)
    guard writer.startWriting() else { throw writer.error! }
    writer.startSession(atSourceTime: .zero)
    guard let pool = adapter.pixelBufferPool else { fatalError("No pixel buffer pool") }

    let frameCount = Int(duration * Double(fps))
    for frame in 0..<frameCount {
        while !input.isReadyForMoreMediaData { Thread.sleep(forTimeInterval: 0.002) }
        autoreleasepool {
            let time = Double(frame) / Double(fps)
            let pixelBuffer = makePixelBuffer(pool: pool, time: time, transparent: transparent)
            let presentation = CMTime(value: CMTimeValue(frame), timescale: fps)
            if !adapter.append(pixelBuffer, withPresentationTime: presentation) {
                fatalError("Could not append frame: \(writer.error?.localizedDescription ?? "unknown error")")
            }
        }
    }
    input.markAsFinished()
    let semaphore = DispatchSemaphore(value: 0)
    writer.finishWriting { semaphore.signal() }
    semaphore.wait()
    if writer.status != .completed { throw writer.error! }
    print(output.path)
}

do {
    try render(filename: "rage-bait-typewriter-transparent.mov", codec: .proRes4444, transparent: true)
    try render(filename: "rage-bait-typewriter-preview.mov", codec: .h264, transparent: false)
} catch {
    fputs("Render failed: \(error)\n", stderr)
    exit(1)
}
