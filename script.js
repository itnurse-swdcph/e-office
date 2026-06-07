// ************************************************************************
const API_ENDPOINT = 'https://script.google.com/macros/s/AKfycbwYNit-n6pgzD8B2XmSJJx3Ey_cdJnYSMKI3UXxVjN9jAF3-vlAwyNL-jxIjgRZLgMYog/exec';
// ************************************************************************

function systemApp() {
  return {
    view: 'dashboard',
    loading: true,
    sidebarCollapse: false, 
    thaiDateNow: '',
    searchQuery: '',
    filterUnit: '',
    
    // 🌟 ระบบ Pagination
    currentPage: 1,
    pageSize: 10,
    
    meta: { missions: [], groups: [], units: [] },
    filteredGroups: [],
    filteredUnits: [],
    records: [],
    stats: { totalBooks: 0, topRequesters: [] },
    
    // ตัด documentType ออกจาก Form
    form: { mission: '', group: '', unit: '', prefix: '', documentDate: '', recipient: '', subject: '', requester: '', remarks: '' },

    async init() {
      this.generateThaiDate();
      await this.loadMeta();
      await this.loadRegister(); // ดึงประวัติมาเลยเพื่อให้แดชบอร์ดโชว์ได้
      await this.loadDashboard();
      this.loading = false;
      
      // ดักจับเวลาพิมพ์ค้นหา ให้กลับไปหน้า 1
      this.$watch('searchQuery', () => { this.currentPage = 1; });
      this.$watch('filterUnit', () => { this.currentPage = 1; });
    },

    formatThaiDate(dateInput) {
      if (!dateInput) return '-';
      if (typeof dateInput === 'string' && (dateInput.includes('คม') || dateInput.includes('ยน') || dateInput.includes('พันธ์'))) {
        return dateInput;
      }
      try {
        if (typeof dateInput === 'string' && dateInput.includes('-')) {
          const cleanDate = dateInput.split('T')[0]; 
          const parts = cleanDate.split('-');
          if (parts.length === 3) {
            const year = parseInt(parts[0], 10);
            const monthIndex = parseInt(parts[1], 10) - 1;
            const day = parseInt(parts[2], 10);
            const monthsFull = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
            let thaiYear = year < 2500 ? year + 543 : year;
            return `${day} ${monthsFull[monthIndex]} ${thaiYear}`;
          }
        }
        const date = new Date(dateInput);
        if (isNaN(date.getTime())) return dateInput; 
        const day = date.getDate();
        const monthFull = date.toLocaleDateString('th-TH', { month: 'long' });
        let year = date.getFullYear();
        if (year < 2500) { year = year + 543; }
        return `${day} ${monthFull} ${year}`;
      } catch (e) {
        return dateInput;
      }
    },

    formatThaiDateFull(dateInput) {
      if (!dateInput) return '';
      try {
        const date = new Date(dateInput);
        if (isNaN(date.getTime())) return '';
        const monthsFull = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
        const day = date.getDate();
        const monthFull = monthsFull[date.getMonth()];
        let year = date.getFullYear();
        if (year < 2500) { year = year + 543; }
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
      this.currentPage = 1; // รีเซ็ตหน้าทุกครั้งที่เปลี่ยนเมนู
      if (newView === 'dashboard') {
        await this.loadDashboard();
        await this.loadRegister();
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
        if(json.success) this.meta = json.data;
      } catch (err) { console.error(err); }
    },

    async loadDashboard() {
      try {
        const response = await fetch(`${API_ENDPOINT}?action=getDashboard`);
        const json = await response.json();
        if(json.success) this.stats = json.data;
      } catch (err) { console.error(err); }
    },

    async loadRegister() {
      try {
        const response = await fetch(`${API_ENDPOINT}?action=getRegister`);
        const json = await response.json();
        if(json.success) this.records = json.data;
      } catch (err) { console.error(err); }
    },

    handleMissionChange() {
      const matched = this.meta.missions.find(m => m[0] === this.form.mission);
      this.form.prefix = matched ? matched[1] : '';
      this.filteredGroups = this.meta.groups.filter(g => g[1] === this.form.mission);
      this.form.group = ''; 
      this.filteredUnits = [];
      this.form.unit = ''; 
    },

    handleGroupChange() {
      if(this.form.group === "") {
        this.handleMissionChange(); 
        return;
      }
      const matched = this.meta.groups.find(g => g[0] === this.form.group);
      if(matched && matched[2]) this.form.prefix = matched[2];
      this.filteredUnits = this.meta.units.filter(u => u[1] === this.form.group);
      this.form.unit = ''; 
    },

    handleUnitChange() {
      if(this.form.unit === "") {
        this.handleGroupChange(); 
        return;
      }
      const matched = this.meta.units.find(u => u[0] === this.form.unit);
      if(matched && matched[2]) this.form.prefix = matched[2]; 
    },

    openConfirmation() {
      const activeGroupDisplay = this.form.group || '-';
      const activeUnitDisplay = this.form.unit || '-';
      
      Swal.fire({
        title: '📝 ยืนยันการจองเลขเอกสาร',
        html: `
          <div class="text-start fs-6 p-3 bg-light border rounded">
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
          
          this.form.subject = '';
          this.form.recipient = '';
          this.form.remarks = '';
          this.switchView('dashboard');
        } else {
          Swal.fire('เกิดข้อผิดพลาด', res.message, 'error');
        }
      } catch (error) {
        this.loading = false;
        Swal.fire('ระบบขัดข้อง', error.toString(), 'error');
      }
    },

    // 🌟 อัปเดต Filter (ลบ Type ออก)
    get filteredRecords() {
      return this.records.filter(r => {
        const matchesSearch = !this.searchQuery || 
          (r.docNum && r.docNum.toLowerCase().includes(this.searchQuery.toLowerCase())) ||
          (r.subject && r.subject.toLowerCase().includes(this.searchQuery.toLowerCase())) ||
          (r.requester && r.requester.toLowerCase().includes(this.searchQuery.toLowerCase()));
          
        const matchesUnit = !this.filterUnit || 
          (r.unit && r.unit.toLowerCase().includes(this.filterUnit.toLowerCase())) ||
          (r.group && r.group.toLowerCase().includes(this.filterUnit.toLowerCase())) ||
          (r.mission && r.mission.toLowerCase().includes(this.filterUnit.toLowerCase()));
          
        return matchesSearch && matchesUnit;
      });
    },

    // 🌟 ระบบ Pagination
    get totalPages() {
      return Math.ceil(this.filteredRecords.length / this.pageSize) || 1;
    },
    
    get paginatedRecords() {
      const start = (this.currentPage - 1) * this.pageSize;
      const end = start + this.pageSize;
      return this.filteredRecords.slice(start, end);
    },

    nextPage() {
      if (this.currentPage < this.totalPages) this.currentPage++;
    },

    prevPage() {
      if (this.currentPage > 1) this.currentPage--;
    },

    exportExcel() {
      if(this.filteredRecords.length === 0) return Swal.fire('คำเตือน', 'ไม่มีข้อมูลในตาราง', 'warning');
      const ws = XLSX.utils.json_to_sheet(this.filteredRecords);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "RegisterRecords");
      XLSX.writeFile(wb, "ทะเบียนหนังสือออก.xlsx");
    },

    exportPDF() {
      window.print();
    }
  }
}
