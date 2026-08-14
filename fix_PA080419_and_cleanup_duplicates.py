import os
import json
from PIL import Image
import cloudinary
import cloudinary.uploader
import cloudinary.api

CLOUDINARY_URL = "cloudinary://641311313265633:EzLESw_QAEtrCQufZAJ7ghWgKi4@ren3b5dq"
cloudinary.config(cloudinary_url=CLOUDINARY_URL)

CATALOG_PATH = "/Applications/Working/Website/Oktoberfest/assets/cloudinary_data.json"
SOURCE_PATH = "/Applications/Working/Website/Oktoberfest/assets/All seasons images/2016/PA080419.JPG"
DEST_PATH = "/Applications/Working/Website/Oktoberfest/assets/processed_webp/2016/PA080419.webp"

# --- STEP 1: Revert PA080419 to ORIGINAL (NO ROTATION AT ALL) ---
print("\n--- Step 1: Processing PA080419 (ORIGINAL UNROTATED) ---")
with Image.open(SOURCE_PATH) as img:
    if img.mode in ("RGBA", "P"):
        img = img.convert("RGB")
    # DO NOT ROTATE AT ALL! Keep original orientation.
    max_dim = 1920
    if img.width > max_dim or img.height > max_dim:
        img.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)
    img.save(DEST_PATH, "WEBP", quality=85, optimize=True)
    print(f"Saved original unrotated WebP: {DEST_PATH} ({img.width}x{img.height})")

# Upload original unrotated image as public_id: oktoberfest/2016/PA080419
public_id_clean = "oktoberfest/2016/PA080419"
print(f"Uploading original PA080419 to Cloudinary ({public_id_clean})...")
resp = cloudinary.uploader.upload(
    DEST_PATH,
    public_id=public_id_clean,
    unique_filename=False,
    overwrite=True,
    invalidate=True,
    resource_type="image",
    cloud_name="ren3b5dq",
    api_key="641311313265633",
    api_secret="EzLESw_QAEtrCQufZAJ7ghWgKi4"
)
clean_url = resp.get("secure_url")
print("Clean Original Cloudinary URL:", clean_url)

# --- STEP 2: Update Catalog JSON ---
with open(CATALOG_PATH, "r", encoding="utf-8") as f:
    data = json.load(f)

for item in data:
    if item.get("original_filename") == "PA080419.JPG" and item.get("year") == "2016":
        item["public_id"] = public_id_clean
        item["url"] = clean_url
        item["clean_name"] = "PA080419"

with open(CATALOG_PATH, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

# --- STEP 3: Search and Delete Duplicate Resources on Cloudinary ---
print("\n--- Step 3: Checking Cloudinary for duplicates (e.g. _v2, _2...) ---")
try:
    resources_resp = cloudinary.api.resources(type="upload", prefix="oktoberfest/", max_results=500)
    resources = resources_resp.get("resources", [])
    print(f"Found {len(resources)} total resources in Cloudinary under oktoberfest/")

    duplicates_to_delete = []
    for r in resources:
        pid = r.get("public_id", "")
        # Identify duplicates like PA080419_v2 or any ending with _v2 or _2
        if pid.endswith("_v2") or pid.endswith("_2") or "_v2" in pid:
            duplicates_to_delete.append(pid)

    if duplicates_to_delete:
        print(f"Deleting {len(duplicates_to_delete)} duplicate resources from Cloudinary:", duplicates_to_delete)
        for dpid in duplicates_to_delete:
            res = cloudinary.uploader.destroy(dpid, invalidate=True)
            print(f" -> Deleted {dpid}: {res.get('result')}")
    else:
        print("No duplicate resources found ending in _v2 or _2.")
except Exception as e:
    print("Error listing/deleting Cloudinary duplicates:", e)

print("\n🎉 All steps completed successfully!")
