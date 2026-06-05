// ************************************************************************
// ⚠️ เปลี่ยนเป็น URL เว็บแอปพลิเคชันที่ครูได้ทำการคัดลอกมาจาก Google Apps Script
const API_ENDPOINT = 'https://script.google.com/macros/s/AKfycbwYNit-n6pgzD8B2XmSJJx3Ey_cdJnYSMKI3UXxVjN9jAF3-vlAwyNL-jxIjgRZLgMYog/exec';
// ************************************************************************

function systemApp() {
  return {
    view: 'dashboard',
    loading: true,
    thaiDateNow: '',
    searchQuery: '',
    filterType: '',
    filterUnit: '',
    meta: { groups: [], units: [], types: [] },
    filteredUnits: [],
    records: [],
    stats: { totalBooks: 0, booksByType: {}, topRequesters: [], latestBookings: {} },
    form: { group: '', unit: '', documentType: '', prefix: '', documentDate: '', recipient: '', subject: '', requester: '', remarks: '', userEmail: '' },

    async init() {
      this.generateThaiDate();
      await this.loadMeta();
      await this.loadDashboard();
      this.loading = false;
    },

    generateThaiDate() {
      const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
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

    // แสดง Pop Up ตรวจสอบเงื่อนไขตามข้อกำหนด (SweetAlert2)
    openConfirmation() {
      const activeUnitDisplay = this.form.unit || 'ออกในนามกลุ่มงานหลัก';
      
      Swal.fire({
        title: '🔒 ตรวจสอบความถูกต้อง',
        html: `
          <div class="text-start fs-6 p-2 bg-light border rounded">
            <p class="mb-1"><b>ประเภทหนังสือ:</b> ${this.form.documentType}</p>
            <p class="mb-1"><b>กลุ่มงาน:</b> ${this.form.group}</p>
            <p class="mb-1"><b>หน่วยงาน:</b> ${activeUnitDisplay}</p>
            <p class="mb-1 text-primary"><b>รหัสนำเอกสาร:</b> ${this.form.prefix}XXXXX</p>
            <p class="mb-1"><b>เรื่อง:</b> ${this.form.subject}</p>
            <p class="mb-0"><b>ลงวันที่ในหนังสือ:</b> ${this.form.documentDate}</p>
          </div>
          <p class="mt-3 text-danger small">*เมื่อกดยืนยัน ระบบจะล็อกคิวและประมวลผลออกเลขทันที</p>
        `,
        icon: 'info',
        showCancelButton: true,
        confirmButtonColor: '#2563eb',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'ยืนยันและออกเลขเอกสาร',
        cancelButtonText: 'แก้ไขข้อมูล'
      }).then((result) => {
        if (result.isConfirmed) {
          this.executeBooking();
        }
      });
    },

    async executeBooking() {
      this.loading = true;
      try {
        // ส่งข้อความดิบ (text/plain) เพื่อเลี่ยงการติดบล็อก CORS Preflight ของฝั่งสคริปต์เซิร์ฟเวอร์
        const response = await fetch(API_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(this.form)
        });
        
        const res = await response.json();
        this.loading = false;
        
        if(res.success) {
          Swal.fire({
            title: '🎉 จองเลขเอกสารสำเร็จ!',
            html: `
              <div class="alert alert-success py-3 my-2">
                <span class="small d-block text-muted">เลขที่หนังสือของคุณคือ</span>
                <h2 class="fw-bold tracking-wide text-dark m-0 mt-1">${res.documentNumber}</h2>
              </div>
              <div class="text-start mt-2 px-1 small">
                <b>ประเภท:</b> ${res.documentType}<br>
                <b>กลุ่มงาน:</b> ${res.group}<br>
                <b>หน่วยงาน:</b> ${res.unit}<br>
                <b>ลงวันที่:</b> ${res.documentDate}
              </div>
            `,
            icon: 'success',
            confirmButtonText: 'ตกลง รับทราบ'
          });
          
          // ล้างค่าฟอร์มเฉพาะส่วนที่จำเป็นเพื่อความสะดวกในการจองรอบถัดไป
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
          r.docNum.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
          r.subject.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
          r.requester.toLowerCase().includes(this.searchQuery.toLowerCase());
          
        const matchesType = !this.filterType || r.type === this.filterType;
        const matchesUnit = !this.filterUnit || 
          r.unit.toLowerCase().includes(this.filterUnit.toLowerCase()) ||
          r.group.toLowerCase().includes(this.filterUnit.toLowerCase());
          
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
      window.print(); // ใช้ฟังก์ชัน Native Print Engine ร่วมกับ CSS @media print ที่ออกแบบไว้
    }
  }
}
