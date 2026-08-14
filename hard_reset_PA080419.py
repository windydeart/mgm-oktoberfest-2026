import os
import json
from PIL import Image
import cloudinary
import cloudinary.uploader

CLOUDINARY_URL = "cloudinary://641311313265633:EzLESw_QAEtrCQufZAJ7ghWgKi4@ren3b5dq"
cloudinary.config(cloudinary_url=CLOUDINARY_URL)

CATALOG_PATH = "/Applications/Working/Website/Oktoberfest/assets/cloudinary_data.json"
SOURCE_PATH = "/Applications/Working/Website/Oktoberfest/assets/All seasons images/2016/PA080419.JPG"
DEST_PATH = "/Applications/Working/Website/Oktoberfest/assets/processed_webp/2016/PA080419_v2.webp"

# Step 1: Destroy old public_id on Cloudinary
print("Destroying old image on Cloudinary: oktoberfest/2016/PA080419...")
try:
    res = cloudinary.uploader.destroy("oktoberfest/2016/PA080419", invalidate=True)
    print("Destroy result:", res)
except Exception as e:
    print("Destroy error:", e)

# Step 2: Open original source image and rotate 90 degrees to the left
print("Opening original source image and rotating 90 degrees to the LEFT...")
with Image.open(SOURCE_PATH) as img:
    if img.mode in ("RGBA", "P"):
        img = img.convert("RGB")
    # Rotate 90 degrees counter-clockwise (to the left)
    rotated_img = img.rotate(90, expand=True)
    max_dim = 1920
    if rotated_img.width > max_dim or rotated_img.height > max_dim:
        rotated_img.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)
    rotated_img.save(DEST_PATH, "WEBP", quality=85, optimize=True)
    print(f"Saved new WebP to {DEST_PATH} ({rotated_img.width}x{rotated_img.height})")

# Step 3: Upload with new public_id: oktoberfest/2016/PA080419_v2
new_public_id = "oktoberfest/2016/PA080419_v2"
print(f"Uploading new image to Cloudinary: {new_public_id}...")
resp = cloudinary.uploader.upload(
    DEST_PATH,
    public_id=new_public_id,
    unique_filename=False,
    overwrite=True,
    invalidate=True,
    resource_type="image",
    cloud_name="ren3b5dq",
    api_key="641311313265633",
    api_secret="EzLESw_QAEtrCQufZAJ7ghWgKi4"
)
new_url = resp.get("secure_url")
print("New Cloudinary URL:", new_url)

# Step 4: Update catalog JSON
with open(CATALOG_PATH, "r", encoding="utf-8") as f:
    data = json.load(f)

for item in data:
    if item.get("original_filename") == "PA080419.JPG" and item.get("year") == "2016":
        item["public_id"] = new_public_id
        item["url"] = new_url
        item["clean_name"] = "PA080419"

with open(CATALOG_PATH, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("Catalog JSON updated successfully!")
