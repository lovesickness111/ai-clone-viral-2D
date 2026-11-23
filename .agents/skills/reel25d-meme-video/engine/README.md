# reel25d — video meme 2.5D kiểu cắt dán

Một ảnh làm nền ở xa, PNG cắt sẵn dựng đứng như bìa cứng, nhân vật khối kiểu Roblox dựng từ hộp bo góc,
tất cả đặt theo mét trên sàn `y = 0` trong three.js; camera cắt giữa các shot đặt tên (có thể trôi chậm
để lấy parallax); chữ thoại là DOM; giọng edge-tts; ghép ffmpeg. Mỗi khung là hàm thuần của số khung.

```
input/<run>/      ảnh nền, sprites/*.png, audio/*.wav, sprites.json (cách cắt), LICENSES.md
director/<run>.json   kịch bản: kích cỡ, nền, giọng, actors, shots, beats
output/<run>/     voice/ (edge-tts), timeline.json, frames/, video.mp4
```

## Chạy

```
cd reel25d && npm install && npm run build                      # một lần, và sau mỗi lần sửa scene.js
.venv/Scripts/python.exe reel25d/tools/make_sfx.py input/<run>/audio          # gió + nổ tổng hợp (tùy)
.venv/Scripts/python.exe reel25d/tools/cut_sprites.py input/<run>/sprites.json # cắt sprite từ video/ảnh
.venv/Scripts/python.exe reel25d/voice.py director/<run>.json --out output/<run>   # giọng từng câu
cd reel25d && node shoot.mjs --director ../director/<run>.json --out ../output/<run> --times 0.5,4.6,10.2   # stills
cd reel25d && node shoot.mjs --director ../director/<run>.json --out ../output/<run>                        # full
.venv/Scripts/python.exe reel25d/mux.py output/<run> --director director/<run>.json                         # video.mp4
```

Stills trước, full sau. Tốc độ ăn theo số pixel (phần lớn là ghi PNG, SwiftShader): 1080×1440 ~1,5 s/khung
(700 khung ≈ 18 phút), 810×1080 ~0,3–0,6 s/khung (≈ 4–7 phút) — vòng duyệt render 810 (sed đổi `size`),
bản chốt mới chạy full-res. Chạy bị ngắt thì thêm `--resume` để bỏ qua khung đã có (chỉ khi cảnh KHÔNG
đổi; sửa cảnh rồi thì render lại từ đầu, không cần xóa frames/ — khung được ghi đè hết).

## Director

| Khóa | Ý nghĩa |
|---|---|
| `size`, `fps` | khung hình (3:4 cho reel) và tốc độ |
| `input` | thư mục tài nguyên; mọi `file` bên dưới tương đối với nó |
| `background` | `{file, parallax}` — ảnh dán theo camera, phủ kín khung; mỗi shot cắt bằng `bg.zoom`/`bg.pan`, camera drift trượt ảnh nhẹ (parallax/m) |
| `camera.fov`, `light` | fov dọc mặc định; `hemi`, `sun`, `sunPos`, `fill` |
| `caption` | `{size: tỉ lệ chiều rộng, top, font}` |
| `voices` | `{tên: {voice, rate, pitch}}` theo edge-tts (`vi-VN-NamMinhNeural`, `vi-VN-HoaiMyNeural`) |
| `audio.bed` | `{file, gain}` nền lặp suốt video |
| `actors` | xem dưới |
| `shots` | `{tên: {pos, look, fov?, drift?:[m/s], lookDrift?, zoom?: độ/s, roll?, bg?: {zoom, pan:[x,y]}}}` — camera cắt thẳng, không lia. **Luôn nhìn ngang (`look.y == pos.y`)**: ảnh nền dán theo camera nên cúi máy sẽ tách nhân vật khỏi sàn của ảnh |
| `beats` | danh sách theo thời gian, xem dưới |
| `tail`, `voicePad` | giây giữ sau beat cuối; khoảng lặng sau mỗi câu đọc |

### Actors

- `sprite`: `{file, height, at?, shadow?}` — PNG có alpha, pivot đáy giữa, luôn xoay về camera.
- `blocky`: `{color, height, hat: bucket|beanie|bandana, hatColor?, at?, yaw?, face?, faces?}` — nhân vật R6
  (chân 2, thân 2, đầu 1 đơn vị); `faces = {key: {file, size:[w,h], y, z}}` texture dán mặt trước đầu, đổi bằng
  `set.face`; `yaw 0` nhìn về +z (phía camera), `180` quay lưng.
- `pack`: `{color, strapColor, width, height, depth}` — túi/ba lô bo góc có dây, gắn lên lưng bằng `attach`.

Actor có `at` thì hiện từ đầu; không có thì ẩn đến khi một beat `set` cho `at`.

### Beats

`{t, shot?, caption?, voice?, say?, set?, anim?, sfx?, overlay?, watermark?}`

- `t`: giây kịch bản (tối thiểu). Beat có `caption` + `voice` được đọc bằng edge-tts; nếu câu dài hơn khoảng
  đến beat đổi caption kế tiếp, mọi beat sau bị đẩy lùi cho vừa (`timeline.json` ghi `t` đã giải).
- `caption`: chuỗi (xuống dòng `\n`) hoặc `null` để tắt; giữ đến beat kế có khóa `caption`.
- `say`: lời đọc khác chữ hiện (mặc định đọc caption đã bỏ `:))`).
- `set`: `{actor: {at, yaw, face, faceScale, scale, lean, arms, visible, attach: {to, part?, offset, yaw}}}`.
- `anim`: `[{actor, type, dur, ease?: linear|inout|out|in|back, delay?, ...}]` bắt đầu tại `t` của beat:
  `move {to, walk?}`, `turn {to}`, `jump {v:[vx,vy,vz], g?, spin?: độ/s, axis?: x|z, lean?, hide?}`,
  `pop {from,to}`, `facepop {from,to}`, `scale {to}`, `bend {to, back?}`, `arms {to, back?, left?, right?}`,
  `shake {amp, freq}`, `nod {amp}`, `fade {from,to}`, `hide`, `show`.
- `sfx`: `{file, gain?, offset?}` phát tại `t` đã giải; `overlay`: 0–1 hoặc `{color, opacity}` phủ toàn khung.

Trạng thái mỗi khung tính lại từ đầu: duyệt beats có `t ≤ time`, áp `set` rồi `anim` (với tiến độ của chúng),
nên beat sau luôn thắng beat trước — không có "trạng thái ngầm".
