import cloudinary
import cloudinary.api
import cloudinary.uploader

cloud_name = "ren3b5dq"
api_key = "641311313265633"
api_secret = "EzLESw_QAEtrCQufZAJ7ghWgKi4"

cloudinary.config(
    cloud_name=cloud_name,
    api_key=api_key,
    api_secret=api_secret
)

print("Checking Cloudinary for duplicate resources under oktoberfest/...")

try:
    resources_resp = cloudinary.api.resources(
        type="upload",
        prefix="oktoberfest/",
        max_results=500,
        cloud_name=cloud_name,
        api_key=api_key,
        api_secret=api_secret
    )
    resources = resources_resp.get("resources", [])
    print(f"Found {len(resources)} total resources in Cloudinary under oktoberfest/")

    duplicates_to_delete = []
    for r in resources:
        pid = r.get("public_id", "")
        # Identify duplicates like PA080419_v2 or any ending with _v2, _2
        if pid.endswith("_v2") or pid.endswith("_2") or "_v2" in pid:
            duplicates_to_delete.append(pid)

    if duplicates_to_delete:
        print(f"Deleting {len(duplicates_to_delete)} duplicate resources from Cloudinary:", duplicates_to_delete)
        for dpid in duplicates_to_delete:
            res = cloudinary.uploader.destroy(
                dpid,
                invalidate=True,
                cloud_name=cloud_name,
                api_key=api_key,
                api_secret=api_secret
            )
            print(f" -> Deleted {dpid}: {res.get('result')}")
    else:
        print("No duplicate resources found ending in _v2 or _2!")
except Exception as e:
    print("Error:", e)
