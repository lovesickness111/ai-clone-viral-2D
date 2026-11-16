# 🎬 AI Clone Viral Reel Studio

> **Studio sản xuất video viral hoạt họa tự động điều khiển 100% bằng Chat với AI Agent (Antigravity & Claude Code)**.  
> Tái cấu trúc từ ReelMimic — loại bỏ hoàn toàn web server cồng kềnh, chuyển toàn bộ quyền chỉ huy về khung chat của bạn.

---

## ✨ Điểm nổi bật
* **Trực quan & Tương tác cao:** Thảo luận, sửa kịch bản, xem trước storyboard, ảnh nhân vật ngay trong khung chat của Agent.
* **Tự động phân tích video mẫu:** Nhận diện góc máy, tốc độ cắt cảnh, nhịp beat, chuyển động camera từ TikTok, Reels, Shorts.
* **Diễn hoạt bằng Code thuần (Procedural Animation):** Sinh mã Vector SVG, Canvas, HTML5 và HyperFrames mượt mà ở độ phân giải 1080x1920 (9:16).
* **Kiểm định chất lượng gắt gao:** Tự động so sánh khung hình đối chiếu với video mẫu, đạt chuẩn $\ge 4.0/5$ mới xuất file MP4.
* **Tối ưu ổ đĩa:** Bộ nhớ đệm tự động lưu trên ổ E (`projects/.cache`), không làm tràn ổ hệ thống C.

---

## 🚀 Cài đặt nhanh

### 1. Yêu cầu hệ thống
* **Node.js** $\ge$ 20.0 (Đã có sẵn v22)
* **Python** $\ge$ 3.10 (Đã có sẵn 3.11)
* **FFmpeg & ffprobe** (Đã có trên PATH)
* **Google Chrome** (Dùng để render khung hình không giao diện)

### 2. Kiểm tra môi trường
Chỉ cần chạy lệnh kiểm tra:
```bash
npm run doctor
```
*(Tất cả tích xanh `✓` là sẵn sàng).*

---

## 💬 Cách sử dụng trong Chat (Antigravity / Claude Code)

Bạn chỉ cần mở dự án này trong Antigravity hoặc Claude Code và ra lệnh bằng ngôn ngữ tự nhiên:

### Ví dụ 1: Bắt đầu clone một video
> *"Hãy phân tích video này giúp tôi: `https://www.tiktok.com/@user/video/1234567890`. Tôi muốn làm một video dạng hoạt họa giải thích về cách quản lý chi tiêu cá nhân."*

Agent sẽ:
1. Tải và phân tích nhịp dựng, góc máy của video mẫu.
2. Lên Storyboard chi tiết từng cảnh và gửi bạn xem trước trong Chat.

### Ví dụ 2: Góp ý và chỉnh sửa kịch bản
> *"Kịch bản hay đấy, nhưng ở cảnh 2 hãy đổi màu nhân vật thành màu xanh dương và lời thoại đổi thành tiếng Việt nhé."*

Agent sẽ sửa lại ngay lập tức và render ảnh phác thảo nhân vật để bạn duyệt.

### Ví dụ 3: Duyệt và render
> *"OK duyệt phương án này, render video cho tôi."*

Agent sẽ lập trình hoạt họa, gọi Chrome render ngầm, chạy kiểm định chất lượng và xuất ra file hoàn chỉnh tại `projects/<tên-dự-án>/out/video.mp4`.

---

## 📂 Cấu trúc thư mục

```
ai-clone-viral-reel/
├── .claude/skills/        # 36 Skills & Animation Engines (HyperFrames, Anime, Crayon, Whiteboard...)
├── docs/                  # Tài liệu kiến trúc chuyên sâu
├── projects/              # Nơi chứa các dự án video bạn tạo
├── scripts/
│   └── doctor.mjs         # Kiểm tra môi trường máy
├── AGENTS.md              # Hướng dẫn quy trình dành riêng cho AI Director
├── requirements.txt       # Các thư viện Python
├── package.json           # Cấu hình dự án
└── secrets.example.json   # Mẫu cấu hình API key tùy chọn (TTS, Freesound...)
```
