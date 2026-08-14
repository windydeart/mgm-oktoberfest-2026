import os
import json
from PIL import Image
import cloudinary
import cloudinary.uploader

CLOUDINARY_URL = "cloudinary://641311313265633:EzLESw_QAEtrCQufZAJ7ghWgKi4@ren3b5dq"
cloudinary.config(cloudinary_url=CLOUDINARY_URL)

CATALOG_PATH = "/Applications/Working/Website/Oktoberfest/assets/cloudinary_data.json"

with open(CATALOG_PATH, "r", encoding="utf-8") as f:
    images = json.load(f)

print(f"Re-uploading {len(images)} images to Cloudinary with explicit asset_folder structure...")

updated_images = []

for idx, img in enumerate(images, 1):
    year = img['year']
    orig_name = img['original_filename']
    clean_name = img['clean_name']

    # Path to local webp image
    local_webp = f"/Applications/Working/Website/Oktoberfest/assets/processed_webp/{year}/{clean_name}.webp"
    
    if not os.path.exists(local_webp):
        # Fallback check
        alt_webp = f"/Applications/Working/Website/Oktoberfest/assets/processed_webp/{year}/{os.path.splitext(orig_name)[0]}.webp"
        if os.path.exists(alt_webp):
            local_webp = alt_webp

    public_id = f"oktoberfest/{year}/{clean_name}"
    asset_folder = f"oktoberfest/{year}"

    print(f"[{idx}/{len(images)}] Uploading {clean_name} to folder '{asset_folder}'...")

    try:
        response = cloudinary.uploader.upload(
            local_webp,
            public_id=public_id,
            asset_folder=asset_folder,
            use_filename_as_asset_folder=False,
            unique_filename=False,
            overwrite=True,
            invalidate=True,
            resource_type="image",
            cloud_name="ren3b5dq",
            api_key="641311313265633",
            api_secret="EzLESw_QAEtrCQufZAJ7ghWgKi4"
        )
        secure_url = response.get("secure_url")
        print(f"  -> Success: {secure_url}")

        img["url"] = secure_url
        img["public_id"] = public_id
        img["asset_folder"] = asset_folder
        updated_images.append(img)
    except Exception as e:
        print(f"  -> Error uploading {public_id}: {e}")
        updated_images.append(img)

# Save updated catalog
with open(CATALOG_PATH, "w", encoding="utf-8") as f:
    json.dump(updated_images, f, ensure_ascii=False, indent=2)

print("\n🎉 Re-upload completed with official Cloudinary subfolders!")
