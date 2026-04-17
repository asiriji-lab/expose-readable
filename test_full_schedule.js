const XLSX = require('xlsx');
const Papa = require('papaparse');
const fs = require('fs');

async function run() {
  console.log("Fetching Google Sheet...");
  const url = `https://docs.google.com/spreadsheets/export?id=13voEcMxystSrzSy4oEAthpkbogpTbQKTUPntKV7EDyE&exportFormat=xlsx`;
  const res = await fetch(url);
  const arrayBuffer = await res.arrayBuffer();
  const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
  
  const form = new FormData();
  form.append('job_name', 'Test');
  form.append('academic_year', '2568');
  form.append('semester', '1');

  const tabMap = {
    'period ': 'period',
    'room ': 'room',
    'teacher': 'teacher',
    'student ': 'student',
    'preplace': 'preplace',
    'scout ': 'scout',
    'elective': 'elective',
    'curriculum': 'curriculum'
  };

  for (const sheetName of wb.SheetNames) {
    if (sheetName === 'constraints' || sheetName === 'Validation Results') continue;
    
    const mappedName = tabMap[sheetName] || sheetName;
    const sheet = wb.Sheets[sheetName];
    // Replicate exactly what the frontend does!
    let rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
    
    // strip empty rows
    rows = rows.filter(row => !row.every(c => !String(c).trim()));
    
    if (rows.length === 0) continue;
    
    // Replicate our custom student patch:
    if (mappedName === 'student') {
      rows = rows.map((row, idx) => {
        if (idx === 0) return row;
        const newRow = [...row];
        let classId = String(newRow[0]);
        if (/^\d+\/\d+\/\d+$/.test(classId)) {
          classId = classId.split('/').slice(0, 2).join('/');
        } else if (/^\d+-[A-Za-z]+(-\d+)?$/.test(classId)) {
          const parts = classId.split('-');
          const months = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
          const m = months[parts[1].toLowerCase().substring(0, 3)];
          if (m) classId = `${parts[0]}/${m}`;
        }
        newRow[0] = classId;
        return newRow;
      });
    }

    const csv = Papa.unparse(rows);
    form.append(mappedName, new Blob([csv], { type: 'text/csv' }), `${mappedName}.csv`);
  }

  console.log("Submitting job...");
  const postRes = await fetch('https://dev.winscloud.net/api/v1/schedule', { method: 'POST', body: form });
  const postData = await postRes.json();
  console.log(postData);
  
  if (!postData.job_id) return;
  const jobId = postData.job_id;
  
  console.log("Polling...");
  let status = 'created';
  while (status === 'created' || status === 'running_ga' || status === 'loading_data') {
    await new Promise(r => setTimeout(r, 2000));
    const statRes = await fetch(`https://dev.winscloud.net/api/v1/schedule/${jobId}`);
    const statData = await statRes.json();
    status = statData.status;
    console.log(`Status: ${status} (Progress: ${statData.progress}%)`);
    if (status === 'failed') {
      console.log('Failed:', statData.error);
      return;
    }
  }
  
  console.log("Fetching result...");
  const resRes = await fetch(`https://dev.winscloud.net/api/v1/schedule/${jobId}/result`);
  const resData = await resRes.json();
  
  // Dump some summary to understand why it placed 0
  const schedule = resData.schedule;
  
  // See how many periods are actually placed vs unfilled
  if (schedule) {
    let placedCount = 0;
    for (const t of schedule.teachers || []) {
      for (const d of ['MON', 'TUE', 'WED', 'THU', 'FRI']) {
        if (t.schedule[d]) placedCount += Object.keys(t.schedule[d]).length;
      }
    }
    console.log("Placed count (from teachers dataset):", placedCount);
    console.log("Unfilled slots length:", (schedule.unfilled_slots || []).length);
  } else {
    console.log("No schedule returned", resData);
  }
}

run().catch(console.error);
