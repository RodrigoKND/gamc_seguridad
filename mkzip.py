import os, sys, zipfile

src, out = sys.argv[1], sys.argv[2]
if os.path.exists(out):
    os.remove(out)
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as z:
    for root, dirs, files in os.walk(src):
        for name in files:
            full = os.path.join(root, name)
            z.write(full, os.path.relpath(full, src).replace(os.sep, '/'))
print(out, round(os.path.getsize(out) / 1e6, 1), 'MB')
