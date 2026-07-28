"""PNG -> RGBA cru. Decodificador minimo: zlib + desfiltragem por scanline."""
import struct, zlib, sys

def decode(path):
    d = open(path, 'rb').read()
    assert d[:8] == b'\x89PNG\r\n\x1a\n', 'nao e PNG'
    pos, idat, pal, trns = 8, b'', None, None
    w = h = depth = ctype = None
    while pos < len(d):
        ln = struct.unpack('>I', d[pos:pos+4])[0]
        typ = d[pos+4:pos+8]
        body = d[pos+8:pos+8+ln]
        if typ == b'IHDR':
            w, h, depth, ctype = struct.unpack('>IIBB', body[:10])
        elif typ == b'PLTE':
            pal = body
        elif typ == b'tRNS':
            trns = body
        elif typ == b'IDAT':
            idat += body
        elif typ == b'IEND':
            break
        pos += 12 + ln
    assert depth == 8, f'profundidade {depth} nao suportada'

    channels = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}[ctype]
    raw = zlib.decompress(idat)
    stride = w * channels
    out = bytearray(w * h * 4)
    prev = bytearray(stride)
    p = 0

    for y in range(h):
        f = raw[p]; p += 1
        line = bytearray(raw[p:p+stride]); p += stride
        # desfiltragem PNG
        for i in range(stride):
            a = line[i-channels] if i >= channels else 0
            b = prev[i]
            c = prev[i-channels] if i >= channels else 0
            x = line[i]
            if f == 1: x += a
            elif f == 2: x += b
            elif f == 3: x += (a + b) // 2
            elif f == 4:
                pa, pb, pc = abs(b-c), abs(a-c), abs(a+b-2*c)
                x += a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
            line[i] = x & 0xFF
        prev = line

        for x in range(w):
            o = (y*w + x) * 4
            if ctype == 6:
                out[o:o+4] = line[x*4:x*4+4]
            elif ctype == 2:
                out[o:o+3] = line[x*3:x*3+3]; out[o+3] = 255
            elif ctype == 3:
                idx = line[x]
                out[o:o+3] = pal[idx*3:idx*3+3]
                out[o+3] = trns[idx] if trns and idx < len(trns) else 255
            elif ctype == 0:
                v = line[x]; out[o:o+3] = bytes([v, v, v]); out[o+3] = 255
            elif ctype == 4:
                v = line[x*2]; out[o:o+3] = bytes([v, v, v]); out[o+3] = line[x*2+1]
    return w, h, bytes(out)

if __name__ == '__main__':
    src, dst = sys.argv[1], sys.argv[2]
    w, h, rgba = decode(src)
    with open(dst, 'wb') as f:
        f.write(struct.pack('>II', w, h))
        f.write(rgba)
    print(f'{src} -> {w}x{h}')
