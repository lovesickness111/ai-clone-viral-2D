---
name: meme-25d-collage
engine: reel25d-meme-video
medium: live-action-collage
priority: 72
---
# Meme 2.5D cắt dán (thân khối Roblox + mặt ảnh dán, nền ảnh chụp thật)

## Dấu hiệu nhận diện
- Hình: một ảnh chụp thật làm nền (quán ăn, phòng, đường phố). Nhân vật là thân khối kiểu Roblox, mặt là ảnh dán (doge/cheems, mèo…). Đạo cụ là ảnh cắt nền dán đè lên.
- Máy quay: thường chỉ một khung tĩnh toàn cảnh, hoặc vài shot cắt thẳng. Không lia máy.
- Chuyển động: sticker bật lên rồi tắt cứng. Ai đang nói thì đầu nhún và nghiêng khoảng 6 Hz.
- Chữ: chữ serif nghiêng, trắng viền đen, ở trên đầu khung; mỗi câu khoảng 1 giây; có watermark tên kênh.
- Âm thanh: giọng TTS tiếng Việt đọc nhanh. Cuối clip là emoji hoặc mặt sốc, tiếng boom, rồi cắt đen.
- Cấu trúc: tạo kỳ vọng → lật kèo bằng một câu thoại → phản ứng chồng sticker → nổ → đen.

## Cách làm mặc định
- Engine: `reel25d-meme-video` (`.agents/skills/reel25d-meme-video/`). Kịch bản là một file director JSON.
- Khung 3:4, 1080×1440, 30 fps. Camera nhìn ngang, cách nhân vật khoảng 5 m.
- Một quầy inox kín đặt phía trước để che chân nhân vật.
- Mặt nhân vật: dùng ảnh động vật CC BY cắt oval, `headScale` khoảng 1,45. Không cắt hình từ clip tham khảo, không dùng mặt người thật.
- Ảnh nền có biển hiệu thương hiệu thật thì vẽ đè biển gốc lên trước khi dùng.
- Ghi đầy đủ giấy phép vào `assets/ASSETS.md`.

## Lỗi đã gặp
- Camera quá gần: thân khối rộng nên nhân vật bị cắt. Tính khung theo chiều ngang (≈3,5 m ở mặt phẳng nhân vật).
- Mặt bàn cao quá làm nhân vật chỉ lộ cổ; thấp quá thì lộ chân. Đặt mép trên mặt bàn ở khoảng 83% chiều cao khung.
- Tay chỉ ngang trông như tấm ván nổi: bỏ, dùng `talk` để thể hiện ai đang nói.
- Không nên dùng ảnh nền CC BY-SA, vì điều khoản share-alike sẽ ràng buộc cả video.
