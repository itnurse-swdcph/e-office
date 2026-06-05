// ************************************************************************
// ⚠️ เปลี่ยนเป็น URL เว็บแอปพลิเคชันที่ได้ทำการคัดลอกมาจาก Google Apps Script
const API_ENDPOINT = 'https://script.google.com/macros/s/AKfycbwYNit-n6pgzD8B2XmSJJx3Ey_cdJnYSMKI3UXxVjN9jAF3-vlAwyNL-jxIjgRZLgMYog/exec';
// ************************************************************************

function systemApp() {
  return {
    view: 'dashboard',
    loading: true,
    sidebarCollapse: false, // ตัวแปรควบคุมสถานะ ย่อ-ขยาย แถบเมนูด้านข้าง
    thaiDateNow: '',
    searchQuery: '',
    filterType: '',
    filterUnit: '',
    
    // โครงสร้างข้อมูล 3 ระดับ (ภารกิจ -> กลุ่มงาน -> หน่วยงาน)
    meta: { missions: [], groups: [], units: [], types: [] },
    filteredGroups: [],
    filteredUnits: [],
    records: [],
    stats: { totalBooks: 0, booksByType: {}, topRequesters: [], latestBookings: {} },
    
    // ฟอร์มข้อมูล (เพิ่ม mission เข้ามา)
    form: { mission: '', group: '', unit: '', documentType: '', prefix: '', documentDate: '', recipient: '', subject: '', requester: '', remarks: '' },

    async init() {
      this.generateThaiDate();
      await this.loadMeta();
      await this.loadDashboard();
      this.loading = false;
    },

    // 🌟 ฟังก์ชันสำหรับแปลงวันที่ ISO (เช่น 2569-06-03T17:00...) เป็นวันที่ไทย
    formatThaiDate(dateInput) {
      if (!dateInput) return '-';
      
      try {
        const date = new Date(dateInput);
        if (isNaN(date.getTime())) return dateInput; 
        
        const day = date.getDate();
        const monthShort = date.toLocaleDateString('th-TH', { month: 'short' });
        let year = date.getFullYear();
        
        // ตรวจสอบปี ค.ศ. แปลงเป็น พ.ศ.
        if (year < 2500) {
          year = year + 543;
        }
        
        return `${day} ${monthShort} ${year}`;
      } catch (e) {
        return dateInput;
      }
    },

    // 🌟 ฟังก์ชันสำหรับแสดงตัวอย่างวันที่ในฟอร์ม (แสดงชื่อเดือนแบบเต็ม)
    formatThaiDateFull(dateInput) {
      if (!dateInput) return '';
      
      try {
        const date = new Date(dateInput);
        if (isNaN(date.getTime())) return '';
        
        const monthsFull = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
        
        const day = date.getDate();
        const monthFull = monthsFull[date.getMonth()];
        let year = date.getFullYear();
        
        if (year < 2500) {
          year = year + 543;
        }
        
        return `${day} ${monthFull} ${year}`;
      } catch (e) {
        return '';
      }
    },

    generateThaiDate() {
      const months = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
      const d = new Date();
      this.thaiDateNow = `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543}`;
    },

    async switchView(newView) {
      this.view = newView;
      if (newView === 'dashboard') {
        await this.loadDashboard();
      } else if (newView === 'register') {
        this.loading = true;
        await this.loadRegister();
        this.loading = false;
      }
    },

    async loadMeta() {
      try {
        const response = await fetch(`${API_ENDPOINT}?action=getMeta`);
        const json = await response.json();
        if(json.success) {
          this.meta = json.data;
        }
      } catch (err) {
        console.error("โหลด Meta ไม่สำเร็จ:", err);
      }
    },

    async loadDashboard() {
      try {
        const response = await fetch(`${API_ENDPOINT}?action=getDashboard`);
        const json = await response.json();
        if(json.success) this.stats = json.data;
      } catch (err) {
        console.error("โหลด Dashboard ล้มเหลว:", err);
      }
    },

    async loadRegister() {
      try {
        const response = await fetch(`${API_ENDPOINT}?action=getRegister`);
        const json = await response.json();
        if(json.success) this.records = json.data;
      } catch (err) {
        console.error("โหลดทะเบียนหนังสือล้มเหลว:", err);
      }
    },

    // 🌟 ระบบจัดการเลือก 3 ระดับ (ภารกิจ -> กลุ่มงาน -> หน่วยงาน)
    handleMissionChange() {
      const matched = this.meta.missions.find(m => m[0] === this.form.mission);
      this.form.prefix = matched ? matched[1] : '';
      
      // กรองกลุ่มงานภายใต้ภารกิจ
      this.filteredGroups = this.meta.groups.filter(g => g[1] === this.form.mission);
      
      // รีเซ็ตค่าระดับล่างลงมา
      this.form.group = ''; 
      this.filteredUnits = [];
      this.form.unit = ''; 
    },

    handleGroupChange() {
      if(this.form.group === "") {
        this.handleMissionChange(); // กลับไปใช้รหัสของภารกิจถ้าไม่เลือกกลุ่มงาน
        return;
      }
      const matched = this.meta.groups.find(g => g[0] === this.form.group);
      if(matched && matched[2]) this.form.prefix = matched[2];
      
      // กรองหน่วยย่อยภายใต้กลุ่มงาน
      this.filteredUnits = this.meta.units.filter(u => u[1] === this.form.group);
      this.form.unit = ''; 
    },

    handleUnitChange() {
      if(this.form.unit === "") {
        this.handleGroupChange(); // กลับไปใช้รหัสของกลุ่มงานถ้าไม่เลือกหน่วยงาน
        return;
      }
      const matched = this.meta.units.find(u => u[0] === this.form.unit);
      if(matched && matched[2]) this.form.prefix = matched[2]; 
    },

    // 🌟 แสดง Pop Up ตรวจสอบเงื่อนไขการจองก่อนบันทึก (โชว์ข้อมูล 3 ระดับ)
    openConfirmation() {
      const activeGroupDisplay = this.form.group || '-';
      const activeUnitDisplay = this.form.unit || '-';
      
      Swal.fire({
        title: '📝 ยืนยันการจองเลขเอกสาร',
        html: `
          <div class="text-start fs-6 p-3 bg-light border rounded">
            <p class="mb-1"><b>ประเภทหนังสือ:</b> ${this.form.documentType}</p>
            <p class="mb-1"><b>ภารกิจ:</b> ${this.form.mission}</p>
            <p class="mb-1"><b>กลุ่มงาน:</b> ${activeGroupDisplay}</p>
            <p class="mb-1"><b>หน่วยงาน:</b> ${activeUnitDisplay}</p>
            <p class="mb-1 text-primary mt-2 border-top pt-2"><b>เรื่อง:</b> ${this.form.subject}</p>
            <p class="mb-0"><b>ลงวันที่ในหนังสือ:</b> ${this.formatThaiDateFull(this.form.documentDate)}</p>
          </div>
        `,
        icon: 'info',
        showCancelButton: true,
        confirmButtonColor: '#2563eb',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'กดยืนยัน',
        cancelButtonText: 'แก้ไขข้อมูล'
      }).then((result) => {
        if (result.isConfirmed) {
          this.executeBooking();
        }
      });
    },

    // 🌟 ส่งข้อมูลลงฐานและแสดงผลลัพธ์เลขหนังสือ (เพิ่มบรรทัดแสดงภารกิจ)
    async executeBooking() {
      this.loading = true;
      try {
        const response = await fetch(API_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(this.form)
        });
        
        const res = await response.json();
        this.loading = false;
        
        if(res.success) {
          Swal.fire({
            title: 'จองเลขที่หนังสือสำเร็จ!',
            html: `
              <div class="text-start p-3 bg-light border rounded" style="font-size: 0.95rem;">
                <p class="mb-1"><b>ประเภท:</b> ${res.documentType}</p>
                <p class="mb-1"><b>ภารกิจ:</b> ${res.mission}</p>
                <p class="mb-1"><b>กลุ่มงาน:</b> ${res.group || 'ออกในนามภารกิจ'}</p>
                <p class="mb-1"><b>หน่วยงาน:</b> ${res.unit || '-'}</p>
                <p class="mb-1 text-primary mt-2 border-top pt-2"><b>เรื่อง:</b> ${this.form.subject}</p>
                <hr class="my-2">
                <p class="mb-1 text-center fs-5 text-success fw-bold">เลขที่หนังสือของคุณคือ</p>
                <p class="text-center fs-3 fw-bold text-dark font-monospace mb-2">${res.documentNumber}</p>
                <p class="mb-0 text-center text-muted">ลงวันที่ ${this.formatThaiDateFull(res.documentDate)}</p>
              </div>
            `,
            icon: 'success',
            confirmButtonText: 'ตกลง'
          });
          
          // ล้างค่าฟอร์มเฉพาะส่วนแปรผันเพื่อความสะดวกในการรันงานเล่มถัดไป
          this.form.subject = '';
          this.form.recipient = '';
          this.form.remarks = '';
          this.switchView('dashboard');
        } else {
          Swal.fire('เกิดข้อผิดพลาดจากระบบชีต', res.message, 'error');
        }
      } catch (error) {
        this.loading = false;
        Swal.fire('ระบบเครือข่ายขัดข้อง', error.toString(), 'error');
      }
    },

    get filteredRecords() {
      return this.records.filter(r => {
        const matchesSearch = !this.searchQuery || 
          (r.docNum && r.docNum.toLowerCase().includes(this.searchQuery.toLowerCase())) ||
          (r.subject && r.subject.toLowerCase().includes(this.searchQuery.toLowerCase())) ||
          (r.requester && r.requester.toLowerCase().includes(this.searchQuery.toLowerCase()));
          
        const matchesType = !this.filterType || r.type === this.filterType;
        const matchesUnit = !this.filterUnit || 
          (r.unit && r.unit.toLowerCase().includes(this.filterUnit.toLowerCase())) ||
          (r.group && r.group.toLowerCase().includes(this.filterUnit.toLowerCase())) ||
          (r.mission && r.mission.toLowerCase().includes(this.filterUnit.toLowerCase()));
          
        return matchesSearch && matchesType && matchesUnit;
      });
    },

    exportExcel() {
      if(this.filteredRecords.length === 0) return Swal.fire('คำเตือน', 'ไม่มีข้อมูลในตารางให้ส่งออก', 'warning');
      const ws = XLSX.utils.json_to_sheet(this.filteredRecords);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "RegisterRecords");
      XLSX.writeFile(wb, "ทะเบียนจองเลขเอกสาร.xlsx");
    },

    exportPDF() {
      window.print();
    }
  }
}
