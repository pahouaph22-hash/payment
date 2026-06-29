# วิธี Deploy Edge Function สำหรับจัดการ User

## ต้องการ: Supabase CLI

### 1. ติดตั้ง Supabase CLI
```bash
# Windows (PowerShell)
winget install Supabase.CLI

# Mac
brew install supabase/tap/supabase

# หรือ npm
npm install -g supabase
```

### 2. Login และ Link Project
```bash
supabase login
supabase link --project-ref maogarokogumawipnbct
```

### 3. Deploy Function
```bash
# สร้าง folder
mkdir -p supabase/functions/manage-users

# วางไฟล์ index.ts ไว้ใน supabase/functions/manage-users/

# Deploy
supabase functions deploy manage-users
```

### 4. ตั้งค่า Secret (Service Role Key)
```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1hb2dhcm9rb2d1bWF3aXBuYmN0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjcxNzk1NCwiZXhwIjoyMDk4MjkzOTU0fQ._CUDjxP8XKnznghMDapW7amKg5GSZ2vGl7szmGZlBEk
```

### 5. ตรวจสอบ
ไปที่ Supabase Dashboard → Edge Functions
จะเห็น `manage-users` อยู่ในรายการ

## หลัง Deploy แล้ว
ฟีเจอร์ใน admin.html จะทำงานได้:
- ✅ เพิ่มผู้ใช้ใหม่
- ✅ แก้ไขสิทธิ์ / เปิด-ปิดบัญชี
- ✅ เปลี่ยนรหัสผ่าน
- ✅ ลบผู้ใช้
