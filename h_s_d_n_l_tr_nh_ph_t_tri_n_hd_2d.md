# HỒ SƠ DỰ ÁN & LỘ TRÌNH PHÁT TRIỂN: HD-2D DIORAMA RPG (THỊ TRẤN BÊN SUỐI)

> **Hướng dẫn khôi phục ngữ cảnh cho phiên làm việc (Session) mới:**
> Khi mở một cuộc trò chuyện mới, bạn chỉ cần tải lên hoặc dán nội dung tệp **`index.html`** hiện tại kèm theo tệp **`project_master_plan.md`** này và nhắn: *"Đây là hồ sơ dự án HD-2D của tôi. Hãy đọc để nắm bối cảnh và tiếp tục triển khai [Tên tính năng/Giai đoạn]"*.

---

## 1. Tổng Quan & Kiến Trúc Kỹ Thuật Hiện Tại

* **Tên dự án:** HD-2D Diorama Prototype – Thị Trấn Bên Suối (4x Map & Lễ Hội).
* **Công nghệ lõi:** Single-file Web Application (`index.html`), Three.js `r160`, WebGL Custom GLSL Shaders, Post-Processing (`EffectComposer`, `UnrealBloomPass`, Custom `TiltShiftShader`), Tailwind CSS.
* **Phong cách đồ họa:** Lấy cảm hứng từ *Octopath Traveler* và *The Last Night* — kết hợp môi trường 3D đổ bóng thời gian thực (`PCFSoftShadowMap`, `ACESFilmicToneMapping`) với kết cấu và nhân vật Pixel Art 2D sắc nét (`NearestFilter`, tỷ lệ đầu-thân `1:2`).

### Các tính năng đã hoàn thiện trong `index.html`:
1. **Bản đồ mở rộng 4x & Kiến trúc chi tiết:**
   * Dòng suối trung tâm chia đôi thị trấn với 2 cây cầu gỗ vòm (**Cầu Trung Tâm** `z = 0.6` và **Cầu Lễ Hội phía Bắc** `z = -10.2`), bờ kè đá, đường lát đá cuội (`cobblestone`) và các quảng trường lớn.
   * **Hệ thống công trình & đạo cụ:** 11 ngôi nhà gỗ châu Âu mái ngói đỏ/xanh có ống khói, bồn hoa và cửa sổ phát sáng; **Đền Pha Lê & Cổng Torii** ở phía Đông; 8 sạp hàng chợ; cối xay nước gỗ quay liên tục bên bờ Tây; 2 giếng nước đá; 3 xe kéo nông sản; cụm thùng rượu, ghế băng công viên và hàng rào gỗ.
2. **Hệ thống Ánh sáng & Thời tiết Động:**
   * **4 Chế độ Thời điểm:** *Sương Sớm*, *Hoàng Hôn*, *Đêm Bình Yên* (ánh trăng xanh bạc dịu nhẹ), và *Đêm Lễ Hội* (dây đèn lồng đa sắc, đèn chiếu khu vực và pháo hoa tầm cao).
   * **3 Trạng thái Thời tiết:** *Quang Đãng*, *Sương Mù* (các lớp sương thể tích trôi sát mặt đất), và *Mưa Đêm* (950 hạt mưa 3D nghiêng theo gió, mặt đường đá ướt phản chiếu ánh đèn, vòng sóng nước loang trên suối và tia chớp khi gió bão mạnh).
   * **Vật lý Gió đồng bộ:** Thanh trượt cường độ gió (`0.0x` – `2.5x`) điều khiển tốc độ lá rơi, độ lay động của tán cây/bụi hoa, độ nhấp nháy của đèn lồng và góc nghiêng hạt mưa.
3. **Gameplay, Điều khiển & Sinh thái:**
   * **Điều khiển nhân vật:** Hỗ trợ bàn phím (`WASD` / Phím mũi tên), `Click chuột` chạm đất để tự tìm đường đi, và `Joystick ảo` cho màn hình cảm ứng; kèm hệ thống va chạm địa hình (`solidColliders`) và tự nâng độ cao theo nhịp cong của cầu gỗ.
   * **Camera thông minh:** Chuyển đổi giữa *Camera theo nhân vật* (tự động bám theo và khóa vùng lấy nét `Tilt-Shift` vào nhân vật) và *Camera tự do* (`OrbitControls`).
   * **Tương tác RPG & Động vật:** 3 NPC dân làng (*Lão Ngư Ông Barnaby*, *Tiểu Thư Clara*, *Pháp Sư Kaelen*) có hộp thoại gõ chữ kèm ảnh chân dung Pixel Art; khả năng nhấn phím `[E]` để bật/tắt từng cột đèn đường; cùng 8 con vật (chó, mèo, gà) tự động đi dạo khắp thị trấn.

---

## 2. Lộ Trình 4 Giai Đoạn Nâng Cấp Chuyên Nghiệp

### Giai đoạn 1: Nâng Cấp Mỹ Thuật & Asset Chuẩn Mực (Ưu tiên cao)
* **Sprite Sheet 8 hướng (48x48 hoặc 64x64px):** Nâng cấp nhân vật chính và NPC từ 32x32 (2 hướng trái/phải) lên bộ Sprite đầy đủ các góc nhìn (Trước, Sau, Trái, Phải, Chéo) và các trạng thái: *Đứng thở (Idle), Đi bộ (Walk), Chạy nhanh (Run - giữ Shift), Nhảy (Jump)*.
* **Pipeline 3D-to-2D với UniRig (Tùy chọn):** Sử dụng `VAST-AI-Research/UniRig` để gắn xương tự động cho các model 3D, diễn hoạt trong Blender và render ra chuỗi ảnh Sprite Sheet Pixel Art sắc nét.
* **PBR Pixel Textures:** Bổ sung `Normal Map` và `Roughness Map` cho đường lát đá, tường gỗ và mái ngói để ánh đèn lồng/ánh trăng bắt sáng nổi khối 3D rõ rệt.

### Giai đoạn 2: Hậu Kỳ & Ánh Sáng Điện Ảnh (HD-2D Signature Shaders)
* **Bokeh Depth of Field (DoF) thật:** Thay thế bộ lọc `Tilt-Shift` trục dọc bằng `BokehPass` dựa trên Depth Buffer của WebGL để tiền cảnh và hậu cảnh xa nhòe thành các đốm sáng tròn mềm mại ở mọi góc xoay camera.
* **Phản chiếu mặt nước thời gian thực (Planar Reflection):** Tích hợp `Reflector` của Three.js kết hợp nhiễu loạn sóng để soi bóng cây cầu, nhà cửa và pháo hoa ngược xuống mặt suối.
* **Color Grading (LUTPass):** Tinh chỉnh dải màu tương phản cho từng khung giờ (vàng cam điện ảnh lúc Hoàng Hôn, xanh chàm sâu thẳm lúc Đêm Bình Yên).

### Giai đoạn 3: Âm Thanh Không Gian & Phản Hồi Giác Quan (Game Feel)
* **Web Audio API (Spatial Audio):** Tổng hợp âm thanh không cần tải file ngoài: tiếng suối chảy róc rách lớn dần khi đến gần cầu, tiếng cối xay nước kẽo kẹt ở bờ Tây, tiếng bước chân thay đổi theo chất liệu (gỗ cầu / đá cuội / cỏ), tiếng mưa rơi, sấm rền và tiếng pháo hoa nổ.
* **Tương tác vật lý vi mô (Juice):** Rung camera nhẹ (`Micro Screen Shake`) khi pháo hoa lớn nổ hoặc sấm giật; hiệu ứng cánh hoa bay tung và đàn gà chạy tản ra khi nhân vật chạy ngang qua.

### Giai đoạn 4: Vòng Lặp Nhiệm Vụ RPG & Tái Cấu Trúc Mã Nguồn
* **Hệ thống Nhiệm vụ & Vật phẩm (Quest & Inventory):**
  * Ví dụ: Nhận nhiệm vụ từ *Lão Ngư Ông Barnaby* thu thập 3 Đom Đóm Pha Lê quanh Đền Torii để thắp sáng ngọn đèn cổ, nhận phần thưởng là **Đèn lồng cầm tay** chiếu sáng động xung quanh nhân vật vào ban đêm.
* **Minimap & Chuyển cảnh nội thất:** Thêm bản đồ nhỏ ở góc màn hình đánh dấu vị trí NPC/nhiệm vụ và cho phép mở cửa bước vào bên trong quán trọ hoặc cửa hàng.
* **Modular Architecture:** Tách tệp `index.html` thành dự án **Vite + TypeScript** gồm các module độc lập (`WorldBuilder`, `EntityController`, `WeatherSystem`, `AudioEngine`, `QuestManager`).

---

## 3. Các Gói Triển Khai Nhanh Cho Phiên Tiếp Theo

Khi bắt đầu phiên làm việc mới, bạn có thể chọn ngay một trong hai gói sau để AI cập nhật trực tiếp vào tệp `index.html`:
* **Gói A (Đỉnh cao Thị giác):** Nâng cấp mặt nước phản chiếu thật (`Planar Reflection`) soi bóng cầu và pháo hoa + Trang bị đèn lồng cầm tay phát sáng động cho nhân vật + Hiệu ứng tương tác môi trường (chạy qua bụi hoa tung cánh hoa, đàn gà chạy tránh nhân vật).
* **Gói B (Âm thanh & Nhiệm vụ RPG):** Tích hợp bộ tổng hợp âm thanh Web Audio API (tiếng suối theo khoảng cách, tiếng bước chân trên gỗ/đá, tiếng mưa, tiếng hội thoại) + Chuỗi nhiệm vụ thu thập vật phẩm hoàn chỉnh.