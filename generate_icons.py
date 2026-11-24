import zlib
import struct
import os

def create_png(width, height, file_path):
    # Create RGBA buffer
    raw_data = bytearray()
    
    # LinkedIn Blue theme: #0A66C2 -> (10, 102, 194) to Dark Indigo #084B8A
    bg_r1, bg_g1, bg_b1 = 10, 102, 194
    bg_r2, bg_g2, bg_b2 = 7, 60, 130
    
    center_x = width / 2.0
    center_y = height / 2.0
    radius = width * 0.44
    
    for y in range(height):
        raw_data.append(0)  # Filter type: None
        t_y = y / float(height - 1) if height > 1 else 0
        cur_r = int(bg_r1 + (bg_r2 - bg_r1) * t_y)
        cur_g = int(bg_g1 + (bg_g2 - bg_g1) * t_y)
        cur_b = int(bg_b1 + (bg_b2 - bg_b1) * t_y)
        
        for x in range(width):
            dx = (x + 0.5) - center_x
            dy = (y + 0.5) - center_y
            dist = (dx*dx + dy*dy) ** 0.5
            
            # Rounded rect or circle
            # Let's do rounded rect
            corner_r = width * 0.22
            # distance from inner rect
            qx = abs(x + 0.5 - center_x) - (width * 0.5 - corner_r)
            qy = abs(y + 0.5 - center_y) - (height * 0.5 - corner_r)
            
            inside = False
            alpha = 255
            if qx <= 0 or qy <= 0:
                if abs(x + 0.5 - center_x) <= width * 0.5 and abs(y + 0.5 - center_y) <= height * 0.5:
                    inside = True
            else:
                d_corner = (qx*qx + qy*qy)**0.5
                if d_corner <= corner_r:
                    inside = True
                    if corner_r - d_corner < 1.0:
                        alpha = int(255 * max(0.0, min(1.0, corner_r - d_corner)))
            
            if not inside:
                raw_data.extend([0, 0, 0, 0])
            else:
                # Draw letter "L" and spark/star or "in"
                # For simplicity and crisp rendering: white symbol in center
                # Let's create an "L" or rocket / spark glyph
                nx = (x - width * 0.25) / (width * 0.5)
                ny = (y - height * 0.25) / (height * 0.5)
                
                is_symbol = False
                # Letter 'L' vertical bar
                if 0.15 <= nx <= 0.40 and 0.15 <= ny <= 0.85:
                    is_symbol = True
                # Letter 'L' bottom horizontal bar
                if 0.15 <= nx <= 0.85 and 0.62 <= ny <= 0.85:
                    is_symbol = True
                # Plus/spark symbol at top right
                if 0.55 <= nx <= 0.85 and 0.28 <= ny <= 0.42:
                    is_symbol = True
                if 0.63 <= nx <= 0.77 and 0.15 <= ny <= 0.55:
                    is_symbol = True
                
                if is_symbol:
                    raw_data.extend([255, 255, 255, alpha])
                else:
                    raw_data.extend([cur_r, cur_g, cur_b, alpha])

    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)

    ihdr = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    compressed = zlib.compress(bytes(raw_data), 9)
    png_bytes = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr) + chunk(b'IDAT', compressed) + chunk(b'IEND', b'')
    
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    with open(file_path, 'wb') as f:
        f.write(png_bytes)
    print(f"Generated {file_path}")

create_png(16, 16, "icons/icon16.png")
create_png(48, 48, "icons/icon48.png")
create_png(128, 128, "icons/icon128.png")
