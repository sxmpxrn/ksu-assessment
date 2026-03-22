# ระบบประเมินอาจารย์ที่ปรึกษา มหาวิทยาลัยกาฬสินธุ์
> **โครงการสหกิจศึกษา (Cooperative Education Project)**

ระบบสารสนเทศเพื่อการประเมินและติดตามการปฏิบัติหน้าที่ของอาจารย์ที่ปรึกษา มหาวิทยาลัยกาฬสินธุ์ พัฒนาขึ้นเพื่อเพิ่มประสิทธิภาพในการสื่อสารและประเมินผลระหว่างนักศึกษาและอาจารย์ที่ปรึกษา

---

## 👨‍💻 ข้อมูลผู้จัดทำ
**ชื่อ-นามสกุล:** นายสมพร ผลพันธุ์  
**สาขาวิชา:** วิศวกรรมคอมพิวเตอร์และระบบอัตโนมัติ  
**คณะ:** เทคโนโลยีอุตสาหกรรม  
**สถาบัน:** มหาวิทยาลัยกาฬสินธุ์

---

## 🛠️ เทคโนโลยีที่ใช้ (Tech Stack)

### Frontend & Framework
- **Next.js 15+ (App Router):** เฟรมเวิร์กหลักในการพัฒนา
- **React 19:** ไลบรารีสำหรับสร้าง User Interface
- **Tailwind CSS 4:** เครื่องมือสำหรับการจัดการสไตล์แบบ Utility-first
- **Lucide React:** ชุดไอคอนสำหรับ UI

### Backend & Database
- **Supabase (@supabase/ssr):** ระบบ Backend-as-a-Service สำหรับ Database และ Authentication
- **LDAP Authentication:** ระบบยืนยันตัวตนผ่านเครือข่ายของมหาวิทยาลัย
- **Jose / JWT:** การจัดการ Security Token

### Data & Visualization
- **Recharts:** การแสดงผลข้อมูลในรูปแบบกราฟและสถิติ
- **XLSX:** ระบบนำเข้าและส่งออกข้อมูลผ่านไฟล์ Excel

---

## ✨ ฟีเจอร์หลัก (Main Features)

### 👤 สำหรับผู้ดูแลระบบ (Admin,Executives)
- **Dashboard Overview:** ดูภาพรวมผลการประเมินทั้งมหาวิทยาลัย แยกตามคณะและสาขา
- **Student Data Management:** นำเข้านักศึกษาผ่านไฟล์ Excel และจัดการข้อมูลพื้นฐาน
- **Assessment Management:** สร้าง แก้ไข และจัดการแบบประเมินอาจารย์ที่ปรึกษา

### 👨‍🏫 สำหรับอาจารย์ที่ปรึกษา (Advisor)
- **Advisor Dashboard:** ดูรายงานสรุปผลการประเมินรายบุคคล
- **Advisory Class:** จัดการและเข้าถึงข้อมูลนักศึกษาในที่ปรึกษา
- **Analytics Report:** ดาวน์โหลดรายงานผลการประเมินในรูปแบบต่างๆ

### 🎓 สำหรับนักศึกษา (Student)
- **Login via LDAP:** เข้าใช้งานด้วยบัญชีผู้ใช้มหาวิทยาลัย
- **Assessment Submission:** ทำแบบประเมินอาจารย์ที่ปรึกษาผ่านระบบออนไลน์
- **Status Tracking:** ตรวจสอบสถานะการประเมินของตนเอง

---

## 🚀 การติดตั้งและเริ่มต้นใช้งาน (Installation)

1. **Clone project:**
   ```bash
   git clone [repository-url]
   cd 19-03-69-more
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Setup Environment Variables:**
   สร้างไฟล์ `.env.local` และกำหนดค่าดังนี้:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   LDAP_URL=your-ldap-server
   ```

4. **Run Development Server:**
   ```bash
   npm run dev
   ```
   เปิดลิงก์ [http://localhost:3000](http://localhost:3000) เพื่อดูผลลัพธ์

---

## 📂 โครงสร้างโฟลเดอร์ (Folder Structure)
- `src/app/` - หน้าจอหลักและระบบ Routing
- `src/app/dashboard-admin/` - ระบบหลังบ้านสำหรับผู้ดูแลระบบ
- `src/app/dashboard-advisor/` - ระบบสำหรับอาจารย์ที่ปรึกษา
- `src/app/api/` - ส่วนเชื่อมต่อ LDAP และระบบหลังบ้าน
- `public/` - ไฟล์ Static เช่น รูปภาพและโลโก้

---

## 📝 บันทึกเพิ่มเติม
โปรเจคนี้พัฒนาขึ้นโดยใช้แนวทางการเขียนโค้ดที่ทันสมัย (Modern Web Development) เน้นความรวดเร็วในการใช้งานและความสวยงามของ UI ที่รองรับการใช้งานผ่านอุปกรณ์ที่หลากหลาย (Responsive Design)
