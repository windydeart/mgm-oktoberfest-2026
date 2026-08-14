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

imgs_2016 = [x for x in data if x['year'] == '2016']
print("Original 2016 images count:", len(imgs_2016))

# Identify #1, #3, #4, #5, #7 in original 2016 list (1-indexed)
# 1: PA080414.JPG (rotate 90 left)
# 3: Oktoberfest 1 2.JPG (delete)
# 4: Oktoberfest 1.JPG (delete)
# 5: PA070410.JPG (delete)
# 7: PA080419.JPG (rotate 90 left)

rotate_files = ["PA080414.JPG", "PA080419.JPG"]
delete_files = ["Oktoberfest 1 2.JPG", "Oktoberfest 1.JPG", "PA070410.JPG"]

# Rotate images
for fname in rotate_files:
    src_path = os.path.join(SOURCE_DIR, fname)
    clean_name = "".join([c if c.isalnum() or c in ('_', '-') else '_' for c in os.path.splitext(fname)[0]]).strip('_')
    dest_path = os.path.join(DEST_DIR, f"{clean_name}.webp")
    
    if os.path.exists(src_path):
        print(f"Rotating {fname} 90 degrees to the left...")
        with Image.open(src_path) as img:
            if img.mode in ("RGBA", "P"):
                img = img.convert("RGB")
            # Rotate 90 degrees counter-clockwise (to the left)
            rotated_img = img.rotate(90, expand=True)
            max_dim = 1920
            if rotated_img.width > max_dim or rotated_img.height > max_dim:
                rotated_img.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)
            rotated_img.save(dest_path, "WEBP", quality=85, optimize=True)
            
        # Re-upload to Cloudinary
        public_id = f"oktoberfest/2016/{clean_name}"
        print(f"Re-uploading rotated image to Cloudinary: {public_id}...")
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

# Filter out deleted files from catalog
new_data = []
for item in data:
    if item['year'] == '2016' and item['original_filename'] in delete_files:
        print(f"Deleting 2016 item from catalog: {item['original_filename']}")
        continue
    new_data.append(item)

with open(CATALOG_PATH, "w", encoding="utf-8") as f:
    json.dump(new_data, f, ensure_ascii=False, indent=2)

print(f"Updated catalog saved with {len(new_data)} total images.")
