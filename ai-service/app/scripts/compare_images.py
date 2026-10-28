#!/usr/bin/env python3
"""
Image Quality and Similarity Diagnostics CLI.
Compares two local images for:
- Laplacian blur variance
- Mean brightness, contrast, and exposure quality
- Perceptual hash similarity (pHash, dHash, aHash) and duplicate verdict
"""

import os
import sys
from pathlib import Path
from typing import Any

import cv2
import imagehash
import numpy as np
from PIL import Image

# ==============================================================================
# 1. IMAGE PATHS TO TEST
# ==============================================================================
IMAGE_PATH_1: str = "../test-data/dark-2.jpeg"
IMAGE_PATH_2: str = "../test-data/bright-1.jpg"

# ==============================================================================
# 2. BLUR DETECTION THRESHOLD (Laplacian Variance)
# ==============================================================================
# Variance below this number is flagged as BLURRY. Higher number = stricter sharpness.
BLUR_LAPLACIAN_THRESHOLD: float = 350.0

# ==============================================================================
# 3. DUPLICATE & SIMILARITY THRESHOLDS (Perceptual Hash / Hamming Distance)
# ==============================================================================
# Max Hamming distance (0 to 64 bits) to flag as duplicate.
# <= 5: near duplicate (burst shot, slight crop, compression difference)
DUPLICATE_HAMMING_THRESHOLD: int = 5

# Hamming distance threshold for similar scene / composition
SIMILAR_SCENE_HAMMING_THRESHOLD: int = 10

# ==============================================================================
# 4. BRIGHTNESS & EXPOSURE THRESHOLDS (Grayscale Mean: 0.0 to 255.0)
# ==============================================================================
BRIGHTNESS_SEVERELY_DARK: float = 35.0      # Below this: severely underexposed / pitch black
BRIGHTNESS_DIM: float = 65.0                # 35.0 to 65.0: dim / low light
BRIGHTNESS_OPTIMAL_MAX: float = 180.0       # 65.0 to 180.0: well-lit / optimal
BRIGHTNESS_OVEREXPOSED: float = 220.0       # 180.0 to 220.0: bright; above 220.0: blown out

# ==============================================================================
# 5. RESOLUTION STANDARDS
# ==============================================================================
MIN_IMAGE_WIDTH: int = 400
MIN_IMAGE_HEIGHT: int = 400
# ==============================================================================


def analyze_single_image(image_path: str) -> dict[str, Any]:
    """Computes blur variance, brightness metrics, and dimensions for an image file."""
    path = Path(image_path)
    if not path.is_file():
        raise FileNotFoundError(f"File not found: {image_path}")

    file_size_kb = path.stat().st_size / 1024.0

    # Read image via OpenCV
    cv_img = cv2.imread(str(path))
    if cv_img is None:
        raise ValueError(f"OpenCV could not decode image: {image_path}")

    height, width, channels = cv_img.shape
    aspect_ratio = width / height if height > 0 else 1.0

    # 1. Grayscale conversion for analysis
    gray = cv2.cvtColor(cv_img, cv2.COLOR_BGR2GRAY)

    # 2. Laplacian Blur Variance
    laplacian_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    is_blurry = laplacian_var < BLUR_LAPLACIAN_THRESHOLD

    # 3. Brightness & Contrast
    mean_brightness = float(np.mean(gray))
    std_contrast = float(np.std(gray))
    min_val, max_val, _, _ = cv2.minMaxLoc(gray)

    # Exposure verdict using configured thresholds
    if mean_brightness < BRIGHTNESS_SEVERELY_DARK:
        exposure_verdict = "Severely Underexposed / Too Dark"
        lighting_score = 2
    elif mean_brightness < BRIGHTNESS_DIM:
        exposure_verdict = "Dim / Low Light"
        lighting_score = 5
    elif mean_brightness <= BRIGHTNESS_OPTIMAL_MAX:
        exposure_verdict = "Optimal / Well-Lit"
        lighting_score = 9
    elif mean_brightness <= BRIGHTNESS_OVEREXPOSED:
        exposure_verdict = "Bright"
        lighting_score = 7
    else:
        exposure_verdict = "Severely Overexposed / Blown Out"
        lighting_score = 3

    # 4. Perceptual Hashes via Pillow
    pil_img = Image.open(path)
    phash = imagehash.phash(pil_img)
    dhash = imagehash.dhash(pil_img)
    ahash = imagehash.average_hash(pil_img)

    return {
        "path": str(path),
        "filename": path.name,
        "size_kb": file_size_kb,
        "width": width,
        "height": height,
        "aspect_ratio": aspect_ratio,
        "laplacian_var": laplacian_var,
        "is_blurry": is_blurry,
        "mean_brightness": mean_brightness,
        "contrast_std": std_contrast,
        "min_pixel": min_val,
        "max_pixel": max_val,
        "exposure_verdict": exposure_verdict,
        "lighting_score_est": lighting_score,
        "phash": phash,
        "dhash": dhash,
        "ahash": ahash,
    }


def compare_images(path1: str, path2: str) -> None:
    """Analyzes two images and prints diagnostics and similarity metrics."""
    print("\n" + "=" * 70)
    print("  HOMYZ AI ENGINE - IMAGE DIAGNOSTICS & SIMILARITY TEST")
    print("=" * 70)

    try:
        data1 = analyze_single_image(path1)
        data2 = analyze_single_image(path2)
    except Exception as exc:
        print(f"\n[ERROR] Failed to analyze images: {exc}\n")
        sys.exit(1)

    # Display Image 1
    _print_image_card(1, data1)

    # Display Image 2
    _print_image_card(2, data2)

    # Compute Similarity & Distances
    phash_dist = data1["phash"] - data2["phash"]
    dhash_dist = data1["dhash"] - data2["dhash"]
    ahash_dist = data1["ahash"] - data2["ahash"]

    # Normalize similarity percentage based on 64-bit pHash
    similarity_pct = max(0.0, (1.0 - (phash_dist / 64.0)) * 100.0)

    # Duplicate Verdict based on configured thresholds
    if phash_dist == 0:
        verdict = "EXACT DUPLICATE (Identical 100% hash match)"
        is_duplicate = True
    elif phash_dist <= DUPLICATE_HAMMING_THRESHOLD:
        verdict = f"NEAR DUPLICATE / SAME SCENE (Distance {phash_dist} <= {DUPLICATE_HAMMING_THRESHOLD} threshold)"
        is_duplicate = True
    elif phash_dist <= SIMILAR_SCENE_HAMMING_THRESHOLD:
        verdict = f"SIMILAR SCENE / COMPOSITION (Distance {phash_dist} <= {SIMILAR_SCENE_HAMMING_THRESHOLD} - Not marked duplicate)"
        is_duplicate = False
    else:
        verdict = f"DISTINCT PHOTOS (Distance {phash_dist} > {SIMILAR_SCENE_HAMMING_THRESHOLD} - Different scenes)"
        is_duplicate = False

    print("\n" + "-" * 70)
    print("  PAIRWISE SIMILARITY COMPARISON (Image 1 vs Image 2)")
    print("-" * 70)
    print(f"  * pHash Hamming Distance : {phash_dist:2d} / 64 bits")
    print(f"  * dHash Hamming Distance : {dhash_dist:2d} / 64 bits")
    print(f"  * aHash Hamming Distance : {ahash_dist:2d} / 64 bits")
    print(f"  * Estimated Similarity   : {similarity_pct:.1f}%")
    print(f"  * Duplicate Flag         : {'[YES] is_duplicate = True' if is_duplicate else '[NO] is_duplicate = False'}")
    print(f"  * System Verdict         : {verdict}")
    print("=" * 70 + "\n")


def _print_image_card(index: int, data: dict[str, Any]) -> None:
    """Helper to format and print per-image diagnostic metrics."""
    blur_label = "[BLURRY]" if data["is_blurry"] else "[SHARP]"

    print(f"\n[IMAGE {index}] {data['filename']}")
    print(f"  * Path            : {data['path']}")
    print(f"  * Resolution      : {data['width']} x {data['height']} ({data['aspect_ratio']:.2f}:1) | {data['size_kb']:.1f} KB")
    print(f"  * Blur Variance   : {data['laplacian_var']:.2f} (Threshold: {BLUR_LAPLACIAN_THRESHOLD}) -> {blur_label}")
    print(f"  * Mean Brightness : {data['mean_brightness']:.2f} / 255.0 ({data['exposure_verdict']})")
    print(f"  * Contrast (std)  : {data['contrast_std']:.2f} (Dynamic Range: {data['min_pixel']:.0f} to {data['max_pixel']:.0f})")
    print(f"  * Est. Light Score: {data['lighting_score_est']} / 10")
    print(f"  * pHash Value     : {data['phash']}")


if __name__ == "__main__":
    # Priority: Command-line arguments > Top-level variables
    path1 = sys.argv[1] if len(sys.argv) > 1 else IMAGE_PATH_1
    path2 = sys.argv[2] if len(sys.argv) > 2 else IMAGE_PATH_2

    if not path1 or not path2:
        print("\n" + "=" * 70)
        print("  HOMYZ IMAGE DIAGNOSTICS & SIMILARITY TEST")
        print("=" * 70)
        print("\nHow to use:")
        print("  Option A: Set IMAGE_PATH_1 and IMAGE_PATH_2 at the top of this file, then run:")
        print("            python scripts/compare_images.py")
        print("\n  Option B: Pass paths directly as arguments:")
        print("            python scripts/compare_images.py <image1_path> <image2_path>\n")
        print("=" * 70 + "\n")
        sys.exit(1)

    compare_images(path1, path2)
