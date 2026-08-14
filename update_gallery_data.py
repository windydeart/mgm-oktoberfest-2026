import json

with open("/Applications/Working/Website/Oktoberfest/assets/cloudinary_data.json", "r", encoding="utf-8") as f:
    images = json.load(f)

print(f"Loaded {len(images)} images from Cloudinary catalog.")

# Group by year
by_year = {}
for img in images:
    y = img['year']
    by_year.setdefault(y, []).append(img)

for y, lst in sorted(by_year.items(), reverse=True):
    print(f"Year {y}: {len(lst)} photos")

# Build slide HTML elements
slides_html = []
for img in images:
    year = img['year']
    url = img['url']
    title_plain = f"mgm Oktoberfest {year}"
    title_html = f"mgm <span class=\"font-oktoberfest\">Oktoberfest</span> {year}"
    clean_name = img['clean_name']
    
    slide_code = f"""            <div class="slider-item" data-category="{year}">
              <div class="gallery-item">
                <img src="{url}" alt="{title_plain} - {clean_name}" loading="lazy">
                <div class="gallery-overlay">
                  <span class="gallery-tag">{year}</span>
                  <h3 class="gallery-title">{title_html}</h3>
                  <p class="gallery-desc">{clean_name}</p>
                  <button class="gallery-zoom-btn" onclick="openLightbox('{url}', '{title_plain} - {clean_name}')">
                    <i data-lucide="maximize-2"></i> Zoom
                  </button>
                </div>
              </div>
            </div>"""
    slides_html.append(slide_code)

full_slides_markup = "\n".join(slides_html)

# Now read index.html and replace slider-track contents
with open("/Applications/Working/Website/Oktoberfest/index.html", "r", encoding="utf-8") as f:
    html = f.read()

start_marker = '<div class="slider-track" id="sliderTrack">'
end_marker = '</div>\n        </div>\n\n        <button class="slider-btn next-btn"'

start_idx = html.find(start_marker)
end_idx = html.find(end_marker, start_idx)

if start_idx != -1 and end_idx != -1:
    new_html = html[:start_idx + len(start_marker)] + "\n" + full_slides_markup + "\n          " + html[end_idx:]
    
    with open("/Applications/Working/Website/Oktoberfest/index.html", "w", encoding="utf-8") as f:
        f.write(new_html)
    print("Successfully updated index.html with all Cloudinary images and font-oktoberfest markup!")
else:
    print(f"Error: Markers not found in index.html. Start: {start_idx}, End: {end_idx}")
