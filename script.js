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
    meta: { groups: [], units: [], types: [] },
    filteredUnits: [],
    records: [],
    stats: { totalBooks: 0, booksByType: {}, topRequesters: [], latestBookings: {} },
    form: { group: '', unit: '', documentType: '', prefix: '', documentDate: '', recipient: '', subject: '', requester: '', remarks: '' },

    async init() {
      this.generateThaiDate();
      await this.loadMeta();
      await this.loadDashboard();
      this.loading = false;
    },

    // 🌟 เพิ่มฟังก์ชันสำหรับแปลงวันที่ ISO (เช่น 2569-06-03T17:00...) เป็นวันที่ไทย
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

    handleGroupChange() {
      const matched = this.meta.groups.find(g => g[0] === this.form.group);
      this.form.prefix = matched ? matched[1] : '';
      
      // กรองหน่วยย่อยภายใต้กลุ่มงาน
      this.filteredUnits = this.meta.units.filter(u => u[1] === this.form.group);
      this.form.unit = ''; 
    },

    handleUnitChange() {
      if(this.form.unit === "") {
        this.handleGroupChange(); // ย้อนกลับมาใช้ Prefix กลุ่มหลักหากไม่ได้เลือกหน่วยย่อย
        return;
      }
      const matched = this.meta.units.find(u => u[0] === this.form.unit);
      if(matched && matched[2]) {
        this.form.prefix = matched[2]; // เปลี่ยนโครงสร้างเป็น Prefix รหัสเฉพาะหน่วยงานย่อย
      }
    },

    // แสดง Pop Up ตรวจสอบเงื่อนไขการจองก่อนบันทึก
    openConfirmation() {
      const activeUnitDisplay = this.form.unit || 'ออกในนามกลุ่มงานหลัก';
      
      Swal.fire({
        title: '📝 ยืนยันการจองเลขเอกสาร',
        html: `
          <div class="text-start fs-6 p-3 bg-light border rounded">
            <p class="mb-1"><b>ประเภทหนังสือ:</b> ${this.form.documentType}</p>
            <p class="mb-1"><b>กลุ่มงาน:</b> ${this.form.group}</p>
            <p class="mb-1"><b>หน่วยงาน:</b> ${activeUnitDisplay}</p>
            <p class="mb-1 text-primary"><b>เรื่อง:</b> ${this.form.subject}</p>
            <p class="mb-0"><b>ลงวันที่ในหนังสือ:</b> ${this.form.documentDate}</p>
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

    // ส่งข้อมูลลงฐานและแสดงผลลัพธ์เลขหนังสือ
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
                <p class="mb-1"><b>หน่วยงาน:</b> ${res.unit}</p>
                <p class="mb-1"><b>กลุ่มงาน:</b> ${res.group}</p>
                <p class="mb-1"><b>เรื่อง:</b> ${this.form.subject}</p>
                <hr class="my-2">
                <p class="mb-1 text-center fs-5 text-success fw-bold">เลขที่หนังสือของคุณคือ</p>
                <p class="text-center fs-3 fw-bold text-dark font-monospace mb-2">${res.documentNumber}</p>
                <p class="mb-0 text-center text-muted">ลงวันที่ ${res.documentDate}</p>
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
          (r.group && r.group.toLowerCase().includes(this.filterUnit.toLowerCase()));
          
        return matchesSearch && matchesType && matchesUnit;
      });
    },

    exportExcel() {
      if(this.filteredRecords.length === 0) return Swal.fire('คำเตือน', 'ไม่มีข้อมูลในตารางให้ส่งออก', 'warning');
      const ws = XLSX.utils.json_to_sheet(this.filteredRecords);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "RegisterRecords");
      XLSX.writeFile(wb, "ทะเบียนจองเลขเอกสาร_กลุ่มงานการพยาบาล.xlsx");
    },

    exportPDF() {
      window.print();
    }
  }
}
