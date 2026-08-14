import os
import json
from PIL import Image
import cloudinary
import cloudinary.uploader

CLOUDINARY_URL = "cloudinary://641311313265633:EzLESw_QAEtrCQufZAJ7ghWgKi4@ren3b5dq"
cloudinary.config(cloudinary_url=CLOUDINARY_URL)

CATALOG_PATH = "/Applications/Working/Website/Oktoberfest/assets/cloudinary_data.json"
SOURCE_DIR = "/Applications/Working/Website/Oktoberfest/assets/All seasons images/2016"
DEST_DIR = "/Applications/Working/Website/Oktoberfest/assets/processed_webp/2016"

with open(CATALOG_PATH, "r", encoding="utf-8") as f:
    data = json.load(f)

# Images to rotate 90 degrees to the left (counter-clockwise):
# #1: PA080414.JPG
# #6: PA080436.JPG
rotate_files = ["PA080414.JPG", "PA080436.JPG"]

# Image #3 to delete: Oktoberfest 2.JPG
delete_filename = "Oktoberfest 2.JPG"

for fname in rotate_files:
    src_path = os.path.join(SOURCE_DIR, fname)
    clean_name = "".join([c if c.isalnum() or c in ('_', '-') else '_' for c in os.path.splitext(fname)[0]]).strip('_')
    dest_path = os.path.join(DEST_DIR, f"{clean_name}.webp")
    
    if os.path.exists(src_path):
        print(f"Rotating {fname} 90 degrees to the LEFT (counter-clockwise)...")
        with Image.open(src_path) as img:
            if img.mode in ("RGBA", "P"):
                img = img.convert("RGB")
            # Rotate 90 degrees counter-clockwise (= to the left)
            rotated_img = img.rotate(90, expand=True)
            max_dim = 1920
            if rotated_img.width > max_dim or rotated_img.height > max_dim:
                rotated_img.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)
            rotated_img.save(dest_path, "WEBP", quality=85, optimize=True)
            print(f"Saved {dest_path} ({rotated_img.width}x{rotated_img.height})")
            
        public_id = f"oktoberfest/2016/{clean_name}"
        print(f"Re-uploading to Cloudinary: {public_id}...")
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

# Delete 3rd image (Oktoberfest 2.JPG) from catalog
new_data = []
for item in data:
    if item['year'] == '2016' and item['original_filename'] == delete_filename:
        print(f"Deleting 3rd image from 2016: {item['original_filename']}")
        continue
    new_data.append(item)

with open(CATALOG_PATH, "w", encoding="utf-8") as f:
    json.dump(new_data, f, ensure_ascii=False, indent=2)

print(f"Catalog updated! Total remaining images: {len(new_data)}")
