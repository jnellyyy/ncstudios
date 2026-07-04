#!/usr/bin/env python3
"""Render a transparent DONALD arrow callout with a synced ding."""

from __future__ import annotations

import math
import os
import shutil
import subprocess
import wave
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont


WIDTH = 1920
HEIGHT = 1080
FPS = 30
DURATION = 3.0
FRAME_COUNT = round(DURATION * FPS)
SAMPLE_RATE = 48_000

HERE = Path(__file__).resolve().parent
FRAMES_DIR = HERE / "frames"
FONT_PATH = Path("/System/Library/Fonts/Avenir Next Condensed.ttc")

RED = (242, 20, 55, 255)
RED_LIGHT = (255, 82, 105, 255)


def clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return min(high, max(low, value))


def ease_out_cubic(value: float) -> float:
    value = clamp(value)
    return 1 - (1 - value) ** 3


def ease_in_out_cubic(value: float) -> float:
    value = clamp(value)
    return 4 * value**3 if value < 0.5 else 1 - (-2 * value + 2) ** 3 / 2


def ease_out_back(value: float) -> float:
    value = clamp(value)
    c1 = 1.70158
    c3 = c1 + 1
    return 1 + c3 * (value - 1) ** 3 + c1 * (value - 1) ** 2


def with_opacity(image: Image.Image, opacity: float) -> Image.Image:
    result = image.copy()
    result.putalpha(result.getchannel("A").point(lambda a: round(a * clamp(opacity))))
    return result


def cubic_bezier_points(
    start: tuple[float, float],
    control_one: tuple[float, float],
    control_two: tuple[float, float],
    end: tuple[float, float],
    count: int = 140,
) -> list[tuple[float, float]]:
    points = []
    for index in range(count):
        t = index / (count - 1)
        inverse = 1 - t
        x = (
            inverse**3 * start[0]
            + 3 * inverse**2 * t * control_one[0]
            + 3 * inverse * t**2 * control_two[0]
            + t**3 * end[0]
        )
        y = (
            inverse**3 * start[1]
            + 3 * inverse**2 * t * control_one[1]
            + 3 * inverse * t**2 * control_two[1]
            + t**3 * end[1]
        )
        points.append((x, y))
    return points


ARROW_POINTS = cubic_bezier_points(
    (1240, 430),
    (1160, 460),
    (900, 500),
    (742, 682),
)


def arrow_layer(progress: float, opacity: float) -> Image.Image:
    progress = clamp(progress)
    layer = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    if progress <= 0 or opacity <= 0:
        return layer

    point_count = max(2, round((len(ARROW_POINTS) - 1) * progress) + 1)
    visible = ARROW_POINTS[:point_count]

    glow = Image.new("RGBA", layer.size, (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_draw.line(visible, fill=(242, 20, 55, round(95 * opacity)), width=45, joint="curve")
    glow = glow.filter(ImageFilter.GaussianBlur(15))
    layer.alpha_composite(glow)

    shadow = Image.new("RGBA", layer.size, (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    shifted = [(x + 6, y + 10) for x, y in visible]
    shadow_draw.line(shifted, fill=(0, 0, 0, round(125 * opacity)), width=31, joint="curve")
    shadow = shadow.filter(ImageFilter.GaussianBlur(8))
    layer.alpha_composite(shadow)

    draw = ImageDraw.Draw(layer)
    draw.line(visible, fill=(RED[0], RED[1], RED[2], round(255 * opacity)), width=27, joint="curve")

    if progress > 0.78:
        head_scale = ease_out_back((progress - 0.78) / 0.22)
        tip = visible[-1]
        previous = visible[max(0, len(visible) - 5)]
        dx = tip[0] - previous[0]
        dy = tip[1] - previous[1]
        length = max(1, math.hypot(dx, dy))
        ux, uy = dx / length, dy / length
        px, py = -uy, ux
        head_length = 72 * head_scale
        half_width = 42 * head_scale
        base_x = tip[0] - ux * head_length
        base_y = tip[1] - uy * head_length
        triangle = [
            tip,
            (base_x + px * half_width, base_y + py * half_width),
            (base_x - px * half_width, base_y - py * half_width),
        ]
        draw.polygon(triangle, fill=(RED[0], RED[1], RED[2], round(255 * opacity)))
    return layer


def name_layer() -> Image.Image:
    font = ImageFont.truetype(str(FONT_PATH), 154, index=8)
    probe = Image.new("L", (1, 1), 0)
    probe_draw = ImageDraw.Draw(probe)
    bbox = probe_draw.textbbox((0, 0), "DONALD", font=font, anchor="ls", stroke_width=2)
    padding = 75
    size = (bbox[2] - bbox[0] + padding * 2, bbox[3] - bbox[1] + padding * 2)
    baseline = padding - bbox[1]

    mask = Image.new("L", size, 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.text(
        (padding - bbox[0], baseline),
        "DONALD",
        font=font,
        anchor="ls",
        fill=255,
        stroke_width=2,
        stroke_fill=255,
    )

    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    glow = Image.new("RGBA", size, (242, 20, 55, 0))
    glow.putalpha(mask.filter(ImageFilter.GaussianBlur(15)).point(lambda a: round(a * 0.16)))
    layer.alpha_composite(glow)

    shadow_mask = Image.new("L", size, 0)
    shadow_mask.paste(mask, (6, 10))
    shadow = Image.new("RGBA", size, (0, 0, 0, 0))
    shadow.putalpha(shadow_mask.filter(ImageFilter.GaussianBlur(7)).point(lambda a: round(a * 0.72)))
    layer.alpha_composite(shadow)

    face = Image.new("RGBA", size, RED)
    face.putalpha(mask)
    layer.alpha_composite(face)

    highlight_mask = Image.new("L", size, 0)
    highlight_mask.paste(mask, (-2, -2))
    highlight = Image.new("RGBA", size, RED_LIGHT)
    highlight.putalpha(highlight_mask.point(lambda a: round(a * 0.24)))
    layer.alpha_composite(highlight)
    return layer


def composite_transformed(
    canvas: Image.Image,
    layer: Image.Image,
    center: tuple[float, float],
    scale: float,
    angle: float,
    opacity: float,
) -> None:
    if opacity <= 0:
        return
    resized = layer.resize(
        (max(1, round(layer.width * scale)), max(1, round(layer.height * scale))),
        Image.Resampling.LANCZOS,
    )
    if abs(angle) > 0.01:
        resized = resized.rotate(angle, resample=Image.Resampling.BICUBIC, expand=True)
    resized = with_opacity(resized, opacity)
    destination = (round(center[0] - resized.width / 2), round(center[1] - resized.height / 2))
    canvas.alpha_composite(resized, destination)


def render_frame(frame_index: int, label: Image.Image) -> Image.Image:
    t = frame_index / FPS
    canvas = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))

    out = ease_in_out_cubic((t - 2.48) / 0.46)
    opacity = 1 - out
    arrow_progress = ease_in_out_cubic((t - 0.20) / 0.56)
    canvas.alpha_composite(arrow_layer(arrow_progress, opacity))

    enter = clamp((t - 0.66) / 0.42)
    label_opacity = ease_out_cubic((t - 0.66) / 0.18) * opacity
    label_scale = 0.58 + 0.42 * ease_out_back(enter)
    label_scale *= 1 + 0.022 * math.exp(-((t - 1.03) / 0.10) ** 2)
    label_y = 344 + (1 - ease_out_cubic(enter)) * 34 - out * 28
    label_angle = -2.8 * (1 - ease_out_cubic(enter))

    echo = (1 - clamp((t - 0.68) / 0.32)) * label_opacity
    if echo > 0:
        composite_transformed(
            canvas,
            label,
            (1300, label_y),
            label_scale + 0.08 * echo,
            label_angle * 0.5,
            0.16 * echo,
        )
    composite_transformed(canvas, label, (1300, label_y), label_scale, label_angle, label_opacity)
    return canvas


def make_ding(path: Path) -> None:
    sample_count = round(DURATION * SAMPLE_RATE)
    signal = np.zeros(sample_count, dtype=np.float64)
    start = round(0.77 * SAMPLE_RATE)
    ding_length = round(1.25 * SAMPLE_RATE)
    local_time = np.arange(ding_length, dtype=np.float64) / SAMPLE_RATE
    attack = 1 - np.exp(-local_time / 0.0035)
    decay = np.exp(-local_time * 4.8)
    shimmer = (
        0.62 * np.sin(2 * np.pi * 1318.51 * local_time)
        + 0.25 * np.sin(2 * np.pi * 1975.53 * local_time + 0.12)
        + 0.13 * np.sin(2 * np.pi * 2637.02 * local_time + 0.34)
    )
    ding = attack * decay * shimmer
    second_delay = round(0.075 * SAMPLE_RATE)
    second_time = local_time[:-second_delay]
    ding[second_delay:] += 0.28 * np.exp(-second_time * 6.2) * np.sin(
        2 * np.pi * 1760.0 * second_time
    )
    signal[start : start + ding_length] = ding

    peak = max(1e-9, float(np.max(np.abs(signal))))
    signal = signal / peak * 0.78
    right = np.concatenate((np.zeros(17), signal[:-17]))
    stereo = np.column_stack((signal, right))
    pcm = np.clip(stereo * 32767, -32768, 32767).astype("<i2")

    with wave.open(str(path), "wb") as wav_file:
        wav_file.setnchannels(2)
        wav_file.setsampwidth(2)
        wav_file.setframerate(SAMPLE_RATE)
        wav_file.writeframes(pcm.tobytes())


def make_preview_background() -> Image.Image:
    x = np.linspace(0, 1, WIDTH, dtype=np.float32)[None, :]
    y = np.linspace(0, 1, HEIGHT, dtype=np.float32)[:, None]
    distance = np.sqrt((x - 0.5) ** 2 + (y - 0.5) ** 2)
    shade = np.maximum(0.48, 1 - distance * 0.65)
    red = (13 + 25 * x + 21 * y) * shade
    green = (18 + 10 * x + 7 * y) * shade
    blue = (32 + 36 * (1 - x) + 18 * y) * shade
    array = np.dstack((red, green, blue)).clip(0, 255).astype(np.uint8)
    image = Image.fromarray(array, "RGB").convert("RGBA")

    bloom = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(bloom)
    draw.ellipse((-250, 520, 650, 1420), fill=(215, 25, 72, 90))
    draw.ellipse((1350, -380, 2240, 510), fill=(50, 109, 255, 78))
    bloom = bloom.filter(ImageFilter.GaussianBlur(150))
    return Image.alpha_composite(image, bloom).convert("RGB")


def make_contact_sheet(background: Image.Image, selected: list[int]) -> None:
    thumb = (480, 270)
    sheet = Image.new("RGB", (1440, 540), (10, 10, 14))
    font = ImageFont.truetype(str(FONT_PATH), 24, index=2)
    for slot, frame_index in enumerate(selected):
        overlay = Image.open(FRAMES_DIR / f"frame-{frame_index:04d}.png").convert("RGBA")
        panel = Image.alpha_composite(background.convert("RGBA"), overlay)
        panel = panel.resize(thumb, Image.Resampling.LANCZOS).convert("RGB")
        left = (slot % 3) * thumb[0]
        top = (slot // 3) * thumb[1]
        sheet.paste(panel, (left, top))
        draw = ImageDraw.Draw(sheet)
        label = f"{frame_index / FPS:0.1f}s"
        draw.rounded_rectangle((left + 14, top + 14, left + 76, top + 46), 8, fill=(0, 0, 0))
        draw.text((left + 24, top + 40), label, font=font, anchor="ls", fill=(255, 255, 255))
    sheet.save(HERE / "donald-arrow-callout-contact-sheet.jpg", quality=92)


def run_ffmpeg(ffmpeg: str, ding: Path, background: Path) -> None:
    pattern = str(FRAMES_DIR / "frame-%04d.png")
    alpha_mov = HERE / "donald-red-arrow-callout-transparent-with-ding.mov"
    preview = HERE / "donald-red-arrow-callout-preview-with-ding.mp4"

    subprocess.run(
        [
            ffmpeg,
            "-y",
            "-framerate",
            str(FPS),
            "-i",
            pattern,
            "-i",
            str(ding),
            "-c:v",
            "prores_ks",
            "-profile:v",
            "4",
            "-pix_fmt",
            "yuva444p10le",
            "-alpha_bits",
            "16",
            "-vendor",
            "apl0",
            "-c:a",
            "pcm_s16le",
            "-shortest",
            str(alpha_mov),
        ],
        check=True,
    )

    subprocess.run(
        [
            ffmpeg,
            "-y",
            "-loop",
            "1",
            "-framerate",
            str(FPS),
            "-i",
            str(background),
            "-framerate",
            str(FPS),
            "-i",
            pattern,
            "-i",
            str(ding),
            "-filter_complex",
            "[0:v]format=rgba[bg];[bg][1:v]overlay=0:0:format=auto:shortest=1[out]",
            "-map",
            "[out]",
            "-map",
            "2:a:0",
            "-t",
            str(DURATION),
            "-c:v",
            "libx264",
            "-crf",
            "17",
            "-preset",
            "slow",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-movflags",
            "+faststart",
            str(preview),
        ],
        check=True,
    )


def main() -> None:
    ffmpeg = os.environ.get("FFMPEG_BIN") or shutil.which("ffmpeg")
    if not ffmpeg:
        raise SystemExit("Set FFMPEG_BIN to a working ffmpeg executable.")
    if not FONT_PATH.exists():
        raise SystemExit(f"Required font is missing: {FONT_PATH}")

    FRAMES_DIR.mkdir(exist_ok=True)
    for frame in FRAMES_DIR.glob("frame-*.png"):
        frame.unlink()

    label = name_layer()
    for frame_index in range(FRAME_COUNT):
        frame = render_frame(frame_index, label)
        frame.save(FRAMES_DIR / f"frame-{frame_index:04d}.png", optimize=True)
        if frame_index % 15 == 0 or frame_index == FRAME_COUNT - 1:
            print(f"Rendered {frame_index + 1}/{FRAME_COUNT}")

    ding = HERE / "donald-ding.wav"
    make_ding(ding)
    background = make_preview_background()
    background_path = HERE / "preview-background.jpg"
    background.save(background_path, quality=94)
    make_contact_sheet(background, [9, 18, 24, 33, 66, 84])
    run_ffmpeg(ffmpeg, ding, background_path)
    print("Finished DONALD alpha MOV, preview MP4, contact sheet, and ding WAV.")


if __name__ == "__main__":
    main()
