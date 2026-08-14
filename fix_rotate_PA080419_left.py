import os
from PIL import Image
import cloudinary
import cloudinary.uploader

CLOUDINARY_URL = "cloudinary://641311313265633:EzLESw_QAEtrCQufZAJ7ghWgKi4@ren3b5dq"
cloudinary.config(cloudinary_url=CLOUDINARY_URL)

WEBP_PATH = "/Applications/Working/Website/Oktoberfest/assets/processed_webp/2016/PA080419.webp"

if os.path.exists(WEBP_PATH):
    print("Rotating current PA080419.webp 90 degrees to the LEFT...")
    with Image.open(WEBP_PATH) as img:
        # Rotate 90 degrees counter-clockwise (to the left)
        rotated_img = img.rotate(90, expand=True)
        rotated_img.save(WEBP_PATH, "WEBP", quality=85, optimize=True)
        print(f"Saved {WEBP_PATH} ({rotated_img.width}x{rotated_img.height})")

    public_id = "oktoberfest/2016/PA080419"
    print(f"Re-uploading PA080419 to Cloudinary: {public_id}...")
    resp = cloudinary.uploader.upload(
        WEBP_PATH,
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
    print("Error: PA080419.webp not found!")
