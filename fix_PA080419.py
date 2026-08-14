import os
from PIL import Image
import cloudinary
import cloudinary.uploader

CLOUDINARY_URL = "cloudinary://641311313265633:EzLESw_QAEtrCQufZAJ7ghWgKi4@ren3b5dq"
cloudinary.config(cloudinary_url=CLOUDINARY_URL)

SOURCE_PATH = "/Applications/Working/Website/Oktoberfest/assets/All seasons images/2016/PA080419.JPG"
DEST_PATH = "/Applications/Working/Website/Oktoberfest/assets/processed_webp/2016/PA080419.webp"

if os.path.exists(SOURCE_PATH):
    print("Rotating PA080419.JPG 90 degrees to the LEFT (counter-clockwise)...")
    with Image.open(SOURCE_PATH) as img:
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        # Rotate 90 degrees counter-clockwise (to the left)
        rotated_img = img.rotate(90, expand=True)
        max_dim = 1920
        if rotated_img.width > max_dim or rotated_img.height > max_dim:
            rotated_img.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)
        rotated_img.save(DEST_PATH, "WEBP", quality=85, optimize=True)
        print(f"Saved {DEST_PATH} ({rotated_img.width}x{rotated_img.height})")

    public_id = "oktoberfest/2016/PA080419"
    print(f"Re-uploading PA080419 to Cloudinary: {public_id}...")
    resp = cloudinary.uploader.upload(
        DEST_PATH,
        public_id=public_id,
        unique_filename=False,
        overwrite=True,
        resource_type="image",
        cloud_name="ren3b5dq",
        api_key="641311313265633",
        api_secret="EzLESw_QAEtrCQufZAJ7ghWgKi4"
    )
    print("Success:", resp.get("secure_url"))
else:
    print("Error: Source file PA080419.JPG not found!")
