import os
import glob
import json
from PIL import Image
import cloudinary
import cloudinary.uploader

# Cloudinary configuration
CLOUDINARY_URL = "cloudinary://641311313265633:EzLESw_QAEtrCQufZAJ7ghWgKi4@ren3b5dq"
cloudinary.config(cloudinary_url=CLOUDINARY_URL)

SOURCE_DIR = "/Applications/Working/Website/Oktoberfest/assets/All seasons images"
PROCESSED_DIR = "/Applications/Working/Website/Oktoberfest/assets/processed_webp"

os.makedirs(PROCESSED_DIR, exist_ok=True)

uploaded_data = []

# Walk through all subfolders
years = sorted([d for d in os.listdir(SOURCE_DIR) if os.path.isdir(os.path.join(SOURCE_DIR, d))])
print("Found years:", years)

for year in years:
    year_src_dir = os.path.join(SOURCE_DIR, year)
    year_dest_dir = os.path.join(PROCESSED_DIR, year)
    os.makedirs(year_dest_dir, exist_ok=True)

    image_files = [f for f in os.listdir(year_src_dir) if not f.startswith('.') and f.lower().endswith(('.jpg', '.jpeg', '.png', '.webp'))]
    print(f"\n--- Processing Year {year}: {len(image_files)} images ---")

    for filename in image_files:
        src_path = os.path.join(year_src_dir, filename)
        name_without_ext = os.path.splitext(filename)[0]
        # Clean public_id for Cloudinary (alphanumeric, underscores, hyphens)
        clean_name = "".join([c if c.isalnum() or c in ('_', '-') else '_' for c in name_without_ext]).strip('_')
        
        webp_filename = f"{clean_name}.webp"
        dest_webp_path = os.path.join(year_dest_dir, webp_filename)

        # Step 1: Optimize Image to WebP
        try:
            with Image.open(src_path) as img:
                # Convert to RGB if RGBA/P
                if img.mode in ("RGBA", "P"):
                    img = img.convert("RGB")
                
                # Resize if extremely large (e.g. > 2000px width/height) for web efficiency
                max_dim = 1920
                if img.width > max_dim or img.height > max_dim:
                    img.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)
                
                # Save as optimized WebP
                img.save(dest_webp_path, "WEBP", quality=85, optimize=True)
                orig_size = os.path.getsize(src_path) / 1024
                webp_size = os.path.getsize(dest_webp_path) / 1024
                print(f"Optimized [{year}] {filename} ({orig_size:.1f} KB -> {webp_size:.1f} KB)")
        except Exception as e:
            print(f"Error optimizing {src_path}: {e}")
            continue

        # Step 2: Upload to Cloudinary with folder structure: oktoberfest/<year>/<clean_name>
        public_id = f"oktoberfest/{year}/{clean_name}"
        print(f"Uploading to Cloudinary: {public_id}...")
        try:
            response = cloudinary.uploader.upload(
                dest_webp_path,
                public_id=public_id,
                unique_filename=False,
                overwrite=True,
                resource_type="image",
                cloud_name="ren3b5dq",
                api_key="641311313265633",
                api_secret="EzLESw_QAEtrCQufZAJ7ghWgKi4"
            )
            secure_url = response.get("secure_url")
            print(f" -> Success: {secure_url}")

            uploaded_data.append({
                "year": year,
                "original_filename": filename,
                "clean_name": clean_name,
                "public_id": public_id,
                "url": secure_url
            })
        except Exception as e:
            print(f"Error uploading {public_id}: {e}")

# Save JSON result
json_output_path = "/Applications/Working/Website/Oktoberfest/assets/cloudinary_data.json"
with open(json_output_path, "w", encoding="utf-8") as f:
    json.dump(uploaded_data, f, ensure_ascii=False, indent=2)

print(f"\n🎉 All finished! Uploaded {len(uploaded_data)} images. Saved catalog to {json_output_path}")
