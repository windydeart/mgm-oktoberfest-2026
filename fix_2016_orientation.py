import os
from PIL import Image
import cloudinary
import cloudinary.uploader

CLOUDINARY_URL = "cloudinary://641311313265633:EzLESw_QAEtrCQufZAJ7ghWgKi4@ren3b5dq"
cloudinary.config(cloudinary_url=CLOUDINARY_URL)

SOURCE_DIR = "/Applications/Working/Website/Oktoberfest/assets/All seasons images/2016"
DEST_DIR = "/Applications/Working/Website/Oktoberfest/assets/processed_webp/2016"

# The two images that need clockwise rotation (90 degrees to the right / 270 degrees counter-clockwise)
rotate_files = ["PA080414.JPG", "PA080419.JPG"]

for fname in rotate_files:
    src_path = os.path.join(SOURCE_DIR, fname)
    clean_name = "".join([c if c.isalnum() or c in ('_', '-') else '_' for c in os.path.splitext(fname)[0]]).strip('_')
    dest_path = os.path.join(DEST_DIR, f"{clean_name}.webp")
    
    if os.path.exists(src_path):
        print(f"Fixing orientation for {fname}: Rotating 90 degrees CLOCKWISE...")
        with Image.open(src_path) as img:
            if img.mode in ("RGBA", "P"):
                img = img.convert("RGB")
            # Rotate 270 degrees counter-clockwise (= 90 degrees clockwise / right)
            rotated_img = img.rotate(270, expand=True)
            max_dim = 1920
            if rotated_img.width > max_dim or rotated_img.height > max_dim:
                rotated_img.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)
            rotated_img.save(dest_path, "WEBP", quality=85, optimize=True)
            print(f"Saved {dest_path} ({rotated_img.width}x{rotated_img.height})")
            
        public_id = f"oktoberfest/2016/{clean_name}"
        print(f"Re-uploading fixed image to Cloudinary: {public_id}...")
        resp = cloudinary.uploader.upload(
            dest_path,
            public_id=public_id,
            unique_filename=False,
            overwrite=True,
            resource_type="image",
            cloud_name="ren3b5dq",
            api_key="641311313265633",
            api_secret="EzLESw_QAEtrCQufZAJ7ghWgKi4"
        )
        print("Success:", resp.get("secure_url"))
