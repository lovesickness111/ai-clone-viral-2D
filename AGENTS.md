# AGENTS.md — AI Clone Viral Reel Studio

Đây là **AI Video Clone Studio điều khiển trực tiếp qua giao diện Chat của AI Agent (Antigravity & Claude Code)**.
Không cần web server hay giao diện bên ngoài. Bạn (AI Agent) đóng vai trò là **AI Director (Đạo diễn AI)**, phối hợp trực tiếp với người dùng qua khung chat và chỉ huy các công cụ phân tích, vẽ animation và render video.

---

## 🎬 Quy trình 5 bước trong Chat (The Pipeline)

```
[1. User gửi link/file] ──▶ [2. Phân tích Style & Nhịp] ──▶ [3. Lên Kịch bản & Thảo luận]
                                                                        │
[5. Thành phẩm MP4] ◀── [4. So sánh & Kiểm duyệt] ◀── [Duyệt kịch bản & Render]
```

### Bước 1: Tiếp nhận yêu cầu
Người dùng cung cấp:
- Video tham khảo: URL (TikTok, YouTube Shorts, Reels...) hoặc file video trong thư mục `projects/<id>/inputs/`.
- Định hướng / Yêu cầu mới: Chủ đề câu chuyện, nhân vật, sản phẩm, ngôn ngữ.

### Bước 2: Phân tích & Tách cấu trúc (Style Breakdown)
Tạo thư mục dự án: `projects/<YYYYMMDD-slug>/`
Chạy lệnh phân tích:
```bash
python .claude/skills/video-clone/scripts/analyze.py <URL hoặc path video> --out projects/<id>/analysis
```
- Đọc kết quả từ `projects/<id>/analysis/report.json`, `fingerprint.json`, và `peaks.json`.
- Xác định:
  - Tỉ lệ khung hình (thường là 9:16 dọc), FPS, độ dài.
  - Nhịp cắt cảnh (cuts per 10s), chuyển động camera (zoom-in, pan).
  - Điểm cao trào (Peaks: P1, P2, P3).
  - Lựa chọn Style tương ứng trong `.claude/skills/video-clone/styles/*.md` (ví dụ: `narrated-comic-vlog`, `anime-cel`, `whiteboard-explainer`, `crayon-storybook`, `pixel-story`...).

### Bước 3: Lên Kịch bản & Thảo luận với người dùng (Pre-production Plan)
- Viết file `projects/<id>/plan.json` theo chuẩn `.claude/skills/video-clone/CONTRACT.md`.
- Viết file `projects/<id>/STORYBOARD.md` chi tiết từng cảnh (Shot-by-shot).
- **Tạo Artifact Storyboard hiển thị trực tiếp trong Chat:**
  - Trình bày tóm tắt cốt truyện, danh sách nhân vật, các cảnh quay chính.
  - Nêu rõ các câu hỏi mở để người dùng góp ý: *"Chủ đề này bạn thấy ổn chưa?", "Bạn có file thu âm giọng đọc riêng không?", "Có muốn đổi màu sắc nhân vật không?"*
- **Lắng nghe phản hồi của người dùng:** Cập nhật lại kịch bản cho đến khi người dùng đồng ý duyệt (Approved).

### Bước 4: Sản xuất & Render (Production)
Khi người dùng duyệt:
1. **Chuẩn bị Assets:**
   - Tìm kiếm âm thanh, nhạc nền miễn phí: `python .claude/skills/video-clone/scripts/fetch_assets.py search|get ...`
   - Tạo hình nhân vật vector trong `projects/<id>/build/assets/cast/<name>.js`.
2. **Lập trình chuyển động Animation:**
   - Viết mã HTML/SVG/JavaScript hoặc HyperFrames cho từng cảnh trong `projects/<id>/build/`.
   - Lưu ý: Luôn đảm bảo biến môi trường `HF_CACHE_DIR=projects/.cache/hf_frame_cache` để cache lưu trên ổ E (tránh đầy ổ C).
3. **Render khung hình:**
   - Render snapshot/khung hình kiểm tra bằng Chrome headless hoặc script `hf_frames.py`:
     ```bash
     python .claude/skills/video-clone/scripts/hf_frames.py projects/<id>/build --times 0.5,1.0,2.5
     ```

### Bước 5: Chấm điểm & Ghép video (Quality Gate & Final Output)
- Chạy đối chiếu chất lượng với video mẫu:
  ```bash
  python .claude/skills/video-clone/scripts/compare.py projects/<id> --video projects/<id>/out/draft.mp4
  ```
- **Quy tắc nghiệm thu:** Mỗi cảnh phải đạt điểm tương đồng phong cách $\ge 4.0/5.0$. Nếu chưa đạt, sửa lại code animation của cảnh đó.
- Ghép âm thanh, lồng tiếng và xuất video hoàn chỉnh: `projects/<id>/out/video.mp4`.
- Báo cáo kết quả và cung cấp đường dẫn video cho người dùng xem lại.

---

## 🛡️ Quy tắc bắt buộc (Core Rules)
1. **2D-First:** Ưu tiên diễn hoạt 2D (vector SVG, Canvas, HyperFrames, p5.js). Video 3D mẫu sẽ được tái hiện lại dưới ngôn ngữ 2D cách điệu.
2. **Bản quyền an toàn:** Nhạc nền và SFX chỉ lấy từ nguồn CC0/CC-BY (Openverse, Freesound, Pixabay) và ghi nhận attribution đầy đủ trong `assets/ASSETS.md`.
3. **Không đầy ổ đĩa:** Cache render phải luôn nằm trong `projects/.cache/` (ổ E), không xả rác vào `C:\Windows\Temp`.
4. **Tương tác liên tục:** Luôn tạo preview trực quan (ảnh snapshot, bảng so sánh) trong khung chat để người dùng theo dõi và góp ý.
