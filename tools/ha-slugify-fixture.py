import json, sys
from slugify import slugify
NAMEN = [
    "Orpheo VP Pool Dosieranlage",
    "Pool",
    "Pool Dosieranlage Sued",
    "Pool Dosieranlage Sued",
    "Pool Dosieranlage Süd",
    "Vigipool-Dosieranlage",
    "Poolsteuerung (Garten)",
    "Dosieranlage 2.0",
    "Große Dosieranlage",
    "Thomas' Pool",
    "  Pool   Dosieranlage  ",
    "Dosieranlage_Nord",
    "Pöol Äußen",
    "Pool/Technik",
]
raus = []
for n in dict.fromkeys(NAMEN):
    raus.append({"name": n, "ha_slug": slugify(n, separator="_")})
json.dump({
    "_erzeugt_mit": "python-slugify, slugify(name, separator='_') - exakt das, was homeassistant.util.slugify benutzt",
    "_zweck": "Gegenprobe fuer haSlugify() in der Card. Nicht von Hand pflegen, mit tools/ha-slugify-fixture.py neu erzeugen.",
    "faelle": raus,
}, sys.stdout, ensure_ascii=False, indent=2)
print()
