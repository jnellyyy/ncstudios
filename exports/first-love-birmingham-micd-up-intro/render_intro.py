#!/usr/bin/env python3
"""Render the First Love Birmingham Ministries "MIC'D UP" alpha intro."""

from __future__ import annotations

import math
import os
import shutil
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


WIDTH = 1920
HEIGHT = 1080
FPS = 30
DURATION = 4.3
FRAME_COUNT = math.ceil(DURATION * FPS)

HERE = Path(__file__).resolve().parent
FRAMES_DIR = HERE / "frames"
FONT_PATH = Path("/System/Library/Fonts/Avenir Next Condensed.ttc")

WHITE = (255, 252, 248, 255)
SOFT_WHITE = (255, 252, 248, 232)
RED = (242, 20, 55, 255)
DEEP_RED = (92, 0, 18, 190)


def clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return min(high, max(low, value))


def ease_out_cubic(value: float) -> float:
    value = clamp(value)
    return 1 - (1 - value) ** 3


def ease_in_out_cubic(value: float) -> float:
    value = clamp(value)
    if value < 0.5:
        return 4 * value**3
    return 1 - ((-2 * value + 2) ** 3) / 2


def ease_out_back(value: float) -> float:
    value = clamp(value)
    c1 = 1.70158
    c3 = c1 + 1
    return 1 + c3 * (value - 1) ** 3 + c1 * (value - 1) ** 2


def set_opacity(image: Image.Image, opacity: float) -> Image.Image:
    if opacity >= 0.999:
        return image
    result = image.copy()
    alpha = result.getchannel("A").point(lambda a: round(a * clamp(opacity)))
    result.putalpha(alpha)
    return result


def text_layout(text: str, font: ImageFont.FreeTypeFont, tracking: float):
    widths = [font.getlength(character) for character in text]
    total = sum(widths) + tracking * max(0, len(text) - 1)
    positions = []
    cursor = 0.0
    for character, width in zip(text, widths):
        positions.append((character, cursor, width))
        cursor += width + tracking
    return positions, total


def draw_animated_line(
    canvas: Image.Image,
    text: str,
    font: ImageFont.FreeTypeFont,
    tracking: float,
    center_y: float,
    start: float,
    stagger: float,
    t: float,
    color: tuple[int, int, int, int],
    fade_out: float,
) -> None:
    positions, total_width = text_layout(text, font, tracking)
    x_start = (WIDTH - total_width) / 2
    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    letters = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    letter_draw = ImageDraw.Draw(letters)

    out_progress = ease_in_out_cubic((t - fade_out) / 0.55)
    out_opacity = 1 - out_progress

    for index, (character, x_offset, _) in enumerate(positions):
        local = ease_out_cubic((t - start - index * stagger) / 0.38)
        if local <= 0 or out_opacity <= 0:
            continue
        opacity = local * out_opacity
        y_offset = (1 - local) * 34 - out_progress * 26
        x = x_start + x_offset
        y = center_y + y_offset
        shadow_draw.text(
            (x + 3, y + 8),
            character,
            font=font,
            anchor="ls",
            fill=(0, 0, 0, round(150 * opacity)),
        )
        letter_draw.text(
            (x, y),
            character,
            font=font,
            anchor="ls",
            fill=(color[0], color[1], color[2], round(color[3] * opacity)),
        )

    shadow = shadow.filter(ImageFilter.GaussianBlur(10))
    canvas.alpha_composite(shadow)
    canvas.alpha_composite(letters)


def render_tracked_word(
    text: str,
    font: ImageFont.FreeTypeFont,
    tracking: float,
) -> Image.Image:
    positions, total_width = text_layout(text, font, tracking)
    measuring_image = Image.new("L", (1, 1), 0)
    measuring_draw = ImageDraw.Draw(measuring_image)
    bbox = measuring_draw.textbbox(
        (0, 0), text, font=font, anchor="ls", stroke_width=2
    )
    text_height = bbox[3] - bbox[1]
    padding = 90
    layer = Image.new(
        "RGBA",
        (math.ceil(total_width + padding * 2), math.ceil(text_height + padding * 2 + 28)),
        (0, 0, 0, 0),
    )
    baseline = padding - bbox[1]

    mask = Image.new("L", layer.size, 0)
    mask_draw = ImageDraw.Draw(mask)
    for character, x_offset, _ in positions:
        mask_draw.text(
            (padding + x_offset, baseline),
            character,
            font=font,
            anchor="ls",
            fill=255,
            stroke_width=2,
            stroke_fill=255,
        )

    glow = Image.new("RGBA", layer.size, (242, 20, 55, 0))
    glow.putalpha(mask.filter(ImageFilter.GaussianBlur(12)).point(lambda a: round(a * 0.10)))
    layer.alpha_composite(glow)

    shadow_mask = Image.new("L", layer.size, 0)
    shadow_mask.paste(mask, (5, 8))
    shadow_mask = shadow_mask.filter(ImageFilter.GaussianBlur(6))
    shadow = Image.new("RGBA", layer.size, DEEP_RED)
    shadow.putalpha(shadow_mask.point(lambda a: round(a * 0.76)))
    layer.alpha_composite(shadow)

    face = Image.new("RGBA", layer.size, RED)
    face.putalpha(mask)
    layer.alpha_composite(face)

    highlight_mask = Image.new("L", layer.size, 0)
    highlight_mask.paste(mask, (-2, -2))
    highlight = Image.new("RGBA", layer.size, (255, 101, 119, 0))
    highlight.putalpha(highlight_mask.point(lambda a: round(a * 0.22)))
    layer.alpha_composite(highlight)
    return layer


def composite_transformed(
    canvas: Image.Image,
    layer: Image.Image,
    center_x: float,
    center_y: float,
    scale: float,
    angle: float,
    opacity: float,
) -> None:
    if opacity <= 0 or scale <= 0:
        return
    size = (
        max(1, round(layer.width * scale)),
        max(1, round(layer.height * scale)),
    )
    transformed = layer.resize(size, Image.Resampling.LANCZOS)
    if abs(angle) > 0.01:
        transformed = transformed.rotate(angle, resample=Image.Resampling.BICUBIC, expand=True)
    transformed = set_opacity(transformed, opacity)
    destination = (
        round(center_x - transformed.width / 2),
        round(center_y - transformed.height / 2),
    )
    canvas.alpha_composite(transformed, destination)


def mic_word_state(t: float):
    start = 1.62
    enter = clamp((t - start) / 0.46)
    eased = ease_out_back(enter)
    scale = 0.58 + 0.42 * eased
    opacity = ease_out_cubic((t - start) / 0.22)
    y = 734 + (1 - ease_out_cubic(enter)) * 46
    angle = -5.5 * (1 - ease_out_cubic(enter))

    pulse = math.exp(-((t - 2.48) / 0.12) ** 2)
    scale *= 1 + pulse * 0.018

    out = ease_in_out_cubic((t - 3.56) / 0.58)
    scale *= 1 + out * 0.06
    y -= out * 34
    opacity *= 1 - out
    return scale, opacity, y, angle, enter, out


def render_frame(
    frame_index: int,
    title_font: ImageFont.FreeTypeFont,
    ministry_font: ImageFont.FreeTypeFont,
    mic_layer: Image.Image,
) -> Image.Image:
    t = frame_index / FPS
    canvas = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))

    draw_animated_line(
        canvas,
        "FIRST LOVE BIRMINGHAM",
        title_font,
        10,
        376,
        0.30,
        0.024,
        t,
        WHITE,
        3.48,
    )
    draw_animated_line(
        canvas,
        "MINISTRIES",
        ministry_font,
        6,
        608,
        0.62,
        0.046,
        t,
        SOFT_WHITE,
        3.50,
    )

    scale, opacity, y, angle, enter, out = mic_word_state(t)
    echo_amount = (1 - clamp((t - 1.63) / 0.42)) * opacity * (1 - out)
    if echo_amount > 0:
        composite_transformed(
            canvas,
            mic_layer,
            WIDTH / 2,
            y,
            scale + 0.13 * echo_amount,
            angle * 0.55,
            0.14 * echo_amount,
        )
        composite_transformed(
            canvas,
            mic_layer,
            WIDTH / 2,
            y,
            scale + 0.055 * echo_amount,
            angle * 0.28,
            0.20 * echo_amount,
        )

    composite_transformed(canvas, mic_layer, WIDTH / 2, y, scale, angle, opacity)
    return canvas


def make_preview_background() -> Image.Image:
    image = Image.new("RGB", (WIDTH, HEIGHT))
    pixels = image.load()
    for y in range(HEIGHT):
        vertical = y / (HEIGHT - 1)
        for x in range(WIDTH):
            horizontal = x / (WIDTH - 1)
            center_falloff = math.hypot(horizontal - 0.5, vertical - 0.5)
            red = 12 + int(28 * horizontal + 24 * vertical)
            green = 18 + int(9 * horizontal + 8 * vertical)
            blue = 31 + int(40 * (1 - horizontal) + 20 * vertical)
            shade = max(0.46, 1 - center_falloff * 0.65)
            pixels[x, y] = (
                round(red * shade),
                round(green * shade),
                round(blue * shade),
            )

    bloom = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(bloom)
    draw.ellipse((-260, 520, 630, 1410), fill=(215, 25, 72, 92))
    draw.ellipse((1320, -350, 2210, 540), fill=(50, 109, 255, 84))
    bloom = bloom.filter(ImageFilter.GaussianBlur(145))
    return Image.alpha_composite(image.convert("RGBA"), bloom).convert("RGB")


def make_contact_sheet(background: Image.Image, selected_frames: list[int]) -> None:
    thumb_size = (480, 270)
    sheet = Image.new("RGB", (1440, 540), (14, 14, 18))
    label_font = ImageFont.truetype(str(FONT_PATH), 24, index=2)
    for slot, frame_index in enumerate(selected_frames):
        frame = Image.open(FRAMES_DIR / f"frame-{frame_index:04d}.png").convert("RGBA")
        comp = Image.alpha_composite(background.convert("RGBA"), frame)
        comp = comp.resize(thumb_size, Image.Resampling.LANCZOS).convert("RGB")
        x = (slot % 3) * thumb_size[0]
        y = (slot // 3) * thumb_size[1]
        sheet.paste(comp, (x, y))
        draw = ImageDraw.Draw(sheet)
        label = f"{frame_index / FPS:0.1f}s"
        draw.rounded_rectangle((x + 14, y + 14, x + 72, y + 45), 8, fill=(0, 0, 0, 155))
        draw.text((x + 24, y + 39), label, font=label_font, anchor="ls", fill=(255, 255, 255))
    sheet.save(HERE / "first-love-micd-up-contact-sheet.jpg", quality=92)


def run_ffmpeg(ffmpeg: str) -> None:
    input_pattern = str(FRAMES_DIR / "frame-%04d.png")
    transparent_mov = HERE / "first-love-birmingham-ministries-micd-up-transparent.mov"
    transparent_webm = HERE / "first-love-birmingham-ministries-micd-up-transparent.webm"
    preview_mp4 = HERE / "first-love-birmingham-ministries-micd-up-preview.mp4"
    background = HERE / "preview-background.jpg"

    subprocess.run(
        [
            ffmpeg,
            "-y",
            "-framerate",
            str(FPS),
            "-i",
            input_pattern,
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
            "-an",
            str(transparent_mov),
        ],
        check=True,
    )

    subprocess.run(
        [
            ffmpeg,
            "-y",
            "-framerate",
            str(FPS),
            "-i",
            input_pattern,
            "-c:v",
            "libvpx-vp9",
            "-lossless",
            "1",
            "-pix_fmt",
            "yuva420p",
            "-auto-alt-ref",
            "0",
            "-an",
            str(transparent_webm),
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
            input_pattern,
            "-filter_complex",
            "[0:v]format=rgba[bg];[bg][1:v]overlay=0:0:format=auto:shortest=1[out]",
            "-map",
            "[out]",
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
            "-movflags",
            "+faststart",
            "-an",
            str(preview_mp4),
        ],
        check=True,
    )


def main() -> None:
    if not FONT_PATH.exists():
        raise SystemExit(f"Required font is missing: {FONT_PATH}")

    ffmpeg = os.environ.get("FFMPEG_BIN") or shutil.which("ffmpeg")
    if not ffmpeg:
        raise SystemExit("Set FFMPEG_BIN to an ffmpeg executable before rendering.")

    FRAMES_DIR.mkdir(exist_ok=True)
    for old_frame in FRAMES_DIR.glob("frame-*.png"):
        old_frame.unlink()

    title_font = ImageFont.truetype(str(FONT_PATH), 74, index=2)
    ministry_font = ImageFont.truetype(str(FONT_PATH), 230, index=8)
    mic_font = ImageFont.truetype(str(FONT_PATH), 102, index=8)
    mic_layer = render_tracked_word("MIC’D UP", mic_font, 3)

    for frame_index in range(FRAME_COUNT):
        frame = render_frame(frame_index, title_font, ministry_font, mic_layer)
        frame.save(FRAMES_DIR / f"frame-{frame_index:04d}.png", optimize=True)
        if frame_index % 15 == 0 or frame_index == FRAME_COUNT - 1:
            print(f"Rendered {frame_index + 1}/{FRAME_COUNT}")

    background = make_preview_background()
    background.save(HERE / "preview-background.jpg", quality=94)

    peak_frame = Image.open(FRAMES_DIR / f"frame-{round(2.15 * FPS):04d}.png")
    peak_frame.save(HERE / "first-love-birmingham-ministries-micd-up-transparent-still.png")

    make_contact_sheet(
        background,
        [round(value * FPS) for value in (0.4, 1.0, 1.5, 1.9, 3.1, 3.9)],
    )
    run_ffmpeg(ffmpeg)
    print("Finished transparent MOV, transparent WebM, preview MP4, still, and contact sheet.")


if __name__ == "__main__":
    main()
